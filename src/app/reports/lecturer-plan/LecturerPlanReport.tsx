'use client'
// Справка „Лекторски по учебен план“: учител · паралелки · часове по плана · норматив · над норматива · ИЧ.
// Щракване върху ред — разбивка по паралелка и предмет. Excel и печат.

import { Fragment, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Search, ChevronRight, FileSpreadsheet, Printer } from 'lucide-react'
import { smartMatch } from '@/lib/search'

export type PlanRow = {
  id: string; name: string; position: string; hasPlan: boolean; classes: string[]
  h1: number; n1: number; n2: number; therapy: number; norm: number | null
  over1: number; over2: number; overYear: number; W1: number; W2: number
  ich1: number; ich2: number; ichYear: number
  /** паралелките, в които са ИЧ (по плана) */
  ichClasses: string[]
  /** ИФО децата в разписанието на учителя в EIS */
  ifoKids: string[]
  lines: { id: string; holder: string; subject: string; h1: number; h2: number; total: number; kind: string; individual: boolean; therapy: boolean }[]
}

const f = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')
const byBg = (a: string, b: string) => a.localeCompare(b, 'bg', { numeric: true })
const KIND_CLS: Record<string, string> = {
  'ИУЧ': 'bg-sky-50 text-sky-700 border-sky-200', 'ДПЛР': 'bg-violet-50 text-violet-700 border-violet-200',
  'ЦОУД': 'bg-orange-50 text-orange-700 border-orange-200', 'ОФПВ': 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export default function LecturerPlanReport({ rows, yearName }: { rows: PlanRow[]; yearName: string }) {
  const [q, setQ] = useState('')
  const [onlyOver, setOnlyOver] = useState(true)
  const [withIch, setWithIch] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const visible = useMemo(() => rows.filter(r =>
    smartMatch(`${r.name} ${r.classes.join(' ')} ${r.ichClasses.join(' ')} ${r.ifoKids.join(' ')}`, q)
    && (!onlyOver || r.over1 > 0 || r.over2 > 0 || (withIch && r.ich1 > 0))
  ), [rows, q, onlyOver, withIch])
  const sum = visible.reduce((a, r) => ({ over1: a.over1 + r.over1, over2: a.over2 + r.over2, year: a.year + r.overYear, ich: a.ich + r.ich1, ichYear: a.ichYear + r.ichYear }), { over1: 0, over2: 0, year: 0, ich: 0, ichYear: 0 })
  const same = (r: PlanRow) => r.over1 === r.over2
  const toggle = (id: string) => setOpen(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  function exportXlsx() {
    const wb = XLSX.utils.book_new()
    const head = ['Учител', 'Длъжност', 'Паралелки', 'По плана ч./седм.', 'Към норматива (терапии 0,7)', 'Норматив', 'Над норматива I срок', 'Над норматива II срок', 'Седмици I/II', 'Над норматива за годината', 'ИЧ ч./седм.', 'ИЧ за годината', 'ИЧ в паралелки', 'ИФО деца (разписание)']
    const data = visible.map(r => [r.name, r.position, r.classes.join(', '), r.h1, r.n1, r.norm ?? '', r.over1, r.over2, `${r.W1}/${r.W2}`, r.overYear, r.ich1, r.ichYear, r.ichClasses.join(', '), r.ifoKids.join(', ')])
    const ws = XLSX.utils.aoa_to_sheet([head, ...data, [], ['Общо', '', '', '', '', '', sum.over1, sum.over2, '', sum.year, sum.ich, sum.ichYear]])
    ws['!cols'] = head.map((h, i) => ({ wch: i === 0 ? 26 : i === 2 || i === 12 ? 22 : i === 13 ? 40 : Math.max(10, Math.min(h.length + 2, 18)) }))
    XLSX.utils.book_append_sheet(wb, ws, 'Лекторски')
    const dHead = ['Учител', 'Паралелка/група', 'Предмет', 'Вид', 'ИЧ', 'I срок ч./седм.', 'II срок ч./седм.', 'За годината']
    const dData: (string | number)[][] = []
    visible.forEach(r => r.lines.slice().sort((a, b) => byBg(a.holder, b.holder) || byBg(a.subject, b.subject))
      .forEach(l => dData.push([r.name, l.holder, l.subject, l.kind || '', l.individual ? 'ИЧ' : '', l.h1, l.h2, l.total])))
    const ws2 = XLSX.utils.aoa_to_sheet([dHead, ...dData])
    ws2['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 40 }, { wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'По предмети')
    XLSX.writeFile(wb, `лекторски_по_учебен_план_${(yearName || '').replace(/\W+/g, '-')}.xlsx`)
  }

  const th = 'px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide'
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-100 print:hidden">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Учител или паралелка…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-400" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={onlyOver} onChange={e => setOnlyOver(e.target.checked)} className="rounded" /> само с над норматива
        </label>
        {onlyOver && (
          <label className="inline-flex items-center gap-2 text-sm text-violet-700 cursor-pointer">
            <input type="checkbox" checked={withIch} onChange={e => setWithIch(e.target.checked)} className="rounded" /> + с ИЧ
          </label>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={exportXlsx} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm border border-slate-200 text-slate-700 hover:border-[#0f2240]"><FileSpreadsheet size={15} /> Excel</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm border border-slate-200 text-slate-700 hover:border-[#0f2240]"><Printer size={15} /> Печат</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70">
            <tr className="text-left">
              <th className={th}>Учител</th>
              <th className={th}>Паралелки</th>
              <th className={`${th} text-center`} title="Часове седмично по учебния план, без ИЧ">По плана</th>
              <th className={`${th} text-center`}>Норматив</th>
              <th className={`${th} text-center bg-teal-50/60 text-teal-800`}>Над норм. I срок</th>
              <th className={`${th} text-center bg-teal-50/60 text-teal-800`}>II срок</th>
              <th className={`${th} text-center bg-teal-50/60 text-teal-800`}>За годината</th>
              <th className={`${th} text-violet-700`} title="Индивидуални часове с ИФО деца — по отделна заповед, не влизат в над норматива">ИЧ (ИФО)</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(r => {
              const isOpen = open.has(r.id)
              return (
                <Fragment key={r.id}>
                  <tr onClick={() => r.hasPlan && toggle(r.id)} className={`border-t border-slate-100 ${r.hasPlan ? 'cursor-pointer hover:bg-slate-50/70' : ''} ${isOpen ? 'bg-slate-50/70' : ''}`}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <ChevronRight size={14} className={`shrink-0 text-slate-400 transition-transform print:hidden ${isOpen ? 'rotate-90' : ''} ${r.hasPlan ? '' : 'opacity-0'}`} />
                        <div>
                          <div className="text-slate-800">{r.name}</div>
                          {r.position && <div className="text-[11px] text-slate-400">{r.position}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-slate-600">
                      {r.hasPlan ? (r.classes.length ? r.classes.join(' · ') : '—') : <span className="text-slate-400">няма учебен план</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-700" title={r.therapy ? `${f(r.h1)} часа, от тях ${f(r.therapy)} терапии по 0,7 → ${f(r.n1)} към норматива` : undefined}>
                      {r.hasPlan ? <>{f(r.n1)}{r.therapy > 0 && <span className="text-[11px] text-slate-400"> ({f(r.h1)})</span>}</> : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-500">{r.norm ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums font-medium text-teal-800 bg-teal-50/30">{r.over1 ? f(r.over1) : <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-teal-800 bg-teal-50/30">{same(r) ? <span className="text-slate-400 text-[12px]">{r.over2 ? 'същото' : '—'}</span> : r.over2 ? f(r.over2) : '—'}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums font-medium text-slate-800 bg-teal-50/30" title={`${f(r.over1)} × ${r.W1} седм. + ${f(r.over2)} × ${r.W2} седм.`}>{r.overYear || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-[13px] text-violet-700 min-w-[150px]">
                      {r.ich1 || r.ifoKids.length ? (
                        <>
                          {r.ich1 > 0 && <div className="tabular-nums">{f(r.ich1)} ч./седм.{r.ichYear ? <span className="text-violet-500"> · {r.ichYear} за год.</span> : null}</div>}
                          {r.ichClasses.length > 0 && <div className="text-[11px] text-slate-500">в {r.ichClasses.join(' · ')}</div>}
                          {r.ifoKids.length > 0 && <div className="text-[11px] text-slate-500 truncate max-w-[220px]" title={r.ifoKids.join(', ')}>{r.ifoKids.join(', ')}</div>}
                        </>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={8} className="px-3 pb-3 pt-0">
                        <table className="w-full text-[13px] ml-6 max-w-3xl">
                          <thead><tr className="text-left text-[11px] text-slate-400">
                            <th className="py-1.5 pr-3 font-medium w-28">Паралелка</th><th className="py-1.5 pr-3 font-medium">Предмет</th>
                            <th className="py-1.5 px-2 font-medium text-center w-16">I срок</th><th className="py-1.5 px-2 font-medium text-center w-16">II срок</th><th className="py-1.5 px-2 font-medium text-center w-20">годишно</th>
                          </tr></thead>
                          <tbody>
                            {r.lines.slice().sort((a, b) => Number(a.individual) - Number(b.individual) || byBg(a.holder, b.holder) || byBg(a.subject, b.subject)).map(l => (
                              <tr key={l.id} className="border-t border-slate-200/70">
                                <td className="py-1.5 pr-3 text-slate-600">{l.holder}</td>
                                <td className="py-1.5 pr-3 text-slate-800">
                                  {l.subject}
                                  {l.kind && l.kind !== 'ЗП' && <span className={`ml-1.5 text-[10px] px-1.5 py-px rounded border ${KIND_CLS[l.kind] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{l.kind}</span>}
                                  {l.therapy && <span className="ml-1.5 text-[10px] px-1.5 py-px rounded border bg-violet-50 text-violet-700 border-violet-200">0,7</span>}
                                  {l.individual && <span className="ml-1.5 text-[10px] px-1.5 py-px rounded border bg-violet-50 text-violet-700 border-violet-200">ИЧ</span>}
                                </td>
                                <td className="py-1.5 px-2 text-center tabular-nums">{f(l.h1)}</td>
                                <td className="py-1.5 px-2 text-center tabular-nums">{f(l.h2)}</td>
                                <td className="py-1.5 px-2 text-center tabular-nums text-slate-500">{f(l.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {visible.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">Няма учители</td></tr>}
          </tbody>
          {visible.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/70 text-slate-700">
                <td className="px-3 py-2.5 font-medium" colSpan={4}>Общо · {visible.length} {visible.length === 1 ? 'учител' : 'учители'}</td>
                <td className="px-3 py-2.5 text-center tabular-nums font-medium">{f(sum.over1)}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{f(sum.over2)}</td>
                <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-slate-900">{sum.year}</td>
                <td className="px-3 py-2.5 tabular-nums text-violet-700">{sum.ich ? <>{f(sum.ich)} ч./седм. · {sum.ichYear} за год.</> : '—'}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="px-5 py-3 text-xs text-slate-500 border-t border-slate-100 space-y-1">
        <p><b className="text-slate-700">Как се смята:</b> „По плана“ — часовете седмично от учебния план (НЕИСПУО), терапиите (норма 30) по 0,7; в скоби — реалните часове. Над норматива = по плана − норматива (21). За годината = I срок × седмиците му + II срок × седмиците му.</p>
        <p>ИЧ (ИФО) — часовете по плана с ИФО деца: седмично, за годината и в коя паралелка; имената на децата са от разписанието в EIS. По отделна заповед — не влизат в над норматива. Справката не е разпределението по график — то е в „Лекторски над норматива“.</p>
      </div>
    </div>
  )
}
