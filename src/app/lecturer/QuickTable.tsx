'use client'
// Бърза таблица: за всеки учител — годишният брой лекторски часове и седмиците във II срок.
// „Разпредели“ слага часовете в разписанието му (по един на ден, по реалния календар).

import { useMemo, useState } from 'react'
import { Loader2, Wand2, Pencil, Search, Check, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { smartMatch } from '@/lib/search'
import { autoDistribute, saveLecturerPlan } from './actions'
import { slotHours } from './distribute'

export type QTRow = {
  id: string; name: string; position: string; classes: string[]
  total: number | null; weeks: number; suggested: number; distributedAt: string | null
}
export type QTMarked = { staffId: string; day: number; dateFrom: string; dateTo: string; manual?: boolean }

const WEEKS = [18, 16, 14]

export default function QuickTable({ rows: initial, marked, schoolDates, onEdit, onChanged }: {
  rows: QTRow[]; marked: QTMarked[]; schoolDates: string[]
  onEdit: (staffId: string) => void
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [rows, setRows] = useState(initial)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [onlyWith, setOnlyWith] = useState(false)

  // разпределени часове по учител — точно по календара
  const placed = useMemo(() => {
    const m: Record<string, number> = {}
    marked.forEach(x => { m[x.staffId] = (m[x.staffId] || 0) + slotHours(schoolDates, x.day, x.dateFrom, x.dateTo) })
    return m
  }, [marked, schoolDates])

  const totalOf = (r: QTRow) => draft[r.id] !== undefined ? (draft[r.id] === '' ? null : Number(draft[r.id])) : r.total
  const dirty = (r: QTRow) => (totalOf(r) || 0) !== (placed[r.id] || 0)
  const visible = rows.filter(r => smartMatch(`${r.name} ${r.classes.join(' ')}`, q) && (!onlyWith || (totalOf(r) || 0) > 0 || placed[r.id]))
  const sum = rows.reduce((a, r) => a + (totalOf(r) || 0), 0)
  const sumPlaced = Object.values(placed).reduce((a, b) => a + b, 0)
  const pending = rows.filter(r => (totalOf(r) || 0) > 0 && dirty(r))

  const setBusyId = (id: string, on: boolean) => setBusy(p => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n })

  async function commitNumber(r: QTRow) {
    const v = draft[r.id]
    if (v === undefined) return
    const n = v === '' ? 0 : Math.max(0, Math.round(Number(v)))
    if (Number.isNaN(n) || n === (r.total || 0)) return
    const res: any = await saveLecturerPlan(r.id, n, r.weeks)
    if (res.error) { toast(res.error, 'error'); return }
    setRows(p => p.map(x => x.id === r.id ? { ...x, total: n } : x))
    setDraft(p => { const c = { ...p }; delete c[r.id]; return c })
  }

  async function setWeeks(r: QTRow, w: number) {
    setRows(p => p.map(x => x.id === r.id ? { ...x, weeks: w } : x))
    const res: any = await saveLecturerPlan(r.id, totalOf(r) || 0, w)
    if (res.error) toast(res.error, 'error')
  }

  async function distribute(r: QTRow, quiet = false) {
    const n = totalOf(r) || 0
    if (n <= 0) return false
    if (!quiet && placed[r.id] && !confirm(`${r.name} вече има лекторски в разписанието. Да се заменят ли с ново разпределение?`)) return false
    setBusyId(r.id, true)
    const res: any = await autoDistribute(r.id, n, r.weeks)
    setBusyId(r.id, false)
    if (res.error) { toast(`${r.name}: ${res.error}`, 'error'); return false }
    setRows(p => p.map(x => x.id === r.id ? { ...x, total: n, distributedAt: new Date().toISOString() } : x))
    setDraft(p => { const c = { ...p }; delete c[r.id]; return c })
    if (res.missing > 0) toast(`${r.name}: не стигат часовете в разписанието — липсват ${res.missing} ч.`, 'error')
    else if (!quiet) toast(`${r.name}: ${res.placed} ч. в ${res.slots} слота`)
    return true
  }

  async function distributeAll() {
    if (!pending.length) return
    if (!confirm(`Разпредели ${pending.length} учители? Досегашните им лекторски в разписанието се заменят.`)) return
    let ok = 0
    for (const r of pending) if (await distribute(r, true)) ok++
    toast(`Разпределени: ${ok} от ${pending.length}`)
    onChanged()
  }

  return (
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
          <button onClick={distributeAll} disabled={!pending.length || busy.size > 0}
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
              <th className="px-3 py-2.5 font-medium">Паралелки</th>
              <th className="px-3 py-2.5 font-medium text-center w-32">Лекторски за годината</th>
              <th className="px-3 py-2.5 font-medium text-center w-40">II срок, седмици</th>
              <th className="px-3 py-2.5 font-medium text-center w-36">В разписанието</th>
              <th className="px-3 py-2.5 w-48" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map(r => {
              const t = totalOf(r) || 0
              const p = placed[r.id] || 0
              const ok = t > 0 && p === t
              const off = (t > 0 || p > 0) && p !== t
              const b = busy.has(r.id)
              return (
                <tr key={r.id} className={off ? 'bg-amber-50/40' : ''}>
                  <td className="px-5 py-2">
                    <div className="text-slate-800">{r.name}</div>
                    <div className="text-[11px] text-slate-400">{r.position}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600 text-[13px]">{r.classes.join(', ') || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2 text-center">
                    <input inputMode="numeric" value={draft[r.id] ?? (r.total ?? '')}
                      onChange={e => setDraft(d => ({ ...d, [r.id]: e.target.value.replace(/\D/g, '') }))}
                      onBlur={() => commitNumber(r)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      placeholder="0"
                      className="w-20 text-center px-2 py-1.5 rounded-lg border border-slate-200 tabular-nums focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center gap-0.5 p-0.5 rounded-lg bg-slate-100 w-fit mx-auto">
                      {WEEKS.map(w => (
                        <button key={w} type="button" onClick={() => setWeeks(r, w)} title={w === r.suggested ? 'по класовете му' : undefined}
                          className={`px-2.5 py-1 rounded-md text-xs tabular-nums ${r.weeks === w ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'}`}>
                          18+{w}{w === r.suggested && r.weeks !== w ? '•' : ''}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {ok ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check size={14} /> {p}</span>
                      : off ? <span className="inline-flex items-center gap-1 text-amber-700" title="Различава се от въведеното"><AlertTriangle size={13} /> {p} от {t}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      {t > 0 && (
                        <button onClick={async () => { if (await distribute(r)) onChanged() }} disabled={b}
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
            {visible.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">Няма учители</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-xs text-slate-500 border-t border-slate-100">
        Часовете се слагат случайно в разписанието — по един на ден, по реалните учебни дни от календара. Последният час спира на датата, в която се събира точният брой. •&nbsp;— предложение по класовете.
      </p>
    </div>
  )
}
