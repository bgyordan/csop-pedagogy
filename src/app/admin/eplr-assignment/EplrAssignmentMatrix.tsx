'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFullName } from '@/lib/utils'
import { Save, Users, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface StaffMember {
  id: string
  first_name: string
  last_name: string
  middle_name?: string
  position?: string
}

interface Assignment {
  student_id: string
  psychologist_id: string | null
  speech_therapist_id: string | null
  rehabilitator_id: string | null
  class_teacher_id: string | null
}

interface Props {
  classes: any[]
  enrollments: any[]
  eplrTeams: any[]
  classTeachers: any[]
  psychologists: StaffMember[]
  speechTherapists: StaffMember[]
  rehabilitators: StaffMember[]
  currentYearId: string
}

export function EplrAssignmentMatrix({
  classes, enrollments, eplrTeams, classTeachers,
  psychologists, speechTherapists, rehabilitators, currentYearId
}: Props) {
  const supabase = createClient()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [expandedClass, setExpandedClass] = useState<string | null>(classes[0]?.id || null)
  const [filter, setFilter] = useState<'all' | 'complete' | 'incomplete'>('all')

  // Карта класен → паралелка
  const classTeacherMap = useMemo(() => {
    const map = new Map<string, string>()
    classTeachers.forEach((ct: any) => {
      if (ct.staff) map.set(ct.class_id, ct.staff.id)
    })
    return map
  }, [classTeachers])

  // Инициализирай assignments от съществуващите екипи
  const [assignments, setAssignments] = useState<Record<string, Assignment>>(() => {
    const map: Record<string, Assignment> = {}
    enrollments.forEach(e => {
      const existing = eplrTeams.find(t => t.student_id === e.student_id)
      const classTeacherId = classTeacherMap.get(e.class_id) || null
      map[e.student_id] = {
        student_id: e.student_id,
        psychologist_id: existing?.psychologist_id || null,
        speech_therapist_id: existing?.speech_therapist_id || null,
        rehabilitator_id: existing?.rehabilitator_id || null,
        class_teacher_id: classTeacherId,
      }
    })
    return map
  })

  // Live броячи
  const counts = useMemo(() => {
    const psy: Record<string, number> = {}
    const slt: Record<string, number> = {}
    const rehab: Record<string, number> = {}

    Object.values(assignments).forEach(a => {
      if (a.psychologist_id) psy[a.psychologist_id] = (psy[a.psychologist_id] || 0) + 1
      if (a.speech_therapist_id) slt[a.speech_therapist_id] = (slt[a.speech_therapist_id] || 0) + 1
      if (a.rehabilitator_id) rehab[a.rehabilitator_id] = (rehab[a.rehabilitator_id] || 0) + 1
    })
    return { psy, slt, rehab }
  }, [assignments])

  // Статистика
  const totalStudents = enrollments.length
  const completeCount = Object.values(assignments).filter(
    a => a.psychologist_id || a.speech_therapist_id
  ).length
  const incompleteCount = totalStudents - completeCount

  function updateAssignment(studentId: string, field: keyof Assignment, value: string | null) {
    setAssignments(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value || null }
    }))
  }

  // Bulk apply за цяла паралелка
  function bulkApply(classId: string, field: 'psychologist_id' | 'speech_therapist_id' | 'rehabilitator_id', value: string | null) {
    const studentIds = enrollments.filter(e => e.class_id === classId).map(e => e.student_id)
    setAssignments(prev => {
      const next = { ...prev }
      studentIds.forEach(sid => {
        next[sid] = { ...next[sid], [field]: value || null }
      })
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    const toUpsert = Object.values(assignments).map(a => ({
      student_id: a.student_id,
      academic_year_id: currentYearId,
      psychologist_id: a.psychologist_id,
      speech_therapist_id: a.speech_therapist_id,
      rehabilitator_id: a.rehabilitator_id,
      class_teacher_id: a.class_teacher_id,
    }))

    const { error } = await supabase
      .from('eplr_teams')
      .upsert(toUpsert, { onConflict: 'student_id,academic_year_id' })

    if (error) {
      toast('Грешка при запис', 'error')
    } else {
      toast('Разпределението е запазено!')
    }
    setSaving(false)
  }

  function getCountColor(count: number, max = 30) {
    if (count === 0) return 'bg-slate-100 text-slate-400'
    if (count <= max * 0.7) return 'bg-green-100 text-green-700'
    if (count <= max) return 'bg-amber-100 text-amber-700'
    return 'bg-red-100 text-red-700'
  }

  // Филтрирани паралелки
  const filteredClasses = classes.filter(cls => {
    if (filter === 'all') return true
    const students = enrollments.filter(e => e.class_id === cls.id)
    const hasIncomplete = students.some(e => !assignments[e.student_id]?.psychologist_id && !assignments[e.student_id]?.speech_therapist_id)
    if (filter === 'incomplete') return hasIncomplete
    if (filter === 'complete') return !hasIncomplete
    return true
  })

  return (
    <div>
      {/* Live броячи */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Психолози */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <Users size={15} className="text-blue-500" />
            <h3 className="text-sm font-medium text-slate-700">Психолози</h3>
          </div>
          <div className="space-y-2">
            {psychologists.map(p => {
              const count = counts.psy[p.id] || 0
              return (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 truncate mr-2">{getFullName(p)}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${getCountColor(count)}`}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Логопеди */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <Users size={15} className="text-purple-500" />
            <h3 className="text-sm font-medium text-slate-700">Логопеди</h3>
          </div>
          <div className="space-y-2">
            {speechTherapists.map(s => {
              const count = counts.slt[s.id] || 0
              return (
                <div key={s.id} className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 truncate mr-2">{getFullName(s)}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${getCountColor(count)}`}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Рехабилитатори */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <Users size={15} className="text-green-500" />
            <h3 className="text-sm font-medium text-slate-700">Рехабилитатори</h3>
          </div>
          <div className="space-y-2">
            {rehabilitators.map(r => {
              const count = counts.rehab[r.id] || 0
              return (
                <div key={r.id} className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 truncate mr-2">
                    {getFullName(r)}
                    {r.position && <span className="text-slate-400 ml-1">({r.position.split(',')[0]})</span>}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${getCountColor(count, 20)}`}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Обобщение + Запази */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-green-100 text-green-700">
            <CheckCircle2 size={13} />
            {completeCount} разпределени
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-red-100 text-red-700">
            <AlertCircle size={13} />
            {incompleteCount} без екип
          </span>
        </div>

        {/* Филтри */}
        <div className="flex gap-1 ml-auto">
          {(['all', 'incomplete', 'complete'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                filter === f ? 'text-white border-transparent' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              style={filter === f ? { backgroundColor: '#0f2240' } : {}}>
              {f === 'all' ? 'Всички' : f === 'incomplete' ? '🔴 Без екип' : '🟢 Разпределени'}
            </button>
          ))}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#0f2240' }}>
          <Save size={15} />
          {saving ? 'Запазване...' : 'Запази всичко'}
        </button>
      </div>

      {/* Матрица по паралелки */}
      <div className="space-y-3">
        {filteredClasses.map(cls => {
          const classStudents = enrollments.filter(e => e.class_id === cls.id)
          const classTeacherId = classTeacherMap.get(cls.id)
          const classIncomplete = classStudents.filter(e =>
            !assignments[e.student_id]?.psychologist_id && !assignments[e.student_id]?.speech_therapist_id
          ).length
          const isExpanded = expandedClass === cls.id

          return (
            <div key={cls.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Хедър на паралелката */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedClass(isExpanded ? null : cls.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-800">Паралелка {cls.name}</span>
                  <span className="text-xs text-slate-400">{classStudents.length} ученика</span>
                  {classIncomplete > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      {classIncomplete} без екип
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </div>

              {/* Bulk actions */}
              {isExpanded && (
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-slate-500 font-medium">Приложи за цялата паралелка:</span>
                  <select className="input text-xs py-1 w-40"
                    onChange={e => bulkApply(cls.id, 'psychologist_id', e.target.value)}
                    defaultValue="">
                    <option value="">Психолог...</option>
                    {psychologists.map(p => (
                      <option key={p.id} value={p.id}>{getFullName(p)}</option>
                    ))}
                  </select>
                  <select className="input text-xs py-1 w-40"
                    onChange={e => bulkApply(cls.id, 'speech_therapist_id', e.target.value)}
                    defaultValue="">
                    <option value="">Логопед...</option>
                    {speechTherapists.map(s => (
                      <option key={s.id} value={s.id}>{getFullName(s)}</option>
                    ))}
                  </select>
                  <select className="input text-xs py-1 w-40"
                    onChange={e => bulkApply(cls.id, 'rehabilitator_id', e.target.value)}
                    defaultValue="">
                    <option value="">Рехабилитатор...</option>
                    {rehabilitators.map(r => (
                      <option key={r.id} value={r.id}>{getFullName(r)}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Таблица с ученици */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t border-slate-100 bg-white">
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Ученик</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-blue-500">Психолог</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-purple-500">Логопед</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-green-500">Рехабилитатор</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStudents.map((enrollment, idx) => {
                        const student = enrollment.student
                        const a = assignments[student.id] || {}
                        const hasTeam = a.psychologist_id || a.speech_therapist_id
                        return (
                          <tr key={student.id}
                            className={`border-t border-slate-100 ${!hasTeam ? 'bg-red-50/30' : idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                            <td className="px-4 py-2 font-medium text-slate-800 whitespace-nowrap">
                              {getFullName(student)}
                              {!hasTeam && <span className="ml-2 text-red-400 text-xs">⚠</span>}
                            </td>
                            <td className="px-4 py-2">
                              <select
                                value={a.psychologist_id || ''}
                                onChange={e => updateAssignment(student.id, 'psychologist_id', e.target.value)}
                                className="input text-xs py-1 w-full min-w-32"
                              >
                                <option value="">— Няма —</option>
                                {psychologists.map(p => (
                                  <option key={p.id} value={p.id}>{getFullName(p)}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <select
                                value={a.speech_therapist_id || ''}
                                onChange={e => updateAssignment(student.id, 'speech_therapist_id', e.target.value)}
                                className="input text-xs py-1 w-full min-w-32"
                              >
                                <option value="">— Няма —</option>
                                {speechTherapists.map(s => (
                                  <option key={s.id} value={s.id}>{getFullName(s)}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <select
                                value={a.rehabilitator_id || ''}
                                onChange={e => updateAssignment(student.id, 'rehabilitator_id', e.target.value)}
                                className="input text-xs py-1 w-full min-w-32"
                              >
                                <option value="">— Няма —</option>
                                {rehabilitators.map(r => (
                                  <option key={r.id} value={r.id}>
                                    {getFullName(r)}
                                  </option>
                                ))}
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
    </div>
  )
}
