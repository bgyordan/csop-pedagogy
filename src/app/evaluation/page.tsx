// Оценяване на персонала (ДТВ за постигнати резултати): кампании, карти и „Моите карти“.
// Организаторите (директор, ЗДУД, администратори и определените от директора) водят кампаниите;
// комисията оценява; всеки служител вижда своята карта, след като е изпратена — запознаване и възражение.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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
  const mine = (k: string) => (access || []).some((a: any) => a.staff_id === me.id && a.kind === k)
  const isDirector = me.role === 'director'
  const isManager = ['director', 'zdud', 'admin'].includes(me.role) || mine('manager')
  const isFinance = isDirector || mine('finance')

  const [{ data: campaigns }, { data: myCommission }, { data: cards }, { data: years }] = await Promise.all([
    supabase.from('eval_campaigns').select('*, year:academic_years(name), participants:eval_participants(status, evaluator)').order('created_at', { ascending: false }),
    supabase.from('eval_commission').select('campaign_id, role').eq('staff_id', me.id),
    supabase.from('eval_participants').select('*, campaign:eval_campaigns(id, name, objection_days, year:academic_years(name))').eq('staff_id', me.id).not('sent_at', 'is', null).order('sent_at', { ascending: false }),
    supabase.from('academic_years').select('id, name, is_current').order('start_date', { ascending: false }),
  ])
  const [{ data: templates }, { data: people }] = isManager
    ? await Promise.all([
        supabase.from('eval_templates').select('*').order('sort'),
        supabase.from('staff_profiles').select('id, first_name, last_name, role, position').eq('is_active', true).order('first_name'),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }]

  return (
    <EvalClient
      me={{ id: me.id, role: me.role, name: `${me.first_name} ${me.last_name}` }}
      isDirector={isDirector} isManager={isManager} isFinance={isFinance}
      tab={sp.tab || ''}
      campaigns={(campaigns || []) as any}
      myCommission={(myCommission || []) as any}
      cards={(cards || []) as any}
      years={(years || []) as any}
      templates={(templates || []) as any}
      people={(people || []) as any}
      access={(access || []) as any}
    />
  )
}
