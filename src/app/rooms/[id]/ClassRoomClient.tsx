'use client'

// Стаята на паралелката — изгледът на учителя.
//  • „Материали“: нова публикация (за цялата паралелка или само за едно дете, предмет/дейност, указания, линк, файл,
//    материал от библиотеката), лента с публикациите (филтър по предмет и по дете), „видели X от Y“ с имената,
//    въпросите на всеки родител поотделно и отговор само към него.
//  • „Родители и линкове“: личният линк на всяко дете (копирай, Viber), отваряния, спиране/нов линк, лист с QR кодове.
//  • Хронология (Word) по дни — доказателство за периода. Нищо не се трие — публикация само се скрива от родителите.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, Send, Link2, Paperclip, Copy, Check, MonitorSmartphone, X, ExternalLink, EyeOff, Eye, FileDown, MessageCircle,
  CircleCheck, Square, RotateCcw, Library, Trash2, Users, User, QrCode, Ban, RefreshCw, UserPlus, Phone, CalendarDays,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import DateInput from '@/components/ui/DateInput'
import { LibraryPicker } from '@/app/students/[id]/room/OnlineRoomTab'
import { MSG_LABEL, seenBy } from '@/lib/class-rooms'
import { generateClassRoomChronology } from '@/lib/docx-class-room'
import { closeClassRoom, reopenClassRoom, extendClassRoom, deleteEmptyRoom, syncMembers, stopLink, newLink } from '../actions'

const PUBLIC_BASE = process.env.NEXT_PUBLIC_PUBLIC_URL || 'https://is.csop-varna.bg'
const MAX_MB = 20

type Room = { id: string; className: string; from: string; to: string; reason: string | null; closedAt: string | null; toBeforeClose: string | null }
type Member = { id: string; studentId: string; token: string; revokedAt: string | null; firstName: string; name: string; active: boolean; guardians: { name: string; relation: string; phone: string | null }[] }
type Post = { id: string; student_id: string | null; author_id: string | null; subject: string | null; body: string | null; link_url: string | null; file_path: string | null; file_name: string | null; material_id: string | null; created_at: string; hidden_at: string | null; hidden_by: string | null }
type Msg = { id: string; post_id: string; member_id: string; from_parent: boolean; author_id: string | null; kind: string; body: string | null; read_at: string | null; created_at: string }

