'use client'
// Два начина: бърза таблица (число → автоматично разпределение) и ръчно маркиране в разписанието.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table2, CalendarRange } from 'lucide-react'
import QuickTable from './QuickTable'
import type { QTRow } from './QuickTable'
import type { Ends } from './distribute'
import LecturerClient from './LecturerClient'

type Marked = { id: string; staffId: string; staffName: string; day: number; period: number; subject: string; holderLabel: string; dateFrom: string; dateTo: string; orderNumber: string; term: number }

export default function LecturerTabs({ academicYearId, teachers, marked, schoolDates, rows, ends, defaultEnd }: {
  academicYearId: string; teachers: { id: string; name: string }[]; marked: Marked[]; schoolDates: string[]; rows: QTRow[]; ends: Ends; defaultEnd: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'table' | 'grid'>('table')
  const [editId, setEditId] = useState<string | undefined>()
  // при ново разпределение — презареждаме изгледа с разписанието
  const gridKey = `${marked.length}:${marked.map(m => m.id).join('').slice(0, 64)}:${editId || ''}`

  const T = (k: 'table' | 'grid', label: string, Icon: any) => (
    <button type="button" onClick={() => { setTab(k); if (k === 'table') { setEditId(undefined); router.refresh() } }}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${tab === k ? 'bg-white shadow-sm text-[#0f2240] font-medium' : 'text-slate-500 hover:text-slate-800'}`}>
      <Icon size={15} /> {label}
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
        {T('table', 'Бърза таблица', Table2)}
        {T('grid', 'По разписание', CalendarRange)}
      </div>
      {tab === 'table' ? (
        <QuickTable rows={rows} marked={marked} schoolDates={schoolDates} ends={ends} defaultEnd={defaultEnd}
          onEdit={id => { setEditId(id); setTab('grid') }} onChanged={() => router.refresh()} />
      ) : (
        <LecturerClient key={gridKey} academicYearId={academicYearId} teachers={teachers} marked={marked}
          schoolDates={schoolDates} initialTeacherId={editId} />
      )}
    </div>
  )
}
