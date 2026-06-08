import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { UserRole } from '@/types'
import { getFullName } from '@/lib/utils'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile) redirect('/auth/login')

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        userRole={profile.role as UserRole}
        userName={getFullName(profile)}
        userEmail={profile.email}
        isCoordinator={profile.is_coordinator === true}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        <Header />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
