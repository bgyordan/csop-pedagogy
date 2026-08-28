'use client'
import { useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, Download, Trash2, Loader2, FolderOpen, Plus, X, Search,
  Baby, Pencil, Check, UploadCloud, Briefcase, ClipboardList,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Template {
  id: string
  title: string
  category: string
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
const CATEGORIES = ['Декларации', 'Протоколи', 'Заявления', 'Други']
const ACCEPTED = ['pdf', 'doc', 'docx', 'dot', 'dotx', 'xls', 'xlsx']

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function getExt(fileName: string) { return fileName.split('.').pop()?.toLowerCase() || '' }

// Качествена цветна значка по тип файл
function FileBadge({ fileName }: { fileName: string }) {
  const ext = getExt(fileName)
  let label = 'DOC', bg = '#2563eb'
  if (ext === 'pdf') { label = 'PDF'; bg = '#dc2626' }
  else if (ext === 'xls' || ext === 'xlsx') { label = 'XLS'; bg = '#16a34a' }
  else if (ext === 'doc' || ext === 'docx' || ext === 'dot' || ext === 'dotx') { label = 'W'; bg = '#2563eb' }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: bg }}>
      {label}
    </span>
  )
}

export default function TemplatesClient({ templates: initial, canManage, staffId }: Props) {
  const supabase = createClient()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>(initial || [])
  const [macro, setMacro] = useState<'activity' | 'admin'>('activity') // макро горе
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [pgOnly, setPgOnly] = useState(false)
  const [search, setSearch] = useState('')

  const [showUpload, setShowUpload] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [uMacro, setUMacro] = useState<'activity' | 'admin'>('activity')
  const [category, setCategory] = useState('Декларации')
  const [description, setDescription] = useState('')
  const [isPg, setIsPg] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editMacro, setEditMacro] = useState<'activity' | 'admin'>('activity')
  const [editCategory, setEditCategory] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIsPg, setEditIsPg] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const isAdmin = macro === 'admin'

  // брой по категория В ТЕКУЩИЯ макрос
  const countByCat = useMemo(() => {
    const m = new Map<string, number>()
    templates.filter(t => t.is_administrative === isAdmin).forEach(t => {
      const c = t.category || 'Други'; m.set(c, (m.get(c) || 0) + 1)
    })
    return m
  }, [templates, isAdmin])

  const macroCount = useMemo(() => ({
    activity: templates.filter(t => !t.is_administrative).length,
    admin: templates.filter(t => t.is_administrative).length,
  }), [templates])

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (t.is_administrative !== isAdmin) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false
      }
      if (activeCategory !== 'all' && (t.category || 'Други') !== activeCategory) return false
      if (pgOnly && !t.is_pg) return false
      return true
    }).sort((a, b) => a.title.localeCompare(b.title, 'bg', { numeric: true }))
  }, [templates, isAdmin, search, activeCategory, pgOnly])

  function resetForm() {
    setTitle(''); setDescription(''); setPendingFile(null)
    setIsPg(false); setCategory('Декларации'); setUMacro('activity'); setShowUpload(false)
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
    const folder = category.replace(/[^a-zA-Z0-9]/g, '_')
    const filePath = `${folder}/${Date.now()}_${safeName}`
    const { error: upErr } = await supabase.storage.from('templates').upload(filePath, pendingFile)
    if (upErr) { toast('Грешка при качване', 'error'); setUploading(false); return }
    const { data: newT, error: dbErr } = await supabase.from('document_templates').insert({
      title: title.trim(), category,
      file_name: pendingFile.name, file_path: filePath,
      file_size: pendingFile.size, description: description.trim() || null, uploaded_by: staffId,
      is_pg: isPg, is_administrative: uMacro === 'admin',
    }).select().single()
    if (dbErr || !newT) { toast('Грешка при запис', 'error'); setUploading(false); return }
    toast('Образецът е качен')
    setTemplates(prev => [newT, ...prev])
    setMacro(uMacro)
    resetForm(); setUploading(false)
  }
  async function handleDownload(t: Template, e?: React.MouseEvent) {
    e?.stopPropagation()
    setDownloading(t.id)
    const { data, error } = await supabase.storage.from('templates').download(t.file_path)
    if (error || !data) { toast('Грешка при изтегляне', 'error'); setDownloading(null); return }
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = t.file_name || t.title
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setDownloading(null)
  }
  async function handleDelete(t: Template, e?: React.MouseEvent) {
    e?.stopPropagation()
    if (!confirm(`Изтрий образеца „${t.title}"?`)) return
    await supabase.storage.from('templates').remove([t.file_path])
    await supabase.from('document_templates').delete().eq('id', t.id)
    toast('Образецът е изтрит')
    setTemplates(prev => prev.filter(x => x.id !== t.id))
  }
  function startEdit(t: Template, e?: React.MouseEvent) {
    e?.stopPropagation()
    setEditId(t.id); setEditTitle(t.title); setEditCategory(t.category || 'Други')
    setEditMacro(t.is_administrative ? 'admin' : 'activity')
    setEditDescription(t.description || ''); setEditIsPg(t.is_pg)
  }
  async function saveEdit() {
    if (!editId || !editTitle.trim()) { toast('Заглавието е задължително', 'error'); return }
    setSavingEdit(true)
    const { error } = await supabase.from('document_templates').update({
      title: editTitle.trim(), description: editDescription.trim() || null,
      category: editCategory, is_pg: editIsPg, is_administrative: editMacro === 'admin',
    }).eq('id', editId)
    if (error) { toast('Грешка при запис', 'error'); setSavingEdit(false); return }
    toast('Образецът е обновен')
    setTemplates(prev => prev.map(t => t.id === editId ? {
      ...t, title: editTitle.trim(), description: editDescription.trim() || null,
      category: editCategory, is_pg: editIsPg, is_administrative: editMacro === 'admin',
    } : t))
    setEditId(null); setSavingEdit(false)
  }

  const sideItem = (key: string, label: string, count: number | null) => (
    <button key={key} onClick={() => setActiveCategory(key)}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm text-left transition-colors ${
        activeCategory === key ? 'bg-[#0f2240] text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}>
      <span className="truncate">{label}</span>
      {count !== null && <span className={activeCategory === key ? 'text-white/70 text-xs' : 'text-slate-400 text-xs'}>{count}</span>}
    </button>
  )

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Макро превключвател — сегментиран, нежен */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex p-1 rounded-2xl bg-slate-100">
          <button onClick={() => { setMacro('activity'); setActiveCategory('all') }}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              macro === 'activity' ? 'bg-white text-[#0f2240] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <ClipboardList size={17} /> За дейността
            <span className={`text-xs ${macro === 'activity' ? 'text-slate-400' : 'text-slate-400'}`}>{macroCount.activity}</span>
          </button>
          <button onClick={() => { setMacro('admin'); setActiveCategory('all') }}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              macro === 'admin' ? 'bg-white text-[#0f2240] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <Briefcase size={17} /> Административни
            <span className="text-xs text-slate-400">{macroCount.admin}</span>
          </button>
        </div>
        {canManage && !showUpload && (
          <button onClick={() => { setUMacro(macro); setShowUpload(true) }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 transition-all shrink-0"
            style={{ backgroundColor: '#0f2240' }}><Plus size={16} /> Качи образец</button>
        )}
      </div>

      {/* Търсене */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Търсене…"
          className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:border-slate-400" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={15} /></button>}
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        {/* Лява колона: категории */}
        <div className="md:w-52 shrink-0 space-y-1">
          {sideItem('all', 'Всички', filtered.length + (activeCategory !== 'all' || pgOnly || search ? 0 : 0) || (macro === 'admin' ? macroCount.admin : macroCount.activity))}
          {CATEGORIES.map(c => sideItem(c, c, countByCat.get(c) || 0))}
          <div className="h-px bg-slate-200 my-2" />
          <button onClick={() => setPgOnly(v => !v)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-colors ${
              pgOnly ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}>
            <Baby size={15} /> само ПГ
          </button>
        </div>

        {/* Дясна колона: качване + списък */}
        <div className="flex-1 min-w-0 space-y-4">
          {canManage && showUpload && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><UploadCloud size={16} style={{ color: '#0f2240' }} /> Качване на нов образец</h3>
                <button onClick={resetForm} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={16} /></button>
              </div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) validateAndSetFile(f) }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-1 py-6 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                  dragOver ? 'border-blue-500 bg-blue-50/40' : pendingFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
                {pendingFile ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-800">{pendingFile.name}</p>
                    <p className="text-xs text-slate-500">{formatSize(pendingFile.size)} · клик за смяна</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <UploadCloud size={22} style={{ color: '#0f2240' }} className="mx-auto mb-1" />
                    <p className="text-sm text-slate-700">Плъзнете файл или кликнете</p>
                    <p className="text-xs text-slate-400">Word, Excel или PDF · до 10MB</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.dot,.dotx,.xls,.xlsx" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); e.target.value = '' }} />
              </div>
              {/* Макро при качване */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Раздел</label>
                <div className="inline-flex p-1 rounded-xl bg-slate-100">
                  <button type="button" onClick={() => setUMacro('activity')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${uMacro === 'activity' ? 'bg-white text-[#0f2240] shadow-sm' : 'text-slate-500'}`}>
                    <ClipboardList size={14} /> За дейността
                  </button>
                  <button type="button" onClick={() => setUMacro('admin')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${uMacro === 'admin' ? 'bg-white text-[#0f2240] shadow-sm' : 'text-slate-500'}`}>
                    <Briefcase size={14} /> Административни
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Заглавие *</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="напр. Декларация лекторски часове"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Категория *</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none cursor-pointer">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Пояснение (незадължително)</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="напр. За годишни заседания"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none" />
              </div>
              <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm cursor-pointer transition-all ${isPg ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                <input type="checkbox" checked={isPg} onChange={e => setIsPg(e.target.checked)} className="sr-only" />
                <Baby size={14} /> За подготвителна група (ПГ)
              </label>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button onClick={resetForm} className="px-4 py-2 rounded-xl text-sm bg-white border border-slate-200 hover:bg-slate-100 text-slate-700">Отказ</button>
                <button onClick={doUpload} disabled={uploading || !title.trim() || !pendingFile}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
                  style={{ backgroundColor: '#0f2240' }}>
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? 'Качване…' : 'Качи'}
                </button>
              </div>
            </div>
          )}

          {/* Списък */}
          {filtered.length === 0 ? (
            <div className="text-center py-14 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
              <FolderOpen size={36} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-500">Няма образци тук{canManage ? ' — качете с бутона „Качи образец"' : ''}.</p>
              {(activeCategory !== 'all' || pgOnly || search) && (
                <button onClick={() => { setSearch(''); setActiveCategory('all'); setPgOnly(false) }}
                  className="mt-3 px-4 py-1.5 rounded-full text-xs bg-slate-100 hover:bg-slate-200 text-slate-700">Изчисти филтрите</button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {filtered.map((t, idx) => (
                <div key={t.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                  <FileBadge fileName={t.file_name} />
                  <button onClick={e => handleDownload(t, e)} className="min-w-0 flex-1 text-left" title="Изтегли">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800 truncate group-hover:text-[#0f2240] group-hover:underline decoration-slate-300 underline-offset-2">{t.title}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{t.category || 'Други'}</span>
                      {t.is_pg && <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">ПГ</span>}
                    </div>
                    {t.description && <div className="text-xs text-slate-400 truncate mt-0.5">{t.description}</div>}
                  </button>
                  <span className="text-xs text-slate-400 shrink-0 hidden sm:block">{formatSize(t.file_size)}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={e => handleDownload(t, e)} disabled={downloading === t.id}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-[#0f2240] hover:bg-slate-100 transition-colors" title="Изтегли">
                      {downloading === t.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    </button>
                    {canManage && (
                      <>
                        <button onClick={e => startEdit(t, e)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100" title="Редакция"><Pencil size={15} /></button>
                        <button onClick={e => handleDelete(t, e)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100" title="Изтрий"><Trash2 size={15} /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Редакция модал */}
      {editId && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditId(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Pencil size={15} style={{ color: '#0f2240' }} /> Редактиране</h3>
              <button onClick={() => setEditId(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Раздел</label>
                <div className="inline-flex p-1 rounded-xl bg-slate-100">
                  <button type="button" onClick={() => setEditMacro('activity')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${editMacro === 'activity' ? 'bg-white text-[#0f2240] shadow-sm' : 'text-slate-500'}`}>
                    <ClipboardList size={14} /> За дейността
                  </button>
                  <button type="button" onClick={() => setEditMacro('admin')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${editMacro === 'admin' ? 'bg-white text-[#0f2240] shadow-sm' : 'text-slate-500'}`}>
                    <Briefcase size={14} /> Административни
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Заглавие</label>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Категория</label>
                <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Пояснение</label>
                <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm cursor-pointer ${editIsPg ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                <input type="checkbox" checked={editIsPg} onChange={e => setEditIsPg(e.target.checked)} className="sr-only" />
                <Baby size={14} /> За подготвителна група (ПГ)
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => setEditId(null)} className="px-4 py-2 rounded-xl text-sm bg-slate-100 hover:bg-slate-200 text-slate-700">Отказ</button>
              <button onClick={saveEdit} disabled={savingEdit}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
                {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Запази
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
