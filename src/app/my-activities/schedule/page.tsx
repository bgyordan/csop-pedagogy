import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ROLE_LABELS } from '@/types'
import { TherapistScheduleGrid } from './TherapistScheduleGrid'

export const dynamic = 'force-dynamic'

const ROLE_FIELD: Record<string, string> = {
  psychologist: 'therapist_psychologist_id',
  speech_therapist: 'therapist_speech_id',
  rehabilitator: 'therapist_rehab_id',
}

export default async function TherapistSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>
}) {
  const { term: termParam } = await searchParams
  const term = termParam === '2' ? 2 : 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role, first_name, last_name').eq('user_id', user.id).single()
  if (!profile) redirect('/dashboard')

  const field = ROLE_FIELD[profile.role]
  if (!field) redirect('/dashboard')  // само терапевтични роли

  const { data: currentYear } = await supabase
    .from('academic_years').select('id, name').eq('is_current', true).single()

  // Моите зачислени деца (за моя вид терапия)
  const { data: myStudents } = await supabase
    .from('students')
    .select('id, first_name, middle_name, last_name, external_class, education_form')
    .eq('status', 'active')
    .eq(field, profile.id)
    .order('first_name')

  const studentIds = (myStudents || []).map(s => s.id)

  // Записванията им (за да намерим паралелката на всяко → нейното разписание)
  const { data: enrollments } = studentIds.length > 0
    ? await supabase
        .from('student_enrollments')
        .select('student_id, class_id, education_form, class:classes(name)')
        .in('student_id', studentIds)
        .eq('academic_year_id', currentYear?.id)
    : { data: [] }

  const classByStudent: Record<string, { classId: string | null; className: string; form: string }> = {}
  ;(enrollments || []).forEach((e: any) => {
    classByStudent[e.student_id] = {
      classId: e.class_id,
      className: e.class?.name || '',
      form: e.education_form || 'daily',
    }
  })

  // Разписанията на паралелките на моите деца (за текущия срок)
  const classIds = [...new Set((enrollments || []).map((e: any) => e.class_id).filter(Boolean))]
  const { data: classSchedules } = classIds.length > 0
    ? await supabase
        .from('class_schedules')
        .select('id, class_id')
        .in('class_id', classIds)
        .eq('academic_year_id', currentYear?.id)
        .eq('term', term)
    : { data: [] }

  // ИФО разписания (носител = ученик)
  const { data: ifoSchedules } = studentIds.length > 0
    ? await supabase
        .from('class_schedules')
        .select('id, student_id')
        .in('student_id', studentIds)
        .eq('academic_year_id', currentYear?.id)
        .eq('term', term)
    : { data: [] }

  // Всички слотове на тези разписания + флаг дали предметът позволява вземане
  const scheduleIds = [
    ...(classSchedules || []).map((s: any) => s.id),
    ...(ifoSchedules || []).map((s: any) => s.id),
  ]
  const { data: allSlots } = scheduleIds.length > 0
    ? await supabase
        .from('schedule_slots')
        .select('schedule_id, day, period, subject:subjects(name, allows_pullout)')
        .in('schedule_id', scheduleIds)
    : { data: [] }

  // Карта: за всяко разписание → { "ден-час": {name, allows_pullout} }
  const slotsBySchedule: Record<string, Record<string, { name: string; allowsPullout: boolean }>> = {}
  ;(allSlots || []).forEach((s: any) => {
    if (!slotsBySchedule[s.schedule_id]) slotsBySchedule[s.schedule_id] = {}
    slotsBySchedule[s.schedule_id][`${s.day}-${s.period}`] = {
      name: s.subject?.name || '',
      allowsPullout: s.subject?.allows_pullout || false,
    }
  })

  // Свързваме: за всяко дете → неговата "решетка на разписанието"
  const classSchedById: Record<string, string> = {}
  ;(classSchedules || []).forEach((s: any) => { classSchedById[s.class_id] = s.id })
  const ifoSchedById: Record<string, string> = {}
  ;(ifoSchedules || []).forEach((s: any) => { ifoSchedById[s.student_id] = s.id })

  const studentSchedule: Record<string, Record<string, { name: string; allowsPullout: boolean }> | null> = {}
  ;(myStudents || []).forEach(s => {
    const info = classByStudent[s.id]
    let schedId: string | undefined
    if (info?.form === 'ifo') schedId = ifoSchedById[s.id]
    else if (info?.classId) schedId = classSchedById[info.classId]
    studentSchedule[s.id] = schedId ? (slotsBySchedule[schedId] || {}) : null
  })

  // Заетост от ДРУГИ терапевти: кое дете, кой ден-час, от кого
  const { data: otherSlots } = studentIds.length > 0
    ? await supabase
        .from('therapist_slots')
        .select('student_id, day, period, schedule:therapist_schedules!inner(staff_id, term, academic_year_id, staff:staff_profiles(first_name, last_name))')
        .in('student_id', studentIds)
    : { data: [] }

  // Филтрираме за текущия срок+година и чужди графици
  const takenByOthers: Record<string, string> = {}  // "studentId-day-period" → име на терапевт
  ;(otherSlots || []).forEach((s: any) => {
    const sch = s.schedule
    if (!sch) return
    if (sch.term !== term || sch.academic_year_id !== currentYear?.id) return
    if (sch.staff_id === profile.id) return  // моите не са колизия
    takenByOthers[`${s.student_id}-${s.day}-${s.period}`] =
      sch.staff ? `${sch.staff.first_name} ${sch.staff.last_name}` : 'друг терапевт'
  })

  // Моят съществуващ график за този срок
  const { data: mySchedule } = await supabase
    .from('therapist_schedules').select('id')
    .eq('staff_id', profile.id).eq('academic_year_id', currentYear?.id).eq('term', term)
    .maybeSingle()

  let mySlots: any[] = []
  if (mySchedule) {
    const { data } = await supabase
      .from('therapist_slots').select('day, period, student_id').eq('schedule_id', mySchedule.id)
    mySlots = data || []
  }

  const students = (myStudents || []).map(s => ({
    id: s.id,
    name: [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' '),
    className: classByStudent[s.id]?.className || '',
    form: classByStudent[s.id]?.form || 'daily',
  }))

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <Link href="/my-activities" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} /> Назад към моите дейности
      </Link>

      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Моят седмичен график</h1>
        <p className="text-slate-500 text-sm mt-1">
          {profile.first_name} {profile.last_name} · {ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS]} · {currentYear?.name}
        </p>
      </div>

      <TherapistScheduleGrid
        academicYearId={currentYear?.id || ''}
        term={term}
        students={students}
        studentSchedule={studentSchedule}
        takenByOthers={takenByOthers}
        existingSlots={mySlots}
      />
    </div>
  )
}
