import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import ProcurementsClient from './ProcurementsClient'

export const dynamic = 'force-dynamic'

export default async function ProcurementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('role, id').eq('user_id', user.id).single()

  const canAccess = ['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')
  if (!canAccess) redirect('/dashboard')

  const canEdit = ['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')

  const { data: procurements } = await supabase
    .from('procurements')
    .select('*, files:procurement_files(count)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 md:p-8">
      <BackButton />
      <div className="mb-6">
        <div className="w-full flex items-center px-6 py-3 rounded-2xl bg-white border border-slate-200 shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
          <span className="text-sm font-medium text-slate-700 tracking-wide">Обществени поръчки</span>
        </div>
      </div>
      <ProcurementsClient
        procurements={procurements || []}
        canEdit={canEdit}
        currentUserId={profile?.id || ''}
      />
    </div>
  )
}
