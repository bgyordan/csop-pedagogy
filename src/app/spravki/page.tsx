import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SpravkiClient from './SpravkiClient'
import { getFullName } from '@/lib/utils'
import { BackButton } from '@/components/ui/BackButton'
import { Users } from 'lucide-react'
export const dynamic = 'force-dynamic'
const ROLE_LABELS_BG: Record<string, string> = {
  psychologist: 'Психолог',
  speech_therapist: 'Логопед',
  rehabilitator: 'Рехабилитатор',
}
export default async function SpravkiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()
  const [
    { data: enrollments },
    { data: eplrTeams },
    { data: specialists },
    { data: classTeachers },
  ] = await Promise.all([
    supabase.from('student_enrollments')
      .select('*, student:students(*, sending_school:sending_schools(name,city)), class:classes(*)')
      .eq('academic_year_id', currentYear?.id),
    supabase.from('eplr_teams')
      .select('*, psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(id,first_name,last_name), speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(id,first_name,last_name), rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(id,first_name,last_name)')
      .eq('academic_year_id', currentYear?.id),
    supabase.from('staff_profiles').select('*').in('role', ['psychologist', 'speech_therapist', 'rehabilitator']).eq('is_active', true).order('first_name'),
    supabase.from('class_teacher_assignments').select('class_id, staff:staff_profiles(id,first_name,last_name)').eq('academic_year_id', currentYear?.id),
  ])
  const eplrMap = new Map((eplrTeams || []).map((t: any) => [t.student_id, t]))
  const classTeacherMap = new Map<string, any>()
  ;(classTeachers || []).forEach((ct: any) => {
    if (ct.staff) classTeacherMap.set(ct.class_id, ct.staff)
  })
  const allRows = (enrollments || []).map((e: any) => {
    const student = e.student as any
    const cls = e.class as any
    const eplr = eplrMap.get(student?.id) as any
    const sendingSchool = student?.sending_school
    const classTeacher = classTeacherMap.get(e.class_id)
    return {
      studentId: student?.id,
      name: getFullName(student),
      className: cls?.name || '—',
      externalClass: student?.external_class || '',
      classTeacher: classTeacher ? getFullName(classTeacher) : '—',
      sendingSchoolId: student?.sending_school_id || null,
      sendingSchoolName: sendingSchool ? `${sendingSchool.name} — ${sendingSchool.city}` : '—',
      psychologistId: eplr?.psychologist_id || null,
      psychologist: eplr?.psychologist ? getFullName(eplr.psychologist) : '—',
      speechTherapistId: eplr?.speech_therapist_id || null,
      speechTherapist: eplr?.speech_therapist ? getFullName(eplr.speech_therapist) : '—',
      rehabilitatorId: eplr?.rehabilitator_id || null,
      rehabilitator: eplr?.rehabilitator ? getFullName(eplr.rehabilitator) : '—',
      educationForm: e.education_form || 'daily',
      isNew: student?.is_new === true,
    }
  })
  return (
    <div className="p-4 md:p-8">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
          <Users size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">Справки</h1>
          <p className="text-sm text-slate-500 mt-0.5">Разпределение на учениците · {currentYear?.name}</p>
        </div>
      </header>
      <SpravkiClient
        allRows={allRows}
        specialists={(specialists || []).map((s: any) => ({
          id: s.id, name: getFullName(s), role: ROLE_LABELS_BG[s.role] || s.role,
        }))}
        yearName={currentYear?.name || ''}
      />
    </div>
  )
}