const fmt = (d: string) => d.split('-').reverse().join('.')
const when = (d: string) => new Date(d).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function ClassRoomClient({ room, live, upcoming, meId, isManager, canManage, members, missing, subjects }: {
  room: Room; live: boolean; upcoming: boolean; meId: string; isManager: boolean; canManage: boolean
  members: Member[]; missing: number; subjects: string[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  const canPost = live || upcoming
  const [tab, setTab] = useState<'posts' | 'links'>('posts')
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [visits, setVisits] = useState<Record<string, string[]>>({})   // member_id → времена на отваряне
  const [names, setNames] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  const memberById = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members])
  const memberByStudent = useMemo(() => Object.fromEntries(members.map(m => [m.studentId, m])), [members])
  const linkMembers = useMemo(() => members.filter(m => !m.revokedAt), [members])

  const load = useCallback(async () => {
    const [ps, ms, vs] = await Promise.all([
      supabase.from('class_room_posts').select('id, student_id, author_id, subject, body, link_url, file_path, file_name, material_id, created_at, hidden_at, hidden_by')
        .eq('room_id', room.id).order('created_at', { ascending: false }),
      supabase.from('class_room_messages').select('id, post_id, member_id, from_parent, author_id, kind, body, read_at, created_at').eq('room_id', room.id).order('created_at'),
      supabase.from('class_room_visits').select('member_id, visited_at').eq('room_id', room.id).order('visited_at'),
    ])
    if (ps.error || ms.error) { setErr('Стаите още не са подготвени в базата — пуснете SQL файла 2026-10-17_class_rooms.sql.'); return }
    const P = (ps.data || []) as Post[]
    const M = (ms.data || []) as Msg[]
    setPosts(P); setMsgs(M)
    const v: Record<string, string[]> = {}
    ;(vs.data || []).forEach((r: any) => { (v[r.member_id] = v[r.member_id] || []).push(r.visited_at) })
    setVisits(v)
    const ids = Array.from(new Set([...P, ...M].flatMap((p: any) => [p.author_id, p.hidden_by]).filter(Boolean))) as string[]
    if (ids.length) {
      const { data: st } = await supabase.from('staff_profiles').select('id, first_name, last_name').in('id', ids)
      const n: Record<string, string> = {}
      ;(st || []).forEach((s: any) => { n[s.id] = `${s.first_name} ${s.last_name}` })
      setNames(n)
    }
    // въпросите към МОИТЕ публикации — прочетени (ръководството, което само разглежда, не ги „изяжда“)
    const mine = new Set(P.filter(p => p.author_id === meId).map(p => p.id))
    const unread = M.filter(m => m.from_parent && !m.read_at && mine.has(m.post_id)).map(m => m.id)
    if (unread.length) await supabase.from('class_room_messages').update({ read_at: new Date().toISOString() }).in('id', unread)
  }, [room.id, meId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // към кого е публикацията → кои линкове се броят за „видели“
  const targetsOf = useCallback((p: Post) => p.student_id
    ? (memberByStudent[p.student_id] && !memberByStudent[p.student_id].revokedAt ? [memberByStudent[p.student_id].id] : [])
    : linkMembers.map(m => m.id), [memberByStudent, linkMembers])

  async function act(fn: () => Promise<any>, ok: string) {
    setBusy(true)
    const r = await fn()
    setBusy(false)
    if (r?.error) { toast(r.error, 'error'); return false }
    toast(ok); router.refresh(); return true
  }

  async function exportChronology() {
    if (!posts) return
    setExporting(true)
    try {
      await generateClassRoomChronology({
        className: room.className, from: room.from, to: room.to, reason: room.reason,
        posts: [...posts].reverse().map(p => {
          const t = targetsOf(p)
          const seen = seenBy(p.created_at, t, visits)
          return {
            at: p.created_at, author: (p.author_id && names[p.author_id]) || '—', subject: p.subject || '',
            target: p.student_id ? (memberByStudent[p.student_id]?.name || 'едно дете') : 'цялата паралелка',
            body: p.body || '', link: p.link_url || '', file: p.file_name || '',
            hidden: p.hidden_at ? `скрита от родителите ${when(p.hidden_at)}${p.hidden_by && names[p.hidden_by] ? ` (${names[p.hidden_by]})` : ''}` : '',
            seen: seen.length, of: t.length, seenNames: seen.map(id => memberById[id]?.name || ''),
            thread: msgs.filter(m => m.post_id === p.id).map(m => ({
              at: m.created_at,
              who: m.from_parent ? `Родител на ${memberById[m.member_id]?.name || '—'}` : `${(m.author_id && names[m.author_id]) || 'Учител'} → родител на ${memberById[m.member_id]?.firstName || '—'}`,
              text: [MSG_LABEL[m.kind], m.body].filter(Boolean).join(' — '),
            })),
          }
        }),
        parents: members.map(m => {
          const v = visits[m.id] || []
          return { name: m.name, visits: v.length, first: v[0] || null, last: v[v.length - 1] || null, stopped: !!m.revokedAt }
        }),
      })
    } catch { toast('Грешка при генериране', 'error') }
    setExporting(false)
  }

  if (err) return <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">{err}</div>

  const unreadTotal = msgs.filter(m => m.from_parent && !m.read_at && m.kind !== 'ok').length

  return (
    <div className="space-y-4">
      <Header room={room} live={live} upcoming={upcoming} isManager={isManager} busy={busy} exporting={exporting}
        hasPosts={(posts || []).length > 0} onExport={exportChronology}
        onClose={() => confirm('Да се затвори ли стаята днес? Линковете на родителите спират веднага. Хронологията остава.') && act(() => closeClassRoom(room.id), 'Стаята е затворена')}
        onReopen={() => confirm('Да се отвори ли стаята отново? Линковете ще работят пак.') && act(() => reopenClassRoom(room.id), 'Стаята е отворена отново')}
        onExtend={(to: string) => act(() => extendClassRoom(room.id, to), 'Крайната дата е променена')}
        onDelete={async () => {
          if (!confirm('Да се изтрие ли стаята? Само ако е отворена по грешка — в нея няма публикации.')) return
          setBusy(true); const r: any = await deleteEmptyRoom(room.id); setBusy(false)
          if (r?.error) { toast(r.error, 'error'); return }
          toast('Стаята е изтрита'); router.push('/rooms')
        }} />

      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {([['posts', 'Материали', posts?.length], ['links', 'Родители и линкове', linkMembers.length]] as const).map(([k, l, n]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-lg text-[13px] transition-all ${tab === k ? 'bg-white text-[#0f2240] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
            {l}{typeof n === 'number' ? ` (${n})` : ''}{k === 'posts' && unreadTotal > 0 ? ` · ${unreadTotal} нови въпроса` : ''}
          </button>
        ))}
      </div>

      {tab === 'posts' ? (
        <>
          {canPost && <Composer roomId={room.id} meId={meId} members={members} subjects={subjects} upcoming={upcoming} onDone={load} />}
          <Feed posts={posts} msgs={msgs} names={names} visits={visits} members={members} memberById={memberById} memberByStudent={memberByStudent}
            targetsOf={targetsOf} live={live} canPost={canPost} meId={meId} isManager={isManager} roomId={room.id} onChange={load} />
        </>
      ) : (
        <Links room={room} members={members} visits={visits} canManage={canManage} live={live || upcoming} missing={missing}
          onStop={(m) => confirm(`Да се спре ли линкът на ${m.name}? Родителят няма да може да влиза, докато не му дадете нов.`) && act(() => stopLink(m.id, room.id), 'Линкът е спрян')}
          onNew={(m) => confirm(`Нов линк за ${m.name}? Старият спира да работи — изпратете новия на родителя.`) && act(() => newLink(m.id, room.id), 'Готово — изпратете новия линк')}
          onSync={() => act(() => syncMembers(room.id), 'Новите деца са добавени')} />
      )}
    </div>
  )
}

// ── Заглавие: период, състояние, хронология, управление ──
function Header({ room, live, upcoming, isManager, busy, exporting, hasPosts, onExport, onClose, onReopen, onExtend, onDelete }: any) {
  const [editTo, setEditTo] = useState(false)
  const [to, setTo] = useState(room.to)
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <MonitorSmartphone size={18} className={live ? 'text-sky-600' : 'text-slate-400'} />
        <h1 className="text-xl font-light text-[#0f2240]">Паралелка {room.className} · онлайн стая</h1>
        {live ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">отворена</span>
          : upcoming ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">предстои — може да подготвите материали</span>
          : <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">{room.closedAt ? `затворена ${when(room.closedAt)}` : 'приключила'} — само преглед</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <span className="text-[13px] text-slate-600">{fmt(room.from)} – {fmt(room.to)}{room.reason ? ` · ${room.reason}` : ''}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={onExport} disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240] disabled:opacity-50">
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} Хронология
          </button>
          {isManager && (live || upcoming) && !editTo && (
            <button type="button" onClick={() => setEditTo(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240]">
              <CalendarDays size={13} /> Крайна дата
            </button>
          )}
          {isManager && live && (
            <button type="button" onClick={onClose} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-[13px] text-rose-700 hover:bg-rose-50 disabled:opacity-50">
              <Square size={12} /> Затвори стаята
            </button>
          )}
          {isManager && !live && !upcoming && room.closedAt && (
            <button type="button" onClick={onReopen} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240] disabled:opacity-50">
              <RotateCcw size={13} /> Отвори отново
            </button>
          )}
          {isManager && !hasPosts && (
            <button type="button" onClick={onDelete} disabled={busy} title="Само за стая, отворена по грешка — без публикации"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] text-slate-400 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50">
              <Trash2 size={13} /> Изтрий
            </button>
          )}
        </div>
      </div>
      {editTo && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          <span className="text-[12px] text-slate-500">Нова крайна дата</span>
          <DateInput value={to} onChange={setTo} min={room.from} />
          <button type="button" disabled={busy || !to} onClick={async () => { if (await onExtend(to)) setEditTo(false) }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-[13px] disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            <Check size={13} /> Запази
          </button>
          <button type="button" onClick={() => setEditTo(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={15} /></button>
        </div>
      )}
    </div>
  )
}

// ── Нова публикация ──
function Composer({ roomId, meId, members, subjects, upcoming, onDone }: { roomId: string; meId: string; members: Member[]; subjects: string[]; upcoming: boolean; onDone: () => void }) {
  const supabase = createClient()
  const { toast } = useToast()
  const [target, setTarget] = useState('')            // '' = цялата паралелка, иначе student_id
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [picker, setPicker] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const kids = members.filter(m => !m.revokedAt)

  function reset() { setBody(''); setLink(''); setFile(null); if (fileRef.current) fileRef.current.value = '' }

  async function publish() {
    const url = link.trim()
    if (!body.trim() && !url && !file) { toast('Напишете указания, добавете линк или файл', 'error'); return }
    if (url && !/^https?:\/\//i.test(url)) { toast('Линкът трябва да започва с http:// или https://', 'error'); return }
    if (file && file.size > MAX_MB * 1024 * 1024) { toast(`Файлът е над ${MAX_MB} MB`, 'error'); return }
    setBusy(true)
    let file_path: string | null = null
    if (file) {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
      file_path = `class/${roomId}/${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('online-room').upload(file_path, file, { contentType: file.type || undefined })
      if (up.error) { setBusy(false); toast('Грешка при качване: ' + up.error.message, 'error'); return }
    }
    const { error } = await supabase.from('class_room_posts').insert({
      room_id: roomId, student_id: target || null, author_id: meId, subject: subject.trim() || null,
      body: body.trim() || null, link_url: url || null, file_path, file_name: file?.name || null,
    })
    setBusy(false)
    if (error) { toast('Грешка: ' + error.message, 'error'); return }
    reset()
    toast(target ? 'Публикувано — вижда го само родителят на детето' : 'Публикувано за цялата паралелка')
    onDone()
  }

  async function pickMaterial(m: any) {
    const { error } = await supabase.from('class_room_posts').insert({
      room_id: roomId, student_id: target || null, author_id: meId, subject: subject.trim() || null,
      body: body.trim() || [m.title, m.description].filter(Boolean).join(' — '), link_url: null,
      file_path: null, file_name: m.file_name, material_id: m.id,
    })
    if (error) { toast('Грешка: ' + error.message, 'error'); return }
    setBody(''); setPicker(false)
    toast('Материалът е публикуван')
    onDone()
  }

  const forKid = kids.find(k => k.studentId === target)
  return (
    <div className={`bg-white rounded-2xl border shadow-sm px-5 py-4 space-y-3 ${forKid ? 'border-violet-200' : 'border-slate-200'}`}>
      {upcoming && <p className="text-[12px] text-violet-700">Стаята още не е започнала — родителите ще видят публикациите от първия ден.</p>}
      <div className="flex flex-wrap items-center gap-2">
        {/* за кого: плъзгащ превключвател „Цялата паралелка | Едно дете“ */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl">
          <button type="button" onClick={() => setTarget('')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${!target ? 'bg-white text-[#0f2240] shadow-sm ring-1 ring-slate-200' : 'text-slate-500'}`}>
            <Users size={13} /> Цялата паралелка
          </button>
          <button type="button" onClick={() => setTarget(target || kids[0]?.studentId || '')} disabled={!kids.length}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${target ? 'bg-white text-violet-800 shadow-sm ring-1 ring-violet-200' : 'text-slate-500'}`}>
            <User size={13} /> Само за едно дете
          </button>
        </div>
        {target && (
          <select value={target} onChange={e => setTarget(e.target.value)}
            className="px-3 py-1.5 border border-violet-200 rounded-xl text-[13px] text-violet-900 bg-violet-50/50 focus:outline-none">
            {kids.map(k => <option key={k.studentId} value={k.studentId}>{k.name}</option>)}
          </select>
        )}
        <input value={subject} onChange={e => setSubject(e.target.value)} list="class-room-subjects" placeholder="Предмет / дейност (по желание)"
          className="flex-1 min-w-[200px] px-3 py-1.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-[#0f2240]" />
        <datalist id="class-room-subjects">{subjects.map(s => <option key={s} value={s} />)}</datalist>
      </div>
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
        placeholder={forKid ? `Указания само за родителя на ${forKid.firstName}…` : 'Указания за родителите — какво да направят днес, как, колко време…'}
        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0f2240] resize-y" />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[220px] px-3 py-2 border border-slate-200 rounded-xl focus-within:border-[#0f2240]">
          <Link2 size={14} className="text-slate-400 shrink-0" />
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="Линк (клип, файл в Drive) — по желание"
            className="flex-1 min-w-0 text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none" />
        </div>
        <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
        {file ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-700 max-w-[260px]">
            <Paperclip size={13} /> <span className="truncate">{file.name}</span>
            <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }} className="text-slate-400 hover:text-slate-700"><X size={13} /></button>
          </span>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240]">
            <Paperclip size={14} /> Файл
          </button>
        )}
        <button type="button" onClick={() => setPicker(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 text-[13px] text-emerald-800 hover:bg-emerald-50">
          <Library size={14} /> От библиотеката
        </button>
        <button type="button" onClick={publish} disabled={busy}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Публикувай
        </button>
      </div>
      {picker && <LibraryPicker onClose={() => setPicker(false)} onPick={pickMaterial} />}
    </div>
  )
}

// ── Лентата с публикациите ──
function Feed({ posts, msgs, names, visits, members, memberById, memberByStudent, targetsOf, live, canPost, meId, isManager, roomId, onChange }: {
  posts: Post[] | null; msgs: Msg[]; names: Record<string, string>; visits: Record<string, string[]>; members: Member[]
  memberById: Record<string, Member>; memberByStudent: Record<string, Member>; targetsOf: (p: Post) => string[]
  live: boolean; canPost: boolean; meId: string; isManager: boolean; roomId: string; onChange: () => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [subj, setSubj] = useState('')
  const [kid, setKid] = useState('')
  const [openSeen, setOpenSeen] = useState<string | null>(null)

  const usedSubjects = useMemo(() => Array.from(new Set((posts || []).map(p => p.subject).filter(Boolean))) as string[], [posts])
  const shown = (posts || []).filter(p => (!subj || p.subject === subj) && (!kid || !p.student_id || p.student_id === kid))

  async function toggleHidden(p: Post) {
    const hide = !p.hidden_at
    if (hide && !confirm('Да се скрие ли от родителите? В хронологията остава.')) return
    const { error } = await supabase.from('class_room_posts')
      .update(hide ? { hidden_at: new Date().toISOString(), hidden_by: meId } : { hidden_at: null, hidden_by: null }).eq('id', p.id)
    if (error) { toast(error.message, 'error'); return }
    onChange()
  }

  async function openFile(p: Post) {
    let bucket = 'online-room', path = p.file_path
    if (p.material_id) {
      const { data: m } = await supabase.from('materials').select('file_path').eq('id', p.material_id).maybeSingle()
      if (m?.file_path) { bucket = 'materials'; path = m.file_path }
    }
    if (!path) { toast('Файлът вече не е наличен', 'error'); return }
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function reply(p: Post, memberId: string, text: string) {
    const { error } = await supabase.from('class_room_messages').insert({ post_id: p.id, room_id: roomId, member_id: memberId, from_parent: false, author_id: meId, kind: 'text', body: text.slice(0, 500) })
    if (error) { toast('Грешка: ' + error.message, 'error'); return false }
    onChange(); return true
  }

  if (posts === null) return <div className="flex justify-center py-8 text-slate-400"><Loader2 className="animate-spin" size={20} /></div>
  if (!posts.length) return <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-400">Още няма публикации.</div>

  return (
    <div className="space-y-3">
      {(usedSubjects.length > 1 || members.length > 1) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {usedSubjects.length > 1 && <>
            <button type="button" onClick={() => setSubj('')} className={`px-2.5 py-1 rounded-full text-[12px] border ${!subj ? 'border-[#0f2240] text-[#0f2240] bg-white' : 'border-slate-200 text-slate-500'}`}>Всички предмети</button>
            {usedSubjects.map(s => (
              <button key={s} type="button" onClick={() => setSubj(s === subj ? '' : s)} className={`px-2.5 py-1 rounded-full text-[12px] border ${subj === s ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>{s}</button>
            ))}
          </>}
          <select value={kid} onChange={e => setKid(e.target.value)} className="ml-auto px-3 py-1 border border-slate-200 rounded-xl text-[12px] text-slate-600 bg-white">
            <option value="">Всички деца</option>
            {members.map(m => <option key={m.studentId} value={m.studentId}>{m.name}</option>)}
          </select>
        </div>
      )}

      {shown.map(p => {
        const t = targetsOf(p)
        const seen = seenBy(p.created_at, t, visits)
        const seenSet = new Set(seen)
        const th = msgs.filter(m => m.post_id === p.id)
        const byMember: Record<string, Msg[]> = {}
        th.forEach(m => { (byMember[m.member_id] = byMember[m.member_id] || []).push(m) })
        const fresh = th.some(m => m.from_parent && !m.read_at && m.kind !== 'ok')
        const forKid = p.student_id ? memberByStudent[p.student_id] : null
        return (
          <div key={p.id} className={`border rounded-2xl px-5 py-3.5 shadow-[0_1px_4px_rgba(15,34,64,0.06)] ${p.hidden_at ? 'bg-slate-50 border-slate-200 opacity-70' : fresh ? 'bg-white border-amber-300' : forKid ? 'bg-white border-violet-200' : 'bg-white border-slate-200'}`}>
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500 mb-1">
              <span>{when(p.created_at)}</span>
              <span className="text-slate-300">·</span>
              <span>{(p.author_id && names[p.author_id]) || '—'}</span>
              {p.subject && <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-100">{p.subject}</span>}
              {forKid
                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-800 border border-violet-100"><User size={11} /> само за {forKid.name}</span>
                : <span className="inline-flex items-center gap-1 text-slate-400"><Users size={11} /> цялата паралелка</span>}
              {p.hidden_at
                ? <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">скрита {when(p.hidden_at)}{p.hidden_by && names[p.hidden_by] ? ` · ${names[p.hidden_by]}` : ''}</span>
                : <button type="button" onClick={() => setOpenSeen(openSeen === p.id ? null : p.id)}
                    className={`inline-flex items-center gap-1 hover:underline ${seen.length && seen.length === t.length ? 'text-emerald-700' : seen.length ? 'text-slate-600' : 'text-slate-400'}`}>
                    <CircleCheck size={12} /> {forKid ? (seen.length ? 'видяно' : 'още не е видяно') : `видели ${seen.length} от ${t.length}`}
                  </button>}
              {canPost && (p.author_id === meId || isManager) && (
                <button type="button" onClick={() => toggleHidden(p)} title={p.hidden_at ? 'Покажи отново на родителите' : 'Скрий от родителите (остава в хронологията)'}
                  className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                  {p.hidden_at ? <><Eye size={13} /> покажи</> : <><EyeOff size={13} /> скрий</>}
                </button>
              )}
            </div>
            {openSeen === p.id && !forKid && (
              <div className="text-[12px] mb-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 leading-relaxed">
                <span className="text-emerald-700">Видели: </span>{seen.map(id => memberById[id]?.name).join(', ') || '—'}
                <br /><span className="text-slate-500">Още не: </span>{t.filter(id => !seenSet.has(id)).map(id => memberById[id]?.name).join(', ') || '—'}
              </div>
            )}
            {p.body && <p className="text-[14px] text-slate-800 whitespace-pre-line leading-relaxed">{p.body}</p>}
            <div className="flex flex-wrap gap-2 mt-1.5">
              {p.link_url && <a href={p.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-sky-700 hover:underline max-w-full"><ExternalLink size={13} /> <span className="truncate">{p.link_url}</span></a>}
              {(p.file_path || p.material_id) && <button type="button" onClick={() => openFile(p)} className="inline-flex items-center gap-1 text-[13px] text-sky-700 hover:underline"><Paperclip size={13} /> {p.file_name || 'файл'}</button>}
            </div>
            {Object.keys(byMember).length > 0 && (
              <div className="mt-2.5 space-y-2">
                {Object.entries(byMember).map(([mid, list]) => (
                  <Thread key={mid} who={memberById[mid]?.firstName || '—'} msgs={list} names={names} canReply={live && !p.hidden_at} onReply={t => reply(p, mid, t)} />
                ))}
              </div>
            )}
          </div>
        )
      })}
      {!shown.length && <div className="text-center text-sm text-slate-400 py-6">Няма публикации по този филтър.</div>}
    </div>
  )
}

// ── Разговорът с родителя на едно дете под публикацията (вижда го само той) ──
function Thread({ who, msgs, names, canReply, onReply }: { who: string; msgs: Msg[]; names: Record<string, string>; canReply: boolean; onReply: (t: string) => Promise<boolean> }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const hasParent = msgs.some(m => m.from_parent)
  return (
    <div className="pl-3 border-l-2 border-slate-100 space-y-1.5">
      <div className="text-[11px] uppercase tracking-widest text-slate-400">Родителят на {who}</div>
      {msgs.map(m => (
        <div key={m.id} className={`text-[13px] px-3 py-2 rounded-xl ${m.from_parent ? (m.kind === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900') : 'bg-sky-50 text-slate-800'}`}>
          <span className="text-[11.5px] opacity-70">{m.from_parent ? 'Родител' : ((m.author_id && names[m.author_id]) || 'Учител')} · {when(m.created_at)}{m.from_parent && !m.read_at && m.kind !== 'ok' ? ' · ново' : ''}</span>
          <div className="whitespace-pre-line">{[MSG_LABEL[m.kind], m.body].filter(Boolean).join(' — ')}</div>
        </div>
      ))}
      {canReply && hasParent && (
        <div className="flex gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-1.5 border border-slate-200 rounded-xl focus-within:border-[#0f2240]">
            <MessageCircle size={13} className="text-slate-400 shrink-0" />
            <input value={text} onChange={e => setText(e.target.value.slice(0, 500))} placeholder={`Отговор само към родителя на ${who}…`}
              className="flex-1 min-w-0 text-[13px] focus:outline-none" />
          </div>
          <button type="button" disabled={busy || !text.trim()} onClick={async () => { setBusy(true); if (await onReply(text.trim())) setText(''); setBusy(false) }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-white text-[13px] disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Отговори
          </button>
        </div>
      )}
    </div>
  )
}

// ── Родители и линкове ──
function Links({ room, members, visits, canManage, live, missing, onStop, onNew, onSync }: {
  room: Room; members: Member[]; visits: Record<string, string[]>; canManage: boolean; live: boolean; missing: number
  onStop: (m: Member) => void; onNew: (m: Member) => void; onSync: () => void
}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState<string | null>(null)
  const url = (m: Member) => `${PUBLIC_BASE}/room/${m.token}`
  const viberText = (m: Member) => `Здравейте! Това е личният линк за онлайн стаята на ${m.firstName} в ЦСОП Варна (до ${fmt(room.to)}): ${url(m)} — моля, не го споделяйте с други родители.`

  async function copy(m: Member) {
    try { await navigator.clipboard.writeText(viberText(m)); setCopied(m.id); setTimeout(() => setCopied(null), 2000) }
    catch { toast('Копирайте линка ръчно', 'error') }
  }

  return (
    <div className="space-y-3">
      <div className="bg-sky-50/60 border border-sky-100 rounded-2xl px-4 py-3 text-[13px] text-slate-700 leading-relaxed">
        Изпратете всеки линк <b className="font-medium">лично</b> на родителя на детето (Viber, SMS) — не в обща група: по линка разбираме кой родител е влязъл и кой пита.
        Ако линк попадне при чужд човек — „Спри“, после „Нов линк“ само за това дете.
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a href={`/rooms/${room.id}/print`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240] bg-white">
          <QrCode size={14} /> Лист с QR кодове за печат
        </a>
        {canManage && live && missing > 0 && (
          <button type="button" onClick={onSync} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 text-[13px] text-emerald-800 hover:bg-emerald-50">
            <UserPlus size={14} /> Добави новите деца ({missing})
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
        {members.map((m, i) => {
          const v = visits[m.id] || []
          return (
            <div key={m.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${i % 2 ? 'bg-slate-50/40' : ''} ${m.revokedAt ? 'opacity-60' : ''}`}>
              <div className="min-w-[180px] flex-1">
                <div className="text-[14px] text-slate-800">{m.name}{!m.active && <span className="text-[11px] text-slate-400"> · неактивно</span>}</div>
                <div className="text-[12px] text-slate-500 flex flex-wrap gap-x-3">
                  {m.guardians.length ? m.guardians.map((g, k) => (
                    <span key={k} className="inline-flex items-center gap-1">{g.relation} {g.name}{g.phone && <a href={`tel:${g.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-0.5 text-emerald-800 hover:underline tabular-nums"><Phone size={11} /> {g.phone}</a>}</span>
                  )) : <span className="text-slate-400">няма въведен родител</span>}
                </div>
              </div>
              <div className="text-[12px] text-slate-500 w-40">
                {m.revokedAt ? <span className="text-rose-700">линкът е спрян</span>
                  : v.length ? <>отворил {v.length} пъти<br />последно {when(v[v.length - 1])}</> : <span className="text-slate-400">още не е отварял</span>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {!m.revokedAt && live && <>
                  <button type="button" onClick={() => copy(m)} title="Копира съобщение с линка"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-[12px] text-slate-700 hover:border-[#0f2240]">
                    {copied === m.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />} {copied === m.id ? 'Копирано' : 'Копирай'}
                  </button>
                  <a href={`viber://forward?text=${encodeURIComponent(viberText(m))}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-violet-200 text-[12px] text-violet-800 hover:bg-violet-50">
                    <Send size={12} /> Viber
                  </a>
                </>}
                {canManage && live && (m.revokedAt
                  ? <button type="button" onClick={() => onNew(m)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-[12px] text-slate-700 hover:border-[#0f2240]"><RefreshCw size={12} /> Нов линк</button>
                  : <>
                      <button type="button" onClick={() => onNew(m)} title="Нов линк — старият спира" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><RefreshCw size={13} /></button>
                      <button type="button" onClick={() => onStop(m)} title="Спри линка" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50"><Ban size={13} /></button>
                    </>)}
              </div>
            </div>
          )
        })}
        {!members.length && <div className="px-4 py-8 text-center text-sm text-slate-400">В стаята няма деца.</div>}
      </div>
    </div>
  )
}
