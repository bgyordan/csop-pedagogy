'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Download, Trash2, FileText, Loader2, FolderOpen, Plus, X, Search, GraduationCap, Heart, Baby } from 'lucide-react'
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

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function TemplatesClient({ templates: initial, canManage, staffId }: Props) {
  const supabase = createClient()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>(initial)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  // Форма за качване
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('protocols')
  const [description, setDescription] = useState('')
  const [forClassTeacher, setForClassTeacher] = useState(false)
  const [forSpecialist, setForSpecialist] = useState(false)
  const [isPg, setIsPg] = useState(false)

  // Филтри
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')       // '' = всички групи
  const [filterRole, setFilterRole] = useState('')     // '' | 'class' | 'specialist'
  const [filterPg, setFilterPg] = useState(false)      // само ПГ

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!title.trim()) { toast('Въведете заглавие', 'error'); e.target.value = ''; return }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'doc', 'docx', 'dot', 'dotx', 'xls', 'xlsx'].includes(ext || '')) {
      toast('Позволени: Word, Excel, PDF', 'error'); e.target.value = ''; return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('Файлът е прекалено голям (макс. 10MB)', 'error'); e.target.value = ''; return
    }
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
    const filePath = `${category}/${Date.now()}_${safeName}`
    const { error: upErr } = await supabase.storage.from('templates').upload(filePath, file)
    if (upErr) { toast('Грешка при качване', 'error'); setUploading(false); return }
    const { data: newT, error: dbErr } = await supabase.from('document_templates').insert({
      title: title.trim(), category, file_name: file.name, file_path: filePath,
      file_size: file.size, description: description.trim() || null, uploaded_by: staffId,
      for_class_teacher: forClassTeacher, for_specialist: forSpecialist, is_pg: isPg,
    }).select().single()
    if (dbErr) { toast('Грешка при запис', 'error'); setUploading(false); return }
    toast('Образецът е качен')
    setTemplates(prev => [newT, ...prev])
    setTitle(''); setDescription(''); setForClassTeacher(false); setForSpecialist(false); setIsPg(false)
    setShowUpload(false); setUploading(false)
    e.target.value = ''
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

  // Приложени филтри
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
    return null // за всички — без бадж
  }

  return (
    <div className="space-y-5">
      {/* Качване (само за управляващи) */}
      {canManage && (
        <div>
          {!showUpload ? (
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#0f2240' }}>
              <Plus size={16} /> Качи образец
            </button>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Нов образец</h3>
                <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Заглавие</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="напр. Протокол №1" className="input w-full text-sm" />
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
              {/* Отметки: за кого + ПГ */}
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={forClassTeacher} onChange={e => setForClassTeacher(e.target.checked)} className="accent-[#0f2240]" />
                  <GraduationCap size={13} /> За класен
                </label>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={forSpecialist} onChange={e => setForSpecialist(e.target.checked)} className="accent-[#0f2240]" />
                  <Heart size={13} /> За терапевт
                </label>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={isPg} onChange={e => setIsPg(e.target.checked)} className="accent-[#0f2240]" />
                  <Baby size={13} /> За ПГ
                </label>
              </div>
              <p className="text-[10px] text-slate-400">Без отметка „за роля" — образецът е за всички. „За ПГ" — вариант за подготвителна група.</p>
              <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors ${uploading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'}`}
                style={{ backgroundColor: '#0f2240' }}>
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {uploading ? 'Качване...' : 'Избери файл и качи'}
                <input type="file" accept=".pdf,.doc,.docx,.dot,.dotx,.xls,.xlsx" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
              <p className="text-[11px] text-slate-400">Word, Excel или PDF, макс. 10MB</p>
            </div>
          )}
        </div>
      )}

      {/* Търсене + филтри */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Търси образец по заглавие..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {/* Групи */}
          <button onClick={() => setFilterCat('')}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${filterCat === '' ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            Всички групи
          </button>
          {TEMPLATE_CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setFilterCat(filterCat === c.key ? '' : c.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${filterCat === c.key ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
          {/* За кого */}
          <button onClick={() => setFilterRole(filterRole === 'class' ? '' : 'class')}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${filterRole === 'class' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            <GraduationCap size={12} /> За класен
          </button>
          <button onClick={() => setFilterRole(filterRole === 'specialist' ? '' : 'specialist')}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${filterRole === 'specialist' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            <Heart size={12} /> За терапевт
          </button>
          <button onClick={() => setFilterPg(!filterPg)}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${filterPg ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            <Baby size={12} /> Само ПГ
          </button>
        </div>
      </div>

      {/* Резултати по групи */}
      {TEMPLATE_CATEGORIES.map(cat => {
        const items = filtered.filter(t => t.category === cat.key)
        if (items.length === 0) return null
        return (
          <div key={cat.key}>
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen size={15} className="text-slate-400" />
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{cat.label}</h2>
              <span className="text-[11px] text-slate-400">({items.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map(t => {
                const rb = roleBadge(t)
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText size={18} className="text-blue-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate flex items-center gap-1.5">
                          {t.title}
                          {rb && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${rb.cls}`}>{rb.label}</span>}
                          {t.is_pg && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-600 border-violet-200">ПГ</span>}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {t.description || t.file_name}
                          {t.file_size && <span className="ml-1">· {formatSize(t.file_size)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleDownload(t)} disabled={downloading === t.id}
                        className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Изтегли">
                        {downloading === t.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                      </button>
                      {canManage && (
                        <button onClick={() => handleDelete(t)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Изтрий">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <FolderOpen size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">
            {templates.length === 0 ? 'Още няма качени образци' : 'Няма образци по този филтър'}
          </p>
          {canManage && templates.length === 0 && <p className="text-xs text-slate-400 mt-1">Качете първия образец с бутона горе</p>}
        </div>
      )}
    </div>
  )
}
