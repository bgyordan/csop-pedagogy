'use client'
import * as XLSX from 'xlsx'
import { FileSpreadsheet } from 'lucide-react'
interface Row {
  studentId: string
  firstName: string
  lastName: string
  externalClass: string
  school: string
  schoolCity: string
  csopClass: string
  hasEnroll: boolean
  hasCoud: boolean
}
export default function EnrollmentsClient({ rows }: { rows: Row[] }) {
  function exportExcel() {
    const data = rows.map((r, i) => ({
      '№': i + 1,
      'Име': r.firstName,
      'Фамилия': r.lastName,
      'Клас (изпращащо)': r.externalClass,
      'Паралелка ЦСОП': r.csopClass,
      'Изпращащо училище': r.school + (r.schoolCity ? ` — ${r.schoolCity}` : ''),
      'Заявление за прием': r.hasEnroll ? 'Да' : '',
      'Заявление за ЦОУД': r.hasCoud ? 'Да' : '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 4 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 16 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Заявления')
    XLSX.writeFile(wb, 'Заявления_прием_ЦОУД.xlsx')
  }
  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
          <FileSpreadsheet size={15} className="text-green-600" />
          Експорт Excel
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-8">#</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Ученик</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-20">Паралелка</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Училище</th>
              <th className="text-center px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Прием</th>
              <th className="text-center px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">ЦОУД</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">Няма заявления в досиетата</td></tr>
            ) : rows.map((row, idx) => (
              <tr key={row.studentId}
                className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                <td className="px-3 py-1.5 text-slate-300">{idx + 1}</td>
                <td className="px-3 py-1.5 font-medium text-slate-800">
                  {row.firstName} {row.lastName}
                  {row.externalClass && row.externalClass !== '—' && (
                    <span className="ml-1.5 text-[10px] text-slate-400">({row.externalClass})</span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  {row.csopClass !== '—'
                    ? <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 font-mono font-semibold text-slate-700">{row.csopClass}</span>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-1.5 text-slate-600 max-w-[200px] truncate">
                  {row.school}{row.schoolCity ? <span className="text-slate-400"> · {row.schoolCity}</span> : ''}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {row.hasEnroll
                    ? <span className="text-green-700 font-bold">✓</span>
                    : <span className="text-slate-200">—</span>}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {row.hasCoud
                    ? <span className="text-indigo-700 font-bold">✓</span>
                    : <span className="text-slate-200">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-slate-500">Общо: {rows.length}</td>
              <td className="px-3 py-2 text-center text-xs font-bold text-green-600">{rows.filter(r => r.hasEnroll).length}</td>
              <td className="px-3 py-2 text-center text-xs font-bold text-indigo-600">{rows.filter(r => r.hasCoud).length}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
