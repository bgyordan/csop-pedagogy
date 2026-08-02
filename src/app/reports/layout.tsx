import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('role, first_name, last_name, is_coordinator, position')
    .eq('user_id', user.id)
    .single()
  if (!profile) redirect('/auth/login')
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        userRole={profile.role}
        userName={`${profile.first_name} ${profile.last_name}`}
        userEmail={user.email || ''}
        isCoordinator={profile.is_coordinator === true}
        userPosition={profile.position || ''}
      />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
