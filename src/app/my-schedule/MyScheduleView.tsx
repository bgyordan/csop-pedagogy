'use client'
import { useState } from 'react'
import { CalendarDays, Clock, FileText, Loader2 } from 'lucide-react'
import { generateStaffSchedule } from '@/lib/docx-generator'
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
// Същата номерация като в редактора: 1–7 сутрин, 8–12 следобедни ИФО
const PERIOD_TIMES: Record<number, string> = {
  1: '8:30–9:05', 2: '9:15–9:50', 3: '10:20–10:55', 4: '11:05–11:40',
  5: '11:50–12:25', 6: '12:35–13:05', 7: '13:15–13:50',
  8: '12:45–13:15', 9: '13:20–13:50', 10: '13:55–14:25', 11: '14:30–15:00', 12: '15:05–15:35',
}
const PERIOD_LABEL: Record<number, string> = {
  1:'1',2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'ИФО 1',9:'ИФО 2',10:'ИФО 3',11:'ИФО 4',12:'ИФО 5',
}
const NORM = 21
const r1 = (x: number) => Math.round(x * 10) / 10
const fmt = (x: number) => r1(x).toLocaleString('bg-BG', { maximumFractionDigits: 1 })
// „Час на класа“ винаги = 1, дори да е маркиран с вземане
const w = (s: { allowsPullout: boolean; subjectName: string }) =>
  (s.allowsPullout && !s.subjectName.toLowerCase().includes('час на класа') ? 0.7 : 1)
export function MyScheduleView({ term, classSlots, ifoSlots, hasClasses, staffId, staffName, yearName }: Props) {
  const staffQ = staffId ? `&staff=${staffId}` : ''
  const [activeDay, setActiveDay] = useState<number | 'all'>('all')
  const [generating, setGenerating] = useState(false)
  const all = [...classSlots, ...ifoSlots]
  const totalClass = classSlots.length
  const totalIfo = ifoSlots.length
  const weighted = r1(all.reduce((a, s) => a + w(s), 0))
  const pulloutCount = all.filter(s => w(s) < 1).length
  const normOk = weighted >= NORM
  const maxP = all.reduce((m, s) => Math.max(m, s.period), 0)
  const PERIODS = [1, 2, 3, 4, 5, 6, ...(all.some(s => s.period === 7) ? [7] : []), ...(maxP >= 8 ? [8, 9, 10, 11, 12] : [])]
  const at = (day: number, period: number) => all.filter(s => s.day === day && s.period === period)

  async function handleWord() {
    if (all.length === 0) return
    setGenerating(true)
    try {
      const subtitle = `${term === 1 ? 'I' : 'II'} срок · ${yearName || ''}`
      await generateStaffSchedule(staffName || 'Служител', subtitle, classSlots, ifoSlots)
    } finally {
      setGenerating(false)
    }
  }

  function Cell({ s }: { s: Slot }) {
    const isIfo = s.source === 'ifo'
    return (
      <div className={`rounded-lg border px-2 py-1.5 ${isIfo ? 'bg-violet-50/60 border-violet-100' : 'bg-white border-slate-200'}`}>
        <div className={`text-[10px] font-medium truncate ${isIfo ? 'text-violet-600' : 'text-blue-600'}`}>
          {isIfo ? `ИФО ${s.label}` : s.label}
        </div>
        <div className="flex items-center gap-1">
          <div className="text-xs text-slate-700 truncate">{s.subjectName}</div>
          {w(s) < 1 && <span className="shrink-0 text-[9px] px-1 rounded bg-teal-50 text-teal-700 border border-teal-100">0,7</span>}
        </div>
      </div>
    )
  }

  const daysShown = activeDay === 'all' ? DAYS : DAYS.filter(d => d.n === activeDay)

  return (
    <div className="space-y-4">
      {/* Срок + брой + Word */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          <a href={`?term=1${staffQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 1 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 1 ? { backgroundColor: '#0f2240' } : {}}>I срок</a>
          <a href={`?term=2${staffQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 2 ? { backgroundColor: '#0f2240' } : {}}>II срок</a>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {all.length > 0 && (
            <span title={`${totalClass} в паралелка · ${totalIfo} ИФО${pulloutCount ? ` · ${pulloutCount} × 0,7` : ''}`}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${normOk ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
              <Clock size={12} /> {fmt(weighted)} / {NORM} ч.
            </span>
          )}
          {all.length > 0 && (
            <button type="button" onClick={handleWord} disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#0f2240' }}>
              {generating ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
              Word
            </button>
          )}
        </div>
      </div>

      {all.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <CalendarDays size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Още няма часове за този срок</p>
          <p className="text-xs text-slate-400 mt-1">Въвеждат се от „Редактирай разписание“.</p>
        </div>
      ) : (
        <>
          {/* Пилюли за дните */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/80">
            <button type="button" onClick={() => setActiveDay('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${activeDay === 'all' ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'}`}
              style={activeDay === 'all' ? { backgroundColor: '#0f2240' } : {}}>
              Цялата седмица
            </button>
            {DAYS.map(d => {
              const active = activeDay === d.n
              return (
                <button key={d.n} type="button" onClick={() => setActiveDay(d.n)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${active ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'}`}
                  style={active ? { backgroundColor: '#0f2240' } : {}}>
                  {d.short}
                </button>
              )
            })}
          </div>

          {/* Решетка: редове = часове, колони = дни; празните часове остават празни */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="w-14 px-2 py-2.5 text-[11px] font-semibold text-slate-400 uppercase">Час</th>
                  {daysShown.map(d => (
                    <th key={d.n} className={`px-2 py-2.5 text-xs font-semibold text-slate-600 ${activeDay === 'all' ? 'min-w-[130px]' : ''}`}>{d.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map(period => (
                  <tr key={period} className={`border-b border-slate-100 last:border-0 ${period === 8 ? 'border-t-2 border-t-slate-200' : ''}`}>
                    <td className="px-2 py-1.5 text-center align-top">
                      <div className="font-semibold text-slate-700 text-xs pt-1">{PERIOD_LABEL[period]}{period <= 7 ? '.' : ''}</div>
                      <div className="text-[9px] text-slate-400 leading-tight">{PERIOD_TIMES[period]}</div>
                    </td>
                    {daysShown.map(d => {
                      const here = at(d.n, period)
                      return (
                        <td key={d.n} className="px-1.5 py-1.5 align-top">
                          {here.length === 0
                            ? <div className="min-h-[40px] rounded-lg border border-dashed border-slate-100" />
                            : <div className="space-y-1">{here.map((s, i) => <Cell key={i} s={s} />)}</div>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
