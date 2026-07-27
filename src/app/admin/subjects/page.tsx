import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SubjectsClient } from './SubjectsClient'

export const dynamic = 'force-dynamic'

export default async function SubjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud'].includes(profile?.role || '')) redirect('/dashboard')

  const { data: subjects } = await supabase
    .from('subjects').select('*').order('allows_pullout', { ascending: false }).order('name')

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Предмети и направления</h1>
        <p className="text-slate-500 text-sm mt-1">
          Отбележи кои позволяват вземане на дете от терапевт
        </p>
      </div>
      <SubjectsClient subjects={subjects || []} />
    </div>
  )
}
