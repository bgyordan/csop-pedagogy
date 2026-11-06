import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getFullName } from '@/lib/utils'
import PortfolioClient from './PortfolioClient'
import type { Post, Person } from './lib'
export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор', director: 'Директор', zdud: 'ЗДУД', secretary: 'Деловодител',
  psychologist: 'Психолог', speech_therapist: 'Логопед', rehabilitator: 'Рехабилитатор',
  class_teacher: 'Класен ръководител', teacher: 'Учител', educator: 'Учител ЦОУД', coordinator: 'Координатор',
}

export default async function PortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles')
    .select('id, role, first_name, middle_name, last_name, position').eq('user_id', user.id).single()
  if (!me || me.role === 'support') redirect('/dashboard')

  const { data: year } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const [postsRes, mediaRes, linksRes, staffRes, classesRes, ctaRes, datesRes] = await Promise.all([
    supabase.from('portfolio_posts').select('*').order('created_at', { ascending: false }).limit(1000),
    supabase.from('portfolio_media').select('id, post_id, path, thumb_path, name, mime, size, caption, sort').order('sort'),
    supabase.from('portfolio_post_classes').select('post_id, class_id'),
    supabase.from('staff_profiles').select('id, first_name, middle_name, last_name, role, position').order('first_name'),
    supabase.from('classes').select('id, name').eq('academic_year_id', year?.id).order('name'),
    supabase.from('class_teacher_assignments').select('class_id').eq('staff_id', me.id).eq('academic_year_id', year?.id),
    // Дати и събития (2026-11-03_portfolio_dates.sql) — ако таблицата я няма, разделът просто не се показва
    supabase.from('portfolio_dates').select('id, post_id, date, time_from, time_to, title, place, note, highlight, sort').order('date').order('sort'),
  ])

  // Групи ЦОУД — за съвместна дейност с паралелки (2026-11-06_portfolio_groups.sql; без него — само паралелки)
  const [coudRes, grpLinksRes] = await Promise.all([
    supabase.from('coud_groups').select('id, name, teacher_id').eq('academic_year_id', year?.id).order('name'),
    supabase.from('portfolio_post_groups').select('post_id, group_id'),
  ])
  const groupsReady = !grpLinksRes.error
  const coudLabel = (n: string) => /цоуд|група/i.test(n || '') ? n : `ЦОУД ${n}`
  const groups = groupsReady ? (coudRes.data || []).map((g: any) => ({ id: g.id, name: coudLabel(g.name), group: true })) : []
  const myGroupIds = groupsReady ? (coudRes.data || []).filter((g: any) => g.teacher_id === me.id).map((g: any) => g.id) : []

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
  // групите ЦОУД вървят в същия списък (имената им са в classNames)
  ;(groupsReady ? grpLinksRes.data || [] : []).forEach((l: any) => { (clsBy[l.post_id] ||= []).push(l.group_id) })

  const datesBy: Record<string, any[]> = {}
  ;(datesRes.data || []).forEach((d: any) => { (datesBy[d.post_id] ||= []).push(d) })

  const posts: Post[] = (postsRes.data || []).map((p: any) => ({ ...p, media: mediaBy[p.id] || [], classIds: clsBy[p.id] || [], dates: datesBy[p.id] || [] }))

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
      classes={[...(classesRes.data || []), ...groups]}
      myClassIds={[...(ctaRes.data || []).map((c: any) => c.class_id), ...myGroupIds]}
      academicYearId={year?.id || null}
      datesReady={!datesRes.error}
    />
  )
}
