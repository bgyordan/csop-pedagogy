'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarDays, Plus, X, Check, Search, Users, UserCheck, UserX, Loader2, FileText } from 'lucide-react'

interface Week {
  index: number
  start: string   // ISO
  end: string     // ISO
  label: string   // "15.09 – 18.09.2026"
}
interface Staff {
  id: string
  name: string
  role: string
  roleLabel: string
  className: string | null   // класен на коя паралелка
}
interface Duty {
  id: string
  staff_id: string
  start_date: string
  end_date: string
}
interface Props {
  staff: Staff[]
  duties: Duty[]
  weeks: Week[]
  canManage: boolean
  academicYearId: string
}

export default function DutyRosterClient({ staff, duties: initialDuties, weeks, canManage, academicYearId }: Props) {
  const supabase = createClient()
  const [duties, setDuties] = useState<Duty[]>(initialDuties)
  const [view, setView] = useState<'staff' | 'week'>('staff')
  const [search, setSearch] = useState('')
  const [pickerStaff, setPickerStaff] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')

  const staffById = useMemo(() => {
    const m: Record<string, Staff> = {}
    staff.forEach(s => { m[s.id] = s })
    return m
  }, [staff])

  // Дежурства по служител
  const dutiesByStaff = useMemo(() => {
    const m: Record<string, Duty[]> = {}
    duties.forEach(d => {
      if (!m[d.staff_id]) m[d.staff_id] = []
      m[d.staff_id].push(d)
    })
    Object.values(m).forEach(arr => arr.sort((a, b) => a.start_date.localeCompare(b.start_date)))
    return m
  }, [duties])

  // Дежурства по седмица (индекс)
  const dutiesByWeek = useMemo(() => {
    const m: Record<string, Duty[]> = {}
    duties.forEach(d => {
      if (!m[d.start_date]) m[d.start_date] = []
      m[d.start_date].push(d)
    })
    return m
  }, [duties])

  const assignedStaff = staff.filter(s => (dutiesByStaff[s.id] || []).length > 0)
  const unassignedStaff = staff.filter(s => (dutiesByStaff[s.id] || []).length === 0)

  function weekLabelByStart(start: string): string {
    const w = weeks.find(w => w.start === start)
    return w ? w.label : start
  }

  function staffFreeWeeks(staffId: string): Week[] {
    const taken = new Set((dutiesByStaff[staffId] || []).map(d => d.start_date))
    return weeks.filter(w => !taken.has(w.start))
  }

  const MONTHS = ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември']
  function groupByMonth(list: Week[]): { month: string; weeks: Week[] }[] {
    const groups: Record<string, Week[]> = {}
    const order: string[] = []
    list.forEach(w => {
      const d = new Date(w.start)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!groups[key]) { groups[key] = []; order.push(key) }
      groups[key].push(w)
    })
    return order.map(key => {
      const [, m] = key.split('-')
      return { month: MONTHS[parseInt(m)], weeks: groups[key] }
    })
  }

  function WeekPicker({ staffId }: { staffId: string }) {
    const grouped = groupByMonth(staffFreeWeeks(staffId))
    return (
      <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Избери седмица</span>
          <button onClick={() => setPickerStaff(null)} className="text-slate-400 hover:text-slate-700"><X size={13} /></button>
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {grouped.map(g => (
            <div key={g.month} className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-[#0f2240] uppercase tracking-wide w-16 flex-shrink-0 pt-1.5">{g.month}</span>
              <div className="flex flex-wrap gap-1 flex-1">
                {g.weeks.map(w => (
                  <button key={w.index} onClick={() => addDuty(staffId, w)} disabled={busy}
                    className="px-2 py-1 rounded-lg text-[11px] bg-white border border-slate-200 hover:bg-[#0f2240] hover:text-white transition-colors">
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  async function addDuty(staffId: string, week: Week) {
    setBusy(true)
    const { data, error } = await supabase.from('duty_slots').insert({
      staff_id: staffId,
      start_date: week.start,
      end_date: week.end,
      academic_year_id: academicYearId,
    }).select().single()
    setBusy(false)
    if (error) { setFlash(`Грешка: ${error.message}`); return }
    if (data) {
      setDuties(prev => [...prev, data as Duty])
      setFlash('Дежурството е добавено')
      setTimeout(() => setFlash(''), 2000)
    }
  }

  async function removeDuty(dutyId: string) {
    setBusy(true)
    const { error } = await supabase.from('duty_slots').delete().eq('id', dutyId)
    setBusy(false)
    if (error) { setFlash(`Грешка: ${error.message}`); return }
    setDuties(prev => prev.filter(d => d.id !== dutyId))
    setFlash('Премахнато')
    setTimeout(() => setFlash(''), 2000)
  }

  const filteredAssigned = assignedStaff.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
  const filteredUnassigned = unassignedStaff.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))

  function StaffRole({ s }: { s: Staff }) {
    return (
      <span className="text-[11px] text-slate-400">
        {s.className ? `Класен на ${s.className}` : s.roleLabel}
      </span>
    )
  }

  return (
    <div className="space-y-5">
      {flash && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-[#0f2240] text-white text-sm shadow-lg">
          {flash}
        </div>
      )}

      {/* Лента: статистики + превключвател + търсене */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-medium text-emerald-700">
            <UserCheck size={14} /> С дежурство: {assignedStaff.length}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-500">
            <UserX size={14} /> Без: {unassignedStaff.length}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setView('staff')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === 'staff' ? 'bg-white text-[#0f2240] shadow-sm' : 'text-slate-500'}`}>
              По служител
            </button>
            <button onClick={() => setView('week')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === 'week' ? 'bg-white text-[#0f2240] shadow-sm' : 'text-slate-500'}`}>
              По седмица
            </button>
          </div>
        </div>
      </div>

      {view === 'staff' && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Търси служител..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-200" />
        </div>
      )}

      {/* ИЗГЛЕД ПО СЛУЖИТЕЛ */}
      {view === 'staff' && (
        <div className="space-y-5">
          {/* С дежурство */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
              <UserCheck size={15} className="text-emerald-600" />
              <span className="text-sm font-semibold text-slate-700">С разпределено дежурство</span>
              <span className="ml-auto text-xs text-slate-400">{filteredAssigned.length}</span>
            </div>
            {filteredAssigned.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">Още никой няма разпределено дежурство</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {filteredAssigned.map(s => (
                  <div key={s.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800">{s.name}</div>
                        <StaffRole s={s} />
                      </div>
                      {canManage && (
                        <button onClick={() => setPickerStaff(pickerStaff === s.id ? null : s.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white transition-opacity hover:opacity-90 flex-shrink-0"
                          style={{ backgroundColor: '#0f2240' }}>
                          <Plus size={12} /> Седмица
                        </button>
                      )}
                    </div>
                    {/* Седмиците на служителя */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(dutiesByStaff[s.id] || []).map(d => (
                        <span key={d.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {weekLabelByStart(d.start_date)}
                          {canManage && (
                            <button onClick={() => removeDuty(d.id)} className="text-slate-400 hover:text-red-500">
                              <X size={11} />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    {/* Пикер за седмица */}
                    {pickerStaff === s.id && canManage && <WeekPicker staffId={s.id} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Без дежурство */}
          {canManage && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
                <UserX size={15} className="text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">Без дежурство</span>
                <span className="ml-auto text-xs text-slate-400">{filteredUnassigned.length}</span>
              </div>
              {filteredUnassigned.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">Всички имат дежурство</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {filteredUnassigned.map(s => (
                    <div key={s.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800">{s.name}</div>
                          <StaffRole s={s} />
                        </div>
                        <button onClick={() => setPickerStaff(pickerStaff === s.id ? null : s.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white transition-opacity hover:opacity-90 flex-shrink-0"
                          style={{ backgroundColor: '#0f2240' }}>
                          <Plus size={12} /> Дай седмица
                        </button>
                      </div>
                      {pickerStaff === s.id && <WeekPicker staffId={s.id} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ИЗГЛЕД ПО СЕДМИЦА */}
      {view === 'week' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
            <CalendarDays size={15} className="text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Дежурства по седмици</span>
          </div>
          <div className="divide-y divide-slate-50">
            {weeks.map(w => {
              const onDuty = (dutiesByWeek[w.start] || [])
              return (
                <div key={w.index} className={`flex items-start justify-between gap-3 px-5 py-2.5 ${onDuty.length === 0 ? 'opacity-50' : ''}`}>
                  <span className="text-xs font-mono text-slate-600 w-32 flex-shrink-0 pt-0.5">{w.label}</span>
                  <div className="flex flex-wrap gap-1.5 flex-1 justify-end">
                    {onDuty.length === 0 ? (
                      <span className="text-[11px] text-slate-400">—</span>
                    ) : (
                      onDuty.map(d => {
                        const s = staffById[d.staff_id]
                        return (
                          <span key={d.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {s ? s.name : '—'}
                          </span>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
