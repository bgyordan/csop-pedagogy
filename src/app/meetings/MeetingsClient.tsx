'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Landmark, Plus, X, Loader2, Check, CalendarDays, Clock, MapPin, ListOrdered, Gavel, BookOpen, Download,
  ChevronRight, AlertTriangle, Users, Sparkles, CircleCheck, Send, Undo2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { notify, confirmDialog } from '@/components/ui/Toast'
import DateInput from '@/components/ui/DateInput'
import {
  BODY_LABEL, BODY_SHORT, BODY_TONE, STATUS_LABEL, STATUS_TONE, TASK_LABEL, TASK_TONE, PS_PRESETS, OS_PRESETS,
  defaultQuorum, defaultMembers, protocolDue, dmy, hm, todayIso, weekday, monthShort, fullName,
  type Body, type Meeting, type Person, type TaskStatus,
} from '@/lib/meetings'

type Year = { id: string; name: string; is_current: boolean }
type ItemRow = { id: string; meeting_id: string; sort: number; title: string }
type TaskRow = {
  id: string; meeting_id: string; item_id: string | null; sort: number; text: string; responsible_id: string | null; due_date: string | null
  task_status: TaskStatus; report: string | null; reported_at: string | null; review_note: string | null
  meeting: { id: string; body: Body; meeting_no: number | null; meeting_date: string; status: string }
}
type Staff = Person & { is_active?: boolean }

const NAVY = '#0f2240'

