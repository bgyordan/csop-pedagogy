'use client'
import { useState } from 'react'
import { Users, Sparkles } from 'lucide-react'
import DistributionPdfButton from '../reports/DistributionPdfButton'
interface Props {
  allRows: any[]
  specialists: { id: string; name: string; role: string }[]
  yearName: string
}
export default function SpravkiClient({ allRows, specialists, yearName }: Props) {
  const [distClass, setDistClass] = useState('')
  const [distSpecialist, setDistSpecialist] = useState('')
  const [distNewOnly, setDistNewOnly] = useState(false)
  const [distSearch, setDistSearch] = useState('')
  const uniqueClasses = Array.from(new Set(allRows.map((r: any) => r.className).filter((c: string) => c && c !== '—')))
    .sort((a: any, b: any) => String(a).localeCompare(String(b), 'bg', { numeric: true }))
  const distRows = allRows.filter((r: any) => {
    if (distClass && r.className !== distClass) return false
    if (distSpecialist && r.psychologistId !== distSpecialist && r.speechTherapistId !== distSpecialist && r.rehabilitatorId !== distSpecialist) return false
    if (distNewOnly && !r.isNew) return false
    if (distSearch.trim()) {
      const q = distSearch.toLowerCase()
      if (!r.name.toLowerCase().includes(q) && !(r.sendingSchoolName || '').toLowerCase().includes(q)) return false
    }
    return true
  }).sort((a: any, b: any) => String(a.className).localeCompare(String(b.className), 'bg', { numeric: true }) || a.name.localeCompare(b.name, 'bg'))
  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {/* Филтри + действия */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={distSearch} onChange={e => setDistSearch(e.target.value)}
            placeholder="Търси по име или училище…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <select value={distClass} onChange={e => setDistClass(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
          <option value="">Всички паралелки</option>
          {uniqueClasses.map((c: any) => <option key={c} value={c}>Паралелка {c}</option>)}
        </select>
        <select value={distSpecialist} onChange={e => setDistSpecialist(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
          <option value="">Всички специалисти</option>
          {specialists.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={() => setDistNewOnly(!distNewOnly)}
          className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${distNewOnly ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
          <Sparkles size={13} /> Само нови
        </button>
        <span className="text-xs text-slate-400 ml-auto">{distRows.length} ученика</span>
        <DistributionPdfButton rows={distRows} yearName={yearName} />
      </div>
      {/* Таблица — нежни линийки + бледа зебра */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50/70 border-b border-slate-200">
              <tr className="[&>th]:border-r [&>th]:border-slate-100 [&>th:last-child]:border-r-0">
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Име</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Пар.</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Класен</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-blue-500 uppercase tracking-widest">Психолог</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-purple-500 uppercase tracking-widest">Логопед</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-teal-500 uppercase tracking-widest">Рехаб.</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Училище</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Форма</th>
              </tr>
            </thead>
            <tbody>
              {distRows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">Няма ученици по този филтър</td></tr>
              ) : distRows.map((row: any, idx: number) => {
                const nextRow = distRows[idx + 1]
                const classChanges = !nextRow || nextRow.className !== row.className
                return (
                <tr key={row.studentId}
                  className={`hover:bg-blue-50/40 transition-colors [&>td]:border-r [&>td]:border-slate-100 [&>td:last-child]:border-r-0 ${classChanges ? 'border-b-[3px] border-double border-slate-400' : 'border-b border-slate-100'} ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                  <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {row.name}
                      {row.isNew && <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200"><Sparkles size={9} /> НОВ</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{row.className}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{row.classTeacher || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{row.psychologist}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{row.speechTherapist}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{row.rehabilitator}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{row.sendingSchoolName}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.educationForm === 'ifo' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {row.educationForm === 'ifo' ? 'ИФО' : 'Дневна'}
                    </span>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
