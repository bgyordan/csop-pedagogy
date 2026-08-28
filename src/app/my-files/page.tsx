import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MyFilesClient from './MyFilesClient'

export default async function MyFilesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('id, first_name, last_name')
    .eq('user_id', user.id)
    .single()
  if (!profile) redirect('/dashboard')
  return <MyFilesClient staffId={profile.id} />
}
