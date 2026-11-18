'use client'
// Образци на документи — групите вляво (като в първата версия), образците вдясно.
// Групите се подреждат изцяло в EIS от деловодството/управата („Подреди“): име, иконка, ред, нова група,
// изтриване, местене на образец в група (влачене върху групата или избор от падащото меню).
// Един образец — една група (collection_ids[0]); без група → „Без група“.
// Горе: търсене + „Качи образец“; вляво и Всички · ★ Моите · Нови · ПГ. В групата — А–Я; „НОВО“ — 21 дни.
import { useState, useMemo, useRef } from 'react'
import { smartMatch } from '@/lib/search'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, Download, Trash2, Loader2, FolderOpen, Plus, X, Search, Baby, Pencil, Check, UploadCloud,
  Briefcase, ClipboardList, Star, Eye, Settings2, Plane, Repeat, UserPlus, HeartHandshake, Users, Bus,
  ShieldCheck, Wallet, BookOpen, GraduationCap, Stethoscope, CalendarDays, ArrowUp, ArrowDown, FileSignature,
  Sparkles, Layers, GripVertical,
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
interface Group { id: string; name: string; icon: string; sort: number }
interface Props {
  templates: Template[]
  collections: Group[]
  favorites: string[]
  ready: boolean          // пуснат ли е SQL файлът за групите (template_collections)
  canManage: boolean
  staffId: string
}

const ACCEPTED = ['pdf', 'doc', 'docx', 'dot', 'dotx', 'xls', 'xlsx']
const ICONS: Record<string, any> = {
  folder: FolderOpen, sign: FileSignature, briefcase: Briefcase, clipboard: ClipboardList, users: Users,
  heart: HeartHandshake, 'user-plus': UserPlus, plane: Plane, repeat: Repeat, bus: Bus, shield: ShieldCheck,
  wallet: Wallet, book: BookOpen, cap: GraduationCap, health: Stethoscope, calendar: CalendarDays, baby: Baby,
}
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
const byTitle = (a: Template, b: Template) => a.title.localeCompare(b.title, 'bg', { numeric: true })

function FileBadge({ fileName }: { fileName: string }) {
  const ext = getExt(fileName)
  let label = 'W', bg = '#2563eb'
  if (ext === 'pdf') { label = 'PDF'; bg = '#dc2626' }
  else if (ext === 'xls' || ext === 'xlsx') { label = 'XLS'; bg = '#16a34a' }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: bg }}>
      {label}
    </span>
  )
}

