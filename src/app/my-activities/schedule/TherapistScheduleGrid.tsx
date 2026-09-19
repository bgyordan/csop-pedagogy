'use client'
import { useState, useTransition, useMemo } from 'react'
import { Save, Loader2, Info, Download, Copy, X, Search } from 'lucide-react'
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
const ACCENT = '#0f2240'
function studentLabel(s?: Student) {
  if (!s) return '—'
  return `${s.name}${s.form === 'ifo' ? ' (ИФО)' : s.className ? ` (${s.className})` : ''}`
}
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
  // Активно дете (носителят) — цялата таблица се оцветява за него
  const [activeId, setActiveId] = useState<string>('')
  const [filter, setFilter] = useState('')
  const [grid, setGrid] = useState<Record<string, string[]>>(() => {
    const g: Record<string, string[]> = {}
    existingSlots.forEach(s => { if (s.student_id) { const k = `${s.day}-${s.period}`; (g[k] = g[k] || []).push(s.student_id) } })
    return g
  })
  function addToCell(day: number, period: number, studentId: string) {
    if (!studentId) return
    setGrid(prev => {
      const key = `${day}-${period}`
      const arr = prev[key] || []
      if (arr.includes(studentId)) return prev
      if (arr.length >= 3) { setMsg({ type: 'err', text: 'Максимум 3 деца в един час.' }); return prev }
      return { ...prev, [key]: [...arr, studentId] }
    })
  }
  function removeFromCell(day: number, period: number, studentId: string) {
    setGrid(prev => {
      const key = `${day}-${period}`
      const arr = (prev[key] || []).filter(id => id !== studentId)
      const next = { ...prev }
      if (arr.length > 0) next[key] = arr; else delete next[key]
      return next
    })
  }
  // Клик върху клетка → добавя/маха активното дете
  function toggleActiveInCell(day: number, period: number) {
    if (!activeId) return
    const key = `${day}-${period}`
    const arr = grid[key] || []
    if (arr.includes(activeId)) { removeFromCell(day, period, activeId); return }
    if (takenByOthers[`${activeId}-${day}-${period}`]) return // взето от друг → не пипаме
    if (arr.length >= 3) { setMsg({ type: 'err', text: 'Максимум 3 деца в един час.' }); return }
    addToCell(day, period, activeId)
  }
  // Оценка на състоянието на активното дете в даден слот (за оцветяване)
  function evaluate(studentId: string, day: number, period: number) {
    const key = `${day}-${period}`
    const other = takenByOthers[`${studentId}-${day}-${period}`]
    if (other) return { level: 'err' as const, text: `Взето от ${other}` }
    const sched = studentSchedule[studentId]
    if (sched === null || sched === undefined) return { level: 'warn' as const, text: 'Няма разписание на паралелката' }
    const cell = sched[key]
    if (!cell) return { level: 'ok' as const, text: 'Свободен час' }
    if (cell.allowsPullout) return { level: 'ok' as const, text: cell.name }
    return { level: 'warn' as const, text: `Учебен час: ${cell.name}` }
  }
  const filledCount = Object.values(grid).reduce((a, arr) => a + arr.length, 0)
  // брой заети часове за всяко дете (за етикета в лентата)
  const countByStudent = useMemo(() => {
    const c: Record<string, number> = {}
    Object.values(grid).forEach(arr => arr.forEach(id => { c[id] = (c[id] || 0) + 1 }))
    return c
  }, [grid])
  const shownStudents = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return students
    return students.filter(s => s.name.toLowerCase().includes(q) || s.className.toLowerCase().includes(q))
  }, [students, filter])
  const activeStudent = students.find(s => s.id === activeId)
  function handleCopyTerm1() {
    startTransition(async () => {
      const res = await copyTherapistFromTerm1(academicYearId, targetStaffId)
      if (res.error) { setMsg({ type: 'err', text: res.error }); return }
      if (res.slots) {
        const g: Record<string, string[]> = {}
        res.slots.forEach((s: any) => { if (s.student_id) { const k = `${s.day}-${s.period}`; (g[k] = g[k] || []).push(s.student_id) } })
        setGrid(g)
        if (res.slots.some((s: any) => s.period >= 7)) setShowAfternoon(true)
        setMsg({ type: 'ok', text: 'Копирано от I срок. Не забравяй да запазиш.' })
      }
    })
  }
  async function handleDownload() {
    const slotData: Record<string, { student: string; className: string }> = {}
    Object.entries(grid).forEach(([key, arr]) => {
      const names = arr.map(id => students.find(s => s.id === id)?.name).filter(Boolean).join(', ')
      if (names) slotData[key] = { student: names, className: '' }
    })
    const subtitle = `${term === 1 ? 'I' : 'II'} срок`
    const maxPeriod = showAfternoon ? 8 : 6
    await generateTherapistSchedule(specialistName, roleLabel, subtitle, slotData, maxPeriod)
  }
  async function handleSave() {
    const conflicts: string[] = []
    Object.entries(grid).forEach(([key, arr]) => {
      const [day, period] = key.split('-')
      arr.forEach(studentId => {
        const other = takenByOthers[`${studentId}-${day}-${period}`]
        if (other) {
          const st = students.find(s => s.id === studentId)
          conflicts.push(`${st?.name || 'Дете'} — вече при ${other}`)
        }
      })
    })
    if (conflicts.length > 0) {
      setMsg({ type: 'err', text: `Не може да се запази — тези деца са при друг специалист по същото време: ${conflicts.join('; ')}. Премахни ги първо.` })
      return
    }
    setSaving(true); setMsg(null)
    const slots: { day: number; period: number; studentId: string }[] = []
    Object.entries(grid).forEach(([key, arr]) => {
      const [day, period] = key.split('-').map(Number)
      arr.forEach(studentId => slots.push({ day, period, studentId }))
    })
    const res = await saveTherapistSchedule(academicYearId, term, slots, targetStaffId)
    setSaving(false)
    if (res.error) { setMsg({ type: 'err', text: res.error }); return }
    setMsg({ type: 'ok', text: 'Графикът е запазен.' })
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
            style={term === 1 ? { backgroundColor: ACCENT } : {}}>I срок</a>
          <a href={`?term=2${staffQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 2 ? { backgroundColor: ACCENT } : {}}>II срок</a>
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

      {/* Лента с децата — избери активно дете */}
      {students.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Търси дете…"
                className="w-full text-xs pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-300" />
            </div>
            {activeStudent
              ? <span className="text-[11px] text-slate-500">Активно: <span className="font-semibold" style={{ color: ACCENT }}>{studentLabel(activeStudent)}</span> — кликай в таблицата</span>
              : <span className="text-[11px] text-slate-400">Избери дете, за да оцветиш свободните часове</span>}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {shownStudents.map(s => {
              const isActive = s.id === activeId
              const cnt = countByStudent[s.id] || 0
              const done = cnt > 0
              return (
                <button key={s.id} type="button" onClick={() => setActiveId(isActive ? '' : s.id)}
                  className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition ${
                    isActive ? 'text-white border-transparent shadow-sm'
                      : done ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  style={isActive ? { backgroundColor: ACCENT } : {}}>
                  <span className="truncate max-w-[160px]">{studentLabel(s)}</span>
                  {cnt > 0 && (
                    <span className={`text-[9px] leading-none px-1 py-0.5 rounded-full ${isActive ? 'bg-white/25' : 'bg-emerald-100 text-emerald-700'}`}>{cnt}</span>
                  )}
                </button>
              )
            })}
            {shownStudents.length === 0 && <span className="text-[11px] text-slate-400 py-1">Няма съвпадение.</span>}
          </div>
        </div>
      )}

      {/* Легенда */}
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span> свободен / терапевтичен</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></span> учебен час (предупреждение)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300"></span> взето от друг</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-300"></span> пълно (3 деца)</span>
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
                  const key = `${d.n}-${period}`
                  const arr = grid[key] || []
                  const full = arr.length >= 3
                  const activeHere = !!activeId && arr.includes(activeId)
                  const ev = activeId ? evaluate(activeId, d.n, period) : null
                  const paintable = !!activeId && !activeHere && !full && ev?.level !== 'err'
                  let paintCls = ''
                  if (activeId && !activeHere) {
                    if (ev?.level === 'err') paintCls = 'bg-red-50 border-red-200 cursor-not-allowed'
                    else if (full) paintCls = 'bg-slate-100 border-slate-200 cursor-not-allowed'
                    else if (ev?.level === 'ok') paintCls = 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 cursor-pointer'
                    else paintCls = 'bg-amber-50 border-amber-300 hover:bg-amber-100 cursor-pointer'
                  }
                  return (
                    <td key={d.n} className="px-1.5 py-1.5 align-top min-w-[130px]">
                      <div
                        onClick={() => paintable && toggleActiveInCell(d.n, period)}
                        title={ev?.text || ''}
                        className={`rounded-lg border min-h-[32px] p-1 space-y-1 transition ${
                          activeHere ? 'border-transparent bg-emerald-50' : paintCls || 'border-transparent'}`}
                        style={activeHere ? { boxShadow: `0 0 0 2px ${ACCENT}` } : {}}>
                        {arr.map(sid => {
                          const st = students.find(x => x.id === sid)
                          const isActiveChip = sid === activeId
                          return (
                            <div key={sid}
                              className={`flex items-center gap-1 text-[11px] py-0.5 px-1.5 rounded-md ${
                                isActiveChip ? 'bg-white border border-emerald-300 font-semibold text-slate-700' : 'bg-slate-50 text-slate-500'}`}
                              onClick={e => e.stopPropagation()}>
                              <span className="truncate flex-1">{st?.name || '—'}</span>
                              <button type="button" onClick={() => removeFromCell(d.n, period, sid)} className="text-slate-300 hover:text-rose-600 shrink-0"><X size={11} /></button>
                            </div>
                          )
                        })}
                        {paintable && (
                          <button type="button"
                            onClick={e => { e.stopPropagation(); toggleActiveInCell(d.n, period) }}
                            className={`w-full text-left text-[10px] px-1 py-0.5 rounded truncate ${
                              ev?.level === 'ok' ? 'text-emerald-700 hover:bg-emerald-100' : 'text-amber-700 hover:bg-amber-100'}`}>
                            + {activeStudent?.name}
                          </button>
                        )}
                        {activeId && !activeHere && full && (
                          <div className="text-[10px] text-slate-400 px-1">Пълно (3)</div>
                        )}
                      </div>
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
          style={{ backgroundColor: ACCENT }}>
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
