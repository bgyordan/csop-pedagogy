'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronsUpDown, ArrowUp, ArrowDown, Sparkles, Users } from 'lucide-react'
import { getFullName } from '@/lib/utils'

interface Row {
  key: string
  student: any
  className: string | null
  unassigned: boolean
}

type SortKey = 'name' | 'class'
type SortDir = 'asc' | 'desc'

export default function StudentsTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = [...rows].sort((a, b) => {
    // Неразпределените винаги отгоре
    if (a.unassigned !== b.unassigned) return a.unassigned ? -1 : 1
    let cmp = 0
    if (sortKey === 'name') {
      cmp = getFullName(a.student).localeCompare(getFullName(b.student), 'bg')
    } else {
      const ca = a.className || 'яяя' // без паралелка -> накрая
      const cb = b.className || 'яяя'
      cmp = ca.localeCompare(cb, 'bg')
      if (cmp === 0) cmp = getFullName(a.student).localeCompare(getFullName(b.student), 'bg')
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown size={12} className="text-slate-300" />
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="text-[#0f2240]" />
      : <ArrowDown size={12} className="text-[#0f2240]" />
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="text-left px-6 py-3">
                <button type="button" onClick={() => toggleSort('name')}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-[#0f2240] transition-colors">
                  Три имена <SortIcon col="name" />
                </button>
              </th>
              <th className="text-left px-6 py-3">
                <button type="button" onClick={() => toggleSort('class')}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-[#0f2240] transition-colors">
                  Паралелка <SortIcon col="class" />
                </button>
              </th>
              <th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Клас</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((r, i) => (
              <tr key={r.key} className={`group transition-colors hover:bg-blue-50/40 ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                <td className="px-6 py-1.5 font-semibold text-slate-800">
                  <span className="inline-flex items-center gap-2">
                    {getFullName(r.student)}
                    {r.student?.is_new && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 uppercase tracking-wide">
                        <Sparkles size={9} /> Нов
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-6 py-1.5">
                  {r.className ? (
                    <span className="text-slate-600">{r.className}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      без паралелка
                    </span>
                  )}
                </td>
                <td className="px-6 py-1.5 text-slate-500">{r.student?.external_class?.trim() || '—'}</td>
                <td className="px-6 py-1.5 text-right">
                  <Link href={`/students/${r.student?.id}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] uppercase tracking-widest">
                    Преглед <ChevronRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <div className="text-center py-20">
          <Users className="mx-auto mb-3 text-slate-300" size={40} />
          <p className="text-sm text-slate-500 font-medium">Няма намерени ученици</p>
        </div>
      )}
    </div>
  )
}