export default function TemplatesClient({ templates: initial, collections: initialGroups, favorites: initialFavs, ready, canManage, staffId }: Props) {
  const supabase = createClient()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>(initial)
  const [groups, setGroups] = useState<Group[]>([...initialGroups].sort((a, b) => a.sort - b.sort))
  const [favs, setFavs] = useState<Set<string>>(new Set(initialFavs))
  // избраното вляво: 'all' · 'fav' · 'new' · 'pg' · id на група · NONE
  const [sel, setSel] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [arrange, setArrange] = useState(false)          // режим „Подреди“ (групи + местене)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropOn, setDropOn] = useState<string | null>(null)

  // качване
  const [showUpload, setShowUpload] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [uGroup, setUGroup] = useState<string>('')
  const [description, setDescription] = useState('')
  const [isPg, setIsPg] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  // редакция
  const [edit, setEdit] = useState<Template | null>(null)
  const [eTitle, setETitle] = useState('')
  const [eGroup, setEGroup] = useState<string>('')
  const [eDesc, setEDesc] = useState('')
  const [ePg, setEPg] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const groupIds = useMemo(() => new Set(groups.map(g => g.id)), [groups])
  const groupOf = (t: Template) => (t.collection_ids || []).find(id => groupIds.has(id)) || NONE
  const countIn = (id: string) => templates.filter(t => groupOf(t) === id).length
  const noneCount = templates.filter(t => groupOf(t) === NONE).length
  const newCount = templates.filter(isNew).length
  const pgCount = templates.filter(t => t.is_pg).length
  const groupName = (id: string) => id === NONE ? 'Без група' : groups.find(g => g.id === id)?.name || ''

  const list = useMemo(() => {
    const q = search.trim()
    let l = templates
    if (sel === 'fav') l = l.filter(t => favs.has(t.id))
    else if (sel === 'new') l = l.filter(isNew)
    else if (sel === 'pg') l = l.filter(t => t.is_pg)
    else if (sel !== 'all') l = l.filter(t => groupOf(t) === sel)
    if (q) l = l.filter(t => smartMatch(t.title, q) || smartMatch(t.description || '', q) || smartMatch(groupName(groupOf(t)), q))
    return [...l].sort(byTitle)
  }, [templates, sel, search, favs, groups]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── образци ──
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
  // местене в група (падащо меню или влачене)
  async function moveTo(t: Template, gid: string) {
    if (groupOf(t) === gid) return
    const ids = gid === NONE ? [] : [gid]
    const { error } = await supabase.from('document_templates').update({ collection_ids: ids }).eq('id', t.id)
    if (error) { toast('Грешка при местене', 'error'); return }
    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, collection_ids: ids } : x))
    toast(`„${t.title}“ → ${groupName(gid)}`)
  }

  function resetUpload() {
    setTitle(''); setDescription(''); setPendingFile(null); setIsPg(false); setShowUpload(false)
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
    if (ready) row.collection_ids = uGroup && uGroup !== NONE ? [uGroup] : []
    const { data: newT, error } = await supabase.from('document_templates').insert(row).select().single()
    setUploading(false)
    if (error || !newT) { toast('Грешка при запис', 'error'); return }
    toast('Образецът е качен')
    setTemplates(prev => [newT, ...prev])
    resetUpload()
  }
  function startEdit(t: Template) {
    setEdit(t); setETitle(t.title); setEGroup(groupOf(t)); setEDesc(t.description || ''); setEPg(t.is_pg)
  }
  async function saveEdit() {
    if (!edit || !eTitle.trim()) return
    setSavingEdit(true)
    const patch: any = { title: eTitle.trim(), description: eDesc.trim() || null, is_pg: ePg }
    if (ready) patch.collection_ids = eGroup && eGroup !== NONE ? [eGroup] : []
    const { error } = await supabase.from('document_templates').update(patch).eq('id', edit.id)
    setSavingEdit(false)
    if (error) { toast('Грешка при запис', 'error'); return }
    setTemplates(prev => prev.map(t => t.id === edit.id ? { ...t, ...patch } : t))
    toast('Образецът е обновен'); setEdit(null)
  }

  // ── групи (режим „Подреди“) ──
  async function patchGroup(id: string, p: Partial<Group>) {
    const { error } = await supabase.from('template_collections').update(p).eq('id', id)
    if (error) { toast(error.message.includes('unique') ? 'Такава група вече има' : 'Грешка при запис', 'error'); return false }
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...p } : g)); return true
  }
  async function moveGroup(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= groups.length) return
    const next = [...groups];[next[i], next[j]] = [next[j], next[i]]
    const withSort = next.map((g, k) => ({ ...g, sort: (k + 1) * 10 }))
    setGroups(withSort)
    await Promise.all(withSort.map(g => supabase.from('template_collections').update({ sort: g.sort }).eq('id', g.id)))
  }
  const [newGroup, setNewGroup] = useState('')
  async function addGroup() {
    const name = newGroup.trim()
    if (!name) return
    const { data, error } = await supabase.from('template_collections')
      .insert({ name, icon: 'folder', sort: (groups.length + 1) * 10 }).select('id, name, icon, sort').single()
    if (error || !data) { toast(error?.message.includes('unique') ? 'Такава група вече има' : 'Грешка при запис', 'error'); return }
    setGroups(prev => [...prev, data as Group]); setNewGroup('')
  }
  async function delGroup(g: Group) {
    const n = countIn(g.id)
    if (!await confirmDialog(n
      ? `Да се изтрие ли групата „${g.name}“? ${n} образеца в нея отиват в „Без група“ (не се трият).`
      : `Да се изтрие ли празната група „${g.name}“?`)) return
    if (n) {
      const ids = templates.filter(t => groupOf(t) === g.id).map(t => t.id)
      await supabase.from('document_templates').update({ collection_ids: [] }).in('id', ids)
      setTemplates(prev => prev.map(t => ids.includes(t.id) ? { ...t, collection_ids: [] } : t))
    }
    const { error } = await supabase.from('template_collections').delete().eq('id', g.id)
    if (error) { toast('Грешка при изтриване', 'error'); return }
    setGroups(prev => prev.filter(x => x.id !== g.id))
    if (sel === g.id) setSel('all')
  }
  const emptyGroups = groups.filter(g => countIn(g.id) === 0)
  async function delEmpty() {
    if (!emptyGroups.length) return
    if (!await confirmDialog(`Да се изтрият ли ${emptyGroups.length} празни групи?`)) return
    const { error } = await supabase.from('template_collections').delete().in('id', emptyGroups.map(g => g.id))
    if (error) { toast('Грешка при изтриване', 'error'); return }
    const gone = new Set(emptyGroups.map(g => g.id))
    setGroups(prev => prev.filter(g => !gone.has(g.id)))
  }
  const [iconFor, setIconFor] = useState<string | null>(null)

  // ── лява колона ──
  const sideItem = (id: string, label: string, n: number, I?: any, gi?: number) => {
    const on = sel === id
    const isGroup = gi !== undefined || id === NONE
    const droppable = arrange && isGroup
    return (
      <div key={id}
        onDragOver={droppable ? e => { e.preventDefault(); setDropOn(id) } : undefined}
        onDragLeave={droppable ? () => setDropOn(d => d === id ? null : d) : undefined}
        onDrop={droppable ? e => { e.preventDefault(); setDropOn(null); const t = templates.find(x => x.id === dragId); if (t) moveTo(t, id); setDragId(null) } : undefined}
        className={`rounded-xl transition-colors ${dropOn === id ? 'ring-2 ring-[#0f2240]/40 bg-slate-50' : ''}`}>
        {arrange && gi !== undefined ? (
          <div className="flex items-center gap-1 px-1.5 py-1">
            <button type="button" onClick={() => setIconFor(iconFor === id ? null : id)} title="Иконка"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0">{I ? <I size={15} /> : <FolderOpen size={15} />}</button>
            <input defaultValue={label} onBlur={e => { const v = e.target.value.trim(); if (v && v !== label) patchGroup(id, { name: v }) }}
              className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-slate-200 text-[13px] focus:outline-none focus:border-slate-400" />
            <span className="text-[11px] text-slate-400 w-5 text-right tabular-nums">{n}</span>
            <button type="button" onClick={() => moveGroup(gi, -1)} disabled={gi === 0} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25"><ArrowUp size={13} /></button>
            <button type="button" onClick={() => moveGroup(gi, 1)} disabled={gi === groups.length - 1} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25"><ArrowDown size={13} /></button>
            <button type="button" onClick={() => delGroup(groups[gi])} title="Изтрий групата" className="p-0.5 text-slate-300 hover:text-rose-600"><Trash2 size={13} /></button>
          </div>
        ) : (
          <button type="button" onClick={() => setSel(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[13.5px] transition-colors ${on ? 'bg-[#0f2240] text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
            {I && <I size={15} className={on ? 'text-white/80' : 'text-slate-400'} />}
            <span className="flex-1 min-w-0 truncate">{label}</span>
            <span className={`text-[11.5px] tabular-nums ${on ? 'text-white/60' : 'text-slate-400'}`}>{n}</span>
          </button>
        )}
        {arrange && iconFor === id && (
          <div className="flex flex-wrap gap-1 mx-1.5 mb-1.5 p-1.5 rounded-xl bg-slate-50">
            {Object.entries(ICONS).map(([k, Ic]) => (
              <button key={k} type="button" onClick={async () => { if (await patchGroup(id, { icon: k })) setIconFor(null) }}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-[#0f2240]"><Ic size={15} /></button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── ред на образец ──
  const row = (t: Template) => (
    <div key={t.id} draggable={arrange} onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setDropOn(null) }}
      onClick={() => !arrange && download(t)} title={arrange ? 'Влачи върху група вляво' : 'Изтегли'}
      className={`group flex items-center gap-3 px-3.5 py-2.5 bg-white rounded-xl border border-slate-200/80 hover:border-slate-300 hover:shadow-sm transition-all ${arrange ? 'cursor-grab' : 'cursor-pointer'} ${dragId === t.id ? 'opacity-50' : ''}`}>
      {arrange && <GripVertical size={14} className="text-slate-300 shrink-0" />}
      <FileBadge fileName={t.file_name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[14px] text-slate-800 truncate group-hover:text-[#0f2240]">{t.title}</span>
          {isNew(t) && <span className="shrink-0 px-1.5 rounded-full text-[10.5px] font-medium bg-amber-50 text-amber-700 border border-amber-200">НОВО</span>}
          {t.is_pg && <span className="shrink-0 px-1.5 rounded-full text-[10.5px] border border-slate-200 text-slate-500">ПГ</span>}
        </div>
        <div className="text-[12px] text-slate-400 truncate">
          {busyId === t.id ? <span className="inline-flex items-center gap-1 text-[#0f2240]"><Loader2 size={11} className="animate-spin" /> тегли се…</span>
            : <>{t.description || getExt(t.file_name).toUpperCase()}{t.file_size ? ` · ${formatSize(t.file_size)}` : ''}</>}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
        {arrange ? (
          <select value={groupOf(t)} onChange={e => moveTo(t, e.target.value)} title="Група"
            className="text-[12px] border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 max-w-[11rem]">
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            <option value={NONE}>Без група</option>
          </select>
        ) : (
          <>
            <button type="button" onClick={() => toggleFav(t)} title={favs.has(t.id) ? 'Махни от моите' : 'Към моите'}
              className={`p-1.5 rounded-lg ${favs.has(t.id) ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`}>
              <Star size={15} fill={favs.has(t.id) ? 'currentColor' : 'none'} />
            </button>
            {isPdf(t) && <button type="button" onClick={() => preview(t)} title="Преглед" className="p-1.5 rounded-lg text-slate-300 hover:text-[#0f2240]"><Eye size={15} /></button>}
            <button type="button" onClick={() => download(t)} title="Изтегли" className="p-1.5 rounded-lg text-slate-300 hover:text-[#0f2240]"><Download size={15} /></button>
            {canManage && (
              <>
                <button type="button" onClick={() => startEdit(t)} title="Редакция" className="p-1.5 rounded-lg text-slate-300 hover:text-slate-700"><Pencil size={14} /></button>
                <button type="button" onClick={() => remove(t)} title="Изтрий" className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600"><Trash2 size={14} /></button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )

  const searching = !!search.trim()
  // в „Всички“ (без търсене) — по групи с заглавия; другаде — един списък
  const sections = sel === 'all' && !searching
    ? [...groups.map(g => ({ id: g.id, name: g.name })), { id: NONE, name: 'Без група' }]
        .map(s => ({ ...s, items: list.filter(t => groupOf(t) === s.id) })).filter(s => s.items.length)
    : null
  const selLabel = sel === 'all' ? 'Всички образци' : sel === 'fav' ? 'Моите' : sel === 'new' ? 'Нови' : sel === 'pg' ? 'За ПГ' : groupName(sel)

  const groupSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300">
      <option value={NONE}>Без група</option>
      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  )

  return (
    <div className="space-y-5">
      {!ready && canManage && (
        <div className="px-4 py-2.5 rounded-xl text-sm bg-amber-50 border border-amber-200 text-amber-800">
          Групите още не са включени — пуснете SQL файла 2026-10-20_template_collections.sql.
        </div>
      )}

      {/* търсене + действия */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Какво търсиш? — напр. отпуск, протокол, съгласие…"
            className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-[15px] shadow-sm focus:outline-none focus:border-slate-400" />
          {search && <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>}
        </div>
        {canManage && ready && (
          <button type="button" onClick={() => { setArrange(v => !v); setIconFor(null) }} title="Подреди групите и образците"
            className={`inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl text-sm border shrink-0 ${arrange ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {arrange ? <Check size={16} /> : <Settings2 size={16} />} <span className="hidden sm:inline">{arrange ? 'Готово' : 'Подреди'}</span>
          </button>
        )}
        {canManage && (
          <button type="button" onClick={() => { setUGroup(groupIds.has(sel) ? sel : NONE); setIsPg(sel === 'pg'); setShowUpload(true) }}
            className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl text-white text-sm hover:opacity-90 shrink-0" style={{ backgroundColor: '#0f2240' }}>
            <Plus size={16} /> <span className="hidden sm:inline">Качи образец</span>
          </button>
        )}
      </div>

      {arrange && (
        <div className="px-4 py-2.5 rounded-xl text-[13px] bg-amber-50/60 border border-amber-200 text-amber-900">
          <b>Подреждане:</b> вляво — преименувай групите (пиши в полето), смени иконка, мести ↑↓, изтрий, добави нова.
          Образец се мести в група с <b>влачене върху групата вляво</b> или от менюто до него. Накрая — „Готово“.
        </div>
      )}

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
          <div className="grid md:grid-cols-3 gap-3">
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
            {ready && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Група</label>
                {groupSelect(uGroup, setUGroup)}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm cursor-pointer ${isPg ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              <input type="checkbox" checked={isPg} onChange={e => setIsPg(e.target.checked)} className="sr-only" /><Baby size={14} /> За ПГ
            </label>
            <div className="flex-1" />
            <button type="button" onClick={resetUpload} className="px-4 py-2 rounded-xl text-sm bg-white border border-slate-200 hover:bg-slate-100 text-slate-700">Отказ</button>
            <button type="button" onClick={doUpload} disabled={uploading || !title.trim() || !pendingFile}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm text-white disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {uploading ? 'Качване…' : 'Качи'}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* лява колона — групи */}
        <aside className="space-y-0.5 lg:sticky lg:top-4 self-start bg-white/60 rounded-2xl border border-slate-200/70 p-2">
          {sideItem('all', 'Всички', templates.length, Layers)}
          {ready && sideItem('fav', 'Моите', favs.size, Star)}
          {newCount > 0 && sideItem('new', 'Нови', newCount, Sparkles)}
          {pgCount > 0 && sideItem('pg', 'За ПГ', pgCount, Baby)}
          {ready && (
            <>
              <div className="h-px bg-slate-200 my-2 mx-2" />
              <div className="px-3 pb-1 text-[10.5px] uppercase tracking-widest text-slate-400">Групи</div>
              {groups.filter(g => arrange || countIn(g.id) > 0).map((g, i) => sideItem(g.id, g.name, countIn(g.id), ICONS[g.icon] || FolderOpen, groups.indexOf(g)))}
              {(noneCount > 0 || arrange) && sideItem(NONE, 'Без група', noneCount, FolderOpen)}
              {arrange && (
                <div className="pt-2 space-y-1.5 px-1.5">
                  <div className="flex gap-1">
                    <input value={newGroup} onChange={e => setNewGroup(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGroup()}
                      placeholder="Нова група…" className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px] focus:outline-none focus:border-slate-400" />
                    <button type="button" onClick={addGroup} disabled={!newGroup.trim()}
                      className="px-2.5 rounded-lg text-white disabled:opacity-40" style={{ backgroundColor: '#0f2240' }}><Plus size={14} /></button>
                  </div>
                  {emptyGroups.length > 0 && (
                    <button type="button" onClick={delEmpty} className="w-full text-[12px] px-2.5 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50">
                      Изтрий празните групи ({emptyGroups.length})
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </aside>

        {/* дясно — образците */}
        <section className="min-w-0 space-y-5">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[15px] font-medium text-slate-800">{searching ? 'Резултати' : selLabel}</h2>
            <span className="text-xs text-slate-400">{list.length}</span>
          </div>
          {list.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500">
              {sel === 'fav' && !searching ? 'Още нямате любими — натиснете звездата на образец.'
                : templates.length === 0 ? `Няма образци${canManage ? ' — качете с „Качи образец“' : ''}.` : 'Нищо не е намерено.'}
            </div>
          ) : sections ? sections.map(s => (
            <div key={s.id}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-[12px] font-medium text-slate-500 uppercase tracking-wide">{s.name}</h3>
                <span className="text-[11px] text-slate-400">{s.items.length}</span>
                <span className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="space-y-1.5">{s.items.map(row)}</div>
            </div>
          )) : (
            <div className="space-y-1.5">{list.map(row)}</div>
          )}
        </section>
      </div>

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
                  <label className="block text-xs text-slate-500 mb-1">Група</label>
                  {groupSelect(eGroup, setEGroup)}
                </div>
              )}
              <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm cursor-pointer ${ePg ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200'}`}>
                <input type="checkbox" checked={ePg} onChange={e => setEPg(e.target.checked)} className="sr-only" /><Baby size={14} /> За ПГ
              </label>
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
    </div>
  )
}
