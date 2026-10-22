// Контролна дейност — проверки, констативни протоколи и Книга за контролната дейност.
// Проверяващите (директор, ЗДУД и определените от директора) виждат своите проверки (директорът — всички);
// останалите служители — само подписаните протоколи за себе си (запознаване и възражение).
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ControlClient from './ControlClient'
export const dynamic = 'force-dynamic'

export default async function ControlPage({ searchParams }: { searchParams: Promise<{ tab?: string; y?: string; visit?: string; item?: string; owner?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, first_name, last_name, position').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')

  const { data: inspectors, error } = await supabase.from('control_inspectors').select('staff_id')
  if (error) return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">„Контролна дейност“ още не е подготвена в базата — пуснете SQL файла 2026-10-22_control_activity.sql.</div>
    </div>
  )
  const isDirector = me.role === 'director'
  const isInspector = isDirector || me.role === 'zdud' || (inspectors || []).some((i: any) => i.staff_id === me.id)

  const { data: years } = await supabase.from('academic_years').select('id, name, is_current').order('start_date', { ascending: false })
  const year: any = (years || []).find((y: any) => y.id === sp.y) || (years || []).find((y: any) => y.is_current) || (years || [])[0] || null

  let q = supabase.from('control_checks')
    .select('*, inspector:staff_profiles(first_name, last_name, position), staff:control_check_staff(staff_id, acked_at, objection, objection_at, staff:staff_profiles(first_name, last_name, position))')
    .order('check_date', { ascending: false })
  if (year) q = q.eq('academic_year_id', year.id)
  const { data: checks } = await q

  // препоръките от подписаните протоколи (всички години — неприключените се пренасят)
  const recSel = '*, responsible:staff_profiles(first_name, last_name), check:control_checks!control_recommendations_check_id_fkey!inner(id, book_no, subject, signed_at, status, inspector_id, academic_year_id)'
  const { data: recs } = isInspector
    ? await supabase.from('control_recommendations').select(recSel).eq('check.status', 'signed').order('due_date', { ascending: true, nullsFirst: false })
    : await supabase.from('control_recommendations').select(recSel).eq('check.status', 'signed').eq('responsible_id', me.id).order('due_date', { ascending: true, nullsFirst: false })

  const [{ data: templates }, { data: people }] = isInspector
    ? await Promise.all([
        supabase.from('control_templates').select('*').order('sort'),
        supabase.from('staff_profiles').select('id, first_name, last_name, role, position').eq('is_active', true).order('first_name'),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }]

  // годишни планове (директорът вижда всички, проверяващият — своя); при липсваща миграция — празно
  let plans: any[] = [], planItems: any[] = [], planReady = false
  if (isInspector && year) {
    const { data, error: pe } = await supabase.from('control_plans').select('*, owner:staff_profiles(first_name, last_name, role, position)').eq('academic_year_id', year.id)
    planReady = !pe
    plans = data || []
    if (plans.length) {
      const { data: it } = await supabase.from('control_plan_items').select('*').in('plan_id', plans.map(x => x.id)).order('month').order('sort')
      planItems = it || []
    }
  }

  const { data: closure } = isInspector && year
    ? await supabase.from('control_book_closures').select('*').eq('academic_year_id', year.id).maybeSingle()
    : { data: null }
  const { data: selfRequests } = await supabase.rpc('control_self_requests')

  // протокол от посещение на час: ?visit=<booking id>
  let visit: any = null
  if (isInspector && sp.visit) {
    const { data } = await supabase.from('visit_bookings').select('id, staff_id, date, period, class_name, subject, topic').eq('id', sp.visit).maybeSingle()
    visit = data
    if (visit) {
      const { data: existing } = await supabase.from('control_checks').select('id').eq('visit_booking_id', visit.id).limit(1)
      if (existing?.length) redirect(`/control/${existing[0].id}`)
    }
  }

  return (
    <ControlClient
      me={{ id: me.id, role: me.role, name: `${me.first_name} ${me.last_name}`, position: me.position || '' }}
      isDirector={isDirector}
      isInspector={isInspector}
      tab={sp.tab || 'checks'}
      years={(years || []) as any}
      year={year}
      checks={(checks || []) as any}
      recs={(recs || []) as any}
      templates={(templates || []) as any}
      people={(people || []) as any}
      inspectorIds={(inspectors || []).map((i: any) => i.staff_id)}
      visit={visit}
      plans={plans}
      planItems={planItems}
      planReady={planReady}
      itemParam={sp.item || null}
      ownerParam={sp.owner || null}
      closure={(closure as any) || null}
      selfRequests={(selfRequests as any) || []}
    />
  )
}
