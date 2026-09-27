'use client'
import { useEffect, useState } from 'react'
import { studentDocCounts } from '@/app/dashboard/components/class-drive-actions'
import Link from 'next/link'
import OutreachBadge from '@/components/OutreachBadge'
import { getFullName } from '@/lib/utils'
import { ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown, Home, GraduationCap, Coffee, Check, FileText } from 'lucide-react'

type SortKey = 'name' | 'class'
type SortDir = 'asc' | 'desc'
interface Row {
  key: string
  student: any
  className: string | null
  outreach?: string | null
  unassigned: boolean
  educationForm?: string | null
  coudEnrolled?: boolean
}

export default function StudentsTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  // брой документи в Drive за всяко дете (текущата година) — зарежда се след списъка
  const [docs, setDocs] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    const ids = rows.map(r => r.student?.id).filter(Boolean)
    if (!ids.length) { setDocs({}); return }
    studentDocCounts(ids).then(setDocs).catch(() => setDocs({}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key); setSortDir('asc')
    }
  }

  // неразпределените винаги най-горе
  const sorted = [...rows].sort((a, b) => {
    if (a.unassigned !== b.unassigned) return a.unassigned ? -1 : 1
    let cmp = 0
    if (sortKey === 'name') {
      cmp = getFullName(a.student).localeCompare(getFullName(b.student), 'bg')
    } else {
      cmp = (a.className || '').localeCompare(b.className || '', 'bg', { numeric: true })
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown size={12} className="text-slate-300" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-slate-500" />
      : <ChevronDown size={12} className="text-slate-500" />
  }

  return (
    <div>
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto rounded-lg">
      {/* Заглавен ред (десктоп) */}
      <div className="hidden md:grid grid-cols-[1fr_130px_90px_110px_90px_90px] gap-3 px-4 py-2 sticky top-0 z-10 bg-slate-100">
        <button type="button" onClick={() => toggleSort('name')}
          className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors">
          Три имена <SortIcon col="name" />
        </button>
        <button type="button" onClick={() => toggleSort('class')}
          className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors">
          Паралелка <SortIcon col="class" />
        </button>
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Клас</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Форма</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 text-center">ЦОУД</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 text-center">Документи</span>
      </div>

      {/* Редове като карти */}
      <div className="space-y-2">
        {sorted.map(r => {
          const isIfo = r.educationForm === 'ifo'
          return (
            <Link key={r.key} href={`/students/${r.student.id}`}
              className="block bg-white border border-slate-200 rounded-2xl px-4 py-2.5 cursor-pointer hover:border-slate-400 hover:shadow-[0_2px_8px_rgba(15,34,64,0.10)] transition-all group grid grid-cols-1 md:grid-cols-[1fr_130px_90px_110px_90px_90px] gap-1 md:gap-3 md:items-center shadow-[0_1px_4px_rgba(15,34,64,0.06)]">
              {/* Име */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-slate-800 truncate">{getFullName(r.student)}</span>
                {r.unassigned && (
                  <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">без паралелка</span>
                )}
                <ChevronRight size={15} className="md:hidden ml-auto text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
              {/* Паралелка */}
              <div className="text-sm text-slate-600">
                <span className="md:hidden text-[10px] uppercase text-slate-400 mr-1">Паралелка:</span>
                {r.className || <span className="text-slate-300">—</span>}
                {r.outreach && <span className="ml-1.5"><OutreachBadge location={r.outreach} size="xs" /></span>}
              </div>
              {/* Клас */}
              <div className="text-sm text-slate-500">
                <span className="md:hidden text-[10px] uppercase text-slate-400 mr-1">Клас:</span>
                {r.student?.external_class?.trim() ? `${r.student.external_class.trim()}${r.student?.external_class_letter ? ' ' + r.student.external_class_letter : ''}` : '—'}
              </div>
              {/* Форма */}
              <div>
                <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
                  isIfo ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {isIfo ? <Home size={11} /> : <GraduationCap size={11} />}
                  {isIfo ? 'ИФО' : 'Дневна'}
                </span>
              </div>
              {/* ЦОУД */}
              <div className="md:text-center">
                <span className="md:hidden text-[10px] uppercase text-slate-400 mr-1">ЦОУД:</span>
                {r.coudEnrolled ? (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                    <Coffee size={11} /> Да
                  </span>
                ) : (
                  <span className="text-slate-300 text-xs">—</span>
                )}
              </div>
              {/* Документи (Drive, текущата година) */}
              <div className="md:text-center">
                <span className="md:hidden text-[10px] uppercase text-slate-400 mr-1">Документи:</span>
                {docs === null ? (
                  <span className="inline-block w-8 h-4 rounded-full bg-slate-100 animate-pulse align-middle" />
                ) : docs[r.student?.id] ? (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                    <FileText size={11} /> {docs[r.student.id]}
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">няма</span>
                )}
              </div>
            </Link>
          )
        })}
           </div>
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">Няма ученици</div>
      )}
    </div>
  )
}
