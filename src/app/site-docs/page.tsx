import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SiteDocsClient from './SiteDocsClient'
export const dynamic = 'force-dynamic'

export default async function SiteDocsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me || !['admin', 'zdud', 'director', 'secretary'].includes(me.role)) redirect('/dashboard')

  const { data: docs } = await supabase.from('site_documents')
    .select('id, name, file_url, academic_year, section, category, on_site, sort_order')
    .order('sort_order', { ascending: true })

  const { data: news } = await supabase.from('site_news')
    .select('id, title, excerpt, content, cover_url, category, status, published_at, created_at')
    .order('created_at', { ascending: false })

  const { data: cy } = await supabase.from('academic_years').select('name').eq('is_current', true).single()

  return <SiteDocsClient docs={docs || []} defaultYear={cy?.name || ''} news={news || []} authorId={me.id} />
}
