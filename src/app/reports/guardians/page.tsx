import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import GuardiansClient from './GuardiansClient'
export const dynamic = 'force-dynamic'
interface GuardianInfo { name: string; relation: string; phone: string }
interface ReportRow {
  id: string
  name: string
  csopClass: string
  guardians: GuardianInfo[]
}
export default async function GuardiansReportPage() {
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
    .select('id, first_name, middle_name, last_name')
    .eq('status', 'active')
  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('student_id, class:classes(name)')
    .eq('academic_year_id', currentYear?.id)
  const csopClassByStudent: Record<string, string> = {}
  ;(enrollments || []).forEach((e: any) => {
    if (e.class?.name) csopClassByStudent[e.student_id] = e.class.name
  })
  const { data: guardians } = await supabase
    .from('student_guardians')
    .select('student_id, full_name, relation, phone')
  const guardiansByStudent: Record<string, GuardianInfo[]> = {}
  ;(guardians || []).forEach((g: any) => {
    if (!guardiansByStudent[g.student_id]) guardiansByStudent[g.student_id] = []
    guardiansByStudent[g.student_id].push({ name: g.full_name || '', relation: g.relation || '', phone: g.phone || '' })
  })
  const rows: ReportRow[] = (students || []).map((s: any) => ({
    id: s.id,
    name: `${s.first_name || ''} ${s.middle_name || ''} ${s.last_name || ''}`.replace(/\s+/g, ' ').trim(),
    csopClass: csopClassByStudent[s.id] || '—',
    guardians: guardiansByStudent[s.id] || [],
  })).sort((a, b) => a.name.localeCompare(b.name, 'bg'))
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Родители и контакти</h1>
        <p className="text-slate-500 text-sm mt-0.5">Ученик, паралелка, родител(и) и телефон</p>
      </div>
      <GuardiansClient rows={rows} />
    </div>
  )
}
