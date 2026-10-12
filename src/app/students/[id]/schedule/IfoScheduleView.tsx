'use client'
import { useState } from 'react'
import { Calendar, FileText, Loader2, Printer, User } from 'lucide-react'
import { PERIOD_TIMES, PERIOD_LABEL, byStartTime } from '@/lib/periods'
import { generateClassSchedule } from '@/lib/docx-generator'
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
  studentName: string
  yearName: string
}
const DAYS = [
  { n: 1, label: 'Понеделник' },
  { n: 2, label: 'Вторник' },
  { n: 3, label: 'Сряда' },
  { n: 4, label: 'Четвъртък' },
  { n: 5, label: 'Петък' },
]
// „1.“ за сутрешен час, „ИФО 1“ за следобеден
const rowLabel = (p: number) => (p <= 7 ? `${p}.` : PERIOD_LABEL[p] || String(p))

export function IfoScheduleView({ term, slots, fromSchedules, studentName, yearName }: Props) {
  const [generating, setGenerating] = useState(false)
  const fromQ = fromSchedules ? '&from=schedules' : ''
  const termLabel = term === 1 ? 'I срок' : 'II срок'
  // само часовете, в които детето има поне един час, подредени по начален час
  const periods = Array.from(new Set(slots.map(s => s.period))).sort(byStartTime)

  async function handleWord() {
    if (slots.length === 0) return
    setGenerating(true)
    try {
      const map: Record<string, string> = {}
      const teachers: Record<string, string> = {}
      slots.forEach(s => {
        const k = `${s.day}-${s.period}`
        map[k] = map[k] ? `${map[k]} / ${s.subjectName}` : s.subjectName
        if (s.teacherName) teachers[k] = teachers[k] ? `${teachers[k]} / ${s.teacherName}` : s.teacherName
      })
      const customPeriods = periods.map(p => ({
        period: p,
        time: (PERIOD_TIMES[p] || '').replace('–', ' – '),
        label: p <= 7 ? String(p) : PERIOD_LABEL[p],
      }))
      await generateClassSchedule(studentName, `ИФО · ${termLabel} · ${yearName}`, yearName, map, 13, teachers, customPeriods)
    } finally { setGenerating(false) }
  }

  return (
    <div className="space-y-4">
      {/* Срок + действия */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
            <a href={`?term=1${fromQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${term === 1 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              style={term === 1 ? { backgroundColor: '#0f2240' } : {}}>I срок</a>
            <a href={`?term=2${fromQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              style={term === 2 ? { backgroundColor: '#0f2240' } : {}}>II срок</a>
          </div>
          <span className="text-xs text-slate-500">
            Часове: <span className="font-medium text-slate-700">{slots.length}</span>
          </span>
        </div>
        {slots.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-slate-300 text-slate-700 bg-white hover:border-[#0f2240]">
              <Printer size={15} /> Печат
            </button>
            <button onClick={handleWord} disabled={generating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
              {generating ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Изтегли Word
            </button>
          </div>
        )}
      </div>
      {/* при печат — срокът се вижда под заглавието */}
      <p className="hidden print:block text-sm text-slate-600">{termLabel}</p>

      {slots.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <Calendar size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Още няма въведени индивидуални часове</p>
          <p className="text-xs text-slate-400 mt-1">Часовете се въвеждат от учителите в „Разписание → Моите часове → Редактирай“ (ИФО ученик).</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse table-fixed min-w-[720px] print:min-w-0">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="w-24 px-2 py-2.5 text-[10px] font-medium uppercase tracking-wider text-slate-400 text-left">Час</th>
                {DAYS.map(d => (
                  <th key={d.n} className="px-2 py-2.5 text-xs font-medium text-slate-600 text-left">
                    {d.label} <span className="text-[10px] font-normal text-slate-400">· {slots.filter(s => s.day === d.n).length} ч.</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p, ri) => (
                <tr key={p} className={`border-b border-slate-100 last:border-0 ${ri % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                  <td className="px-2 py-2 align-top">
                    <div className="text-sm font-medium text-slate-700">{rowLabel(p)}</div>
                    <div className="text-[10px] font-mono text-slate-400">{PERIOD_TIMES[p] || ''}</div>
                  </td>
                  {DAYS.map(d => {
                    const cell = slots.filter(s => s.day === d.n && s.period === p)
                    return (
                      <td key={d.n} className="px-1.5 py-1.5 align-top">
                        {cell.length === 0 ? (
                          <div className="min-h-[44px] flex items-center justify-center text-slate-200 text-xs">—</div>
                        ) : cell.map((s, i) => (
                          <div key={i} className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                            <div title={s.subjectName} className={`text-xs leading-snug line-clamp-2 break-words ${s.allowsPullout ? 'text-teal-700' : 'text-slate-800'}`}>
                              {s.allowsPullout ? '◆ ' : ''}{s.subjectName}
                            </div>
                            {s.teacherName && (
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate inline-flex items-center gap-1 max-w-full" title={s.teacherName}>
                                <User size={9} className="shrink-0" /> {s.teacherName}
                              </div>
                            )}
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
