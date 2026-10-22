'use client'
import { useState, useTransition, useMemo } from 'react'
import { smartMatch } from '@/lib/search'
import { Save, Loader2, Info, Download, Copy, X, Search, Pencil, Check, AlertTriangle, Ban, Undo2 } from 'lucide-react'
import { saveTherapistSchedule, copyTherapistFromTerm1 } from './actions'
import { generateTherapistSchedule } from '@/lib/docx-generator'
import { createClient } from '@/lib/supabase/client'
import { confirmDialog } from '@/components/ui/Toast'
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
  5: '11:50–12:25', 6: '12:35–13:05', 7: '13:15–13:50', 8: '13:50–14:25',
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
  // Преглед или редакция: по подразбиране се показва подреденият график; цветните полета — само при „Редактирай“.
  // Празен график се отваря направо за редакция (няма какво да се гледа).
  const [editing, setEditing] = useState(existingSlots.length === 0)
  const [saved, setSaved] = useState<Record<string, string[]>>(grid)   // последно запазеното — за „Откажи“
  const dirty = JSON.stringify(grid) !== JSON.stringify(saved)
  async function cancelEdit() {
    if (dirty && !await confirmDialog('Да се откажат ли промените? Графикът остава както е запазен.')) return
    setGrid(saved); setActiveId(''); setMsg(null); setEditing(false); setHistory([])
  }
  // Всяка промяна се помни (до 20 стъпки) → „Отмени“ връща предишното състояние
  const [history, setHistory] = useState<{ grid: Record<string, string[]>; text: string }[]>([])
  const slotLabel = (day: number, period: number) =>
    `${DAYS.find(d => d.n === day)?.label || ''}, ${PERIOD_LABEL[period] || `${period}. час`}`
  const nameOf = (id: string) => students.find(x => x.id === id)?.name || 'Дете'
  function applyChange(next: Record<string, string[]>, text: string) {
    setHistory(h => [...h.slice(-19), { grid, text }])
    setGrid(next)
  }
  function undo() {
    const last = history[history.length - 1]
    if (!last) return
    setGrid(last.grid)
    setHistory(h => h.slice(0, -1))
  }
  function addToCell(day: number, period: number, studentId: string) {
    if (!studentId) return
    const key = `${day}-${period}`
    const arr = grid[key] || []
    if (arr.includes(studentId)) return
    if (arr.length >= 3) { setMsg({ type: 'err', text: 'Максимум 3 деца в един час.' }); return }
    applyChange({ ...grid, [key]: [...arr, studentId] }, `Добавено: ${nameOf(studentId)} — ${slotLabel(day, period)}`)
  }
  function removeFromCell(day: number, period: number, studentId: string) {
    const key = `${day}-${period}`
    const arr = (grid[key] || []).filter(id => id !== studentId)
    const next = { ...grid }
    if (arr.length > 0) next[key] = arr; else delete next[key]
    applyChange(next, `Махнато: ${nameOf(studentId)} — ${slotLabel(day, period)}`)
  }
  // Промените спрямо последното запазване (за маркировката и проверката преди запис)
  function changes() {
    const added: string[] = [], removed: string[] = []
    const keys = new Set([...Object.keys(grid), ...Object.keys(saved)])
    keys.forEach(key => {
      const [day, period] = key.split('-').map(Number)
      const now = grid[key] || [], before = saved[key] || []
      now.filter(id => !before.includes(id)).forEach(id => added.push(`${nameOf(id)} — ${slotLabel(day, period)}`))
      before.filter(id => !now.includes(id)).forEach(id => removed.push(`${nameOf(id)} — ${slotLabel(day, period)}`))
    })
    return { added, removed }
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
  // Баланс на седмицата за активното дете — САМО ПРЕПОРЪКА, нищо не се спира:
  // идеално е по една терапия на ден (при всички специалисти) и не в ден с ФВС.
  // Препоръчва се денят с най-малко терапии; при равен брой — денят без ФВС.
  // (Ако терапиите са повече от дните без ФВС, препоръката сама минава и към дни с ФВС.)
  const dayBalance = useMemo(() => {
    if (!activeId) return null
    const isFvs = (name: string) => /фвс|физическ|спорт/i.test(name)
    const sched = studentSchedule[activeId] || {}
    const info = DAYS.map(d => {
      let count = 0
      const others = new Set<string>()
      Object.entries(takenByOthers).forEach(([k, who]) => {
        if (k.startsWith(`${activeId}-${d.n}-`)) { count++; others.add(who) }
      })
      Object.entries(grid).forEach(([k, arr]) => { if (k.startsWith(`${d.n}-`) && arr.includes(activeId)) count++ })
      const fvs = Object.entries(sched).some(([k, c]) => k.startsWith(`${d.n}-`) && isFvs(c.name))
      return { day: d.n, count, others: Array.from(others), fvs }
    })
    const score = (x: { count: number; fvs: boolean }) => x.count * 2 + (x.fvs ? 1 : 0)
    const best = Math.min(...info.map(score))
    const byDay: Record<number, (typeof info)[number] & { recommended: boolean }> = {}
    info.forEach(x => { byDay[x.day] = { ...x, recommended: score(x) === best } })
    return byDay
  }, [activeId, grid, takenByOthers, studentSchedule])
  const recommendedLabel = dayBalance
    ? DAYS.filter(d => dayBalance[d.n].recommended).map(d => d.label).join(', ')
    : ''
  // брой заети часове за всяко дете (за етикета в лентата)
  const countByStudent = useMemo(() => {
    const c: Record<string, number> = {}
    Object.values(grid).forEach(arr => arr.forEach(id => { c[id] = (c[id] || 0) + 1 }))
    return c
  }, [grid])
  const shownStudents = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return students
    return students.filter(s => smartMatch(s.name, q) || smartMatch(s.className, q))
  }, [students, filter])
  const activeStudent = students.find(s => s.id === activeId)
  function handleCopyTerm1() {
    startTransition(async () => {
      const res = await copyTherapistFromTerm1(academicYearId, targetStaffId)
      if (res.error) { setMsg({ type: 'err', text: res.error }); return }
      if (res.slots) {
        const g: Record<string, string[]> = {}
        res.slots.forEach((s: any) => { if (s.student_id) { const k = `${s.day}-${s.period}`; (g[k] = g[k] || []).push(s.student_id) } })
        setGrid(g); setHistory([])
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
    const { data: cy } = await createClient().from('academic_years').select('name').eq('is_current', true).single()
    const subtitle = `${term === 1 ? 'I' : 'II'} срок · ${cy?.name || ''}`
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
    const ch = changes()
    if (ch.added.length || ch.removed.length) {
      const lines = [
        ch.added.length ? `Добавени (${ch.added.length}):\n  ${ch.added.join('\n  ')}` : '',
        ch.removed.length ? `Махнати (${ch.removed.length}):\n  ${ch.removed.join('\n  ')}` : '',
      ].filter(Boolean).join('\n\n')
      if (!await confirmDialog(`${lines}\n\nДа се запази ли графикът?`)) return
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
    setSaved(grid); setActiveId(''); setEditing(false); setHistory([])
    setMsg({ type: 'ok', text: 'Графикът е запазен.' })
  }
  // ── ПРЕГЛЕД: подреден график, без цветни полета и бутони за махане ──
  if (!editing) {
    const viewPeriods = (Object.keys(grid).some(k => Number(k.split('-')[1]) >= 7) ? [1, 2, 0, 3, 4, 5, 6, 7, 8] : [1, 2, 0, 3, 4, 5, 6])
    const todayDow = new Date().getDay()
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
            <a href={`?term=1${staffQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 1 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              style={term === 1 ? { backgroundColor: ACCENT } : {}}>I срок</a>
            <a href={`?term=2${staffQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              style={term === 2 ? { backgroundColor: ACCENT } : {}}>II срок</a>
          </div>
          <span className="text-xs text-slate-500">Заети часове: <span className="font-semibold text-slate-700">{filledCount}</span></span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleDownload} disabled={filledCount === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <Download size={13} /> Изтегли Word
            </button>
            <button onClick={() => { setMsg(null); setEditing(true) }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-90" style={{ backgroundColor: ACCENT }}>
              <Pencil size={13} /> Редактирай
            </button>
          </div>
        </div>
        {msg && msg.type === 'ok' && (
          <div className="px-4 py-2.5 rounded-xl text-sm bg-emerald-50 border border-emerald-200 text-emerald-800">{msg.text}</div>
        )}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-24">Час</th>
                {DAYS.map(d => (
                  <th key={d.n} className={`text-left px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider ${d.n === todayDow ? 'text-teal-700' : 'text-slate-500'}`}>
                    <span className="hidden sm:inline">{d.label}</span><span className="sm:hidden">{d.short}</span>
                    {d.n === todayDow && <span className="ml-1 normal-case tracking-normal font-normal text-teal-600">· днес</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {viewPeriods.map((period, i) => (
                <tr key={period} className={`border-b border-slate-100 last:border-0 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                  <td className="px-3 py-2 align-top">
                    <div className="text-slate-700 text-sm">{PERIOD_LABEL[period] || `${period}.`}</div>
                    <div className="text-[10px] text-slate-400">{PERIOD_TIMES[period]}</div>
                  </td>
                  {DAYS.map(d => {
                    const arr = grid[`${d.n}-${period}`] || []
                    return (
                      <td key={d.n} className={`px-1.5 py-1.5 align-top min-w-[130px] ${d.n === todayDow ? 'bg-teal-50/40' : ''}`}>
                        <div className="space-y-1">
                          {arr.map(sid => {
                            const st = students.find(x => x.id === sid)
                            return (
                              <div key={sid} className="px-2 py-1 rounded-lg bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,34,64,0.05)]">
                                <div className="text-[12px] text-slate-800 truncate">{st?.name || '—'}</div>
                                {st && (st.form === 'ifo' || st.className) && <div className="text-[10px] text-slate-400">{st.form === 'ifo' ? 'ИФО' : `паралелка ${st.className}`}</div>}
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
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
              ? <span className="text-[11px] text-slate-500">Активно: <span className="font-semibold" style={{ color: ACCENT }}>{studentLabel(activeStudent)}</span> — кликай в таблицата
                  {recommendedLabel && <span className="ml-2 text-emerald-700">· препоръчани дни: {recommendedLabel}</span>}</span>
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
        <span className="flex items-center gap-1"><Check size={13} className="text-emerald-600" /> свободен / терапевтичен</span>
        <span className="flex items-center gap-1"><AlertTriangle size={12} className="text-amber-500" /> учебен час (предупреждение)</span>
        <span className="flex items-center gap-1"><Ban size={12} className="text-rose-500" /> взето от друг</span>
        <span className="flex items-center gap-1"><span className="text-[10px] text-slate-400">3/3</span> пълно</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ново / <span className="line-through">зачеркнато</span> — още незапазено</span>
        {activeId && <span className="flex items-center gap-1 text-emerald-700"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> препоръчан ден (по-малко терапии, без ФВС)</span>}
      </div>
      {history.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl text-[12px] bg-white border border-slate-200 shadow-sm text-slate-600">
          <span className="truncate">{history[history.length - 1].text}</span>
          <button type="button" onClick={undo}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0">
            <Undo2 size={12} /> Отмени
          </button>
        </div>
      )}
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
              {DAYS.map(d => {
                const b = dayBalance?.[d.n]
                return (
                  <th key={d.n} className={`text-left px-2 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider align-top ${b?.recommended ? 'bg-emerald-50' : ''}`}>
                    <span className="hidden sm:inline">{d.label}</span>
                    <span className="sm:hidden">{d.short}</span>
                    {b && (
                      <div className="mt-1 flex flex-wrap items-center gap-1 normal-case tracking-normal font-normal"
                        title={b.others.length ? `Терапии при: ${b.others.join(', ')}` : ''}>
                        {b.recommended && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                        <span className={b.count > 0 ? 'text-amber-700' : 'text-slate-400'}>
                          {b.count === 0 ? 'без терапия' : b.count === 1 ? '1 терапия' : `${b.count} терапии`}
                        </span>
                        {b.fvs && <span className="px-1 rounded bg-sky-50 border border-sky-200 text-sky-700">ФВС</span>}
                      </div>
                    )}
                  </th>
                )
              })}
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
                  // Без цветни фонове: бяла клетка + малка отметка в ъгъла; цвят само под мишката
                  let paintCls = ''
                  let mark: React.ReactNode = null
                  if (activeId && !activeHere) {
                    if (ev?.level === 'err') { paintCls = 'border-slate-100 cursor-not-allowed'; mark = <Ban size={12} className="text-rose-500" /> }
                    else if (full) { paintCls = 'border-slate-100 cursor-not-allowed'; mark = <span className="text-[9px] text-slate-400">3/3</span> }
                    else if (ev?.level === 'ok') { paintCls = 'border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 cursor-pointer'; mark = <Check size={13} className="text-emerald-600" /> }
                    else { paintCls = 'border-slate-200 hover:bg-amber-50 hover:border-amber-300 cursor-pointer'; mark = <AlertTriangle size={12} className="text-amber-500" /> }
                  }
                  const removedHere = (saved[key] || []).filter(id => !arr.includes(id))
                  return (
                    <td key={d.n} className="px-1.5 py-1.5 align-top min-w-[130px]">
                      <div
                        onClick={() => paintable && toggleActiveInCell(d.n, period)}
                        title={[ev?.text, !activeHere && dayBalance?.[d.n]?.count ? 'В този ден детето вече има терапия' : '', !activeHere && dayBalance?.[d.n]?.fvs ? 'В този ден има ФВС' : ''].filter(Boolean).join(' · ')}
                        className={`group relative rounded-lg border min-h-[32px] p-1 space-y-1 transition ${mark ? 'pr-5' : ''} ${
                          activeHere ? 'border-transparent bg-emerald-50' : paintCls || 'border-transparent'}`}
                        style={activeHere ? { boxShadow: `0 0 0 2px ${ACCENT}` } : {}}>
                        {mark && <span className="absolute top-1 right-1 pointer-events-none">{mark}</span>}
                        {arr.map(sid => {
                          const st = students.find(x => x.id === sid)
                          const isActiveChip = sid === activeId
                          const isNew = !(saved[key] || []).includes(sid)
                          return (
                            <div key={sid}
                              className={`flex items-center gap-1 text-[11px] py-0.5 px-1.5 rounded-md ${
                                isActiveChip ? 'bg-white border border-emerald-300 font-semibold text-slate-700' : 'bg-slate-50 text-slate-500'}`}
                              onClick={e => e.stopPropagation()}>
                              {isNew && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Ново — още незапазено" />}
                              <span className="truncate flex-1">{st?.name || '—'}</span>
                              <button type="button" onClick={() => removeFromCell(d.n, period, sid)} className="text-slate-300 hover:text-rose-600 shrink-0"><X size={11} /></button>
                            </div>
                          )
                        })}
                        {removedHere.map(sid => (
                          <div key={`rm-${sid}`} title="Махнато — още незапазено" onClick={e => e.stopPropagation()}
                            className="text-[11px] py-0.5 px-1.5 rounded-md text-slate-400 line-through truncate">
                            {students.find(x => x.id === sid)?.name || '—'}
                          </div>
                        ))}
                        {paintable && (
                          <button type="button"
                            onClick={e => { e.stopPropagation(); toggleActiveInCell(d.n, period) }}
                            className={`hidden group-hover:block w-full text-left text-[10px] px-1 py-0.5 rounded truncate ${
                              ev?.level === 'ok' ? 'text-emerald-700 hover:bg-emerald-100' : 'text-amber-700 hover:bg-amber-100'}`}>
                            + {activeStudent?.name}
                          </button>
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
        {Object.keys(saved).length > 0 && (
          <button onClick={cancelEdit} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
            Откажи
          </button>
        )}
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
