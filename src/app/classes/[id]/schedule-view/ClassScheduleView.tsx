'use client'
import { useState } from 'react'
import { BookOpen, CalendarDays, Clock, FileText, Loader2, User } from 'lucide-react'
import { generateClassSchedule } from '@/lib/docx-generator'

interface Slot { day: number; period: number; subjectName: string; allowsPullout: boolean; teacher: string }
interface Props { term: number; slots: Slot[]; className: string; yearName: string; maxPeriod: number; classId: string }

const DAYS = [
  { n: 1, label: 'Понеделник', short: 'Пон' }, { n: 2, label: 'Вторник', short: 'Вт' },
  { n: 3, label: 'Сряда', short: 'Ср' }, { n: 4, label: 'Четвъртък', short: 'Чет' }, { n: 5, label: 'Петък', short: 'Пет' },
]
const TIMES: Record<number, string> = {
  1: '8:30–9:05', 2: '9:15–9:50', 3: '10:20–10:55', 4: '11:05–11:40',
  5: '11:50–12:25', 6: '12:35–13:05', 7: '13:15–13:50',
}

export default function ClassScheduleView({ term, slots, className, yearName, maxPeriod, classId }: Props) {
  const [generating, setGenerating] = useState(false)
  const daySlots = (day: number) => slots.filter(s => s.day === day).sort((a, b) => a.period - b.period)

  async function handleWord() {
    if (slots.length === 0) return
    setGenerating(true)
    try {
      const map: Record<string, string> = {}
      slots.forEach(s => { map[`${s.day}-${s.period}`] = s.subjectName })
      await generateClassSchedule(`Паралелка ${className}`, `${term === 1 ? 'I' : 'II'} срок · ${yearName}`, yearName, map, maxPeriod)
    } finally { setGenerating(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          <a href={`?term=1`} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${term === 1 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`} style={term === 1 ? { backgroundColor: '#0f2240' } : {}}>I срок</a>
          <a href={`?term=2`} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`} style={term === 2 ? { backgroundColor: '#0f2240' } : {}}>II срок</a>
        </div>
        {slots.length > 0 && (
          <button onClick={handleWord} disabled={generating}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
            {generating ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Изтегли Word
          </button>
        )}
      </div>

      {slots.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <CalendarDays size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Още няма въведено разписание за този срок</p>
          <p className="text-xs text-slate-400 mt-1">Учителите въвеждат своите часове в „Въвеждане на разписание".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {DAYS.map(d => {
            const ds = daySlots(d.n)
            return (
              <div key={d.n} className="bg-slate-50/60 rounded-xl border border-slate-200 flex flex-col overflow-hidden">
                <div className="px-3 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">{d.short}</span>
                  <span className="text-[10px] font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">{ds.length}</span>
                </div>
                <div className="p-2 space-y-2 flex-1">
                  {ds.length === 0 ? (
                    <div className="h-20 flex flex-col items-center justify-center text-slate-300">
                      <Clock size={16} className="mb-1" /><span className="text-[10px]">Няма часове</span>
                    </div>
                  ) : ds.map((s, i) => (
                    <div key={i} className="rounded-xl border bg-white border-slate-200 p-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-mono text-slate-400">{TIMES[s.period] || `${s.period}.`}</span>
                        <span className="text-[9px] text-slate-400">{s.period}. час</span>
                      </div>
                      <div className={`text-xs font-medium leading-tight ${s.allowsPullout ? 'text-teal-700' : 'text-slate-800'}`}>
                        {s.allowsPullout ? '◆ ' : ''}{s.subjectName}
                      </div>
                      {s.teacher && <div className="text-[10px] text-slate-400 mt-0.5 inline-flex items-center gap-1"><User size={9} /> {s.teacher}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
