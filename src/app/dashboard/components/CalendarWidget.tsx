'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, ArrowRight, Loader2, MailQuestion } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  type CalItem, type CalLayer, startOfDay, startOfWeek, addDays, sameDay, isoWd, itemDays, hm, ymd, WD_SHORT, MONTHS, dmy,
} from '@/lib/calendar'
import { loadCalendar } from '@/lib/calendar-sources'

// Карта „Моята седмица“ на таблото: 7-те дни с всичко от календара (собствени събития, покани, срокове
// от модулите), неучебните дни, бутон „Ново“ и връзка към пълния календар.
// Зарежда се в браузъра — часовете и „днес“ са по местното време; пази изключените слоеве от календара.
const PER_DAY = 3

export default function CalendarWidget({ me, compact = false }: { me: { id: string; role: string; isCoordinator?: boolean }; compact?: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const [week, setWeek] = useState(() => {
    // в събота и неделя — следващата седмица
    const t = startOfDay(new Date())
    return isoWd(t) >= 6 ? startOfWeek(addDays(t, 7)) : startOfWeek(t)
  })
  const [items, setItems] = useState<CalItem[] | null>(null)
  const [invites, setInvites] = useState(0)
  const [off, setOff] = useState<Set<CalLayer>>(new Set())

  useEffect(() => { try { const s = localStorage.getItem('cal-layers-off'); if (s) setOff(new Set(JSON.parse(s))) } catch {} }, [])
  useEffect(() => {
    let live = true
    setItems(null)
    loadCalendar(supabase, me, week, addDays(week, 7)).then(r => { if (live) setItems(r.items) })
    return () => { live = false }
  }, [supabase, me.id, week.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    supabase.from('cal_event_attendees').select('event_id, event:cal_events(starts_at)').eq('staff_id', me.id).eq('response', 'pending')
      .then(({ data }: any) => setInvites(((data || []) as any[]).filter(r => r.event && new Date(r.event.starts_at) >= startOfDay(new Date())).length))
  }, [supabase, me.id])

  const today = startOfDay(new Date())
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const visible = (items || []).filter(it => !off.has(it.layer))
  const byDay = days.map(d => {
    const list = visible.filter(it => { const { first, last } = itemDays(it); return first <= d && last >= d })
    const holiday = list.find(it => it.layer === 'school')
    const rest = list.filter(it => it.layer !== 'school')
      .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime())
    return { d, holiday, rest }
  })
  // в тясна карта — само делничните дни (+ събота/неделя, ако имат нещо)
  const shown = compact ? byDay.filter(x => isoWd(x.d) <= 5 || x.rest.length > 0) : byDay
  const total = byDay.reduce((n, x) => n + x.rest.length, 0)
  const last = addDays(week, 6)
  const title = week.getMonth() === last.getMonth()
    ? `${week.getDate()}–${last.getDate()} ${MONTHS[week.getMonth()]}`
    : `${week.getDate()} ${MONTHS[week.getMonth()]} – ${last.getDate()} ${MONTHS[last.getMonth()]}`
  const isThisWeek = sameDay(week, startOfWeek(today))

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      {/* заглавие */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-100">
        <span className="w-7 h-7 rounded-lg bg-[#0f2240] text-white flex items-center justify-center"><CalendarDays size={14} /></span>
        <Link href={`/calendar?view=week&date=${ymd(week)}`} className="text-[14px] font-semibold text-slate-800 hover:text-[#1a3560]">
          {isThisWeek ? 'Моята седмица' : 'Седмица'}
        </Link>
        <span className="text-[13px] text-slate-500">{title}</span>
        {items === null && <Loader2 size={13} className="animate-spin text-slate-300" />}
        <div className="flex items-center ml-1">
          <button onClick={() => setWeek(w => addDays(w, -7))} className="p-1 rounded-full hover:bg-slate-100 text-slate-500" aria-label="Предишна седмица"><ChevronLeft size={16} /></button>
          <button onClick={() => setWeek(w => addDays(w, 7))} className="p-1 rounded-full hover:bg-slate-100 text-slate-500" aria-label="Следваща седмица"><ChevronRight size={16} /></button>
          {!isThisWeek && <button onClick={() => setWeek(startOfWeek(today))} className="ml-1 text-[11.5px] px-2 py-0.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">Днес</button>}
        </div>
        <div className="flex-1" />
        {invites > 0 && (
          <Link href="/calendar?view=agenda" className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-full bg-blue-600 text-white hover:bg-blue-700">
            <MailQuestion size={12} /> {invites} {invites === 1 ? 'покана' : 'покани'}
          </Link>
        )}
        <Link href={`/calendar?view=week&date=${ymd(isThisWeek ? today : week)}&new=1`} className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
          <Plus size={13} /> Ново
        </Link>
        <Link href={`/calendar?view=month&date=${ymd(week)}`} className="inline-flex items-center gap-1 text-[12px] text-blue-700 hover:underline">
          Календар <ArrowRight size={12} />
        </Link>
      </div>

      {/* 7 дни: колони на голям екран, списък на телефон */}
      <div className="grid grid-cols-1 md:[grid-template-columns:var(--cols)] md:divide-x divide-y md:divide-y-0 divide-slate-100"
        style={{ ['--cols' as any]: `repeat(${shown.length}, minmax(0, 1fr))` }}>
        {shown.map(({ d, holiday, rest }) => {
          const isToday = sameDay(d, today)
          const weekend = isoWd(d) >= 6
          const past = d < today
          return (
            <div key={d.toISOString()}
              className={`min-h-[52px] md:min-h-[104px] px-2 py-1.5 flex md:block gap-3 ${isToday ? 'bg-blue-50/50' : holiday || weekend ? 'bg-slate-50/70' : ''} ${past ? 'opacity-70' : ''} ${weekend && rest.length === 0 && !holiday ? 'hidden md:block' : ''}`}>
              <Link href={`/calendar?view=day&date=${ymd(d)}`} className="flex md:flex-row items-center gap-1.5 mb-1 shrink-0 w-14 md:w-auto group">
                <span className={`text-[10.5px] font-semibold uppercase tracking-wide ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>{WD_SHORT[isoWd(d) - 1]}</span>
                <span className={`min-w-[24px] h-6 px-1 rounded-full flex items-center justify-center text-[13px] tabular-nums ${isToday ? 'bg-blue-600 text-white font-semibold' : 'text-slate-700 group-hover:bg-slate-200'}`}>{d.getDate()}</span>
              </Link>
              <div className="flex-1 min-w-0 space-y-1">
                {holiday && <div className="text-[11px] text-slate-500 italic truncate" title={holiday.title}>{holiday.title}</div>}
                {rest.slice(0, PER_DAY).map(it => <Chip key={it.key} it={it} day={d} />)}
                {rest.length > PER_DAY && (
                  <Link href={`/calendar?view=day&date=${ymd(d)}`} className="block text-[11px] font-medium text-slate-500 hover:text-slate-800 px-1">+ още {rest.length - PER_DAY}</Link>
                )}
                {items !== null && rest.length === 0 && !holiday && !weekend && <div className="text-[11px] text-slate-300 px-1">—</div>}
              </div>
            </div>
          )
        })}
      </div>
      {items !== null && total === 0 && (
        <div className="px-4 py-2 text-[12px] text-slate-400 border-t border-slate-100">Няма събития и срокове тази седмица. Създай среща с „Ново“ или виж месеца в Календара.</div>
      )}
    </div>
  )
}

function Chip({ it, day }: { it: CalItem; day: Date }) {
  const { first, last } = itemDays(it)
  const multi = !sameDay(first, last)
  const pending = it.myResponse === 'pending'
  const href = it.event ? `/calendar?view=day&date=${ymd(day)}` : (it.href || `/calendar?view=day&date=${ymd(day)}`)
  const time = it.allDay ? (multi ? `до ${dmy(last).slice(0, 5)}` : '') : hm(it.start)
  return (
    <Link href={href} title={`${it.title}${it.subtitle ? ' — ' + it.subtitle : ''}`}
      className={`block rounded-md px-1.5 py-1 text-[11.5px] leading-tight line-clamp-2 hover:brightness-95 ${it.done ? 'opacity-55' : ''}`}
      style={{ backgroundColor: pending ? '#fff' : `${it.color}17`, borderLeft: `3px solid ${it.color}`, outline: pending ? `1px dashed ${it.color}` : undefined }}>
      {time && <span className="text-slate-500 tabular-nums mr-1">{time}</span>}
      <span className={`text-slate-800 ${it.done ? 'line-through' : ''}`}>{it.title}</span>
    </Link>
  )
}
