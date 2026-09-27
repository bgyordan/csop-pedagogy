'use client'
import { useEffect, useState } from 'react'
import OutreachBadge from '@/components/OutreachBadge'
import Link from 'next/link'
import { HeartPulse, Users, FileText } from 'lucide-react'
import StudentWorkDocs from '@/app/students/[id]/StudentWorkDocs'
import { studentDocCounts } from './class-drive-actions'
interface TherapyRow {
  id: string
  name: string
  className: string
  outreach?: string
  intensity: string
  sendingSchool: string
  others: string[]
}
interface EplrRow {
  id: string
  name: string
  className: string
  outreach?: string
  classTeacher: string
  docsCompleted: number
  docsTotal: number
  isReal: boolean
}
export default function SpecialistTabs({ therapyRows, eplrRows }: { therapyRows: TherapyRow[]; eplrRows: EplrRow[] }) {
  const [tab, setTab] = useState<'therapy' | 'eplr' | 'mine'>('therapy')
  // брой документи на всяко дете (от Drive) — зарежда се след показването
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    if (!therapyRows.length) return
    studentDocCounts(therapyRows.map(r => r.id)).then(setCounts).catch(() => setCounts({}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      {/* Табове */}
      <div className="flex flex-wrap gap-1 p-1.5 border-b border-slate-100 bg-slate-50/50">
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
        <button onClick={() => setTab('mine')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'mine' ? 'bg-white shadow-sm text-sky-700 border border-sky-100' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <FileText size={15} />
          Моите документи
        </button>
      </div>
      {/* ТАБ 3: Моите документи — личната папка в Drive */}
      {tab === 'mine' && (
        <div className="p-4">
          <StudentWorkDocs staff />
        </div>
      )}
      {/* ТАБ 1: Децата за терапия като карти — кликът отваря досието в „Документи“ */}
      {tab === 'therapy' && (
        therapyRows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Още нямате зачислени деца за терапия.<br />
            <Link href="/my-activities" className="text-teal-600 hover:underline text-xs">Добави от „Моите дейности" →</Link>
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {therapyRows.map(r => {
              const n = counts?.[r.id]
              return (
                <Link key={r.id} href={`/students/${r.id}`}
                  className="group flex flex-col gap-2 p-4 rounded-xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-teal-200 transition">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800 group-hover:text-[#0f2240] leading-snug">{r.name}</span>
                    {counts === null ? (
                      <span className="shrink-0 w-10 h-5 rounded-full bg-slate-100 animate-pulse" />
                    ) : n ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[11px]" title="Документи в Drive">
                        <FileText size={11} /> {n}
                      </span>
                    ) : (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px]">няма док.</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-light truncate" title={r.sendingSchool}>
                    {r.outreach && <span className="mr-1"><OutreachBadge location={r.outreach} size="xs" /></span>}
                    {[r.className && `паралелка ${r.className}`, r.sendingSchool].filter(Boolean).join(' · ')}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-auto text-[11px] text-slate-500">
                    {r.intensity && (
                      <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                        {r.intensity}{/^\d+$/.test(r.intensity) ? ' ч./седм.' : ''}
                      </span>
                    )}
                    {r.others.length > 0 && <span className="text-slate-400 truncate" title={r.others.join(' · ')}>също: {r.others.join(' · ')}</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        )
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
                    {r.outreach && <OutreachBadge location={r.outreach} size="xs" />}
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
