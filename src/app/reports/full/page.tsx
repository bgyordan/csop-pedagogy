import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FullReportClient from './FullReportClient'
export const dynamic = 'force-dynamic'

export default async function FullReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!me || !['admin', 'zdud', 'director'].includes(me.role)) redirect('/dashboard')

  return <FullReportClient />
}
