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

// Времена на периодите в грида на специалиста (в минути от полунощ: [начало, край])
const THERAPIST_PERIOD_RANGE: Record<number, [number, number]> = {
  1: [8 * 60 + 30, 9 * 60 + 5],    // 8:30–9:05
  2: [9 * 60 + 15, 9 * 60 + 50],   // 9:15–9:50
  0: [9 * 60 + 50, 10 * 60 + 20],  // ГМ 9:50–10:20
  3: [10 * 60 + 20, 10 * 60 + 55], // 10:20–10:55
  4: [11 * 60 + 5, 11 * 60 + 40],  // 11:05–11:40
  5: [11 * 60 + 50, 12 * 60 + 25], // 11:50–12:25
  6: [12 * 60 + 35, 13 * 60 + 5],  // 12:35–13:05
  7: [13 * 60 + 15, 13 * 60 + 50], // 13:15–13:50
  8: [13 * 60 + 50, 14 * 60],      // 13:50–14:00
}
// Времена на ИФО часовете (следобедни) [начало, край]
const IFO_PERIOD_RANGE: Record<number, [number, number]> = {
  1: [12 * 60, 12 * 60 + 35],       // 12:00–12:35
  2: [12 * 60 + 30, 13 * 60 + 5],   // 12:30–13:05
  3: [13 * 60 + 10, 13 * 60 + 45],  // 13:10–13:45
  4: [13 * 60 + 20, 13 * 60 + 55],  // 13:20–13:55
  5: [13 * 60 + 40, 14 * 60 + 15],  // 13:40–14:15
  6: [13 * 60 + 50, 14 * 60 + 25],  // 13:50–14:25
  7: [14 * 60 + 30, 15 * 60 + 5],   // 14:30–15:05
  8: [15 * 60 + 10, 15 * 60 + 45],  // 15:10–15:45
}
// Две времеви отсечки застъпват ли се
function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1]
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
  const { data: allActive } = await supabase
    .from('students')
    .select('id, first_name, middle_name, last_name, external_class, therapist_psychologist_id, therapist_speech_id, therapist_rehab_id')
    .eq('status', 'active')
    .order('first_name')
  const myStudents = (allActive || []).filter((s: any) => s[field] === profile.id)
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
  // Разписанията на паралелките на моите деца (за текущия срок) — за дневна форма
  const classIds = [...new Set((enrollments || []).map((e: any) => e.class_id).filter(Boolean))]
  const { data: classSchedules } = classIds.length > 0
    ? await supabase
        .from('class_schedules')
        .select('id, class_id')
        .in('class_id', classIds)
        .eq('academic_year_id', currentYear?.id)
        .eq('term', term)
    : { data: [] }
  // Слотовете на паралелковите разписания
  const classScheduleIds = (classSchedules || []).map((s: any) => s.id)
  const { data: classSlotsRaw } = classScheduleIds.length > 0
    ? await supabase
        .from('schedule_slots')
        .select('schedule_id, day, period, subject:subjects(name, allows_pullout)')
        .in('schedule_id', classScheduleIds)
    : { data: [] }
  const slotsBySchedule: Record<string, Record<string, { name: string; allowsPullout: boolean }>> = {}
  ;(classSlotsRaw || []).forEach((s: any) => {
    if (!slotsBySchedule[s.schedule_id]) slotsBySchedule[s.schedule_id] = {}
    slotsBySchedule[s.schedule_id][`${s.day}-${s.period}`] = {
      name: s.subject?.name || '',
      allowsPullout: s.subject?.allows_pullout || false,
    }
  })
  const classSchedById: Record<string, string> = {}
  ;(classSchedules || []).forEach((s: any) => { classSchedById[s.class_id] = s.id })

  // ── ИФО часове (нова таблица teacher_ifo_slots, носител = ученик) ──
  const { data: ifoSlotsRaw } = studentIds.length > 0
    ? await supabase
        .from('teacher_ifo_slots')
        .select('student_id, day, period, subject:subjects(name, allows_pullout)')
        .in('student_id', studentIds)
        .eq('academic_year_id', currentYear?.id)
        .eq('term', term)
    : { data: [] }
  // Групираме ИФО часовете по дете
  const ifoByStudent: Record<string, { day: number; period: number; name: string; allowsPullout: boolean }[]> = {}
  ;(ifoSlotsRaw || []).forEach((s: any) => {
    if (!ifoByStudent[s.student_id]) ifoByStudent[s.student_id] = []
    ifoByStudent[s.student_id].push({
      day: s.day, period: s.period,
      name: s.subject?.name || '',
      allowsPullout: s.subject?.allows_pullout || false,
    })
  })

  // Строим "решетката на разписанието" за всяко дете, СПОРЕД периодите на грида на специалиста.
  // За дневна форма: директно от паралелковото разписание (същите периоди).
  // За ИФО форма: изчисляваме застъпване по ВРЕМЕ между ИФО часовете и периодите на специалиста.
  const studentSchedule: Record<string, Record<string, { name: string; allowsPullout: boolean }> | null> = {}
  ;(myStudents || []).forEach(s => {
    const info = classByStudent[s.id]
    if (info?.form === 'ifo') {
      const ifo = ifoByStudent[s.id]
      if (!ifo || ifo.length === 0) { studentSchedule[s.id] = null; return }
      const grid: Record<string, { name: string; allowsPullout: boolean }> = {}
      // За всеки ИФО час, намираме кои периоди на специалиста се застъпват по време
      ifo.forEach(h => {
        const ifoRange = IFO_PERIOD_RANGE[h.period]
        if (!ifoRange) return
        Object.entries(THERAPIST_PERIOD_RANGE).forEach(([per, range]) => {
          if (overlaps(ifoRange, range)) {
            grid[`${h.day}-${per}`] = { name: h.name, allowsPullout: h.allowsPullout }
          }
        })
      })
      studentSchedule[s.id] = grid
    } else if (info?.classId) {
      const schedId = classSchedById[info.classId]
      studentSchedule[s.id] = schedId ? (slotsBySchedule[schedId] || {}) : null
    } else {
      studentSchedule[s.id] = null
    }
  })

  // Заетост от ДРУГИ терапевти: кое дете, кой ден-час, от кого
  const { data: otherSlots } = studentIds.length > 0
    ? await supabase
        .from('therapist_slots')
        .select('student_id, day, period, schedule:therapist_schedules!inner(staff_id, term, academic_year_id, staff:staff_profiles(first_name, last_name))')
        .in('student_id', studentIds)
    : { data: [] }
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
    name: [s.first_name, s.middle_name ? s.middle_name.charAt(0) + '.' : '', s.last_name].filter(Boolean).join(' '),
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
        specialistName={`${profile.first_name} ${profile.last_name}`}
        roleLabel={ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] || ''}
        students={students}
        studentSchedule={studentSchedule}
        takenByOthers={takenByOthers}
        existingSlots={mySlots}
      />
    </div>
  )
}
