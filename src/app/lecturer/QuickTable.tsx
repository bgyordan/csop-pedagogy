'use client'
// Бърза таблица: за всеки от учебния план — годишният брой лекторски часове (същият като в Справки → „Кратко“),
// по избрания метод: „0,7 постоянно“ или „0,7 до нормата, после 1“.
// „Разпредели“ слага годишния брой в разписанието му: 1 ч./седм. от началото на годината до събиране
// на числото; над годината на паралелката (32/34/36) — следващ час, пак от началото.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Wand2, Pencil, Search, Check, AlertTriangle, CalendarCheck, FileDown, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { smartMatch } from '@/lib/search'
import { autoDistribute, saveYearEnds, clearAllLecturerSlots } from './actions'
import { downloadLecturerOrder } from './OrderButton'
import { slotHours, GROUPS } from './distribute'
import type { Ends, Grp } from './distribute'

export type QTRow = {
  id: string; name: string; position: string; hasPlan: boolean
  classes: { name: string; end: string }[]
  total: number | null; distributedAt: string | null
  /** норма на седмица (0 — няма); годишна норма (ЗДУД, ЗДАСД 144, директор 72) */
  norm: number; normYear: number
  /** ИЧ за годината */
  ichYear: number
  /** лекторски за годината по учебния план — 0,7 постоянно / 0,7 до нормата, после 1 */
  yearS: number; yearM: number
}
export type QTMarked = { staffId: string; day: number; dateFrom: string; dateTo: string }
export type Method = 'simple' | 'mixed'

const METHOD_KEY = 'eis.lecturer.method'
const METHODS: [Method, string][] = [['simple', '0,7 постоянно'], ['mixed', '0,7 до нормата, после 1']]
const fmt = (d: string) => d ? d.slice(8, 10) + '.' + d.slice(5, 7) : ''

