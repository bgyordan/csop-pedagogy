// Професионално портфолио (Наредба № 15/2019): общи данни и философия, материали по раздели, квалификация
// (часове/кредити за раздел А на атестационната карта), цели за развитие, данни от ЕИС и Word документ.
// Всеки педагогически специалист води своето; управата вижда всички (без записите „само за мен“) и обобщението.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { ROLE_LABELS, type UserRole } from '@/types'
import { PP_MANAGERS, PP_ROLES } from '@/lib/pro-portfolio'
import ProPortfolioClient from './ProPortfolioClient'
import ProfileNav from '@/components/profile/ProfileNav'
export const dynamic = 'force-dynamic'

export default async function ProPortfolioPage({ searchParams }: { searchParams: Promise<{ staff?: string; tab?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, first_name, last_name').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const isManager = PP_MANAGERS.includes(me.role)

  const { error } = await supabase.from('pp_profile').select('staff_id').limit(1)
  if (error) return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">„Професионално портфолио“ още не е подготвено в базата — пуснете SQL файла 2026-10-26_pro_portfolio.sql.</div>
    </div>
  )

  const targetId = sp.staff || me.id
  const isOwn = targetId === me.id
  const { data: years } = await supabase.from('academic_years').select('id, name, is_current, start_date, end_date').order('start_date', { ascending: false })
  const cur = (years || []).find((y: any) => y.is_current) || (years || [])[0]

  const [{ data: staff }, { data: profile }, { data: items }, { data: goals }, { data: posts }, { data: classes }, { data: history }, { data: lastAttest }] = await Promise.all([
    supabase.from('staff_profiles').select('id, first_name, middle_name, last_name, role, position, email').eq('id', targetId).maybeSingle(),
    supabase.from('pp_profile').select('*').eq('staff_id', targetId).maybeSingle(),
    supabase.from('pp_items').select('*, files:pp_files(*)').eq('staff_id', targetId).order('date_from', { ascending: false, nullsFirst: false }),
    supabase.from('pp_goals').select('*').eq('staff_id', targetId).order('sort').order('created_at'),
    isOwn ? supabase.from('portfolio_posts').select('id, kind, title, body, event_date, created_at').eq('author_id', targetId).order('created_at', { ascending: false }).limit(200) : Promise.resolve({ data: [] as any[] }),
    cur ? supabase.from('class_teacher_assignments').select('class:classes(name)').eq('staff_id', targetId).eq('academic_year_id', cur.id) : Promise.resolve({ data: [] as any[] }),
    supabase.from('eval_attest_history').select('attested_on').eq('staff_id', targetId).order('attested_on', { ascending: false }).limit(1),
    supabase.from('eval_participants').select('employer_at, acked_at, finalized_at, grade, campaign:eval_campaigns!inner(kind)').eq('staff_id', targetId).eq('campaign.kind', 'attest').not('grade', 'is', null),
  ])
  if (!staff) redirect('/pro-portfolio')

  // последно атестиране → началото на атестационния период (4 години)
  const lastDates = [
    ...((history || []) as any[]).map(h => h.attested_on as string),
    ...((lastAttest || []) as any[]).map(r => String(r.employer_at || r.acked_at || r.finalized_at || '').slice(0, 10)).filter(Boolean),
  ].sort().reverse()

  // Обобщение за управата
  let overview: any[] = []
  const tab = sp.tab || (isManager && !sp.staff ? 'staff' : '')
  if (isManager && tab === 'staff') {
    const [{ data: people }, { data: allItems }, { data: profiles }] = await Promise.all([
      supabase.from('staff_profiles').select('id, first_name, last_name, role, position').eq('is_active', true).in('role', PP_ROLES).order('first_name'),
      fetchAll(() => supabase.from('pp_items').select('id, staff_id, section, kind, hours, credits, date_from, date_to, created_at, updated_at').order('id')),
      supabase.from('pp_profile').select('staff_id, pks, updated_at, philosophy'),
    ])
    overview = ((people || []) as any[]).map(p => ({
      ...p,
      roleLabel: ROLE_LABELS[p.role as UserRole] || p.role,
      items: ((allItems || []) as any[]).filter(i => i.staff_id === p.id),
      profile: ((profiles || []) as any[]).find(x => x.staff_id === p.id) || null,
    }))
  }

  // Моето портфолио е таб от „Моят профил“ — над него стоят табовете на профила
  const client = (
    <ProPortfolioClient
      me={{ id: me.id, role: me.role }}
      isManager={isManager}
      isOwn={isOwn}
      canEdit={isOwn || isManager}
      tab={tab}
      staff={{ ...(staff as any), roleLabel: ROLE_LABELS[(staff as any).role as UserRole] || (staff as any).role }}
      profile={(profile || null) as any}
      items={(items || []) as any}
      goals={(goals || []) as any}
      posts={(posts || []) as any}
      classes={((classes || []) as any[]).map(c => c.class?.name).filter(Boolean)}
      years={(years || []) as any}
      lastAttest={lastDates[0] || null}
      overview={overview}
    />
  )
  if (!isOwn || tab === 'staff') return client
  return (
    <>
      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-4 md:pt-8 -mb-2 md:-mb-4"><ProfileNav active="portfolio" role={me.role} /></div>
      {client}
    </>
  )
}
