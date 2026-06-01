import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
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
    .single()

  if (!profile) redirect('/auth/login')

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userRole={profile.role as UserRole}
        userName={getFullName(profile)}
        userEmail={profile.email}
      />
      <main className="flex-1 overflow-auto bg-slate-50 pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
