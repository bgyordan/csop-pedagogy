'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { studentDocCounts } from './class-drive-actions'

// „Без документи в Drive“ — брои се след зареждането на таблото (Drive е по-бавен)
export default function NoDocsCount({ students }: { students: { id: string; name: string }[] }) {
  const [missing, setMissing] = useState<{ id: string; name: string }[] | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!students.length) { setMissing([]); return }
    studentDocCounts(students.map(s => s.id))
      .then(c => setMissing(Object.keys(c).length ? students.filter(s => !c[s.id]) : []))
      .catch(() => setMissing([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} disabled={!missing?.length}
        className="w-full flex items-center justify-between gap-2 text-left text-sm text-slate-700 disabled:cursor-default">
        <span>Без нито един документ в Drive</span>
        {missing === null
          ? <span className="w-8 h-5 rounded-full bg-slate-100 animate-pulse" />
          : <span className={`px-2 py-0.5 rounded-full text-xs ${missing.length ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{missing.length || '✓'}</span>}
      </button>
      {open && !!missing?.length && (
        <div className="mt-2 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
          {missing.map(s => (
            <Link key={s.id} href={`/students/${s.id}`} className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[11px] text-slate-600 hover:border-sky-200 hover:text-[#0f2240]">{s.name}</Link>
          ))}
        </div>
      )}
    </div>
  )
}
