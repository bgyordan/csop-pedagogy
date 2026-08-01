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
    if (t.for_class_teacher && !t.for_specialist) return { label: 'Класен', cls: 'bg-blue-50 text-blue-600 border-blue-100' }
    if (t.for_specialist && !t.for_class_teacher) return { label: 'Терапевт', cls: 'bg-teal-50 text-teal-600 border-teal-100' }
    return null
  }

  const checkboxRow = (
    fc: boolean, sfc: (v: boolean) => void, fs: boolean, sfs: (v: boolean) => void,
    pg: boolean, spg: (v: boolean) => void,
  ) => (
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
    <div className="space-y-8">
      {/* ── Качване (само за управляващи) ── */}
      {canManage && !showUpload && (
        <button onClick={() => setShowUpload(true)}
          className="group inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-md hover:bg-slate-800 transition-all">
          <UploadCloud size={18} className="text-blue-400 group-hover:scale-110 transition-transform" /> Качи образец
        </button>
      )}

      {canManage && showUpload && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xl shadow-slate-100/50 space-y-5 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-950">Добавяне на нов образец</h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"><X size={18} /></button>
          </div>

          {/* Drop zone / избор на файл */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) validateAndSetFile(f) }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
              dragOver ? 'border-blue-400 bg-blue-50/50 shadow-inner' : pendingFile ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
            }`}>
            {pendingFile ? (
              <>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
                  <FileText size={28} strokeWidth={1.5} />
                  <div className='flex flex-col'>
                    <span className="text-sm font-semibold">{pendingFile.name}</span>
                    <span className="text-xs">{formatSize(pendingFile.size)}</span>
                  </div>
                </div>
                <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-medium">Кликнете за смяна на файла</span>
              </>
            ) : (
              <>
                <div className={`p-4 rounded-full transition-colors ${dragOver ? 'bg-blue-100' : 'bg-slate-100'}`}>
                  <UploadCloud size={32} className={dragOver ? 'text-blue-600' : 'text-slate-500'} />
                </div>
                <span className="text-base font-semibold text-slate-900">Пуснете файл тук</span>
                <span className="text-sm text-slate-600 text-center">или кликнете за избор от компютъра</span>
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full mt-2">Word, Excel или PDF · до 10MB</span>
              </>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.dot,.dotx,.xls,.xlsx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); e.target.value = '' }} />
          </div>

          {/* Заглавие — combobox с подсказки */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">Заглавие</label>
              <input type="text" value={title}
                onChange={e => { setTitle(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Доклад-оценка, ИУП..." className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
              {showSuggestions && titleMatches.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1.5 bg-white border border-slate-100 rounded-xl shadow-xl max-h-56 overflow-auto animate-in fade-in duration-200">
                  {titleMatches.map(s => (
                    <button key={s.title} type="button" onMouseDown={() => pickSuggestion(s)}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100/70 transition-colors">
                      {s.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">Група</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all appearance-none bg-white">
                {TEMPLATE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">Пояснение (незадължително)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="кратко описание на образеца" className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
          </div>

          <div className='flex flex-col gap-2'>
            <label className="block text-xs font-semibold text-slate-600 mb-1 ml-1">Приложимост</label>
            {checkboxRow(forClassTeacher, setForClassTeacher, forSpecialist, setForSpecialist, isPg, setIsPg)}
            <p className="text-[11px] text-slate-400 mt-1 ml-1">Без отметка образецът е за всички. „За ПГ" — за подготвителна група.</p>
          </div>

          <div className="flex items-center gap-2 justify-end pt-3 border-t border-slate-100">
            <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors">Отказ</button>
            <button onClick={doUpload} disabled={uploading || !title.trim() || !pendingFile}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 disabled:opacity-50 disabled:bg-slate-700 transition-all"
              >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? 'Качване…' : 'Качи образец'}
            </button>
          </div>
        </div>
      )}

      {/* ── Търсене + филтри (по-дискретни) ── */}
      <div className="space-y-4 pt-2">
        <div className="relative max-w-lg shadow-inner shadow-slate-50/50">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Търсене по заглавие или описание…"
            className="w-full pl-11 pr-4 py-3 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-200 transition-all" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setFilterCat('')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${filterCat === '' ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-white border border-slate-100 text-slate-700 hover:bg-slate-100'}`}>
            Всички
          </button>
          {TEMPLATE_CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setFilterCat(filterCat === c.key ? '' : c.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${filterCat === c.key ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-white border border-slate-100 text-slate-700 hover:bg-slate-100'}`}>
              {c.label}
            </button>
          ))}
          <span className="w-px h-5 bg-slate-100 mx-1" />
          <button onClick={() => setFilterRole(filterRole === 'class' ? '' : 'class')}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${filterRole === 'class' ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-white border border-slate-100 text-slate-600 hover:bg-slate-100'}`}>
            <GraduationCap size={13} /> Класен
          </button>
          <button onClick={() => setFilterRole(filterRole === 'specialist' ? '' : 'specialist')}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${filterRole === 'specialist' ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'bg-white border border-slate-100 text-slate-600 hover:bg-slate-100'}`}>
            <Heart size={13} /> Терапевт
          </button>
          <button onClick={() => setFilterPg(!filterPg)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${filterPg ? 'bg-violet-50 text-violet-800 border border-violet-200' : 'bg-white border border-slate-100 text-slate-600 hover:bg-slate-100'}`}>
            <Baby size={13} /> ПГ
          </button>
        </div>
      </div>

      {/* ── Резултати по групи ── */}
      <div className='flex flex-col gap-6 pt-2'>
        {TEMPLATE_CATEGORIES.map(cat => {
          const items = filtered
            .filter(t => t.category === cat.key)
            .sort((a, b) => a.title.localeCompare(b.title, 'bg', { numeric: true }))
          if (items.length === 0) return null
          return (
            <div key={cat.key} className="animate-in fade-in duration-300">
              <div className="flex items-center gap-3 mb-3.5">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">{cat.label}</h2>
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">{items.length}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {items.map((t) => {
                  const rb = roleBadge(t)
                  const isEditing = editId === t.id
                  if (isEditing) {
                    return (
                      <div key={t.id} className="rounded-xl border border-blue-100 bg-blue-50/20 p-5 space-y-3.5 shadow-inner">
                        <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                          className="w-full text-sm px-3.5 py-2 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-100 transition-all bg-white" placeholder="Заглавие" />
                        <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="w-full text-sm px-3.5 py-2 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-100 transition-all appearance-none bg-white">
                          {TEMPLATE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)}
                          className="w-full text-sm px-3.5 py-2 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-100 transition-all bg-white" placeholder="Пояснение (незадължително)" />
                        {checkboxRow(editForClass, setEditForClass, editForSpec, setEditForSpec, editIsPg, setEditIsPg)}
                        <div className="flex items-center gap-2 justify-end pt-1.5">
                          <button onClick={() => setEditId(null)}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-100 border border-slate-100 text-slate-700">Отказ</button>
                          <button onClick={saveEdit} disabled={savingEdit}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-slate-900 disabled:opacity-60 transition-all"
                            >
                            {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Запази промените
                          </button>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={t.id}
                      className="group flex items-center gap-4 px-5 py-3 rounded-xl bg-white border border-slate-100/70 transition-all duration-300 hover:border-blue-100 hover:shadow-[0_4px_20px_rgba(37,99,235,0.03)] hover:-translate-y-0.5">
                      
                      {/* Иконка */}
                      <div className={`p-2 rounded-xl transition-colors ${pendingFile ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'} group-hover:bg-blue-100 group-hover:text-blue-700`}>
                        <FileText size={20} strokeWidth={1.5} />
                      </div>
                      
                      {/* Заглавие + пояснение */}
                      <div className="min-w-0 flex-1">
                        <div className='flex items-center flex-wrap gap-x-2 gap-y-1'>
                          <span className="text-sm font-semibold text-slate-950">{t.title}</span>
                          {rb && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rb.cls}`}>{rb.label}</span>}
                          {t.is_pg && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-100">ПГ</span>}
                        </div>
                        {t.description && <span className="text-xs text-slate-500 mt-1 block group-hover:text-slate-600">{t.description}</span>}
                        <span className="text-[10px] text-slate-400 mt-1.5 block">Качен: {new Date(t.created_at).toLocaleDateString('bg')} • {formatSize(t.file_size)}</span>
                      </div>
                      
                      {/* Действия */}
                      <div className="flex items-center gap-1 flex-shrink-0 ml-auto transition-all">
                        <button onClick={() => handleDownload(t)} disabled={downloading === t.id}
                          className="p-2.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors" title="Изтегли">
                          {downloading === t.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        </button>
                        {canManage && (
                          <>
                            <button onClick={() => startEdit(t)}
                              className="p-2.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all transition-delay-100" title="Редактирай">
                              <Pencil size={16} />
                            </button>
                            <button onClick={() => handleDelete(t)}
                              className="p-2.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all transition-delay-150" title="Изтрий">
                              <Trash2 size={16} />
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
      </div>

      {/* ── Празно състояние ── */}
      {filtered.length === 0 && (
        <div className="text-center py-20 px-6 bg-white rounded-2xl border-2 border-dashed border-slate-100 animate-in fade-in duration-400 pt-16">
          <div className="w-20 h-20 mx-auto mb-6 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 shadow-inner">
            <FolderOpen size={42} strokeWidth={1} className="text-slate-300" />
          </div>
          {templates.length === 0 ? (
            <>
              <p className="text-base font-semibold text-slate-900">Списъкът е празен</p>
              {canManage ? (
                  <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Все още няма качени образци на документи. Използвайте бутона <span className='font-medium text-slate-700'>„Качи образец“</span> по-горе, за да добавите първия.</p>
              ) : (
                  <p className="text-sm text-slate-500 mt-1">Още няма качени образци.</p>
              )}
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-slate-900">Няма намерени образци</p>
              <p className="text-sm text-slate-500 mt-1">Не бяха открити документи, отговарящи на зададените критерии и търсене.</p>
              {hasActiveFilter && (
                <button onClick={() => { setSearch(''); setFilterCat(''); setFilterRole(''); setFilterPg(false) }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 mt-5 bg-blue-50 px-4 py-2 rounded-full border border-blue-100 transition-colors">
                    <X size={13} /> Изчисти филтрите и търсенето
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
