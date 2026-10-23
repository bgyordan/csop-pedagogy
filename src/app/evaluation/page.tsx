// Оценяване на персонала (ДТВ, атестиране, други карти): кампании, карти, регистър и „Моите карти“.
// Организаторите (директор, ЗДУД, администратори и определените от директора) водят кампаниите;
// комисията оценява; всеки служител вижда своята карта — самооценка и портфолио (ако има), запознаване и възражение.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchAll } from '@/lib/supabase/fetch-all'
import EvalClient from './EvalClient'
export const dynamic = 'force-dynamic'

export default async function EvaluationPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, first_name, last_name, position').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')

  const { data: access, error } = await supabase.from('eval_access').select('staff_id, kind')
  if (error) return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">„Оценяване“ още не е подготвено в базата — пуснете SQL файла 2026-10-23_evaluation.sql.</div>
    </div>
  )
  const { error: stage2 } = await supabase.from('eval_external').select('id').limit(1)
  if (stage2) return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">„Оценяване“ е обновено — пуснете SQL файла 2026-10-24_evaluation_stages.sql (атестиране, самооценка, регистър).</div>
    </div>
  )
  const mine = (k: string) => (access || []).some((a: any) => a.staff_id === me.id && a.kind === k)
  const isDirector = me.role === 'director'
  const isManager = ['director', 'zdud', 'admin'].includes(me.role) || mine('manager')
  const isFinance = isDirector || mine('finance')

  const [{ data: campaigns }, { data: myCommission }, { data: cards }, { data: years }, { data: secretaryOf }] = await Promise.all([
    supabase.from('eval_campaigns').select('*, year:academic_years(name), participants:eval_participants(status, evaluator)').order('created_at', { ascending: false }),
    supabase.from('eval_commission').select('campaign_id, role').eq('staff_id', me.id),
    supabase.from('eval_participants').select('*, campaign:eval_campaigns(id, name, kind, status, self_assess, self_by, objection_days, period_from, period_to, scale, year:academic_years(name))').eq('staff_id', me.id).order('created_at', { ascending: false }),
    supabase.from('academic_years').select('id, name, is_current, start_date').order('start_date', { ascending: false }),
    supabase.from('eval_campaigns').select('id').eq('secretary_id', me.id),
  ])
  const myIds = (cards || []).map((x: any) => x.id)
  const [{ data: templates }, { data: people }, { data: myFiles }, { data: results }, { data: history }, { data: supports }] = await Promise.all([
    supabase.from('eval_templates').select('*').order('sort'),
    isManager ? supabase.from('staff_profiles').select('id, first_name, last_name, role, position').eq('is_active', true).order('first_name') : Promise.resolve({ data: [] as any[] }),
    myIds.length ? supabase.from('eval_files').select('*').in('participant_id', myIds).order('created_at') : Promise.resolve({ data: [] as any[] }),
    isManager
      ? fetchAll(() => supabase.from('eval_participants').select('id, staff_id, campaign_id, final_total, result, grade, employer_grade, status, finalized_at, acked_at, employer_at, campaign:eval_campaigns(id, name, kind, status, created_at, closed_at)').not('final_total', 'is', null).order('id'))
      : Promise.resolve({ data: [] as any[], error: null }),
    isManager ? supabase.from('eval_attest_history').select('*').order('attested_on', { ascending: false }) : Promise.resolve({ data: [] as any[] }),
    isManager ? supabase.from('eval_support').select('participant_id, status, reattest_by') : Promise.resolve({ data: [] as any[] }),
  ])

  // Професионално портфолио — за доказателствата при самооценката (ако таблиците ги има)
  const [ppItems, ppProfile, ppLinks] = await Promise.all([
    supabase.from('pp_items').select('*, files:pp_files(*)').eq('staff_id', me.id).order('date_from', { ascending: false, nullsFirst: false }),
    supabase.from('pp_profile').select('*').eq('staff_id', me.id).maybeSingle(),
    myIds.length ? supabase.from('pp_eval_links').select('*').in('participant_id', myIds) : Promise.resolve({ data: [] as any[], error: null }),
  ])
  const ppReady = !ppItems.error

  return (
    <EvalClient
      pp={ppReady ? { items: (ppItems.data || []) as any, profile: (ppProfile.data || null) as any, links: (ppLinks.data || []) as any } : null}
      me={{ id: me.id, role: me.role, name: `${me.first_name} ${me.last_name}` }}
      isDirector={isDirector} isManager={isManager} isFinance={isFinance}
      tab={sp.tab || ''}
      campaigns={(campaigns || []) as any}
      myCommission={(myCommission || []) as any}
      isSecretaryAny={(secretaryOf || []).length > 0}
      myFiles={(myFiles || []) as any}
      results={(results || []) as any}
      history={(history || []) as any}
      supports={(supports || []) as any}
      cards={(cards || []) as any}
      years={(years || []) as any}
      templates={(templates || []) as any}
      people={(people || []) as any}
      access={(access || []) as any}
    />
  )
}
