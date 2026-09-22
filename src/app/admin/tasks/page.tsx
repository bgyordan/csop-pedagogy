'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Check, ChevronLeft, ChevronRight, List, CalendarDays } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Confirm } from '@/components/ui/Confirm'
import {
  RecTask, RecFreq, expandOccurrences, taskStatus, recSummary, ymd,
  MONTHS_SHORT_BG, WD_SHORT_BG,
} from '@/lib/recurring'

const MONTHS_FULL = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември']
const WEEKDAYS_HDR = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

const COLORS: { key: string; label: string; chip: string; dot: string }[] = [
  { key: 'red', label: 'Червен', chip: 'bg-red-100 text-red-700', dot: '#dc2626' },
  { key: 'amber', label: 'Жълт', chip: 'bg-amber-100 text-amber-700', dot: '#d97706' },
  { key: 'green', label: 'Зелен', chip: 'bg-green-100 text-green-700', dot: '#16a34a' },
  { key: 'blue', label: 'Син', chip: 'bg-blue-100 text-blue-700', dot: '#2563a8' },
]
const colorOf = (k?: string | null) => COLORS.find(c => c.key === k) || COLORS[1]

const FREQS: { key: RecFreq; label: string }[] = [
  { key: 'once', label: 'Еднократно' },
  { key: 'weekly', label: 'Седмично' },
  { key: 'monthly', label: 'Месечно' },
  { key: 'yearly', label: 'Годишно' },
]

type Form = {
  title: string
  description: string
  freq: RecFreq
  weekdays: number[]
  day_of_month: number
  lastDay: boolean
  everyMonth: boolean
  months: number[]
  once_date: string
  lead_days: number
  color: string
  active: boolean
}

const emptyForm: Form = {
  title: '', description: '', freq: 'monthly',
  weekdays: [1], day_of_month: 8, lastDay: false,
  everyMonth: true, months: [], once_date: '',
  lead_days: 3, color: 'amber', active: true,
}

