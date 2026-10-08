import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { UserRole } from '@/types'
import { getFullName } from '@/lib/utils'
import DevNav from './DevNav'
export default async function DevelopmentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()
  if (!profile) redirect('/auth/login')
  // табовете — само за тези, които виждат и общия анализ (учителите имат само груповата карта)
  const canOverview = ['admin', 'zdud', 'director', 'psychologist'].includes(profile.role) || profile.is_coordinator === true
  return (
    <div className="flex min-h-screen">
      <Sidebar
        userRole={profile.role as UserRole}
        userName={getFullName(profile)}
        userEmail={profile.email}
        isCoordinator={profile.is_coordinator === true}
        userPosition={profile.position || ""}
      />
      <main className="flex-1 overflow-auto bg-slate-50">
        {canOverview && <DevNav />}
        {children}
      </main>
    </div>
  )
}
