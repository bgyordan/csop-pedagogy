'use client'
import { useState, useTransition } from 'react'
import { Save, Loader2, AlertTriangle, Check, Lock, Info, Download, Copy } from 'lucide-react'
import { saveTherapistSchedule, copyTherapistFromTerm1 } from './actions'
import { generateTherapistSchedule } from '@/lib/docx-generator'
interface Student {
  id: string
  name: string
  className: string
  form: string
}
interface Props {
  academicYearId: string
  term: number
  specialistName?: string
  roleLabel?: string
  students: Student[]
  // За всяко дете: неговата решетка "ден-час" → {name, allowsPullout} | null (няма разписание)
  studentSchedule: Record<string, Record<string, { name: string; allowsPullout: boolean }> | null>
  // "studentId-day-period" → име на друг терапевт
  takenByOthers: Record<string, string>
  existingSlots: { day: number; period: number; student_id: string | null }[]
  targetStaffId?: string
}
const DAYS = [
  { n: 1, label: 'Понеделник', short: 'Пн' },
  { n: 2, label: 'Вторник', short: 'Вт' },
  { n: 3, label: 'Сряда', short: 'Ср' },
  { n: 4, label: 'Четвъртък', short: 'Чт' },
  { n: 5, label: 'Петък', short: 'Пт' },
]
const PERIOD_TIMES: Record<number, string> = {
  1: '8:30–9:05', 2: '9:15–9:50', 0: '9:50–10:20', 3: '10:20–10:55', 4: '11:05–11:40',
  5: '11:50–12:25', 6: '12:35–13:05', 7: '13:15–13:50', 8: '13:50–14:00',
}
const PERIOD_LABEL: Record<number, string> = { 0: 'ГМ' }
export function TherapistScheduleGrid({
  academicYearId, term, specialistName = '', roleLabel = '', students, studentSchedule, takenByOthers, existingSlots, targetStaffId,
}: Props) {
  const staffQ = targetStaffId ? `&staff=${targetStaffId}` : ''
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const has78 = existingSlots.some(s => s.period >= 7)
  const [showAfternoon, setShowAfternoon] = useState(has78)
  const [pending, startTransition] = useTransition()
  const periods = showAfternoon ? [1, 2, 0, 3, 4, 5, 6, 7, 8] : [1, 2, 0, 3, 4, 5, 6]
  const [grid, setGrid] = useState<Record<string, string>>(() => {
    const g: Record<string, string> = {}
    existingSlots.forEach(s => { if (s.student_id) g[`${s.day}-${s.period}`] = s.student_id })
    return g
  })
  function setCell(day: number, period: number, studentId: string) {
    setGrid(prev => {
      const next = { ...prev }
      if (studentId) next[`${day}-${period}`] = studentId
      else delete next[`${day}-${period}`]
      return next
    })
  }
  // Оценка на състоянието на избор: дете в слот
  function evaluate(studentId: string, day: number, period: number) {
    const key = `${day}-${period}`
    // 1. Взето ли е от друг терапевт?
    const other = takenByOthers[`${studentId}-${day}-${period}`]
    if (other) return { level: 'err', text: `Взето от ${other}` }
    // 2. Дали детето е в друг мой слот по същото време? (двойно броене в моя график)
    // (пропускаме — един слот е един избор)
    // 3. Разписанието на детето
    const sched = studentSchedule[studentId]
    if (sched === null || sched === undefined) {
      return { level: 'warn', text: 'Няма разписание на паралелката' }
    }
    const cell = sched[key]
    if (!cell) return { level: 'ok', text: 'Свободен час' }
    if (cell.allowsPullout) return { level: 'ok', text: cell.name }
    return { level: 'warn', text: `Учебен час: ${cell.name}` }
  }
  const filledCount = Object.keys(grid).length
  function handleCopyTerm1() {
    startTransition(async () => {
      const res = await copyTherapistFromTerm1(academicYearId, targetStaffId)
      if (res.error) { setMsg({ type: 'err', text: res.error }); return }
      if (res.slots) {
        const g: Record<string, string> = {}
        res.slots.forEach((s: any) => { if (s.student_id) g[`${s.day}-${s.period}`] = s.student_id })
        setGrid(g)
        if (res.slots.some((s: any) => s.period >= 7)) setShowAfternoon(true)
        setMsg({ type: 'ok', text: 'Копирано от I срок. Не забравяй да запазиш.' })
      }
    })
  }
  async function handleDownload() {
    const slotData: Record<string, { student: string; className: string }> = {}
    Object.entries(grid).forEach(([key, studentId]) => {
      const st = students.find(s => s.id === studentId)
      if (st) slotData[key] = { student: st.name, className: st.className }
    })
    const subtitle = `${term === 1 ? 'I' : 'II'} срок`
    const maxPeriod = showAfternoon ? 8 : 6
    await generateTherapistSchedule(specialistName, roleLabel, subtitle, slotData, maxPeriod)
  }
  async function handleSave() {
    setSaving(true); setMsg(null)
    const slots = Object.entries(grid).map(([key, studentId]) => {
      const [day, period] = key.split('-').map(Number)
      return { day, period, studentId }
    })
    const res = await saveTherapistSchedule(academicYearId, term, slots, targetStaffId)
    setSaving(false)
    if (res.error) { setMsg({ type: 'err', text: res.error }); return }
    setMsg({ type: 'ok', text: 'Графикът е запазен.' })
  }
  const cellBg: Record<string, string> = {
    ok: 'bg-emerald-50 border-emerald-200',
    warn: 'bg-amber-50 border-amber-200',
    err: 'bg-red-50 border-red-200',
  }
  return (
    <div className="space-y-4">
      {students.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          Още нямате зачислени деца. Първо ги добавете от „Моите дейности".
        </div>
      )}
      {/* Срок + тотал */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
         <a href={`?term=1${staffQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 1 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 1 ? { backgroundColor: '#0f2240' } : {}}>I срок</a>
          <a href={`?term=2${staffQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 2 ? { backgroundColor: '#0f2240' } : {}}>II срок</a>
        </div>
        {term === 2 && (
          <button onClick={handleCopyTerm1} disabled={pending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
            Копирай от I срок
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">
          Заети часове: <span className="font-semibold text-slate-700">{filledCount}</span>
        </span>
      </div>
      {/* Легенда */}
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span> терапевтичен / свободен</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></span> учебен час (предупреждение)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300"></span> взето от друг</span>
      </div>
      {msg && (
        <div className={`px-4 py-2.5 rounded-xl text-sm ${
          msg.type === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {msg.text}
        </div>
      )}
      {/* Решетка */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24">Час</th>
              {DAYS.map(d => (
                <th key={d.n} className="text-left px-2 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <span className="hidden sm:inline">{d.label}</span>
                  <span className="sm:hidden">{d.short}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map(period => (
              <tr key={period} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-1.5 align-top">
                  <div className="font-bold text-slate-700 text-sm">{PERIOD_LABEL[period] || `${period}.`}</div>
                  <div className="text-[10px] text-slate-400">{PERIOD_TIMES[period]}</div>
                </td>
                {DAYS.map(d => {
                  const val = grid[`${d.n}-${period}`] || ''
                  const evalResult = val ? evaluate(val, d.n, period) : null
                  return (
                    <td key={d.n} className="px-1.5 py-1.5 align-top">
                      <select
                        value={val}
                        onChange={e => setCell(d.n, period, e.target.value)}
                        className={`w-full text-xs py-1.5 px-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                          evalResult ? cellBg[evalResult.level] : 'border-slate-200 text-slate-700'
                        }`}>
                        <option value="">—</option>
                        {students.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name}{s.className ? ` (${s.className})` : ''}
                          </option>
                        ))}
                      </select>
                      {evalResult && (
                        <div className={`mt-1 text-[9px] leading-tight flex items-center gap-0.5 ${
                          evalResult.level === 'ok' ? 'text-emerald-600'
                            : evalResult.level === 'warn' ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {evalResult.level === 'ok' ? <Check size={9} />
                            : evalResult.level === 'err' ? <Lock size={9} />
                            : <AlertTriangle size={9} />}
                          {evalResult.text}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Бутони */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setShowAfternoon(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
          {showAfternoon ? 'Скрий следобедните (7–8)' : 'Покажи следобедни часове (7–8)'}
        </button>
        <button onClick={handleDownload} disabled={filledCount === 0}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <Download size={13} /> Изтегли Word
        </button>
        <button onClick={handleSave} disabled={saving || students.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
          style={{ backgroundColor: '#0f2240' }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Запазване...' : 'Запази графика'}
        </button>
      </div>
      <p className="text-[11px] text-slate-400 flex items-center gap-1">
        <Info size={11} />
        Предупрежденията са ориентировъчни — можеш да запазиш въпреки тях.
      </p>
    </div>
  )
}
