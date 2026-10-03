import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getFullName } from '@/lib/utils'
import PortfolioClient from './PortfolioClient'
import type { Post, Person } from './lib'
export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор', director: 'Директор', zdud: 'ЗДУД', secretary: 'Деловодител',
  psychologist: 'Психолог', speech_therapist: 'Логопед', rehabilitator: 'Рехабилитатор',
  class_teacher: 'Класен ръководител', teacher: 'Учител', educator: 'Възпитател', coordinator: 'Координатор',
}

export default async function PortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles')
    .select('id, role, first_name, middle_name, last_name, position').eq('user_id', user.id).single()
  if (!me || me.role === 'support') redirect('/dashboard')

  const { data: year } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const [postsRes, mediaRes, linksRes, staffRes, classesRes, ctaRes] = await Promise.all([
    supabase.from('portfolio_posts').select('*').order('created_at', { ascending: false }).limit(1000),
    supabase.from('portfolio_media').select('id, post_id, path, thumb_path, name, mime, size, caption, sort').order('sort'),
    supabase.from('portfolio_post_classes').select('post_id, class_id'),
    supabase.from('staff_profiles').select('id, first_name, middle_name, last_name, role, position').order('first_name'),
    supabase.from('classes').select('id, name').eq('academic_year_id', year?.id).order('name'),
    supabase.from('class_teacher_assignments').select('class_id').eq('staff_id', me.id).eq('academic_year_id', year?.id),
  ])

  // Миграцията още не е пусната
  if (postsRes.error) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-lg font-semibold mb-1">Портфолио</h1>
          <p className="text-sm">Разделът е готов, но базата още не е подготвена — пуснете SQL файла <code>2026-10-03_portfolio.sql</code>.</p>
        </div>
      </div>
    )
  }

  const mediaBy: Record<string, any[]> = {}
  ;(mediaRes.data || []).forEach((m: any) => { (mediaBy[m.post_id] ||= []).push(m) })
  const clsBy: Record<string, string[]> = {}
  ;(linksRes.data || []).forEach((l: any) => { (clsBy[l.post_id] ||= []).push(l.class_id) })

  const posts: Post[] = (postsRes.data || []).map((p: any) => ({ ...p, media: mediaBy[p.id] || [], classIds: clsBy[p.id] || [] }))

  // Подписани адреси за миниатюрите (хранилището е частно)
  const thumbPaths = Array.from(new Set((mediaRes.data || []).map((m: any) => m.thumb_path).filter(Boolean))) as string[]
  const thumbs: Record<string, string> = {}
  for (let i = 0; i < thumbPaths.length; i += 500) {
    const { data } = await supabase.storage.from('portfolio').createSignedUrls(thumbPaths.slice(i, i + 500), 60 * 60 * 6)
    ;(data || []).forEach((d: any) => { if (d.signedUrl && d.path) thumbs[d.path] = d.signedUrl })
  }

  const people: Person[] = (staffRes.data || []).map((s: any) => ({
    id: s.id, name: getFullName(s), short: `${s.first_name} ${s.last_name}`,
    label: s.position || ROLE_LABELS[s.role] || '',
  }))

  return (
    <PortfolioClient
      meId={me.id}
      role={me.role}
      posts={posts}
      thumbs={thumbs}
      people={people}
      classes={classesRes.data || []}
      myClassIds={(ctaRes.data || []).map((c: any) => c.class_id)}
      academicYearId={year?.id || null}
    />
  )
}
