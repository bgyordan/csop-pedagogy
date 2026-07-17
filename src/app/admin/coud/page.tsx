import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import CoudGroupsClient from './CoudGroupsClient'

export const dynamic = 'force-dynamic'

export default async function CoudPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('role, id').eq('user_id', user.id).single()

  const canManage = ['admin', 'zdud'].includes(profile?.role || '')
  if (!canManage) redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  const { data: groups } = await supabase
    .from('coud_groups')
    .select('*, teacher:staff_profiles(id, first_name, last_name), enrollments:coud_enrollments(count)')
    .eq('academic_year_id', currentYear?.id)
    .order('name')

  const { data: teachers } = await supabase
    .from('staff_profiles')
    .select('id, first_name, last_name')
    .eq('is_active', true)
    .order('last_name')

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">ЦОУД групи</h1>
        <p className="text-slate-500 text-sm mt-1">Целодневна организация на учебния ден · {currentYear?.name}</p>
      </div>

      <CoudGroupsClient
        groups={groups || []}
        teachers={teachers || []}
        academicYearId={currentYear?.id || ''}
      />
    </div>
  )
}
