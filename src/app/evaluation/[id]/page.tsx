// Кампания (ДТВ, атестиране или друга оценка): подготовка (комисия, оценявани, карти), самооценка, оценяване от
// членовете, утвърждаване, изпращане на картите, възражения, суми (ДТВ — само директорът и счетоводителят),
// анализ, план за подкрепа (атестиране) и документите.
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { fetchAll } from '@/lib/supabase/fetch-all'
import CampaignClient from './CampaignClient'
export const dynamic = 'force-dynamic'

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; p?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, first_name, last_name, position').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')

  const { data: campaign, error } = await supabase.from('eval_campaigns').select('*, year:academic_years(name)').eq('id', id).maybeSingle()
  if (error) return <div className="p-8 max-w-3xl mx-auto"><div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-2xl px-4 py-3">Кампанията не може да се отвори: {error.message}</div></div>
  if (!campaign) notFound()

  const { data: access } = await supabase.from('eval_access').select('staff_id, kind').eq('staff_id', me.id)
  const isDirector = me.role === 'director'
  const isManager = ['director', 'zdud', 'admin'].includes(me.role) || (access || []).some((a: any) => a.kind === 'manager')
  const isFinance = isDirector || (access || []).some((a: any) => a.kind === 'finance')

  const [{ data: members }, { data: participants }, { data: templates }] = await Promise.all([
    supabase.from('eval_commission').select('*, staff:staff_profiles(id, first_name, last_name, role, position)').eq('campaign_id', id).order('sort'),
    fetchAll(() => supabase.from('eval_participants').select('*, staff:staff_profiles(id, first_name, last_name, role, position)').eq('campaign_id', id).order('id')),
    supabase.from('eval_templates').select('*').order('sort'),
  ])
  const myRole = (members || []).find((m: any) => m.staff_id === me.id)?.role || null
  const isLead = isManager || myRole === 'chair'
  const isSecretary = campaign.secretary_id === me.id
  const ids = (participants || []).map((x: any) => x.id)
  const { data: scores } = ids.length
    ? await fetchAll(() => supabase.from('eval_scores').select('*').in('participant_id', ids).order('participant_id').order('member_id'))
    : { data: [] as any[] }

  const [{ data: people }, { data: externals }, { data: files }, { data: supports }, { data: others }] = await Promise.all([
    isLead || isSecretary
      ? supabase.from('staff_profiles').select('id, first_name, last_name, role, position').eq('is_active', true).order('first_name')
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('eval_external').select('*').eq('campaign_id', id).order('sort'),
    ids.length ? fetchAll(() => supabase.from('eval_files').select('*').in('participant_id', ids).order('created_at')) : Promise.resolve({ data: [] as any[], error: null }),
    ids.length && campaign.kind === 'attest' ? supabase.from('eval_support').select('*').in('participant_id', ids) : Promise.resolve({ data: [] as any[] }),
    isLead ? supabase.from('eval_campaigns').select('id, name, kind, created_at').neq('id', id).order('created_at', { ascending: false }) : Promise.resolve({ data: [] as any[] }),
  ])
  // предишната кампания от същия вид — за сравнение в „Анализ“
  const prevC = (others || []).find((x: any) => x.kind === campaign.kind && x.created_at < campaign.created_at)
  const { data: prev } = isLead && prevC
    ? await fetchAll(() => supabase.from('eval_participants').select('staff_id, final_total, result, grade, employer_grade').eq('campaign_id', prevC.id).order('staff_id'))
    : { data: [] as any[] }
  const [{ data: funds }, { data: pay }] = isFinance
    ? await Promise.all([
        supabase.from('eval_funds').select('*').eq('campaign_id', id),
        ids.length ? fetchAll(() => supabase.from('eval_pay').select('*').in('participant_id', ids).order('participant_id')) : Promise.resolve({ data: [] as any[], error: null }),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }]

  // Атестиране: кой подлежи — последното атестиране (ЕИС или въведено ръчно), повторно при план за подкрепа,
  // годината на постъпване (НЕИСПУО) и отложените. Без SQL файла 2026-11-11_attest_due.sql последните две ги няма.
  let attestInfo: { last: Record<string, string>; reattest: Record<string, string>; since: Record<string, number>; defer: Record<string, string> } | null = null
  if (campaign.kind === 'attest' && isLead) {
    const [{ data: hist }, { data: done }, { data: sup }, sinceRes, deferRes] = await Promise.all([
      supabase.from('eval_attest_history').select('staff_id, attested_on'),
      fetchAll(() => supabase.from('eval_participants').select('id, staff_id, grade, employer_at, acked_at, finalized_at, campaign:eval_campaigns(kind)').neq('campaign_id', id).not('grade', 'is', null).order('id')),
      supabase.from('eval_support').select('participant_id, status, reattest_by'),
      supabase.rpc('eval_staff_since'),
      supabase.from('eval_attest_defer').select('staff_id, reason'),
    ])
    const last: Record<string, string> = {}, reattest: Record<string, string> = {}, lastPid: Record<string, string> = {}
    const put = (sid: string, iso: string | null, pid = '') => { if (iso && (!last[sid] || iso > last[sid])) { last[sid] = iso; lastPid[sid] = pid } }
    ;(hist || []).forEach((h: any) => put(h.staff_id, h.attested_on))
    ;(done || []).filter((r: any) => r.campaign?.kind === 'attest').forEach((r: any) => put(r.staff_id, (r.employer_at || r.acked_at || r.finalized_at || '').slice(0, 10) || null, r.id))
    Object.entries(lastPid).forEach(([sid, pid]) => {
      const s = pid && (sup || []).find((x: any) => x.participant_id === pid && x.status !== 'done' && x.reattest_by)
      if (s) reattest[sid] = (s as any).reattest_by
    })
    const since: Record<string, number> = {}
    ;(((sinceRes as any).data || []) as any[]).forEach(r => { since[r.staff_id] = r.since_year })
    const defer: Record<string, string> = {}
    ;(((deferRes as any).data || []) as any[]).forEach(r => { defer[r.staff_id] = r.reason })
    attestInfo = { last, reattest, since, defer }
  }

  let scanUrl: string | null = null
  if (campaign.scan_path) {
    const { data } = await supabase.storage.from('evaluation').createSignedUrl(campaign.scan_path, 60 * 30)
    scanUrl = data?.signedUrl || null
  }

  return (
    <CampaignClient
      me={{ id: me.id, role: me.role, name: `${me.first_name} ${me.last_name}` }}
      isDirector={isDirector} isManager={isManager} isFinance={isFinance} isLead={isLead} isSecretary={isSecretary} myRole={myRole as any}
      tab={sp.tab || ''} openP={sp.p || null}
      campaign={campaign as any}
      members={(members || []) as any}
      participants={(participants || []) as any}
      scores={(scores || []) as any}
      templates={(templates || []) as any}
      people={(people || []) as any}
      funds={(funds || []) as any}
      pay={(pay || []) as any}
      scanUrl={scanUrl}
      externals={(externals || []) as any}
      files={(files || []) as any}
      supports={(supports || []) as any}
      others={(others || []) as any}
      prev={{ name: prevC?.name || null, rows: (prev || []) as any }}
      attestInfo={attestInfo}
    />
  )
}
