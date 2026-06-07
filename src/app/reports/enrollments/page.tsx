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
    .from('academic_years').select('*').eq('is_current', true).single()

  const now = new Date()
  const nextYearStart = now.getFullYear() + (now.getMonth() >= 8 ? 1 : 0)
  const nextYearLabel = `${nextYearStart}/${nextYearStart + 1}`

  const { data: corrEnroll } = await supabase
    .from('correspondence')
    .select('student_id, date')
    .like('number', 'УВД-09-%')
    .not('student_id', 'is', null)

  const { data: corrCoud } = await supabase
    .from('correspondence')
    .select('student_id, date')
    .like('number', 'УВД-12-%')
    .not('student_id', 'is', null)

  const allStudentIds = [...new Set([
    ...(corrEnroll || []).map(c => c.student_id),
    ...(corrCoud || []).map(c => c.student_id),
  ])]

  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select(`
      student:students(id, first_name, last_name, external_class, sending_school:sending_schools(name, city)),
      class:classes(name)
    `)
    .eq('academic_year_id', currentYear?.id)
    .in('student_id', allStudentIds.length > 0 ? allStudentIds : ['00000000-0000-0000-0000-000000000000'])

  const enrollMap = new Map((corrEnroll || []).map(c => [c.student_id, c.date]))
  const coudMap = new Map((corrCoud || []).map(c => [c.student_id, c.date]))

  const rows = (enrollments || [])
    .map((e: any) => ({
      studentId: e.student?.id,
      firstName: e.student?.first_name || '',
      lastName: e.student?.last_name || '',
      externalClass: e.student?.external_class || '—',
      school: e.student?.sending_school?.name || '—',
      schoolCity: e.student?.sending_school?.city || '',
      csopClass: e.class?.name || '—',
      enrollDate: enrollMap.get(e.student?.id) || null,
      coudDate: coudMap.get(e.student?.id) || null,
    }))
    .sort((a, b) => {
      const s = a.school.localeCompare(b.school, 'bg')
      if (s !== 0) return s
      return a.lastName.localeCompare(b.lastName, 'bg')
    })

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <BackButton />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Заявления — {nextYearLabel}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{rows.length} ученика · {rows.filter(r => r.enrollDate).length} записване · {rows.filter(r => r.coudDate).length} ЦОУД</p>
        </div>
      </div>
      <EnrollmentsClient rows={rows} yearLabel={nextYearLabel} />
    </div>
  )
}
