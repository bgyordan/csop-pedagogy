'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { notify } from '@/components/ui/Toast'
import {
  ChevronLeft, ChevronRight, Plus, Search, Download, CalendarDays, PanelLeft, Loader2, X, Check, HelpCircle, ClipboardCheck,
} from 'lucide-react'
import {
  type CalView, type CalItem, type CalLayer, type Response, LAYERS, MANAGER_ROLES, PUBLISHER_ROLES,
  viewRange, shiftAnchor, rangeTitle, ymd, parseYmd, startOfDay, addDays, addMinutes, sameDay, startOfWeek, isoWd,
  WD_SHORT, MONTHS_CAP, MONTHS, downloadIcs, itemDays, hm, dmy,
} from '@/lib/calendar'
import { loadCalendar } from '@/lib/calendar-sources'
import MonthView from './MonthView'
import TimeGridView from './TimeGridView'
import AgendaView from './AgendaView'
import EventDetails from './EventDetails'
import EventEditor, { type Draft } from './EventEditor'

export interface MeInfo { id: string; role: string; isCoordinator: boolean; name: string }
export interface StaffLite { id: string; first_name: string; last_name: string; role: string; position: string | null }

const VIEW_LABELS: Record<CalView, string> = { month: 'Месец', week: 'Седмица', day: 'Ден', agenda: 'Списък' }
const LS_LAYERS = 'cal-layers-off'

