'use client'
import { useEffect, useState } from 'react'
import { Loader2, CalendarRange, FileDown } from 'lucide-react'
import { generateLecturerPaymentOrder } from '@/lib/docx-substitution'

// ВПРЗ чл. 10, ал. 2, т. 1 (учител с висше образование) и НП „Без свободен час“
const RATE_BUDGET = 6.29
const RATE_NP = 7.38
import { getLecturerOverview } from './actions'

type Row = {
  staffId: string; name: string; position: string
  planned: number; declared: number; hasDecl: boolean; np: number; budget: number
  substituted: { name: string; np: number; budget: number }[]
}
const MONTHS_BG = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември']
function schoolMonths() {
  const now = new Date()
  const sy = (now.getMonth() + 1) >= 9 ? now.getFullYear() : now.getFullYear() - 1
  return [9,10,11,12,1,2,3,4,5,6].map(m => { const y = m >= 9 ? sy : sy + 1; return { m, y, label: `${MONTHS_BG[m-1]} ${y}` } })
}
const mFirst = (m: number, y: number) => `${y}-${String(m).padStart(2,'0')}-01`
const mLast = (m: number, y: number) => `${y}-${String(m).padStart(2,'0')}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`
const n = (v: number) => v > 0 ? v : <span className="text-slate-300">—</span>
const money = (v: number) => v > 0 ? v.toFixed(2).replace('.', ',') : <span className="text-slate-300">—</span>

