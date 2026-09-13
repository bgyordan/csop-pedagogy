import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BullyingCouncilClient from './BullyingCouncilClient'
export const dynamic = 'force-dynamic'

export default async function BullyingCouncilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const { data: members } = await supabase.from('bullying_council_members')
    .select('id, staff_id, name, position, is_chair, sort')
    .eq('academic_year_id', cy?.id).order('is_chair', { ascending: false }).order('sort').order('name')

  const isManager = ['admin', 'zdud', 'director'].includes(me.role)
  const amMember = (members || []).some((m: any) => m.staff_id === me.id)
  if (!isManager && !amMember) redirect('/dashboard')

  const [{ data: staff }, { data: protocols }, { data: studentsRaw }] = await Promise.all([
    supabase.from('staff_profiles').select('id, first_name, last_name, position').eq('is_active', true).order('last_name'),
    supabase.from('bullying_protocols').select('*').eq('academic_year_id', cy?.id).order('number', { ascending: false }),
    supabase.from('students').select('id, first_name, middle_name, last_name').eq('status', 'active').order('last_name'),
  ])
  const students = (studentsRaw || []).map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`.replace(/\s+/g, ' ').trim() }))

  return (
    <BullyingCouncilClient
      meId={me.id}
      isManager={isManager}
      members={members || []}
      staff={staff || []}
      protocols={protocols || []}
      students={students}
      academicYearId={cy?.id || null}
      yearName={cy?.name || ''}
    />
  )
}
