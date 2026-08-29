'use client'
import { useState } from 'react'
import { Check } from 'lucide-react'

type CoudStudent = { name: string; className: string; externalClass: string; classTeacher: string; hasAppl: boolean }
type CoudGroupData = { name: string; teacher: string; students: CoudStudent[] }

export default function CoudTabs({ groups }: { groups: CoudGroupData[] }) {
  const [active, setActive] = useState(0)
  if (groups.length === 0) {
    return <div className="bg-white rounded-xl border border-slate-200 text-center py-12 text-slate-400 text-sm shadow-sm">Няма ЦОУД групи</div>
  }
  const g = groups[active] || groups[0]
  return (
    <div>
      {/* Табове на групите */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {groups.map((grp, i) => (
          <button key={i} onClick={() => setActive(i)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              i === active ? 'bg-[#0f2240] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}>
            {grp.name} <span className={i === active ? 'text-white/60' : 'text-slate-400'}>({grp.students.length})</span>
          </button>
        ))}
      </div>

      {/* Таблица на активната група */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 text-xs text-slate-500">
          Възпитател: <span className="font-medium text-slate-700">{g.teacher}</span>
        </div>
        {g.students.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400 text-sm">Няма записани ученици</div>
        ) : (
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="text-[10px] font-medium text-slate-400 uppercase tracking-wide border-b border-slate-100">
                <th className="text-left px-4 py-2 w-[30%]">Ученик</th>
                <th className="text-left px-4 py-2 w-[15%]">Паралелка</th>
                <th className="text-left px-4 py-2 w-[12%]">Клас</th>
                <th className="text-left px-4 py-2 w-[28%]">Класен ръководител</th>
                <th className="text-center px-4 py-2 w-[15%]">Заявление</th>
              </tr>
            </thead>
            <tbody>
              {g.students.map((s, si) => (
                <tr key={si} className={`border-b border-slate-50 last:border-0 ${si % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                  <td className="px-4 py-2 text-slate-800 truncate">{s.name}</td>
                  <td className="px-4 py-2 text-slate-600">{s.className}</td>
                  <td className="px-4 py-2 text-slate-600">{s.externalClass}</td>
                  <td className="px-4 py-2 text-slate-600 truncate">{s.classTeacher}</td>
                  <td className="px-4 py-2 text-center">
                    {s.hasAppl ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium"><Check size={14} /> Да</span>
                    ) : (
                      <span className="text-rose-400 text-xs">няма</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
