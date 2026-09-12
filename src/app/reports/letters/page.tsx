import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LettersClient from './LettersClient'
export const dynamic = 'force-dynamic'

export default async function LettersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!me || !['admin', 'zdud', 'director'].includes(me.role)) redirect('/dashboard')

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const { data: enr } = await supabase.from('student_enrollments')
    .select('student:students(first_name, middle_name, last_name, external_class, status, sending_school:sending_schools(name, city)), class:classes(name)')
    .eq('academic_year_id', cy?.id)

  const byClass: Record<string, { className: string; students: { name: string; school: string; externalClass: string }[] }> = {}
  ;(enr || []).forEach((e: any) => {
    const s = e.student
    if (!s || s.status === 'archived') return
    const key = e.class?.name || '—'
    if (!byClass[key]) byClass[key] = { className: key, students: [] }
    byClass[key].students.push({
      name: `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`.replace(/\s+/g, ' ').trim(),
      school: s.sending_school ? `${s.sending_school.name} — ${s.sending_school.city}` : '',
      externalClass: s.external_class || '',
    })
  })
  const ruoData = Object.values(byClass)
    .sort((a, b) => a.className.localeCompare(b.className, 'bg', { numeric: true }))
    .map(c => ({ ...c, students: c.students.sort((a, b) => a.name.localeCompare(b.name, 'bg')) }))

  return <LettersClient yearName={cy?.name || ''} ruoData={ruoData} />
}
