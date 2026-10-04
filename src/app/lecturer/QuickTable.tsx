'use client'
// Бърза таблица: за всеки учител — годишният брой лекторски часове.
// „Разпредели“ ги слага в разписанието му: по един на ден, по реалния календар,
// всеки час — до края на годината на паралелката (по детето с най-дълъг учебен срок в нея).

import { useMemo, useState } from 'react'
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
  total: number | null; perWeek?: number | null; distributedAt: string | null
  /** натоварване по разписанието (I срок, с 0,7 за часовете с „вземане“), норма и предложение = разликата */
  load?: number; norm?: number; suggest?: number
}
export type QTMarked = { staffId: string; day: number; dateFrom: string; dateTo: string }

const fmt = (d: string) => d ? d.slice(8, 10) + '.' + d.slice(5, 7) : ''

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
  const [ends, setEnds] = useState<Ends>(initialEnds)
  const endsMissing = GROUPS.some(g => !ends[g.key])

  // разпределени часове по учител — точно по календара
  const [placed, slotCount] = useMemo(() => {
    const m: Record<string, number> = {}, c: Record<string, number> = {}
    marked.forEach(x => { m[x.staffId] = (m[x.staffId] || 0) + slotHours(schoolDates, x.day, x.dateFrom, x.dateTo, ends); c[x.staffId] = (c[x.staffId] || 0) + 1 })
    return [m, c]
  }, [marked, schoolDates, ends])

  // въвежда се ЕДНОТО: часове на седмица ИЛИ годишен брой
  const num = (v: string) => { const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? n : 0 }
  const fmtW = (n: number | null | undefined) => n ? String(Number(n)).replace('.', ',') : ''
  // предложението важи, докато не е въведено нищо друго
  const isSuggested = (r: QTRow) => draft[r.id + ':w'] === undefined && draft[r.id] === undefined && !Number(r.perWeek) && !(r.total || 0) && (r.suggest || 0) > 0
  const weekOf = (r: QTRow) => {
    const v = draft[r.id + ':w']
    if (v !== undefined) return v === '' ? 0 : num(v)
    if (Number(r.perWeek)) return Number(r.perWeek)
    return isSuggested(r) ? (r.suggest || 0) : 0
  }
  const totalOf = (r: QTRow) => { const v = draft[r.id]; return v !== undefined ? (v === '' ? 0 : Number(v)) : (r.total || 0) }
  const wanted = (r: QTRow) => weekOf(r) > 0 || totalOf(r) > 0
  const isDone = (r: QTRow) => weekOf(r) > 0
    ? slotCount[r.id] === Math.ceil(weekOf(r) - 1e-9) && (placed[r.id] || 0) === (r.total || 0) && !!r.distributedAt
    : totalOf(r) === (placed[r.id] || 0)
  const visible = rows.filter(r => smartMatch(`${r.name} ${r.classes.map(c => c.name).join(' ')}`, q) && (!onlyWith || wanted(r) || placed[r.id]))
  const sum = rows.reduce((a, r) => a + (weekOf(r) > 0 ? (r.total || 0) : totalOf(r)), 0)
  const sumPlaced = Object.values(placed).reduce((a, b) => a + b, 0)
  const pending = rows.filter(r => wanted(r) && !isDone(r))

  const setBusyId = (id: string, on: boolean) => setBusy(p => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n })

  async function saveEnd(k: Grp, v: string) {
    const next = { ...ends, [k]: v }
    setEnds(next)
    const res: any = await saveYearEnds({ [k]: v })
    if (res.error) toast(res.error, 'error'); else router.refresh()
  }

  const clearDraft = (...keys: string[]) => setDraft(p => { const c = { ...p }; keys.forEach(k => delete c[k]); return c })

  /** Записва въведеното поле; другото се нулира (въвежда се или седмично, или годишно) */
  async function commit(r: QTRow, kind: 'w' | 'y') {
    const key = kind === 'w' ? r.id + ':w' : r.id
    const v = draft[key]
    if (v === undefined) return
    const n = v === '' ? 0 : kind === 'w' ? Math.max(0, Math.round(num(v) * 100) / 100) : Math.max(0, Math.round(Number(v)))
    const cur = kind === 'w' ? Number(r.perWeek || 0) : (r.total || 0)
    if (Number.isNaN(n) || n === cur) { clearDraft(key); return }
    const res: any = kind === 'w' ? await saveLecturerPlan(r.id, 0, n || null) : await saveLecturerPlan(r.id, n, null)
    if (res.error) { toast(res.error, 'error'); return }
    setRows(p => p.map(x => x.id !== r.id ? x : kind === 'w' ? { ...x, perWeek: n || null, total: 0, distributedAt: null } : { ...x, total: n, perWeek: null }))
    clearDraft(r.id, r.id + ':w')
  }

  async function distribute(r: QTRow, quiet = false) {
    const w = weekOf(r), n = w > 0 ? 0 : totalOf(r)
    if (w <= 0 && n <= 0) return false
    if (!quiet && placed[r.id] && !confirm(`${r.name}: да се разпределят ли наново? Часовете, сложени на ръка в „График“ (с катинарче), остават; останалите се слагат отначало.`)) return false
    setBusyId(r.id, true)
    const res: any = await autoDistribute(r.id, n, w > 0 ? w : null)
    setBusyId(r.id, false)
    if (res.error) { toast(`${r.name}: ${res.error}`, 'error'); return false }
    setRows(p => p.map(x => x.id === r.id ? { ...x, total: w > 0 ? res.placed : n, perWeek: w > 0 ? w : null, distributedAt: new Date().toISOString() } : x))
    clearDraft(r.id, r.id + ':w')
    if (res.missing > 0) toast(w > 0 ? `${r.name}: в разписанието няма достатъчно часове (липсват ${res.missing})` : `${r.name}: не стигат часовете в разписанието — липсват ${res.missing} ч.`, 'error')
    else if (!quiet) toast(`${r.name}: ${res.placed} ч. за годината в ${res.slots} слота`)
    return true
  }

  async function distributeAll() {
    if (!pending.length) return
    if (!confirm(`Разпредели ${pending.length} учители? Часовете, сложени на ръка (с катинарче), остават; останалите се слагат отначало.`)) return
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
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Учител или паралелка…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-400" />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={onlyWith} onChange={e => setOnlyWith(e.target.checked)} className="rounded" /> само с лекторски
          </label>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm text-slate-500">въведени <b className="text-slate-800 tabular-nums">{sum}</b> · разпределени <b className="text-slate-800 tabular-nums">{sumPlaced}</b> ч.</span>
            <button onClick={distributeAll} disabled={!pending.length || busy.size > 0 || endsMissing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm disabled:opacity-40 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
              {busy.size > 0 ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Разпредели{pending.length ? ` (${pending.length})` : ''}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <th className="px-5 py-2.5 font-medium">Учител</th>
                <th className="px-3 py-2.5 font-medium">Паралелки · до кога учат</th>
                <th className="px-3 py-2.5 font-medium text-center w-28">Часове / норма</th>
                <th className="px-3 py-2.5 font-medium text-center w-28">Над норматива на седмица</th>
                <th className="px-3 py-2.5 font-medium text-center w-28">или за годината</th>
                <th className="px-3 py-2.5 font-medium text-center w-36">В разписанието</th>
                <th className="px-3 py-2.5 w-48" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map(r => {
                const w = weekOf(r)
                const t = w > 0 ? (r.total || 0) : totalOf(r)
                const p = placed[r.id] || 0
                const ok = wanted(r) && isDone(r)
                const off = (wanted(r) || p > 0) && !ok
                const b = busy.has(r.id)
                return (
                  <tr key={r.id} className={off ? 'bg-amber-50/40' : ''}>
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
                    <td className="px-3 py-2 text-center tabular-nums text-[13px]">
                      {r.load ? (
                        <span className={(r.load || 0) > (r.norm || 21) ? 'text-slate-800' : 'text-slate-400'}>{fmtW(r.load)} <span className="text-slate-400">/ {r.norm}</span></span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input inputMode="decimal" value={draft[r.id + ':w'] ?? fmtW(r.perWeek)}
                        onChange={e => setDraft(d => ({ ...d, [r.id + ':w']: e.target.value.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/, '$1') }))}
                        onBlur={() => commit(r, 'w')} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        placeholder={isSuggested(r) ? fmtW(r.suggest) : '—'} title={isSuggested(r) ? `Предложение: ${fmtW(r.load)} − ${r.norm} = ${fmtW(r.suggest)}. Може да се поправи.` : 'Часове над норматива на седмица, може и дробно (2,5)'}
                        className={`w-16 text-center px-2 py-1.5 rounded-lg border tabular-nums focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 ${isSuggested(r) ? 'border-teal-300 bg-teal-50/60 placeholder:text-teal-700' : 'border-slate-200'}`} />
                      {isSuggested(r) && <div className="text-[10px] text-teal-700 mt-0.5">предложение</div>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {w > 0 && !isSuggested(r) ? (
                        <span className="text-slate-500 tabular-nums" title="Смята се от часовете на седмица по календара">{r.distributedAt && r.total ? `= ${r.total}` : 'след разпределяне'}</span>
                      ) : (
                        <input inputMode="numeric" value={draft[r.id] ?? (r.total || '')}
                          onChange={e => setDraft(d => ({ ...d, [r.id]: e.target.value.replace(/\D/g, '') }))}
                          onBlur={() => commit(r, 'y')} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          placeholder="—" title="Годишен брой — последният час спира на точната дата"
                          className="w-20 text-center px-2 py-1.5 rounded-lg border border-slate-200 tabular-nums focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {ok ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check size={14} /> {p}</span>
                        : off ? <span className="inline-flex items-center gap-1 text-amber-700" title="Различава се от въведеното"><AlertTriangle size={13} /> {w > 0 ? `${slotCount[r.id] || 0} от ${fmtW(w)}/седм.` : `${p} от ${t}`}</span>
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
              {visible.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">Няма учители</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-slate-500 border-t border-slate-100">
          <b>Предложението</b> (зелено) = часовете му по разписанието (с 0,7 за часовете с „вземане“) минус нормата; поправя се с писане, „Разпредели“ го приема.
          Въвежда се едното: <b>на седмица</b> (напр. 2 или 2,5 — дробта е още един час за тази част от годината) — всеки час стига до края на годината на своята паралелка и годишният брой се смята сам; <b>или за годината</b> (напр. 100) — последният час спира на датата, в която се събира точният брой.
          Часовете, сложени или преместени на ръка в „График“, имат катинарче и остават при „Наново“ — разпределя се само остатъкът.
          Часовете се слагат случайно в разписанието — по един на ден, по реалните учебни дни от календара.
          Датата до паралелката е по класа на децата в училищата им (оранжева — няма въведен клас).
        </p>
      </div>
    </div>
  )
}
