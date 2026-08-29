'use client'
import { useState, useMemo } from 'react'
import { Search, X, ScrollText, Download } from 'lucide-react'
import type { NormDoc } from './page'

export default function NormativeDocsClient({ docs }: { docs: NormDoc[] }) {
  const [q, setQ] = useState('')
  const [year, setYear] = useState('all')

  const years = useMemo(() => {
    const set = new Set<string>()
    docs.forEach(d => d.academic_year && set.add(d.academic_year))
    return Array.from(set).sort().reverse()
  }, [docs])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return docs.filter(d => {
      const okYear = year === 'all' || d.academic_year === year
      const okQuery = query === '' || d.name.toLowerCase().includes(query)
      return okYear && okQuery
    })
  }, [docs, q, year])

  return (
    <div className="space-y-4">
      {/* Търсене */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Търсене на документ по име…"
          className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:border-slate-400" />
        {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={15} /></button>}
      </div>

      {/* Филтър по година */}
      {years.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setYear('all')}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${year === 'all' ? 'bg-[#0f2240] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            Всички
          </button>
          {years.map(y => (
            <button key={y} onClick={() => setYear(y)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${year === y ? 'bg-[#0f2240] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              {y}
            </button>
          ))}
        </div>
      )}

      {/* Списък */}
      {filtered.length === 0 ? (
        <div className="text-center py-14 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
          <ScrollText size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">
            {docs.length === 0 ? 'Все още няма качени документи.' : 'Няма документ, който да отговаря на търсенето.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => (
            <a key={d.id} href={d.file_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 hover:border-slate-400 hover:shadow-[0_2px_8px_rgba(15,34,64,0.10)] transition-all group shadow-[0_1px_4px_rgba(15,34,64,0.06)]">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-rose-50 text-rose-600 shrink-0">
                <ScrollText size={18} />
              </span>
              <span className="min-w-0 flex-1">
                {d.academic_year && <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 mb-0.5">{d.academic_year}</span>}
                <span className="block text-sm text-slate-800 truncate group-hover:text-[#0f2240]">{d.name}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-[#0f2240] shrink-0">
                <Download size={15} /> PDF
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
