import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { UserRole } from '@/types'
import { getFullName } from '@/lib/utils'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  /* ---------- AUTH ---------- */
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  /* ---------- PROFILE ---------- */
  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('staff_profiles')
    .select('id, first_name, last_name, role, email')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    console.error(profileError)
    redirect('/auth/login')
  }

  /* ---------- DERIVED ---------- */
  const userName = getFullName(profile)
  const userRole = profile.role as UserRole

  /* ---------- UI ---------- */
  return (
    <div className="flex min-h-screen">

      {/* SIDEBAR */}
      <Sidebar
        userRole={userRole}
        userName={userName}
        userEmail={profile.email}
      />

      {/* MAIN */}
      <main className="flex-1 overflow-auto bg-slate-50">
        {children}
      </main>

    </div>
  )
}
