import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { getFullName } from '@/lib/utils'
import BySchoolClient, { type StudentRow } from './BySchoolClient'
export const dynamic = 'force-dynamic'

const R: Record<string, number> = { I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12,XIII:13 }
// "IV", "4", "4 а", "ПГ" -> число за подреждане (ПГ = 0, непознато = 99)
function gradeOf(ext: string): number {
  const t = (ext || '').trim().toUpperCase()
  if (!t) return 99
  if (t.startsWith('ПГ')) return 0
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

  // активни ученици + изпращащо училище (име, град, вид) + клас в училището
  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, middle_name, last_name, external_class, external_class_letter, sending_school:sending_schools(name, city, type)')
    .eq('status', 'active')

  // паралелка + форма по ученик
  const { data: enr } = await supabase
    .from('student_enrollments').select('student_id, class_id, education_form, class:classes(name)')
    .eq('academic_year_id', cy?.id)
  const enrByStudent: Record<string, { name: string; classId: string; form: string }> = {}
  ;(enr || []).forEach((e: any) => {
    if (e.class?.name) enrByStudent[e.student_id] = { name: e.class.name, classId: e.class_id, form: e.education_form === 'ifo' ? 'ИФО' : 'Дневна' }
  })

  const { data: cta } = await supabase
    .from('class_teacher_assignments').select('class_id, staff:staff_profiles(first_name, last_name, is_active)')
    .eq('academic_year_id', cy?.id)
  const teacherByClass: Record<string, string> = {}
  ;(cta || []).forEach((a: any) => { if (a.staff && a.staff.is_active !== false && !teacherByClass[a.class_id]) teacherByClass[a.class_id] = `${a.staff.first_name} ${a.staff.last_name}` })

  const rows: StudentRow[] = (students || []).map((s: any) => {
    const e = enrByStudent[s.id]
    const ext = (s.external_class || '').trim()
    const letter = (s.external_class_letter || '').trim()
    return {
      id: s.id,
      name: getFullName(s),
      school: s.sending_school?.name || '',
      schoolType: s.sending_school?.type || '',
      city: s.sending_school?.city || '',
      ext: ext ? (letter ? `${ext} ${letter}` : ext) : '',
      grade: gradeOf(ext),
      className: e?.name || '',
      classTeacher: e ? (teacherByClass[e.classId] || '') : '',
      form: e?.form || '',
    }
  })

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <BackButton />
      <div className="mb-6 mt-2">
        <h1 className="text-xl font-semibold text-slate-800">Ученици по изпращащи училища</h1>
        <p className="text-slate-500 text-sm mt-0.5">Активни ученици · {cy?.name}</p>
      </div>
      <BySchoolClient rows={rows} yearName={cy?.name || ''} />
    </div>
  )
}
