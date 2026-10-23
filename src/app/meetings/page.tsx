// Заседания на Педагогическия съвет и Общото събрание — график, решения за изпълнение, Книга с протоколи.
// Ръководството създава и води заседанията; всички виждат насрочените заседания, дневния ред и
// окончателните протоколи, а отговорниците — своите решения за отчитане.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MeetingsClient from './MeetingsClient'
export const dynamic = 'force-dynamic'

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; y?: string; b?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, first_name, last_name').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const isManager = ['director', 'zdud', 'admin'].includes(me.role || '')

  const { data: years } = await supabase.from('academic_years').select('id, name, is_current').order('start_date', { ascending: false })
  const year: any = (years || []).find((y: any) => y.id === sp.y) || (years || []).find((y: any) => y.is_current) || (years || [])[0] || null

  let q = supabase.from('mtg_meetings').select('*').order('meeting_date', { ascending: false }).order('start_time', { ascending: false, nullsFirst: false })
  if (year) q = q.eq('academic_year_id', year.id)
  const { data: meetings, error } = await q
  if (error) return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">
        „Заседания на ПС и ОС“ още не са подготвени в базата — пуснете SQL файла <b>2026-10-30_meetings.sql</b>.
      </div>
    </div>
  )

  const ids = (meetings || []).map((m: any) => m.id)
  const [{ data: items }, { data: decCounts }] = ids.length
    ? await Promise.all([
        supabase.from('mtg_items').select('id, meeting_id, sort, title').in('meeting_id', ids).order('sort'),
        supabase.from('mtg_decisions').select('id, meeting_id').in('meeting_id', ids),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }]

  // решенията за изпълнение (всички години — неприключените се пренасят)
  const decSel = 'id, meeting_id, item_id, sort, text, kind, outcome, responsible_id, due_date, task_status, report, reported_at, review_note, reviewed_at, meeting:mtg_meetings!inner(id, body, meeting_no, meeting_date, status)'
  let dq = supabase.from('mtg_decisions').select(decSel).eq('meeting.status', 'final').neq('outcome', 'rejected').neq('kind', 'noted')
    .or('responsible_id.not.is.null,due_date.not.is.null')
    .order('due_date', { ascending: true, nullsFirst: false })
  if (!isManager) dq = dq.eq('responsible_id', me.id)
  const { data: tasks } = await dq

  const { data: people } = await supabase.from('staff_profiles').select('id, first_name, last_name, role, position, is_active').order('first_name')

  return (
    <MeetingsClient
      me={{ id: me.id, role: me.role, name: `${me.first_name} ${me.last_name}` }}
      isManager={isManager}
      tab={sp.tab || 'meetings'}
      body={sp.b === 'ps' || sp.b === 'os' ? sp.b : 'all'}
      years={(years || []) as any}
      year={year}
      meetings={(meetings || []) as any}
      items={(items || []) as any}
      decCounts={(decCounts || []) as any}
      tasks={(tasks || []) as any}
      people={(people || []) as any}
    />
  )
}
