'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { type CalEventRow, expandEvent, startOfDay, addDays, dayDiff, hm, eventColor } from '@/lib/calendar'

// Днешните събития от календара и напомнянията (N дни преди), плюс поканите без отговор.
// Зарежда се в браузъра, за да са часовете и „днес“ по местното време.
type Row = { key: string; title: string; start: Date; allDay: boolean; days: number; color: string; pending: boolean }

export default function CalendarStrip({ staffId }: { staffId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [invites, setInvites] = useState(0)
  useEffect(() => {
    let live = true
    ;(async () => {
      const sb = createClient()
      const from = startOfDay(new Date()), to = addDays(from, 8)
      const cols = '*, attendees:cal_event_attendees(staff_id, response)'
      const [a, b] = await Promise.all([
        sb.from('cal_events').select(cols).eq('recur_freq', 'none').lt('starts_at', to.toISOString()).gte('ends_at', from.toISOString()),
        sb.from('cal_events').select(cols).neq('recur_freq', 'none').lt('starts_at', to.toISOString()),
      ])
      if (a.error || !live) { if (live) setRows([]); return }
      const out: Row[] = []
      let pend = 0
      for (const e of [...(a.data || []), ...(b.data || [])] as CalEventRow[]) {
        const mine = (e.attendees || []).find(x => x.staff_id === staffId)
        if (mine?.response === 'no') continue
        if (mine?.response === 'pending') pend++
        for (const o of expandEvent(e, from, to)) {
          const days = Math.max(0, dayDiff(from, o.start))
          const remind = e.remind_days
          if (days === 0 || (remind != null && days <= remind)) {
            out.push({ key: `${e.id}:${o.occ}`, title: e.title, start: o.start, allDay: e.all_day, days, color: eventColor(e), pending: mine?.response === 'pending' })
          }
        }
      }
      out.sort((x, y) => x.start.getTime() - y.start.getTime())
      if (live) { setRows(out); setInvites(pend) }
    })()
    return () => { live = false }
  }, [staffId])

  if (!rows || (rows.length === 0 && invites === 0)) return null
  const today = rows.filter(r => r.days === 0)
  const later = rows.filter(r => r.days > 0)
  const when = (r: Row) => r.days === 0 ? (r.allDay ? 'днес' : hm(r.start)) : r.days === 1 ? `утре${r.allDay ? '' : ` ${hm(r.start)}`}` : `след ${r.days} дни`
  return (
    <Link href="/calendar?view=agenda" className="rounded-2xl border border-blue-200/70 bg-gradient-to-r from-blue-50/80 to-white px-5 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 hover:shadow-sm transition-shadow">
      <CalendarDays size={15} className="text-blue-600 shrink-0" />
      <span className="text-sm font-medium text-slate-800">{today.length ? 'Днес в календара' : 'Предстои'}</span>
      {[...today, ...later].slice(0, 4).map(r => (
        <span key={r.key} className="inline-flex items-center gap-1.5 text-[13px] text-slate-700 max-w-[260px]">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
          <span className="text-slate-500 tabular-nums shrink-0">{when(r)}</span>
          <span className="truncate">{r.title}</span>
        </span>
      ))}
      {rows.length > 4 && <span className="text-[12px] text-slate-500">и още {rows.length - 4}</span>}
      {invites > 0 && <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-blue-600 text-white">{invites} {invites === 1 ? 'покана чака' : 'покани чакат'} отговор</span>}
      <ArrowRight size={14} className="text-blue-600 ml-auto" />
    </Link>
  )
}
