'use client'
import { useState } from 'react'
import Link from 'next/link'
import { HeartPulse, Users } from 'lucide-react'
interface TherapyRow {
  id: string
  name: string
  className: string
  intensity: string
  sendingSchool: string
  others: string[]
}
interface EplrRow {
  id: string
  name: string
  className: string
  classTeacher: string
  docsCompleted: number
  docsTotal: number
  isReal: boolean
}
export default function SpecialistTabs({ therapyRows, eplrRows }: { therapyRows: TherapyRow[]; eplrRows: EplrRow[] }) {
  const [tab, setTab] = useState<'therapy' | 'eplr'>('therapy')
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      {/* Табове */}
      <div className="flex gap-1 p-1.5 border-b border-slate-100 bg-slate-50/50">
        <button onClick={() => setTab('therapy')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'therapy' ? 'bg-white shadow-sm text-teal-700 border border-teal-100' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <HeartPulse size={15} />
          Деца за терапия
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${tab === 'therapy' ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-500'}`}>
            {therapyRows.length}
          </span>
        </button>
        <button onClick={() => setTab('eplr')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'eplr' ? 'bg-white shadow-sm text-blue-700 border border-blue-100' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <Users size={15} />
          ЕПЛР състав
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${tab === 'eplr' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
            {eplrRows.length}
          </span>
        </button>
      </div>
      {/* ТАБ 1: За терапия — интензитет · паралелка · училище */}
      {tab === 'therapy' && (
        <div className="divide-y divide-slate-50">
          {therapyRows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Още нямате зачислени деца за терапия.<br />
              <Link href="/my-activities" className="text-teal-600 hover:underline text-xs">Добави от „Моите дейности" →</Link>
            </div>
          ) : (
            therapyRows.map((r, idx) => (
              <div key={r.id} className={`px-4 py-2 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-blue-50/40`}>
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/students/${r.id}`} className="text-sm font-medium text-slate-800 hover:text-teal-700 hover:underline">
                    {r.name}
                  </Link>
                  {r.intensity && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0">
                      {r.intensity}{/^\d+$/.test(r.intensity) ? ' ч.' : ''}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                  {r.className && <span className="text-[11px] text-slate-500">Паралелка {r.className}</span>}
                  {r.sendingSchool && <span className="text-[11px] text-slate-400">· {r.sendingSchool}</span>}
                  {r.others.length > 0 && <span className="text-[11px] text-slate-400">· също: {r.others.join(' · ')}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {/* ТАБ 2: ЕПЛР състав — паралелка · класен */}
      {tab === 'eplr' && (
        <div className="divide-y divide-slate-50">
          {eplrRows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Няма деца в моя ЕПЛР състав.</div>
          ) : (
            <>
              {eplrRows.map((r, idx) => (
                <div key={r.id} className={`px-4 py-2 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-blue-50/40`}>
                  <Link href={`/students/${r.id}`}
                    className={`text-sm hover:underline ${r.isReal ? 'font-semibold text-slate-800' : 'font-normal text-slate-600'}`}>
                    {r.name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {r.className && <span className="text-[11px] text-slate-500">Паралелка {r.className}</span>}
                    {r.classTeacher && <span className="text-[11px] text-slate-400">· класен: {r.classTeacher}</span>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
