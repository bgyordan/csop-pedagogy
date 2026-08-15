'use client'
import { useState } from 'react'
import { BookOpen, GraduationCap, CalendarDays, Clock } from 'lucide-react'
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
}
const DAYS = [
  { n: 1, label: 'Понеделник', short: 'Пон' },
  { n: 2, label: 'Вторник', short: 'Вт' },
  { n: 3, label: 'Сряда', short: 'Ср' },
  { n: 4, label: 'Четвъртък', short: 'Чет' },
  { n: 5, label: 'Петък', short: 'Пет' },
]
const CLASS_TIMES: Record<number, string> = {
  1: '8:30–9:05', 2: '9:15–9:50', 3: '10:20–10:55',
  4: '11:05–11:40', 5: '11:50–12:25', 6: '12:35–13:05', 7: '13:15–13:50',
}
const IFO_TIMES: Record<number, string> = {
  1: '12:00–12:35', 2: '12:30–13:05', 3: '13:10–13:45', 4: '13:20–13:55',
  5: '13:40–14:15', 6: '13:50–14:25', 7: '14:30–15:05', 8: '15:10–15:45',
}
function startMinutes(source: 'class' | 'ifo', period: number): number {
  const t = source === 'class' ? CLASS_TIMES[period] : IFO_TIMES[period]
  if (!t) return 9999
  const [h, m] = t.split('–')[0].split(':').map(Number)
  return h * 60 + m
}
export function MyScheduleView({ term, classSlots, ifoSlots, hasClasses, staffId }: Props) {
  const staffQ = staffId ? `&staff=${staffId}` : ''
  const [activeDay, setActiveDay] = useState<number | 'all'>('all')
  const all = [...classSlots, ...ifoSlots]
  const totalClass = classSlots.length
  const totalIfo = ifoSlots.length
  function daySlots(day: number) {
    return all
      .filter(s => s.day === day)
      .sort((a, b) => startMinutes(a.source, a.period) - startMinutes(b.source, b.period))
  }
  function SlotCard({ s }: { s: Slot }) {
    const time = s.source === 'class' ? CLASS_TIMES[s.period] : IFO_TIMES[s.period]
    const isIfo = s.source === 'ifo'
    return (
      <div className={`rounded-xl border p-2.5 ${isIfo ? 'bg-teal-50/50 border-teal-100' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-mono text-slate-400">{time}</span>
          {isIfo ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">
              <GraduationCap size={10} /> ИФО
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              <BookOpen size={10} /> {s.label}
            </span>
          )}
        </div>
        <div className={`text-xs font-medium leading-tight ${s.allowsPullout ? 'text-teal-700' : 'text-slate-800'}`}>
          {s.allowsPullout ? '◆ ' : ''}{s.subjectName}
        </div>
        {isIfo && s.label && (
          <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
        )}
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {/* Срок + легенда */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          <a href={`?term=1${staffQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 1 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 1 ? { backgroundColor: '#0f2240' } : {}}>I срок</a>
          <a href={`?term=2${staffQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 2 ? { backgroundColor: '#0f2240' } : {}}>II срок</a>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          {hasClasses && (
            <span className="inline-flex items-center gap-1.5">
              <BookOpen size={13} className="text-slate-500" /> Паралелка: <span className="font-semibold text-slate-700">{totalClass}</span>
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
        <>
          {/* Пилюли за дните */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/80">
            <button type="button" onClick={() => setActiveDay('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeDay === 'all' ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
              style={activeDay === 'all' ? { backgroundColor: '#0f2240' } : {}}>
              Цялата седмица ({all.length})
            </button>
            {DAYS.map(d => {
              const cnt = daySlots(d.n).length
              const active = activeDay === d.n
              return (
                <button key={d.n} type="button" onClick={() => setActiveDay(d.n)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    active ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                  style={active ? { backgroundColor: '#0f2240' } : {}}>
                  <span>{d.short}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-white/20 text-white' : cnt > 0 ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-400'
                  }`}>{cnt}</span>
                </button>
              )
            })}
          </div>
          {/* Цялата седмица — 5 колони */}
          {activeDay === 'all' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {DAYS.map(d => {
                const slots = daySlots(d.n)
                return (
                  <div key={d.n} className="bg-slate-50/60 rounded-xl border border-slate-200 flex flex-col overflow-hidden">
                    <div className="px-3 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">{d.short}</span>
                      <span className="text-[10px] font-semibold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">{slots.length}</span>
                    </div>
                    <div className="p-2 space-y-2 flex-1">
                      {slots.length === 0 ? (
                        <div className="h-20 flex flex-col items-center justify-center text-slate-300">
                          <Clock size={16} className="mb-1" />
                          <span className="text-[10px]">Няма часове</span>
                        </div>
                      ) : (
                        slots.map((s, i) => <SlotCard key={`${s.source}-${s.day}-${s.period}-${i}`} s={s} />)
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Един ден — детайлно */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-sm font-semibold text-slate-700">
                {DAYS.find(d => d.n === activeDay)?.label}
              </div>
              {daySlots(activeDay as number).length === 0 ? (
                <div className="py-12 text-center text-slate-300">
                  <Clock size={28} className="mx-auto mb-2" />
                  <p className="text-sm">Няма часове за този ден</p>
                </div>
              ) : (
                <div>
                  {daySlots(activeDay as number).map((s, i) => {
                    const time = s.source === 'class' ? CLASS_TIMES[s.period] : IFO_TIMES[s.period]
                    return (
                      <div key={`${s.source}-${s.day}-${s.period}-${i}`}
                        className={`flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-50 last:border-0 ${i % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-slate-400 w-24 flex-shrink-0">{time}</span>
                          <span className={`text-sm font-medium ${s.allowsPullout ? 'text-teal-700' : 'text-slate-800'}`}>
                            {s.allowsPullout ? '◆ ' : ''}{s.subjectName}
                          </span>
                        </div>
                        {s.source === 'class' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs flex-shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
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
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
