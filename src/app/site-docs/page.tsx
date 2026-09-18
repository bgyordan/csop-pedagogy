import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SiteDocsClient from './SiteDocsClient'
export const dynamic = 'force-dynamic'

export default async function SiteDocsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!me || !['admin', 'zdud', 'director', 'secretary'].includes(me.role)) redirect('/dashboard')

  const { data: docs } = await supabase.from('site_documents')
    .select('id, name, file_url, academic_year, category, on_site, sort_order')
    .eq('section', 'internal')
    .order('sort_order', { ascending: true })

  const { data: cy } = await supabase.from('academic_years').select('name').eq('is_current', true).single()

  return <SiteDocsClient docs={docs || []} defaultYear={cy?.name || ''} />
}