export default function QuickTable({ rows: initial, marked, schoolDates, ends: initialEnds, defaultEnd, onEdit, onChanged }: {
  rows: QTRow[]; marked: QTMarked[]; schoolDates: string[]; ends: Ends; defaultEnd: string
  onEdit: (staffId: string) => void
  onChanged: () => void
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [onlyWith, setOnlyWith] = useState(false)
  const [ends, setEnds] = useState<Ends>(initialEnds)
  const endsMissing = GROUPS.some(g => !ends[g.key])

  // метод на сметката — помни се в този браузър
  const [method, setMethodState] = useState<Method>('mixed')
  useEffect(() => { try { const v = localStorage.getItem(METHOD_KEY); if (v === 'simple' || v === 'mixed') setMethodState(v) } catch { /* няма достъп */ } }, [])
  const setMethod = (m: Method) => { setMethodState(m); try { localStorage.setItem(METHOD_KEY, m) } catch { /* няма достъп */ } }

  // разпределени часове по човек — точно по календара
  const placed = useMemo(() => {
    const m: Record<string, number> = {}
    marked.forEach(x => { m[x.staffId] = (m[x.staffId] || 0) + slotHours(schoolDates, x.day, x.dateFrom, x.dateTo, ends) })
    return m
  }, [marked, schoolDates, ends])

  const year = (r: QTRow) => (method === 'simple' ? r.yearS : r.yearM) || 0
  const other = (r: QTRow) => (method === 'simple' ? r.yearM : r.yearS) || 0
  const wanted = (r: QTRow) => year(r) > 0
  // разпределено е, ако сложените часове са колкото годишното число (при смяна на метода — става „за наново“)
  const isDone = (r: QTRow) => !!r.distributedAt && (placed[r.id] || 0) > 0 && Math.abs((placed[r.id] || 0) - year(r)) <= 1

  const visible = rows.filter(r => smartMatch(`${r.name} ${r.position} ${r.classes.map(c => c.name).join(' ')}`, q)
    && (!onlyWith || wanted(r) || placed[r.id]))
  const sum = rows.reduce((a, r) => a + year(r), 0)
  const sumPlaced = Object.values(placed).reduce((a, b) => a + b, 0)
  const pending = rows.filter(r => wanted(r) && !isDone(r) && r.classes.length > 0)

  const setBusyId = (id: string, on: boolean) => setBusy(p => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n })

  async function saveEnd(k: Grp, v: string) {
    setEnds({ ...ends, [k]: v })
    const res: any = await saveYearEnds({ [k]: v })
    if (res.error) toast(res.error, 'error'); else router.refresh()
  }

  async function distribute(r: QTRow, quiet = false) {
    const total = year(r)
    if (total <= 0) return false
    if (!quiet && placed[r.id] && !confirm(`${r.name}: да се разпределят ли наново? Часовете, сложени на ръка в „График“ (с катинарче), остават; останалите се слагат отначало.`)) return false
    setBusyId(r.id, true)
    const res: any = await autoDistribute(r.id, null, null, total)
    setBusyId(r.id, false)
    if (res.error) { toast(`${r.name}: ${res.error}`, 'error'); return false }
    setRows(p => p.map(x => x.id === r.id ? { ...x, total: res.placed, distributedAt: new Date().toISOString() } : x))
    if (res.missing > 0) toast(`${r.name}: в разписанието няма достатъчно часове (липсват ${res.missing})`, 'error')
    else if (!quiet) toast(`${r.name}: ${res.placed} ч. за годината`)
    return true
  }

  async function distributeAll() {
    if (!pending.length) return
    if (!confirm(`Разпредели ${pending.length} души (${METHODS.find(m => m[0] === method)?.[1]})? Часовете, сложени на ръка (с катинарче), остават; останалите се слагат отначало.`)) return
    let ok = 0
    for (const r of pending) if (await distribute(r, true)) ok++
    toast(`Разпределени: ${ok} от ${pending.length}`)
    onChanged()
  }

  async function clearAll() {
    if (!confirm(`Да се изтрият ли ВСИЧКИ разпределени лекторски (${sumPlaced} ч.) на всички — и сложените на ръка? Не може да се върне.`)) return
    setBusyId('*', true)
    const res: any = await clearAllLecturerSlots()
    setBusyId('*', false)
    if (res.error) { toast(res.error, 'error'); return }
    setRows(p => p.map(x => ({ ...x, total: null, distributedAt: null })))
    toast('Разпределението е изчистено')
    onChanged()
  }

  return (
    <div className="space-y-4">
      {/* последни учебни дни по класове — по графика на МОН */}
      <div className={`rounded-2xl border px-5 py-4 ${endsMissing ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center gap-2 text-sm text-slate-700 mb-3">
          <CalendarCheck size={16} className="text-slate-500" /> Последен учебен ден по класове
          <span className="text-xs text-slate-500">— по графика на МОН; паралелката учи до края на детето с най-дълъг срок</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {GROUPS.map(g => (
            <label key={g.key} className="flex items-center gap-2 text-sm">
              <span className="text-slate-600 w-24">{g.label}</span>
              <input type="date" value={ends[g.key] || ''} onChange={e => saveEnd(g.key, e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-teal-400" />
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Име или паралелка…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-400" />
          </div>
          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[13px]" title="Как се смятат лекторските (Наредба № 4/2017): терапиите винаги по 0,7, или по 0,7 само докато допълват нормата, а над нея — по 1">
            {METHODS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setMethod(k)}
                className={`px-3 py-1.5 rounded-md transition-all ${method === k ? 'bg-white shadow-sm text-[#0f2240] font-medium' : 'text-slate-500 hover:text-slate-800'}`}>{l}</button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={onlyWith} onChange={e => setOnlyWith(e.target.checked)} className="rounded" /> само с лекторски
          </label>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm text-slate-500">за годината <b className="text-slate-800 tabular-nums">{sum}</b> · разпределени <b className="text-slate-800 tabular-nums">{sumPlaced}</b> ч.</span>
            {sumPlaced > 0 && (
              <button onClick={clearAll} disabled={busy.size > 0} title="Изтрива всички разпределени лекторски часове (и сложените на ръка)"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40">
                <Trash2 size={14} /> Изчисти всички
              </button>
            )}
            <button onClick={distributeAll} disabled={!pending.length || busy.size > 0 || endsMissing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm disabled:opacity-40 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
              {busy.size > 0 ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Разпредели{pending.length ? ` (${pending.length})` : ''}
            </button>
          </div>
        </div>

        {/* заглавията остават видими при превъртане */}
        <div className="overflow-auto max-h-[calc(100vh-230px)]">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="text-[11px] text-slate-500 [&>th]:border-b [&>th]:border-slate-200 [&>th]:py-2.5 [&>th]:font-medium">
                <th className="px-5 text-left">Име</th>
                <th className="px-3 text-left">Паралелки<div className="font-normal text-slate-400">до кога учат</div></th>
                <th className="px-2 text-center w-20">Норма</th>
                <th className="px-2 text-center w-24" title="Индивидуални часове — по отделна заповед на директора; не влизат в лекторските тук">ИЧ<div className="font-normal text-slate-400">отделна заповед</div></th>
                <th className="px-2 text-center w-32 bg-teal-50/70 text-teal-800">Лекторски<div className="font-normal text-teal-700/80">за годината</div></th>
                <th className="px-2 text-center w-32">Разпределени</th>
                <th className="w-48" />
              </tr>
            </thead>
            <tbody>
              {visible.map(r => {
                const p = placed[r.id] || 0
                const ok = wanted(r) && isDone(r)
                const off = (wanted(r) || p > 0) && !ok
                const b = busy.has(r.id)
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60 [&>td]:border-b [&>td]:border-slate-100">
                    <td className="px-5 py-2">
                      <div className="text-slate-800">{r.name}</div>
                      <div className="text-[11px] text-slate-400">{r.position}</div>
                    </td>
                    <td className="px-3 py-2 text-[13px]">
                      {r.classes.length ? (
                        <div className="flex flex-wrap gap-1">
                          {r.classes.map(c => (
                            <span key={c.name} title={c.end ? `учи до ${fmt(c.end)} (детето с най-дълъг срок)` : `няма въведен клас на децата — до ${fmt(defaultEnd)}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700 tabular-nums">
                              {c.name}<span className={`text-[10px] ${c.end ? 'text-slate-400' : 'text-amber-600'}`}>{fmt(c.end || defaultEnd)}</span>
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-slate-300">няма разписание</span>}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{r.normYear ? `${r.normYear} г.` : r.norm || '—'}</td>
                    <td className="px-2 py-2 text-center tabular-nums text-[13px] text-violet-700">{r.ichYear || <span className="text-slate-300">—</span>}</td>
                    <td className="px-2 py-2 text-center tabular-nums bg-teal-50/30"
                      title={`0,7 постоянно: ${r.yearS || 0} · 0,7 до нормата, после 1: ${r.yearM || 0}`}>
                      {!r.hasPlan ? <span className="text-slate-400 text-[12px]" title="Не е свързан с учебния план (вж. Учебни планове)">няма уч. план</span>
                        : <>
                          <div className={year(r) ? 'text-slate-900 font-medium' : 'text-slate-300'}>{year(r) || '—'}</div>
                          {other(r) !== year(r) && <div className="text-[10.5px] text-slate-400">другият метод: {other(r)}</div>}
                        </>}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {ok ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check size={14} /> {p}</span>
                        : off && p === 0 ? <span className="text-slate-400 text-[13px]">още не</span>
                        : off ? <span className="inline-flex items-center gap-1 text-amber-700 text-[13px]" title={`Сложени ${p}, а числото за годината е ${year(r)} (сменен метод или липсват часове в разписанието)`}><AlertTriangle size={13} /> {p} — за наново</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        {wanted(r) && r.classes.length > 0 && (
                          <button onClick={async () => { if (await distribute(r)) onChanged() }} disabled={b || endsMissing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 disabled:opacity-50">
                            {b ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} {p ? 'Наново' : 'Разпредели'}
                          </button>
                        )}
                        {p > 0 && (
                          <button onClick={async () => { const e = await downloadLecturerOrder('separate', r.id); if (e) toast(e, 'error') }}
                            title={`Заповед за лекторските на ${r.name} (без ИЧ)`}
                            className="inline-flex items-center px-2 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-600 hover:border-[#0f2240]">
                            <FileDown size={13} />
                          </button>
                        )}
                        {p > 0 && (
                          <button onClick={() => onEdit(r.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-700 hover:border-[#0f2240]">
                            <Pencil size={12} /> График
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">Няма никой</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-xs text-slate-500 border-t border-slate-100 space-y-1">
          <p><b className="text-slate-700">Лекторски за годината</b> — същите числа като в Справки → „Лекторски по учебен план“ → „Кратко“, по избрания метод горе: <i>0,7 постоянно</i> (терапиите винаги по 0,7) или <i>0,7 до нормата, после 1</i> (часовете над нормата се броят по 1). ИЧ не се броят — те са по отделна заповед на директора (тук са само за сведение); само допълват нормата, ако часовете без ИЧ не стигат.</p>
          <p><b className="text-slate-700">„Разпредели“</b> слага годишния брой в разписанието: 1 час седмично от началото на годината, докато се събере числото (напр. 20 → 20 седмици). Ако числото е повече от годината на паралелката (32 / 34 / 36 седмици), първият час върви цялата година, а остатъкът — втори час, пак от началото; и т.н. Часовете, преместени на ръка в „График“, имат катинарче и остават. При смяна на метода разпределените стават „за наново“.</p>
        </div>
      </div>
    </div>
  )
}
