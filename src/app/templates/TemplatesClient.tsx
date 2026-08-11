'use client'
import { useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, Download, Trash2, FileText, Loader2, FolderOpen, Plus, X, Search,
  Baby, Pencil, Check, UploadCloud, Briefcase, ClipboardList, FileCheck, FileSpreadsheet,
  LayoutGrid, LayoutList, Layers
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
const ACCEPTED = ['pdf', 'doc', 'docx', 'dot', 'dotx', 'xls', 'xlsx']
function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function getExt(fileName: string) { return fileName.split('.').pop()?.toLowerCase() || '' }
function getFileStyle(fileName: string) {
  const ext = getExt(fileName)
  if (ext === 'xls' || ext === 'xlsx') return {
    label: 'EXCEL', icon: <FileSpreadsheet size={18} className="text-emerald-600" />,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  if (ext === 'pdf') return {
    label: 'PDF', icon: <FileCheck size={18} className="text-rose-600" />,
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  return {
    label: 'WORD', icon: <FileText size={18} className="text-blue-600" />,
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  }
}

export default function TemplatesClient({ templates: initial, canManage, staffId }: Props) {
  const supabase = createClient()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>(initial)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [activeCategory, setActiveCategory] = useState<'all' | 'admin' | 'activity' | 'pg'>('all')
  const [extFilter, setExtFilter] = useState<'all' | 'word' | 'excel' | 'pdf'>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'title' | 'date'>('title')

  const [showUpload, setShowUpload] = useState(false)
  const [previewT, setPreviewT] = useState<Template | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [description, setDescription] = useState('')
  const [isPg, setIsPg] = useState(false)
  const [isAdministrative, setIsAdministrative] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIsPg, setEditIsPg] = useState(false)
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const titleMatches = useMemo(() => {
    const q = title.trim().toLowerCase()
    if (!q) return []
    return TITLE_SUGGESTIONS.filter(s => s.toLowerCase().includes(q))
  }, [title])

  const stats = useMemo(() => ({
    total: templates.length,
    admin: templates.filter(t => t.is_administrative).length,
    activity: templates.filter(t => !t.is_administrative).length,
    pg: templates.filter(t => t.is_pg).length,
  }), [templates])

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q) && !t.file_name.toLowerCase().includes(q)) return false
      }
      if (activeCategory === 'admin' && !t.is_administrative) return false
      if (activeCategory === 'activity' && t.is_administrative) return false
      if (activeCategory === 'pg' && !t.is_pg) return false
      if (extFilter !== 'all') {
        const ext = getExt(t.file_name)
        if (extFilter === 'word' && !['doc', 'docx', 'dot', 'dotx'].includes(ext)) return false
        if (extFilter === 'excel' && !['xls', 'xlsx'].includes(ext)) return false
        if (extFilter === 'pdf' && ext !== 'pdf') return false
      }
      return true
    }).sort((a, b) =>
      sortBy === 'date'
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : a.title.localeCompare(b.title, 'bg', { numeric: true })
    )
  }, [templates, search, activeCategory, extFilter, sortBy])

  function resetForm() {
    setTitle(''); setDescription(''); setPendingFile(null)
    setIsPg(false); setIsAdministrative(false); setShowUpload(false)
  }
  function validateAndSetFile(file: File) {
    const ext = getExt(file.name)
    if (!ACCEPTED.includes(ext)) { toast('Позволени: Word, Excel, PDF', 'error'); return }
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
  async function handleDownload(t: Template, e?: React.MouseEvent) {
    e?.stopPropagation()
    setDownloading(t.id)
    const { data, error } = await supabase.storage.from('templates').createSignedUrl(t.file_path, 60)
    if (error || !data) { toast('Грешка при изтегляне', 'error'); setDownloading(null); return }
    const link = document.createElement('a')
    link.href = data.signedUrl
    link.download = t.file_name || `${t.title}.docx`
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
    setDownloading(null)
  }
  async function handleDelete(t: Template, e?: React.MouseEvent) {
    e?.stopPropagation()
    if (!confirm(`Изтрий образеца "${t.title}"?`)) return
    await supabase.storage.from('templates').remove([t.file_path])
    await supabase.from('document_templates').delete().eq('id', t.id)
    toast('Образецът е изтрит')
    setTemplates(prev => prev.filter(x => x.id !== t.id))
    if (previewT?.id === t.id) setPreviewT(null)
  }
  function startEdit(t: Template, e?: React.MouseEvent) {
    e?.stopPropagation()
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

  const categoryPills = [
    { id: 'all' as const, label: 'Всички', icon: FolderOpen, count: stats.total, active: 'bg-slate-900 text-white' },
    { id: 'admin' as const, label: 'Административни', icon: Briefcase, count: stats.admin, active: 'bg-[#0f2240] text-white' },
    { id: 'activity' as const, label: 'За дейността', icon: ClipboardList, count: stats.activity, active: 'bg-emerald-600 text-white' },
    { id: 'pg' as const, label: 'Подготвителна (ПГ)', icon: Baby, count: stats.pg, active: 'bg-violet-600 text-white' },
  ]

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Статистики */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: 'Общо', value: stats.total, icon: Layers, color: 'text-slate-600 bg-slate-100' },
          { label: 'Административни', value: stats.admin, icon: Briefcase, color: 'text-blue-600 bg-blue-50' },
          { label: 'За дейността', value: stats.activity, icon: ClipboardList, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Подготвителна', value: stats.pg, icon: Baby, color: 'text-violet-600 bg-violet-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200/80 p-3 flex items-center gap-2.5 shadow-sm">
            <div className={`p-2 rounded-lg ${s.color}`}><s.icon size={16} /></div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">{s.label}</div>
              <div className="text-lg font-black text-slate-800">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Лента: търсене + формат + сортиране + изглед + качване */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Търсене…"
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:bg-white transition-all" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Формат */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {([['all', 'Всички', ''], ['word', 'Word', 'bg-blue-600'], ['excel', 'Excel', 'bg-emerald-600'], ['pdf', 'PDF', 'bg-rose-600']] as const).map(([id, label, activeBg]) => (
              <button key={id} onClick={() => setExtFilter(id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${extFilter === id ? `${activeBg || 'bg-white'} ${activeBg ? 'text-white' : 'text-slate-900'} shadow-sm` : 'text-slate-600 hover:text-slate-900'}`}>
                {label}
              </button>
            ))}
          </div>
          {/* Сортиране */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer">
            <option value="title">Азбучен ред</option>
            <option value="date">Последно качен</option>
          </select>
          {/* Изглед */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('list')} title="Списък"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}><LayoutList size={16} /></button>
            <button onClick={() => setViewMode('grid')} title="Карти"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}><LayoutGrid size={16} /></button>
          </div>
          {canManage && !showUpload && (
            <button onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-all"
              style={{ backgroundColor: '#0f2240' }}><Plus size={16} /> Качи</button>
          )}
        </div>
      </div>

      {/* Категорийни пилюли */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categoryPills.map(p => (
          <button key={p.id} onClick={() => setActiveCategory(p.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeCategory === p.id ? `${p.active} shadow-md` : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'}`}>
            <p.icon size={14} /> {p.label} ({p.count})
          </button>
        ))}
      </div>

      {/* Качване (сгъваемо) */}
      {canManage && showUpload && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><UploadCloud size={16} style={{ color: '#0f2240' }} /> Качване на нов образец</h3>
            <button onClick={resetForm} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"><X size={16} /></button>
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) validateAndSetFile(f) }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-1.5 py-5 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
              dragOver ? 'border-blue-500 bg-blue-100/40' : pendingFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
            {pendingFile ? (
              <div className="text-center">
                <p className="text-sm font-bold text-slate-900">{pendingFile.name}</p>
                <p className="text-xs text-slate-500">{formatSize(pendingFile.size)} · клик за смяна</p>
              </div>
            ) : (
              <div className="text-center">
                <UploadCloud size={22} style={{ color: '#0f2240' }} className="mx-auto mb-1" />
                <p className="text-sm font-bold text-slate-800">Плъзнете файл или кликнете</p>
                <p className="text-xs text-slate-500">Word, Excel или PDF · до 10MB</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.dot,.dotx,.xls,.xlsx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); e.target.value = '' }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 mb-1">Заглавие *</label>
              <input type="text" value={title}
                onChange={e => { setTitle(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="напр. Доклад-оценка за ЕПЛР"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none" />
              {showSuggestions && titleMatches.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-auto divide-y divide-slate-100">
                  {titleMatches.map(s => (
                    <button key={s} type="button" onMouseDown={() => { setTitle(s); setShowSuggestions(false) }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center justify-between">
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
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Вид на документа</label>
            <div className="flex flex-wrap gap-2.5">
              <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${isAdministrative ? 'bg-[#0f2240] text-white border-[#0f2240] shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                <input type="checkbox" checked={isAdministrative} onChange={e => setIsAdministrative(e.target.checked)} className="sr-only" />
                <Briefcase size={14} /> Административен
              </label>
              <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${isPg ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                <input type="checkbox" checked={isPg} onChange={e => setIsPg(e.target.checked)} className="sr-only" />
                <Baby size={14} /> За ПГ (Подготвителна група)
              </label>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Без „Административен" образецът отива при документите за дейността.</p>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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

      {/* Резултати */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
          <FolderOpen size={40} className="mx-auto mb-3 text-slate-300" />
          {templates.length === 0 ? (
            <>
              <p className="text-base font-bold text-slate-800">Още няма образци</p>
              {canManage && <p className="text-xs text-slate-500 mt-1">Качете първия с бутона „Качи"</p>}
            </>
          ) : (
            <>
              <p className="text-base font-bold text-slate-800">Няма образци по това търсене</p>
              <button onClick={() => { setSearch(''); setActiveCategory('all'); setExtFilter('all') }}
                className="mt-3 px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">Изчисти филтрите</button>
            </>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* КАРТИ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(t => {
            const style = getFileStyle(t.file_name)
            return (
              <div key={t.id} onClick={() => setPreviewT(t)}
                className="group bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 p-4 shadow-sm hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${style.badge}`}>{style.icon}{style.label}</span>
                    {t.is_administrative && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">АДМ</span>}
                    {t.is_pg && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-violet-100 text-violet-700 border border-violet-200">ПГ</span>}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">{t.title}</h3>
                    {t.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description}</p>}
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 font-medium truncate">{formatSize(t.file_size)}</span>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <>
                        <button onClick={e => startEdit(t, e)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors" title="Редактирай"><Pencil size={14} /></button>
                        <button onClick={e => handleDelete(t, e)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Изтрий"><Trash2 size={14} /></button>
                      </>
                    )}
                    <button onClick={e => handleDownload(t, e)} disabled={downloading === t.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white transition-all" title="Изтегли">
                      {downloading === t.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Свали
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* СПИСЪК */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden divide-y divide-slate-100">
          {filtered.map((t, idx) => {
            const style = getFileStyle(t.file_name)
            return (
              <div key={t.id} onClick={() => setPreviewT(t)}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-blue-50/40 transition-colors cursor-pointer group ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {style.icon}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors truncate">{t.title}</h4>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${style.badge}`}>{style.label}</span>
                      {t.is_administrative && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">АДМ</span>}
                      {t.is_pg && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">ПГ</span>}
                      {t.description && <span className="text-[11px] text-slate-400 truncate">· {t.description}</span>}
                      {t.file_size && <span className="text-[11px] text-slate-300 flex-shrink-0">· {formatSize(t.file_size)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={e => handleDownload(t, e)} disabled={downloading === t.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-100/60 border border-slate-200 transition-all" title="Изтегли">
                    {downloading === t.id ? <Loader2 size={13} className="animate-spin text-blue-600" /> : <Download size={13} />}
                    <span className="hidden sm:inline">Изтегли</span>
                  </button>
                  {canManage && (
                    <>
                      <button onClick={e => startEdit(t, e)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-colors" title="Редактирай"><Pencil size={14} /></button>
                      <button onClick={e => handleDelete(t, e)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-100/60 transition-colors" title="Изтрий"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Preview модал */}
      {previewT && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewT(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 p-6 space-y-5 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewT(null)} className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={18} /></button>
            <div className="flex items-start gap-3">
              <div className={`p-3 rounded-xl border ${getFileStyle(previewT.file_name).badge}`}>{getFileStyle(previewT.file_name).icon}</div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Детайли за документа</span>
                <h3 className="text-base font-bold text-slate-900 leading-snug mt-0.5">{previewT.title}</h3>
              </div>
            </div>
            <div className="space-y-3 bg-slate-50/80 p-4 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="font-bold text-slate-700 block mb-1">Описание:</span>
                <p className="text-slate-600 leading-relaxed">{previewT.description || 'Няма описание.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                <div><span className="text-slate-400">Файл:</span><div className="font-bold text-slate-800 truncate">{previewT.file_name}</div></div>
                <div><span className="text-slate-400">Размер:</span><div className="font-bold text-slate-800">{formatSize(previewT.file_size)}</div></div>
                <div><span className="text-slate-400">Категория:</span><div className="font-bold text-slate-800">{previewT.is_administrative ? 'Административен' : 'За дейността'}</div></div>
                <div><span className="text-slate-400">ПГ:</span><div className="font-bold text-slate-800">{previewT.is_pg ? 'Да' : 'Не'}</div></div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              {canManage && (
                <button onClick={e => { startEdit(previewT, e); setPreviewT(null) }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"><Pencil size={14} /> Редактирай</button>
              )}
              <button onClick={e => { handleDownload(previewT, e); setPreviewT(null) }}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
                <Download size={14} /> Изтегли файла
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Редакция модал */}
      {editId && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditId(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Pencil size={15} style={{ color: '#0f2240' }} /> Редактиране на образец</h3>
              <button onClick={() => setEditId(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Заглавие</label>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Описание</label>
                <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${editIsAdmin ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                  <input type="checkbox" checked={editIsAdmin} onChange={e => setEditIsAdmin(e.target.checked)} className="sr-only" />
                  <Briefcase size={13} /> Административен
                </label>
                <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${editIsPg ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                  <input type="checkbox" checked={editIsPg} onChange={e => setEditIsPg(e.target.checked)} className="sr-only" />
                  <Baby size={13} /> Подготвителна (ПГ)
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => setEditId(null)} className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700">Отказ</button>
              <button onClick={saveEdit} disabled={savingEdit}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60 transition-all hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
                {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Запази
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
