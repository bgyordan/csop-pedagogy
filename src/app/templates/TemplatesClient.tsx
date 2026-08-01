'use client'
import { useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Download, Trash2, FileText, Loader2, FolderOpen, Plus, X, Search, GraduationCap, Heart, Baby, Pencil, Check, UploadCloud } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Template {
  id: string
  title: string
  category: string
  file_name: string
  file_path: string
  file_size: number | null
  description: string | null
  for_class_teacher: boolean
  for_specialist: boolean
  is_pg: boolean
  created_at: string
}

interface Props {
  templates: Template[]
  canManage: boolean
  staffId: string
}

export const TEMPLATE_CATEGORIES: { key: string; label: string }[] = [
  { key: 'protocols', label: 'Протоколи' },
  { key: 'assessments', label: 'Оценки' },
  { key: 'plans', label: 'Планове и програми' },
  { key: 'characteristics', label: 'Характеристики' },
  { key: 'other', label: 'Други' },
]

const TITLE_SUGGESTIONS: { title: string; category: string }[] = [
  { title: 'Доклад-оценка', category: 'assessments' },
  { title: 'Протокол №1', category: 'protocols' },
  { title: 'Протокол №2', category: 'protocols' },
  { title: 'Протокол №3', category: 'protocols' },
  { title: 'Карта функционална оценка', category: 'assessments' },
  { title: 'План за допълнителна подкрепа', category: 'plans' },
  { title: 'ИУП (клас)', category: 'plans' },
  { title: 'ИУ Програма (училище)', category: 'plans' },
  { title: 'Характеристика', category: 'characteristics' },
]

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const ACCEPTED = ['pdf', 'doc', 'docx', 'dot', 'dotx', 'xls', 'xlsx']

