'use client'
// Образци на документи — ПРОСТО: търсене + един ред филтри (Всички · ★ Моите · ПГ · колекциите, които имат образци)
// и един списък А–Я. Без раздели „за дейността/административни“, без плочки и „най-теглени“.
// Празните колекции не се показват; в „Колекции“ (зъбчето) се виждат с брой и се трият с един бутон.
import { useState, useMemo, useRef } from 'react'
import { smartMatch } from '@/lib/search'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, Download, Trash2, Loader2, FolderOpen, Plus, X, Search, Baby, Pencil, Check, UploadCloud,
  Briefcase, ClipboardList, Star, Eye, Settings2, Plane, Repeat, UserPlus, HeartHandshake, Users, Bus,
  ShieldCheck, Wallet, BookOpen, GraduationCap, Stethoscope, CalendarDays, ArrowUp, ArrowDown, Flame,
} from 'lucide-react'
import { useToast, confirmDialog } from '@/components/ui/Toast'

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
  collection_ids?: string[] | null
  download_count?: number | null
}
interface Collection { id: string; name: string; icon: string; sort: number }
interface Props {
  templates: Template[]
  collections: Collection[]
  favorites: string[]
  ready: boolean          // пуснат ли е SQL файлът за колекциите
  canManage: boolean
  staffId: string
}

const ACCEPTED = ['pdf', 'doc', 'docx', 'dot', 'dotx', 'xls', 'xlsx']
const ICONS: Record<string, any> = {
  plane: Plane, repeat: Repeat, 'user-plus': UserPlus, heart: HeartHandshake, users: Users, clipboard: ClipboardList,
  bus: Bus, shield: ShieldCheck, briefcase: Briefcase, wallet: Wallet, book: BookOpen, cap: GraduationCap,
  health: Stethoscope, calendar: CalendarDays, baby: Baby, folder: FolderOpen,
}
// меки цветове за плочките — само иконата е оцветена
const TINTS = [
  { bg: '#eff6ff', fg: '#1d4ed8' }, { bg: '#ecfdf5', fg: '#047857' }, { bg: '#f5f3ff', fg: '#6d28d9' },
  { bg: '#fff7ed', fg: '#c2410c' }, { bg: '#fdf2f8', fg: '#be185d' }, { bg: '#f0fdfa', fg: '#0f766e' },
  { bg: '#eef2ff', fg: '#4338ca' }, { bg: '#fefce8', fg: '#a16207' },
]
const NONE = '__none'
const NEW_DAYS = 21

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
const getExt = (fileName: string) => fileName.split('.').pop()?.toLowerCase() || ''
const isPdf = (t: Template) => getExt(t.file_name) === 'pdf'
const isNew = (t: Template) => Date.now() - new Date(t.created_at).getTime() < NEW_DAYS * 864e5

function FileBadge({ fileName, size = 'md' }: { fileName: string; size?: 'sm' | 'md' }) {
  const ext = getExt(fileName)
  let label = 'W', bg = '#2563eb'
  if (ext === 'pdf') { label = 'PDF'; bg = '#dc2626' }
  else if (ext === 'xls' || ext === 'xlsx') { label = 'XLS'; bg = '#16a34a' }
  const cls = size === 'sm' ? 'w-8 h-8 text-[10px] rounded-lg' : 'w-10 h-12 text-[11px] rounded-lg'
  return (
    <span className={`relative inline-flex items-end justify-center pb-1.5 text-white font-bold shrink-0 ${cls}`} style={{ backgroundColor: bg }}>
      {size === 'md' && <span className="absolute top-0 right-0 w-3 h-3 rounded-bl-md" style={{ background: 'rgba(255,255,255,0.35)' }} />}
      {label}
    </span>
  )
}

