// „Моят профил“ — изгледът е общ с профила на колега (/staff/[id]): src/components/profile/StaffProfileView.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StaffProfileView from '@/components/profile/StaffProfileView'
export const dynamic = 'force-dynamic'

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('*').eq('user_id', user.id).maybeSingle()
  if (!me) redirect('/auth/login')
  return <StaffProfileView supabase={supabase} me={me} tab={sp.tab} self loginEmail={user.email || ''} />
}
