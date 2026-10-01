'use client'
import { useState } from 'react'
import { CalendarDays, FileText, Loader2, User } from 'lucide-react'
import { generateClassSchedule } from '@/lib/docx-generator'

interface Slot { day: number; period: number; subjectName: string; allowsPullout: boolean; teacher: string }
interface Props { term: number; slots: Slot[]; className: string; yearName: string; maxPeriod: number; classId: string; extraQuery?: string }

const DAYS = [
  { n: 1, label: 'Понеделник', short: 'Пон' }, { n: 2, label: 'Вторник', short: 'Вт' },
  { n: 3, label: 'Сряда', short: 'Ср' }, { n: 4, label: 'Четвъртък', short: 'Чет' }, { n: 5, label: 'Петък', short: 'Пет' },
]
const TIMES: Record<number, string> = {
  1: '8:30–9:05', 2: '9:15–9:50', 3: '10:20–10:55', 4: '11:05–11:40',
  5: '11:50–12:25', 6: '12:35–13:05', 7: '13:15–13:50',
}

export default function ClassScheduleView({ term, slots, className, yearName, maxPeriod, classId, extraQuery = '' }: Props) {
  const [generating, setGenerating] = useState(false)
  const daySlots = (day: number) => slots.filter(s => s.day === day).sort((a, b) => a.period - b.period)

  async function handleWord() {
    if (slots.length === 0) return
    setGenerating(true)
    try {
      const map: Record<string, string> = {}
      const teachers: Record<string, string> = {}
      slots.forEach(s => {
        // група: няколко учители в един час → „Математика / БЕЛ“
        const k = `${s.day}-${s.period}`
        map[k] = map[k] ? `${map[k]} / ${s.subjectName}` : s.subjectName
        if (s.teacher) teachers[k] = teachers[k] ? `${teachers[k]} / ${s.teacher}` : s.teacher
      })
      await generateClassSchedule(`Паралелка ${className}`, `${term === 1 ? 'I' : 'II'} срок · ${yearName}`, yearName, map, maxPeriod, teachers)
    } finally { setGenerating(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          <a href={`?term=1${extraQuery}`} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${term === 1 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`} style={term === 1 ? { backgroundColor: '#0f2240' } : {}}>I срок</a>
          <a href={`?term=2${extraQuery}`} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`} style={term === 2 ? { backgroundColor: '#0f2240' } : {}}>II срок</a>
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
          <p className="text-xs text-slate-400 mt-1">Учителите въвеждат своите часове в „Разписание → Моите часове → Редактирай“.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full border-collapse table-fixed min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="w-20 px-2 py-2.5 text-[10px] font-medium uppercase tracking-wider text-slate-400 text-left">Час</th>
                {DAYS.map(d => (
                  <th key={d.n} className="px-2 py-2.5 text-xs font-medium text-slate-600 text-left">
                    {d.label} <span className="text-[10px] font-normal text-slate-400">· {daySlots(d.n).length} ч.</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxPeriod }, (_, k) => k + 1).map((p, ri) => (
                <tr key={p} className={`border-b border-slate-100 last:border-0 ${ri % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                  <td className="px-2 py-2 align-top">
                    <div className="text-sm font-medium text-slate-700">{p}.</div>
                    <div className="text-[10px] font-mono text-slate-400">{TIMES[p] || ''}</div>
                  </td>
                  {DAYS.map(d => {
                    const cell = slots.filter(s => s.day === d.n && s.period === p)
                    return (
                      <td key={d.n} className="px-1.5 py-1.5 align-top">
                        {cell.length === 0 ? (
                          <div className="min-h-[44px] flex items-center justify-center text-slate-200 text-xs">—</div>
                        ) : cell.map((s, i) => (
                          <div key={i} className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 hover:border-slate-300 transition-colors">
                            <div title={s.subjectName} className={`text-xs leading-snug line-clamp-2 break-words ${s.allowsPullout ? 'text-teal-700' : 'text-slate-800'}`}>
                              {cell.length > 1 && <span className="mr-1 text-[9px] px-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 align-middle">гр.</span>}
                              {s.allowsPullout ? '◆ ' : ''}{s.subjectName}
                            </div>
                            {s.teacher && <div className="text-[10px] text-slate-400 mt-0.5 truncate inline-flex items-center gap-1 max-w-full" title={s.teacher}><User size={9} className="shrink-0" /> {s.teacher}</div>}
                          </div>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
