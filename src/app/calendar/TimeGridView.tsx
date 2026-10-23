'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type CalItem, WD_SHORT, startOfDay, addDays, addMinutes, sameDay, isoWd, weekSegments, layoutDay, itemDays, isMultiDay, hm, ymd,
} from '@/lib/calendar'

const HOUR = 48
const PPM = HOUR / 60
const SNAP = 15
const GUTTER = 56

type Drag = {
  mode: 'create' | 'move' | 'resize'
  item?: CalItem
  x0: number; y0: number
  dayIdx0: number; min0: number
  start: Date; end: Date
  moved: boolean
}

export default function TimeGridView({ days, items, now, canEdit, onOpen, onDay, onMove, onCreate, onMore }: {
  days: Date[]; items: CalItem[]; now: Date
  canEdit: (it: CalItem) => boolean
  onOpen: (it: CalItem) => void; onDay: (d: Date) => void
  onMove: (it: CalItem, start: Date, end: Date) => void
  onCreate: (start: Date, end: Date, allDay?: boolean) => void
  onMore: (d: Date) => void
}) {
  const n = days.length
  const first = days[0]
  const lastEnd = addDays(days[n - 1], 1)
  const inRange = (it: CalItem) => { const { first: a, last: b } = itemDays(it); return b >= first && a < lastEnd }
  const allDayItems = useMemo(() => items.filter(it => inRange(it) && isMultiDay(it)), [items, first.getTime(), n]) // eslint-disable-line react-hooks/exhaustive-deps
  const timed = useMemo(() => items.filter(it => inRange(it) && !isMultiDay(it)), [items, first.getTime(), n]) // eslint-disable-line react-hooks/exhaustive-deps
  const segs = useMemo(() => weekSegments(allDayItems, first, n), [allDayItems, first.getTime(), n]) // eslint-disable-line react-hooks/exhaustive-deps
  const lanes = segs.reduce((m, s) => Math.max(m, s.lane + 1), 0)
  const [expanded, setExpanded] = useState(false)
  const maxLanes = expanded ? lanes : Math.min(lanes, 3)
  const hiddenPerDay = Array(n).fill(0)
  if (!expanded) for (const s of segs) if (s.lane >= 3) for (let c = s.col; c < s.col + s.span; c++) hiddenPerDay[c]++

  const offDays = useMemo(() => {
    const s = new Set<string>()
    for (const it of items) if (it.layer === 'school') { const { first: a, last: b } = itemDays(it); for (let d = a; d <= b; d = addDays(d, 1)) s.add(ymd(d)) }
    return s
  }, [items])

  // в началото — към 7:30 (или час преди сега, ако днес се вижда)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const showsToday = days.some(d => sameDay(d, now))
    const h = showsToday ? Math.max(0, Math.min(now.getHours() - 1, 16)) : 7.5
    el.scrollTop = h * HOUR
  }, [first.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── влачене: създаване (по празно), преместване и разтягане (свои събития) ──
  const cols = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const pos = (e: React.PointerEvent | PointerEvent) => {
    const r = cols.current!.getBoundingClientRect()
    const idx = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n)))
    const min = Math.min(24 * 60, Math.max(0, Math.round(((e.clientY - r.top) / PPM) / SNAP) * SNAP))
    return { idx, min }
  }
  const atMin = (d: Date, min: number) => { const x = startOfDay(d); x.setMinutes(min); return x }

  function begin(e: React.PointerEvent, mode: Drag['mode'], item?: CalItem) {
    if (e.button !== 0) return
    e.stopPropagation()
    const { idx, min } = pos(e)
    const d: Drag = {
      mode, item, x0: e.clientX, y0: e.clientY, dayIdx0: idx, min0: min,
      start: item ? item.start : atMin(days[idx], Math.floor(min / 30) * 30),
      end: item ? item.end : atMin(days[idx], Math.floor(min / 30) * 30 + 60),
      moved: false,
    }
    dragRef.current = d
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    if (mode === 'create') setDrag(d)
  }
  function move(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    if (!d.moved && Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) < 5) return
    const { idx, min } = pos(e)
    let start = d.start, end = d.end
    if (d.mode === 'create') {
      const a = atMin(days[d.dayIdx0], Math.floor(d.min0 / SNAP) * SNAP)
      const b = atMin(days[d.dayIdx0], min)
      start = b < a ? b : a
      end = b < a ? addMinutes(a, SNAP) : (b.getTime() === a.getTime() ? addMinutes(a, 30) : b)
    } else if (d.mode === 'move' && d.item) {
      const delta = (idx - d.dayIdx0) * 1440 + (min - d.min0)
      start = addMinutes(d.item.start, delta); end = addMinutes(d.item.end, delta)
    } else if (d.mode === 'resize' && d.item) {
      const delta = min - d.min0
      end = addMinutes(d.item.end, delta)
      if (end.getTime() - start.getTime() < SNAP * 60000) end = addMinutes(start, SNAP)
    }
    const nd = { ...d, start, end, moved: true }
    dragRef.current = nd
    setDrag(nd)
  }
  function end() {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!d) return
    if (d.mode === 'create') { onCreate(d.start, d.end); return }
    if (!d.item) return
    if (!d.moved) { onOpen(d.item); return }
    if (d.start.getTime() !== d.item.start.getTime() || d.end.getTime() !== d.item.end.getTime()) onMove(d.item, d.start, d.end)
  }

  const nowMin = now.getHours() * 60 + now.getMinutes()

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* заглавия на дните */}
      <div className="flex border-b border-slate-200 overflow-y-hidden" style={{ scrollbarGutter: 'stable' }}>
        <div style={{ width: GUTTER }} className="shrink-0 text-[10px] text-slate-400 flex items-end justify-end pr-2 pb-1"></div>
        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {days.map(d => {
            const isToday = sameDay(d, now)
            return (
              <button key={d.toISOString()} onClick={() => onDay(d)} className="py-2 flex flex-col items-center group">
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? 'text-blue-600' : isoWd(d) >= 6 ? 'text-slate-400' : 'text-slate-500'}`}>{WD_SHORT[isoWd(d) - 1]}</span>
                <span className={`mt-0.5 w-10 h-10 flex items-center justify-center rounded-full text-[22px] tabular-nums transition-colors
                  ${isToday ? 'bg-blue-600 text-white font-semibold' : 'text-slate-800 group-hover:bg-slate-100'}`}>{d.getDate()}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* целодневни */}
      {(lanes > 0 || n === 1) && (
        <div className="flex border-b border-slate-200 bg-white overflow-y-hidden" style={{ scrollbarGutter: 'stable' }}>
          <div style={{ width: GUTTER }} className="shrink-0 text-[10px] text-slate-400 text-right pr-2 pt-1.5">
            цял ден
            {lanes > 3 && <button onClick={() => setExpanded(x => !x)} className="block ml-auto mt-0.5 text-blue-600 hover:underline">{expanded ? 'по-малко' : 'всички'}</button>}
          </div>
          <div className="flex-1 relative" style={{ height: Math.max(maxLanes, 1) * 24 + 6 + (hiddenPerDay.some(x => x) ? 20 : 0) }}
            onDoubleClick={e => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
              const idx = Math.floor(((e.clientX - r.left) / r.width) * n)
              const d = days[Math.max(0, Math.min(n - 1, idx))]
              const s = startOfDay(d); s.setHours(9)
              onCreate(s, addMinutes(s, 60), true)
            }}>
            {segs.filter(s => s.lane < maxLanes).map(s => {
              const it = s.item
              const pending = it.myResponse === 'pending'
              return (
                <button key={it.key} onClick={() => onOpen(it)} title={`${it.title}${it.subtitle ? ' — ' + it.subtitle : ''}`}
                  className={`absolute px-2 text-[12px] font-medium text-left truncate hover:brightness-95 ${it.done ? 'opacity-55 line-through' : ''}`}
                  style={{
                    top: 3 + s.lane * 24, height: 21, lineHeight: '21px',
                    left: `calc(${(s.col / n) * 100}% + 2px)`, width: `calc(${(s.span / n) * 100}% - 4px)`,
                    backgroundColor: pending ? '#fff' : it.color, color: pending ? it.color : '#fff',
                    border: pending ? `1.5px dashed ${it.color}` : undefined,
                    borderRadius: `${s.contLeft ? 0 : 6}px ${s.contRight ? 0 : 6}px ${s.contRight ? 0 : 6}px ${s.contLeft ? 0 : 6}px`,
                  }}>
                  {it.title}
                </button>
              )
            })}
            {hiddenPerDay.map((c, i) => c > 0 && (
              <button key={i} onClick={() => onMore(days[i])} className="absolute text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded px-2 text-left"
                style={{ top: 3 + 3 * 24, height: 18, left: `calc(${(i / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)` }}>+ още {c}</button>
            ))}
          </div>
        </div>
      )}

      {/* часова мрежа */}
      <div ref={scroller} className="flex-1 overflow-y-auto relative select-none" style={{ scrollbarGutter: 'stable' }}>
        <div className="flex" style={{ height: 24 * HOUR }}>
          <div style={{ width: GUTTER }} className="shrink-0 relative">
            {Array.from({ length: 23 }, (_, h) => (
              <div key={h} className="absolute right-2 text-[10.5px] text-slate-400 tabular-nums -translate-y-1/2" style={{ top: (h + 1) * HOUR }}>{h + 1}:00</div>
            ))}
          </div>
          <div ref={cols} className="flex-1 grid relative border-l border-slate-200" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
            onPointerDown={e => begin(e, 'create')} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { dragRef.current = null; setDrag(null) }}>
            {/* часови линии */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="absolute left-0 right-0 border-t border-slate-100" style={{ top: h * HOUR }}>
                  <div className="absolute left-0 right-0 border-t border-dashed border-slate-50" style={{ top: HOUR / 2 }} />
                </div>
              ))}
            </div>
            {days.map(d => {
              const isToday = sameDay(d, now)
              const off = offDays.has(ymd(d)) || isoWd(d) >= 6
              const placed = layoutDay(timed.filter(it => sameDay(it.start, d)), d, PPM)
              return (
                <div key={d.toISOString()} className={`relative border-r border-slate-100 last:border-r-0 ${off ? 'bg-slate-50/70' : ''}`}>
                  {/* извън работното време — по-бледо */}
                  {!off && <>
                    <div className="absolute left-0 right-0 top-0 bg-slate-50/60 pointer-events-none" style={{ height: 7.5 * HOUR }} />
                    <div className="absolute left-0 right-0 bg-slate-50/60 pointer-events-none" style={{ top: 18 * HOUR, bottom: 0 }} />
                  </>}
                  {placed.map(p => {
                    const it = p.item
                    const editable = canEdit(it) && it.event?.recur_freq === 'none'
                    const isDragged = drag?.item?.key === it.key && drag.moved
                    const pending = it.myResponse === 'pending'
                    const short = p.height < 36
                    return (
                      <div key={it.key}
                        onPointerDown={e => { if (editable) begin(e, 'move', it); else e.stopPropagation() }}
                        onClick={e => { e.stopPropagation(); if (!editable) onOpen(it) }}
                        title={`${hm(it.start)}–${hm(it.end)} ${it.title}`}
                        className={`absolute rounded-md overflow-hidden text-[12px] leading-tight px-1.5 py-0.5 shadow-[0_0_0_1px_white] transition-opacity
                          ${editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isDragged ? 'opacity-30' : ''} ${it.done ? 'opacity-55' : ''} hover:z-10 hover:shadow-md`}
                        style={{
                          top: p.top, height: p.height - 1,
                          left: `calc(${p.left * 100}% + 1px)`, width: `calc(${p.width * 100}% - 3px)`,
                          backgroundColor: pending ? '#fff' : `${it.color}1f`, borderLeft: `3px solid ${it.color}`,
                          outline: pending ? `1.5px dashed ${it.color}` : undefined, outlineOffset: -1.5,
                        }}>
                        <div className={`font-semibold truncate ${it.done ? 'line-through' : ''}`} style={{ color: shade(it.color) }}>
                          {it.title}{short && <span className="font-normal opacity-80">, {hm(it.start)}</span>}
                        </div>
                        {!short && <div className="text-[11px] truncate" style={{ color: shade(it.color) }}>{hm(it.start)} – {hm(it.end)}{it.location ? ` · ${it.location}` : ''}</div>}
                        {!short && p.height > 64 && it.subtitle && <div className="text-[11px] text-slate-500 truncate">{it.subtitle}</div>}
                        {editable && <div onPointerDown={e => begin(e, 'resize', it)} className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize" />}
                      </div>
                    )
                  })}
                  {/* предварителен изглед при влачене */}
                  {drag && drag.moved && sameDay(drag.start, d) && (
                    <div className="absolute left-1 right-1 rounded-md bg-blue-600/85 text-white text-[12px] px-1.5 py-0.5 shadow-lg pointer-events-none z-20"
                      style={{ top: (drag.start.getHours() * 60 + drag.start.getMinutes()) * PPM, height: Math.max(18, (drag.end.getTime() - drag.start.getTime()) / 60000 * PPM) }}>
                      <div className="font-semibold truncate">{drag.item ? drag.item.title : 'Ново събитие'}</div>
                      <div className="text-[11px] opacity-90">{hm(drag.start)} – {hm(drag.end)}</div>
                    </div>
                  )}
                  {isToday && (
                    <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowMin * PPM }}>
                      <div className="absolute -left-1.5 -top-[5px] w-2.5 h-2.5 rounded-full bg-red-500" />
                      <div className="border-t-2 border-red-500" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// по-тъмен нюанс на цвета за текста върху светъл фон
function shade(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#1e293b'
  const v = parseInt(m[1], 16)
  const f = (c: number) => Math.round(c * 0.62)
  return `rgb(${f((v >> 16) & 255)}, ${f((v >> 8) & 255)}, ${f(v & 255)})`
}
