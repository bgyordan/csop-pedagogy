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

  const { data: staff } = await supabase.from('staff_profiles')
    .select('id, first_name, last_name, position').eq('is_active', true).order('last_name')

  return (
    <BullyingCouncilClient
      isManager={isManager}
      members={members || []}
      staff={staff || []}
      academicYearId={cy?.id || null}
      yearName={cy?.name || ''}
    />
  )
}
