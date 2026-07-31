'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users, HeartPulse, ChevronRight, CalendarClock } from 'lucide-react'

interface ParalelkaRow {
  id: string
  name: string
  className: string
  therapists: string[]
}
interface EplrMember {
  role: string
  name: string
  isReal: boolean
}
interface EplrRow {
  id: string
  name: string
  className: string
  members: EplrMember[]
}
interface TherapyRow {
  studentId: string
  studentName: string
  day: number
  period: number
  time: string
  specialist: string
  role: string
}

export default function ClassTeacherTabs({
  paralelkaRows, eplrRows, therapyRows = [], className, classId,
}: {
  paralelkaRows: ParalelkaRow[]
  eplrRows: EplrRow[]
  therapyRows?: TherapyRow[]
  className: string
  classId: string
}) {
  const [tab, setTab] = useState<'paralelka' | 'eplr' | 'therapy'>('paralelka')
  const DAY_NAMES: Record<number, string> = { 1: 'Понеделник', 2: 'Вторник', 3: 'Сряда', 4: 'Четвъртък', 5: 'Петък' }
  const therapyByDay = therapyRows.reduce((acc: Record<number, TherapyRow[]>, r) => {
    (acc[r.day] = acc[r.day] || []).push(r); return acc
  }, {})

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      {/* Табове */}
      <div className="flex items-center gap-1 p-1.5 border-b border-slate-100 bg-slate-50/50">
        <button onClick={() => setTab('paralelka')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'paralelka' ? 'bg-white shadow-sm text-blue-700 border border-blue-100' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <Users size={15} />
          Моята паралелка
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${tab === 'paralelka' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
            {paralelkaRows.length}
          </span>
        </button>
        <button onClick={() => setTab('eplr')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'eplr' ? 'bg-white shadow-sm text-teal-700 border border-teal-100' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <HeartPulse size={15} />
          ЕПЛР екипи
        </button>
        <button onClick={() => setTab('therapy')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'therapy' ? 'bg-white shadow-sm text-violet-700 border border-violet-100' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <CalendarClock size={15} />
          Терапии
          {therapyRows.length > 0 && (
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${tab === 'therapy' ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-500'}`}>
              {therapyRows.length}
            </span>
          )}
        </button>

        <Link href={`/classes/${classId}`}
          className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline px-3">
          Преглед на паралелката <ChevronRight size={13} />
        </Link>
      </div>

      {/* ТАБ 1: Моята паралелка — деца с техните терапевти */}
      {tab === 'paralelka' && (
        <div className="divide-y divide-slate-50">
          {paralelkaRows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Няма ученици в паралелката.</div>
          ) : (
            paralelkaRows.map(r => (
              <div key={r.id} className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                <div className="min-w-0">
                  <Link href={`/students/${r.id}`} className="text-sm font-semibold text-slate-800 hover:text-blue-700 hover:underline">
                    {r.name}
                  </Link>
                  {r.therapists.length > 0 ? (
                    <div className="text-[11px] text-slate-400 mt-0.5">{r.therapists.join(' · ')}</div>
                  ) : (
                    <div className="text-[11px] text-slate-300 mt-0.5 italic">още няма зачислени терапевти</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ТАБ 2: ЕПЛР екипи — реалните удебелени */}
      {tab === 'eplr' && (
        <div className="divide-y divide-slate-50">
          {eplrRows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Няма ЕПЛР екипи.</div>
          ) : (
            <>
              <div className="px-5 py-2 bg-slate-50/50 text-[11px] text-slate-400">
                <strong className="text-slate-600">Удебелените</strong> реално работят с детето. Останалите са формален състав.
              </div>
              {eplrRows.map(r => (
                <div key={r.id} className="px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <Link href={`/students/${r.id}`} className="text-sm font-semibold text-slate-800 hover:text-teal-700 hover:underline">
                    {r.name}
                  </Link>
                  {r.members.length > 0 ? (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {r.members.map((m, i) => (
                        <span key={i} className={`text-[11px] ${m.isReal ? 'font-bold text-slate-700' : 'font-normal text-slate-400'}`}>
                          {m.role}: {m.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-300 mt-0.5 italic">още няма назначен екип</div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