export default function CalendarClient({ me, staff, needSql, initialView, initialDate }: {
  me: MeInfo; staff: StaffLite[]; needSql: boolean; initialView: CalView | null; initialDate: string | null
}) {
  const supabase = useMemo(() => createClient(), [])
  const [view, setView] = useState<CalView>(initialView || 'month')
  const [anchor, setAnchor] = useState<Date>(initialDate ? parseYmd(initialDate) : startOfDay(new Date()))
  const [items, setItems] = useState<CalItem[]>([])
  const [failed, setFailed] = useState<CalLayer[]>([])
  const [loading, setLoading] = useState(true)
  const [off, setOff] = useState<Set<CalLayer>>(new Set())
  const [query, setQuery] = useState('')
  const [railOpen, setRailOpen] = useState(false)
  const [selected, setSelected] = useState<CalItem | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dayList, setDayList] = useState<Date | null>(null)
  const [now, setNow] = useState(new Date())
  const isPublisher = PUBLISHER_ROLES.includes(me.role)
  const isManager = MANAGER_ROLES.includes(me.role)

  // слоевете се помнят в браузъра; на телефон — списък по подразбиране
  useEffect(() => {
    try { const s = localStorage.getItem(LS_LAYERS); if (s) setOff(new Set(JSON.parse(s))) } catch {}
    if (!initialView && typeof window !== 'undefined' && window.innerWidth < 768) setView('agenda')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t) }, [])

  // адресът отразява изгледа и датата (за споделяне и „назад“)
  useEffect(() => {
    const u = new URL(window.location.href)
    u.searchParams.set('view', view); u.searchParams.set('date', ymd(anchor))
    window.history.replaceState(null, '', u.toString())
  }, [view, anchor])

  const range = useMemo(() => viewRange(view, anchor), [view, anchor])
  const loadSeq = useRef(0)
  const reload = useCallback(async () => {
    const seq = ++loadSeq.current
    setLoading(true)
    // зареждаме с малък запас, за да има точки в малкия календар и плавно превъртане
    const from = addDays(range.from, -7), to = addDays(range.to, 7)
    const res = await loadCalendar(supabase, me, from, to)
    if (seq !== loadSeq.current) return
    setItems(res.items); setFailed(res.failed); setLoading(false)
  }, [supabase, me, range.from.getTime(), range.to.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, [reload])

  function toggleLayer(k: CalLayer) {
    setOff(prev => {
      const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k)
      try { localStorage.setItem(LS_LAYERS, JSON.stringify(Array.from(n))) } catch {}
      return n
    })
  }

  const layers = LAYERS.filter(l => !l.mgmtOnly || isPublisher)
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(it => !off.has(it.layer) && (!q || `${it.title} ${it.subtitle || ''} ${it.location || ''} ${it.description || ''}`.toLowerCase().includes(q)))
  }, [items, off, query])
  const counts = useMemo(() => {
    const c: Partial<Record<CalLayer, number>> = {}
    for (const it of items) { const { first, last } = itemDays(it); if (last >= range.from && first < range.to) c[it.layer] = (c[it.layer] || 0) + 1 }
    return c
  }, [items, range])

  const go = (dir: 1 | -1) => setAnchor(a => shiftAnchor(view, a, dir))
  const today = () => setAnchor(startOfDay(new Date()))
  const openDay = (d: Date) => { setAnchor(startOfDay(d)); setView('day') }

  function newEvent(start?: Date, end?: Date, allDay?: boolean) {
    if (needSql) { notify('Пуснете SQL файла 2026-10-27_calendar.sql, за да се създават събития.'); return }
    const base = start || (() => { const d = new Date(anchor); const n = new Date(); d.setHours(n.getHours() + 1, 0, 0, 0); return d })()
    setDraft({ start: base, end: end || addMinutes(base, 60), allDay: !!allDay })
  }

  // клавишни комбинации като в Google Календар
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || draft || selected || dayList) return
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      const k = e.key.toLowerCase()
      if (k === 't' || k === 'т') today()
      else if (k === 'm' || k === 'м') setView('month')
      else if (k === 'w' || k === 'с') setView('week')
      else if (k === 'd' || k === 'д') setView('day')
      else if (k === 'a' || k === 'л') setView('agenda')
      else if (k === 'n' || k === 'c' || k === 'н') newEvent()
      else if (k === 'arrowleft' || k === 'j' || k === 'p') go(-1)
      else if (k === 'arrowright' || k === 'k') go(1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // преместване с влачене (само собствени, неповтарящи се събития)
  async function moveItem(it: CalItem, start: Date, end: Date) {
    const ev = it.event
    if (!ev || !canEdit(it)) return
    if (ev.recur_freq !== 'none') { notify('Повтарящите се събития се преместват от „Редактирай“.'); return }
    setItems(prev => prev.map(x => x.key === it.key ? { ...x, start, end } : x))
    const { error } = await supabase.from('cal_events').update({ starts_at: start.toISOString(), ends_at: end.toISOString(), updated_at: new Date().toISOString() }).eq('id', ev.id)
    if (error) { notify(error.message); reload(); return }
    notify(`„${ev.title}“ е преместено: ${it.allDay ? dmy(start) : `${dmy(start)}, ${hm(start)}`}`, 'success')
    reload()
  }
  function canEdit(it: CalItem) {
    const ev = it.event
    if (!ev) return false
    return ev.owner_id === me.id || (ev.visibility !== 'private' && isPublisher)
  }

  async function respond(eventId: string, response: Response) {
    const { error } = await supabase.from('cal_event_attendees').update({ response, responded_at: new Date().toISOString() }).eq('event_id', eventId).eq('staff_id', me.id)
    if (error) { notify(error.message); return }
    notify(response === 'yes' ? 'Потвърдено — ще присъстваш' : response === 'no' ? 'Отказано' : 'Отбелязано „може би“', 'success')
    reload(); loadInvites()
  }

  // покани без отговор (за всички бъдещи дати, не само видимия интервал)
  const [invites, setInvites] = useState<any[]>([])
  const loadInvites = useCallback(async () => {
    if (needSql) return
    const { data } = await supabase.from('cal_event_attendees')
      .select('event_id, response, event:cal_events(id, title, starts_at, all_day, owner:staff_profiles!cal_events_owner_id_fkey(first_name, last_name))')
      .eq('staff_id', me.id).eq('response', 'pending')
    setInvites(((data || []) as any[]).filter(r => r.event && new Date(r.event.starts_at) >= addDays(startOfDay(new Date()), -1))
      .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at)))
  }, [supabase, me.id, needSql])
  useEffect(() => { loadInvites() }, [loadInvites])

  const title = rangeTitle(view, anchor)
  const viewItems = visible

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ── лента с инструменти ── */}
      <header className="flex flex-wrap items-center gap-2 px-3 md:px-5 py-3 border-b border-slate-200 bg-white">
        <button onClick={() => setRailOpen(o => !o)} className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600" title="Календари"><PanelLeft size={18} /></button>
        <div className="flex items-center gap-2 mr-2">
          <div className="hidden sm:flex w-9 h-9 rounded-xl bg-[#0f2240] text-white items-center justify-center shadow-sm"><CalendarDays size={18} /></div>
          <h1 className="text-lg font-semibold text-slate-800 tracking-tight hidden sm:block">Календар</h1>
        </div>
        <button onClick={today} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50" title="Днес (T)">Днес</button>
        <div className="flex items-center">
          <button onClick={() => go(-1)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600" title="Назад (←)"><ChevronLeft size={20} /></button>
          <button onClick={() => go(1)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600" title="Напред (→)"><ChevronRight size={20} /></button>
        </div>
        <h2 className="text-base md:text-lg font-medium text-slate-800 first-letter:uppercase min-w-0 truncate">{title}</h2>
        {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
        <div className="flex-1" />
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Търси в календара"
            className="w-48 lg:w-56 pl-8 pr-7 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 bg-slate-50 focus:bg-white" />
          {query && <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={13} /></button>}
        </div>
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
          {(Object.keys(VIEW_LABELS) as CalView[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-2.5 md:px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        <button onClick={() => downloadIcs(viewItems.filter(it => { const { first, last } = itemDays(it); return last >= range.from && first < range.to }), `kalendar-${ymd(range.from)}`)}
          className="hidden md:flex p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Изтегли видимите събития (.ics за Outlook / Google / телефона)"><Download size={17} /></button>
        <button onClick={() => newEvent()} className="flex lg:hidden items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[#0f2240] hover:bg-[#1a3560]"><Plus size={15} /> Ново</button>
      </header>

      {needSql && (
        <div className="px-5 py-2 text-sm bg-amber-50 border-b border-amber-200 text-amber-800">
          Собствените събития още не са подготвени в базата — пуснете SQL файла <b>2026-10-27_calendar.sql</b>. Дотогава се виждат само сроковете от модулите.
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* ── лява колона: създай, малък календар, покани, слоеве ── */}
        <aside className={`${railOpen ? 'fixed inset-0 z-40 bg-black/30 lg:static lg:bg-transparent' : 'hidden'} lg:block`} onClick={() => setRailOpen(false)}>
          <div className="w-72 lg:w-64 h-full overflow-y-auto bg-white border-r border-slate-200 p-4 space-y-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setRailOpen(false); newEvent() }}
              className="flex items-center gap-2.5 pl-3 pr-5 py-3 rounded-2xl bg-white border border-slate-200 shadow-md hover:shadow-lg hover:bg-slate-50 transition-all text-sm font-medium text-slate-700">
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center"><Plus size={16} /></span>
              Ново събитие
            </button>

            <MiniMonth anchor={anchor} items={visible} onPick={d => { setAnchor(d); if (view === 'month' && d.getMonth() !== anchor.getMonth()) setView('month'); setRailOpen(false) }} view={view} />

            {invites.length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Покани за отговор · {invites.length}</h3>
                <div className="space-y-1.5">
                  {invites.slice(0, 6).map(r => (
                    <div key={r.event_id} className="rounded-xl border border-blue-100 bg-blue-50/60 px-2.5 py-2">
                      <div className="text-[13px] font-medium text-slate-800 leading-snug line-clamp-2">{r.event.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {dmy(new Date(r.event.starts_at))}{!r.event.all_day && `, ${hm(new Date(r.event.starts_at))}`} · {r.event.owner ? `${r.event.owner.first_name} ${r.event.owner.last_name}` : ''}
                      </div>
                      <div className="flex gap-1 mt-1.5">
                        <button onClick={() => respond(r.event_id, 'yes')} className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-medium py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"><Check size={12} /> Да</button>
                        <button onClick={() => respond(r.event_id, 'maybe')} className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-medium py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"><HelpCircle size={12} /> Може би</button>
                        <button onClick={() => respond(r.event_id, 'no')} className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-medium py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"><X size={12} /> Не</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Календари</h3>
              <ul className="space-y-0.5">
                {layers.map(l => {
                  const on = !off.has(l.key)
                  const bad = failed.includes(l.key) && !(l.key === 'mine' && needSql)
                  return (
                    <li key={l.key}>
                      <button onClick={() => toggleLayer(l.key)} title={bad ? 'Няма достъп или данните още не са подготвени' : l.hint}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left group">
                        <span className="w-4 h-4 rounded-[5px] border-2 flex items-center justify-center shrink-0 transition-colors"
                          style={{ borderColor: l.color, backgroundColor: on ? l.color : 'transparent' }}>
                          {on && <Check size={11} className="text-white" strokeWidth={3} />}
                        </span>
                        <span className={`text-[13px] flex-1 truncate ${bad ? 'text-slate-300' : 'text-slate-700'}`}>{l.label}</span>
                        {!!counts[l.key] && <span className="text-[11px] text-slate-400 tabular-nums">{counts[l.key]}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>

            {isManager && <ControlPlanPanel supabase={supabase} anchor={anchor} />}

            <p className="text-[11px] leading-relaxed text-slate-400">
              Клавиши: <b>T</b> днес · <b>M</b>/<b>W</b>/<b>D</b>/<b>A</b> изгледи · <b>N</b> ново · <b>← →</b> напред/назад.
              Влачи свое събитие, за да го преместиш.
            </p>
          </div>
        </aside>

        {/* ── изглед ── */}
        <main className="flex-1 min-w-0 flex flex-col">
          {view === 'month' && (
            <MonthView anchor={anchor} items={viewItems} now={now} canEdit={canEdit}
              onOpen={setSelected} onDay={openDay} onMore={setDayList} onMove={moveItem}
              onCreate={d => newEvent(at9(d), addMinutes(at9(d), 60), true)} />
          )}
          {(view === 'week' || view === 'day') && (
            <TimeGridView days={view === 'day' ? [startOfDay(anchor)] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i))}
              items={viewItems} now={now} canEdit={canEdit} onOpen={setSelected} onDay={openDay} onMove={moveItem}
              onCreate={(s, e, allDay) => newEvent(s, e, allDay)} onMore={setDayList} />
          )}
          {view === 'agenda' && (
            <AgendaView from={range.from} to={range.to} items={viewItems} now={now} onOpen={setSelected} onDay={openDay}
              onLater={() => go(1)} />
          )}
        </main>
      </div>

      {dayList && (
        <DayListDialog day={dayList} items={viewItems.filter(it => { const { first, last } = itemDays(it); return first <= dayList && last >= dayList })}
          onClose={() => setDayList(null)} onOpen={it => { setDayList(null); setSelected(it) }} onDay={d => { setDayList(null); openDay(d) }} />
      )}

      {selected && (
        <EventDetails item={selected} me={me} staff={staff} canEdit={canEdit(selected)} supabase={supabase}
          onClose={() => setSelected(null)}
          onEdit={(scope) => {
            const it = selected
            setSelected(null)
            setDraft({ start: it.start, end: it.end, allDay: it.allDay, event: it.event, occ: it.occ, scope })
          }}
          onDuplicate={() => { const it = selected; setSelected(null); setDraft({ start: it.start, end: it.end, allDay: it.allDay, event: it.event, duplicate: true }) }}
          onRespond={r => { if (selected.event) respond(selected.event.id, r); setSelected(s => s ? { ...s, myResponse: r } : s) }}
          onChanged={() => { setSelected(null); reload() }} />
      )}

      {draft && (
        <EventEditor draft={draft} me={me} staff={staff} isPublisher={isPublisher} supabase={supabase}
          onClose={() => setDraft(null)} onSaved={() => { setDraft(null); reload(); loadInvites() }} />
      )}
    </div>
  )
}

const at9 = (d: Date) => { const x = startOfDay(d); x.setHours(9); return x }

// ───────── малък календар отляво ─────────
function MiniMonth({ anchor, items, onPick, view }: { anchor: Date; items: CalItem[]; onPick: (d: Date) => void; view: CalView }) {
  const [m, setM] = useState(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
  useEffect(() => { setM(new Date(anchor.getFullYear(), anchor.getMonth(), 1)) }, [anchor.getFullYear(), anchor.getMonth()]) // eslint-disable-line react-hooks/exhaustive-deps
  const start = startOfWeek(m)
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const busy = useMemo(() => {
    const s = new Set<string>()
    for (const it of items) { const { first, last } = itemDays(it); for (let d = first; d <= last && s.size < 400; d = addDays(d, 1)) s.add(ymd(d)) }
    return s
  }, [items])
  const today = new Date()
  const wk = view === 'week' ? startOfWeek(anchor) : null
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-sm font-medium text-slate-700">{MONTHS_CAP[m.getMonth()]} {m.getFullYear()}</span>
        <div className="flex">
          <button onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="p-1 rounded-full hover:bg-slate-100 text-slate-500"><ChevronLeft size={15} /></button>
          <button onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="p-1 rounded-full hover:bg-slate-100 text-slate-500"><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center">
        {WD_SHORT.map(w => <div key={w} className="text-[10px] font-medium text-slate-400 py-1">{w[0]}</div>)}
        {days.map(d => {
          const inMonth = d.getMonth() === m.getMonth()
          const isToday = sameDay(d, today)
          const isSel = sameDay(d, anchor)
          const inWeek = wk && d >= wk && d < addDays(wk, 7)
          return (
            <button key={d.toISOString()} onClick={() => onPick(d)}
              className={`relative mx-auto my-[1px] w-7 h-7 rounded-full text-[11.5px] tabular-nums transition-colors
                ${isToday ? 'bg-blue-600 text-white font-semibold' : isSel ? 'bg-blue-100 text-blue-800 font-semibold' : inWeek ? 'bg-slate-100 text-slate-700' : inMonth ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-50'}
                ${isoWd(d) >= 6 && !isToday && !isSel && inMonth ? 'text-slate-400' : ''}`}>
              {d.getDate()}
              {busy.has(ymd(d)) && !isToday && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ───────── всички събития за един ден („+N още“) ─────────
function DayListDialog({ day, items, onClose, onOpen, onDay }: { day: Date; items: CalItem[]; onClose: () => void; onOpen: (it: CalItem) => void; onDay: (d: Date) => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }, [onClose])
  const sorted = [...items].sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime())
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <button onClick={() => onDay(day)} className="text-left group">
            <div className="text-xs font-medium uppercase text-slate-500">{WD_SHORT[isoWd(day) - 1]}</div>
            <div className="text-2xl font-semibold text-slate-800 group-hover:text-blue-700">{day.getDate()} <span className="text-base font-normal text-slate-500">{MONTHS[day.getMonth()]}</span></div>
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={16} /></button>
        </div>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {sorted.map(it => (
            <button key={it.key} onClick={() => onOpen(it)}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 ${it.done ? 'opacity-60' : ''}`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: it.color }} />
              <span className="text-xs text-slate-500 w-11 shrink-0 tabular-nums">{it.allDay ? 'цял ден' : hm(it.start)}</span>
              <span className={`text-sm text-slate-800 truncate ${it.done ? 'line-through' : ''}`}>{it.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ───────── контролна дейност: какво е планирано за месеца (ръководството) ─────────
function ControlPlanPanel({ supabase, anchor }: { supabase: any; anchor: Date }) {
  const [rows, setRows] = useState<any[] | null>(null)
  const month = anchor.getMonth() + 1
  useEffect(() => {
    let live = true
    ;(async () => {
      const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).maybeSingle()
      if (!cy) { if (live) setRows([]); return }
      const { data, error } = await supabase.from('control_plan_items')
        .select('id, subject, target, plan:control_plans!inner(academic_year_id, owner_title, owner:staff_profiles(first_name, last_name))')
        .eq('month', month).eq('plan.academic_year_id', cy.id).order('sort')
      if (error || !data) { if (live) setRows([]); return }
      const ids = data.map((r: any) => r.id)
      const done: Record<string, number> = {}
      if (ids.length) {
        const { data: ch } = await supabase.from('control_checks').select('plan_item_id').in('plan_item_id', ids).neq('status', 'voided')
        for (const c of (ch || []) as any[]) done[c.plan_item_id] = (done[c.plan_item_id] || 0) + 1
      }
      if (live) setRows(data.map((r: any) => ({ ...r, done: done[r.id] || 0 })))
    })()
    return () => { live = false }
  }, [supabase, month])
  if (!rows || rows.length === 0) return null
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
        <ClipboardCheck size={12} /> Контрол по плана · {MONTHS[month - 1]}
      </h3>
      <ul className="space-y-1.5">
        {rows.slice(0, 12).map(r => {
          const full = r.done >= r.target
          return (
            <li key={r.id} className="text-[12px] leading-snug">
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 shrink-0 text-[10px] font-semibold tabular-nums px-1.5 rounded ${full ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{r.done}/{r.target}</span>
                <span className="text-slate-700 line-clamp-2">{r.subject}</span>
              </div>
            </li>
          )
        })}
      </ul>
      <Link href="/control?tab=plan" className="block mt-2 text-[12px] text-blue-700 hover:underline">Към плана →</Link>
    </section>
  )
}
