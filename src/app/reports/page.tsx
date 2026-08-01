import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReportsClient from './ReportsClient'
import { DOCUMENT_TYPE_LABELS, DocumentType } from '@/types'
import { getFullName } from '@/lib/utils'
import { BackButton } from '@/components/ui/BackButton'
const DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]
function initials(firstName?: string, lastName?: string): string {
  return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase()
}
const ROLE_LABELS_BG: Record<string, string> = {
  psychologist: 'Психолог',
  speech_therapist: 'Логопед',
  rehabilitator: 'Рехабилитатор',
}
export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles').select('role, is_coordinator').eq('user_id', user.id).single()
  const isSpecialist = ['psychologist', 'speech_therapist', 'rehabilitator'].includes(profile?.role || '')
  const isManager = ['admin', 'zdud', 'director'].includes(profile?.role || '') || profile?.is_coordinator === true
  const canAccess = isManager || isSpecialist
  if (!canAccess) redirect('/dashboard')
  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()
  const [
    { data: enrollments },
    { data: eplrTeams },
    { data: documents },
    { data: schools },
    { data: specialists },
    { data: classTeachers },
    { data: deadlines },
  ] = await Promise.all([
    supabase.from('student_enrollments')
      .select('*, student:students(*, sending_school:sending_schools(name,city)), class:classes(*)')
      .eq('academic_year_id', currentYear?.id),
    supabase.from('eplr_teams')
      .select('*, psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(id,first_name,last_name), speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(id,first_name,last_name), rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(id,first_name,last_name), class_teacher:staff_profiles!eplr_teams_class_teacher_id_fkey(id,first_name,last_name)')
      .eq('academic_year_id', currentYear?.id),
    supabase.from('documents').select('student_id, doc_type, status').eq('academic_year_id', currentYear?.id),
    supabase.from('sending_schools').select('*').eq('is_active', true).order('name'),
    supabase.from('staff_profiles').select('*').in('role', ['psychologist', 'speech_therapist', 'rehabilitator']).eq('is_active', true).order('first_name'),
    supabase.from('class_teacher_assignments').select('class_id, staff:staff_profiles(id,first_name,last_name)').eq('academic_year_id', currentYear?.id),
    supabase.from('calendar_deadlines').select('*').eq('academic_year_id', currentYear?.id).order('deadline_date'),
  ])
  const eplrMap = new Map((eplrTeams || []).map((t: any) => [t.student_id, t]))
  const docMap = new Map<string, Map<string, string>>()
  documents?.forEach(d => {
    if (!docMap.has(d.student_id)) docMap.set(d.student_id, new Map())
    docMap.get(d.student_id)!.set(d.doc_type, d.status)
  })
  const classTeacherMap = new Map<string, any>()
  classTeachers?.forEach((ct: any) => {
    if (ct.staff) classTeacherMap.set(ct.class_id, ct.staff)
  })
  // Графици за екипни срещи
  const { data: schedules } = await supabase
    .from('eplr_schedules')
    .select('id, name')
    .eq('academic_year_id', currentYear?.id)
    .order('created_at', { ascending: false })
  const { data: allSlots } = await supabase
    .from('eplr_schedule_slots')
    .select('schedule_id, student_id, meeting_date, meeting_time')
  const slotsBySchedule: Record<string, Record<string, { date: string; time: string }>> = {}
  ;(allSlots || []).forEach((s: any) => {
    if (!slotsBySchedule[s.schedule_id]) slotsBySchedule[s.schedule_id] = {}
    slotsBySchedule[s.schedule_id][s.student_id] = {
      date: s.meeting_date || '',
      time: s.meeting_time ? String(s.meeting_time).substring(0, 5) : '',
    }
  })
  // ── ТЕРАПЕВТИЧНА НАТОВАРЕНОСТ ──
  // Реалните терапевти на всяко дете (за workload по терапии)
  const specialistIds = (specialists || []).map((s: any) => s.id)
  // Броене на сесии от терапевтичните графици (текущ срок = 1)
  const { data: therSchedules } = await supabase
    .from('therapist_schedules')
    .select('id, staff_id')
    .eq('academic_year_id', currentYear?.id)
    .eq('term', 1)
  const schedByStaff: Record<string, string> = {}  // schedule_id -> staff_id
  ;(therSchedules || []).forEach((s: any) => { schedByStaff[s.id] = s.staff_id })
  const therScheduleIds = (therSchedules || []).map((s: any) => s.id)
  const { data: therSlots } = therScheduleIds.length > 0
    ? await supabase.from('therapist_slots')
        .select('schedule_id, student_id')
        .in('schedule_id', therScheduleIds)
    : { data: [] }
  // За всяко дете: staff_id -> брой сесии; и staff_id -> брой деца (за workload)
  const sessionsByStudentStaff: Record<string, Record<string, number>> = {}
  const studentsByStaff: Record<string, Set<string>> = {}
  ;(therSlots || []).forEach((slot: any) => {
    if (!slot.student_id) return
    const staffId = schedByStaff[slot.schedule_id]
    if (!staffId) return
    if (!sessionsByStudentStaff[slot.student_id]) sessionsByStudentStaff[slot.student_id] = {}
    sessionsByStudentStaff[slot.student_id][staffId] = (sessionsByStudentStaff[slot.student_id][staffId] || 0) + 1
    if (!studentsByStaff[staffId]) studentsByStaff[staffId] = new Set()
    studentsByStaff[staffId].add(slot.student_id)
  })
  // Инфо за специалистите (роля + инициали)
  const staffInfo: Record<string, { role: string; ini: string; name: string }> = {}
  ;(specialists || []).forEach((s: any) => {
    staffInfo[s.id] = { role: s.role, ini: initials(s.first_name, s.last_name), name: getFullName(s) }
  })

  const statusLabel = (status: string | undefined) => {
    if (status === 'completed') return 'Завършен'
    if (status === 'in_progress') return 'В процес'
    return 'Непопълнен'
  }
  const allRows = (enrollments || []).map((e: any) => {
    const student = e.student as any
    const cls = e.class as any
    const eplr = eplrMap.get(student?.id) as any
    const docs = docMap.get(student?.id) || new Map()
    const classTeacher = classTeacherMap.get(e.class_id)
    const sendingSchool = student?.sending_school
    return {
      studentId: student?.id,
      name: getFullName(student),
      className: cls?.name || '—',
      externalClass: student?.external_class || '',
      classId: e.class_id,
      sendingSchoolId: student?.sending_school_id || null,
      sendingSchoolName: sendingSchool ? `${sendingSchool.name} — ${sendingSchool.city}` : '—',
      psychologistId: eplr?.psychologist_id || null,
      psychologist: eplr?.psychologist ? getFullName(eplr.psychologist) : '—',
      speechTherapistId: eplr?.speech_therapist_id || null,
      speechTherapist: eplr?.speech_therapist ? getFullName(eplr.speech_therapist) : '—',
      rehabilitatorId: eplr?.rehabilitator_id || null,
      rehabilitator: eplr?.rehabilitator ? getFullName(eplr.rehabilitator) : '—',
      classTeacher: classTeacher ? getFullName(classTeacher) : '—',
      educationForm: e.education_form || 'daily',
      isNew: student?.is_new === true,
      p1: statusLabel(docs.get('protocol_1')),
      p2: statusLabel(docs.get('protocol_2')),
      p3: statusLabel(docs.get('protocol_3')),
      iup: statusLabel(docs.get('iup')),
      iuProgram: statusLabel(docs.get('iu_program')),
      supportPlan: statusLabel(docs.get('support_plan')),
      parentProgram: statusLabel(docs.get('parent_program')),
      docsCompleted: DOC_TYPES.filter(dt => docs.get(dt) === 'completed').length,
      docsTotal: DOC_TYPES.length,
      missingPsychologist: !eplr?.psychologist_id,
      missingSpeechTherapist: !eplr?.speech_therapist_id,
      missingRehabilitator: !eplr?.rehabilitator_id,
    }
  })
  // Натовареност по РЕАЛНИ ТЕРАПИИ (от графика): колко деца води + общо сесии седмично
  const workloadRows = (specialists || []).map((s: any) => {
    const myStudentSet = studentsByStaff[s.id] || new Set()
    // Общо сесии седмично = сбор от слотовете на този специалист
    let totalSessions = 0
    Object.values(sessionsByStudentStaff).forEach(byStaff => {
      totalSessions += (byStaff[s.id] || 0)
    })
    return {
      id: s.id,
      name: getFullName(s),
      role: ROLE_LABELS_BG[s.role] || s.role,
      studentCount: myStudentSet.size,
      totalSessions,
    }
  })
  // ── Данни за справка "терапевтична натовареност" (по паралелки) ──
  const intensityRows = (enrollments || [])
    .filter((e: any) => e.student?.status === 'active')
    .map((e: any) => {
      const student = e.student as any
      const cls = e.class as any
      const sessions = sessionsByStudentStaff[student.id] || {}
      // Разпределяме по роля П/Л/Р, като струпваме "ИН×брой"
      const cellFor = (role: string) => {
        const parts: string[] = []
        Object.entries(sessions).forEach(([staffId, count]) => {
          const info = staffInfo[staffId]
          if (info && info.role === role) parts.push(`${info.ini}×${count}`)
        })
        return parts.join(', ')
      }
      return {
        studentId: student.id,
        name: getFullName(student),
        className: cls?.name || '—',
        externalClass: student.external_class || '',
        sendingSchoolName: student.sending_school ? `${student.sending_school.name} — ${student.sending_school.city}` : '—',
        intensity: student.intensity || '',
        psy: cellFor('psychologist'),
        log: cellFor('speech_therapist'),
        reh: cellFor('rehabilitator'),
      }
    })
    .sort((a: any, b: any) => {
      const c = a.className.localeCompare(b.className, 'bg', { numeric: true })
      if (c !== 0) return c
      return a.name.localeCompare(b.name, 'bg')
    })

  const now = new Date()
  const soonDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const delayedRows: any[] = []
  deadlines?.forEach((deadline: any) => {
    const deadlineDate = new Date(deadline.deadline_date)
    if (deadlineDate > soonDate) return
    const daysOverdue = Math.floor((now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24))
    const docType = deadline.doc_type as DocumentType | undefined
    if (!docType) return
    allRows.forEach(row => {
      const statusMap: Record<string, string> = {
        protocol_1: row.p1, protocol_2: row.p2, protocol_3: row.p3,
        iup: row.iup, iu_program: row.iuProgram, support_plan: row.supportPlan, parent_program: row.parentProgram,
      }
      const status = statusMap[docType]
      if (status === 'Завършен') return
      let specialist = row.classTeacher
      if (docType === 'support_plan') {
        specialist = row.psychologist !== '—' ? row.psychologist : row.speechTherapist
      }
      delayedRows.push({
        docType: DOCUMENT_TYPE_LABELS[docType],
        studentName: row.name,
        className: row.className,
        specialist,
        deadlineDate: deadline.deadline_date,
        daysOverdue: Math.max(0, daysOverdue),
        status,
        isOverdue: deadlineDate < now,
      })
    })
  })
  return (
    <div className="p-4 md:p-8">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Справки</h1>
        <p className="text-slate-500 text-sm mt-1">{currentYear?.name}</p>
      </div>
      <ReportsClient
        schedules={schedules || []}
        slotsBySchedule={slotsBySchedule}
        allRows={allRows}
        workloadRows={workloadRows}
        intensityRows={intensityRows}
        delayedRows={delayedRows}
        schools={schools || []}
        specialists={(specialists || []).map((s: any) => ({
          id: s.id,
          name: getFullName(s),
          role: ROLE_LABELS_BG[s.role] || s.role,
        }))}
        yearName={currentYear?.name || ''}
        limitedView={isSpecialist && !isManager}
      />
    </div>
  )
}
