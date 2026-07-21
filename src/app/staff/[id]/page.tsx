'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, X, Loader2, Plus } from 'lucide-react'

interface ClassItem { assignmentId: string; classId: string; name: string }
interface Option { id: string; name: string; takenBy?: string | null }

interface Props {
  staffId: string
  academicYearId: string
  assigned: ClassItem[]
  options: Option[]
  canManage: boolean
}

export default function StaffClassesSection({ staffId, academicYearId, assigned: initial, options, canManage }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [assigned, setAssigned] = useState<ClassItem[]>(initial)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  async function addClass() {
    if (!selected) return
    setBusy('add')
    const { data, error } = await supabase.from('class_teacher_assignments').insert({
      staff_id: staffId,
      class_id: selected,
      academic_year_id: academicYearId,
    }).select('id').single()

    if (!error && data) {
      await syncEplrTeacher(selected, staffId)
      const opt = options.find(o => o.id === selected)
      if (opt) setAssigned(prev => [...prev, { assignmentId: data.id, classId: opt.id, name: opt.name }])
      setSelected('')
      setAdding(false)
      router.refresh()
    } else if (error) {
      alert(`Грешка: ${error.message}`)
    }
    setBusy(null)
  }

  async function removeClass(assignmentId: string) {
    if (!confirm('Премахване от тази паралелка?')) return
    const item = assigned.find(a => a.assignmentId === assignmentId)
    setBusy(assignmentId)
    await supabase.from('class_teacher_assignments').delete().eq('id', assignmentId)
    if (item) await syncEplrTeacher(item.classId, null)
    setAssigned(prev => prev.filter(a => a.assignmentId !== assignmentId))
    setBusy(null)
    router.refresh()
  }

  // Обновява class_teacher_id в ЕПЛР екипите на учениците от паралелката
  async function syncEplrTeacher(classId: string, teacherId: string | null) {
    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('student_id')
      .eq('class_id', classId)
      .eq('academic_year_id', academicYearId)

    const studentIds = (enrollments || []).map(e => e.student_id)
    if (studentIds.length === 0) return

    await supabase
      .from('eplr_teams')
      .update({ class_teacher_id: teacherId })
      .in('student_id', studentIds)
      .eq('academic_year_id', academicYearId)
  }

  const available = options.filter(o => !assigned.some(a => a.classId === o.id))
  const freeCount = available.filter(o => !o.takenBy).length

  if (!canManage && assigned.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <BookOpen size={14} /> Класен ръководител на
        </span>
        {canManage && !adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#0f2240] transition-colors">
            <Plus size={13} /> Добави паралелка
          </button>
        )}
      </div>

      {assigned.length === 0 && !adding ? (
        <p className="text-sm text-slate-400">Не е класен ръководител</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assigned.map(a => (
            <span key={a.assignmentId}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
              {a.name}
              {canManage && (
                <button onClick={() => removeClass(a.assignmentId)} disabled={busy === a.assignmentId}
                  className="text-slate-300 hover:text-red-500 transition-colors">
                  {busy === a.assignmentId ? <Loader2 size={12} className="animate-spin" /> : <X size={13} />}
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {adding && freeCount === 0 && (
        <p className="text-[11px] text-amber-600 mt-3">
          Всички паралелки вече имат класен ръководител. За да преназначите, първо премахнете текущия от страницата на паралелката.
        </p>
      )}

      {adding && (
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <select autoFocus value={selected} onChange={e => setSelected(e.target.value)}
            className="input flex-1 text-sm">
            <option value="">— Избери паралелка —</option>
            {available.map(o => (
              <option key={o.id} value={o.id} disabled={!!o.takenBy}>
                {o.name}{o.takenBy ? ` — зает (${o.takenBy})` : ''}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setSelected('') }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium">
              Отказ
            </button>
            <button onClick={addClass} disabled={!selected || busy === 'add'}
              className="px-4 py-2 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 disabled:opacity-60"
              style={{ backgroundColor: '#0f2240' }}>
              {busy === 'add' && <Loader2 size={12} className="animate-spin" />}
              Назначи
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
