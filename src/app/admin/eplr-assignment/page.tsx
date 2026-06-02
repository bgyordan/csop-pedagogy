import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getFullName } from '@/lib/utils'
import { EplrAssignmentMatrix } from './EplrAssignmentMatrix'

export default async function EplrAssignmentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('role, is_coordinator').eq('user_id', user.id).single()

  const canAccess = ['admin', 'zdud', 'director'].includes(profile?.role || '') || profile?.is_coordinator === true
  if (!canAccess) redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  const { data: classes } = await supabase
    .from('classes').select('*').eq('academic_year_id', currentYear?.id).order('name')

  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('*, student:students(*), class:classes(*)')
    .eq('academic_year_id', currentYear?.id)

  const { data: eplrTeams } = await supabase
    .from('eplr_teams').select('*').eq('academic_year_id', currentYear?.id)

  const { data: classTeachers } = await supabase
    .from('class_teacher_assignments')
    .select('class_id, staff:staff_profiles(*)')
    .eq('academic_year_id', currentYear?.id)

  const { data: psychologists } = await supabase
    .from('staff_profiles').select('*').eq('role', 'psychologist').eq('is_active', true).order('first_name')

  const { data: speechTherapists } = await supabase
    .from('staff_profiles').select('*').eq('role', 'speech_therapist').eq('is_active', true).order('first_name')

  const { data: rehabilitators } = await supabase
    .from('staff_profiles').select('*').eq('role', 'rehabilitator').eq('is_active', true).order('first_name')

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Разпределение на ЕПЛР екипи</h1>
        <p className="text-slate-500 text-sm mt-1">{currentYear?.name}</p>
      </div>
      <EplrAssignmentMatrix
        classes={classes || []}
        enrollments={enrollments || []}
        eplrTeams={eplrTeams || []}
        classTeachers={classTeachers || []}
        psychologists={psychologists || []}
        speechTherapists={speechTherapists || []}
        rehabilitators={rehabilitators || []}
        currentYearId={currentYear?.id || ''}
      />
    </div>
  )
}
