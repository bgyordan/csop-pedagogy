'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
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
    class_teacher_id: '',
  })
  const [saving, setSaving] = useState(false)

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

    const { data: existing } = await supabase
      .from('eplr_teams')
      .select('*')
      .eq('student_id', id)
      .eq('academic_year_id', year?.id)
      .single()

    if (existing) {
      setEplr({
        psychologist_id: existing.psychologist_id || '',
        speech_therapist_id: existing.speech_therapist_id || '',
        rehabilitator_id: existing.rehabilitator_id || '',
        class_teacher_id: existing.class_teacher_id || '',
      })
    }
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
      class_teacher_id: eplr.class_teacher_id || null,
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
    { label: 'Класен ръководител', key: 'class_teacher_id', role: 'class_teacher' },
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
