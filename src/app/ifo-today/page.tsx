import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import IfoTodayCard from '@/app/dashboard/components/IfoTodayCard'
export const dynamic = 'force-dynamic'

// „ИФО днес“ — всички ИФО деца с часовете им за днешния ден (управа и помощници);
// за останалите роли — само своите ИФО деца.
export default async function IfoTodayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const [{ data: profile }, { data: year }] = await Promise.all([
    supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single(),
    supabase.from('academic_years').select('id').eq('is_current', true).single(),
  ])
  if (!profile || !year || profile.role === 'secretary') redirect('/dashboard')
  const all = ['support', 'admin', 'zdud', 'director'].includes(profile.role)

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {all
        ? <IfoTodayCard currentYearId={year.id} full />
        : (await IfoTodayCard({ currentYearId: year.id, staffId: profile.id, full: true })) ?? (
            <p className="text-sm text-slate-400">Днес нямате деца в ИФО.</p>
          )}
    </div>
  )
}
