import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SiteDocsClient from './SiteDocsClient'
import { normalizeInfo } from './siteinfo'
export const dynamic = 'force-dynamic'

export default async function SiteDocsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me || !['admin', 'zdud', 'director', 'secretary'].includes(me.role)) redirect('/dashboard')

  const { data: docs } = await supabase.from('site_documents')
    .select('*')
    .order('sort_order', { ascending: true })

  const { data: news } = await supabase.from('site_news')
    .select('id, title, excerpt, content, cover_url, gallery_images, category, status, published_at, created_at')
    .order('created_at', { ascending: false })

  const { data: events } = await supabase.from('site_events')
    .select('id, title, event_date, event_time, location, description')
    .order('event_date', { ascending: false })

  const { data: albums } = await supabase.from('gallery_albums')
    .select('id, title, cover_url, event_date, sort_order').order('sort_order', { ascending: true })
  const { data: photos } = await supabase.from('gallery_photos')
    .select('id, album_id, photo_url, caption, sort_order').order('sort_order', { ascending: true })

  const { data: heroRow } = await supabase.from('site_settings').select('value').eq('key', 'hero_photos').maybeSingle()
  const heroPhotos = Array.isArray(heroRow?.value) ? (heroRow!.value as string[]) : []
  const { data: ppRow } = await supabase.from('site_settings').select('value').eq('key', 'page_photos').maybeSingle()
  const pagePhotos = ppRow?.value && typeof ppRow.value === 'object' && !Array.isArray(ppRow.value) ? (ppRow.value as Record<string, string[]>) : {}

  const { data: jobs } = await supabase.from('site_jobs')
    .select('id, title, employment, description, requirements, location, status, sort_order')
    .order('sort_order', { ascending: true })
  const { data: subscribers } = await supabase.from('job_subscribers')
    .select('id, email, created_at').order('created_at', { ascending: false })

  // Екип на сайта: активните служители + настройките им за сайта (site_team)
  const { data: staff } = await supabase.from('staff_profiles')
    .select('id, first_name, last_name, role, position').neq('is_active', false).order('last_name')
  const { data: team, error: teamErr } = await supabase.from('site_team').select('staff_id, show, title')

  // Настройки на сайта + история на промените (част В)
  const { data: infoRow } = await supabase.from('site_settings').select('value').eq('key', 'site_info').maybeSingle()
  const { data: audit } = await supabase.from('site_audit').select('id, at, staff_name, tbl, op, title, ref_id').order('at', { ascending: false }).limit(200)

  const { data: cy } = await supabase.from('academic_years').select('name').eq('is_current', true).single()

  return (
    <SiteDocsClient
      docs={docs || []} defaultYear={cy?.name || ''}
      news={news || []} authorId={me.id}
      events={events || []} albums={albums || []} photos={photos || []} heroPhotos={heroPhotos} pagePhotos={pagePhotos}
      jobs={jobs || []} subscribers={subscribers || []}
      staff={staff || []} team={team || []} teamReady={!teamErr}
      info={normalizeInfo(infoRow?.value)} infoReady={!!infoRow} audit={audit || []}
    />
  )
}
