'use client'
// Бърза таблица: за всеки от учебния план — годишният брой лекторски часове (същият като в Справки → „Кратко“),
// по избрания метод: „0,7 постоянно“ или „0,7 до нормата, после 1“.
// „Разпредели“ слага годишния брой в разписанието му: 1 ч./седм. от началото на годината до събиране
// на числото; над годината на паралелката (32/34/36) — следващ час, пак от началото.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Wand2, Pencil, Search, Check, AlertTriangle, CalendarCheck } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { smartMatch } from '@/lib/search'
import { autoDistribute, saveLecturerPlan, saveYearEnds } from './actions'
import { slotHours, GROUPS } from './distribute'
import type { Ends, Grp } from './distribute'

export type QTRow = {
  id: string; name: string; position: string
  classes: { name: string; end: string }[]
  total: number | null; distributedAt: string | null
  /** записаните часове над норматива на седмица (I / II срок); null — по учебния план */
  perWeek?: number | null; perWeek2?: number | null
  /** норма на седмица (0 — няма); годишна норма (ЗДУД, ЗДАСД 144, директор 72) */
  norm?: number; normYear?: number
  /** лекторски по учебния план: на седмица по срокове и за годината — по двата метода (s — 0,7 постоянно, m — 0,7 до нормата, после 1) */
  planS1?: number; planS2?: number; planM1?: number; planM2?: number; yearS?: number; yearM?: number
  /** учебни седмици по срокове — за сметката „за годината“ */
  W1?: number; W2?: number
  /** откъде е предложението: учебен план (НЕИСПУО) или разписание */
  source?: 'plan' | 'schedule'
  /** УП — часове седмично по учебния план без ИЧ (I / II срок); СР — по разписанието без ИФО; ИЧ — индивидуални часове */
  up1?: number | null; up2?: number | null; sr?: number; ich?: number; ichYear?: number
  /** колко от часовете са по 0,7 (терапии) — в учебния план (I / II срок) и в разписанието */
  upT1?: number; upT2?: number; srT?: number
  /** ИЧ в редуцирани часове — за сравнението с разписанието (то включва ИФО) */
  ichN?: number; ichN2?: number
  /** разписанието само с паралелките (без ИФО) */
  srClass?: number; srClassT?: number
}
export type QTMarked = { staffId: string; day: number; dateFrom: string; dateTo: string }

const fmt = (d: string) => d ? d.slice(8, 10) + '.' + d.slice(5, 7) : ''
export type Method = 'simple' | 'mixed'
const METHOD_KEY = 'eis.lecturer.method'

