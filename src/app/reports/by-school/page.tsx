import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { getFullName } from '@/lib/utils'
import BySchoolClient from './BySchoolClient'
export const dynamic = 'force-dynamic'

const R: Record<string, number> = { I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12,XIII:13 }
function classSort(ext: string): number {
  const t = (ext || '').trim().toUpperCase()
  const rm = t.match(/^(XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b/)
  if (rm) return R[rm[1]]
  const m = t.match(/\d+/); if (m) return parseInt(m[0])
  return 99
}

export default async function BySchoolReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')) redirect('/dashboard')
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  // ученици (активни) + училище + external_class
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, middle_name, last_name, external_class, sending_school:sending_schools(name)')
    .eq('status', 'active')

  // паралелка + класен по ученик
  const { data: enr } = await supabase
    .from('student_enrollments').select('student_id, class_id, class:classes(name)')
    .eq('academic_year_id', cy?.id)
  const classByStudent: Record<string, { name: string; classId: string }> = {}
  ;(enr || []).forEach((e: any) => { if (e.class?.name) classByStudent[e.student_id] = { name: e.class.name, classId: e.class_id } })

  const { data: cta } = await supabase
    .from('class_teacher_assignments').select('class_id, staff:staff_profiles(first_name, last_name, is_active)')
    .eq('academic_year_id', cy?.id)
  const teacherByClass: Record<string, string> = {}
  ;(cta || []).forEach((a: any) => { if (a.staff && a.staff.is_active !== false && !teacherByClass[a.class_id]) teacherByClass[a.class_id] = `${a.staff.first_name} ${a.staff.last_name}` })

  // групиране: училище -> external_class -> деца
  type Row = { school: string; externalClass: string; students: { name: string; className: string; classTeacher: string }[] }
  const map: Record<string, Row> = {}
  ;(students || []).forEach((s: any) => {
    const school = s.sending_school?.name
    if (!school) return
    const ext = s.external_class || '—'
    const key = `${school}||${ext}`
    if (!map[key]) map[key] = { school, externalClass: ext, students: [] }
    const cls = classByStudent[s.id]
    map[key].students.push({
      name: getFullName(s),
      className: cls?.name || '—',
      classTeacher: cls ? (teacherByClass[cls.classId] || '—') : '—',
    })
  })
  const groups = Object.values(map)
    .sort((a, b) => a.school.localeCompare(b.school, 'bg') || classSort(a.externalClass) - classSort(b.externalClass))
  groups.forEach(g => g.students.sort((a, b) => a.name.localeCompare(b.name, 'bg')))

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <BackButton />
      <div className="mb-6 mt-2">
        <h1 className="text-xl font-semibold text-slate-800">Ученици по изпращащи училища</h1>
        <p className="text-slate-500 text-sm mt-0.5">Групирани по училище и клас · {cy?.name}</p>
      </div>
      <BySchoolClient groups={groups} yearName={cy?.name || ''} />
    </div>
  )
}
