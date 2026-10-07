import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import MyScheduleEditor from './MyScheduleEditor'
import ScheduleTabs from '../ScheduleTabs'
import { loadPlanCards, STAFF_NORM } from '@/lib/curriculum'
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
  const isManager = ['admin', 'zdud', 'director'].includes(me.role || '')
  let target = me
  let viewingOther = false
  if (staffParam && staffParam !== me.id && isManager) {
    const { data: other } = await supabase
      .from('staff_profiles').select('id, first_name, last_name, role').eq('id', staffParam).single()
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
  const myClassesTabs = (allClasses || []).filter((c: any) => myClassTeacherIds.includes(c.id)) as { id: string; name: string }[]

  // само ИФО ученици (education_form='ifo' за текущата година)
  const { data: ifoEnroll } = await supabase
    .from('student_enrollments')
    .select('class_id, student:students(id, first_name, middle_name, last_name, status)')
    .eq('academic_year_id', currentYear?.id).eq('education_form', 'ifo')
  const studentOpts = (ifoEnroll || [])
    .filter((e: any) => e.student && e.student.status === 'active')
    .map((e: any) => ({ id: e.student.id, name: getFullName(e.student), classId: e.class_id as string | null }))

  // предмети
  const { data: subjects } = await supabase.from('subjects').select('id, name, allows_pullout').order('name')

  // часовете по учебния план от НЕИСПУО за срока — от тях се нарежда разписанието
  const plan = await loadPlanCards(supabase, currentYear?.id, targetId, term, subjects || [])
  // седмична норма по длъжност; управата е с годишна норма — тук не се показва
  const norm = STAFF_NORM[(target as any).role || ''] ?? null

  // моите съществуващи слотове (паралелки)
  const { data: mySchedules } = await supabase
    .from('class_schedules').select('id, class_id').eq('academic_year_id', currentYear?.id).eq('term', term)
  const schedClassById: Record<string, string> = {}
  ;(mySchedules || []).forEach((s: any) => { schedClassById[s.id] = s.class_id })
  const schedIds = (mySchedules || []).map((s: any) => s.id)
  let myClassSlots: any[] = []
  if (schedIds.length > 0) {
    const { data: slots } = await supabase
      .from('schedule_slots').select('schedule_id, day, period, subject_id, staff_id, is_group')
      .in('schedule_id', schedIds).eq('staff_id', targetId)
    myClassSlots = (slots || []).map((s: any) => ({
      day: s.day, period: s.period, holderType: 'class', holderId: schedClassById[s.schedule_id], subjectId: s.subject_id, group: !!s.is_group,
    }))
  }

  // заетите от ДРУГИ учители клетки във всяка паралелка → сиви в редактора (класният може да ги освободи)
  const taken: Record<string, Record<string, { by: string; subject: string }>> = {}
  if (schedIds.length > 0) {
    const { data: others } = await supabase
      .from('schedule_slots')
      .select('schedule_id, day, period, subject:subjects(name), staff:staff_profiles(first_name, last_name)')
      .in('schedule_id', schedIds).neq('staff_id', targetId)
    for (const o of (others || []) as any[]) {
      const cls = schedClassById[o.schedule_id]
      if (!cls) continue
      taken[cls] = taken[cls] || {}
      const k = `${o.day}-${o.period}`
      const by = o.staff ? `${o.staff.first_name} ${o.staff.last_name}` : 'друг учител'
      const prev = taken[cls][k]
      // при група в един час може да има няколко учители
      taken[cls][k] = prev
        ? { by: `${prev.by} / ${by}`, subject: [prev.subject, o.subject?.name].filter(Boolean).join(' / ') }
        : { by, subject: o.subject?.name || '' }
    }
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
      <div className="mb-5 flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}>
          <CalendarDays size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Разписание · редакция</h1>
          <p className="text-slate-500 text-sm mt-0.5">{target.first_name} {target.last_name} · {currentYear?.name}{viewingOther ? " · (от името на служителя)" : ""}</p>
        </div>
      </div>
      <ScheduleTabs current="mine" classes={myClassesTabs} staffId={viewingOther ? targetId : undefined} term={term}
        doneHref={`/my-schedule${[viewingOther ? `staff=${targetId}` : '', term === 2 ? 'term=2' : ''].filter(Boolean).join('&').replace(/^./, m => '?' + m)}`} />
      <MyScheduleEditor
        academicYearId={currentYear?.id || ''}
        term={term}
        classes={allClasses || []}
        students={studentOpts}
        subjects={subjects || []}
        initialSlots={[...myClassSlots, ...myIfoSlots]}
        myClassTeacherIds={myClassTeacherIds}
        targetStaffId={viewingOther ? targetId : undefined}
        taken={taken}
        plan={plan}
        norm={norm}
      />
    </div>
  )
}
