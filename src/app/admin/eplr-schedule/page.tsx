import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { getFullName } from '@/lib/utils'
import ScheduleClient from './ScheduleClient'

export const dynamic = 'force-dynamic'

export default async function EplrSchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role, is_coordinator').eq('user_id', user.id).single()

  const canEdit = ['admin', 'zdud', 'director'].includes(profile?.role || '') || profile?.is_coordinator === true

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  // Графици за годината
  const { data: schedules } = await supabase
    .from('eplr_schedules')
    .select('*')
    .eq('academic_year_id', currentYear?.id)
    .order('created_at', { ascending: false })

  // Паралелки
  const { data: classes } = await supabase
    .from('classes').select('id, name')
    .eq('academic_year_id', currentYear?.id)
    .order('name')

  // Ученици по паралелки
  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('class_id, student:students(id, first_name, middle_name, last_name, external_class, status)')
    .eq('academic_year_id', currentYear?.id)

  // ЕПЛР екипи — за проверка на конфликти
  const { data: teams } = await supabase
    .from('eplr_teams')
    .select('student_id, psychologist_id, speech_therapist_id, rehabilitator_id, class_teacher_id')
    .eq('academic_year_id', currentYear?.id)

  // Имена на специалистите
  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('id, first_name, middle_name, last_name, role')
    .eq('is_active', true)

  const staffMap: Record<string, string> = {}
  const staffShortMap: Record<string, string> = {}
  ;(staff || []).forEach((s: any) => {
    staffMap[s.id] = getFullName(s)
    staffShortMap[s.id] = `${s.first_name?.charAt(0)}. ${s.last_name}`
  })

  // Структура: паралелка → ученици
  const classData = (classes || []).map(c => ({
    id: c.id,
    name: c.name,
    students: (enrollments || [])
      .filter((e: any) => e.class_id === c.id && e.student?.status === 'active')
      .map((e: any) => ({
        id: e.student.id,
        name: getFullName(e.student),
        externalClass: e.student.external_class || '',
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg')),
  }))

  // Всички участници в срещата (за конфликти) — включително класният ръководител
  const specialistsByStudent: Record<string, string[]> = {}
  const teamByStudent: Record<string, { psy: string | null; log: string | null; reh: string | null; ct: string | null }> = {}
  ;(teams || []).forEach((t: any) => {
    const ids = [t.psychologist_id, t.speech_therapist_id, t.rehabilitator_id, t.class_teacher_id].filter(Boolean)
    specialistsByStudent[t.student_id] = ids
    teamByStudent[t.student_id] = {
      psy: t.psychologist_id || null,
      log: t.speech_therapist_id || null,
      reh: t.rehabilitator_id || null,
      ct: t.class_teacher_id || null,
    }
  })

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">График за заседания на ЕПЛР</h1>
        <p className="text-slate-500 text-sm mt-1">{currentYear?.name}</p>
      </div>

      <ScheduleClient
        schedules={schedules || []}
        classData={classData}
        specialistsByStudent={specialistsByStudent}
        teamByStudent={teamByStudent}
        staffMap={staffMap}
        staffShortMap={staffShortMap}
        academicYearId={currentYear?.id || ''}
        yearName={currentYear?.name || ''}
        staffId={profile?.id || ''}
        canEdit={canEdit}
      />
    </div>
  )
}
