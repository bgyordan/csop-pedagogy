import { getFullName } from '@/lib/utils'

// Учениците на един служител за учебната година: като класен ръководител, по ЕПЛР (терапевтите) и в ЦОУД.
// Ползва се от профила на служителя (/staff/[id]) и от „Моят профил“ (/profile).
export type StaffStudent = { id: string; first_name: string; middle_name?: string | null; last_name: string; status?: string }
export type StaffStudents = {
  classes: { assignmentId: string; classId: string; name: string }[]
  classStudents: { student: StaffStudent; className: string }[]
  eplrStudents: StaffStudent[]
  coudGroups: { id: string; name: string }[]
  coudStudents: { student: StaffStudent; groupId: string }[]
}

const EPLR_FIELD: Record<string, string> = {
  psychologist: 'psychologist_id',
  speech_therapist: 'speech_therapist_id',
  rehabilitator: 'rehabilitator_id',
}

const byName = (a: StaffStudent, b: StaffStudent) => getFullName(a).localeCompare(getFullName(b), 'bg')

/** role — основната роля; therapyRole — втора, терапевтична роля (напр. ЗДУД + логопед). */
export async function loadStaffStudents(supabase: any, staffId: string, role: string, yearId: string | undefined, therapyRole?: string | null): Promise<StaffStudents> {
  const empty: StaffStudents = { classes: [], classStudents: [], eplrStudents: [], coudGroups: [], coudStudents: [] }
  if (!yearId) return empty

  const field = EPLR_FIELD[role] || (therapyRole ? EPLR_FIELD[therapyRole] : undefined)
  const [{ data: myClasses }, { data: eplr }, { data: coud }] = await Promise.all([
    supabase.from('class_teacher_assignments').select('id, class:classes(id, name)').eq('staff_id', staffId).eq('academic_year_id', yearId),
    field
      ? supabase.from('eplr_teams').select('student:students(id, first_name, middle_name, last_name, status)').eq(field, staffId).eq('academic_year_id', yearId)
      : Promise.resolve({ data: [] }),
    supabase.from('coud_groups').select('id, name').eq('teacher_id', staffId).eq('academic_year_id', yearId),
  ])

  const classes = ((myClasses || []) as any[])
    .map(c => ({ assignmentId: c.id, classId: c.class?.id, name: c.class?.name || '—' }))
    .filter(c => c.classId)
    .sort((a, b) => a.name.localeCompare(b.name, 'bg', { numeric: true }))
  const coudGroups = ((coud || []) as any[]).map(g => ({ id: g.id, name: g.name }))

  const [{ data: enr }, { data: coudEnr }] = await Promise.all([
    classes.length
      ? supabase.from('student_enrollments').select('class_id, student:students(id, first_name, middle_name, last_name, status), class:classes(name)')
          .in('class_id', classes.map(c => c.classId)).eq('academic_year_id', yearId)
      : Promise.resolve({ data: [] }),
    coudGroups.length
      ? supabase.from('coud_enrollments').select('coud_group_id, student:students(id, first_name, middle_name, last_name, status)')
          .in('coud_group_id', coudGroups.map(g => g.id)).eq('academic_year_id', yearId)
      : Promise.resolve({ data: [] }),
  ])

  const seen = new Set<string>()
  const eplrStudents = ((eplr || []) as any[])
    .map(t => t.student as StaffStudent)
    .filter(s => s && s.status === 'active' && !seen.has(s.id) && seen.add(s.id))
    .sort(byName)

  return {
    classes,
    classStudents: ((enr || []) as any[])
      .filter(e => e.student?.status === 'active')
      .map(e => ({ student: e.student as StaffStudent, className: e.class?.name || '' }))
      .sort((a, b) => byName(a.student, b.student)),
    eplrStudents,
    coudGroups,
    coudStudents: ((coudEnr || []) as any[])
      .filter(e => e.student?.status === 'active')
      .map(e => ({ student: e.student as StaffStudent, groupId: e.coud_group_id }))
      .sort((a, b) => byName(a.student, b.student)),
  }
}

/** Брой различни ученици във всички списъци */
export function uniqueStudentCount(s: StaffStudents) {
  const ids = new Set<string>()
  s.classStudents.forEach(e => ids.add(e.student.id))
  s.eplrStudents.forEach(e => ids.add(e.id))
  s.coudStudents.forEach(e => ids.add(e.student.id))
  return ids.size
}
