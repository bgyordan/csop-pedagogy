import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HeartPulse } from 'lucide-react'
import { ROLE_LABELS } from '@/types'
import MyActivitiesClient from './MyActivitiesClient'

export const dynamic = 'force-dynamic'

const ROLE_FIELD: Record<string, string> = {
  psychologist: 'therapist_psychologist_id',
  speech_therapist: 'therapist_speech_id',
  rehabilitator: 'therapist_rehab_id',
}

export default async function MyActivitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role, first_name, last_name').eq('user_id', user.id).single()
  if (!profile) redirect('/dashboard')

  const field = ROLE_FIELD[profile.role]

  // Само за терапевтичните роли
  if (!field) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <HeartPulse size={28} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 text-sm">
            Тази страница е за психолози, логопеди и рехабилитатори.
          </p>
        </div>
      </div>
    )
  }

  const { data: currentYear } = await supabase
    .from('academic_years').select('id, name').eq('is_current', true).single()

  // Всички активни ученици + кой ги води за моя вид терапия
  const { data: students } = await supabase
    .from('students')
    .select(`id, first_name, middle_name, last_name, external_class,
      psych:staff_profiles!students_therapist_psychologist_id_fkey(id, first_name, last_name),
      speech:staff_profiles!students_therapist_speech_id_fkey(id, first_name, last_name),
      rehab:staff_profiles!students_therapist_rehab_id_fkey(id, first_name, last_name)`)
    .eq('status', 'active')
    .order('first_name')

  // Класовете (за подредба/филтър)
  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('student_id, class:classes(name)')
    .eq('academic_year_id', currentYear?.id)

  const classByStudent: Record<string, string> = {}
  ;(enrollments || []).forEach((e: any) => {
    if (e.class?.name) classByStudent[e.student_id] = e.class.name
  })

  // Кое поле да гледам според моята роля
  const myKey = profile.role === 'psychologist' ? 'psych'
    : profile.role === 'speech_therapist' ? 'speech' : 'rehab'

  const rows = (students || []).map((s: any) => {
    const holder = s[myKey]
    return {
      id: s.id,
      name: [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' '),
      className: classByStudent[s.id] || '',
      externalClass: s.external_class || '',
      mine: holder?.id === profile.id,
      takenBy: holder && holder.id !== profile.id ? `${holder.first_name} ${holder.last_name}` : null,
    }
  })

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Списък за терапия</h1>
        <p className="text-slate-500 text-sm mt-1">
          {ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS]} · {currentYear?.name}
        </p>
      </div>

      <MyActivitiesClient rows={rows} roleLabel={ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] || ''} yearName={currentYear?.name || ''} term={1} />
    </div>
  )
}