// Месечен преглед на лекторските: над норматив (по заповед / декларирани) + заместване (НП / бюджет)
export default function OverviewClient() {
  const SM = schoolMonths()
  const cur = Math.max(0, SM.findIndex(x => x.m === new Date().getMonth() + 1))
  const [fromIdx, setFromIdx] = useState(cur)
  const [toIdx, setToIdx] = useState(cur)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const first = mFirst(SM[fromIdx].m, SM[fromIdx].y)
  const last = mLast(SM[toIdx].m, SM[toIdx].y)

  useEffect(() => {
    let off = false
    setLoading(true); setError('')
    getLecturerOverview(first, last).then((res: any) => {
      if (off) return
      if (res.error) { setError(res.error); setRows([]) } else setRows(res.data || [])
      setLoading(false)
    })
    return () => { off = true }
  }, [first, last])

  const periodLabel = fromIdx === toIdx ? `${SM[fromIdx].label} г.` : `периода ${SM[fromIdx].label} – ${SM[toIdx].label} г.`
  const notDeclared = (rows || []).filter(r => r.planned > 0 && !r.hasDecl).length
  const [genning, setGenning] = useState(false)
  async function paymentOrder() {
    if (!rows || rows.length === 0) return
    if (notDeclared > 0 && !confirm(`${notDeclared} служители не са подали декларация за над норматив — техните часове над норматив няма да влязат. Продължаваме ли?`)) return
    setGenning(true)
    try {
      await generateLecturerPaymentOrder({
        periodLabel, yearName: '', rateBudget: RATE_BUDGET, rateNp: RATE_NP,
        rows: rows.map(r => ({ name: r.name, position: r.position, overNorm: r.declared, budgetSub: r.budget, np: r.np })),
      })
    } catch (e) { /* noop */ }
    setGenning(false)
  }

  const tot = (rows || []).reduce((a, r) => ({
    planned: a.planned + r.planned, declared: a.declared + r.declared, np: a.np + r.np, budget: a.budget + r.budget,
  }), { planned: 0, declared: 0, np: 0, budget: 0 })

  const th = 'px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-400 text-right'
  const td = 'px-3 py-2 text-sm text-right tabular-nums'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 mr-auto">
          <CalendarRange size={16} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800">Лекторски часове за периода</h3>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">От месец</label>
          <select value={fromIdx} onChange={e => { const i = Number(e.target.value); setFromIdx(i); if (i > toIdx) setToIdx(i) }}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer">
            {SM.map((x, i) => <option key={i} value={i}>{x.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">До месец</label>
          <select value={toIdx} onChange={e => setToIdx(Number(e.target.value))}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer">
            {SM.map((x, i) => <option key={i} value={i} disabled={i < fromIdx}>{x.label}</option>)}
          </select>
        </div>
        <button onClick={paymentOrder} disabled={genning || loading || !rows || rows.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white text-sm hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: '#0f2240' }}>
          {genning ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Заповед за изплащане
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400"><Loader2 size={20} className="animate-spin inline" /></div>
      ) : error ? (
        <div className="py-10 text-center text-sm text-rose-500">{error}</div>
      ) : !rows || rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">Няма лекторски часове за този период.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className={`${th} text-left`}>Служител</th>
                <th className={th} title="Голямото число — декларирани от учителя; отдолу — по заповед (маркираните часове × учебните дни, без отпуск/болничен)">Над норматив</th>
                <th className={`${th} text-left`}>Замествал</th>
                <th className={th}>Заместване НП</th>
                <th className={th}>Заместване бюджет</th>
                <th className={th} title="Декларирани над норматив + заместване">Общо, ч.</th>
                <th className={th} title={`Бюджет × ${RATE_BUDGET} € + НП × ${RATE_NP} €`}>Сума, €</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const diff = r.hasDecl && r.declared !== r.planned
                return (
                  <tr key={r.staffId} className={`border-b border-slate-50 ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-3 py-2 align-top">
                      <div className="text-sm text-slate-800">{r.name}</div>
                      <div className="text-[11px] text-slate-400">{r.position}</div>
                    </td>
                    <td className={`${td} align-top`}>
                      {r.hasDecl
                        ? <div className={diff ? 'text-amber-600' : 'text-slate-800'}>{r.declared}</div>
                        : r.planned > 0 ? <div className="text-[11px] text-amber-600">неподадена</div> : n(0)}
                      {r.planned > 0 && <div className={`text-[11px] ${diff ? 'text-amber-600' : 'text-slate-400'}`}>по заповед {r.planned}</div>}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {r.substituted.length === 0 ? <span className="text-slate-300 text-sm">—</span> : (
                        <div className="space-y-0.5">
                          {r.substituted.map((x, k) => (
                            <div key={k} className="text-[12px] text-slate-600 whitespace-nowrap">
                              {x.name} <span className="text-slate-400">·</span> {x.np + x.budget} ч
                              {x.np > 0 && <span className="ml-1 text-emerald-700">({x.budget > 0 ? `${x.np} ` : ''}НП)</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={`${td} align-top text-emerald-700`}>{n(r.np)}</td>
                    <td className={`${td} align-top text-slate-700`}>{n(r.budget)}</td>
                    <td className={`${td} align-top text-slate-900 font-medium`}>{n(r.declared + r.np + r.budget)}</td>
                    <td className={`${td} align-top text-slate-700`}>{money((r.declared + r.budget) * RATE_BUDGET + r.np * RATE_NP)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/60">
                <td className="px-3 py-2 text-xs text-slate-500">Общо ({rows.length} служители)</td>
                <td className={td}>{tot.declared}<div className="text-[11px] text-slate-400">по заповед {tot.planned}</div></td>
                <td />
                <td className={`${td} text-emerald-700`}>{tot.np}</td>
                <td className={td}>{tot.budget}</td>
                <td className={`${td} font-medium`}>{tot.declared + tot.np + tot.budget}</td>
                <td className={`${td} font-medium`}>{money((tot.declared + tot.budget) * RATE_BUDGET + tot.np * RATE_NP)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="px-4 py-2.5 text-[11px] text-slate-400">
            Жълто — декларираните над норматив се различават от заповедта или декларацията не е подадена (виж подробностите в архива долу). Вътрешните замествания (в рамките на нормата) не се броят. Ставки: 6,29 € (ВПРЗ чл. 10, ал. 2) и 7,38 € за НП.
          </p>
        </div>
      )}
    </div>
  )
}
