'use client'
import { GraduationCap, Calendar } from 'lucide-react'
import { PERIOD_TIMES, PERIOD_LABEL, byStartTime } from '@/lib/periods'
interface ViewSlot {
  day: number
  period: number
  subjectName: string
  allowsPullout: boolean
  teacherName: string
}
interface Props {
  fromSchedules?: boolean
  term: number
  slots: ViewSlot[]
}
const DAYS = [
  { n: 1, label: 'Понеделник' },
  { n: 2, label: 'Вторник' },
  { n: 3, label: 'Сряда' },
  { n: 4, label: 'Четвъртък' },
  { n: 5, label: 'Петък' },
]
export function IfoScheduleView({ term, slots, fromSchedules }: Props) {
  const fromQ = fromSchedules ? '&from=schedules' : ''
  return (
    <div className="space-y-4">
      {/* Срок */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          <a href={`?term=1${fromQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 1 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 1 ? { backgroundColor: '#0f2240' } : {}}>I срок</a>
          <a href={`?term=2${fromQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 2 ? { backgroundColor: '#0f2240' } : {}}>II срок</a>
        </div>
        <span className="text-xs text-slate-500">
          Часове: <span className="font-semibold text-slate-700">{slots.length}</span>
        </span>
      </div>
      {slots.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <Calendar size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Още няма въведени индивидуални часове</p>
          <p className="text-xs text-slate-400 mt-1">Часовете се въвеждат от учителите в „Моето разписание“ (ИФО ученик).</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {DAYS.map(d => {
            const daySlots = slots.filter(s => s.day === d.n).sort((a, b) => byStartTime(a.period, b.period))
            if (daySlots.length === 0) return null
            return (
              <div key={d.n} className="border-b border-slate-100 last:border-0">
                <div className="px-4 py-2 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{d.label}</div>
                {daySlots.map((s, i) => (
                  <div key={`${s.day}-${s.period}-${i}`}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-blue-50/30 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-slate-400 w-32 flex-shrink-0">{PERIOD_TIMES[s.period]} <span className="text-[10px] text-slate-300">· {PERIOD_LABEL[s.period]}</span></span>
                      <span className={`text-sm font-medium truncate ${s.allowsPullout ? 'text-teal-700' : 'text-slate-700'}`}>
                        {s.allowsPullout ? '◆ ' : ''}{s.subjectName}
                      </span>
                    </div>
                    {s.teacherName && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                        <GraduationCap size={13} className="text-slate-400" />
                        {s.teacherName}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
