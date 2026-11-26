import type { RuoClass } from '@/lib/ruo-changes'

// Текущият състав на паралелките — същият източник като писмото „Списък на паралелките“
// (/reports/letters), но с id на детето, за да се сравнява надеждно.
export async function loadCurrentState(supabase: any, yearId: string): Promise<RuoClass[]> {
  const { data: enr } = await supabase.from('student_enrollments')
    .select('student:students(id, first_name, middle_name, last_name, external_class, status, sending_school:sending_schools(name, city)), class:classes(name)')
    .eq('academic_year_id', yearId)

  const byClass: Record<string, RuoClass> = {}
  ;(enr || []).forEach((e: any) => {
    const s = e.student
    const cls = e.class?.name
    if (!s || !cls || s.status === 'archived') return
    if (!byClass[cls]) byClass[cls] = { className: cls, students: [] }
    byClass[cls].students.push({
      id: s.id,
      name: `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`.replace(/\s+/g, ' ').trim(),
      school: s.sending_school ? `${s.sending_school.name} — ${s.sending_school.city}` : '',
      externalClass: s.external_class || '',
    })
  })
  return Object.values(byClass)
    .filter(c => c.students.length > 0)
    .sort((a, b) => a.className.localeCompare(b.className, 'bg', { numeric: true }))
    .map(c => ({ ...c, students: c.students.sort((a, b) => a.name.localeCompare(b.name, 'bg')) }))
}