export default function TemplatesClient({ templates: initial, canManage, staffId }: Props) {
  const supabase = createClient()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>(initial)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [category, setCategory] = useState('protocols')
  const [description, setDescription] = useState('')
  const [forClassTeacher, setForClassTeacher] = useState(false)
  const [forSpecialist, setForSpecialist] = useState(false)
  const [isPg, setIsPg] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('protocols')
  const [editDescription, setEditDescription] = useState('')
  const [editForClass, setEditForClass] = useState(false)
  const [editForSpec, setEditForSpec] = useState(false)
  const [editIsPg, setEditIsPg] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterPg, setFilterPg] = useState(false)

  const titleMatches = useMemo(() => {
    const q = title.trim().toLowerCase()
    if (!q) return TITLE_SUGGESTIONS
    return TITLE_SUGGESTIONS.filter(s => s.title.toLowerCase().includes(q))
  }, [title])

  function pickSuggestion(s: { title: string; category: string }) {
    setTitle(s.title); setCategory(s.category); setShowSuggestions(false)
  }

  function resetForm() {
    setTitle(''); setDescription(''); setPendingFile(null)
    setForClassTeacher(false); setForSpecialist(false); setIsPg(false)
    setCategory('protocols'); setShowUpload(false)
  }

  function validateAndSetFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED.includes(ext || '')) { toast('Позволени: Word, Excel, PDF', 'error'); return }
    if (file.size > 10 * 1024 * 1024) { toast('Файлът е прекалено голям (макс. 10MB)', 'error'); return }
    setPendingFile(file)
  }

  async function doUpload() {
    if (!title.trim() || !pendingFile) return
    setUploading(true)
    const safeName = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
    const filePath = `${category}/${Date.now()}_${safeName}`
    const { error: upErr } = await supabase.storage.from('templates').upload(filePath, pendingFile)
    if (upErr) { toast('Грешка при качване', 'error'); setUploading(false); return }
    const { data: newT, error: dbErr } = await supabase.from('document_templates').insert({
      title: title.trim(), category, file_name: pendingFile.name, file_path: filePath,
      file_size: pendingFile.size, description: description.trim() || null, uploaded_by: staffId,
      for_class_teacher: forClassTeacher, for_specialist: forSpecialist, is_pg: isPg,
    }).select().single()
    if (dbErr) { toast('Грешка при запис', 'error'); setUploading(false); return }
    toast('Образецът е качен'); setTemplates(prev => [newT, ...prev]); resetForm(); setUploading(false)
  }

  async function handleDownload(t: Template) {
    setDownloading(t.id)
    const { data, error } = await supabase.storage.from('templates').createSignedUrl(t.file_path, 60)
    if (error || !data) { toast('Грешка при изтегляне', 'error'); setDownloading(null); return }
    window.open(data.signedUrl, '_blank'); setDownloading(null)
  }

  async function handleDelete(t: Template) {
    if (!confirm(`Изтрий образеца "${t.title}"?`)) return
    await supabase.storage.from('templates').remove([t.file_path])
    await supabase.from('document_templates').delete().eq('id', t.id)
    toast('Образецът е изтрит'); setTemplates(prev => prev.filter(x => x.id !== t.id))
  }

  function startEdit(t: Template) {
    setEditId(t.id); setEditTitle(t.title); setEditCategory(t.category)
    setEditDescription(t.description || ''); setEditForClass(t.for_class_teacher)
    setEditForSpec(t.for_specialist); setEditIsPg(t.is_pg)
  }

  async function saveEdit() {
    if (!editId || !editTitle.trim()) return
    setSavingEdit(true)
    const { error } = await supabase.from('document_templates').update({
      title: editTitle.trim(), category: editCategory, description: editDescription.trim() || null,
      for_class_teacher: editForClass, for_specialist: editForSpec, is_pg: editIsPg,
    }).eq('id', editId)
    if (error) { toast('Грешка при запис', 'error'); setSavingEdit(false); return }
    toast('Образецът е обновен')
    setTemplates(prev => prev.map(t => t.id === editId ? { ...t, title: editTitle.trim(), category: editCategory, description: editDescription.trim() || null, for_class_teacher: editForClass, for_specialist: editForSpec, is_pg: editIsPg } : t))
    setEditId(null); setSavingEdit(false)
  }

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (search.trim() && !t.title.toLowerCase().includes(search.toLowerCase()) && !(t.description || '').toLowerCase().includes(search.toLowerCase())) return false
      if (filterCat && t.category !== filterCat) return false
      if (filterRole === 'class' && !(t.for_class_teacher || (!t.for_class_teacher && !t.for_specialist))) return false
      if (filterRole === 'specialist' && !(t.for_specialist || (!t.for_class_teacher && !t.for_specialist))) return false
      if (filterPg && !t.is_pg) return false
      return true
    })
  }, [templates, search, filterCat, filterRole, filterPg])

  const checkboxRow = (fc: boolean, sfc: (v: boolean) => void, fs: boolean, sfs: (v: boolean) => void, pg: boolean, spg: (v: boolean) => void ) => (
    <div className="flex flex-wrap gap-2">
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
        <input type="checkbox" checked={fc} onChange={e => sfc(e.target.checked)} className="accent-blue-600 w-3.5 h-3.5" />
        <GraduationCap size={13} className="text-slate-500" /> За класен
      </label>
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
        <input type="checkbox" checked={fs} onChange={e => sfs(e.target.checked)} className="accent-teal-600 w-3.5 h-3.5" />
        <Heart size={13} className="text-slate-500" /> За терапевт
      </label>
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
        <input type="checkbox" checked={pg} onChange={e => spg(e.target.checked)} className="accent-violet-600 w-3.5 h-3.5" />
        <Baby size={13} className="text-slate-500" /> За ПГ
      </label>
    </div>
  )

  const hasActiveFilter = filterCat || filterRole || filterPg || search.trim()

  return (
    <div className="space-y-6">
      {/* ── Качване ── */}
      {canManage && !showUpload && (
        <button onClick={() => setShowUpload(true)} className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow hover:bg-slate-800 transition-all">
          <UploadCloud size={17} className="text-blue-400" /> Качи образец
        </button>
      )}

      {canManage && showUpload && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xl shadow-slate-100/40 space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-950">Добавяне на нов образец</h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors"><X size={17} /></button>
          </div>
          <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) validateAndSetFile(f) }} onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 py-8 px-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${ dragOver ? 'border-blue-400 bg-blue-50/50' : pendingFile ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50' }`}>
            {pendingFile ? (
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-sm">
                <FileText size={24} strokeWidth={1.5} />
                <div className='flex flex-col'><span className="text-xs font-semibold truncate max-w-xs">{pendingFile.name}</span><span className="text-[10px]">{formatSize(pendingFile.size)}</span></div>
              </div>
            ) : (
              <>
                <UploadCloud size={28} className={dragOver ? 'text-blue-600' : 'text-slate-400'} />
                <span className="text-sm font-semibold text-slate-900">Пуснете файл тук или кликнете</span>
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-0.5 rounded-full mt-1">Word, Excel, PDF · до 10MB</span>
              </>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.dot,.dotx,.xls,.xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); e.target.value = '' }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1 ml-1">Заглавие</label>
              <input type="text" value={title} onChange={e => { setTitle(e.target.value); setShowSuggestions(true) }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} placeholder="Доклад-оценка, ИУП..." className="input w-full text-sm appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all" />
              {showSuggestions && titleMatches.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1.5 bg-white border border-slate-100 rounded-lg shadow-xl max-h-56 overflow-auto animate-in fade-in duration-200">
                  {titleMatches.map(s => <button key={s.title} type="button" onMouseDown={() => pickSuggestion(s)} className="w-full text-left px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-100/70 transition-colors">{s.title}</button> )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1 ml-1">Група</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="input w-full text-sm appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all">
                {TEMPLATE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 ml-1">Пояснение (незадължително)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="кратко описание на образеца" className="input w-full text-sm appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all" />
          </div>
          <div className='flex flex-col gap-1.5'>{checkboxRow(forClassTeacher, setForClassTeacher, forSpecialist, setForSpecialist, isPg, setIsPg)}</div>
          <div className="flex items-center gap-2 justify-end pt-3 border-t border-slate-100">
            <button onClick={resetForm} className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors">Отказ</button>
            <button onClick={doUpload} disabled={uploading || !title.trim() || !pendingFile} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 disabled:opacity-50 transition-all">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} {uploading ? 'Качване…' : 'Качи образец'}
            </button>
          </div>
        </div>
      )}

      {/* ── Търсене + филтри ── */}
      <div className="space-y-3.5">
        <div className="relative max-w-md shadow-inner shadow-slate-50/50">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Търсене по заглавие…" className="w-full pl-9 pr-3 py-2.5 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-200 transition-all" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setFilterCat('')} className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${filterCat === '' ? 'bg-blue-600 text-white shadow shadow-blue-100' : 'bg-white border border-slate-100 text-slate-700 hover:bg-slate-100'}`}>Всички</button>
          {TEMPLATE_CATEGORIES.map(c => ( <button key={c.key} onClick={() => setFilterCat(filterCat === c.key ? '' : c.key)} className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${filterCat === c.key ? 'bg-blue-600 text-white shadow shadow-blue-100' : 'bg-white border border-slate-100 text-slate-700 hover:bg-slate-100'}`}>{c.label}</button> ))}
          <span className="w-px h-5 bg-slate-100 mx-1" />
          <button onClick={() => setFilterRole(filterRole === 'class' ? '' : 'class')} className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${filterRole === 'class' ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-white border border-slate-100 text-slate-600 hover:bg-slate-100'}`}><GraduationCap size={13} /> Класен</button>
          <button onClick={() => setFilterRole(filterRole === 'specialist' ? '' : 'specialist')} className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${filterRole === 'specialist' ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'bg-white border border-slate-100 text-slate-600 hover:bg-slate-100'}`}><Heart size={13} /> Терапевт</button>
          <button onClick={() => setFilterPg(!filterPg)} className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${filterPg ? 'bg-violet-50 text-violet-800 border border-violet-200' : 'bg-white border border-slate-100 text-slate-600 hover:bg-slate-100'}`}><Baby size={13} /> ПГ</button>
        </div>
      </div>

      {/* ── Списък по групи (Компактен) ── */}
      <div className='flex flex-col gap-5 pt-1'>
        {TEMPLATE_CATEGORIES.map(cat => {
          const items = filtered.filter(t => t.category === cat.key).sort((a, b) => a.title.localeCompare(b.title, 'bg', { numeric: true }))
          if (items.length === 0) return null
          return (
            <div key={cat.key} className="animate-in fade-in duration-300 space-y-1.5">
              <div className="flex items-center gap-2 mb-2 pl-1">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{cat.label}</h2>
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{items.length}</span>
              </div>
              <div className="flex flex-col gap-1">
                {items.map((t) => {
                  if (editId === t.id) {
                    return (
                      <div key={t.id} className="rounded-xl border border-blue-100 bg-blue-50/20 p-4 space-y-3 shadow-inner">
                        <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full text-sm px-3 py-1.5 rounded-lg border border-blue-200 bg-white" placeholder="Заглавие" />
                        <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="w-full text-sm px-3 py-1.5 rounded-lg border border-blue-200 bg-whiteappearance-none bg-white">{TEMPLATE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                        <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)} className="w-full text-sm px-3 py-1.5 rounded-lg border border-blue-200 bg-white" placeholder="Пояснение (незадължително)" />
                        {checkboxRow(editForClass, setEditForClass, editForSpec, setEditForSpec, editIsPg, setEditIsPg)}
                        <div className="flex items-center gap-2 justify-end pt-1"><button onClick={() => setEditId(null)} className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-100 border border-slate-100 text-slate-700">Отказ</button><button onClick={saveEdit} disabled={savingEdit} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-slate-900 disabled:opacity-60 transition-all">{savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Запази</button></div>
                      </div>
                    )
                  }
                  return (
                    <div key={t.id} className="group flex items-center gap-3.5 px-4 py-2 rounded-xl bg-white border border-slate-100 hover:border-blue-100 hover:shadow-lg hover:shadow-blue-50 hover:-translate-y-0.5 transition-all duration-300">
                      {/* Иконка */}
                      <div className={`p-1.5 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors flex-shrink-0`}>
                        <FileText size={17} strokeWidth={1.5} />
                      </div>
                      
                      {/* Заглавие + пояснение (Един ред, Трункейт) */}
                      <div className="min-w-0 flex-1 flex flex-col pt-0.5 leading-tight">
                        <div className='flex items-center gap-1.5 truncate'>
                          <span className="text-sm font-medium text-slate-950 truncate flex-shrink-0">{t.title}</span>
                          {t.description && <span className="text-xs text-slate-500 truncate group-hover:text-slate-600">— {t.description}</span>}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5">Качен: {new Date(t.created_at).toLocaleDateString('bg')} • {formatSize(t.file_size)}</span>
                      </div>
                      
                      {/* Действия */}
                      <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto transition-all">
                        <button onClick={() => handleDownload(t)} disabled={downloading === t.id} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors" title="Изтегли">{downloading === t.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}</button>
                        {canManage && (
                          <><button onClick={() => startEdit(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity" title="Редактирай"><Pencil size={14} /></button><button onClick={() => handleDelete(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" title="Изтрий"><Trash2 size={14} /></button></>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Празно състояние ── */}
      {filtered.length === 0 && (
        <div className="text-center py-16 px-6 bg-white rounded-2xl border-2 border-dashed border-slate-100 animate-in fade-in duration-400">
          <div className="w-16 h-16 mx-auto mb-5 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 shadow-inner"><FolderOpen size={36} strokeWidth={1} className="text-slate-300" /></div>
          {templates.length === 0 ? (
            <>{p className="text-sm font-semibold text-slate-900">Списъкът е празен</p>{canManage ? (p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Все още няма качени образци. Използвайте бутона <span className='font-medium text-slate-700'>„Качи образец“</span> по-горе.</p> ) : ( p className="text-xs text-slate-500 mt-1">Още няма качени образци.</p> )}</>
          ) : (
            <>{p className="text-sm font-semibold text-slate-900">Няма намерени образци</p><p className="text-xs text-slate-500 mt-1">Не бяха открити документи, отговарящи на търсенето.</p>{hasActiveFilter && ( <button onClick={() => { setSearch(''); setFilterCat(''); setFilterRole(''); setFilterPg(false) }} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 mt-4 bg-blue-50 px-3 py-1 rounded-full border border-blue-100"><X size={12} /> Изчисти търсенето</button> )}</>
          )}
        </div>
      )}
    </div>
  )
}
