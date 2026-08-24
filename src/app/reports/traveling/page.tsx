import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import TravelingClient from './TravelingClient'
export const dynamic = 'force-dynamic'

export default async function TravelingReportPage() {
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
    .select('id, first_name, last_name, external_class, is_traveling, sending_school:sending_schools(name, city)')
    .eq('status', 'active')
    .eq('is_traveling', true)

  const ids = (students || []).map((s: any) => s.id)

  // Паралелка ЦСОП
  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('student_id, class:classes(name)')
    .eq('academic_year_id', currentYear?.id)
  const csopClassByStudent: Record<string, string> = {}
  ;(enrollments || []).forEach((e: any) => {
    if (e.class?.name) csopClassByStudent[e.student_id] = e.class.name
  })

  // Родители + телефони
  let guardianByStudent: Record<string, { name: string; phone: string }> = {}
  if (ids.length > 0) {
    const { data: guardians } = await supabase
      .from('student_guardians')
      .select('student_id, full_name, phone, relation')
      .in('student_id', ids)
      .order('relation')
    ;(guardians || []).forEach((g: any) => {
      // първият родител (по relation) за всяко дете
      if (!guardianByStudent[g.student_id]) {
        guardianByStudent[g.student_id] = { name: g.full_name || '', phone: g.phone || '' }
      }
    })
  }

  const rows = (students || []).map((s: any) => ({
    id: s.id,
    firstName: s.first_name || '',
    lastName: s.last_name || '',
    externalClass: s.external_class || '—',
    school: s.sending_school?.name || '—',
    schoolCity: s.sending_school?.city || '',
    csopClass: csopClassByStudent[s.id] || '—',
    parent: guardianByStudent[s.id]?.name || '',
    phone: guardianByStudent[s.id]?.phone || '',
  })).sort((a: any, b: any) => {
    const c = a.csopClass.localeCompare(b.csopClass, 'bg')
    if (c !== 0) return c
    return a.lastName.localeCompare(b.lastName, 'bg')
  })

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Пътуващи ученици</h1>
        <p className="text-slate-500 text-sm mt-0.5">{rows.length} ученика</p>
      </div>
      <TravelingClient rows={rows} />
    </div>
  )
}
