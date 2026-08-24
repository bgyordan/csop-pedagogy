import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import EnrollmentsClient from './EnrollmentsClient'
export const dynamic = 'force-dynamic'
export default async function EnrollmentsReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles').select('role').eq('user_id', user.id).single()
  const canAccess = ['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')
  if (!canAccess) redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('academic_years').select('id').eq('is_current', true).single()

  // Заявленията четем от досието (student_attachments)
  const { data: attachments } = await supabase
    .from('student_attachments')
    .select('student_id, doc_type, created_at')
    .in('doc_type', ['enrollment_application', 'coud_application'])

  // Уникални ученици със заявления
  const studentIds = [...new Set((attachments || []).map((a: any) => a.student_id).filter(Boolean))]

  let studentsById: Record<string, any> = {}
  if (studentIds.length > 0) {
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name, external_class, sending_school:sending_schools(name, city)')
      .in('id', studentIds)
    ;(students || []).forEach((s: any) => { studentsById[s.id] = s })
  }

  // Паралелка ЦСОП
  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('student_id, class:classes(name)')
    .eq('academic_year_id', currentYear?.id)
  const csopClassByStudent: Record<string, string> = {}
  ;(enrollments || []).forEach((e: any) => {
    if (e.class?.name) csopClassByStudent[e.student_id] = e.class.name
  })

  type Row = {
    studentId: string
    firstName: string
    lastName: string
    externalClass: string
    school: string
    schoolCity: string
    csopClass: string
    hasEnroll: boolean
    hasCoud: boolean
  }
  const rowMap = new Map<string, Row>()
  function ensureRow(sid: string): Row {
    if (!rowMap.has(sid)) {
      const st = studentsById[sid]
      rowMap.set(sid, {
        studentId: sid,
        firstName: st?.first_name || '',
        lastName: st?.last_name || '',
        externalClass: st?.external_class || '—',
        school: st?.sending_school?.name || '—',
        schoolCity: st?.sending_school?.city || '',
        csopClass: csopClassByStudent[sid] || '—',
        hasEnroll: false,
        hasCoud: false,
      })
    }
    return rowMap.get(sid)!
  }
  ;(attachments || []).forEach((a: any) => {
    if (!a.student_id) return
    const r = ensureRow(a.student_id)
    if (a.doc_type === 'enrollment_application') r.hasEnroll = true
    if (a.doc_type === 'coud_application') r.hasCoud = true
  })

  const rows = Array.from(rowMap.values()).sort((a, b) => {
    const s = a.school.localeCompare(b.school, 'bg')
    if (s !== 0) return s
    return a.lastName.localeCompare(b.lastName, 'bg')
  })

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Заявления за прием и ЦОУД</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {rows.length} ученика · {rows.filter(r => r.hasEnroll).length} с прием · {rows.filter(r => r.hasCoud).length} с ЦОУД
        </p>
      </div>
      <EnrollmentsClient rows={rows} />
    </div>
  )
}
