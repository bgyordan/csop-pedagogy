'use client'
// Кратко: само Име и Лекторски за годината. Нищо друго.
import * as XLSX from 'xlsx'
import { FileSpreadsheet, Printer } from 'lucide-react'

export default function ShortReport({ rows, yearName }: { rows: { name: string; year: number }[]; yearName: string }) {
  const list = rows.filter(r => r.year > 0).sort((a, b) => a.name.localeCompare(b.name, 'bg'))
  const total = list.reduce((a, r) => a + r.year, 0)
  function exportXlsx() {
    const ws = XLSX.utils.aoa_to_sheet([['№', 'Име', 'Лекторски за годината'], ...list.map((r, i) => [i + 1, r.name, r.year]), [], ['', 'Общо', total]])
    ws['!cols'] = [{ wch: 5 }, { wch: 32 }, { wch: 22 }]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Лекторски')
    XLSX.writeFile(wb, `лекторски_${(yearName || '').replace(/\W+/g, '-')}.xlsx`)
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm max-w-xl">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 print:hidden">
        <span className="text-sm text-slate-500">{list.length} учители</span>
        <div className="ml-auto flex gap-2">
          <button onClick={exportXlsx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border border-slate-200 text-slate-700 hover:border-[#0f2240]"><FileSpreadsheet size={15} /> Excel</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border border-slate-200 text-slate-700 hover:border-[#0f2240]"><Printer size={15} /> Печат</button>
        </div>
      </div>
      <table className="w-full text-[15px]">
        <thead>
          <tr className="text-left text-[12px] text-slate-500">
            <th className="px-5 py-2 font-medium w-10">№</th>
            <th className="px-2 py-2 font-medium">Име</th>
            <th className="px-5 py-2 font-medium text-right">Лекторски за годината</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={r.name + i} className="border-t border-slate-100">
              <td className="px-5 py-2 text-slate-400 tabular-nums">{i + 1}</td>
              <td className="px-2 py-2 text-slate-800">{r.name}</td>
              <td className="px-5 py-2 text-right tabular-nums font-medium text-slate-900">{r.year}</td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan={3} className="px-5 py-10 text-center text-slate-400">Няма лекторски</td></tr>}
        </tbody>
        {list.length > 0 && (
          <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50/70">
            <td /><td className="px-2 py-2.5 font-medium text-slate-700">Общо</td>
            <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-slate-900">{total}</td>
          </tr></tfoot>
        )}
      </table>
    </div>
  )
}
