import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import ByClassClient from './ByClassClient'
export const dynamic = 'force-dynamic'

// Извлича водещия клас (число) от external_class: "2 а" -> "2", "12 . а" -> "12", "ПГ" -> "ПГ"
const ROMAN_MAP: Record<string, number> = { I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12,XIII:13 }
function normalizeClass(raw: string | null): string | null {
  if (!raw) return null
  const t = raw.trim().toUpperCase()
  if (!t) return null
  if (/ПГ/i.test(t)) return 'ПГ'
  // римско в началото (напр. "II", "XII а")
  const rm = t.match(/^(XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b/)
  if (rm) {
    const n = ROMAN_MAP[rm[1]]
    return n >= 13 ? null : String(n)
  }
  // арабско (стар формат, за всеки случай)
  const m = t.match(/\d+/)
  if (m) {
    const n = parseInt(m[0])
    return n >= 13 ? null : String(n)
  }
  return null
}

interface ReportRow {
  id: string
  firstName: string
  lastName: string
  rawClass: string
  classGroup: string
  school: string
  schoolCity: string
  csopClass: string
}

export default async function ByClassReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles').select('role').eq('user_id', user.id).single()
  const canAccess = ['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')
  if (!canAccess) redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('academic_years').select('id').eq('is_current', true).single()

  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name, external_class, sending_school:sending_schools(name, city)')
    .eq('status', 'active')

  // Текуща паралелка в ЦСОП за всеки ученик
  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('student_id, class:classes(name)')
    .eq('academic_year_id', currentYear?.id)
  const csopClassByStudent: Record<string, string> = {}
  ;(enrollments || []).forEach((e: any) => {
    if (e.class?.name) csopClassByStudent[e.student_id] = e.class.name
  })

  const rows: ReportRow[] = (students || []).map((s: any) => ({
    id: s.id,
    firstName: s.first_name || '',
    lastName: s.last_name || '',
    rawClass: s.external_class || '',
    classGroup: normalizeClass(s.external_class) || '',
    school: s.sending_school?.name || '—',
    schoolCity: s.sending_school?.city || '',
    csopClass: csopClassByStudent[s.id] || '—',
  })).filter((r: ReportRow) => r.classGroup !== '')

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Ученици по клас на изпращане</h1>
        <p className="text-slate-500 text-sm mt-0.5">Избери класове за планиране на паралелки</p>
      </div>
      <ByClassClient rows={rows} />
    </div>
  )
}
