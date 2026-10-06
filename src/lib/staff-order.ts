// Общ ред на служителите в таблиците за лекторски:
// класни ръководители (по паралелката им) → учители → логопеди → рехабилитатори → психолози → възпитатели → ръководство → други.

export const STAFF_GROUP_LABELS = ['Класни ръководители', 'Учители', 'Логопеди', 'Рехабилитатори', 'Психолози', 'Възпитатели', 'Ръководство', 'Други']

export function staffGroup(s: { role?: string | null; position?: string | null }, ownClass?: string) {
  const pos = (s.position || '').toLowerCase()
  const role = s.role || ''
  if (ownClass) return 0
  if (['admin', 'director', 'zdud'].includes(role)) return 6
  if (['class_teacher', 'teacher', 'coordinator'].includes(role)) return 1
  if (role === 'speech_therapist' || /логопед/.test(pos)) return 2
  if (role === 'rehabilitator' || /рехабилит/.test(pos)) return 3
  if (role === 'psychologist' || /психолог/.test(pos)) return 4
  if (role === 'educator' || /възпитател/.test(pos)) return 5
  return 7
}

/** staff_id → паралелката, на която е класен (при няколко — най-малкият номер) */
export async function loadOwnClasses(supabase: any, yearId: string | undefined) {
  const own: Record<string, string> = {}
  if (!yearId) return own
  const { data } = await supabase.from('class_teacher_assignments')
    .select('staff_id, class:classes(name)').eq('academic_year_id', yearId)
  ;(data || []).forEach((a: any) => {
    const name = a.class?.name
    if (!a.staff_id || !name) return
    const prev = own[a.staff_id]
    if (!prev || name.localeCompare(prev, 'bg', { numeric: true }) < 0) own[a.staff_id] = name
  })
  return own
}

export type Grouped = { group: number; groupLabel: string; ownClass: string; name: string }

export function groupFields(s: { id: string; role?: string | null; position?: string | null }, own: Record<string, string>) {
  const g = staffGroup(s, own[s.id])
  return { group: g, groupLabel: STAFF_GROUP_LABELS[g], ownClass: own[s.id] || '' }
}

export function byStaffGroup(a: Grouped, b: Grouped) {
  return a.group - b.group
    || (a.group === 0 ? a.ownClass.localeCompare(b.ownClass, 'bg', { numeric: true }) : 0)
    || a.name.localeCompare(b.name, 'bg')
}
