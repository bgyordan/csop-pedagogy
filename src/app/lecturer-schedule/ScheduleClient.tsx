'use client'
// График на лекторските над норматива — един лист за всички: ден, час, предмет, клас, от – до, часове по месеци.
// По месеци — реалните учебни дни в деня на часа (както в декларациите); „По заповед“ — числото от заповедта (по учебни седмици).

import { Fragment, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Search, Printer, FileSpreadsheet } from 'lucide-react'
import { smartMatch } from '@/lib/search'

export type SchedRow = { day: number; period: number; subject: string; cls: string; from: string; to: string; months: number[]; total: number }
export type SchedPerson = {
  id: string; name: string; position: string
  group: number; groupLabel: string; ownClass: string
  rows: SchedRow[]; total: number; months: number[]
}

const MONTH_LABELS = ['IX', 'X', 'XI', 'XII', 'I', 'II', 'III', 'IV', 'V', 'VI']
const DAYS = ['', 'пон', 'вт', 'ср', 'четв', 'пет']
const fmt = (d: string) => d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : ''
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

export default function ScheduleClient({ people, yearName }: { people: SchedPerson[]; yearName: string }) {
  const [q, setQ] = useState('')
  const visible = useMemo(() => people.filter(p =>
    smartMatch(`${p.name} ${p.position} ${p.rows.map(r => `${r.cls} ${r.subject}`).join(' ')}`, q)), [people, q])
  const totalMonths = MONTH_LABELS.map((_, i) => visible.reduce((a, p) => a + p.months[i], 0))
  const totalOrder = visible.reduce((a, p) => a + p.total, 0)

  function exportXlsx() {
    const head = ['Служител', 'Длъжност', 'Ден', 'Час', 'Предмет / дейност', 'Клас', 'От', 'До', ...MONTH_LABELS, 'По дати', 'По заповед']
    const data: (string | number)[][] = []
    visible.forEach(p => {
      p.rows.forEach(r => data.push([p.name, p.position, DAYS[r.day], r.period, r.subject, r.cls, fmt(r.from), fmt(r.to), ...r.months.map(v => v || ''), sum(r.months), r.total]))
      data.push([`${p.name} — общо`, '', '', '', '', '', '', '', ...p.months.map(v => v || ''), sum(p.months), p.total])
    })
    const ws = XLSX.utils.aoa_to_sheet([head, ...data, [], ['Общо', '', '', '', '', '', '', '', ...totalMonths, sum(totalMonths), totalOrder]])
    ws['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 6 }, { wch: 5 }, { wch: 30 }, { wch: 10 }, { wch: 7 }, { wch: 7 }, ...MONTH_LABELS.map(() => ({ wch: 5 })), { wch: 8 }, { wch: 10 }]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'График')
    XLSX.writeFile(wb, `график_лекторски_${(yearName || '').replace(/\W+/g, '-')}.xlsx`)
  }

  const th = 'px-1.5 py-2 font-medium text-center'
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm print:border-0 print:shadow-none print:rounded-none">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-100 print:hidden">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Служител, паралелка или предмет…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-400" />
        </div>
        <span className="text-sm text-slate-500">{visible.length} души · по заповед <b className="text-slate-800 tabular-nums">{totalOrder}</b> ч.</span>
        <div className="ml-auto flex gap-2">
          <button onClick={exportXlsx} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm border border-slate-200 text-slate-700 hover:border-[#0f2240]"><FileSpreadsheet size={15} /> Excel</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm text-white hover:opacity-90" style={{ backgroundColor: '#0f2240' }}><Printer size={15} /> Печат</button>
        </div>
      </div>

      {/* заглавие само на хартия */}
      <div className="hidden print:block mb-2">
        <div className="text-[13px] font-semibold">ЦСОП – Варна · График на лекторските часове над норматива · {yearName}</div>
        <div className="text-[10px] text-slate-600">По месеци — учебните дни в деня на часа (за сверка с декларациите); „По заповед“ — по учебни седмици.</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px] print:text-[9.5px] border-collapse">
          <thead>
            <tr className="text-[11px] print:text-[8.5px] text-slate-500 border-b border-slate-200 bg-slate-50/70">
              <th className="px-3 py-2 font-medium text-left">Ден</th>
              <th className={th}>Час</th>
              <th className="px-2 py-2 font-medium text-left">Предмет / дейност</th>
              <th className="px-2 py-2 font-medium text-left">Клас</th>
              <th className={th}>От – до</th>
              {MONTH_LABELS.map(m => <th key={m} className={`${th} w-9`}>{m}</th>)}
              <th className={`${th} w-14`} title="Сбор по месеци — реалните учебни дни в деня на часа">По дати</th>
              <th className={`${th} w-16 bg-teal-50/70 text-teal-800`} title="Числото от заповедта — по учебни седмици">По заповед</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, pi) => {
              const head = pi === 0 || visible[pi - 1].group !== p.group
              return (
                <Fragment key={p.id}>
                  {head && <tr><td colSpan={17} className="px-3 pt-4 pb-1 text-[11px] print:text-[8.5px] uppercase tracking-wide text-slate-400">{p.groupLabel}</td></tr>}
                  <tr className="border-t border-slate-300 bg-slate-50/60 break-inside-avoid">
                    <td colSpan={5} className="px-3 py-1.5">
                      <span className="text-slate-900 font-medium">{p.name}</span>
                      <span className="text-[11px] print:text-[8.5px] text-slate-500"> · {p.position}{p.ownClass ? ` · класен на ${p.ownClass}` : ''}</span>
                    </td>
                    {p.months.map((v, i) => <td key={i} className="px-1.5 py-1.5 text-center tabular-nums font-medium text-slate-700">{v || ''}</td>)}
                    <td className="px-1.5 py-1.5 text-center tabular-nums font-medium text-slate-700">{sum(p.months)}</td>
                    <td className="px-1.5 py-1.5 text-center tabular-nums font-semibold text-slate-900 bg-teal-50/40">{p.total}</td>
                  </tr>
                  {p.rows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 break-inside-avoid">
                      <td className="px-3 py-1 text-slate-600">{DAYS[r.day]}</td>
                      <td className="px-1.5 py-1 text-center tabular-nums text-slate-600">{r.period}</td>
                      <td className="px-2 py-1 text-slate-800">{r.subject}</td>
                      <td className="px-2 py-1 text-slate-700 tabular-nums">{r.cls}</td>
                      <td className="px-1.5 py-1 text-center tabular-nums text-slate-600 whitespace-nowrap">{fmt(r.from)} – {fmt(r.to)}</td>
                      {r.months.map((v, j) => <td key={j} className="px-1.5 py-1 text-center tabular-nums text-slate-600">{v || <span className="text-slate-300">·</span>}</td>)}
                      <td className="px-1.5 py-1 text-center tabular-nums text-slate-600">{sum(r.months)}</td>
                      <td className="px-1.5 py-1 text-center tabular-nums text-slate-800 bg-teal-50/20">{r.total}</td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
            {visible.length === 0 && <tr><td colSpan={17} className="px-5 py-10 text-center text-slate-400">Няма разпределени лекторски часове</td></tr>}
          </tbody>
          {visible.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50/70 font-semibold text-slate-800">
                <td colSpan={5} className="px-3 py-2">Общо</td>
                {totalMonths.map((v, i) => <td key={i} className="px-1.5 py-2 text-center tabular-nums">{v || ''}</td>)}
                <td className="px-1.5 py-2 text-center tabular-nums">{sum(totalMonths)}</td>
                <td className="px-1.5 py-2 text-center tabular-nums bg-teal-50/40">{totalOrder}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="px-5 py-3 text-xs text-slate-500 border-t border-slate-100 print:hidden">
        По месеци — колко пъти денят на часа се пада в учебен ден през месеца (без ваканции и празници), т.е. колко часа се очакват в декларацията за този месец. „По заповед“ е числото от заповедта (по учебни седмици); може да се различава с 1–2 часа, ако празник се пада в деня на часа.
      </div>
    </div>
  )
}
