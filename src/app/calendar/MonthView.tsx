'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type CalItem, WD_SHORT, MONTHS, startOfWeek, addDays, sameDay, isoWd, weekSegments, itemDays, isMultiDay, hm, ymd, dayDiff,
} from '@/lib/calendar'

const HEAD = 28   // височина на реда с числото
const LANE = 22   // височина на една лента

export default function MonthView({ anchor, items, now, canEdit, onOpen, onDay, onMore, onMove, onCreate }: {
  anchor: Date; items: CalItem[]; now: Date
  canEdit: (it: CalItem) => boolean
  onOpen: (it: CalItem) => void; onDay: (d: Date) => void; onMore: (d: Date) => void
  onMove: (it: CalItem, start: Date, end: Date) => void; onCreate: (d: Date) => void
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const weeks = useMemo(() => {
    const out: Date[] = []
    for (let w = startOfWeek(first); w <= last; w = addDays(w, 7)) out.push(w)
    return out
  }, [first.getTime(), last.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  // неучебните дни (от учебния календар) — оцветени
  const offDays = useMemo(() => {
    const s = new Set<string>()
    for (const it of items) if (it.layer === 'school') { const { first: a, last: b } = itemDays(it); for (let d = a; d <= b; d = addDays(d, 1)) s.add(ymd(d)) }
    return s
  }, [items])

  const [rowH, setRowH] = useState(120)
  const gridRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setRowH(el.clientHeight / weeks.length))
    ro.observe(el); return () => ro.disconnect()
  }, [weeks.length])
  const maxLanes = Math.max(1, Math.floor((rowH - HEAD - 4) / LANE))

  const dragging = useRef<CalItem | null>(null)
  const [over, setOver] = useState<string | null>(null)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {WD_SHORT.map((w, i) => <div key={w} className={`text-center text-[11px] font-semibold uppercase tracking-wide py-2 ${i >= 5 ? 'text-slate-400' : 'text-slate-500'}`}>{w}</div>)}
      </div>
      <div ref={gridRef} className="flex-1 grid min-h-0 overflow-y-auto" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(110px, 1fr))` }}>
        {weeks.map(ws => {
          const segs = weekSegments(items, ws)
          const shown = segs.filter(s => s.lane < maxLanes)
          const hiddenPerDay = Array(7).fill(0)
          for (const s of segs) if (s.lane >= maxLanes) for (let c = s.col; c < s.col + s.span; c++) hiddenPerDay[c]++
          // ако в деня има скрити — показваме един ред по-малко, за да се събере „+N още“
          const visibleSegs = shown.filter(s => {
            if (s.lane !== maxLanes - 1) return true
            for (let c = s.col; c < s.col + s.span; c++) if (hiddenPerDay[c] > 0) return false
            return true
          })
          const moreCount = Array.from({ length: 7 }, (_, c) => hiddenPerDay[c] + shown.filter(s => s.lane === maxLanes - 1 && !visibleSegs.includes(s) && c >= s.col && c < s.col + s.span).length)
          return (
            <div key={ws.toISOString()} className="relative border-b border-slate-200 last:border-b-0">
              {/* клетки на дните */}
              <div className="absolute inset-0 grid grid-cols-7">
                {Array.from({ length: 7 }, (_, c) => {
                  const d = addDays(ws, c)
                  const inMonth = d.getMonth() === anchor.getMonth()
                  const isToday = sameDay(d, now)
                  const key = ymd(d)
                  const off = offDays.has(key) || isoWd(d) >= 6
                  return (
                    <div key={c}
                      onClick={() => onCreate(d)}
                      onDragOver={e => { if (dragging.current) { e.preventDefault(); setOver(key) } }}
                      onDragLeave={() => setOver(o => (o === key ? null : o))}
                      onDrop={e => {
                        e.preventDefault(); setOver(null)
                        const it = dragging.current; dragging.current = null
                        if (!it) return
                        const delta = dayDiff(itemDays(it).first, d)
                        if (delta) onMove(it, addDays(it.start, delta), addDays(it.end, delta))
                      }}
                      className={`border-r border-slate-100 last:border-r-0 cursor-pointer transition-colors
                        ${over === key ? 'bg-blue-50' : off ? 'bg-slate-50/80' : 'bg-white hover:bg-slate-50/50'}`}>
                      <div className="flex justify-center pt-1">
                        <button onClick={e => { e.stopPropagation(); onDay(d) }}
                          className={`min-w-[26px] h-[22px] px-1 rounded-full text-[12px] tabular-nums transition-colors
                            ${isToday ? 'bg-blue-600 text-white font-semibold' : inMonth ? 'text-slate-700 hover:bg-slate-200' : 'text-slate-300 hover:bg-slate-100'}`}>
                          {d.getDate() === 1 ? `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}.` : d.getDate()}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* ленти */}
              {visibleSegs.map(s => {
                const it = s.item
                const bar = isMultiDay(it)
                const draggable = canEdit(it) && it.event?.recur_freq === 'none'
                const pending = it.myResponse === 'pending'
                return (
                  <button key={`${it.key}:${ws.getTime()}`}
                    draggable={draggable}
                    onDragStart={e => { dragging.current = it; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', it.key) }}
                    onDragEnd={() => { dragging.current = null; setOver(null) }}
                    onClick={e => { e.stopPropagation(); onOpen(it) }}
                    title={`${it.allDay ? '' : hm(it.start) + ' '}${it.title}${it.subtitle ? ' — ' + it.subtitle : ''}`}
                    className={`absolute flex items-center gap-1.5 text-[12px] leading-none overflow-hidden whitespace-nowrap transition-[filter] hover:brightness-95
                      ${bar ? 'px-2 font-medium' : 'px-1.5 hover:bg-slate-100 rounded-md'}
                      ${it.done ? 'opacity-55' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    style={{
                      top: HEAD + s.lane * LANE, height: LANE - 3,
                      left: `calc(${(s.col / 7) * 100}% + ${s.contLeft ? 0 : 4}px)`,
                      width: `calc(${(s.span / 7) * 100}% - ${(s.contLeft ? 0 : 4) + (s.contRight ? 0 : 4)}px)`,
                      ...(bar ? {
                        backgroundColor: pending ? '#fff' : it.color, color: pending ? it.color : '#fff',
                        border: pending ? `1.5px dashed ${it.color}` : undefined,
                        borderRadius: `${s.contLeft ? 0 : 6}px ${s.contRight ? 0 : 6}px ${s.contRight ? 0 : 6}px ${s.contLeft ? 0 : 6}px`,
                      } : {}),
                    }}>
                    {!bar && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pending ? 'transparent' : it.color, border: `2px solid ${it.color}` }} />}
                    {!bar && !it.allDay && <span className="text-slate-500 tabular-nums shrink-0">{hm(it.start)}</span>}
                    <span className={`truncate ${!bar ? 'text-slate-800' : ''} ${it.done ? 'line-through' : ''}`}>{it.title}</span>
                  </button>
                )
              })}
              {moreCount.map((n, c) => n > 0 && (
                <button key={`more${c}`} onClick={e => { e.stopPropagation(); onMore(addDays(ws, c)) }}
                  className="absolute text-[11.5px] font-medium text-slate-600 hover:bg-slate-100 rounded-md px-2 text-left"
                  style={{ top: HEAD + (maxLanes - 1) * LANE, height: LANE - 3, left: `calc(${(c / 7) * 100}% + 4px)`, width: `calc(${100 / 7}% - 8px)` }}>
                  + още {n}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
