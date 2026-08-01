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

// Познати документи → подсказки за заглавието + предложена група
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

  // Форма за качване
  const [title, setTitle] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [category, setCategory] = useState('protocols')
  const [description, setDescription] = useState('')
  const [forClassTeacher, setForClassTeacher] = useState(false)
  const [forSpecialist, setForSpecialist] = useState(false)
  const [isPg, setIsPg] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Редакция
  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('protocols')
  const [editDescription, setEditDescription] = useState('')
  const [editForClass, setEditForClass] = useState(false)
  const [editForSpec, setEditForSpec] = useState(false)
  const [editIsPg, setEditIsPg] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  // Филтри
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterPg, setFilterPg] = useState(false)

  // Подсказки за заглавието (combobox)
  const titleMatches = useMemo(() => {
    const q = title.trim().toLowerCase()
    if (!q) return TITLE_SUGGESTIONS
    return TITLE_SUGGESTIONS.filter(s => s.title.toLowerCase().includes(q))
  }, [title])

  function pickSuggestion(s: { title: string; category: string }) {
    setTitle(s.title)
    setCategory(s.category)   // предлага групата, но може да се смени
    setShowSuggestions(false)
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
    if (!title.trim()) { toast('Въведете заглавие', 'error'); return }
    if (!pendingFile) { toast('Изберете файл', 'error'); return }
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
    toast('Образецът е качен')
    setTemplates(prev => [newT, ...prev])
    resetForm(); setUploading(false)
  }

  async function handleDownload(t: Template) {
    setDownloading(t.id)
    const { data, error } = await supabase.storage.from('templates').createSignedUrl(t.file_path, 60)
    if (error || !data) { toast('Грешка при изтегляне', 'error'); setDownloading(null); return }
    window.open(data.signedUrl, '_blank')
    setDownloading(null)
  }

  async function handleDelete(t: Template) {
    if (!confirm(`Изтрий образеца "${t.title}"?`)) return
    await supabase.storage.from('templates').remove([t.file_path])
    await supabase.from('document_templates').delete().eq('id', t.id)
    toast('Образецът е изтрит')
    setTemplates(prev => prev.filter(x => x.id !== t.id))
  }

  function startEdit(t: Template) {
    setEditId(t.id); setEditTitle(t.title); setEditCategory(t.category)
    setEditDescription(t.description || ''); setEditForClass(t.for_class_teacher)
    setEditForSpec(t.for_specialist); setEditIsPg(t.is_pg)
  }

  async function saveEdit() {
    if (!editId || !editTitle.trim()) { toast('Заглавието е задължително', 'error'); return }
    setSavingEdit(true)
    const { error } = await supabase.from('document_templates').update({
      title: editTitle.trim(), category: editCategory, description: editDescription.trim() || null,
      for_class_teacher: editForClass, for_specialist: editForSpec, is_pg: editIsPg,
    }).eq('id', editId)
    if (error) { toast('Грешка при запис', 'error'); setSavingEdit(false); return }
    toast('Образецът е обновен')
    setTemplates(prev => prev.map(t => t.id === editId ? {
      ...t, title: editTitle.trim(), category: editCategory, description: editDescription.trim() || null,
      for_class_teacher: editForClass, for_specialist: editForSpec, is_pg: editIsPg,
    } : t))
    setEditId(null); setSavingEdit(false)
  }

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (search.trim() && !t.title.toLowerCase().includes(search.toLowerCase()) &&
          !(t.description || '').toLowerCase().includes(search.toLowerCase())) return false
      if (filterCat && t.category !== filterCat) return false
      if (filterRole === 'class' && !(t.for_class_teacher || (!t.for_class_teacher && !t.for_specialist))) return false
      if (filterRole === 'specialist' && !(t.for_specialist || (!t.for_class_teacher && !t.for_specialist))) return false
      if (filterPg && !t.is_pg) return false
      return true
    })
  }, [templates, search, filterCat, filterRole, filterPg])

  const roleBadge = (t: Template) => {
    if (t.for_class_teacher && !t.for_specialist) return { label: 'Класен', cls: 'bg-blue-50 text-blue-600 border-blue-200' }
    if (t.for_specialist && !t.for_class_teacher) return { label: 'Терапевт', cls: 'bg-teal-50 text-teal-600 border-teal-200' }
    return null
  }

  const checkboxRow = (
    fc: boolean, sfc: (v: boolean) => void, fs: boolean, sfs: (v: boolean) => void,
    pg: boolean, spg: (v: boolean) => void,
  ) => (
    <div className="flex flex-wrap gap-2">
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors">
        <input type="checkbox" checked={fc} onChange={e => sfc(e.target.checked)} className="accent-[#0f2240]" />
        <GraduationCap size={13} /> За класен
      </label>
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors">
        <input type="checkbox" checked={fs} onChange={e => sfs(e.target.checked)} className="accent-[#0f2240]" />
        <Heart size={13} /> За терапевт
      </label>
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors">
        <input type="checkbox" checked={pg} onChange={e => spg(e.target.checked)} className="accent-[#0f2240]" />
        <Baby size={13} /> За ПГ
      </label>
    </div>
  )

  const hasActiveFilter = filterCat || filterRole || filterPg || search.trim()

  return (
    <div className="space-y-6">
      {/* ── Качване (само за управляващи) ── */}
      {canManage && !showUpload && (
        <button onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
          style={{ backgroundColor: '#0f2240' }}>
          <Plus size={16} /> Качи образец
        </button>
      )}

      {canManage && showUpload && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Нов образец</h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
          </div>

          {/* Drop zone / избор на файл */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) validateAndSetFile(f) }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
              dragOver ? 'border-blue-400 bg-blue-50/50' : pendingFile ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
            }`}>
            {pendingFile ? (
              <>
                <div className="flex items-center gap-2 text-emerald-600">
                  <FileText size={20} />
                  <span className="text-sm font-semibold text-slate-800">{pendingFile.name}</span>
                </div>
                <span className="text-xs text-slate-400">{formatSize(pendingFile.size)} · клик за смяна</span>
              </>
            ) : (
              <>
                <UploadCloud size={28} className={dragOver ? 'text-blue-500' : 'text-slate-300'} />
                <span className="text-sm font-medium text-slate-600">Пуснете файл тук или кликнете</span>
                <span className="text-xs text-slate-400">Word, Excel или PDF · до 10MB</span>
              </>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.dot,.dotx,.xls,.xlsx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); e.target.value = '' }} />
          </div>

          {/* Заглавие — combobox с подсказки */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Заглавие</label>
              <input type="text" value={title}
                onChange={e => { setTitle(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Започнете да пишете…" className="input w-full text-sm" />
              {showSuggestions && titleMatches.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-auto">
                  {titleMatches.map(s => (
                    <button key={s.title} type="button" onMouseDown={() => pickSuggestion(s)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 transition-colors">
                      {s.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Група</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="input w-full text-sm">
                {TEMPLATE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Пояснение (незадължително)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="кратко описание" className="input w-full text-sm" />
          </div>

          {checkboxRow(forClassTeacher, setForClassTeacher, forSpecialist, setForSpecialist, isPg, setIsPg)}
          <p className="text-[10px] text-slate-400">Без отметка „за роля" образецът е за всички. „За ПГ" — вариант за подготвителна група.</p>

          <div className="flex items-center gap-2 justify-end pt-1">
            <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">Отказ</button>
            <button onClick={doUpload} disabled={uploading || !title.trim() || !pendingFile}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#0f2240' }}>
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {uploading ? 'Качване…' : 'Качи'}
            </button>
          </div>
        </div>
      )}

      {/* ── Търсене + филтри (по-дискретни) ── */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Търсене по заглавие…"
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setFilterCat('')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterCat === '' ? 'bg-[#0f2240] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Всички
          </button>
          {TEMPLATE_CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setFilterCat(filterCat === c.key ? '' : c.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterCat === c.key ? 'bg-[#0f2240] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {c.label}
            </button>
          ))}
          <span className="w-px h-4 bg-slate-200 mx-1" />
          <button onClick={() => setFilterRole(filterRole === 'class' ? '' : 'class')}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterRole === 'class' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <GraduationCap size={12} /> Класен
          </button>
          <button onClick={() => setFilterRole(filterRole === 'specialist' ? '' : 'specialist')}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterRole === 'specialist' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <Heart size={12} /> Терапевт
          </button>
          <button onClick={() => setFilterPg(!filterPg)}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterPg ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <Baby size={12} /> ПГ
          </button>
        </div>
      </div>

      {/* ── Резултати по групи — широки редове, сортирани по заглавие, зебра ── */}
      {TEMPLATE_CATEGORIES.map(cat => {
        const items = filtered
          .filter(t => t.category === cat.key)
          .sort((a, b) => a.title.localeCompare(b.title, 'bg', { numeric: true }))
        if (items.length === 0) return null
        return (
          <div key={cat.key}>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{cat.label}</h2>
              <span className="text-[11px] text-slate-300">{items.length}</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <div className="flex flex-col gap-2">
              {items.map((t) => {
                const rb = roleBadge(t)
                const isEditing = editId === t.id
                if (isEditing) {
                  return (
                    <div key={t.id} className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-2.5">
                      <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                        className="input w-full text-sm" placeholder="Заглавие" />
                      <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="input w-full text-sm">
                        {TEMPLATE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                      <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)}
                        className="input w-full text-sm" placeholder="Пояснение (незадължително)" />
                      {checkboxRow(editForClass, setEditForClass, editForSpec, setEditForSpec, editIsPg, setEditIsPg)}
                      <div className="flex items-center gap-2 justify-end pt-1">
                        <button onClick={() => setEditId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600">Отказ</button>
                        <button onClick={saveEdit} disabled={savingEdit}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-60"
                          style={{ backgroundColor: '#0f2240' }}>
                          {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Запази
                        </button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={t.id}
                    className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-transparent bg-slate-50/60 transition-all duration-300 hover:bg-white hover:border-blue-200/70 hover:shadow-[0_2px_12px_rgba(15,34,64,0.05)] hover:translate-x-1">
                    {/* Иконка */}
                    <FileText size={17} className="text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                    {/* Заглавие (клик = сваляне) + пояснение inline */}
                    <button onClick={() => handleDownload(t)} className="min-w-0 flex-1 text-left">
                      <span className="text-sm font-medium text-slate-800 group-hover:text-blue-700 transition-colors">{t.title}</span>
                      {rb && <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full border align-middle ${rb.cls}`}>{rb.label}</span>}
                      {t.is_pg && <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-600 border-violet-200 align-middle">ПГ</span>}
                      {t.description && <span className="text-[11px] text-slate-400 ml-2">— {t.description}</span>}
                    </button>
                    {/* Действия */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button onClick={() => handleDownload(t)} disabled={downloading === t.id}
                        className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Изтегли">
                        {downloading === t.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                      </button>
                      {canManage && (
                        <>
                          <button onClick={() => startEdit(t)}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100" title="Редактирай">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => handleDelete(t)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100" title="Изтрий">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* ── Празно състояние ── */}
      {filtered.length === 0 && (
        <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <FolderOpen size={36} className="mx-auto mb-3 text-slate-300" />
          {templates.length === 0 ? (
            <>
              <p className="text-sm font-medium text-slate-600">Още няма образци</p>
              {canManage && <p className="text-xs text-slate-400 mt-1">Качете първия с бутона „Качи образец"</p>}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600">Няма образци по този филтър</p>
              {hasActiveFilter && (
                <button onClick={() => { setSearch(''); setFilterCat(''); setFilterRole(''); setFilterPg(false) }}
                  className="text-xs text-blue-600 hover:underline mt-1">Изчистете филтрите</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
