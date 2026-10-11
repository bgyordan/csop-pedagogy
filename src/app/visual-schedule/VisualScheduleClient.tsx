'use client'

// Визуалният график: денят на паралелката като поредица от картинки.
// • На екрана (смарт дъска, таблет): „Сега“ и „После“ с голяма картинка, отминалото е отметнато.
// • За печат: денят вертикално (A4) или цялата седмица (A4 хоризонтално).
// Картинката и краткото име на всеки предмет могат да се сменят — пазят се в този браузър.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Printer, Maximize2, Minimize2, Pencil, Check, X, Search, Loader2 } from 'lucide-react'
import { pictoUrl, subjectPicto } from '@/lib/pictos'
import type { PictoCatalog } from '@/lib/pictos'

export type Slot = { day: number; period: number; subject: string; start: number; end: number }
type Item = { id: string; label: string; picto: string; start: number; end: number; subject?: string }
type Override = { picto?: string; label?: string }

const DAYS = ['', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък']
const SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт']
const COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#ea580c', '#0d9488', '#4f46e5', '#65a30d']
const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`

// кратки имена за дългите предмети (колегата може да ги смени)
function shortLabel(s: string) {
  const n = s.toLowerCase()
  if (/български език/.test(n)) return 'Български език'
  if (/физическо възпитание/.test(n)) return 'Физкултура'
  if (/изобразително/.test(n)) return 'Рисуване'
  if (/технологии и предприемачество/.test(n)) return 'Технологии'
  if (/компютърно моделиране/.test(n)) return 'Компютри'
  return s.length > 28 ? s.slice(0, 26) + '…' : s
}

type Extras = { arrival: boolean; bigBreak: boolean; home: boolean }
const EXTRA_DEFAULT: Extras = { arrival: true, bigBreak: true, home: true }

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? { ...fallback, ...JSON.parse(v) } : fallback } catch { return fallback }
}
function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* без памет */ } }

function sofiaNow() {
  const d = new Date()
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Sofia', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value || ''
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1
  return { day: wd, min: Number(get('hour')) * 60 + Number(get('minute')) }
}

export default function VisualScheduleClient({ classes, classId, className, term, yearName, slots }: {
  classes: { id: string; name: string }[]; classId: string; className: string; term: number; yearName: string; slots: Slot[]
}) {
  const router = useRouter()
  const [now, setNow] = useState<{ day: number; min: number } | null>(null)
  const [day, setDay] = useState(1)
  const [extras, setExtras] = useState<Extras>(EXTRA_DEFAULT)
  const [over, setOver] = useState<Record<string, Override>>({})
  const [edit, setEdit] = useState(false)
  const [picking, setPicking] = useState<Item | null>(null)
  const [full, setFull] = useState(false)
  const [print, setPrint] = useState<'day' | 'week' | null>(null)
  const board = useRef<HTMLDivElement>(null)

  // часовник + запомнени настройки (само в браузъра)
  useEffect(() => {
    const n = sofiaNow()
    setNow(n)
    setDay(n.day >= 1 && n.day <= 5 ? n.day : 1)
    setExtras(load('vs-extras', EXTRA_DEFAULT))
    setOver(load<Record<string, Override>>('vs-pictos', {}))
    const t = setInterval(() => setNow(sofiaNow()), 30_000)
    const fs = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', fs)
    return () => { clearInterval(t); document.removeEventListener('fullscreenchange', fs) }
  }, [])

  useEffect(() => {
    if (!print) return
    const done = () => setPrint(null)
    window.addEventListener('afterprint', done)
    const t = setTimeout(() => window.print(), 150)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done) }
  }, [print])

  const itemsFor = useMemo(() => (d: number): Item[] => {
    const daySlots = slots.filter(s => s.day === d).sort((a, b) => a.start - b.start)
    const out: Item[] = []
    for (const s of daySlots) {
      const prev = out[out.length - 1]
      // поредни часове по един предмет → една картинка
      if (prev && prev.subject === s.subject && s.start - prev.end <= 15) { prev.end = s.end; continue }
      const o = over[s.subject] || {}
      out.push({ id: `${d}-${s.period}`, subject: s.subject, label: o.label || shortLabel(s.subject), picto: o.picto || subjectPicto(s.subject), start: s.start, end: s.end })
    }
    if (!out.length) return out
    const ex = (k: string, label: string, picto: string, start: number, end: number): Item => {
      const o = over['#' + k] || {}
      return { id: `${d}-${k}`, subject: '#' + k, label: o.label || label, picto: o.picto || picto, start, end }
    }
    if (extras.bigBreak && out.some(i => i.end <= 9 * 60 + 50) && out.some(i => i.start >= 10 * 60 + 20)) {
      const at = out.findIndex(i => i.start >= 10 * 60 + 20)
      out.splice(at, 0, ex('break', 'Закуска и почивка', 'breakfast', 9 * 60 + 50, 10 * 60 + 20))
    }
    if (extras.arrival) out.unshift(ex('arrival', 'Идвам в училище', 'bus_school', Math.min(out[0].start - 20, 8 * 60 + 10), out[0].start))
    if (extras.home) { const last = out[out.length - 1].end; out.push(ex('home', 'Прибирам се вкъщи', 'home', last, last + 30)) }
    return out
  }, [slots, extras, over])

  const items = itemsFor(day)
  const isToday = now?.day === day
  const curIdx = isToday && now ? items.findIndex(i => now.min >= i.start && now.min < i.end) : -1
  const nextIdx = isToday && now ? items.findIndex(i => i.start > now.min) : -1
  const nowItem = curIdx >= 0 ? items[curIdx] : null
  const afterItem = curIdx >= 0 ? items[curIdx + 1] : (nextIdx >= 0 ? items[nextIdx] : null)
  const past = (i: Item) => !!(isToday && now && now.min >= i.end)
  const colorOf = (i: Item, k: number) => COLORS[(i.subject || '').length % COLORS.length] || COLORS[k % COLORS.length]

  function setExtra(k: keyof Extras, v: boolean) { const e = { ...extras, [k]: v }; setExtras(e); save('vs-extras', e) }
  function saveOverride(subject: string, o: Override) {
    const m = { ...over, [subject]: { ...over[subject], ...o } }
    setOver(m); save('vs-pictos', m)
  }
  function resetOverride(subject: string) { const m = { ...over }; delete m[subject]; setOver(m); save('vs-pictos', m) }
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen()
    else board.current?.requestFullscreen?.()
  }

  const chip = (on: boolean) => `px-3 py-1.5 rounded-lg text-[13px] transition-all ${on ? 'bg-white text-[#0f2240] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240] bg-white'
  const hasAny = slots.length > 0

  return (
    <>
      {/* ── Управление ── */}
      <div className="print:hidden space-y-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {classes.length > 1 && (
            <select value={classId} onChange={e => router.push(`/visual-schedule?c=${e.target.value}`)}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm">
              {classes.map(c => <option key={c.id} value={c.id}>Паралелка {c.name}</option>)}
            </select>
          )}
          {classes.length === 1 && <span className="text-sm text-slate-700 px-1">Паралелка {className}</span>}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {[1, 2, 3, 4, 5].map(d => (
              <button key={d} type="button" onClick={() => setDay(d)} className={chip(day === d)}>
                {SHORT[d]}{now?.day === d && <span className="ml-1 text-[10px] text-sky-600">днес</span>}
              </button>
            ))}
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {[1, 2].map(t => (
              <button key={t} type="button" onClick={() => router.push(`/visual-schedule?c=${classId}&term=${t}`)} className={chip(term === t)}>{t === 1 ? 'I' : 'II'} срок</button>
            ))}
          </div>
          <div className="flex-1" />
          <button type="button" onClick={() => setEdit(!edit)} className={`${btn} ${edit ? '!border-sky-500 !text-sky-700 !bg-sky-50' : ''}`}>
            {edit ? <Check size={14} /> : <Pencil size={14} />} {edit ? 'Готово' : 'Смени картинки'}
          </button>
          <button type="button" onClick={toggleFull} className={btn} disabled={!hasAny}><Maximize2 size={14} /> На цял екран</button>
          <button type="button" onClick={() => setPrint('day')} className={btn} disabled={!hasAny}><Printer size={14} /> Печат: денят</button>
          <button type="button" onClick={() => setPrint('week')} className={btn} disabled={!hasAny}><Printer size={14} /> Печат: седмицата</button>
        </div>
        <div className="flex flex-wrap gap-4 text-[13px] text-slate-600">
          {([['arrival', 'Пристигане'], ['bigBreak', 'Голямо междучасие (закуска)'], ['home', 'Прибиране вкъщи']] as [keyof Extras, string][]).map(([k, l]) => (
            <label key={k} className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={extras[k]} onChange={e => setExtra(k, e.target.checked)} className="accent-[#0f2240]" /> {l}
            </label>
          ))}
          {edit && <span className="text-sky-700">Натиснете картинка, за да я смените. Промяната важи за предмета във всички дни (само на този компютър).</span>}
        </div>
      </div>

      {/* ── Таблото ── */}
      <div ref={board} className={`print:hidden bg-white ${full ? 'p-8 overflow-auto' : 'rounded-3xl border border-slate-200 shadow-sm p-5 md:p-7'}`}>
        <div className="flex items-baseline justify-between gap-3 mb-5">
          <div>
            <div className={`${full ? 'text-5xl' : 'text-2xl md:text-3xl'} font-semibold text-[#0f2240]`}>{DAYS[day]}</div>
            <div className="text-sm text-slate-500 mt-1">Паралелка {className} · {term === 1 ? 'I' : 'II'} срок · {yearName}</div>
          </div>
          {isToday && now && <div className={`${full ? 'text-5xl' : 'text-3xl'} font-semibold tabular-nums text-slate-700`}>{fmt(now.min)}</div>}
          {full && <button type="button" onClick={toggleFull} className="p-2 rounded-xl text-slate-400 hover:text-slate-700"><Minimize2 size={22} /></button>}
        </div>

        {!hasAny ? (
          <div className="border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-500">
            Паралелката няма разписание за {term === 1 ? 'I' : 'II'} срок.
          </div>
        ) : items.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-500">Няма часове в този ден.</div>
        ) : (
          <>
            {isToday && (nowItem || afterItem) && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[['СЕГА', nowItem, '#16a34a'], ['ПОСЛЕ', afterItem, '#2563eb']].map(([t, it, col]) => (
                  <div key={t as string} className="rounded-3xl border-4 p-4 md:p-6 flex items-center gap-4 md:gap-6" style={{ borderColor: col as string, backgroundColor: (col as string) + '10' }}>
                    {it ? (
                      <>
                        <img src={pictoUrl((it as Item).picto)} alt="" className={full ? 'w-48 h-48' : 'w-24 h-24 md:w-32 md:h-32'} />
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold tracking-widest" style={{ color: col as string }}>{t as string}</div>
                          <div className={`${full ? 'text-5xl' : 'text-2xl md:text-3xl'} font-semibold text-slate-800 leading-tight`}>{(it as Item).label}</div>
                          <div className={`${full ? 'text-2xl' : 'text-sm'} text-slate-500 mt-1 tabular-nums`}>{fmt((it as Item).start)} – {fmt((it as Item).end)}</div>
                        </div>
                      </>
                    ) : <div className="text-slate-400">{t === 'СЕГА' ? 'Междучасие' : 'Краят на деня'}</div>}
                  </div>
                ))}
              </div>
            )}

            <div className={`grid gap-3 ${full ? 'grid-cols-[repeat(auto-fill,minmax(190px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(140px,1fr))]'}`}>
              {items.map((it, k) => {
                const isPast = past(it), isNow = k === curIdx
                const col = colorOf(it, k)
                return (
                  <button key={it.id} type="button" disabled={!edit} onClick={() => setPicking(it)}
                    className={`relative text-left rounded-2xl border-2 p-3 flex flex-col items-center transition-all ${edit ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : 'cursor-default'} ${isPast ? 'opacity-40' : ''} ${isNow ? 'ring-4 ring-emerald-400 scale-[1.03]' : ''}`}
                    style={{ borderColor: col + '55', backgroundColor: col + '0d' }}>
                    <span className="absolute top-2 left-2.5 text-[12px] font-bold" style={{ color: col }}>{k + 1}</span>
                    {isPast && <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center"><Check size={15} /></span>}
                    {edit && <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center"><Pencil size={12} /></span>}
                    <img src={pictoUrl(it.picto)} alt="" className={full ? 'w-32 h-32 my-2' : 'w-20 h-20 my-2'} />
                    <div className={`${full ? 'text-xl' : 'text-[14px]'} font-semibold text-slate-800 text-center leading-snug`}>{it.label}</div>
                    <div className={`${full ? 'text-base' : 'text-[12px]'} text-slate-500 tabular-nums mt-0.5`}>{fmt(it.start)}</div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Печат ── */}
      {print && <style>{`@page { size: A4 ${print === 'day' ? 'portrait' : 'landscape'}; margin: 10mm; } .vs-print, .vs-print * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } @media print { .bg-slate-50 { background: white !important; } main > div { padding: 0 !important; } }`}</style>}
      <div className={`vs-print hidden ${print === 'day' ? 'print:block' : ''}`}>
        <PrintDay title={DAYS[day]} className={className} items={items} colorOf={colorOf} />
      </div>
      <div className={`vs-print hidden ${print === 'week' ? 'print:block' : ''}`}>
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[22px] font-semibold text-[#0f2240]">Моята седмица</div>
          <div className="text-[12px] text-slate-500">Паралелка {className} · {term === 1 ? 'I' : 'II'} срок</div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map(d => (
            <div key={d} className="border-2 border-slate-200 rounded-2xl overflow-hidden">
              <div className="text-center text-[14px] font-bold text-white py-1.5" style={{ backgroundColor: COLORS[d] }}>{DAYS[d]}</div>
              <div className="p-1.5 space-y-1.5">
                {itemsFor(d).map((it, k) => (
                  <div key={it.id} className="flex items-center gap-1.5 rounded-lg px-1 py-0.5" style={{ backgroundColor: colorOf(it, k) + '12' }}>
                    <img src={pictoUrl(it.picto)} alt="" className="w-11 h-11 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold text-slate-800 leading-tight">{it.label}</div>
                      <div className="text-[10px] text-slate-500 tabular-nums">{fmt(it.start)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="text-[8px] text-slate-400 mt-2 text-right">ЦСОП Варна · ЕИС · Пиктограми: Twemoji, CC-BY 4.0</div>
      </div>

      {picking && (
        <PictoPicker item={picking} hasOverride={!!over[picking.subject || '']}
          onClose={() => setPicking(null)}
          onReset={() => { resetOverride(picking.subject || ''); setPicking(null) }}
          onSave={(o) => { saveOverride(picking.subject || '', o); setPicking(null) }} />
      )}
    </>
  )
}

function PrintDay({ title, className, items, colorOf }: { title: string; className: string; items: Item[]; colorOf: (i: Item, k: number) => string }) {
  const n = Math.max(items.length, 1)
  const h = Math.min(60, Math.floor(250 / n))   // мм на ред — денят се събира на една страница
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[26px] font-semibold text-[#0f2240]">Моят ден · {title}</div>
        <div className="text-[12px] text-slate-500">Паралелка {className}</div>
      </div>
      <div className="space-y-[2mm]">
        {items.map((it, k) => {
          const col = colorOf(it, k)
          return (
            <div key={it.id} className="flex items-center gap-4 border-2 rounded-2xl px-4" style={{ height: `${h - 2}mm`, borderColor: col, backgroundColor: col + '12', breakInside: 'avoid' }}>
              <div className="text-[18px] font-bold w-6" style={{ color: col }}>{k + 1}</div>
              <img src={pictoUrl(it.picto)} alt="" style={{ height: `${h - 8}mm`, width: `${h - 8}mm` }} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800" style={{ fontSize: `${Math.min(26, h * 0.9)}px` }}>{it.label}</div>
                <div className="text-[12px] text-slate-500 tabular-nums">{fmt(it.start)} – {fmt(it.end)}</div>
              </div>
              <div className="w-[9mm] h-[9mm] border-2 rounded-md bg-white" style={{ borderColor: col }} />
            </div>
          )
        })}
      </div>
      <div className="text-[8px] text-slate-400 mt-2 text-right">ЦСОП Варна · ЕИС · Пиктограми: Twemoji, CC-BY 4.0</div>
    </div>
  )
}

let catalogCache: PictoCatalog | null = null

function PictoPicker({ item, hasOverride, onClose, onSave, onReset }: {
  item: Item; hasOverride: boolean; onClose: () => void; onSave: (o: Override) => void; onReset: () => void
}) {
  const [cat, setCat] = useState<PictoCatalog | null>(catalogCache)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('school')
  const [picto, setPicto] = useState(item.picto)
  const [label, setLabel] = useState(item.label)

  useEffect(() => {
    if (catalogCache) return
    // каталогът се вгражда в приложението (не зависи от достъпа до public/)
    import('../../../public/pictos/catalog.json').then(m => { catalogCache = (m.default || m) as unknown as PictoCatalog; setCat(catalogCache) }).catch(() => {})
  }, [])

  const list = (cat?.items || []).filter(i => q ? i.label.toLowerCase().includes(q.toLowerCase()) : i.cat === group)

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 print:hidden" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 p-5 border-b border-slate-100">
          <img src={pictoUrl(picto)} alt="" className="w-16 h-16" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-slate-500">{item.subject?.startsWith('#') ? 'Допълнителна стъпка' : item.subject}</div>
            <input value={label} onChange={e => setLabel(e.target.value)} maxLength={40}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300 text-[15px] focus:outline-none focus:border-[#0f2240]" />
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="px-5 pt-4 space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl">
            <Search size={15} className="text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси картинка — напр. „музика“, „обяд“" className="flex-1 text-[14px] focus:outline-none" />
          </div>
          {!q && cat && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(cat.categories).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setGroup(k)}
                  className={`px-2.5 py-1 rounded-lg text-[12.5px] ${group === k ? 'bg-[#0f2240] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{l}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-auto p-5 grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
          {!cat && <Loader2 className="animate-spin text-slate-400" />}
          {list.map(i => (
            <button key={i.key} type="button" onClick={() => setPicto(i.key)}
              className={`rounded-2xl border-2 p-2 flex flex-col items-center gap-1 hover:bg-slate-50 ${picto === i.key ? 'border-sky-500 bg-sky-50' : 'border-transparent'}`}>
              <img src={pictoUrl(i.key)} alt="" className="w-12 h-12" loading="lazy" />
              <span className="text-[11.5px] text-slate-600 text-center leading-tight">{i.label}</span>
            </button>
          ))}
          {cat && !list.length && <div className="text-sm text-slate-400 col-span-full">Няма такава картинка.</div>}
        </div>
        <div className="flex items-center gap-2 p-4 border-t border-slate-100">
          {hasOverride && <button type="button" onClick={onReset} className="text-[13px] text-slate-500 hover:text-rose-600">Върни стандартната</button>}
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-sm">Откажи</button>
          <button type="button" onClick={() => onSave({ picto, label: label.trim() || undefined })}
            className="px-4 py-2 rounded-xl text-white text-sm" style={{ backgroundColor: '#0f2240' }}>Запази</button>
        </div>
      </div>
    </div>
  )
}
