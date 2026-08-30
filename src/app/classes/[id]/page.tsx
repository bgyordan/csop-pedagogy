import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/BackButton'
import { getFullName } from '@/lib/utils'
import { Users, Coffee } from 'lucide-react'
import ClassTeachersSection from './ClassTeachersSection'
import AddStudentsSection from './AddStudentsSection'
import ClassScheduleWord from './ClassScheduleWord'
export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()
  const { data: cls } = await supabase
    .from('classes').select('*').eq('id', id).single()
  if (!cls) notFound()
  const [{ data: enrollments }, { data: assignments }, { data: myProfile }, { data: allStaff }] = await Promise.all([
    supabase.from('student_enrollments').select('*, student:students(*, sending_school:sending_schools(name, city))').eq('class_id', id).eq('academic_year_id', currentYear?.id),
    supabase.from('class_teacher_assignments').select('id, staff_id, staff:staff_profiles(id, first_name, middle_name, last_name, is_active)').eq('class_id', id).eq('academic_year_id', currentYear?.id),
    supabase.from('staff_profiles').select('role, is_coordinator').eq('user_id', user.id).single(),
    supabase.from('staff_profiles').select('id, first_name, middle_name, last_name').eq('is_active', true).order('first_name'),
  ])
  const students = enrollments?.map(e => e.student).filter((s: any) => s && s.status === 'active') || []
  const canManageTeachers = ['admin', 'zdud'].includes(myProfile?.role || '')
  const canManageStudents = ['admin', 'zdud'].includes(myProfile?.role || '') || myProfile?.is_coordinator === true
  const teacherList = (assignments || [])
    .filter((a: any) => a.staff && a.staff.is_active !== false)
    .map((a: any) => ({
      assignmentId: a.id,
      id: a.staff?.id || a.staff_id,
      name: a.staff ? getFullName(a.staff) : '—',
    }))
  const teachers = teacherList.map(t => t.name)
  const staffOptions = (allStaff || []).map((s: any) => ({ id: s.id, name: getFullName(s) }))
  let unassignedList: { id: string; name: string; isNew: boolean }[] = []
  if (canManageStudents) {
    const { data: allEnrolled } = await supabase
      .from('student_enrollments').select('student_id').eq('academic_year_id', currentYear?.id)
    const enrolledIds = new Set((allEnrolled || []).map(e => e.student_id))
    const { data: allActive } = await supabase
      .from('students').select('id, first_name, middle_name, last_name, is_new').eq('status', 'active')
    unassignedList = (allActive || [])
      .filter((s: any) => !enrolledIds.has(s.id))
      .map((s: any) => ({ id: s.id, name: getFullName(s), isNew: !!s.is_new }))
      .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
  }
  // ── ЦДО (ЦОУД) данни за учениците в тази паралелка ──
  const studentIds = students.map((s: any) => s.id)
  const coudMap = new Map<string, { group: string; teacher: string }>()
  if (studentIds.length > 0) {
    const { data: coudEnr } = await supabase
      .from('coud_enrollments')
      .select('student_id, coud_group:coud_groups(name, teacher:staff_profiles(first_name, last_name))')
      .eq('academic_year_id', currentYear?.id)
      .in('student_id', studentIds)
    ;(coudEnr || []).forEach((e: any) => {
      const g = e.coud_group
      if (g) {
        const t = g.teacher ? `${g.teacher.first_name} ${g.teacher.last_name}` : ''
        coudMap.set(e.student_id, { group: g.name, teacher: t })
      }
    })
  }
  // ── Разписание на паралелката (I срок, всички учители) за Word ──
  const scheduleTerm = 1
  const { data: classSched } = await supabase
    .from('class_schedules').select('id')
    .eq('class_id', id).eq('academic_year_id', currentYear?.id).eq('term', scheduleTerm).maybeSingle()
  const scheduleSlots: Record<string, string> = {}
  let scheduleMaxPeriod = 6
  if (classSched) {
    const { data: slots } = await supabase
      .from('schedule_slots').select('day, period, subject:subjects(name)')
      .eq('schedule_id', classSched.id)
    ;(slots || []).forEach((sl: any) => {
      if (sl.subject?.name) scheduleSlots[`${sl.day}-${sl.period}`] = sl.subject.name
      if (sl.period === 7) scheduleMaxPeriod = 7
    })
  }
  return (
    <div className="p-4 md:p-8">
      <BackButton />
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Паралелка {cls.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <p className="text-slate-500 text-sm">{students.length} ученика · {currentYear?.name}</p>
              {teachers.length > 0 && (
                <p className="text-slate-500 text-sm">Класен: <strong className="text-slate-700">{teachers.join(', ')}</strong></p>
              )}
            </div>
          </div>
          <ClassScheduleWord className={cls.name} yearName={currentYear?.name || ''} slots={scheduleSlots} maxPeriod={scheduleMaxPeriod} term={scheduleTerm} />
        </div>
      </div>
      <ClassTeachersSection
        classId={id}
        academicYearId={currentYear?.id || ''}
        teachers={teacherList}
        options={staffOptions}
        canManage={canManageTeachers}
      />
      <AddStudentsSection
        classId={id}
        className={cls.name}
        academicYearId={currentYear?.id || ''}
        unassigned={unassignedList}
        canManage={canManageStudents}
      />
      {/* ДЕСКТОП: таблица — Име · Училище · Клас · ЦДО */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50/70 border-b border-slate-200">
              <tr className="[&>th]:border-r [&>th]:border-slate-100 [&>th:last-child]:border-r-0">
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ученик</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Изпращащо училище</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Клас</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">ЦДО</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student: any, idx: number) => {
                const school = student.sending_school
                const schoolName = school ? `${school.name} — ${school.city}` : (student.sending_school_other || '—')
                const coud = coudMap.get(student.id)
                return (
                  <tr key={student.id}
                      className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors [&>td]:border-r [&>td]:border-slate-100 [&>td:last-child]:border-r-0 ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                    <td className="px-4 py-2.5">
                      <Link href={`/students/${student.id}`} className="font-medium text-slate-800 hover:text-blue-700 hover:underline transition-colors">
                        {getFullName(student)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{schoolName}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{student.external_class || '—'}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {coud ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Coffee size={13} className="text-orange-400 flex-shrink-0" />
                          <span className="text-slate-700 font-medium">{coud.group}</span>
                          {coud.teacher && <span className="text-slate-400">· {coud.teacher}</span>}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!students.length && <div className="text-center py-12 text-slate-400 text-sm">Няма ученици</div>}
      </div>
      {/* МОБИЛЕН: карти */}
      <div className="md:hidden space-y-2">
        {!students.length && <div className="text-center py-12 text-slate-400 text-sm">Няма ученици</div>}
        {students.map((student: any) => {
          const school = student.sending_school
          const schoolName = school ? `${school.name} — ${school.city}` : (student.sending_school_other || '—')
          const coud = coudMap.get(student.id)
          return (
            <Link key={student.id} href={`/students/${student.id}`}
              className="block bg-white rounded-xl border border-slate-200 p-3.5 hover:shadow-sm transition-shadow">
              <div className="font-medium text-slate-800 text-sm">{getFullName(student)}</div>
              <div className="mt-1.5 space-y-1 text-xs text-slate-500">
                <div className="flex items-center gap-1.5"><Users size={12} className="text-slate-400" />{schoolName}{student.external_class ? ` · ${student.external_class} клас` : ''}</div>
                {coud && (
                  <div className="flex items-center gap-1.5">
                    <Coffee size={12} className="text-orange-400" />
                    <span className="text-slate-600 font-medium">{coud.group}</span>
                    {coud.teacher && <span className="text-slate-400">· {coud.teacher}</span>}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
