'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  CalendarPlus, ChevronDown, ChevronRight, AlertTriangle, Check,
  Loader2, Plus, X, Download, Users, CalendarDays, LayoutList, Trash2
} from 'lucide-react'
import { generateEplrSchedule } from '@/lib/docx-generator'

interface Student { id: string; name: string; externalClass: string }
interface ClassData { id: string; name: string; students: Student[] }
interface Slot { studentId: string; classId: string; date: string; time: string }

interface Props {
  schedules: any[]
  classData: ClassData[]
  specialistsByStudent: Record<string, string[]>
  teamByStudent: Record<string, { psy: string | null; log: string | null; reh: string | null }>
  staffMap: Record<string, string>
  staffShortMap: Record<string, string>
  academicYearId: string
  yearName: string
  staffId: string
  canEdit: boolean
}

const MEETING_MINUTES = 15
const TIME_START_HOUR = 8
const TIME_END_HOUR = 18

const TIME_OPTIONS: string[] = (() => {
  const list: string[] = []
  for (let h = TIME_START_HOUR; h <= TIME_END_HOUR; h++) {
    for (let m = 0; m < 60; m += MEETING_MINUTES) {
      if (h === TIME_END_HOUR && m > 0) break
      list.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return list
})()

function toMinutes(t: string): number {
  if (!t) return -1
  const [h, m] = t.split(':')
  return parseInt(h) * 60 + parseInt(m)
}

function formatBgDate(d: string): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

export default function ScheduleClient({
  schedules: initialSchedules, classData, specialistsByStudent, teamByStudent, staffMap, staffShortMap,
  academicYearId, yearName, staffId, canEdit,
}: Props) {
  const supabase = createClient()

  const [schedules, setSchedules] = useState(initialSchedules)
  const [activeId, setActiveId] = useState<string>(initialSchedules[0]?.id || '')
  const [slots, setSlots] = useState<Record<string, Slot>>({})
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [view, setView] = useState<'classes' | 'specialists' | 'days'>('classes')

  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [bulkDate, setBulkDate] = useState<Record<string, string>>({})

  useEffect(() => { if (activeId) loadSlots() }, [activeId])

  async function loadSlots() {
    setLoading(true)
    const { data } = await supabase
      .from('eplr_schedule_slots')
      .select('student_id, class_id, meeting_date, meeting_time')
      .eq('schedule_id', activeId)

    const map: Record<string, Slot> = {}
    ;(data || []).forEach((s: any) => {
      map[s.student_id] = {
        studentId: s.student_id,
        classId: s.class_id,
        date: s.meeting_date || '',
        time: s.meeting_time ? s.meeting_time.substring(0, 5) : '',
      }
    })
    setSlots(map)
    setLoading(false)
  }

  async function createSchedule() {
    if (!newName.trim()) return
    setCreating(true)
    const { data, error } = await supabase.from('eplr_schedules').insert({
      name: newName.trim(),
      academic_year_id: academicYearId,
      created_by: staffId || null,
    }).select().single()
    setCreating(false)
    if (error) { alert(`Грешка: ${error.message}`); return }
    setSchedules(prev => [data, ...prev])
    setActiveId(data.id)
    setNewName('')
    setShowNew(false)
  }

  async function deleteSchedule() {
    const sch = schedules.find(s => s.id === activeId)
    if (!sch) return
    if (!confirm(`Изтриване на график "${sch.name}" и всички часове в него?`)) return
    await supabase.from('eplr_schedules').delete().eq('id', activeId)
    const rest = schedules.filter(s => s.id !== activeId)
    setSchedules(rest)
    setActiveId(rest[0]?.id || '')
    setSlots({})
  }

  async function saveSlot(studentId: string, classId: string, date: string, time: string) {
    setSlots(prev => ({ ...prev, [studentId]: { studentId, classId, date, time } }))

    if (!date && !time) {
      await supabase.from('eplr_schedule_slots')
        .delete().eq('schedule_id', activeId).eq('student_id', studentId)
      return
    }

    await supabase.from('eplr_schedule_slots').upsert({
      schedule_id: activeId,
      student_id: studentId,
      class_id: classId,
      meeting_date: date || null,
      meeting_time: time || null,
    }, { onConflict: 'schedule_id,student_id' })
  }

  async function applyDateToClass(cls: ClassData) {
    const date = bulkDate[cls.id]
    if (!date) return
    for (const st of cls.students) {
      const cur = slots[st.id]
      await saveSlot(st.id, cls.id, date, cur?.time || '')
    }
  }

  // ── КОНФЛИКТИ ──
  const conflicts = useMemo(() => {
    const result: Record<string, string[]> = {}
    const filled = Object.values(slots).filter(s => s.date && s.time)

    for (let i = 0; i < filled.length; i++) {
      for (let j = i + 1; j < filled.length; j++) {
        const a = filled[i], b = filled[j]
        if (a.date !== b.date) continue
        const diff = Math.abs(toMinutes(a.time) - toMinutes(b.time))
        if (diff >= MEETING_MINUTES) continue

        const spA = specialistsByStudent[a.studentId] || []
        const spB = specialistsByStudent[b.studentId] || []
        const shared = spA.filter(x => spB.includes(x))
        if (shared.length === 0) continue

        const names = shared.map(id => staffMap[id] || '—')
        result[a.studentId] = [...new Set([...(result[a.studentId] || []), ...names])]
        result[b.studentId] = [...new Set([...(result[b.studentId] || []), ...names])]
      }
    }
    return result
  }, [slots, specialistsByStudent, staffMap])

  const conflictCount = Object.keys(conflicts).length

  // ── ИЗГЛЕД ПО СПЕЦИАЛИСТИ ──
  const bySpecialist = useMemo(() => {
    const map: Record<string, { date: string; time: string; student: string; className: string }[]> = {}
    Object.values(slots).forEach(slot => {
      if (!slot.date || !slot.time) return
      const cls = classData.find(c => c.id === slot.classId)
      const st = cls?.students.find(s => s.id === slot.studentId)
      if (!st) return
      const specs = specialistsByStudent[slot.studentId] || []
      specs.forEach(sid => {
        if (!map[sid]) map[sid] = []
        map[sid].push({ date: slot.date, time: slot.time, student: st.name, className: cls?.name || '' })
      })
    })
    Object.values(map).forEach(list =>
      list.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    )
    return map
  }, [slots, classData, specialistsByStudent])

  // ── ИЗГЛЕД ПО ДНИ ──
  const byDay = useMemo(() => {
    const map: Record<string, { time: string; student: string; className: string; conflict: boolean }[]> = {}
    Object.values(slots).forEach(slot => {
      if (!slot.date || !slot.time) return
      const cls = classData.find(c => c.id === slot.classId)
      const st = cls?.students.find(s => s.id === slot.studentId)
      if (!st) return
      if (!map[slot.date]) map[slot.date] = []
      map[slot.date].push({
        time: slot.time, student: st.name, className: cls?.name || '',
        conflict: !!conflicts[slot.studentId],
      })
    })
    Object.values(map).forEach(list => list.sort((a, b) => a.time.localeCompare(b.time)))
    return map
  }, [slots, classData, conflicts])

  function handleWord() {
    const sch = schedules.find(s => s.id === activeId)
    const data = classData
      .map(cls => ({
        className: cls.name,
        rows: cls.students
          .map(st => ({
            name: st.name,
            externalClass: st.externalClass,
            date: slots[st.id]?.date || '',
            time: slots[st.id]?.time || '',
          }))
          .filter(r => r.date || r.time)
          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
      }))
      .filter(c => c.rows.length > 0)

    if (data.length === 0) { alert('Няма въведени часове'); return }
    generateEplrSchedule(sch?.name || 'График', yearName, data)
  }

  const totalPlanned = Object.values(slots).filter(s => s.date && s.time).length
  const totalStudents = classData.reduce((sum, c) => sum + c.students.length, 0)

  return (
    <div className="space-y-4">
      {/* Избор на график */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {schedules.length > 0 ? (
            <select value={activeId} onChange={e => setActiveId(e.target.value)} className="input flex-1 text-sm">
              {schedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : (
            <span className="text-sm text-slate-400 flex-1">Няма създаден график</span>
          )}

          {canEdit && !showNew && (
            <div className="flex gap-2">
              <button onClick={() => setShowNew(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-90"
                style={{ backgroundColor: '#0f2240' }}>
                <Plus size={14} /> Нов график
              </button>
              {activeId && (
                <button onClick={deleteSchedule} title="Изтрий графика"
                  className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          )}
        </div>

        {showNew && (
          <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-slate-100">
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              placeholder='Име (напр. "1-ви срок 2025/2026")' className="input flex-1 text-sm" />
            <div className="flex gap-2">
              <button onClick={() => { setShowNew(false); setNewName('') }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-medium">Отказ</button>
              <button onClick={createSchedule} disabled={creating || !newName.trim()}
                className="px-4 py-2 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 disabled:opacity-60"
                style={{ backgroundColor: '#0f2240' }}>
                {creating && <Loader2 size={12} className="animate-spin" />} Създай
              </button>
            </div>
          </div>
        )}
      </div>

      {!activeId ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
          <CalendarPlus size={28} className="mx-auto mb-2 text-slate-300" />
          <p className="text-slate-400 text-sm">Създайте график, за да започнете</p>
        </div>
      ) : (
        <>
          {/* Обобщение + табове */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
            <div className="flex gap-1 p-1 bg-slate-50 rounded-xl w-fit">
              {([
                ['classes', 'По паралелки', <LayoutList size={13} key="a" />],
                ['specialists', 'По специалисти', <Users size={13} key="b" />],
                ['days', 'По дни', <CalendarDays size={13} key="c" />],
              ] as const).map(([key, label, icon]) => (
                <button key={key} onClick={() => setView(key as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    view === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {icon} {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500">{totalPlanned} от {totalStudents} насрочени</span>
              {conflictCount > 0 && (
                <span className="flex items-center gap-1 font-semibold text-red-600">
                  <AlertTriangle size={13} /> {conflictCount} конфликта
                </span>
              )}
              <button onClick={handleWord}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium">
                <Download size={13} /> Word
              </button>
            </div>
          </div>

          {loading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
              <Loader2 size={24} className="animate-spin mx-auto text-slate-300" />
            </div>
          ) : view === 'classes' ? (
            /* ── ПО ПАРАЛЕЛКИ ── */
            <div className="space-y-2">
              {classData.map(cls => {
                const isOpen = expanded[cls.id]
                const clsSlots = cls.students.map(s => slots[s.id]).filter(s => s?.date && s?.time)
                const clsConflicts = cls.students.filter(s => conflicts[s.id]).length
                const done = clsSlots.length

                return (
                  <div key={cls.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <button onClick={() => setExpanded(p => ({ ...p, [cls.id]: !p[cls.id] }))}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                      {isOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                      <span className="text-sm font-medium text-slate-800 flex-1 text-left">{cls.name}</span>
                      {clsConflicts > 0 && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-red-600">
                          <AlertTriangle size={12} /> {clsConflicts}
                        </span>
                      )}
                      <span className={`text-[11px] font-medium ${
                        done === cls.students.length && done > 0 ? 'text-emerald-600' : 'text-slate-400'
                      }`}>
                        {done === cls.students.length && done > 0 && <Check size={12} className="inline mr-0.5" />}
                        {done}/{cls.students.length}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100">
                        {canEdit && (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-4 py-2.5 bg-slate-50/60 border-b border-slate-100">
                            <span className="text-[11px] text-slate-500">Дата за всички:</span>
                            <input type="date" value={bulkDate[cls.id] || ''}
                              onChange={e => setBulkDate(p => ({ ...p, [cls.id]: e.target.value }))}
                              className="px-2 py-1 border border-slate-200 rounded-lg text-xs" />
                            <button onClick={() => applyDateToClass(cls)} disabled={!bulkDate[cls.id]}
                              className="px-3 py-1 rounded-lg text-[11px] font-medium text-white disabled:opacity-40"
                              style={{ backgroundColor: '#0f2240' }}>
                              Приложи
                            </button>
                          </div>
                        )}

                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-8">№</th>
                              <th className="text-left px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ученик</th>
                              <th className="text-left px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-14">Клас</th>
                              <th className="text-left px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider" title="Психолог">Псх</th>
                              <th className="text-left px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider" title="Логопед">Лог</th>
                              <th className="text-left px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider" title="Рехабилитатор">Рех</th>
                              <th className="text-left px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-32">Дата</th>
                              <th className="text-left px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24">Час</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {cls.students.map((st, i) => {
                              const slot = slots[st.id]
                              const conf = conflicts[st.id]
                              return (
                                <tr key={st.id} className={conf ? 'bg-red-50/50' : 'hover:bg-slate-50/50'}>
                                  <td className="px-4 py-1.5 text-xs text-slate-400">{i + 1}</td>
                                  <td className="px-2 py-1.5">
                                    <div className="text-sm text-slate-700">{st.name}</div>
                                    {conf && (
                                      <div className="text-[10px] text-red-600 flex items-center gap-1 mt-0.5">
                                        <AlertTriangle size={9} /> зает: {conf.join(', ')}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-2 py-1.5 text-xs text-slate-500">{st.externalClass}</td>
                                  {(['psy', 'log', 'reh'] as const).map(key => {
                                    const sid = teamByStudent[st.id]?.[key]
                                    const busy = sid && conf && conf.includes(staffMap[sid] || '')
                                    return (
                                      <td key={key} className="px-2 py-1.5">
                                        <span className={`text-[10px] whitespace-nowrap ${
                                          busy ? 'text-red-600 font-semibold' : 'text-slate-400'
                                        }`} title={sid ? staffMap[sid] : ''}>
                                          {sid ? staffShortMap[sid] : '—'}
                                        </span>
                                      </td>
                                    )
                                  })}
                                  <td className="px-2 py-1.5">
                                    <input type="date" disabled={!canEdit}
                                      value={slot?.date || ''}
                                      onChange={e => saveSlot(st.id, cls.id, e.target.value, slot?.time || '')}
                                      className="px-2 py-1 border border-slate-200 rounded-lg text-xs w-full disabled:bg-slate-50" />
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <select disabled={!canEdit}
                                      value={slot?.time || ''}
                                      onChange={e => saveSlot(st.id, cls.id, slot?.date || '', e.target.value)}
                                      className={`px-2 py-1 border rounded-lg text-xs w-full disabled:bg-slate-50 ${
                                        conf ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                      }`}>
                                      <option value="">—</option>
                                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : view === 'specialists' ? (
            /* ── ПО СПЕЦИАЛИСТИ ── */
            <div className="space-y-3">
              {Object.keys(bySpecialist).length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
                  <p className="text-slate-400 text-sm">Няма насрочени заседания</p>
                </div>
              ) : Object.entries(bySpecialist)
                .sort((a, b) => (staffMap[a[0]] || '').localeCompare(staffMap[b[0]] || '', 'bg'))
                .map(([sid, list]) => (
                  <div key={sid} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <span className="text-sm font-medium text-slate-800">{staffMap[sid] || '—'}</span>
                      <span className="text-xs text-slate-400">{list.length} заседания</span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-50">
                        {list.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="px-4 py-1.5 text-xs text-slate-500 w-28">{formatBgDate(item.date)}</td>
                            <td className="px-2 py-1.5 text-xs font-medium text-slate-700 w-16">{item.time}</td>
                            <td className="px-2 py-1.5 text-sm text-slate-700">{item.student}</td>
                            <td className="px-4 py-1.5 text-xs text-slate-400 text-right">{item.className}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
            </div>
          ) : (
            /* ── ПО ДНИ ── */
            <div className="space-y-3">
              {Object.keys(byDay).length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
                  <p className="text-slate-400 text-sm">Няма насрочени заседания</p>
                </div>
              ) : Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).map(([date, list]) => (
                <div key={date} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <span className="text-sm font-medium text-slate-800">{formatBgDate(date)}</span>
                    <span className="text-xs text-slate-400">{list.length} заседания</span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-50">
                      {list.map((item, i) => (
                        <tr key={i} className={item.conflict ? 'bg-red-50/50' : 'hover:bg-slate-50/50'}>
                          <td className="px-4 py-1.5 text-xs font-medium text-slate-700 w-16">{item.time}</td>
                          <td className="px-2 py-1.5 text-sm text-slate-700">
                            {item.student}
                            {item.conflict && <AlertTriangle size={11} className="inline ml-1.5 text-red-500" />}
                          </td>
                          <td className="px-4 py-1.5 text-xs text-slate-400 text-right">{item.className}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
