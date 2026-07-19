'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, X, Loader2, User } from 'lucide-react'

interface Teacher { id: string; name: string; assignmentId: string }
interface Option { id: string; name: string }

interface Props {
  classId: string
  academicYearId: string
  teachers: Teacher[]
  options: Option[]
  canManage: boolean
}

export default function ClassTeachersSection({ classId, academicYearId, teachers: initial, options, canManage }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [teachers, setTeachers] = useState<Teacher[]>(initial)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  async function addTeacher() {
    if (!selected) return
    setBusy('add')
    const { data, error } = await supabase.from('class_teacher_assignments').insert({
      staff_id: selected,
      class_id: classId,
      academic_year_id: academicYearId,
    }).select('id').single()

    if (!error && data) {
      const opt = options.find(o => o.id === selected)
      if (opt) setTeachers(prev => [...prev, { id: opt.id, name: opt.name, assignmentId: data.id }])
      setSelected('')
      setAdding(false)
      router.refresh()
    } else if (error) {
      alert(`Грешка: ${error.message}`)
    }
    setBusy(null)
  }

  async function removeTeacher(assignmentId: string) {
    if (!confirm('Премахване на класния ръководител от тази паралелка?')) return
    setBusy(assignmentId)
    await supabase.from('class_teacher_assignments').delete().eq('id', assignmentId)
    setTeachers(prev => prev.filter(t => t.assignmentId !== assignmentId))
    setBusy(null)
    router.refresh()
  }

  const available = options.filter(o => !teachers.some(t => t.id === o.id))

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Класни ръководители</span>
        {canManage && !adding && available.length > 0 && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#0f2240] transition-colors">
            <UserPlus size={13} /> Добави
          </button>
        )}
      </div>

      {teachers.length === 0 && !adding ? (
        <p className="text-sm text-slate-400">Няма назначен класен ръководител</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {teachers.map(t => (
            <span key={t.assignmentId}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700">
              <User size={13} className="text-slate-400" />
              {t.name}
              {canManage && (
                <button onClick={() => removeTeacher(t.assignmentId)} disabled={busy === t.assignmentId}
                  className="text-slate-300 hover:text-red-500 transition-colors">
                  {busy === t.assignmentId ? <Loader2 size={12} className="animate-spin" /> : <X size={13} />}
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {adding && (
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <select autoFocus value={selected} onChange={e => setSelected(e.target.value)}
            className="input flex-1 text-sm">
            <option value="">— Избери служител —</option>
            {available.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setSelected('') }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium">
              Отказ
            </button>
            <button onClick={addTeacher} disabled={!selected || busy === 'add'}
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
