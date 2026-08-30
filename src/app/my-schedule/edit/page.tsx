import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { CalendarDays } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import MyScheduleEditor from './MyScheduleEditor'
export const dynamic = 'force-dynamic'

export default async function MyScheduleEditPage({
  searchParams,
}: { searchParams: Promise<{ term?: string; staff?: string }> }) {
  const { term: termParam, staff: staffParam } = await searchParams
  const term = termParam === '2' ? 2 : 1
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase
    .from('staff_profiles').select('id, first_name, last_name, role').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const isManager = ['admin', 'zdud'].includes(me.role || '')
  let target = me
  let viewingOther = false
  if (staffParam && staffParam !== me.id && isManager) {
    const { data: other } = await supabase
      .from('staff_profiles').select('id, first_name, last_name').eq('id', staffParam).single()
    if (other) { target = other as any; viewingOther = true }
  }
  const targetId = target.id

  const { data: currentYear } = await supabase
    .from('academic_years').select('id, name').eq('is_current', true).single()

  // всички паралелки (за да може учителят да избере на кои преподава)
  const { data: allClasses } = await supabase
    .from('classes').select('id, name').eq('academic_year_id', currentYear?.id).order('name')

  // моите паралелки като класен (за автоматично добавяне + подразбиране)
  const { data: myCta } = await supabase
    .from('class_teacher_assignments').select('class_id')
    .eq('staff_id', targetId).eq('academic_year_id', currentYear?.id)
  const myClassTeacherIds = (myCta || []).map((a: any) => a.class_id)

  // само ИФО ученици (education_form='ifo' за текущата година)
  const { data: ifoEnroll } = await supabase
    .from('student_enrollments')
    .select('student:students(id, first_name, middle_name, last_name, status)')
    .eq('academic_year_id', currentYear?.id).eq('education_form', 'ifo')
  const studentOpts = (ifoEnroll || [])
    .map((e: any) => e.student)
    .filter((s: any) => s && s.status === 'active')
    .map((s: any) => ({ id: s.id, name: getFullName(s) }))

  // предмети
  const { data: subjects } = await supabase.from('subjects').select('id, name, allows_pullout').order('name')

  // моите съществуващи слотове (паралелки)
  const { data: mySchedules } = await supabase
    .from('class_schedules').select('id, class_id').eq('academic_year_id', currentYear?.id).eq('term', term)
  const schedClassById: Record<string, string> = {}
  ;(mySchedules || []).forEach((s: any) => { schedClassById[s.id] = s.class_id })
  const schedIds = (mySchedules || []).map((s: any) => s.id)
  let myClassSlots: any[] = []
  if (schedIds.length > 0) {
    const { data: slots } = await supabase
      .from('schedule_slots').select('schedule_id, day, period, subject_id, staff_id')
      .in('schedule_id', schedIds).eq('staff_id', targetId)
    myClassSlots = (slots || []).map((s: any) => ({
      day: s.day, period: s.period, holderType: 'class', holderId: schedClassById[s.schedule_id], subjectId: s.subject_id,
    }))
  }

  // моите ИФО слотове
  const { data: myIfo } = await supabase
    .from('teacher_ifo_slots').select('day, period, student_id, subject_id')
    .eq('teacher_id', targetId).eq('academic_year_id', currentYear?.id).eq('term', term)
  const myIfoSlots = (myIfo || []).map((s: any) => ({
    day: s.day, period: s.period, holderType: 'ifo', holderId: s.student_id, subjectId: s.subject_id,
  }))

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <div className="mb-6 flex items-center gap-3 mt-2">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}>
          <CalendarDays size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Въвеждане на разписание</h1>
          <p className="text-slate-500 text-sm mt-0.5">{target.first_name} {target.last_name} · {currentYear?.name}{viewingOther ? " · (от името на служителя)" : ""}</p>
        </div>
      </div>
      <MyScheduleEditor
        academicYearId={currentYear?.id || ''}
        term={term}
        classes={allClasses || []}
        students={studentOpts}
        subjects={subjects || []}
        initialSlots={[...myClassSlots, ...myIfoSlots]}
        myClassTeacherIds={myClassTeacherIds}
        targetStaffId={viewingOther ? targetId : undefined}
      />
    </div>
  )
}
