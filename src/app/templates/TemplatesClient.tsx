'use client'
import { useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, Download, Trash2, FileText, Loader2, FolderOpen, Plus, X, Search,
  Baby, Pencil, Check, UploadCloud, Briefcase, ClipboardList, FileCheck, FileSpreadsheet
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
interface Template {
  id: string
  title: string
  file_name: string
  file_path: string
  file_size: number | null
  description: string | null
  is_pg: boolean
  is_administrative: boolean
  created_at: string
}
interface Props {
  templates: Template[]
  canManage: boolean
  staffId: string
}
const TITLE_SUGGESTIONS: string[] = [
  'Доклад-оценка', 'Протокол №1', 'Протокол №2', 'Протокол №3',
  'Карта функционална оценка', 'План за допълнителна подкрепа',
  'ИУП (клас)', 'ИУ Програма (училище)', 'Характеристика',
  'Заявление за отпуск', 'Отсъствия по семейни причини', 'Декларация лекторски часове',
]
function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'xls' || ext === 'xlsx') return <FileSpreadsheet size={16} className="text-emerald-600 flex-shrink-0" />
  if (ext === 'pdf') return <FileCheck size={16} className="text-rose-600 flex-shrink-0" />
  return <FileText size={16} className="text-blue-600 flex-shrink-0" />
}
function getFileBadge(fileName: string) {
  const ext = fileName.split('.').pop()?.toUpperCase() || 'DOC'
  if (ext === 'XLS' || ext === 'XLSX') return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">EXCEL</span>
  if (ext === 'PDF') return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">PDF</span>
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">WORD</span>
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
  const [description, setDescription] = useState('')
  const [isPg, setIsPg] = useState(false)
  const [isAdministrative, setIsAdministrative] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIsPg, setEditIsPg] = useState(false)
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [search, setSearch] = useState('')
  const [filterPg, setFilterPg] = useState(false)
  const [sortBy, setSortBy] = useState<'title' | 'date'>('title')
  const titleMatches = useMemo(() => {
    const q = title.trim().toLowerCase()
    if (!q) return []
    return TITLE_SUGGESTIONS.filter(s => s.toLowerCase().includes(q))
  }, [title])
  function resetForm() {
    setTitle(''); setDescription(''); setPendingFile(null)
    setIsPg(false); setIsAdministrative(false); setShowUpload(false)
  }
  function validateAndSetFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED.includes(ext || '')) { toast('Позволени: Word, Excel, PDF', 'error'); return }
    if (file.size > 10 * 1024 * 1024) { toast('Файлът е прекалено голям (макс. 10MB)', 'error'); return }
    setPendingFile(file)
    if (!title.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
      setTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1))
    }
  }
  async function doUpload() {
    if (!title.trim()) { toast('Въведете заглавие', 'error'); return }
    if (!pendingFile) { toast('Изберете файл', 'error'); return }
    setUploading(true)
    const safeName = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
    const filePath = `${isAdministrative ? 'admin' : 'activity'}/${Date.now()}_${safeName}`
    const { error: upErr } = await supabase.storage.from('templates').upload(filePath, pendingFile)
    if (upErr) { toast('Грешка при качване', 'error'); setUploading(false); return }
    const { data: newT, error: dbErr } = await supabase.from('document_templates').insert({
      title: title.trim(), category: isAdministrative ? 'administrative' : 'other',
      file_name: pendingFile.name, file_path: filePath,
      file_size: pendingFile.size, description: description.trim() || null, uploaded_by: staffId,
      is_pg: isPg, is_administrative: isAdministrative,
    }).select().single()
    if (dbErr || !newT) { toast('Грешка при запис', 'error'); setUploading(false); return }
    toast('Образецът е качен')
    setTemplates(prev => [newT, ...prev])
    resetForm(); setUploading(false)
  }
  async function handleDownload(t: Template) {
    setDownloading(t.id)
    const { data, error } = await supabase.storage.from('templates').createSignedUrl(t.file_path, 60)
    if (error || !data) { toast('Грешка при изтегляне', 'error'); setDownloading(null); return }
    const link = document.createElement('a')
    link.href = data.signedUrl
    link.download = t.file_name || `${t.title}.docx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
    setEditId(t.id); setEditTitle(t.title)
    setEditDescription(t.description || ''); setEditIsPg(t.is_pg); setEditIsAdmin(t.is_administrative)
  }
  async function saveEdit() {
    if (!editId || !editTitle.trim()) { toast('Заглавието е задължително', 'error'); return }
    setSavingEdit(true)
    const { error } = await supabase.from('document_templates').update({
      title: editTitle.trim(), description: editDescription.trim() || null,
      is_pg: editIsPg, is_administrative: editIsAdmin,
      category: editIsAdmin ? 'administrative' : 'other',
    }).eq('id', editId)
    if (error) { toast('Грешка при запис', 'error'); setSavingEdit(false); return }
    toast('Образецът е обновен')
    setTemplates(prev => prev.map(t => t.id === editId ? {
      ...t, title: editTitle.trim(), description: editDescription.trim() || null,
      is_pg: editIsPg, is_administrative: editIsAdmin,
    } : t))
    setEditId(null); setSavingEdit(false)
  }
  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (search.trim() && !t.title.toLowerCase().includes(search.toLowerCase()) &&
          !(t.description || '').toLowerCase().includes(search.toLowerCase()) &&
          !t.file_name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [templates, search])
  const sortFn = (a: Template, b: Template) =>
    sortBy === 'date'
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : a.title.localeCompare(b.title, 'bg', { numeric: true })
  const adminItems = useMemo(() => filtered.filter(t => t.is_administrative).sort(sortFn), [filtered, sortBy])
  const activityItems = useMemo(() => filtered.filter(t => !t.is_administrative).filter(t => filterPg ? t.is_pg : !t.is_pg).sort(sortFn), [filtered, filterPg, sortBy])
  const checkboxRow = (
    admin: boolean, sadmin: (v: boolean) => void, pg: boolean, spg: (v: boolean) => void,
  ) => (
    <div className="flex flex-wrap gap-2.5 my-1">
      <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${admin ? 'bg-[#0f2240] text-white border-[#0f2240] shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
        <input type="checkbox" checked={admin} onChange={e => sadmin(e.target.checked)} className="sr-only" />
        <Briefcase size={14} /> Административен
      </label>
      <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${pg ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
        <input type="checkbox" checked={pg} onChange={e => spg(e.target.checked)} className="sr-only" />
        <Baby size={14} /> За ПГ (Подготвителна група)
      </label>
    </div>
  )
  const hasActiveFilter = filterPg || search.trim()
  function DocRow({ t, idx }: { t: Template; idx: number }) {
    const isEditing = editId === t.id
    if (isEditing) {
      return (
        <div className="border-b border-slate-100 bg-blue-50/40 p-4 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">Редакция на образец</span>
            <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none" placeholder="Заглавие" />
          <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none" placeholder="Пояснение (незадължително)" />
          {checkboxRow(editIsAdmin, setEditIsAdmin, editIsPg, setEditIsPg)}
          <div className="flex items-center gap-2 justify-end pt-1">
            <button onClick={() => setEditId(null)} className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200">Отказ</button>
            <button onClick={saveEdit} disabled={savingEdit}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-60 transition-all hover:opacity-90"
              style={{ backgroundColor: '#0f2240' }}>
              {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Запази промените
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className={`group flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 transition-all duration-150 hover:bg-blue-50/50 hover:translate-x-0.5 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-2 rounded-xl bg-slate-100 group-hover:bg-blue-100 transition-colors flex-shrink-0">
            {getFileIcon(t.file_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => handleDownload(t)}
                className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors text-left truncate">
                {t.title}
              </button>
              {getFileBadge(t.file_name)}
              {t.is_pg && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200">ПГ</span>}
            </div>
            {(t.description || t.file_size) && (
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                {t.description && <span className="truncate text-slate-500">{t.description}</span>}
                {t.description && t.file_size && <span className="text-slate-300">·</span>}
                {t.file_size && <span className="flex-shrink-0">{formatSize(t.file_size)}</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => handleDownload(t)} disabled={downloading === t.id}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-100/60 border border-slate-200 transition-all" title="Изтегли">
            {downloading === t.id ? <Loader2 size={14} className="animate-spin text-blue-600" /> : <Download size={14} />}
            <span className="hidden sm:inline">Изтегли</span>
          </button>
          {canManage && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 pl-1 border-l border-slate-200">
              <button onClick={() => startEdit(t)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-colors" title="Редактирай">
                <Pencil size={15} />
              </button>
              <button onClick={() => handleDelete(t)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-100/60 transition-colors" title="Изтрий">
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Заглавен блок + качване */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FolderOpen size={24} style={{ color: '#0f2240' }} />
              Банка за бланки и образци
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Официални бланки, протоколи, заявления и доклади</p>
          </div>
          {canManage && !showUpload && (
            <button onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              style={{ backgroundColor: '#0f2240' }}>
              <Plus size={16} /> Качи образец
            </button>
          )}
        </div>
        {canManage && showUpload && (
          <div className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UploadCloud size={16} style={{ color: '#0f2240' }} /> Качване на нов образец
              </h3>
              <button onClick={resetForm} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"><X size={16} /></button>
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) validateAndSetFile(f) }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                dragOver ? 'border-blue-500 bg-blue-100/40' : pendingFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 hover:border-blue-400 hover:bg-white'
              }`}>
              {pendingFile ? (
                <div className="text-center space-y-1">
                  <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-100 text-emerald-700 mb-1"><FileText size={24} /></div>
                  <p className="text-sm font-bold text-slate-900">{pendingFile.name}</p>
                  <p className="text-xs text-slate-500">{formatSize(pendingFile.size)} · клик за смяна</p>
                </div>
              ) : (
                <div className="text-center space-y-1">
                  <div className="inline-flex items-center justify-center p-3 rounded-full bg-slate-200/80 mb-1"><UploadCloud size={24} style={{ color: '#0f2240' }} /></div>
                  <p className="text-sm font-bold text-slate-800">Плъзнете файл тук или кликнете</p>
                  <p className="text-xs text-slate-500">Word, Excel или PDF · до 10MB</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.dot,.dotx,.xls,.xlsx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); e.target.value = '' }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">Заглавие *</label>
                <input type="text" value={title}
                  onChange={e => { setTitle(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="напр. Доклад-оценка за ЕПЛР"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none" />
                {showSuggestions && titleMatches.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-auto divide-y divide-slate-100">
                    <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-50">Препоръчани</div>
                    {titleMatches.map(s => (
                      <button key={s} type="button" onMouseDown={() => { setTitle(s); setShowSuggestions(false) }}
                        className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center justify-between">
                        <span>{s}</span><Plus size={12} className="text-slate-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Пояснение (незадължително)</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="напр. За годишни заседания"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Вид на документа</label>
              {checkboxRow(isAdministrative, setIsAdministrative, isPg, setIsPg)}
              <p className="text-[11px] text-slate-500 mt-1">Без отметка „Административен" образецът отива при документите за дейността. „За ПГ" — вариант за подготвителна група.</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button onClick={resetForm} className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors">Отказ</button>
              <button onClick={doUpload} disabled={uploading || !title.trim() || !pendingFile}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-50 transition-all hover:opacity-90"
                style={{ backgroundColor: '#0f2240' }}>
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? 'Качване…' : 'Качи образец'}
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Търсене + сортиране */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Търсене по заглавие, описание или файл…"
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:bg-white transition-all" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"><X size={14} /></button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setSortBy('title')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'title' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            По азбучен ред
          </button>
          <button onClick={() => setSortBy('date')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'date' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            Последно качени
          </button>
        </div>
      </div>
      {/* Административни (горе) */}
      {adminItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="p-1.5 rounded-lg text-white" style={{ backgroundColor: '#0f2240' }}><Briefcase size={16} /></div>
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider" style={{ color: '#0f2240' }}>Административни документи</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{adminItems.length}</span>
            <div className="flex-1 h-px bg-slate-200/80 ml-2" />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            {adminItems.map((t, idx) => <DocRow key={t.id} t={t} idx={idx} />)}
          </div>
        </div>
      )}
      {/* За дейността (долу) */}
      {(activityItems.length > 0 || filterPg) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
            <div className="flex items-center gap-2 flex-1">
              <div className="p-1.5 rounded-lg text-white" style={{ backgroundColor: '#0f2240' }}><ClipboardList size={16} /></div>
              <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider" style={{ color: '#0f2240' }}>Документи за дейността</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{activityItems.length}</span>
              <div className="flex-1 h-px bg-slate-200/80 ml-2 hidden sm:block" />
            </div>
            <button onClick={() => setFilterPg(!filterPg)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex-shrink-0 ${filterPg ? 'bg-violet-600 text-white ring-2 ring-violet-200' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}>
              <Baby size={14} /> Вариант ПГ
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            {activityItems.length > 0 ? (
              activityItems.map((t, idx) => <DocRow key={t.id} t={t} idx={idx} />)
            ) : (
              <div className="text-center py-10 px-4">
                <Baby size={32} className="mx-auto text-violet-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">Няма образци за подготвителна група</p>
                <button onClick={() => setFilterPg(false)} className="mt-2 text-xs font-bold text-blue-600 hover:underline">Покажи всички за дейността</button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Празно състояние */}
      {filtered.length === 0 && (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
          <FolderOpen size={48} className="mx-auto mb-3 text-slate-300" />
          {templates.length === 0 ? (
            <>
              <p className="text-base font-bold text-slate-800">Още няма образци</p>
              {canManage && <p className="text-xs text-slate-500 mt-1">Качете първия с бутона „Качи образец"</p>}
            </>
          ) : (
            <>
              <p className="text-base font-bold text-slate-800">Няма образци по това търсене</p>
              <p className="text-xs text-slate-500 mt-1">Опитайте друг термин или изчистете филтрите.</p>
              {hasActiveFilter && (
                <button onClick={() => { setSearch(''); setFilterPg(false) }}
                  className="mt-3 px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">Изчистване на филтрите</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
