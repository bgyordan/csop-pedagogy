'use client'
import { useState, useMemo } from 'react'
import { Search, Printer, Phone, AlertTriangle } from 'lucide-react'

interface GuardianInfo { name: string; relation: string; phone: string }
interface ReportRow { id: string; name: string; csopClass: string; guardians: GuardianInfo[] }

export default function GuardiansClient({ rows }: { rows: ReportRow[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.csopClass.toLowerCase().includes(q) ||
      r.guardians.some(g => g.name.toLowerCase().includes(q) || g.phone.toLowerCase().includes(q))
    )
  }, [rows, search])

  const noGuardian = rows.filter(r => r.guardians.length === 0).length

  return (
    <div>
      {/* Лента: търсене + печат (не се печата) */}
      <div className="flex items-center gap-2 mb-4 print:hidden">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Търсене по ученик, паралелка, родител, телефон…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:border-slate-400" />
        </div>
        <span className="text-xs text-slate-400">{filtered.length} от {rows.length}</span>
        <button onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-medium hover:opacity-90 transition-all"
          style={{ backgroundColor: '#0f2240' }}>
          <Printer size={15} /> Печат
        </button>
      </div>

      {noGuardian > 0 && (
        <div className="flex items-center gap-2 mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 print:hidden">
          <AlertTriangle size={14} /> {noGuardian} {noGuardian === 1 ? 'ученик няма' : 'ученика нямат'} въведен родител
        </div>
      )}

      {/* Заглавие само при печат */}
      <div className="hidden print:block mb-3">
        <h2 className="text-base font-bold">Родители и контакти — ЦСОП Варна</h2>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm print:shadow-none print:border-slate-300">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 w-[34%]">Ученик</th>
              <th className="text-left px-4 py-2.5 w-[12%]">Паралелка</th>
              <th className="text-left px-4 py-2.5">Родител(и) и телефон</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr key={r.id} className={`border-b border-slate-100 last:border-0 align-top ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                <td className="px-4 py-2.5 text-slate-800">{r.name}</td>
                <td className="px-4 py-2.5 text-slate-600">{r.csopClass}</td>
                <td className="px-4 py-2.5">
                  {r.guardians.length === 0 ? (
                    <span className="text-rose-400 text-xs">няма въведен</span>
                  ) : (
                    <div className="space-y-0.5">
                      {r.guardians.map((g, gi) => (
                        <div key={gi} className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-700">{g.name}</span>
                          {g.relation && <span className="text-[11px] text-slate-400">({g.relation})</span>}
                          {g.phone && (
                            <span className="inline-flex items-center gap-1 text-slate-600">
                              <Phone size={12} className="text-slate-400 print:hidden" /> {g.phone}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">Няма резултати</div>
        )}
      </div>
    </div>
  )
}
