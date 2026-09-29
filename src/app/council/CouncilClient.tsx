'use client'
import { useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  CalendarClock, Upload, Download, Trash2, Loader2, Plus, X, Archive, ArchiveRestore, Pencil, Check,
  ChevronDown, Eye, CheckCircle2, Users, Sparkles,
} from 'lucide-react'

type CFile = { id: string; name: string; description: string | null; path: string; size: number | null; mime: string; createdAt: string }
type Ack = { staffId: string; at: string }
type Group = { id: string; title: string; eventDate: string | null; isArchived: boolean; files: CFile[]; acks: Ack[] }
type Person = { id: string; name: string }

const BUCKET = 'council-materials'
function fmtDate(d: string | null) { return d ? d.split('-').reverse().join('.') : '' }
function fmtSize(b: number | null) { if (!b) return ''; if (b < 1024) return `${b} B`; if (b < 1048576) return `${Math.round(b / 1024)} KB`; return `${(b / 1048576).toFixed(1)} MB` }
function fmtWhen(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} в ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
// предложение за описание от името на файла
function suggestDesc(filename: string): string {
  let n = filename.replace(/\.[a-z0-9]+$/i, '')
  n = n.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return n.charAt(0).toUpperCase() + n.slice(1)
}
function todayIso() {
  const n = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Sofia' }))
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}
// „днес“ / „утре“ / „след 3 дни“ / „приключил“
function whenBadge(eventDate: string | null, today: string): { text: string; cls: string } | null {
  if (!eventDate) return null
  const days = Math.round((new Date(eventDate + 'T00:00').getTime() - new Date(today + 'T00:00').getTime()) / 86400000)
  if (days < 0) return { text: 'приключил', cls: 'bg-slate-100 text-slate-500 border-slate-200' }
  if (days === 0) return { text: 'днес', cls: 'bg-rose-50 text-rose-600 border-rose-100' }
  if (days === 1) return { text: 'утре', cls: 'bg-amber-50 text-amber-700 border-amber-100' }
  return { text: `след ${days} дни`, cls: 'bg-sky-50 text-sky-700 border-sky-100' }
}
// вид на файла → етикет и мек цвят
function fileKind(f: CFile): { label: string; bg: string; fg: string; preview: boolean } {
  const ext = (f.name.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf' || f.mime === 'application/pdf') return { label: 'PDF', bg: '#fdecec', fg: '#b42318', preview: true }
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return { label: 'DOC', bg: '#e8f0fd', fg: '#1d4ed8', preview: false }
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return { label: 'XLS', bg: '#e7f6ec', fg: '#15803d', preview: false }
  if (['ppt', 'pptx', 'odp'].includes(ext)) return { label: 'PPT', bg: '#fdf0e6', fg: '#c2410c', preview: false }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return { label: 'IMG', bg: '#f1ecfb', fg: '#6d28d9', preview: true }
  return { label: ext.toUpperCase().slice(0, 4) || 'FILE', bg: '#eef1f5', fg: '#475569', preview: false }
}

export default function CouncilClient({ groups: initial, canManage, meId, acksOn, people }: {
  groups: Group[]; canManage: boolean; meId: string; acksOn: boolean; people: Person[]
}) {
  const supabase = createClient()
  const today = todayIso()
  const [groups, setGroups] = useState<Group[]>(initial)
  const [openId, setOpenId] = useState<string | null>(initial.find(g => !g.isArchived)?.id || null)
  const [whoOpen, setWhoOpen] = useState<string | null>(null)
  const [acking, setAcking] = useState<string | null>(null)

  // нов комплект
  const [showNew, setShowNew] = useState(false)
  const [nTitle, setNTitle] = useState('Педагогически съвет')
  const [nDate, setNDate] = useState('')
  const [savingSet, setSavingSet] = useState(false)

  // качване
  const [uploadingTo, setUploadingTo] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingSet = useRef<string | null>(null)

  // редакция описание
  const [editFile, setEditFile] = useState<string | null>(null)
  const [editDesc, setEditDesc] = useState('')

  const nameOf = useMemo(() => Object.fromEntries(people.map(p => [p.id, p.name])), [people])

  // кога е добавен последният файл — „Запознах се“ преди това не важи (има нови файлове)
  const ts = (iso: string) => Date.parse(iso) || 0
  const lastFileAt = (g: Group) => g.files.reduce((m, f) => Math.max(m, ts(f.createdAt)), 0)
  const validAck = (g: Group, a?: Ack) => !!a && ts(a.at) >= lastFileAt(g)
  const myAck = (g: Group) => g.acks.find(a => a.staffId === meId)

  async function createSet() {
    if (!nTitle.trim()) return
    setSavingSet(true)
    const { data, error } = await supabase.from('council_sets')
      .insert({ title: nTitle.trim(), event_date: nDate || null, created_by: meId })
      .select('id, title, event_date, is_archived').single()
    setSavingSet(false)
    if (error || !data) { alert('Грешка при създаване'); return }
    const g: Group = { id: data.id, title: data.title, eventDate: data.event_date, isArchived: false, files: [], acks: [] }
    setGroups(prev => [g, ...prev]); setOpenId(g.id); setShowNew(false); setNTitle('Педагогически съвет'); setNDate('')
  }

  function triggerUpload(setId: string) { pendingSet.current = setId; fileRef.current?.click() }

  async function onFiles(list: FileList) {
    const setId = pendingSet.current; if (!setId) return
    setUploadingTo(setId)
    const added: CFile[] = []
    for (const file of Array.from(list)) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
      const path = `${setId}/${Date.now()}_${safe}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file)
      if (error) { alert('Грешка при качване: ' + file.name); continue }
      const { data, error: dbErr } = await supabase.from('council_files')
        .insert({ set_id: setId, name: file.name, description: suggestDesc(file.name), path, size: file.size, mime_type: file.type, uploaded_by: meId })
        .select('id, name, description, path, size, mime_type, created_at').single()
      if (dbErr || !data) { await supabase.storage.from(BUCKET).remove([path]); alert('Грешка при запис: ' + file.name); continue }
      added.push({ id: data.id, name: data.name, description: data.description, path: data.path, size: data.size, mime: data.mime_type || '', createdAt: data.created_at })
    }
    setGroups(prev => prev.map(g => g.id === setId ? { ...g, files: [...g.files, ...added] } : g))
    setUploadingTo(null); pendingSet.current = null
  }

  async function download(f: CFile) {
    const { data, error } = await supabase.storage.from(BUCKET).download(f.path)
    if (error || !data) { alert('Файлът не може да се изтегли'); return }
    const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = f.name
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }
  // PDF и снимки — направо в браузъра (удобно и от телефон); останалите се изтеглят
  async function openFile(f: CFile) {
    if (!fileKind(f).preview) return download(f)
    const w = window.open('', '_blank')
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.path, 600)
    if (error || !data?.signedUrl) { w?.close(); return download(f) }
    if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl
  }
  async function delFile(setId: string, f: CFile) {
    if (!confirm(`Изтрий „${f.description || f.name}“?`)) return
    await supabase.storage.from(BUCKET).remove([f.path])
    await supabase.from('council_files').delete().eq('id', f.id)
    setGroups(prev => prev.map(g => g.id === setId ? { ...g, files: g.files.filter(x => x.id !== f.id) } : g))
  }
  async function saveDesc(setId: string, fileId: string) {
    await supabase.from('council_files').update({ description: editDesc }).eq('id', fileId)
    setGroups(prev => prev.map(g => g.id === setId ? { ...g, files: g.files.map(x => x.id === fileId ? { ...x, description: editDesc } : x) } : g))
    setEditFile(null)
  }
  async function toggleArchive(g: Group) {
    await supabase.from('council_sets').update({ is_archived: !g.isArchived }).eq('id', g.id)
    setGroups(prev => prev.map(x => x.id === g.id ? { ...x, isArchived: !x.isArchived } : x))
  }
  async function delSet(g: Group) {
    if (!confirm(`Изтрий целия комплект „${g.title}“ и файловете му?`)) return
    if (g.files.length) await supabase.storage.from(BUCKET).remove(g.files.map(f => f.path))
    await supabase.from('council_sets').delete().eq('id', g.id)
    setGroups(prev => prev.filter(x => x.id !== g.id))
  }
  async function acknowledge(g: Group) {
    setAcking(g.id)
    const at = new Date().toISOString()
    const { error } = await supabase.from('council_acks').upsert({ set_id: g.id, staff_id: meId, acked_at: at }, { onConflict: 'set_id,staff_id' })
    setAcking(null)
    if (error) { alert('Грешка при запис'); return }
    setGroups(prev => prev.map(x => x.id === g.id ? { ...x, acks: [...x.acks.filter(a => a.staffId !== meId), { staffId: meId, at }] } : x))
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div>
          {!showNew ? (
            <button onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
              <Plus size={16} /> Нов комплект
            </button>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-800">Нов комплект материали</h3>
                <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={nTitle} onChange={e => setNTitle(e.target.value)} placeholder="Заглавие (напр. Педагогически съвет)"
                  className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
                <input type="date" value={nDate} onChange={e => setNDate(e.target.value)} title="Дата на съвета"
                  className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
                <button onClick={createSet} disabled={savingSet || !nTitle.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
                  {savingSet ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Създай
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = '' }} />

      {groups.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-14 text-center text-sm text-slate-400">Няма материали.</div>
      ) : groups.map(g => {
        const open = openId === g.id
        const badge = g.isArchived ? null : whenBadge(g.eventDate, today)
        const mine = myAck(g)
        const iAcked = validAck(g, mine)
        const staleMine = !!mine && !iAcked
        const showAck = acksOn && !g.isArchived && g.files.length > 0
        const ackedIds = new Set(g.acks.filter(a => validAck(g, a)).map(a => a.staffId))
        const ackedPeople = people.filter(p => ackedIds.has(p.id))
        const pending = people.filter(p => !ackedIds.has(p.id))
        const pct = people.length ? Math.round(ackedPeople.length / people.length * 100) : 0
        return (
          <div key={g.id} className={`bg-white rounded-2xl border shadow-[0_1px_4px_rgba(15,34,64,0.06)] overflow-hidden transition-all ${
            g.isArchived ? 'border-slate-200 opacity-70' : open ? 'border-slate-400 shadow-[0_4px_16px_rgba(15,34,64,0.08)]' : 'border-slate-200 hover:border-slate-300 hover:shadow-[0_2px_10px_rgba(15,34,64,0.08)]'
          }`}>
            {/* Заглавие на комплекта */}
            <button onClick={() => setOpenId(open ? null : g.id)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
              <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${g.isArchived ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
                <CalendarClock size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[15px] font-medium text-slate-800">{g.title}</span>
                  {g.eventDate && <span className="text-sm text-slate-500">{fmtDate(g.eventDate)}</span>}
                  {badge && <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.text}</span>}
                  {g.isArchived && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">архивиран</span>}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {g.files.length} {g.files.length === 1 ? 'файл' : 'файла'}
                  {canManage && showAck && <> · запознати {ackedPeople.length} от {people.length}</>}
                </div>
              </div>
              {showAck && (iAcked
                ? <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0"><Check size={12} /> запознат</span>
                : <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 shrink-0"><Sparkles size={12} /> {staleMine ? 'нови файлове' : 'за преглед'}</span>)}
              <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2">
                {g.files.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">Няма качени файлове.</p>
                ) : g.files.map(f => {
                  const k = fileKind(f)
                  const isNewForMe = !!mine && ts(f.createdAt) > ts(mine.at)
                  return (
                    <div key={f.id}
                      onClick={() => editFile !== f.id && openFile(f)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-white group transition-all ${editFile === f.id ? '' : 'cursor-pointer hover:border-slate-300 hover:shadow-[0_2px_10px_rgba(15,34,64,0.08)] hover:-translate-y-0.5'}`}>
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg shrink-0 text-[10px] font-semibold tracking-wide" style={{ background: k.bg, color: k.fg }}>{k.label}</span>
                      <div className="min-w-0 flex-1">
                        {editFile === f.id ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <input value={editDesc} onChange={e => setEditDesc(e.target.value)} autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') saveDesc(g.id, f.id); if (e.key === 'Escape') setEditFile(null) }}
                              className="flex-1 px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" />
                            <button onClick={() => saveDesc(g.id, f.id)} className="text-emerald-600 hover:text-emerald-700"><Check size={15} /></button>
                            <button onClick={() => setEditFile(null)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm text-slate-800 truncate group-hover:text-[#0f2240]">{f.description || f.name}</span>
                              {isNewForMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 shrink-0">нов</span>}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">{f.name} · {fmtSize(f.size)}</div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                        {editFile !== f.id && canManage && (
                          <button onClick={() => { setEditFile(f.id); setEditDesc(f.description || '') }} className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] opacity-0 group-hover:opacity-100" title="Редактирай описанието"><Pencil size={13} /></button>
                        )}
                        {k.preview && <button onClick={() => openFile(f)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-slate-100" title="Отвори"><Eye size={15} /></button>}
                        <button onClick={() => download(f)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-slate-100" title="Изтегли"><Download size={15} /></button>
                        {canManage && <button onClick={() => delFile(g.id, f)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100" title="Изтрий"><Trash2 size={14} /></button>}
                      </div>
                    </div>
                  )
                })}

                {/* Запознах се */}
                {showAck && (
                  <div className={`mt-3 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap border ${iAcked ? 'bg-emerald-50/60 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                    {iAcked ? (
                      <>
                        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                        <span className="text-sm text-emerald-800">Запознахте се с материалите на {fmtWhen(mine!.at)}.</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-slate-600 flex-1 min-w-[200px]">
                          {staleMine ? 'Добавени са нови файлове след последното ви запознаване. Прегледайте ги и потвърдете отново.' : 'Прегледайте материалите и потвърдете, че сте се запознали с тях.'}
                        </span>
                        <button onClick={() => acknowledge(g)} disabled={acking === g.id}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 shrink-0">
                          {acking === g.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запознах се
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Кой се е запознал — за управата */}
                {canManage && showAck && people.length > 0 && (
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <button onClick={() => setWhoOpen(whoOpen === g.id ? null : g.id)} className="w-full flex items-center gap-3 text-left">
                      <Users size={15} className="text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-700 shrink-0">Запознати: <span className="font-medium">{ackedPeople.length}</span> от {people.length}</span>
                      <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden min-w-[60px]">
                        <span className="block h-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                      </span>
                      <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${whoOpen === g.id ? 'rotate-180' : ''}`} />
                    </button>
                    {whoOpen === g.id && (
                      <div className="grid sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-100">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1.5">Още не са ({pending.length})</div>
                          <div className="flex flex-wrap gap-1.5">
                            {pending.map(p => <span key={p.id} className="text-[12px] px-2 py-0.5 rounded-md bg-amber-50 border border-amber-100 text-amber-800">{p.name}</span>)}
                            {pending.length === 0 && <span className="text-[12px] text-emerald-700">Всички са се запознали.</span>}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1.5">Запознати ({ackedPeople.length})</div>
                          <div className="space-y-0.5 max-h-56 overflow-y-auto pr-1">
                            {g.acks.filter(a => ackedIds.has(a.staffId) && nameOf[a.staffId]).sort((a, b) => ts(a.at) - ts(b.at)).map(a => (
                              <div key={a.staffId} className="flex items-center justify-between gap-2 text-[12px]">
                                <span className="text-slate-700 truncate">{nameOf[a.staffId]}</span>
                                <span className="text-slate-400 shrink-0">{fmtWhen(a.at)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {canManage && (
                  <div className="flex items-center gap-2 pt-2 flex-wrap">
                    <button onClick={() => triggerUpload(g.id)} disabled={uploadingTo === g.id}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-blue-400 hover:bg-slate-50 disabled:opacity-50">
                      {uploadingTo === g.id ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                      {uploadingTo === g.id ? 'Качване…' : 'Качи файл(ове)'}
                    </button>
                    <div className="ml-auto flex items-center gap-1.5">
                      <button onClick={() => toggleArchive(g)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100">
                        {g.isArchived ? <><ArchiveRestore size={13} /> Възстанови</> : <><Archive size={13} /> Архивирай</>}
                      </button>
                      <button onClick={() => delSet(g)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Изтрий комплекта"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
