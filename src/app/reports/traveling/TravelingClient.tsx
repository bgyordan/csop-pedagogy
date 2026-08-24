'use client'
import * as XLSX from 'xlsx'
import { FileSpreadsheet } from 'lucide-react'
interface Row {
  id: string
  firstName: string
  lastName: string
  externalClass: string
  school: string
  schoolCity: string
  csopClass: string
}
export default function TravelingClient({ rows }: { rows: Row[] }) {
  function exportExcel() {
    const data = rows.map((r, i) => ({
      '№': i + 1,
      'Име': r.firstName,
      'Фамилия': r.lastName,
      'Клас (изпращащо)': r.externalClass,
      'Паралелка ЦСОП': r.csopClass,
      'Изпращащо училище': r.school + (r.schoolCity ? ` — ${r.schoolCity}` : ''),
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 4 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 32 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Пътуващи')
    XLSX.writeFile(wb, 'Пътуващи_ученици.xlsx')
  }
  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <div className="flex justify-end">
          <button onClick={exportExcel}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            <FileSpreadsheet size={14} className="text-green-600" /> Excel
          </button>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase w-8">#</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Ученик</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-24">Изпращащо</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-24">Паралелка ЦСОП</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Училище</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">Няма отбелязани пътуващи ученици</td></tr>
            ) : rows.map((s, idx) => (
              <tr key={s.id} className={`border-b border-slate-50 last:border-0 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                <td className="px-4 py-2 text-slate-300">{idx + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{s.firstName} {s.lastName}</td>
                <td className="px-3 py-2 text-slate-400">{s.externalClass}</td>
                <td className="px-3 py-2">
                  {s.csopClass !== '—'
                    ? <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 font-mono font-semibold text-slate-700">{s.csopClass}</span>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">
                  {s.school}{s.schoolCity ? <span className="text-slate-400"> · {s.schoolCity}</span> : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
