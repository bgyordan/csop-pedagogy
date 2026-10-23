// Заседание на ПС / ОС — подготовка, присъствие и кворум, протокол с решенията, вписване в Книгата.
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import MeetingEditor from './MeetingEditor'
export const dynamic = 'force-dynamic'

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')

  const { data: m, error } = await supabase.from('mtg_meetings').select('*, year:academic_years(name)').eq('id', id).maybeSingle()
  if (error) return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-2xl px-4 py-3">Заседанието не може да се отвори: {error.message}</div>
    </div>
  )
  if (!m) notFound()

  const isManager = ['director', 'zdud', 'admin'].includes(me.role || '')
  const isLead = isManager || m.chair_id === me.id || m.secretary_id === me.id
  const canEdit = isLead && m.status !== 'final'

  const [{ data: items }, { data: decisions }, { data: attendance }, { data: people }] = await Promise.all([
    supabase.from('mtg_items').select('*').eq('meeting_id', id).order('sort'),
    supabase.from('mtg_decisions').select('*').eq('meeting_id', id).order('sort'),
    supabase.from('mtg_attendance').select('*').eq('meeting_id', id).order('sort'),
    supabase.from('staff_profiles').select('id, first_name, last_name, role, position, is_active').order('first_name'),
  ])

  // за водещите: материалите за съгласуване и неизпълнените решения от предходните заседания на същия орган
  const [{ data: sets }, { data: prevOpen }] = isLead
    ? await Promise.all([
        supabase.from('council_sets').select('id, title, event_date').eq('is_archived', false).order('event_date', { ascending: false, nullsFirst: false }).limit(30),
        supabase.from('mtg_decisions')
          .select('id, text, responsible_id, due_date, task_status, report, meeting_id, meeting:mtg_meetings!inner(body, meeting_no, meeting_date, status)')
          .eq('meeting.status', 'final').eq('meeting.body', m.body).lt('meeting.meeting_date', m.meeting_date)
          .in('task_status', ['open', 'reported', 'not_done']).neq('kind', 'noted').neq('outcome', 'rejected')
          .order('due_date', { ascending: true, nullsFirst: false }).limit(60),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }]

  let scanUrl: string | null = null
  if (m.scan_path) {
    const { data } = await supabase.storage.from('meetings').createSignedUrl(m.scan_path, 60 * 30)
    scanUrl = data?.signedUrl || null
  }

  return (
    <MeetingEditor
      meId={me.id}
      isManager={isManager}
      canEdit={canEdit}
      isLead={isLead}
      meeting={m as any}
      yearName={(m as any).year?.name || ''}
      items={(items || []) as any}
      decisions={(decisions || []) as any}
      attendance={(attendance || []) as any}
      people={(people || []) as any}
      sets={(sets || []) as any}
      prevOpen={(prevOpen || []) as any}
      scanUrl={scanUrl}
    />
  )
}