// избор на колекции — чипове
function CollectionPicker({ collections, value, onChange }: { collections: Collection[]; value: string[]; onChange: (v: string[]) => void }) {
  if (!collections.length) return <p className="text-xs text-slate-400">Още няма колекции.</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {collections.map((c, i) => {
        const on = value.includes(c.id)
        const I = ICONS[c.icon] || FolderOpen
        const tint = TINTS[i % TINTS.length]
        return (
          <button key={c.id} type="button" onClick={() => onChange(on ? value.filter(x => x !== c.id) : [...value, c.id])}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px] border transition-colors ${on ? 'border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
            style={on ? { background: tint.bg, color: tint.fg, boxShadow: `inset 0 0 0 1px ${tint.fg}55` } : {}}>
            <I size={13} /> {c.name}
          </button>
        )
      })}
    </div>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; label: string; icon?: any }[] }) {
  return (
    <div className="inline-flex p-1 rounded-xl bg-slate-100">
      {options.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${value === o.v ? 'bg-white text-[#0f2240] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          {o.icon && <o.icon size={14} />} {o.label}
        </button>
      ))}
    </div>
  )
}

export default function TemplatesClient({ templates: initial, collections: initialCols, favorites: initialFavs, ready, canManage, staffId }: Props) {
  const supabase = createClient()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>(initial)
  const [collections, setCollections] = useState<Collection[]>(initialCols)
  const [favs, setFavs] = useState<Set<string>>(new Set(initialFavs))
  // един филтър: 'all' · 'fav' · 'pg' · id на колекция
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  // качване
  const [showUpload, setShowUpload] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [uMacro, setUMacro] = useState<'activity' | 'admin'>('activity')
  const [uCols, setUCols] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [isPg, setIsPg] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  // редакция
  const [edit, setEdit] = useState<Template | null>(null)
  const [eTitle, setETitle] = useState('')
  const [eMacro, setEMacro] = useState<'activity' | 'admin'>('activity')
  const [eCols, setECols] = useState<string[]>([])
  const [eDesc, setEDesc] = useState('')
  const [ePg, setEPg] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  // колекции — настройка
  const [manage, setManage] = useState(false)

  const colIds = useMemo(() => new Set(collections.map(c => c.id)), [collections])
  const colsOf = (t: Template) => (t.collection_ids || []).filter(id => colIds.has(id))

  const byTitle = (a: Template, b: Template) => a.title.localeCompare(b.title, 'bg', { numeric: true })
  const colCount = (id: string) => templates.filter(t => colsOf(t).includes(id)).length
  // в реда с филтри — само колекциите, в които има образци (най-пълните първи)
  const usedCols = useMemo(() => collections.map(c => ({ ...c, n: colCount(c.id) })).filter(c => c.n > 0)
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'bg')), [collections, templates]) // eslint-disable-line react-hooks/exhaustive-deps
  const pgCount = templates.filter(t => t.is_pg).length

  const list = useMemo(() => {
    const q = search.trim()
    let l = templates
    if (filter === 'fav') l = l.filter(t => favs.has(t.id))
    else if (filter === 'pg') l = l.filter(t => t.is_pg)
    else if (filter !== 'all') l = l.filter(t => colsOf(t).includes(filter))
    if (q) {
      const colName = (t: Template) => colsOf(t).map(id => collections.find(c => c.id === id)?.name || '').join(' ')
      l = l.filter(t => smartMatch(t.title, q) || smartMatch(t.description || '', q) || smartMatch(colName(t), q))
    }
    return [...l].sort(byTitle)
  }, [templates, filter, search, favs, collections]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── действия ──
  async function download(t: Template) {
    setBusyId(t.id)
    const { data, error } = await supabase.storage.from('templates').download(t.file_path)
    setBusyId(null)
    if (error || !data) { toast('Грешка при изтегляне', 'error'); return }
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url; a.download = t.file_name || t.title
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    supabase.rpc('template_downloaded', { p_id: t.id }).then(() => {})
    setTemplates(x => x.map(i => i.id === t.id ? { ...i, download_count: (i.download_count || 0) + 1 } : i))
  }
  async function preview(t: Template) {
    const w = window.open('', '_blank')
    const { data, error } = await supabase.storage.from('templates').createSignedUrl(t.file_path, 600)
    if (error || !data?.signedUrl) { w?.close(); toast('Прегледът не се отвори', 'error'); return }
    if (w) w.location.href = data.signedUrl
  }
  async function toggleFav(t: Template) {
    const on = favs.has(t.id)
    const next = new Set(favs)
    if (on) next.delete(t.id); else next.add(t.id)
    setFavs(next)
    const { error } = on
      ? await supabase.from('template_favorites').delete().eq('staff_id', staffId).eq('template_id', t.id)
      : await supabase.from('template_favorites').insert({ staff_id: staffId, template_id: t.id })
    if (error) { setFavs(favs); toast('Любимите още не са включени', 'error') }
  }
  async function remove(t: Template) {
    if (!await confirmDialog(`Изтрий образеца „${t.title}“?`)) return
    await supabase.storage.from('templates').remove([t.file_path])
    await supabase.from('document_templates').delete().eq('id', t.id)
    toast('Образецът е изтрит')
    setTemplates(prev => prev.filter(x => x.id !== t.id))
  }

  function resetUpload() {
    setTitle(''); setDescription(''); setPendingFile(null); setIsPg(false); setUCols([]); setShowUpload(false)
  }
  function pickFile(file: File) {
    if (!ACCEPTED.includes(getExt(file.name))) { toast('Позволени: Word, Excel, PDF', 'error'); return }
    if (file.size > 10 * 1024 * 1024) { toast('Файлът е прекалено голям (макс. 10MB)', 'error'); return }
    setPendingFile(file)
    if (!title.trim()) {
      const n = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
      setTitle(n.charAt(0).toUpperCase() + n.slice(1))
    }
  }
  async function doUpload() {
    if (!title.trim() || !pendingFile) return
    setUploading(true)
    const safeName = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
    const filePath = `activity/${Date.now()}_${safeName}`
    const { error: upErr } = await supabase.storage.from('templates').upload(filePath, pendingFile)
    if (upErr) { toast('Грешка при качване', 'error'); setUploading(false); return }
    const row: any = {
      title: title.trim(), category: 'Други', file_name: pendingFile.name, file_path: filePath,
      file_size: pendingFile.size, description: description.trim() || null, uploaded_by: staffId,
      is_pg: isPg, is_administrative: false,
    }
    if (ready) row.collection_ids = uCols
    const { data: newT, error } = await supabase.from('document_templates').insert(row).select().single()
    setUploading(false)
    if (error || !newT) { toast('Грешка при запис', 'error'); return }
    toast('Образецът е качен')
    setTemplates(prev => [newT, ...prev])
    resetUpload()
  }
  function startEdit(t: Template) {
    setEdit(t); setETitle(t.title); setEMacro(t.is_administrative ? 'admin' : 'activity')
    setECols(colsOf(t)); setEDesc(t.description || ''); setEPg(t.is_pg)
  }
  async function saveEdit() {
    if (!edit || !eTitle.trim()) return
    setSavingEdit(true)
    const patch: any = { title: eTitle.trim(), description: eDesc.trim() || null, is_pg: ePg }
    if (ready) patch.collection_ids = eCols
    const { error } = await supabase.from('document_templates').update(patch).eq('id', edit.id)
    setSavingEdit(false)
    if (error) { toast('Грешка при запис', 'error'); return }
    setTemplates(prev => prev.map(t => t.id === edit.id ? { ...t, ...patch } : t))
    toast('Образецът е обновен'); setEdit(null)
  }

  // ── карта на образец ──
  const card = (t: Template, compact = false) => (
    <div key={t.id} onClick={() => download(t)} title="Изтегли"
      className="group relative flex gap-3 p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,34,64,0.04)] hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 transition-all cursor-pointer">
      <FileBadge fileName={t.file_name} size={compact ? 'sm' : 'md'} />
      <div className="min-w-0 flex-1 pr-6">
        <div className={`text-[13.5px] text-slate-800 leading-snug ${compact ? 'line-clamp-1' : 'line-clamp-2'} group-hover:text-[#0f2240]`}>{t.title}</div>
        {t.description && !compact && <div className="text-[12px] text-slate-400 line-clamp-1 mt-0.5">{t.description}</div>}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-slate-400">
          {busyId === t.id ? <span className="inline-flex items-center gap-1 text-[#0f2240]"><Loader2 size={11} className="animate-spin" /> тегли се…</span>
            : <span className="inline-flex items-center gap-1"><Download size={11} /> {formatSize(t.file_size) || getExt(t.file_name).toUpperCase()}</span>}
          {t.is_pg && <span className="px-1.5 rounded-full border border-slate-200 text-slate-500">ПГ</span>}
          {isNew(t) && <span className="px-1.5 rounded-full bg-emerald-50 text-emerald-700">ново</span>}
        </div>
      </div>
      <div className="absolute top-2.5 right-2.5 flex flex-col items-center gap-0.5" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={() => toggleFav(t)} title={favs.has(t.id) ? 'Махни от моите' : 'Към моите'}
          className={`p-1 rounded-lg transition-colors ${favs.has(t.id) ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'}`}>
          <Star size={15} fill={favs.has(t.id) ? 'currentColor' : 'none'} />
        </button>
        {isPdf(t) && (
          <button type="button" onClick={() => preview(t)} title="Преглед" className="p-1 rounded-lg text-slate-300 hover:text-[#0f2240] opacity-0 group-hover:opacity-100">
            <Eye size={15} />
          </button>
        )}
        {canManage && (
          <>
            <button type="button" onClick={() => startEdit(t)} title="Редакция" className="p-1 rounded-lg text-slate-300 hover:text-slate-700 opacity-0 group-hover:opacity-100"><Pencil size={14} /></button>
            <button type="button" onClick={() => remove(t)} title="Изтрий" className="p-1 rounded-lg text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
          </>
        )}
      </div>
    </div>
  )
  const grid = (list: Template[], compact = false) => (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{list.map(t => card(t, compact))}</div>
  )
  return (
    <div className="space-y-6">
      {!ready && canManage && (
        <div className="px-4 py-2.5 rounded-xl text-sm bg-amber-50 border border-amber-200 text-amber-800">
          Колекциите и любимите още не са включени — пуснете SQL файла 2026-10-20_template_collections.sql.
        </div>
      )}

      {/* търсене + действия */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} 
              placeholder="Какво търсиш? — напр. отпуск, протокол, съгласие…"
              className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-[15px] shadow-sm focus:outline-none focus:border-slate-400" />
            {search && <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>}
          </div>
          {canManage && (
            <>
              <button type="button" onClick={() => setManage(true)} disabled={!ready} title="Колекции"
                className="p-3 rounded-2xl border border-slate-200 bg-white text-slate-500 hover:text-[#0f2240] hover:bg-slate-50 disabled:opacity-40"><Settings2 size={18} /></button>
              <button type="button" onClick={() => { setUCols(collections.some(c => c.id === filter) ? [filter] : []); setIsPg(filter === 'pg'); setShowUpload(true) }}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl text-white text-sm hover:opacity-90 shrink-0" style={{ backgroundColor: '#0f2240' }}>
                <Plus size={16} /> <span className="hidden sm:inline">Качи образец</span>
              </button>
            </>
          )}
        </div>
        {/* един ред филтри — само това, което има смисъл */}
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            { id: 'all', label: 'Всички', n: templates.length, icon: null as any },
            ...(ready ? [{ id: 'fav', label: 'Моите', n: favs.size, icon: Star }] : []),
            ...(pgCount ? [{ id: 'pg', label: 'ПГ', n: pgCount, icon: Baby }] : []),
            ...usedCols.map(c => ({ id: c.id, label: c.name, n: c.n, icon: null as any })),
          ]).map(f => {
            const on = filter === f.id
            return (
              <button key={f.id} type="button" onClick={() => setFilter(on && f.id !== 'all' ? 'all' : f.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] border transition-colors ${on ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {f.icon && <f.icon size={13} fill={f.id === 'fav' && on ? 'currentColor' : 'none'} />} {f.label}
                <span className={on ? 'text-white/60' : 'text-slate-400'}>{f.n}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* качване */}
      {canManage && showUpload && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-medium text-slate-800 flex items-center gap-2"><UploadCloud size={16} style={{ color: '#0f2240' }} /> Качване на нов образец</h3>
            <button type="button" onClick={resetUpload} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={16} /></button>
          </div>
          <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) pickFile(f) }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-1 py-6 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${dragOver ? 'border-blue-500 bg-blue-50/40' : pendingFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
            {pendingFile ? (
              <div className="text-center"><p className="text-sm text-slate-800">{pendingFile.name}</p><p className="text-xs text-slate-500">{formatSize(pendingFile.size)} · клик за смяна</p></div>
            ) : (
              <div className="text-center"><UploadCloud size={22} style={{ color: '#0f2240' }} className="mx-auto mb-1" /><p className="text-sm text-slate-700">Плъзнете файл или кликнете</p><p className="text-xs text-slate-400">Word, Excel или PDF · до 10MB</p></div>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.dot,.dotx,.xls,.xlsx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = '' }} />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Заглавие *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="напр. Заявление за отпуск"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Пояснение — за какво е</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="напр. Подава се 3 дни предварително"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none" />
            </div>
          </div>
          {ready && (
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Колекция — по желание</label>
              <CollectionPicker collections={collections} value={uCols} onChange={setUCols} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm cursor-pointer ${isPg ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              <input type="checkbox" checked={isPg} onChange={e => setIsPg(e.target.checked)} className="sr-only" /><Baby size={14} /> За ПГ
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={resetUpload} className="px-4 py-2 rounded-xl text-sm bg-white border border-slate-200 hover:bg-slate-100 text-slate-700">Отказ</button>
            <button type="button" onClick={doUpload} disabled={uploading || !title.trim() || !pendingFile}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm text-white disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {uploading ? 'Качване…' : 'Качи'}
            </button>
          </div>
        </div>
      )}

      {/* един списък А–Я */}
      <section>
        {list.length ? grid(list) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500">
            {filter === 'fav' && !search.trim() ? 'Още нямате любими — натиснете звездата на образец.'
              : templates.length === 0 ? `Няма образци${canManage ? ' — качете с „Качи образец“' : ''}.` : 'Нищо не е намерено.'}
          </div>
        )}
      </section>

      {/* редакция */}
      {edit && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-medium text-slate-800 flex items-center gap-2"><Pencil size={15} style={{ color: '#0f2240' }} /> Редактиране</h3>
              <button type="button" onClick={() => setEdit(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Заглавие</label>
                <input type="text" value={eTitle} onChange={e => setETitle(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Пояснение — за какво е</label>
                <input type="text" value={eDesc} onChange={e => setEDesc(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              {ready && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Колекции</label>
                  <CollectionPicker collections={collections} value={eCols} onChange={setECols} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm cursor-pointer ${ePg ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                  <input type="checkbox" checked={ePg} onChange={e => setEPg(e.target.checked)} className="sr-only" /><Baby size={14} /> За ПГ
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setEdit(null)} className="px-4 py-2 rounded-xl text-sm bg-slate-100 hover:bg-slate-200 text-slate-700">Отказ</button>
              <button type="button" onClick={saveEdit} disabled={savingEdit || !eTitle.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm text-white disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
                {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Запази
              </button>
            </div>
          </div>
        </div>
      )}

      {manage && <ManageCollections collections={collections} setCollections={setCollections} counts={Object.fromEntries(collections.map(c => [c.id, colCount(c.id)]))} onClose={() => setManage(false)} />}
    </div>
  )
}

// ── настройка на колекциите: име, иконка, ред, нова, изтриване ──
function ManageCollections({ collections, setCollections, counts = {}, onClose }: {
  collections: Collection[]; setCollections: (c: Collection[]) => void; counts?: Record<string, number>; onClose: () => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [rows, setRows] = useState(collections)
  const [iconFor, setIconFor] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  async function patch(id: string, p: Partial<Collection>) {
    const { error } = await supabase.from('template_collections').update(p).eq('id', id)
    if (error) { toast(error.message.includes('unique') ? 'Такава колекция вече има' : 'Грешка при запис', 'error'); return false }
    const next = rows.map(r => r.id === id ? { ...r, ...p } : r)
    setRows(next); setCollections(next); return true
  }
  async function move(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= rows.length) return
    const next = [...rows];[next[i], next[j]] = [next[j], next[i]]
    const withSort = next.map((r, k) => ({ ...r, sort: (k + 1) * 10 }))
    setRows(withSort); setCollections(withSort)
    await Promise.all(withSort.map(r => supabase.from('template_collections').update({ sort: r.sort }).eq('id', r.id)))
  }
  async function add() {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    const { data, error } = await supabase.from('template_collections').insert({ name, icon: 'folder', sort: (rows.length + 1) * 10 }).select('id, name, icon, sort').single()
    setBusy(false)
    if (error || !data) { toast(error?.message.includes('unique') ? 'Такава колекция вече има' : 'Грешка при запис', 'error'); return }
    const next = [...rows, data as Collection]
    setRows(next); setCollections(next); setNewName('')
  }
  // всички празни колекции наведнъж — образците не се пипат
  const empty = rows.filter(r => !counts[r.id])
  async function delEmpty() {
    if (!empty.length) return
    if (!await confirmDialog(`Да се изтрият ли ${empty.length} празни колекции? В тях няма образци.`)) return
    const { error } = await supabase.from('template_collections').delete().in('id', empty.map(r => r.id))
    if (error) { toast('Грешка при изтриване', 'error'); return }
    const next = rows.filter(r => counts[r.id])
    setRows(next); setCollections(next)
  }
  async function del(c: Collection) {
    if (!await confirmDialog(`Да се изтрие ли колекцията „${c.name}“? Образците остават — само излизат от нея.`)) return
    const { error } = await supabase.from('template_collections').delete().eq('id', c.id)
    if (error) { toast('Грешка при изтриване', 'error'); return }
    const next = rows.filter(r => r.id !== c.id)
    setRows(next); setCollections(next)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-medium text-slate-800 flex items-center gap-2"><Settings2 size={15} style={{ color: '#0f2240' }} /> Колекции</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="px-5 pt-3 text-[12px] text-slate-500 flex items-center gap-2">
          <span>По-малко колекции = по-лесно. Празните не се виждат от колегите.</span>
          {empty.length > 0 && (
            <button type="button" onClick={delEmpty} className="ml-auto shrink-0 px-2.5 py-1 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50">
              Изтрий празните ({empty.length})
            </button>
          )}
        </div>
        <div className="px-5 py-3 overflow-y-auto space-y-1.5">
          {rows.map((c, i) => {
            const I = ICONS[c.icon] || FolderOpen
            const tint = TINTS[i % TINTS.length]
            return (
              <div key={c.id}>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setIconFor(iconFor === c.id ? null : c.id)} title="Иконка"
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: tint.bg, color: tint.fg }}><I size={17} /></button>
                  <input defaultValue={c.name} onBlur={e => { const v = e.target.value.trim(); if (v && v !== c.name) patch(c.id, { name: v }) }}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-400" />
                  <span className={`text-[11px] tabular-nums w-14 text-right shrink-0 ${counts[c.id] ? 'text-slate-500' : 'text-amber-600'}`}>{counts[c.id] ? `${counts[c.id]} обр.` : 'празна'}</span>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown size={14} /></button>
                  <button type="button" onClick={() => del(c)} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600"><Trash2 size={14} /></button>
                </div>
                {iconFor === c.id && (
                  <div className="flex flex-wrap gap-1 mt-1.5 ml-11 p-2 rounded-xl bg-slate-50">
                    {Object.entries(ICONS).map(([k, Ic]) => (
                      <button key={k} type="button" onClick={async () => { if (await patch(c.id, { icon: k })) setIconFor(null) }}
                        className={`p-1.5 rounded-lg ${c.icon === k ? 'bg-white shadow-sm text-[#0f2240]' : 'text-slate-500 hover:bg-white'}`}><Ic size={16} /></button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-100">
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Нова колекция — напр. Край на срока"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-400" />
          <button type="button" onClick={add} disabled={busy || !newName.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Добави
          </button>
        </div>
      </div>
    </div>
  )
}
