'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Plus, X, Loader2, CalendarDays } from 'lucide-react'

interface EventRow {
  id: string
  title: string
  deadline_date: string
  color: string | null
}

const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември']
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const COLORS = [
  { name: 'Синьо', value: '#2563a8' },
  { name: 'Зелено', value: '#16a34a' },
  { name: 'Червено', value: '#dc2626' },
  { name: 'Оранжево', value: '#ea580c' },
  { name: 'Лилаво', value: '#7c3aed' },
]

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function DashboardCalendar({ currentYearId, canEdit, staffId }: { currentYearId: string; canEdit: boolean; staffId: string }) {
  const supabase = createClient()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0].value)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { loadEvents() }, [viewYear, viewMonth])

  async function loadEvents() {
    setLoading(true)
    const first = ymd(new Date(viewYear, viewMonth, 1))
    const last = ymd(new Date(viewYear, viewMonth + 1, 0))
    const { data } = await supabase
      .from('calendar_deadlines')
      .select('id, title, deadline_date, color')
      .gte('deadline_date', first)
      .lte('deadline_date', last)
      .order('deadline_date')
    setEvents(data || [])
    setLoading(false)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  async function addEvent() {
    if (!newTitle.trim() || !selectedDate) return
    setSaving(true)
    const { error } = await supabase.from('calendar_deadlines').insert({
      title: newTitle.trim(),
      deadline_date: selectedDate,
      color: newColor,
      academic_year_id: currentYearId,
      created_by: staffId,
    })
    setSaving(false)
    if (error) { alert('Грешка: ' + error.message); return }
    setNewTitle('')
    setNewColor(COLORS[0].value)
    loadEvents()
  }

  async function deleteEvent(id: string) {
    if (!confirm('Изтрий събитието?')) return
    setDeleting(id)
    const { error } = await supabase.from('calendar_deadlines').delete().eq('id', id)
    setDeleting(null)
    if (error) { alert('Грешка: ' + error.message); return }
    loadEvents()
  }

  // Изграждане на мрежата (понеделник-неделя)
  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  let startWeekday = firstOfMonth.getDay() // 0=нд
  startWeekday = startWeekday === 0 ? 6 : startWeekday - 1 // пн=0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const eventsByDay: Record<string, EventRow[]> = {}
  events.forEach(e => {
    const day = parseInt(e.deadline_date.split('-')[2])
    if (!eventsByDay[day]) eventsByDay[day] = []
    eventsByDay[day].push(e)
  })

  const todayStr = ymd(today)
  const selectedEvents = selectedDate ? events.filter(e => e.deadline_date === selectedDate) : []

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      {/* Хедър */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">{MONTHS[viewMonth]} {viewYear}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={16} /></button>
          <button onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }}
            className="px-2 py-0.5 rounded-lg text-[11px] font-medium text-slate-500 hover:bg-slate-100">Днес</button>
          <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Дни от седмицата */}
           <div className="grid grid-cols-1 md:grid-cols-[minmax(0,260px)_1fr]">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide">{w}</div>
        ))}
      </div>

      {/* Мрежа */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="min-h-[44px] border-b border-r border-slate-50 bg-slate-50/30" />
          const dateStr = ymd(new Date(viewYear, viewMonth, day))
          const isToday = dateStr === todayStr
          const dayEvents = eventsByDay[day] || []
          const isSelected = selectedDate === dateStr
          return (
            <button key={i}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={`min-h-[44px] border-b border-r border-slate-50 p-1 text-left align-top transition-colors hover:bg-blue-50/40 ${isSelected ? 'bg-blue-50/60' : ''}`}>
              <div className={`text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-[#0f2240] text-white' : 'text-slate-600'}`}>
                {day}
              </div>
              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 2).map(e => (
                  <div key={e.id} className="text-[9px] leading-tight px-1 py-0.5 rounded truncate text-white" style={{ backgroundColor: e.color || '#2563a8' }}>
                    {e.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[9px] text-slate-400 px-1">+{dayEvents.length - 2}</div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Панел за избран ден */}
      {selectedDate && (
        <div className="border-t border-slate-100 p-3 bg-slate-50/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600">
              {parseInt(selectedDate.split('-')[2])} {MONTHS[viewMonth]}
            </span>
            <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
          </div>

          {selectedEvents.length > 0 ? (
            <div className="space-y-1 mb-2">
              {selectedEvents.map(e => (
                <div key={e.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-white border border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.color || '#2563a8' }} />
                    <span className="text-xs text-slate-700 truncate">{e.title}</span>
                  </div>
                  {canEdit && (
                    <button onClick={() => deleteEvent(e.id)} disabled={deleting === e.id}
                      className="text-slate-300 hover:text-red-500 flex-shrink-0">
                      {deleting === e.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 mb-2">Няма събития за този ден</p>
          )}

          {canEdit && (
            <div className="space-y-2">
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addEvent() }}
                placeholder="Ново събитие..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-slate-400"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {COLORS.map(c => (
                    <button key={c.value} onClick={() => setNewColor(c.value)}
                      className={`w-5 h-5 rounded-full transition-transform ${newColor === c.value ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''}`}
                      style={{ backgroundColor: c.value }} title={c.name} />
                  ))}
                </div>
                <button onClick={addEvent} disabled={saving || !newTitle.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: '#0f2240' }}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Добави
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