export default function TasksPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [role, setRole] = useState<string>('')
  const [tasks, setTasks] = useState<RecTask[]>([])
  const [done, setDone] = useState<Set<string>>(new Set()) // `${taskId}:${date}`
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Form>(emptyForm)

  const now = new Date()
  const [vy, setVy] = useState(now.getFullYear())
  const [vm, setVm] = useState(now.getMonth())

  const canManage = ['admin', 'zdud', 'secretary'].includes(role)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
      setRole(p?.role || '')
    }
    const { data: t } = await supabase.from('recurring_tasks').select('*').order('title')
    setTasks((t || []) as RecTask[])
    const { data: c } = await supabase.from('recurring_task_completions').select('task_id, occurrence_date')
    setDone(new Set((c || []).map((r: any) => `${r.task_id}:${r.occurrence_date}`)))
  }

  async function toggleDone(taskId: string, date: string) {
    if (!canManage) return
    const key = `${taskId}:${date}`
    const next = new Set(done)
    if (done.has(key)) {
      next.delete(key); setDone(next)
      await supabase.from('recurring_task_completions').delete().eq('task_id', taskId).eq('occurrence_date', date)
    } else {
      next.add(key); setDone(next)
      const { data: { user } } = await supabase.auth.getUser()
      const { data: p } = await supabase.from('staff_profiles').select('id').eq('user_id', user?.id!).single()
      await supabase.from('recurring_task_completions').insert({ task_id: taskId, occurrence_date: date, done_by: p?.id })
    }
  }

  async function toggleActive(t: RecTask) {
    if (!canManage) return
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, active: !x.active } : x))
    await supabase.from('recurring_tasks').update({ active: !t.active }).eq('id', t.id)
  }

  function openNew() { setEditId(null); setForm(emptyForm); setOpen(true) }
  function openEdit(t: RecTask) {
    setEditId(t.id)
    setForm({
      title: t.title, description: t.description || '',
      freq: t.freq,
      weekdays: t.weekdays?.length ? t.weekdays : [1],
      day_of_month: (t.day_of_month && t.day_of_month > 0) ? t.day_of_month : 8,
      lastDay: t.day_of_month === 0,
      everyMonth: t.freq === 'monthly' && !(t.months && t.months.length),
      months: t.months?.length ? t.months : (t.freq === 'yearly' ? [1] : []),
      once_date: t.once_date || '',
      lead_days: t.lead_days ?? 3,
      color: t.color || 'amber',
      active: t.active ?? true,
    })
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { toast('Въведи наименование', 'error'); return }
    if (form.freq === 'once' && !form.once_date) { toast('Избери дата', 'error'); return }
    if (form.freq === 'weekly' && !form.weekdays.length) { toast('Избери поне един ден', 'error'); return }
    if (form.freq === 'yearly' && !form.months.length) { toast('Избери месец', 'error'); return }
    setSaving(true)
    const row: any = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      freq: form.freq,
      weekdays: form.freq === 'weekly' ? form.weekdays.slice().sort((a, b) => a - b) : null,
      day_of_month: (form.freq === 'monthly' || form.freq === 'yearly') ? (form.lastDay ? 0 : form.day_of_month) : null,
      months: form.freq === 'monthly' ? (form.everyMonth ? [] : form.months) : (form.freq === 'yearly' ? form.months.slice(0, 1) : null),
      once_date: form.freq === 'once' ? form.once_date : null,
      lead_days: form.lead_days,
      color: form.color,
      active: form.active,
    }
    if (editId) {
      await supabase.from('recurring_tasks').update(row).eq('id', editId)
      toast('Задачата е обновена')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: p } = await supabase.from('staff_profiles').select('id').eq('user_id', user?.id!).single()
      await supabase.from('recurring_tasks').insert({ ...row, created_by: p?.id })
      toast('Задачата е добавена')
    }
    setSaving(false); setOpen(false); setEditId(null); setForm(emptyForm); load()
  }

  async function handleDelete() {
    if (!deleteId) return
    await supabase.from('recurring_tasks').delete().eq('id', deleteId)
    toast('Задачата е изтрита')
    setDeleteId(null); load()
  }

  // ---- Календарни поводи за видимия месец ----
  const monthCells = useMemo(() => {
    const first = new Date(vy, vm, 1)
    const last = new Date(vy, vm + 1, 0)
    const byDay: Record<number, { t: RecTask; date: string; done: boolean }[]> = {}
    tasks.filter(t => t.active).forEach(t => {
      expandOccurrences(t, first, last).forEach(date => {
        const day = parseInt(date.split('-')[2])
        if (!byDay[day]) byDay[day] = []
        byDay[day].push({ t, date, done: done.has(`${t.id}:${date}`) })
      })
    })
    let startW = first.getDay(); startW = startW === 0 ? 6 : startW - 1
    const daysIn = last.getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < startW; i++) cells.push(null)
    for (let d = 1; d <= daysIn; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return { cells, byDay }
  }, [tasks, done, vy, vm])

  const todayStr = ymd(now)

  function prevMonth() { if (vm === 0) { setVm(11); setVy(y => y - 1) } else setVm(m => m - 1) }
  function nextMonth() { if (vm === 11) { setVm(0); setVy(y => y + 1) } else setVm(m => m + 1) }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">График на срокове и задачи</h1>
          <p className="text-sm text-slate-400 mt-0.5">Повтарящи се задължения с напомняне — седмични, месечни, годишни.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button onClick={() => setView('list')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              <List size={14} /> Списък
            </button>
            <button onClick={() => setView('calendar')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'calendar' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              <CalendarDays size={14} /> Календар
            </button>
          </div>
          {canManage && (
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0f2240' }}>
              <Plus size={16} /> Нова задача
            </button>
          )}
        </div>
      </div>

      {view === 'list' ? (
        <div className="space-y-2.5">
          {tasks.map(t => {
            const st = taskStatus(t, done, now)
            const c = colorOf(t.color)
            // повод за отмятане: следящият, ако има; иначе последният отметнат в прозореца
            let tickDate = st.current
            let tickDone = false
            if (!tickDate) {
              const f = new Date(now); f.setDate(f.getDate() - 31)
              const to = new Date(now); to.setDate(to.getDate() + 400)
              const occ = expandOccurrences(t, f, to).filter(d => done.has(`${t.id}:${d}`))
              tickDate = occ.length ? occ[occ.length - 1] : null
              tickDone = true
            }
            return (
              <div key={t.id} className={`bg-white rounded-xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow px-5 py-4 ${!t.active ? 'opacity-55' : ''}`}>
                <div className="flex items-center gap-4">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate">{t.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {recSummary(t)}
                      {t.freq !== 'once' && <span className="text-slate-300"> · напомня {t.lead_days ?? 3} дни преди</span>}
                    </div>
                    {t.description && <div className="text-xs text-slate-400 mt-1 truncate">{t.description}</div>}
                  </div>

                  <div className="shrink-0 text-right">
                    {st.state === 'overdue' && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700">Просрочено {Math.abs(st.daysUntil!)} дни</span>}
                    {st.state === 'due-soon' && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">{st.daysUntil === 0 ? 'Днес' : `След ${st.daysUntil} дни`}</span>}
                    {st.state === 'upcoming' && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">След {st.daysUntil} дни</span>}
                    {st.state === 'none' && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">Изпълнено</span>}
                    {st.current && <div className="text-[11px] text-slate-400 mt-1">{fmtBadge(st.current)}</div>}
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      {tickDate && (
                        <button
                          onClick={() => toggleDone(t.id, tickDate!)}
                          title={tickDone ? 'Отмени' : 'Отметни като готово'}
                          className={`p-1.5 rounded-lg border transition-colors ${tickDone ? 'bg-green-500 border-green-500 text-white' : 'border-slate-200 text-slate-300 hover:text-green-600 hover:border-green-300'}`}
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button onClick={() => toggleActive(t)} title={t.active ? 'Изключи' : 'Включи'}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${t.active ? 'border-slate-200 text-slate-400 hover:bg-slate-50' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
                        {t.active ? 'Активно' : 'Изкл.'}
                      </button>
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Редактирай">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Изтрий">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {!tasks.length && <p className="text-sm text-slate-400 py-16 text-center bg-white rounded-xl border border-slate-200/70">Няма добавени задачи. {canManage && 'Натисни „Нова задача".'}</p>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-700">{MONTHS_FULL[vm]} {vy}</span>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={16} /></button>
              <button onClick={() => { setVy(now.getFullYear()); setVm(now.getMonth()) }} className="px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100">Днес</button>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS_HDR.map(w => <div key={w} className="text-center text-[11px] font-medium text-slate-400 py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.cells.map((d, i) => {
              const dateStr = d ? `${vy}-${String(vm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` : ''
              const isToday = dateStr === todayStr
              const items = d ? (monthCells.byDay[d] || []) : []
              return (
                <div key={i} className={`min-h-[92px] rounded-lg border p-1.5 ${d ? 'border-slate-100' : 'border-transparent'} ${isToday ? 'bg-blue-50/60 border-blue-200' : ''}`}>
                  {d && <div className={`text-[11px] mb-1 ${isToday ? 'font-semibold text-blue-700' : 'text-slate-400'}`}>{d}</div>}
                  <div className="space-y-1">
                    {items.map((it, k) => {
                      const c = colorOf(it.t.color)
                      return (
                        <button key={k} onClick={() => toggleDone(it.t.id, it.date)} disabled={!canManage}
                          title={it.t.title}
                          className={`w-full text-left text-[11px] leading-tight px-1.5 py-1 rounded flex items-center gap-1 ${c.chip} ${it.done ? 'opacity-45 line-through' : ''} ${canManage ? 'hover:brightness-95' : 'cursor-default'}`}>
                          {it.done && <Check size={10} className="shrink-0" />}
                          <span className="truncate">{it.t.title}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">Кликни повод в календара, за да го отметнеш „готово".</p>
        </div>
      )}

      {/* ----- Модал добавяне/редакция ----- */}
      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Редакция на задача' : 'Нова задача'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Наименование <span className="text-red-500">*</span></label>
            <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Напр. Отчет по ЗДОИ на сайта" />
          </div>
          <div>
            <label className="label">Кратко описание (по избор)</label>
            <input className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Напр. Качва се в раздел Прозрачност" />
          </div>

          <div>
            <label className="label">Повторение</label>
            <div className="flex gap-1.5 mt-1">
              {FREQS.map(f => (
                <button key={f.key} type="button" onClick={() => setForm(p => ({ ...p, freq: f.key, months: f.key === 'yearly' && !p.months.length ? [1] : p.months }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.freq === f.key ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                  style={form.freq === f.key ? { backgroundColor: '#0f2240' } : {}}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {form.freq === 'once' && (
            <div>
              <label className="label">Дата <span className="text-red-500">*</span></label>
              <input type="date" className="input" value={form.once_date} onChange={e => setForm(p => ({ ...p, once_date: e.target.value }))} />
            </div>
          )}

          {form.freq === 'weekly' && (
            <div>
              <label className="label">Дни от седмицата</label>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7].map(d => {
                  const on = form.weekdays.includes(d)
                  return (
                    <button key={d} type="button"
                      onClick={() => setForm(p => ({ ...p, weekdays: on ? p.weekdays.filter(x => x !== d) : [...p.weekdays, d] }))}
                      className={`w-11 py-1.5 rounded-lg text-xs font-medium border transition-all ${on ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                      style={on ? { backgroundColor: '#0f2240' } : {}}>
                      {WD_SHORT_BG[d]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {(form.freq === 'monthly' || form.freq === 'yearly') && (
            <>
              <div>
                <label className="label">Число от месеца</label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="number" min={1} max={31} disabled={form.lastDay}
                    className="input w-24 disabled:opacity-50" value={form.day_of_month}
                    onChange={e => setForm(p => ({ ...p, day_of_month: Math.max(1, Math.min(31, parseInt(e.target.value) || 1)) }))} />
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={form.lastDay} onChange={e => setForm(p => ({ ...p, lastDay: e.target.checked }))} />
                    Последен ден от месеца
                  </label>
                </div>
              </div>

              {form.freq === 'monthly' && (
                <div>
                  <label className="label">Месеци</label>
                  <div className="flex items-center gap-2 mt-1 mb-2">
                    <button type="button" onClick={() => setForm(p => ({ ...p, everyMonth: true, months: [] }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${form.everyMonth ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200'}`}
                      style={form.everyMonth ? { backgroundColor: '#0f2240' } : {}}>Всеки месец</button>
                    <button type="button" onClick={() => setForm(p => ({ ...p, everyMonth: false }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${!form.everyMonth ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200'}`}
                      style={!form.everyMonth ? { backgroundColor: '#0f2240' } : {}}>Определени месеци</button>
                  </div>
                  {!form.everyMonth && (
                    <div className="grid grid-cols-6 gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                        const on = form.months.includes(m)
                        return (
                          <button key={m} type="button"
                            onClick={() => setForm(p => ({ ...p, months: on ? p.months.filter(x => x !== m) : [...p.months, m] }))}
                            className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${on ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            style={on ? { backgroundColor: '#0f2240' } : {}}>
                            {MONTHS_SHORT_BG[m]}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {form.freq === 'yearly' && (
                <div>
                  <label className="label">Месец</label>
                  <div className="grid grid-cols-6 gap-1.5 mt-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                      const on = form.months[0] === m
                      return (
                        <button key={m} type="button" onClick={() => setForm(p => ({ ...p, months: [m] }))}
                          className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${on ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                          style={on ? { backgroundColor: '#0f2240' } : {}}>
                          {MONTHS_SHORT_BG[m]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {form.freq !== 'once' && (
            <div>
              <label className="label">Напомни колко дни преди</label>
              <input type="number" min={0} max={60} className="input w-24" value={form.lead_days}
                onChange={e => setForm(p => ({ ...p, lead_days: Math.max(0, Math.min(60, parseInt(e.target.value) || 0)) }))} />
            </div>
          )}

          <div>
            <label className="label">Цвят</label>
            <div className="flex gap-2 mt-1">
              {COLORS.map(c => (
                <button key={c.key} type="button" onClick={() => setForm(p => ({ ...p, color: c.key }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${c.chip} ${form.color === c.key ? 'ring-2 ring-offset-1 ring-slate-300' : ''}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary" style={{ backgroundColor: '#0f2240' }}>
              {saving ? 'Запазване...' : editId ? 'Запази промените' : 'Добави'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Отказ</button>
          </div>
        </form>
      </Modal>

      <Confirm open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Изтрий задача" message="Сигурен ли си, че искаш да изтриеш тази задача и всичките ѝ отметки?" confirmLabel="Изтрий" danger />
    </div>
  )
}

function fmtBadge(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}`
}
