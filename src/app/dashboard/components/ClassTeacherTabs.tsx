'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, HeartPulse, CalendarClock, Home, GraduationCap, FolderOpen, FileText } from 'lucide-react'
import StudentWorkDocs from '@/app/students/[id]/StudentWorkDocs'
import { classDocCounts } from './class-drive-actions'
interface ParalelkaRow {
  id: string
  name: string
  className: string
  educationForm: string
  coud: string
  guardian: string
  sendingSchool: string
  externalClass: string
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
  const [tab, setTab] = useState<'paralelka' | 'docs' | 'mine' | 'eplr' | 'therapy'>('paralelka')
  // брой документи на всяко дете (от папките в Drive) — зарежда се след като таблото се покаже
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    if (!paralelkaRows.length) return
    classDocCounts(classId, paralelkaRows.map(r => r.id)).then(setCounts).catch(() => setCounts({}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])
  const DAY_NAMES: Record<number, string> = { 1: 'Понеделник', 2: 'Вторник', 3: 'Сряда', 4: 'Четвъртък', 5: 'Петък' }
  const therapyByDay = therapyRows.reduce((acc: Record<number, TherapyRow[]>, r) => {
    (acc[r.day] = acc[r.day] || []).push(r); return acc
  }, {})
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      {/* Табове */}
      <div className="flex flex-wrap items-center gap-1 p-1.5 border-b border-slate-100 bg-slate-50/50">
        <button onClick={() => setTab('paralelka')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'paralelka' ? 'bg-white shadow-sm text-blue-700 border border-blue-100' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <Users size={15} />
          Деца
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${tab === 'paralelka' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
            {paralelkaRows.length}
          </span>
        </button>
        <button onClick={() => setTab('docs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'docs' ? 'bg-white shadow-sm text-sky-700 border border-sky-100' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <FolderOpen size={15} />
          Документи на паралелката
        </button>
        <button onClick={() => setTab('mine')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'mine' ? 'bg-white shadow-sm text-sky-700 border border-sky-100' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <FileText size={15} />
          Моите документи
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
      </div>
      {/* ТАБ 1: Децата като карти — кликът отваря досието направо в „Документи“ */}
      {tab === 'paralelka' && (
        paralelkaRows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Няма ученици в паралелката.</div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {paralelkaRows.map(r => {
              const n = counts?.[r.id]
              return (
                <Link key={r.id} href={`/students/${r.id}`}
                  className="group flex flex-col gap-2 p-4 rounded-xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-sky-200 transition">
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
                  {(r.sendingSchool || r.externalClass) && (
                    <div className="text-xs text-slate-500 font-light truncate" title={r.sendingSchool}>
                      {r.sendingSchool}{r.externalClass ? ` · ${r.externalClass} клас` : ''}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-auto text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      {r.educationForm === 'ifo' ? <><Home size={11} className="text-slate-400" /> ИФО</> : <><GraduationCap size={11} className="text-slate-400" /> Дневна</>}
                    </span>
                    {r.coud && <span>ЦОУД: {r.coud}</span>}
                    {r.guardian && <span className="text-slate-400 truncate">род. {r.guardian}</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        )
      )}
      {/* ТАБ: Общите файлове на паралелката (само класният и админ) */}
      {tab === 'docs' && (
        <div className="p-4">
          <StudentWorkDocs classId={classId} />
        </div>
      )}
      {/* ТАБ: Моите документи — личната папка в Drive */}
      {tab === 'mine' && (
        <div className="p-4">
          <StudentWorkDocs staff />
        </div>
      )}
      {/* ТАБ 2: ЕПЛР екипи */}
      {tab === 'eplr' && (
        <div className="divide-y divide-slate-50">
          {eplrRows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Няма ЕПЛР екипи.</div>
          ) : (
            <>
              {eplrRows.map((r, idx) => (
                <div key={r.id} className={`px-5 py-3 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-blue-50/40`}>
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
      {/* ТАБ 3: Терапии */}
      {tab === 'therapy' && (
        <div>
          {therapyRows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Още няма насрочени терапии.<br />
              <span className="text-xs text-slate-300">Появяват се, щом специалистите направят графиците си.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {[1, 2, 3, 4, 5].map(day => {
                const items = therapyByDay[day] || []
                if (items.length === 0) return null
                return (
                  <div key={day} className="px-5 py-3">
                    <div className="text-[11px] font-bold text-violet-600 uppercase tracking-wider mb-2">{DAY_NAMES[day]}</div>
                    <div className="space-y-1.5">
                      {items.map((r, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="text-xs font-mono font-semibold text-slate-400 w-12 flex-shrink-0">{r.time}</span>
                          <Link href={`/students/${r.studentId}`} className="font-medium text-slate-800 hover:text-violet-700 hover:underline min-w-0 truncate">
                            {r.studentName}
                          </Link>
                          <span className="text-[11px] text-slate-400 flex-shrink-0">
                            {r.role}{r.specialist ? ` · ${r.specialist}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
