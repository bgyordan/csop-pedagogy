'use client'
import { useState } from 'react'
import { BookOpen, GraduationCap, CalendarDays } from 'lucide-react'

interface Slot {
  source: 'class' | 'ifo'
  day: number
  period: number
  subjectName: string
  allowsPullout: boolean
  label: string
}
interface Props {
  term: number
  classSlots: Slot[]
  ifoSlots: Slot[]
  hasClasses: boolean
}

const DAYS = [
  { n: 1, label: 'Понеделник' },
  { n: 2, label: 'Вторник' },
  { n: 3, label: 'Сряда' },
  { n: 4, label: 'Четвъртък' },
  { n: 5, label: 'Петък' },
]
// Сутрешни (паралелка)
const CLASS_TIMES: Record<number, string> = {
  1: '8:30–9:05', 2: '9:15–9:50', 3: '10:20–10:55',
  4: '11:05–11:40', 5: '11:50–12:25', 6: '12:35–13:05', 7: '13:15–13:50',
}
// Следобедни (ИФО)
const IFO_TIMES: Record<number, string> = {
  1: '12:00–12:35', 2: '12:30–13:05', 3: '13:10–13:45', 4: '13:20–13:55',
  5: '13:40–14:15', 6: '13:50–14:25', 7: '14:30–15:05', 8: '15:10–15:45',
}
// За сортиране по начален час (минути от полунощ)
function startMinutes(source: 'class' | 'ifo', period: number): number {
  const t = source === 'class' ? CLASS_TIMES[period] : IFO_TIMES[period]
  if (!t) return 9999
  const [h, m] = t.split('–')[0].split(':').map(Number)
  return h * 60 + m
}

export function MyScheduleView({ term, classSlots, ifoSlots, hasClasses }: Props) {
  const all = [...classSlots, ...ifoSlots]

  const totalClass = classSlots.length
  const totalIfo = ifoSlots.length

  return (
    <div className="space-y-4">
      {/* Срок + легенда */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          <a href={`?term=1`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 1 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 1 ? { backgroundColor: '#0f2240' } : {}}>I срок</a>
          <a href={`?term=2`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 2 ? { backgroundColor: '#0f2240' } : {}}>II срок</a>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          {hasClasses && (
            <span className="inline-flex items-center gap-1.5">
              <BookOpen size={13} className="text-blue-500" /> Паралелка: <span className="font-semibold text-slate-700">{totalClass}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <GraduationCap size={13} className="text-teal-600" /> ИФО: <span className="font-semibold text-slate-700">{totalIfo}</span>
          </span>
        </div>
      </div>

      {all.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <CalendarDays size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Още няма часове за този срок</p>
          <p className="text-xs text-slate-400 mt-1">
            Часовете от паралелката се въвеждат в „Паралелки", ИФО часовете — в „Индивидуални часове (ИФО)".
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {DAYS.map(d => {
            const daySlots = all
              .filter(s => s.day === d.n)
              .sort((a, b) => startMinutes(a.source, a.period) - startMinutes(b.source, b.period))
            if (daySlots.length === 0) return null
            return (
              <div key={d.n} className="border-b border-slate-100 last:border-0">
                <div className="px-4 py-2 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{d.label}</div>
                {daySlots.map((s, i) => {
                  const time = s.source === 'class' ? CLASS_TIMES[s.period] : IFO_TIMES[s.period]
                  return (
                    <div key={`${s.source}-${s.day}-${s.period}-${i}`}
                      className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-blue-50/30 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-slate-400 w-24 flex-shrink-0">{time}</span>
                        <span className={`text-sm font-medium truncate ${s.allowsPullout ? 'text-teal-700' : 'text-slate-700'}`}>
                          {s.allowsPullout ? '◆ ' : ''}{s.subjectName}
                        </span>
                      </div>
                      {s.source === 'class' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs flex-shrink-0 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                          <BookOpen size={12} /> {s.label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs flex-shrink-0 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">
                          <GraduationCap size={12} /> ИФО · {s.label}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