export default function MeetingsClient(props: {
  me: { id: string; role: string; name: string }; isManager: boolean; tab: string; body: 'all' | Body
  years: Year[]; year: Year | null; meetings: Meeting[]; items: ItemRow[]; decCounts: { id: string; meeting_id: string }[]
  tasks: TaskRow[]; people: Staff[]
}) {
  const { me, isManager, years, year, meetings, items, decCounts, people } = props
  const router = useRouter()
  const [tab, setTab] = useState(props.tab)
  const [body, setBody] = useState<'all' | Body>(props.body)
  const [showNew, setShowNew] = useState(false)
  const [tasks, setTasks] = useState(props.tasks)
  const today = todayIso()
  const byId = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people])

  const visible = meetings.filter(m => body === 'all' || m.body === body)
  const upcoming = visible.filter(m => m.meeting_date >= today && m.status === 'planned').sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))
  const next = upcoming[0]
  const itemsOf = (id: string) => items.filter(i => i.meeting_id === id)
  const decOf = (id: string) => decCounts.filter(d => d.meeting_id === id).length
  const overdueTasks = tasks.filter(t => (t.task_status === 'open' || t.task_status === 'not_done') && t.due_date && t.due_date < today).length
  const myOpen = tasks.filter(t => t.responsible_id === me.id && t.task_status === 'open').length

  function go(nextTab: string) {
    setTab(nextTab)
    const u = new URL(window.location.href); u.searchParams.set('tab', nextTab); window.history.replaceState(null, '', u.toString())
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      {/* Заглавие */}
      <header className="relative overflow-hidden rounded-3xl mb-6 text-white shadow-[0_10px_40px_-12px_rgba(15,34,64,0.45)]"
        style={{ background: 'linear-gradient(135deg, #0f2240 0%, #1a3560 55%, #24497f 100%)' }}>
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full opacity-[0.08] bg-white" />
        <div className="absolute right-24 -bottom-24 w-56 h-56 rounded-full opacity-[0.06] bg-white" />
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-end gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-white/10 ring-1 ring-white/20"><Landmark size={21} /></span>
              <div>
                <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Педагогически съвет и Общо събрание</h1>
                <p className="text-sm text-white/70 mt-0.5">Дневен ред, присъствие и кворум, решения с гласуване, Книга с протоколите</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              <Stat label="заседания" value={visible.length} />
              <Stat label="предстоящи" value={upcoming.length} />
              <Stat label="решения за изпълнение" value={tasks.filter(t => t.task_status === 'open' || t.task_status === 'reported').length} />
              {overdueTasks > 0 && <Stat label="просрочени" value={overdueTasks} warn />}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {years.length > 1 && (
              <select value={year?.id || ''} onChange={e => router.push(`/meetings?y=${e.target.value}&tab=${tab}`)}
                className="text-sm rounded-xl bg-white/10 ring-1 ring-white/20 px-3 py-2.5 text-white focus:outline-none [&>option]:text-slate-800">
                {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            )}
            {isManager && (
              <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-[#0f2240] text-sm font-semibold hover:bg-blue-50 shadow-sm">
                <Plus size={16} /> Ново заседание
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Раздели и филтър */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="inline-flex p-1 rounded-2xl bg-white border border-slate-200 shadow-sm">
          {[
            { k: 'meetings', l: 'Заседания', i: <CalendarDays size={15} /> },
            { k: 'decisions', l: 'Решения', i: <Gavel size={15} />, n: isManager ? overdueTasks : myOpen },
            { k: 'book', l: 'Книга', i: <BookOpen size={15} /> },
          ].map(x => (
            <button key={x.k} onClick={() => go(x.k)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm transition-all ${tab === x.k ? 'bg-[#0f2240] text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}>
              {x.i} {x.l}
              {!!x.n && <span className={`ml-0.5 text-[10px] px-1.5 rounded-full ${tab === x.k ? 'bg-white/20' : 'bg-rose-100 text-rose-700'}`}>{x.n}</span>}
            </button>
          ))}
        </div>
        {tab !== 'decisions' && (
          <div className="sm:ml-auto inline-flex p-1 rounded-2xl bg-white border border-slate-200">
            {(['all', 'ps', 'os'] as const).map(b => (
              <button key={b} onClick={() => setBody(b)}
                className={`px-3.5 py-1.5 rounded-xl text-sm ${body === b ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'}`}>
                {b === 'all' ? 'Всички' : BODY_LABEL[b]}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'meetings' && (
        <div className="space-y-6">
          {next && <NextCard m={next} items={itemsOf(next.id)} byId={byId} today={today} />}
          <Timeline meetings={visible} itemsOf={itemsOf} decOf={decOf} today={today} isManager={isManager} onNew={() => setShowNew(true)} />
        </div>
      )}
      {tab === 'decisions' && <Decisions tasks={tasks} setTasks={setTasks} byId={byId} me={me} isManager={isManager} today={today} />}
      {tab === 'book' && <Book meetings={visible.filter(m => m.status === 'final')} body={body} year={year} people={people} />}

      {showNew && <NewMeeting onClose={() => setShowNew(false)} me={me} people={people} year={year} />}
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl text-sm ring-1 ${warn ? 'bg-rose-500/20 ring-rose-300/40' : 'bg-white/10 ring-white/15'}`}>
      <b className="text-base tabular-nums">{value}</b><span className="text-white/75">{label}</span>
    </span>
  )
}

function BodyBadge({ body, small }: { body: Body; small?: boolean }) {
  const t = BODY_TONE[body]
  return <span className={`inline-flex items-center rounded-full font-semibold ${small ? 'text-[10px] px-1.5 py-0' : 'text-[11px] px-2 py-0.5'}`} style={{ background: t.bg, color: t.fg }}>{BODY_SHORT[body]}</span>
}

// ── предстоящото заседание ──
function NextCard({ m, items, byId, today }: { m: Meeting; items: ItemRow[]; byId: Record<string, Person>; today: string }) {
  const days = Math.round((Date.parse(m.meeting_date) - Date.parse(today)) / 86400000)
  const t = BODY_TONE[m.body]
  return (
    <Link href={`/meetings/${m.id}`} className="block group">
      <div className="relative rounded-3xl bg-white border border-slate-200 shadow-[0_2px_12px_rgba(15,34,64,0.06)] hover:shadow-[0_8px_30px_rgba(15,34,64,0.10)] transition-all overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: t.fg }} />
        <div className="p-5 md:p-6 pl-7 grid md:grid-cols-[auto,1fr] gap-6">
          <div className="flex md:flex-col items-center gap-3 md:gap-1 md:w-32 md:border-r md:border-slate-100 md:pr-6">
            <span className="text-[11px] uppercase tracking-widest text-slate-400">{days === 0 ? 'днес' : days === 1 ? 'утре' : `след ${days} дни`}</span>
            <span className="text-5xl font-semibold tabular-nums" style={{ color: t.fg }}>{Number(m.meeting_date.slice(8, 10))}</span>
            <span className="text-sm text-slate-500">{monthShort(m.meeting_date)} · {weekday(m.meeting_date)}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] uppercase tracking-widest text-slate-400">Предстоящо заседание</span>
              <BodyBadge body={m.body} />
              {m.kind === 'extraordinary' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">извънредно</span>}
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-slate-800 mt-1">{m.title || BODY_LABEL[m.body]}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-1.5">
              {m.start_time && <span className="inline-flex items-center gap-1"><Clock size={14} /> {hm(m.start_time)} ч.</span>}
              {m.place && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {m.place}</span>}
              {m.chair_id && byId[m.chair_id] && <span className="inline-flex items-center gap-1"><Users size={14} /> Председател: {fullName(byId[m.chair_id])}</span>}
            </div>
            {items.length > 0 && (
              <ol className="mt-4 space-y-1.5">
                {items.slice(0, 5).map((it, i) => (
                  <li key={it.id} className="flex gap-2.5 text-sm text-slate-700">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold shrink-0 mt-px" style={{ background: t.bg, color: t.fg }}>{i + 1}</span>
                    <span className="min-w-0">{it.title}</span>
                  </li>
                ))}
                {items.length > 5 && <li className="text-xs text-slate-400 pl-7">и още {items.length - 5} точки…</li>}
              </ol>
            )}
          </div>
        </div>
        <ChevronRight size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  )
}

// ── всички заседания по месеци ──
function Timeline({ meetings, itemsOf, decOf, today, isManager, onNew }: {
  meetings: Meeting[]; itemsOf: (id: string) => ItemRow[]; decOf: (id: string) => number; today: string; isManager: boolean; onNew: () => void
}) {
  if (!meetings.length) return (
    <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white/60 p-12 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mb-3"><Landmark size={24} /></div>
      <h3 className="text-base font-semibold text-slate-800">Още няма заседания за тази година</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Насрочете първото — с готов дневен ред за откриването на учебната година, поименен списък на членовете и покана.</p>
      {isManager && <button onClick={onNew} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: NAVY }}><Plus size={16} /> Ново заседание</button>}
    </div>
  )
  const groups: { key: string; label: string; list: Meeting[] }[] = []
  for (const m of meetings) {
    const key = m.meeting_date.slice(0, 7)
    let g = groups.find(x => x.key === key)
    if (!g) { g = { key, label: new Date(m.meeting_date + 'T12:00:00Z').toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' }), list: [] }; groups.push(g) }
    g.list.push(m)
  }
  return (
    <div className="space-y-6">
      {groups.map(g => (
        <section key={g.key}>
          <h3 className="text-[11px] uppercase tracking-widest text-slate-400 mb-2 pl-1">{g.label}</h3>
          <div className="space-y-2.5">
            {g.list.map(m => {
              const its = itemsOf(m.id)
              const due = isManager ? protocolDue(m) : null
              const past = m.meeting_date < today
              const t = BODY_TONE[m.body]
              return (
                <Link key={m.id} href={`/meetings/${m.id}`}
                  className="group flex items-center gap-4 p-3.5 pr-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-[0_4px_18px_rgba(15,34,64,0.08)] hover:-translate-y-px transition-all">
                  <div className="w-14 shrink-0 text-center rounded-xl py-1.5" style={{ background: t.soft, boxShadow: `inset 0 0 0 1px ${t.ring}` }}>
                    <div className="text-xl font-semibold tabular-nums leading-tight" style={{ color: t.fg }}>{Number(m.meeting_date.slice(8, 10))}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{monthShort(m.meeting_date)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BodyBadge body={m.body} small />
                      <span className="text-[15px] font-medium text-slate-800 truncate">{m.title || BODY_LABEL[m.body]}</span>
                      {m.meeting_no && <span className="text-xs text-slate-400">Протокол № {m.meeting_no}</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3">
                      <span>{weekday(m.meeting_date)}{m.start_time ? `, ${hm(m.start_time)} ч.` : ''}</span>
                      <span className="inline-flex items-center gap-1"><ListOrdered size={12} /> {its.length} т.</span>
                      {decOf(m.id) > 0 && <span className="inline-flex items-center gap-1"><Gavel size={12} /> {decOf(m.id)} реш.</span>}
                    </div>
                  </div>
                  {due && past && (
                    <span className={`hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full shrink-0 ${due.left < 0 ? 'bg-rose-50 text-rose-700' : due.left <= 3 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}`}
                      title="Протоколът се изготвя до 10 дни от заседанието (чл. 41, ал. 6 от Наредба № 8)">
                      <AlertTriangle size={12} /> {due.left < 0 ? `протоколът закъснява с ${-due.left} д.` : `протокол до ${dmy(due.due)}`}
                    </span>
                  )}
                  <span className={`text-[11px] px-2 py-1 rounded-full border shrink-0 ${STATUS_TONE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

// ── решения за изпълнение ──
function Decisions({ tasks, setTasks, byId, me, isManager, today }: {
  tasks: TaskRow[]; setTasks: (f: (p: TaskRow[]) => TaskRow[]) => void; byId: Record<string, Person>
  me: { id: string }; isManager: boolean; today: string
}) {
  const supabase = createClient()
  const [filter, setFilter] = useState<'active' | 'overdue' | 'mine' | 'all'>(isManager ? 'active' : 'mine')
  const [reporting, setReporting] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const overdue = (t: TaskRow) => (t.task_status === 'open' || t.task_status === 'not_done') && !!t.due_date && t.due_date < today
  const list = tasks.filter(t =>
    filter === 'all' ? true : filter === 'overdue' ? overdue(t) : filter === 'mine' ? t.responsible_id === me.id : t.task_status === 'open' || t.task_status === 'reported')

  async function report(t: TaskRow) {
    setBusy(true)
    const { error } = await supabase.rpc('mtg_dec_report', { p_dec: t.id, p_report: text })
    setBusy(false)
    if (error) { notify(error.message); return }
    setTasks(p => p.map(x => x.id === t.id ? { ...x, task_status: 'reported', report: text.trim(), reported_at: new Date().toISOString() } : x))
    setReporting(null); setText(''); notify('Отчетът е изпратен', 'success')
  }
  async function review(t: TaskRow, status: TaskStatus) {
    let note: string | null = null
    if (status === 'not_done' && !await confirmDialog('Отбележи решението като неизпълнено?')) return
    const { error } = await supabase.rpc('mtg_dec_review', { p_dec: t.id, p_status: status, p_note: note })
    if (error) { notify(error.message); return }
    setTasks(p => p.map(x => x.id === t.id ? { ...x, task_status: status } : x))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {([
          ...(isManager ? [['active', 'Активни'], ['overdue', 'Просрочени']] : []),
          ['mine', 'Моите'], ['all', 'Всички'],
        ] as [typeof filter, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-sm border ${filter === k ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>{l}</button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white/60 p-12 text-center">
          <CircleCheck size={28} className="mx-auto text-emerald-500 mb-2" />
          <p className="text-sm text-slate-500">Няма решения в този изглед.</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {list.map(t => {
            const od = overdue(t)
            const mine = t.responsible_id === me.id
            return (
              <div key={t.id} className={`rounded-2xl bg-white border p-4 ${od ? 'border-rose-200' : 'border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <span className="inline-flex flex-col items-center justify-center w-12 h-12 rounded-xl shrink-0 text-center" style={{ background: BODY_TONE[t.meeting.body].soft, color: BODY_TONE[t.meeting.body].fg }}>
                    <span className="text-[10px] font-semibold">{BODY_SHORT[t.meeting.body]}</span>
                    <span className="text-xs font-semibold tabular-nums">№ {t.meeting.meeting_no}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 leading-relaxed">{t.text}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500">
                      <Link href={`/meetings/${t.meeting_id}`} className="hover:text-slate-800 hover:underline">Протокол № {t.meeting.meeting_no} / {dmy(t.meeting.meeting_date)}</Link>
                      {t.responsible_id && <span>Отговорник: <b className="font-medium text-slate-700">{fullName(byId[t.responsible_id])}</b></span>}
                      {t.due_date && <span className={od ? 'text-rose-600 font-medium' : ''}>Срок: {dmy(t.due_date)}{od ? ' — просрочено' : ''}</span>}
                    </div>
                    {t.report && <div className="mt-2 text-xs text-slate-600 bg-indigo-50/60 border border-indigo-100 rounded-xl px-3 py-2"><b className="font-medium">Отчет:</b> {t.report}</div>}
                    {reporting === t.id && (
                      <div className="mt-3 space-y-2">
                        <textarea value={text} onChange={e => setText(e.target.value)} rows={3} autoFocus placeholder="Какво е направено по решението…" className="input" />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setReporting(null)} className="btn-secondary">Отказ</button>
                          <button onClick={() => report(t)} disabled={busy || !text.trim()} className="btn-primary inline-flex items-center gap-1.5">{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Изпрати отчета</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${TASK_TONE[t.task_status]}`}>{TASK_LABEL[t.task_status]}</span>
                    {reporting !== t.id && (mine || isManager) && (t.task_status === 'open' || t.task_status === 'not_done') && (
                      <button onClick={() => { setReporting(t.id); setText(t.report || '') }} className="text-xs text-blue-700 hover:underline">Отчети</button>
                    )}
                    {isManager && t.task_status !== 'done' && (
                      <div className="flex gap-1">
                        <button onClick={() => review(t, 'done')} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><Check size={12} /> Изпълнено</button>
                        {t.task_status !== 'not_done' && <button onClick={() => review(t, 'not_done')} className="text-[11px] px-2 py-1 rounded-lg text-rose-700 hover:bg-rose-50">Неизпълнено</button>}
                      </div>
                    )}
                    {isManager && t.task_status === 'done' && <button onClick={() => review(t, 'open')} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700"><Undo2 size={12} /> Отвори отново</button>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Книга ──
function Book({ meetings, body, year, people }: { meetings: Meeting[]; body: 'all' | Body; year: Year | null; people: Staff[] }) {
  const supabase = createClient()
  const [busy, setBusy] = useState<Body | null>(null)
  const bodies: Body[] = body === 'all' ? ['ps', 'os'] : [body]

  async function download(b: Body) {
    const list = meetings.filter(m => m.body === b)
    if (!list.length) return
    setBusy(b)
    try {
      const ids = list.map(m => m.id)
      const [{ data: its }, { data: decs }, { data: att }] = await Promise.all([
        supabase.from('mtg_items').select('*').in('meeting_id', ids).order('sort'),
        supabase.from('mtg_decisions').select('*').in('meeting_id', ids).order('sort'),
        supabase.from('mtg_attendance').select('*').in('meeting_id', ids).order('sort'),
      ])
      const byId = Object.fromEntries(people.map(p => [p.id, p]))
      const data = list.map(m => ({
        m, people: byId,
        items: (its || []).filter((x: any) => x.meeting_id === m.id),
        decisions: (decs || []).filter((x: any) => x.meeting_id === m.id),
        attendance: (att || []).filter((x: any) => x.meeting_id === m.id),
      }))
      // поименният списък — членовете от първото заседание за годината
      const first = [...data].sort((a, b) => (a.m.meeting_no ?? 0) - (b.m.meeting_no ?? 0))[0]
      const roster = first.attendance.filter((a: any) => a.role === 'member' && a.staff_id).map((a: any) => byId[a.staff_id]).filter(Boolean)
      const { generateMeetingsBook } = await import('@/lib/docx-meetings')
      await generateMeetingsBook(b, year?.name || '', data as any, roster.length ? roster : defaultMembers(b, people.filter(p => p.is_active)))
    } catch (e: any) { notify(e.message || 'Грешка при изготвянето') }
    setBusy(null)
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {bodies.map(b => {
        const list = meetings.filter(m => m.body === b).sort((x, y) => (x.meeting_no ?? 0) - (y.meeting_no ?? 0))
        const t = BODY_TONE[b]
        return (
          <div key={b} className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-5 flex items-start gap-4" style={{ background: `linear-gradient(135deg, ${t.soft}, #fff)` }}>
              <div className="w-14 h-[72px] rounded-lg shrink-0 shadow-md relative" style={{ background: t.fg }}>
                <div className="absolute inset-y-0 left-1.5 w-px bg-white/30" />
                <BookOpen size={20} className="absolute inset-0 m-auto text-white/90" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-widest text-slate-400">Книга · {year?.name}</div>
                <h3 className="text-base font-semibold text-slate-800 leading-snug mt-0.5">
                  {b === 'ps' ? 'за решенията на педагогическия съвет и протоколи от заседанията' : 'с протоколите от общото събрание'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{list.length} {list.length === 1 ? 'протокол' : 'протокола'}{b === 'ps' ? ' · съхранение 20 г. (Наредба № 8, Прил. № 2)' : ''}</p>
              </div>
            </div>
            <div className="px-5 py-3 divide-y divide-slate-100">
              {list.length === 0 && <p className="text-sm text-slate-400 py-3">Още няма вписани протоколи.</p>}
              {list.map(m => (
                <Link key={m.id} href={`/meetings/${m.id}`} className="flex items-center gap-3 py-2.5 group">
                  <span className="w-10 text-sm font-semibold tabular-nums" style={{ color: t.fg }}>№ {m.meeting_no}</span>
                  <span className="text-sm text-slate-700 flex-1 truncate group-hover:text-slate-900">{m.title || BODY_LABEL[b]}</span>
                  <span className="text-xs text-slate-400 tabular-nums">{dmy(m.meeting_date)}</span>
                  {m.scan_path && <span title="Има сканиран подписан протокол" className="text-emerald-600"><CircleCheck size={14} /></span>}
                </Link>
              ))}
            </div>
            <div className="px-5 pb-5">
              <button onClick={() => download(b)} disabled={!list.length || busy === b}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40" style={{ background: NAVY }}>
                {busy === b ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Изтегли Книгата (Word)
              </button>
              <p className="text-[11px] text-slate-400 mt-2 text-center">Титулна страница, поименен списък, регистър на решенията и всички протоколи — с номерирани страници за разпечатване.</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── ново заседание ──
function NewMeeting({ onClose, me, people, year }: { onClose: () => void; me: { id: string; role: string }; people: Staff[]; year: Year | null }) {
  const supabase = createClient()
  const router = useRouter()
  const active = people.filter(p => p.is_active !== false)
  const director = active.find(p => p.role === 'director')
  const [body, setBody] = useState<Body>('ps')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('14:00')
  const [place, setPlace] = useState('')
  const [title, setTitle] = useState('')
  const [extra, setExtra] = useState(false)
  const [preset, setPreset] = useState<number>(-1)
  const [busy, setBusy] = useState(false)
  const presets = body === 'ps' ? PS_PRESETS : OS_PRESETS

  async function create() {
    if (!date) { notify('Изберете дата'); return }
    setBusy(true)
    try {
      const { data: m, error } = await supabase.from('mtg_meetings').insert({
        body, meeting_date: date, start_time: time || null, place: place.trim() || null, title: title.trim() || (preset >= 0 ? presets[preset].label : null),
        kind: extra ? 'extraordinary' : 'regular', quorum_rule: defaultQuorum(body), chair_id: director?.id || me.id,
        academic_year_id: year?.id || null,
      }).select('id').single()
      if (error || !m) throw new Error(error?.message || 'Грешка при създаване')
      const its = preset >= 0 ? presets[preset].items : []
      if (its.length) {
        const { error: e2 } = await supabase.from('mtg_items').insert(its.map((t, i) => ({ meeting_id: m.id, sort: i, title: t })))
        if (e2) throw new Error(e2.message)
      }
      const members = defaultMembers(body, active)
      if (members.length) {
        const { error: e3 } = await supabase.from('mtg_attendance').insert(members.map((p, i) => ({ meeting_id: m.id, staff_id: p.id, role: 'member', status: 'present', sort: i })))
        if (e3) throw new Error(e3.message)
      }
      router.push(`/meetings/${m.id}`)
    } catch (e: any) { notify(e.message); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center px-6 pt-5 pb-3">
          <h3 className="flex-1 text-lg font-semibold text-slate-800">Ново заседание</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="px-6 pb-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {(['ps', 'os'] as Body[]).map(b => {
              const t = BODY_TONE[b]; const on = body === b
              return (
                <button key={b} onClick={() => { setBody(b); setPreset(-1) }}
                  className={`text-left rounded-2xl p-4 border-2 transition-all ${on ? 'shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
                  style={on ? { borderColor: t.fg, background: t.soft } : {}}>
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2" style={{ background: t.bg, color: t.fg }}>{b === 'ps' ? <Landmark size={17} /> : <Users size={17} />}</span>
                  <div className="text-sm font-semibold text-slate-800">{BODY_LABEL[b]}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{b === 'ps' ? 'педагогическите специалисти · кворум 2/3' : 'всички служители · кворум > 1/2'}</div>
                </button>
              )
            })}
          </div>
          <div className="grid sm:grid-cols-[1fr,auto] gap-3">
            <label className="block"><span className="label">Дата</span><DateInput value={date} onChange={setDate} /></label>
            <label className="block"><span className="label">Начален час</span>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:border-slate-400" /></label>
          </div>
          <label className="block"><span className="label">Място</span>
            <input value={place} onChange={e => setPlace(e.target.value)} placeholder="напр. учителската стая / онлайн" className="input" /></label>
          <div>
            <span className="label">Готов дневен ред</span>
            <div className="flex flex-wrap gap-2 mt-1">
              <button onClick={() => setPreset(-1)} className={`px-3 py-1.5 rounded-full text-sm border ${preset === -1 ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600'}`}>Празен</button>
              {presets.map((p, i) => (
                <button key={p.label} onClick={() => setPreset(i)} className={`px-3 py-1.5 rounded-full text-sm border inline-flex items-center gap-1 ${preset === i ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <Sparkles size={12} /> {p.label}{p.hint ? <span className="opacity-60"> · {p.hint}</span> : null}
                </button>
              ))}
            </div>
            {preset >= 0 && (
              <ol className="mt-3 rounded-2xl bg-slate-50 border border-slate-100 p-3 space-y-1 text-[13px] text-slate-600 list-decimal list-inside">
                {presets[preset].items.map(t => <li key={t}>{t}</li>)}
              </ol>
            )}
          </div>
          <label className="block"><span className="label">Тема (по желание)</span>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={preset >= 0 ? presets[preset].label : 'напр. Резултати от I срок'} className="input" /></label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={extra} onChange={e => setExtra(e.target.checked)} className="rounded" /> Извънредно заседание
          </label>
          <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
            Членовете се добавят автоматично ({defaultMembers(body, active).length} души — {body === 'ps' ? 'педагогическите специалисти' : 'всички активни служители'}). Председател — {director ? fullName(director) : 'директорът'}. Всичко се променя след това.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary">Отказ</button>
            <button onClick={create} disabled={busy || !date} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: NAVY }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Създай
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
