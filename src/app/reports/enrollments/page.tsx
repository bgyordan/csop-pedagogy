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

  const now = new Date()
  const currentYear = now.getFullYear()

  // Заявленията четем директно от деловодството (correspondence)
  const [{ data: enrollDocs }, { data: coudDocs }] = await Promise.all([
    supabase.from('correspondence')
      .select('student_id, from_whom, date, subject')
      .eq('nomenclature_item', 'УВД-09')
      .gte('date', `${currentYear}-01-01`)
      .order('date', { ascending: false }),
    supabase.from('correspondence')
      .select('student_id, from_whom, date, subject')
      .eq('nomenclature_item', 'УВД-12')
      .gte('date', `${currentYear}-01-01`)
      .order('date', { ascending: false }),
  ])

  // Всички засегнати ученици
  const studentIds = [...new Set([
    ...(enrollDocs || []).map(d => d.student_id).filter(Boolean),
    ...(coudDocs || []).map(d => d.student_id).filter(Boolean),
  ])]

  let studentsById: Record<string, any> = {}
  if (studentIds.length > 0) {
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name, external_class, sending_school:sending_schools(name, city)')
      .in('id', studentIds)
    ;(students || []).forEach((s: any) => { studentsById[s.id] = s })
  }

  // Карти по ученик — обединяваме прием + ЦОУД
  type Row = {
    studentId: string
    firstName: string
    lastName: string
    externalClass: string
    school: string
    schoolCity: string
    enrollFrom: string | null
    enrollDate: string | null
    coudFrom: string | null
    coudDate: string | null
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
        enrollFrom: null, enrollDate: null,
        coudFrom: null, coudDate: null,
      })
    }
    return rowMap.get(sid)!
  }
  ;(enrollDocs || []).forEach((d: any) => {
    if (!d.student_id) return
    const r = ensureRow(d.student_id)
    if (!r.enrollDate) { r.enrollDate = d.date; r.enrollFrom = d.from_whom || null }
  })
  ;(coudDocs || []).forEach((d: any) => {
    if (!d.student_id) return
    const r = ensureRow(d.student_id)
    if (!r.coudDate) { r.coudDate = d.date; r.coudFrom = d.from_whom || null }
  })

  const rows = Array.from(rowMap.values()).sort((a, b) => {
    const s = a.school.localeCompare(b.school, 'bg')
    if (s !== 0) return s
    return a.lastName.localeCompare(b.lastName, 'bg')
  })

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <BackButton />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Заявления за прием и ЦОУД — {currentYear}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {rows.length} ученика · {rows.filter(r => r.enrollDate).length} за прием · {rows.filter(r => r.coudDate).length} за ЦОУД
          </p>
        </div>
      </div>
      <EnrollmentsClient rows={rows} yearLabel={String(currentYear)} />
    </div>
  )
}
