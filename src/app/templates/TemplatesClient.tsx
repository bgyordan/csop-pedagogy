'use client'
import { useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Download, Trash2, FileText, Loader2, FolderOpen, Plus, X, Search, Baby, Pencil, Check, UploadCloud, Briefcase, ClipboardList } from 'lucide-react'
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
// Подсказки за заглавието при качване
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
  const [description, setDescription] = useState('')
  const [isPg, setIsPg] = useState(false)
  const [isAdministrative, setIsAdministrative] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  // Редакция
  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIsPg, setEditIsPg] = useState(false)
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  // Филтри
  const [search, setSearch] = useState('')
  const [filterPg, setFilterPg] = useState(false)
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
          !(t.description || '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [templates, search])
  const adminItems = filtered.filter(t => t.is_administrative).sort((a, b) => a.title.localeCompare(b.title, 'bg', { numeric: true }))
  const activityItems = filtered.filter(t => !t.is_administrative).filter(t => filterPg ? t.is_pg : !t.is_pg).sort((a, b) => a.title.localeCompare(b.title, 'bg', { numeric: true }))
  const checkboxRow = (
    admin: boolean, sadmin: (v: boolean) => void,
    pg: boolean, spg: (v: boolean) => void,
  ) => (
    <div className="flex flex-wrap gap-2">
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors">
        <input type="checkbox" checked={admin} onChange={e => sadmin(e.target.checked)} className="accent-[#0f2240]" />
        <Briefcase size={13} /> Административен
      </label>
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors">
        <input type="checkbox" checked={pg} onChange={e => spg(e.target.checked)} className="accent-[#0f2240]" />
        <Baby size={13} /> За ПГ
      </label>
    </div>
  )
  const hasActiveFilter = filterPg || search.trim()

  function DocRow({ t, idx }: { t: Template; idx: number }) {
    const isEditing = editId === t.id
    if (isEditing) {
      return (
        <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-2.5">
          <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
            className="input w-full text-sm" placeholder="Заглавие" />
          <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)}
            className="input w-full text-sm" placeholder="Пояснение (незадължително)" />
          {checkboxRow(editIsAdmin, setEditIsAdmin, editIsPg, setEditIsPg)}
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
      <div className={`group flex items-center gap-3 px-4 py-2 border-b border-slate-100 transition-all duration-200 hover:bg-blue-50/40 hover:translate-x-1 ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
        <FileText size={17} className="text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
        <button onClick={() => handleDownload(t)} className="min-w-0 flex-1 text-left">
          <span className="text-sm font-medium text-slate-800 group-hover:text-blue-700 transition-colors">{t.title}</span>
          {t.is_pg && <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-600 border-violet-200 align-middle">ПГ</span>}
          {t.description && <span className="text-[11px] text-slate-400 ml-2">— {t.description}</span>}
        </button>
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
  }

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
          <div className="relative">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Заглавие</label>
            <input type="text" value={title}
              onChange={e => { setTitle(e.target.value); setShowSuggestions(true) }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Започнете да пишете…" className="input w-full text-sm" />
            {showSuggestions && titleMatches.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-auto">
                {titleMatches.map(s => (
                  <button key={s} type="button" onMouseDown={() => { setTitle(s); setShowSuggestions(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50/60 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Пояснение (незадължително)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="кратко описание" className="input w-full text-sm" />
          </div>
          {checkboxRow(isAdministrative, setIsAdministrative, isPg, setIsPg)}
          <p className="text-[10px] text-slate-400">Без отметка „Административен" образецът отива при документите за дейността. „За ПГ" — вариант за подготвителна група.</p>
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
      {/* ── Търсене ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Търсене по заглавие…"
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all" />
        </div>
      </div>
      {/* ── Административни (горе) ── */}
      {adminItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Briefcase size={18} style={{ color: '#0f2240' }} />
            <h2 className="text-base font-extrabold uppercase tracking-wider" style={{ color: '#0f2240' }}>Административни документи</h2>
            <span className="text-[11px] font-semibold text-slate-400">{adminItems.length}</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
            {adminItems.map((t, idx) => <DocRow key={t.id} t={t} idx={idx} />)}
          </div>
        </div>
      )}
      {/* ── За дейността (долу) ── */}
      {(activityItems.length > 0 || filterPg) && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={18} style={{ color: '#0f2240' }} />
            <h2 className="text-base font-extrabold uppercase tracking-wider" style={{ color: '#0f2240' }}>Документи за дейността</h2>
            <span className="text-[11px] font-semibold text-slate-400">{activityItems.length}</span>
            <div className="flex-1 h-px bg-slate-100" />
            <button onClick={() => setFilterPg(!filterPg)}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${filterPg ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              <Baby size={12} /> ПГ
            </button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
            {activityItems.length > 0
              ? activityItems.map((t, idx) => <DocRow key={t.id} t={t} idx={idx} />)
              : <p className="text-sm text-slate-400 text-center py-6">Няма ПГ варианти</p>}
          </div>
        </div>
      )}
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
                <button onClick={() => { setSearch(''); setFilterPg(false) }}
                  className="text-xs text-blue-600 hover:underline mt-1">Изчистете филтрите</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
