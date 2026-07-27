'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFullName } from '@/lib/utils'
import { Save, Users, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, HeartPulse } from 'lucide-react'
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
  therapist_psychologist_id: string | null
  therapist_speech_id: string | null
  therapist_rehab_id: string | null
}

interface Props {
  classes: any[]
  enrollments: any[]
  psychologists: StaffMember[]
  speechTherapists: StaffMember[]
  rehabilitators: StaffMember[]
}

export function TherapistsMatrix({
  classes, enrollments, psychologists, speechTherapists, rehabilitators,
}: Props) {
  const supabase = createClient()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [expandedClass, setExpandedClass] = useState<string | null>(classes[0]?.id || null)
  const [filter, setFilter] = useState<'all' | 'complete' | 'incomplete'>('all')

  const [assignments, setAssignments] = useState<Record<string, Assignment>>(() => {
    const map: Record<string, Assignment> = {}
    enrollments.forEach(e => {
      const s = e.student
      if (!s) return
      map[s.id] = {
        student_id: s.id,
        therapist_psychologist_id: s.therapist_psychologist_id || null,
        therapist_speech_id: s.therapist_speech_id || null,
        therapist_rehab_id: s.therapist_rehab_id || null,
      }
    })
    return map
  })

  const counts = useMemo(() => {
    const psy: Record<string, number> = {}
    const slt: Record<string, number> = {}
    const rehab: Record<string, number> = {}
    Object.values(assignments).forEach(a => {
      if (a.therapist_psychologist_id) psy[a.therapist_psychologist_id] = (psy[a.therapist_psychologist_id] || 0) + 1
      if (a.therapist_speech_id) slt[a.therapist_speech_id] = (slt[a.therapist_speech_id] || 0) + 1
      if (a.therapist_rehab_id) rehab[a.therapist_rehab_id] = (rehab[a.therapist_rehab_id] || 0) + 1
    })
    return { psy, slt, rehab }
  }, [assignments])

  const totalStudents = enrollments.length
  const completeCount = Object.values(assignments).filter(
    a => a.therapist_psychologist_id || a.therapist_speech_id || a.therapist_rehab_id
  ).length
  const incompleteCount = totalStudents - completeCount

  function updateAssignment(studentId: string, field: keyof Assignment, value: string | null) {
    setAssignments(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value || null }
    }))
  }

  function bulkApply(classId: string, field: 'therapist_psychologist_id' | 'therapist_speech_id' | 'therapist_rehab_id', value: string | null) {
    const studentIds = enrollments.filter(e => e.class_id === classId).map(e => e.student?.id).filter(Boolean)
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
    // Записваме поединично в students (не upsert — обновяваме съществуващи редове)
    const updates = Object.values(assignments).map(a =>
      supabase.from('students').update({
        therapist_psychologist_id: a.therapist_psychologist_id,
        therapist_speech_id: a.therapist_speech_id,
        therapist_rehab_id: a.therapist_rehab_id,
      }).eq('id', a.student_id)
    )
    const results = await Promise.all(updates)
    const firstError = results.find(r => r.error)
    if (firstError?.error) {
      toast(`Грешка при запис: ${firstError.error.message}`, 'error')
    } else {
      toast('Разпределението на терапевтите е запазено!')
    }
    setSaving(false)
  }

  function getCountColor(count: number, max = 30) {
    if (count === 0) return 'bg-slate-100 text-slate-400'
    if (count <= max * 0.7) return 'bg-green-100 text-green-700'
    if (count <= max) return 'bg-amber-100 text-amber-700'
    return 'bg-red-100 text-red-700'
  }

  const filteredClasses = classes.filter(cls => {
    if (filter === 'all') return true
    const students = enrollments.filter(e => e.class_id === cls.id)
    const hasIncomplete = students.some(e => {
      const a = assignments[e.student?.id]
      return a && !a.therapist_psychologist_id && !a.therapist_speech_id && !a.therapist_rehab_id
    })
    if (filter === 'incomplete') return hasIncomplete
    if (filter === 'complete') return !hasIncomplete
    return true
  })

  return (
    <div>
      {/* Live броячи */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${getCountColor(count)}`}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
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
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${getCountColor(count)}`}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
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
                  <span className="text-xs text-slate-600 truncate mr-2">{getFullName(r)}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${getCountColor(count, 20)}`}>{count}</span>
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
            {completeCount} с терапевт
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
            <AlertCircle size={13} />
            {incompleteCount} без
          </span>
        </div>
        <div className="flex gap-1 ml-auto">
          {(['all', 'incomplete', 'complete'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                filter === f ? 'text-white border-transparent' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              style={filter === f ? { backgroundColor: '#0f2240' } : {}}>
              {f === 'all' ? 'Всички' : f === 'incomplete' ? 'Без терапевт' : 'С терапевт'}
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
          const classIncomplete = classStudents.filter(e => {
            const a = assignments[e.student?.id]
            return a && !a.therapist_psychologist_id && !a.therapist_speech_id && !a.therapist_rehab_id
          }).length
          const isExpanded = expandedClass === cls.id
          return (
            <div key={cls.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedClass(isExpanded ? null : cls.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-800">Паралелка {cls.name}</span>
                  <span className="text-xs text-slate-400">{classStudents.length} ученика</span>
                  {classIncomplete > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {classIncomplete} без терапевт
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </div>

              {isExpanded && (
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-slate-500 font-medium">Приложи за цялата паралелка:</span>
                  <select className="input text-xs py-1 w-40"
                    onChange={e => bulkApply(cls.id, 'therapist_psychologist_id', e.target.value)}
                    defaultValue="">
                    <option value="">Психолог...</option>
                    {psychologists.map(p => <option key={p.id} value={p.id}>{getFullName(p)}</option>)}
                  </select>
                  <select className="input text-xs py-1 w-40"
                    onChange={e => bulkApply(cls.id, 'therapist_speech_id', e.target.value)}
                    defaultValue="">
                    <option value="">Логопед...</option>
                    {speechTherapists.map(s => <option key={s.id} value={s.id}>{getFullName(s)}</option>)}
                  </select>
                  <select className="input text-xs py-1 w-40"
                    onChange={e => bulkApply(cls.id, 'therapist_rehab_id', e.target.value)}
                    defaultValue="">
                    <option value="">Рехабилитатор...</option>
                    {rehabilitators.map(r => <option key={r.id} value={r.id}>{getFullName(r)}</option>)}
                  </select>
                </div>
              )}

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
                        if (!student) return null
                        const a = assignments[student.id] || {}
                        const has = a.therapist_psychologist_id || a.therapist_speech_id || a.therapist_rehab_id
                        return (
                          <tr key={student.id}
                            className={`border-t border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                            <td className="px-4 py-2 font-medium text-slate-800 whitespace-nowrap">
                              {getFullName(student)}
                            </td>
                            <td className="px-4 py-2">
                              <select value={a.therapist_psychologist_id || ''}
                                onChange={e => updateAssignment(student.id, 'therapist_psychologist_id', e.target.value)}
                                className="input text-xs py-1 w-full min-w-32">
                                <option value="">— Няма —</option>
                                {psychologists.map(p => <option key={p.id} value={p.id}>{getFullName(p)}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <select value={a.therapist_speech_id || ''}
                                onChange={e => updateAssignment(student.id, 'therapist_speech_id', e.target.value)}
                                className="input text-xs py-1 w-full min-w-32">
                                <option value="">— Няма —</option>
                                {speechTherapists.map(s => <option key={s.id} value={s.id}>{getFullName(s)}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <select value={a.therapist_rehab_id || ''}
                                onChange={e => updateAssignment(student.id, 'therapist_rehab_id', e.target.value)}
                                className="input text-xs py-1 w-full min-w-32">
                                <option value="">— Няма —</option>
                                {rehabilitators.map(r => <option key={r.id} value={r.id}>{getFullName(r)}</option>)}
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
