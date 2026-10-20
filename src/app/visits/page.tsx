// Посещение на час — управата задава период и лимит на ден; учителите сами си избират ден, час и тема.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VisitsClient from './VisitsClient'
export const dynamic = 'force-dynamic'

export default async function VisitsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, first_name, last_name').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const isMgmt = ['admin', 'zdud', 'director'].includes(me.role)

  const { data: campaigns, error } = await supabase.from('visit_campaigns').select('*').order('date_from', { ascending: false })
  if (error) return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">„Посещение на час“ още не е подготвено в базата — пуснете SQL файла 2026-10-20_class_visits.sql.</div>
    </div>
  )
  const list = (campaigns || []).filter((c: any) => isMgmt || (c.roles || []).includes(me.role))
  if (!isMgmt && !list.length) redirect('/dashboard')
  const campaign: any = list.find((c: any) => c.id === sp.c) || list[0] || null

  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  // записите: управата — всички; учителят — своя (RLS) + заетостта по дни/часове без имена
  const [{ data: bookings }, { data: slots }] = campaign
    ? await Promise.all([
        supabase.from('visit_bookings').select('*, staff:staff_profiles(first_name, last_name, position)').eq('campaign_id', campaign.id),
        supabase.rpc('visit_slots', { p_campaign: campaign.id }),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }]

  // управата: кой участва (за „Още не са избрали“)
  const { data: people } = isMgmt && campaign
    ? await supabase.from('staff_profiles').select('id, first_name, last_name, role').in('role', campaign.roles || []).eq('is_active', true).not('user_id', 'is', null).order('first_name')
    : { data: [] as any[] }

  // учителят: неговите часове от седмичното разписание (I и II срок) — за избора на час
  let lessons: { term: number; day: number; period: number; label: string; subject: string }[] = []
  if (!isMgmt && campaign?.use_schedule && cy?.id) {
    const { data: scheds } = await supabase.from('class_schedules').select('id, term, class:classes(name)').eq('academic_year_id', cy.id)
    const byId: Record<string, any> = {}
    ;(scheds || []).forEach((s: any) => { byId[s.id] = s })
    const ids = Object.keys(byId)
    const [{ data: cs }, { data: ifo }] = await Promise.all([
      ids.length ? supabase.from('schedule_slots').select('schedule_id, day, period, subject:subjects(name)').in('schedule_id', ids).eq('staff_id', me.id) : Promise.resolve({ data: [] as any[] }),
      supabase.from('teacher_ifo_slots').select('term, day, period, subject:subjects(name), student:students(first_name, last_name)').eq('teacher_id', me.id).eq('academic_year_id', cy.id),
    ])
    lessons = [
      ...(cs || []).map((s: any) => ({ term: byId[s.schedule_id]?.term || 1, day: s.day, period: s.period, label: `паралелка ${byId[s.schedule_id]?.class?.name || ''}`, subject: s.subject?.name || '' })),
      ...(ifo || []).map((s: any) => ({ term: s.term, day: s.day, period: s.period, label: `ИФО ${s.student ? `${s.student.first_name} ${s.student.last_name}` : ''}`, subject: s.subject?.name || '' })),
    ]
  }
  // учебният календар — неучебни дни и срок за всеки ден от периода
  const { data: cal } = campaign
    ? await supabase.from('academic_calendar_days').select('date, is_school_day, term').gte('date', campaign.date_from).lte('date', campaign.date_to)
    : { data: [] as any[] }

  return (
    <VisitsClient
      me={{ id: me.id, role: me.role, name: `${me.first_name} ${me.last_name}` }}
      isMgmt={isMgmt}
      campaigns={list.map((c: any) => ({ id: c.id, title: c.title, date_from: c.date_from, date_to: c.date_to }))}
      campaign={campaign}
      bookings={(bookings || []) as any}
      slots={(slots || []) as any}
      people={(people || []) as any}
      lessons={lessons}
      calendar={(cal || []) as any}
    />
  )
}
