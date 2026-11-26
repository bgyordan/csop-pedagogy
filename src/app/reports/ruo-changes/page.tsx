import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RuoChangesClient from './RuoChangesClient'
import { loadCurrentState } from './state'
import { computeChanges, detailKey, type ChangeDetail, type RuoClass } from '@/lib/ruo-changes'
export const dynamic = 'force-dynamic'

export default async function RuoChangesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!me || !['admin', 'zdud', 'director'].includes(me.role)) redirect('/dashboard')

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()
  const current = cy ? await loadCurrentState(supabase, cy.id) : []

  const { data: snaps } = await supabase.from('ruo_snapshots')
    .select('id, out_number, out_date, note, created_at, data')
    .eq('academic_year_id', cy?.id)
    .order('created_at', { ascending: false })

  const history = (snaps || []).map((s: any) => ({
    id: s.id as string,
    outNumber: (s.out_number || '') as string,
    outDate: (s.out_date || '') as string,
    note: (s.note || '') as string,
    createdAt: s.created_at as string,
    total: ((s.data || []) as RuoClass[]).reduce((a, c) => a + c.students.length, 0),
  }))
  const base = snaps?.[0]
  const changes = base ? computeChanges(base.data as RuoClass[], current) : []

  const details: Record<string, ChangeDetail> = {}
  if (base) {
    const { data: rows } = await supabase.from('ruo_change_details').select('*').eq('snapshot_id', base.id)
    ;(rows || []).forEach((r: any) => {
      details[detailKey(r.student_id, r.kind)] = {
        studentId: r.student_id, kind: r.kind,
        parentName: r.parent_name || '', applicationNo: r.application_no || '',
        opinionNo: r.opinion_no || '', opinionInNo: r.opinion_in_no || '', orderNo: r.order_no || '',
      }
    })
  }

  return (
    <RuoChangesClient
      yearName={cy?.name || ''}
      baseId={base?.id || null}
      history={history}
      changes={changes}
      details={details}
      currentTotal={current.reduce((a, c) => a + c.students.length, 0)}
    />
  )
}
