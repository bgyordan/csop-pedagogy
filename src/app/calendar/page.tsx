// Професионален календар: собствени и общи събития (с покани и отговори) + сроковете и събитията от
// останалите модули — учебен календар, съвети и заседания, контролна дейност, оценяване, портфолио,
// посещения на час, дежурства, график срокове. Изгледи: месец, седмица, ден, списък.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CalendarClient from './CalendarClient'
import type { CalView } from '@/lib/calendar'
export const dynamic = 'force-dynamic'

const VIEWS: CalView[] = ['month', 'week', 'day', 'agenda']

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; event?: string; new?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, first_name, last_name, is_coordinator').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')

  const [{ error }, { data: staff }] = await Promise.all([
    supabase.from('cal_events').select('id').limit(1),
    supabase.from('staff_profiles').select('id, first_name, last_name, role, position').eq('is_active', true).order('first_name'),
  ])

  return (
    <CalendarClient
      me={{ id: me.id, role: me.role, isCoordinator: me.is_coordinator === true, name: `${me.first_name} ${me.last_name}` }}
      staff={(staff || []) as any[]}
      needSql={!!error}
      initialView={VIEWS.includes(sp.view as CalView) ? (sp.view as CalView) : null}
      openNew={sp.new === '1'}
      initialDate={/^\d{4}-\d{2}-\d{2}$/.test(sp.date || '') ? sp.date! : null}
    />
  )
}
