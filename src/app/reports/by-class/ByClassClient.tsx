'use client'
import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, Users } from 'lucide-react'
interface Row {
  id: string
  firstName: string
  lastName: string
  rawClass: string
  classGroup: string
  school: string
  schoolCity: string
  csopClass: string
}
const CLASS_ORDER = ['ПГ', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
function classLabel(c: string) {
  return c === 'ПГ' ? 'ПГ' : `${c}. клас`
}
export default function ByClassClient({ rows }: { rows: Row[] }) {
  const available = CLASS_ORDER.filter(c => rows.some(r => r.classGroup === c))
  const [selected, setSelected] = useState<Set<string>>(new Set(available))

  function toggle(c: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(c)) n.delete(c); else n.add(c)
      return n
    })
  }
  function selectAll() { setSelected(new Set(available)) }
  function clearAll() { setSelected(new Set()) }

  const grouped = useMemo(() => {
    return available
      .filter(c => selected.has(c))
      .map(c => ({
        classGroup: c,
        students: rows
          .filter(r => r.classGroup === c)
          .sort((a, b) => {
            const cc = a.csopClass.localeCompare(b.csopClass, 'bg')
            if (cc !== 0) return cc
            return a.lastName.localeCompare(b.lastName, 'bg')
          }),
      }))
  }, [available, selected, rows])

  const totalShown = grouped.reduce((sum, g) => sum + g.students.length, 0)

  function exportExcel() {
    const data: any[] = []
    grouped.forEach(g => {
      g.students.forEach((s, i) => {
        data.push({
          'Клас': classLabel(g.classGroup),
          '№': i + 1,
          'Име': s.firstName,
          'Фамилия': s.lastName,
          'Клас (изпращащо)': s.rawClass,
          'Паралелка ЦСОП': s.csopClass,
          'Изпращащо училище': s.school + (s.schoolCity ? ` — ${s.schoolCity}` : ''),
        })
      })
    })
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 10 }, { wch: 4 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 32 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'По клас')
    XLSX.writeFile(wb, 'Ученици_по_клас.xlsx')
  }

  return (
    <div className="space-y-4">
      {/* Филтър по клас */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Класове</span>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-[11px] font-medium text-slate-500 hover:text-slate-800">Всички</button>
            <span className="text-slate-300">·</span>
            <button onClick={clearAll} className="text-[11px] font-medium text-slate-500 hover:text-slate-800">Изчисти</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {available.map(c => {
            const on = selected.has(c)
            const cnt = rows.filter(r => r.classGroup === c).length
            return (
              <button key={c} onClick={() => toggle(c)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  on ? 'text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                style={on ? { backgroundColor: '#0f2240' } : {}}>
                {classLabel(c)}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${on ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{cnt}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Резултат */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <Users size={15} /> Показани: <span className="font-semibold text-slate-800">{totalShown}</span> ученика
        </div>
        {totalShown > 0 && (
          <button onClick={exportExcel}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            <FileSpreadsheet size={14} className="text-green-600" /> Excel
          </button>
        )}
      </div>

      {grouped.length === 0 || totalShown === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          Избери поне един клас
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(g => (
            <div key={g.classGroup} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-700">{classLabel(g.classGroup)}</span>
                <span className="text-xs font-medium text-slate-400">{g.students.length} ученика</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase">
                    <th className="px-4 py-1.5 text-left w-8">#</th>
                    <th className="px-3 py-1.5 text-left">Ученик</th>
                    <th className="px-3 py-1.5 text-left w-24">Изпращащо</th>
                    <th className="px-3 py-1.5 text-left w-24">Паралелка ЦСОП</th>
                    <th className="px-3 py-1.5 text-left">Училище</th>
                  </tr>
                </thead>
                <tbody>
                  {g.students.map((s, idx) => (
                    <tr key={s.id} className={`border-b border-slate-50 last:border-0 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                      <td className="px-4 py-2 text-slate-300">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{s.firstName} {s.lastName}</td>
                      <td className="px-3 py-2 text-slate-400">{s.rawClass}</td>
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
          ))}
        </div>
      )}
    </div>
  )
}
