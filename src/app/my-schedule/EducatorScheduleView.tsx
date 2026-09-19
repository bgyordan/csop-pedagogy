'use client'
import { CalendarDays } from 'lucide-react'

interface Slot { day: number; period: number; activity: string }
interface Props {
  term: number
  slots: Slot[]
  staffId?: string
  staffName?: string
  yearName?: string
}
const DAYS = [
  { n: 1, label: 'Понеделник', short: 'Пон' },
  { n: 2, label: 'Вторник', short: 'Вт' },
  { n: 3, label: 'Сряда', short: 'Ср' },
  { n: 4, label: 'Четвъртък', short: 'Чет' },
  { n: 5, label: 'Петък', short: 'Пет' },
]
const COUD_TIMES: Record<number, string> = {
  1: '12:25–13:00', 2: '13:20–13:55', 3: '14:15–14:50',
  4: '15:05–15:40', 5: '15:55–16:30', 6: '16:45–17:20',
}
const PERIODS = [1, 2, 3, 4, 5, 6]
const ACCENT = '#0f2240'
// Тон по дейност (меко, за четимост)
function activityStyle(a: string): string {
  if (a.startsWith('Самоподготовка')) return 'bg-indigo-50 border-indigo-100 text-indigo-800'
  if (a.startsWith('Занимания')) return 'bg-amber-50 border-amber-100 text-amber-800'
  if (a.startsWith('Организиран')) return 'bg-emerald-50 border-emerald-100 text-emerald-800'
  return 'bg-slate-50 border-slate-200 text-slate-700'
}
function shortActivity(a: string): string {
  if (a.startsWith('Самоподготовка')) return 'Самоподготовка'
  if (a.startsWith('Занимания')) return 'Занимания по интереси'
  if (a.startsWith('Организиран')) return 'Организиран отдих и физ. активност'
  return a
}

export default function EducatorScheduleView({ term, slots, staffId, staffName, yearName }: Props) {
  const staffQ = staffId ? `&staff=${staffId}` : ''
  const byKey: Record<string, string> = {}
  slots.forEach(s => { byKey[`${s.day}-${s.period}`] = s.activity })
  const empty = slots.length === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          <a href={`?term=1${staffQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 1 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 1 ? { backgroundColor: ACCENT } : {}}>I срок</a>
          <a href={`?term=2${staffQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 2 ? { backgroundColor: ACCENT } : {}}>II срок</a>
        </div>
        <span className="ml-auto text-xs text-slate-400">Целодневна организация · {slots.length} часа/седмица</span>
      </div>

      {empty ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          Още няма въведено ЦОУД разписание. Свържете се с администрацията да го наложи.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28">Час</th>
                {DAYS.map(d => (
                  <th key={d.n} className="text-left px-2 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <span className="hidden sm:inline">{d.label}</span>
                    <span className="sm:hidden">{d.short}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(period => (
                <tr key={period} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 align-top">
                    <div className="font-bold text-slate-700 text-sm">{period}.</div>
                    <div className="text-[10px] text-slate-400">{COUD_TIMES[period]}</div>
                  </td>
                  {DAYS.map(d => {
                    const act = byKey[`${d.n}-${period}`]
                    return (
                      <td key={d.n} className="px-1.5 py-2 align-top min-w-[130px]">
                        {act ? (
                          <div className={`rounded-lg border px-2 py-1.5 text-[11px] leading-tight ${activityStyle(act)}`}>
                            {shortActivity(act)}
                          </div>
                        ) : (
                          <div className="text-slate-300 text-xs px-2">—</div>
                        )}
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