export default function QuickTable({ rows: initial, marked, schoolDates, ends: initialEnds, defaultEnd, onEdit, onChanged }: {
  rows: QTRow[]; marked: QTMarked[]; schoolDates: string[]; ends: Ends; defaultEnd: string
  onEdit: (staffId: string) => void
  onChanged: () => void
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [onlyWith, setOnlyWith] = useState(false)
  const [onlyDiff, setOnlyDiff] = useState(false)
  const [ends, setEnds] = useState<Ends>(initialEnds)
  const endsMissing = GROUPS.some(g => !ends[g.key])
  // метод на сметката — помни се в този браузър
  const [method, setMethodState] = useState<Method>('mixed')
  useEffect(() => { try { const v = localStorage.getItem(METHOD_KEY); if (v === 'simple' || v === 'mixed') setMethodState(v) } catch { /* няма достъп */ } }, [])
  const setMethod = (m: Method) => { setMethodState(m); try { localStorage.setItem(METHOD_KEY, m) } catch { /* няма достъп */ } }

  // разпределени часове по учител — точно по календара
  const [placed] = useMemo(() => {
    const m: Record<string, number> = {}, c: Record<string, number> = {}
    marked.forEach(x => { m[x.staffId] = (m[x.staffId] || 0) + slotHours(schoolDates, x.day, x.dateFrom, x.dateTo, ends); c[x.staffId] = (c[x.staffId] || 0) + 1 })
    return [m, c]
  }, [marked, schoolDates, ends])

  const num = (v: string) => { const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? n : 0 }
  const fmtW = (n: number | null | undefined) => n ? String(Number(n)).replace('.', ',') : ''
  const stored = (r: QTRow, k: 1 | 2) => { const v = k === 1 ? r.perWeek : r.perWeek2; return v === null || v === undefined ? null : Number(v) }
  // от учебния план, по избрания метод: на седмица (срок) и за годината
  const planW = (r: QTRow, k: 1 | 2) => Number((method === 'simple' ? (k === 1 ? r.planS1 : r.planS2) : (k === 1 ? r.planM1 : r.planM2)) || 0)
  const planYear = (r: QTRow) => Number((method === 'simple' ? r.yearS : r.yearM) || 0)
  const sugg = (r: QTRow, k: 1 | 2) => r.source === 'plan' ? planW(r, k) : 0
  const suggTitle = (r: QTRow, k: 1 | 2) => r.source !== 'plan' ? '' :
    `От учебния план (${method === 'simple' ? 'терапиите по 0,7' : '0,7 до нормата, после по 1'}): ${fmtW(planW(r, k)) || '0'} ч./седм.${r.normYear ? ` (годишна норма ${r.normYear} — годишните ÷ седмиците)` : ''}; за годината ${planYear(r)}`
  // предложението от учебния план важи, докато не е записано друго число
  const isSug = (r: QTRow, k: 1 | 2) => draft[`${r.id}:${k}`] === undefined && stored(r, k) === null && sugg(r, k) > 0
  const eff = (r: QTRow, k: 1 | 2) => {
    const v = draft[`${r.id}:${k}`]
    if (v !== undefined) return v === '' ? sugg(r, k) : num(v)
    return stored(r, k) ?? sugg(r, k)
  }
  // число на ръка (записано или пише се) — иначе важи годишното от учебния план
  const isManual = (r: QTRow) => stored(r, 1) !== null || stored(r, 2) !== null || (draft[`${r.id}:1`] ?? '') !== '' || (draft[`${r.id}:2`] ?? '') !== ''
  const yearEst = (r: QTRow) => isManual(r) ? Math.round(eff(r, 1) * (r.W1 || 18) + eff(r, 2) * (r.W2 || 18)) : planYear(r)
  const wanted = (r: QTRow) => yearEst(r) > 0
  // разпределено е, ако сложените часове са колкото годишното число (при смяна на метода — става „за наново“)
  const isDone = (r: QTRow) => !!r.distributedAt && (placed[r.id] || 0) > 0 && Math.abs((placed[r.id] || 0) - yearEst(r)) <= 1
  // записано число, което вече не съвпада с учебния план
  const drift = (r: QTRow, k: 1 | 2) => r.source === 'plan' && stored(r, k) !== null && stored(r, k) !== sugg(r, k)
  // разписанието не съвпада с учебния план (часовете — и двете редуцирани)
  // Разписанието съвпада с плана, ако (с или без ИФО) дава часовете по плана (с или без ИЧ):
  // при едни колежки ИФО допълва норматива, при други е по отделна заповед и не е в разписанието.
  const eq = (a: number, b: number) => Math.round((a - b) * 10) === 0
  const srShown = (r: QTRow) => {
    const up = r.up1 || 0, upIch = up + (r.ichN || 0)
    for (const [v, t] of [[r.sr || 0, r.srT || 0], [r.srClass ?? r.sr ?? 0, r.srClassT ?? r.srT ?? 0]] as [number, number][])
      if (eq(v, up) || eq(v, upIch)) return { v, t, ok: true }
    return { v: r.sr || 0, t: r.srT || 0, ok: false }
  }
  const hasDiff = (r: QTRow) => r.up1 !== null && r.up1 !== undefined && !srShown(r).ok
  const diffCount = rows.filter(hasDiff).length
  const visible = rows.filter(r => smartMatch(`${r.name} ${r.classes.map(c => c.name).join(' ')}`, q)
    && (!onlyWith || wanted(r) || placed[r.id]) && (!onlyDiff || hasDiff(r)))
  const sum = rows.reduce((a, r) => a + (isDone(r) ? (placed[r.id] || 0) : yearEst(r)), 0)
  const sumPlaced = Object.values(placed).reduce((a, b) => a + b, 0)
  const pending = rows.filter(r => wanted(r) && !isDone(r) && r.classes.length > 0)
  const manualRows = rows.filter(r => r.source === 'plan' && (stored(r, 1) !== null || stored(r, 2) !== null))

  const setBusyId = (id: string, on: boolean) => setBusy(p => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n })

  async function saveEnd(k: Grp, v: string) {
    const next = { ...ends, [k]: v }
    setEnds(next)
    const res: any = await saveYearEnds({ [k]: v })
    if (res.error) toast(res.error, 'error'); else router.refresh()
  }

  const clearDraft = (...keys: string[]) => setDraft(p => { const c = { ...p }; keys.forEach(k => delete c[k]); return c })

  /** Поправка на число (I или II срок). Празно = обратно към учебния план. */
  async function commit(r: QTRow, k: 1 | 2) {
    const key = `${r.id}:${k}`
    const v = draft[key]
    if (v === undefined) return
    const n = v === '' ? null : Math.max(0, Math.round(num(v) * 100) / 100)
    if (n === stored(r, k)) { clearDraft(key); return }
    let n1 = k === 1 ? n : stored(r, 1), n2 = k === 2 ? n : stored(r, 2)
    // II срок следва I срок, ако по плана са еднакви и за II срок няма отделно число
    if (k === 1 && stored(r, 2) === null && sugg(r, 1) === sugg(r, 2)) n2 = n
    const res: any = await saveLecturerPlan(r.id, n1, n2, { reset: true })
    if (res.error) { toast(res.error, 'error'); return }
    setRows(p => p.map(x => x.id !== r.id ? x : { ...x, perWeek: n1, perWeek2: n2, distributedAt: null }))
    clearDraft(key)
  }

  /** Числата на ръка — обратно към учебния план (за всички, които имат записани) */
  async function resetManual() {
    if (!manualRows.length || !confirm(`${manualRows.length} души имат числа, писани на ръка (или останали от старата сметка). Да се върнат ли всички към учебния план?`)) return
    for (const r of manualRows) {
      const res: any = await saveLecturerPlan(r.id, null, null, { reset: true })
      if (res.error) { toast(`${r.name}: ${res.error}`, 'error'); return }
    }
    setRows(p => p.map(x => manualRows.some(m => m.id === x.id) ? { ...x, perWeek: null, perWeek2: null, distributedAt: null } : x))
    toast(`Върнати към учебния план: ${manualRows.length}`)
  }

  async function distribute(r: QTRow, quiet = false) {
    const man = isManual(r)
    const w1 = man ? eff(r, 1) : null, w2 = man ? eff(r, 2) : null
    if (yearEst(r) <= 0) return false
    if (!quiet && placed[r.id] && !confirm(`${r.name}: да се разпределят ли наново? Часовете, сложени на ръка в „График“ (с катинарче), остават; останалите се слагат отначало.`)) return false
    setBusyId(r.id, true)
    const res: any = await autoDistribute(r.id, w1, w2, yearEst(r))
    setBusyId(r.id, false)
    if (res.error) { toast(`${r.name}: ${res.error}`, 'error'); return false }
    setRows(p => p.map(x => x.id === r.id ? { ...x, perWeek: w1, perWeek2: w2, total: res.placed, distributedAt: new Date().toISOString() } : x))
    clearDraft(`${r.id}:1`, `${r.id}:2`)
    if (res.missing > 0) toast(`${r.name}: в разписанието няма достатъчно часове (липсват ${res.missing})`, 'error')
    else if (!quiet) toast(`${r.name}: ${res.placed} ч. за годината`)
    return true
  }

  async function distributeAll() {
    if (!pending.length) return
    if (!confirm(`Разпредели ${pending.length} души (${method === 'simple' ? '0,7 постоянно' : '0,7 до нормата, после 1'})? Часовете, сложени на ръка (с катинарче), остават; останалите се слагат отначало.`)) return
    let ok = 0
    for (const r of pending) if (await distribute(r, true)) ok++
    toast(`Разпределени: ${ok} от ${pending.length}`)
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
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Име или паралелка…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-400" />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={onlyWith} onChange={e => setOnlyWith(e.target.checked)} className="rounded" /> само с лекторски
          </label>
          <label className={`inline-flex items-center gap-2 text-sm cursor-pointer ${diffCount ? 'text-amber-700' : 'text-slate-400'}`} title="Учителите, при които разписанието в EIS не съвпада с учебния план">
            <input type="checkbox" checked={onlyDiff} onChange={e => setOnlyDiff(e.target.checked)} className="rounded" disabled={!diffCount && !onlyDiff} /> само с разлика разписание / план ({diffCount})
          </label>
          <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[13px]" title="Как се смятат лекторските (Наредба № 4/2017): терапиите винаги по 0,7, или по 0,7 само докато допълват нормата, а над нея — по 1">
            {([['simple', '0,7 постоянно'], ['mixed', '0,7 до нормата, после 1']] as [Method, string][]).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setMethod(k)}
                className={`px-3 py-1.5 rounded-md transition-all ${method === k ? 'bg-white shadow-sm text-[#0f2240] font-medium' : 'text-slate-500 hover:text-slate-800'}`}>{l}</button>
            ))}
          </div>
          {manualRows.length > 0 && (
            <button type="button" onClick={resetManual} className="text-[13px] text-amber-700 hover:underline" title="Числата, писани на ръка в I / II срок, се махат и важи учебният план">
              {manualRows.length} на ръка — всички по плана
            </button>
          )}
          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm text-slate-500">за годината ≈ <b className="text-slate-800 tabular-nums">{sum}</b> · разпределени <b className="text-slate-800 tabular-nums">{sumPlaced}</b> ч.</span>
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
              <tr className="text-[11px] text-slate-500">
                <th rowSpan={2} className="px-5 py-2 font-medium text-left align-bottom border-b border-slate-200">Име</th>
                <th rowSpan={2} className="px-3 py-2 font-medium text-left align-bottom border-b border-slate-200">Паралелки<div className="font-normal text-slate-400">до кога учат</div></th>
                <th colSpan={3} className="px-2 py-2 font-medium text-center border-b border-slate-100 bg-slate-50/80">Часове на седмица<div className="font-normal text-slate-400">терапиите на учител — по 0,7 (в скоби — колко са); на специалиста — по 1</div></th>
                <th rowSpan={2} className="px-2 py-2 font-medium text-center align-bottom border-b border-slate-200 w-16">Норма</th>
                <th colSpan={3} className="px-2 py-2 font-medium text-center border-b border-slate-100 bg-teal-50/70 text-teal-800">Лекторски над норматива<div className="font-normal text-teal-700/80">часове на седмица · от учебния план</div></th>
                <th rowSpan={2} className="px-2 py-2 font-medium text-center align-bottom border-b border-slate-200 w-32">Разпределени</th>
                <th rowSpan={2} className="border-b border-slate-200 w-48" />
              </tr>
              <tr className="text-[11px] text-slate-500">
                <th className="px-2 py-2 font-medium text-center border-b border-slate-200 bg-slate-50/80 w-24" title="Учебен план от НЕИСПУО, без индивидуалните часове">по учебен план</th>
                <th className="px-2 py-2 font-medium text-center border-b border-slate-200 bg-slate-50/80 w-24" title="Седмичното разписание в EIS; ИФО часовете се броят, ако допълват норматива">по разписание</th>
                <th className="px-2 py-2 font-medium text-center border-b border-slate-200 bg-slate-50/80 w-20" title="Индивидуални часове с ИФО деца — броят се изцяло в лекторските (както в „Кратко“)">индивид. (ИЧ)</th>
                <th className="px-2 py-2 font-medium text-center border-b border-slate-200 bg-teal-50/70 text-teal-800 w-20">I срок</th>
                <th className="px-2 py-2 font-medium text-center border-b border-slate-200 bg-teal-50/70 text-teal-800 w-20">II срок</th>
                <th className="px-2 py-2 font-medium text-center border-b border-slate-200 bg-teal-50/70 text-teal-800 w-20">за годината</th>
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
                    {(() => {
                      const hasUp = r.up1 !== null && r.up1 !== undefined
                      const t = (n?: number) => n ? <span className="text-slate-400"> ({fmtW(n)})</span> : null
                      const sh = srShown(r)
                      const diff = hasUp && !sh.ok ? Math.round((sh.v - (r.up1 || 0)) * 10) / 10 : 0
                      const ichNote = r.ichN ? ` (по плана ${fmtW(r.up1)}, с ИЧ — ${fmtW((r.up1 || 0) + (r.ichN || 0))})` : ''
                      return (<>
                        <td className="px-2 py-2 text-center tabular-nums text-[13px] text-slate-800 whitespace-nowrap">
                          {hasUp ? <>{fmtW(r.up1) || '0'}{t(r.upT1)}{r.up2 !== r.up1 && <div className="text-[11px] text-slate-500">II срок: {fmtW(r.up2)}{t(r.upT2)}</div>}</>
                            : <span className="text-slate-400 text-[12px]" title="Учителят не е свързан с учебния план (вж. Учебни планове)">няма уч. план</span>}
                        </td>
                        <td className={`px-2 py-2 text-center tabular-nums text-[13px] whitespace-nowrap ${hasUp && diff !== 0 ? 'text-amber-700' : 'text-slate-600'}`}
                          title={hasUp && diff !== 0 ? (diff < 0 ? `Разписанието е с ${fmtW(-diff)} ч. по-малко от учебния план${ichNote} — да се провери` : `Разписанието е с ${fmtW(diff)} ч. повече от учебния план${ichNote} — да се провери`) : undefined}>
                          {sh.v ? <>{fmtW(sh.v)}{t(sh.t)}</> : <span className="text-slate-300">—</span>}{hasUp && diff !== 0 && <AlertTriangle size={11} className="inline ml-1 -mt-0.5" />}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-[13px] text-violet-700">
                          {r.ich ? (<>
                              <div>{fmtW(r.ich)}</div>
                              {r.ichYear ? <div className="text-[10.5px] text-violet-500 whitespace-nowrap">{r.ichYear} за год.</div> : null}
                            </>) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-[13px] text-slate-500 whitespace-nowrap">{r.normYear ? `${r.normYear} г.` : r.norm || '—'}</td>
                      </>)
                    })()}
                    <td className="px-2 py-2 text-center">
                      <input inputMode="decimal" value={draft[`${r.id}:1`] ?? (stored(r, 1) !== null ? fmtW(stored(r, 1)) || '0' : '')}
                        onChange={e => setDraft(d => ({ ...d, [`${r.id}:1`]: e.target.value.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/, '$1') }))}
                        onBlur={() => commit(r, 1)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        placeholder={isSug(r, 1) ? fmtW(sugg(r, 1)) : '—'}
                        title={isSug(r, 1) ? `${suggTitle(r, 1)}. Поправя се с писане; празно — обратно към плана.` : 'Часове над норматива на седмица; празно — обратно към учебния план'}
                        className={`w-16 text-center px-2 py-1.5 rounded-lg border tabular-nums focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 ${isSug(r, 1) ? 'border-teal-300 bg-teal-50/60 placeholder:text-teal-700' : 'border-slate-200'}`} />
                      {drift(r, 1) && <div className="text-[10px] text-amber-700 mt-0.5" title="Записаното число не съвпада с учебния план">по план: {fmtW(sugg(r, 1)) || '0'}</div>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input inputMode="decimal" value={draft[`${r.id}:2`] ?? (stored(r, 2) !== null ? fmtW(stored(r, 2)) || '0' : '')}
                        onChange={e => setDraft(d => ({ ...d, [`${r.id}:2`]: e.target.value.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/, '$1') }))}
                        onBlur={() => commit(r, 2)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        placeholder={isSug(r, 2) ? fmtW(sugg(r, 2)) : '—'}
                        title={isSug(r, 2) ? `${suggTitle(r, 2)}. Поправя се с писане; празно — обратно към плана.` : 'Часове над норматива на седмица; празно — обратно към учебния план'}
                        className={`w-16 text-center px-2 py-1.5 rounded-lg border tabular-nums focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 ${isSug(r, 2) ? 'border-teal-300 bg-teal-50/60 placeholder:text-teal-700' : 'border-slate-200'}`} />
                      {drift(r, 2) && <div className="text-[10px] text-amber-700 mt-0.5" title="Записаното число не съвпада с учебния план">по план: {fmtW(sugg(r, 2)) || '0'}</div>}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums text-[13px]" title={isManual(r) ? 'На ръка: I срок × седмиците му + II срок × седмиците му' : `От учебния план — 0,7 постоянно: ${r.yearS || 0}; 0,7 до нормата, после 1: ${r.yearM || 0}`}>
                      {wanted(r) ? <span className={isManual(r) ? 'text-slate-500' : 'text-slate-800'}>{isManual(r) ? '≈ ' : ''}{yearEst(r)}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {ok ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check size={14} /> {p}</span>
                        : off && p === 0 ? <span className="text-slate-400 text-[13px]">още не</span>
                        : off ? <span className="inline-flex items-center gap-1 text-amber-700 text-[13px]" title={`Сложени ${p}, а числото за годината е ${yearEst(r)} (сменен метод, число или липсват часове в разписанието)`}><AlertTriangle size={13} /> {p} — за наново</span>
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
              {visible.length === 0 && <tr><td colSpan={10} className="px-5 py-10 text-center text-slate-400">Няма никой</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-xs text-slate-500 border-t border-slate-100 space-y-1">
          <p><b className="text-slate-700">Как се чете:</b> „Часове на седмица“ — по учебния план от НЕИСПУО (без ИЧ) и по разписанието в EIS. Оранжево — разписанието не съвпада с плана и трябва да се провери.</p>
          <p><b className="text-slate-700">Лекторски</b> — същите числа като в Справки → „Лекторски по учебен план“ → „Кратко“, по избрания метод горе: <i>0,7 постоянно</i> (терапиите винаги по 0,7) или <i>0,7 до нормата, после 1</i> (часовете над нормата се броят по 1). ИЧ се броят изцяло. При годишна норма (ЗДУД, ЗДАСД, директор) седмичното е годишното, разделено на седмиците. Число, писано на ръка в I / II срок, е с предимство; празно — обратно към плана.</p>
          <p><b className="text-slate-700">„Разпредели“</b> слага годишния брой („за годината“) в разписанието: 1 час седмично от началото на годината, докато се събере числото (напр. 20 → 20 седмици). Ако числото е повече от годината на паралелката (32 / 34 / 36 седмици), първият час върви цялата година, а остатъкът — втори час, пак от началото; и т.н. Часовете, преместени на ръка в „График“, имат катинарче и остават.</p>
        </div>
      </div>
    </div>
  )
}
