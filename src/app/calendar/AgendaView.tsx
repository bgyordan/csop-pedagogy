'use client'
import { useMemo } from 'react'
import { MapPin, ArrowRight, CalendarX2 } from 'lucide-react'
import { type CalItem, WD_SHORT, MONTHS, addDays, sameDay, isoWd, itemDays, hm, ymd, LAYER_BY_KEY } from '@/lib/calendar'

// Списък по дни (като „График“ в Google / „Програма“ в Outlook) — удобен и на телефон
export default function AgendaView({ from, to, items, now, onOpen, onDay, onLater }: {
  from: Date; to: Date; items: CalItem[]; now: Date
  onOpen: (it: CalItem) => void; onDay: (d: Date) => void; onLater: () => void
}) {
  const days = useMemo(() => {
    const map = new Map<string, CalItem[]>()
    for (const it of items) {
      const { first, last } = itemDays(it)
      for (let d = first < from ? from : first; d <= last && d < to; d = addDays(d, 1)) {
        const k = ymd(d)
        if (!map.has(k)) map.set(k, [])
        map.get(k)!.push(it)
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, list]) => ({ day: new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)), list: list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime()) }))
  }, [items, from.getTime(), to.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!days.length) return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
      <CalendarX2 size={40} className="text-slate-300 mb-3" />
      <p className="text-sm">Няма събития в следващите 30 дни от избраната дата.</p>
      <button onClick={onLater} className="mt-3 text-sm text-blue-700 hover:underline">Виж по-нататък →</button>
    </div>
  )

  let lastMonth = -1
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-3 md:px-6 py-4">
        {days.map(({ day, list }) => {
          const isToday = sameDay(day, now)
          const showMonth = day.getMonth() !== lastMonth
          lastMonth = day.getMonth()
          return (
            <div key={day.toISOString()}>
              {showMonth && <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-4 mb-2 first:mt-0">{MONTHS[day.getMonth()]} {day.getFullYear()}</div>}
              <div className={`flex gap-3 md:gap-5 py-2.5 border-b border-slate-100 ${day < now && !isToday ? 'opacity-60' : ''}`}>
                <button onClick={() => onDay(day)} className="w-14 md:w-20 shrink-0 flex items-start gap-2 text-left group">
                  <span className={`w-9 h-9 flex items-center justify-center rounded-full text-lg tabular-nums ${isToday ? 'bg-blue-600 text-white font-semibold' : 'text-slate-800 group-hover:bg-slate-100'}`}>{day.getDate()}</span>
                  <span className={`text-[11px] uppercase font-semibold mt-2.5 hidden md:inline ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>{WD_SHORT[isoWd(day) - 1]}</span>
                </button>
                <div className="flex-1 min-w-0 space-y-0.5">
                  {list.map(it => {
                    const { first, last } = itemDays(it)
                    const multi = !sameDay(first, last)
                    return (
                      <button key={it.key} onClick={() => onOpen(it)}
                        className="w-full flex items-start gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left">
                        <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: it.myResponse === 'pending' ? 'transparent' : it.color, border: `2px solid ${it.color}` }} />
                        <span className="w-24 md:w-28 shrink-0 text-[13px] text-slate-500 tabular-nums pt-0.5">
                          {it.allDay ? (multi ? `${first.getDate()}.${first.getMonth() + 1} – ${last.getDate()}.${last.getMonth() + 1}` : 'Цял ден') : `${hm(it.start)} – ${hm(it.end)}`}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block text-sm font-medium text-slate-800 ${it.done ? 'line-through text-slate-400' : ''}`}>{it.title}</span>
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-slate-500 mt-0.5">
                            {it.subtitle && <span className="truncate">{it.subtitle}</span>}
                            {it.location && <span className="inline-flex items-center gap-1"><MapPin size={11} />{it.location}</span>}
                            {it.myResponse === 'pending' && <span className="text-blue-700 font-medium">Чака твоя отговор</span>}
                          </span>
                        </span>
                        <span className="hidden sm:inline-flex items-center gap-1 shrink-0 text-[11px] px-2 py-0.5 rounded-full mt-0.5"
                          style={{ backgroundColor: `${LAYER_BY_KEY[it.layer].color}14`, color: LAYER_BY_KEY[it.layer].color }}>
                          {it.sourceLabel || LAYER_BY_KEY[it.layer].label}
                          {it.href && <ArrowRight size={10} />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
        <div className="text-center py-6">
          <button onClick={onLater} className="text-sm text-blue-700 hover:underline">Следващите 30 дни →</button>
        </div>
      </div>
    </div>
  )
}
