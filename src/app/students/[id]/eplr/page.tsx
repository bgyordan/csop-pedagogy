'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Lock, Plus, X, School } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import { getFullName } from '@/lib/utils'
import { StaffProfile, UserRole } from '@/types'

export default function EplrPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [student, setStudent] = useState<any>(null)
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [eplr, setEplr] = useState({
    psychologist_id: '',
    speech_therapist_id: '',
    rehabilitator_id: '',
  })
  // Класният идва от паралелката — не се избира тук
  const [classTeacherId, setClassTeacherId] = useState<string | null>(null)
  const [classTeacherName, setClassTeacherName] = useState<string>('')
  const [className, setClassName] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // Външни членове от изпращащото училище
  const [externals, setExternals] = useState<{ id: string; full_name: string }[]>([])
  const [newExternal, setNewExternal] = useState('')
  const [yearId, setYearId] = useState<string>('')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: s } = await supabase.from('students').select('*').eq('id', id).single()
    setStudent(s)

    const { data: allStaff } = await supabase
      .from('staff_profiles')
      .select('*')
      .eq('is_active', true)
      .order('last_name')
    setStaff(allStaff || [])

    const { data: year } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
    setYearId(year?.id || '')

    const { data: ext } = await supabase
      .from('eplr_external_members')
      .select('id, full_name')
      .eq('student_id', id)
      .eq('academic_year_id', year?.id)
      .order('created_at')
    setExternals(ext || [])

    const { data: existing } = await supabase
      .from('eplr_teams')
      .select('*')
      .eq('student_id', id)
      .eq('academic_year_id', year?.id)
      .maybeSingle()

    if (existing) {
      setEplr({
        psychologist_id: existing.psychologist_id || '',
        speech_therapist_id: existing.speech_therapist_id || '',
        rehabilitator_id: existing.rehabilitator_id || '',
      })
    }

    // Класният ръководител — от паралелката на ученика
    const { data: enrollment } = await supabase
      .from('student_enrollments')
      .select('class_id, class:classes(name)')
      .eq('student_id', id)
      .eq('academic_year_id', year?.id)
      .maybeSingle()

    if (enrollment?.class_id) {
      setClassName((enrollment.class as any)?.name || '')
      const { data: assignment } = await supabase
        .from('class_teacher_assignments')
        .select('staff_id, staff:staff_profiles(first_name, middle_name, last_name)')
        .eq('class_id', enrollment.class_id)
        .eq('academic_year_id', year?.id)
        .maybeSingle()

      if (assignment) {
        setClassTeacherId(assignment.staff_id)
        setClassTeacherName(assignment.staff ? getFullName(assignment.staff as any) : '')
      }
    }
  }

  async function addExternal() {
    const name = newExternal.trim()
    if (!name) return
    const { data, error } = await supabase.from('eplr_external_members').insert({
      student_id: id,
      academic_year_id: yearId,
      full_name: name,
    }).select('id, full_name').single()
    if (error) { toast(`Грешка: ${error.message}`, 'error'); return }
    setExternals(prev => [...prev, data])
    setNewExternal('')
  }

  async function removeExternal(extId: string) {
    await supabase.from('eplr_external_members').delete().eq('id', extId)
    setExternals(prev => prev.filter(e => e.id !== extId))
  }

  function staffByRole(role: UserRole) {
    return staff.filter(s => s.role === role)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data: year } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

    const payload = {
      student_id: id,
      academic_year_id: year?.id,
      psychologist_id: eplr.psychologist_id || null,
      speech_therapist_id: eplr.speech_therapist_id || null,
      rehabilitator_id: eplr.rehabilitator_id || null,
      // Класният винаги следва паралелката
      class_teacher_id: classTeacherId,
    }

    const { error } = await supabase
      .from('eplr_teams')
      .upsert(payload, { onConflict: 'student_id,academic_year_id' })

    if (error) { toast('Грешка при запис', 'error'); setSaving(false); return }

    toast('ЕПЛР екипът е запазен')
    router.push(`/students/${id}`)
  }

  const fields: { label: string; key: keyof typeof eplr; role: UserRole }[] = [
    { label: 'Психолог', key: 'psychologist_id', role: 'psychologist' },
    { label: 'Логопед', key: 'speech_therapist_id', role: 'speech_therapist' },
    { label: 'Рехабилитатор', key: 'rehabilitator_id', role: 'rehabilitator' },
  ]

  return (
    <div className="p-8 max-w-lg">
      <Link href={`/students/${id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад
      </Link>

      <h1 className="text-2xl font-semibold text-slate-800 mb-1">ЕПЛР екип</h1>
      {student && <p className="text-slate-500 text-sm mb-6">{getFullName(student)}</p>}

      <form onSubmit={handleSave} className="card space-y-4">
        {fields.map(({ label, key, role }) => {
          const options = staffByRole(role)
          return (
            <div key={key}>
              <label className="label">{label}</label>
              <select
                className="input"
                value={eplr[key]}
                onChange={e => setEplr(p => ({ ...p, [key]: e.target.value }))}
              >
                <option value="">— Не е назначен —</option>
                {options.map(s => (
                  <option key={s.id} value={s.id}>{getFullName(s)}</option>
                ))}
              </select>
              {options.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">Няма служители с роля "{label}"</p>
              )}
            </div>
          )
        })}

        {/* Класен ръководител — само за четене */}
        <div>
          <label className="label flex items-center gap-1.5">
            Класен ръководител
            <Lock size={11} className="text-slate-300" />
          </label>
          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600">
            {classTeacherName || <span className="text-slate-400">Няма назначен</span>}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {className
              ? `Следва класния на паралелка ${className}. Променя се от страницата на паралелката.`
              : 'Ученикът няма паралелка за текущата година.'}
          </p>
        </div>

        {/* Външни членове от изпращащото училище */}
        <div className="pt-2 border-t border-slate-100">
          <label className="label flex items-center gap-1.5">
            <School size={12} className="text-slate-400" />
            Членове от изпращащото училище
          </label>

          {externals.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {externals.map(ext => (
                <div key={ext.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="flex-1 text-sm text-slate-700">{ext.full_name}</span>
                  <button type="button" onClick={() => removeExternal(ext.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={newExternal}
              onChange={e => setNewExternal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExternal() } }}
              placeholder="Име, презиме, фамилия"
              className="input flex-1 text-sm"
            />
            <button type="button" onClick={addExternal} disabled={!newExternal.trim()}
              className="px-3 py-2 rounded-xl text-white text-xs font-medium flex items-center gap-1 disabled:opacity-40"
              style={{ backgroundColor: '#0f2240' }}>
              <Plus size={13} /> Добави
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Вписват се след получаване на заповедта от училището. Влизат в протоколите за подпис.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary" style={{ backgroundColor: '#0f2240' }}>
            {saving ? 'Запазване...' : 'Запази екипа'}
          </button>
          <Link href={`/students/${id}`} className="btn-secondary">Отказ</Link>
        </div>
      </form>
    </div>
  )
}
