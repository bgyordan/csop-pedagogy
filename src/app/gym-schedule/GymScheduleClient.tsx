'use client'
import { Dumbbell, User } from 'lucide-react'

interface Occupant { label: string; teacher: string; ifo?: boolean }

const DAYS = [{ n: 1, l: 'Понеделник' }, { n: 2, l: 'Вторник' }, { n: 3, l: 'Сряда' }, { n: 4, l: 'Четвъртък' }, { n: 5, l: 'Петък' }]
const PERIODS = [1, 2, 3, 4, 5, 6, 7]
const TIMES: Record<number, string> = { 1: '8:30–9:05', 2: '9:15–9:50', 3: '10:20–10:55', 4: '11:05–11:40', 5: '11:50–12:25', 6: '12:35–13:05', 7: '13:15–13:50' }

export default function GymScheduleClient({ cells, yearName, capacity }: { cells: Record<string, Occupant[]>; yearName: string; capacity: number }) {
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><Dumbbell size={20} className="text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">График на физкултурния салон</h1>
          <p className="text-slate-500 text-sm mt-0.5">{yearName} · часовете по ФВС от разписанията · капацитет {capacity} едновременно</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-[0_1px_6px_rgba(15,34,64,0.06)]">
        <table className="w-full border-collapse text-sm min-w-[720px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 border-b border-r border-slate-200 px-2 py-2 text-[11px] font-semibold text-slate-500 w-16">Час</th>
              {DAYS.map(d => <th key={d.n} className="border-b border-l border-slate-100 px-2 py-2 text-xs font-semibold text-slate-600">{d.l}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map(p => (
              <tr key={p} className="align-top">
                <td className="sticky left-0 z-10 bg-slate-50 border-b border-r border-slate-200 px-2 py-2 text-center">
                  <div className="inline-flex items-center justify-center h-5 w-5 rounded text-white text-[10px] font-bold" style={{ backgroundColor: '#0f2240' }}>{p}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{TIMES[p]}</div>
                </td>
                {DAYS.map(d => {
                  const occ = cells[`${d.n}-${p}`] || []
                  const over = occ.length > capacity
                  const full = occ.length === capacity
                  const bg = over ? 'bg-rose-50' : full ? 'bg-amber-50/50' : ''
                  return (
                    <td key={d.n} className={`border-b border-l border-slate-100 px-1.5 py-1.5 ${bg}`}>
                      <div className="space-y-1">
                        {occ.map((o, i) => (
                          <div key={i} className={`rounded-lg border px-2 py-1 ${o.ifo ? 'bg-teal-50 border-teal-100' : 'bg-white border-slate-200'}`}>
                            <div className="text-xs font-medium text-slate-700 leading-tight truncate">{o.label}</div>
                            {o.teacher && <div className="text-[10px] text-slate-400 inline-flex items-center gap-0.5"><User size={9} /> {o.teacher}</div>}
                          </div>
                        ))}
                        {occ.length === 0 && <div className="text-[10px] text-slate-300 text-center py-1">свободно</div>}
                      </div>
                      {over && <div className="text-[9px] text-rose-500 font-medium text-center mt-0.5">{occ.length}/{capacity}</div>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-50 border border-amber-200" /> запълнено ({capacity}/{capacity})</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-rose-50 border border-rose-200" /> претоварено (над {capacity})</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-teal-50 border border-teal-200" /> ИФО</span>
      </div>
    </div>
  )
}
