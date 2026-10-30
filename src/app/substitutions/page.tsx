import { createClient } from '@/lib/supabase/server'
import { teachingStaffIds } from '@/lib/teaching-staff'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import SubstitutionsClient from './SubstitutionsClient'
export const dynamic = 'force-dynamic'
export interface SubRow {
  id: string
  absentName: string
  absentStaffId: string
  absentRole: string | null
  substituteName: string | null
  substituteId: string | null
  dateFrom: string
  dateTo: string
  reason: string
  hasOrder: boolean
  orderNumber?: string | null   // номер на заповедта РД-08 от регистъра („041/12.10.2026г.“)
  noHours?: boolean   // заповедта е издадена без часове (разписанието беше непълно)
  bsch: boolean
  manualNumber: string | null
  manualDate: string | null
  noOrder: boolean
  overNorm: boolean
  // няколко заместника — периоди по заместник (празно = един заместник)
  assigns: { staffId: string; name: string; from: string; to: string; periods?: number[] | null; orderId?: string | null }[]
  // заместник на заместника: колега, който поема дни след издадената заповед → своя заповед
  partOrders: { staffId: string; name: string; from: string; to: string; orderNumber: string | null }[]
  // заместник, който отсъства в дни, в които замества тук → кой поема
  conflicts: { staffId: string; name: string; from: string; to: string }[]
}
export default async function SubstitutionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  const canManage = ['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')
  if (!canManage) redirect('/dashboard')

  const { data } = await supabase
    .from('substitutions')
    .select(`id, date_from, date_to, reason, absent_staff_id, substitute_staff_id, substitution_order_id, manual_order_number, manual_order_date, no_order_needed, bsch_eligible, over_norm,
      absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name, role),
      sub:staff_profiles!substitutions_substitute_staff_id_fkey(first_name, last_name)`)
    .order('date_from', { ascending: false })

  // разпределение при няколко заместника — зарежда се заедно със списъка (без да се отваря редакция)
  const { data: asg } = await supabase
    .from('substitution_assignments')
    .select('*, sub:staff_profiles!substitution_assignments_substitute_staff_id_fkey(first_name, last_name)')
    .order('date_from')
  const assignsBy: Record<string, SubRow['assigns']> = {}
  ;(asg || []).forEach((a: any) => {
    ;(assignsBy[a.substitution_id] ||= []).push({
      staffId: a.substitute_staff_id,
      name: a.sub ? `${a.sub.first_name} ${a.sub.last_name}` : '—',
      from: a.date_from, to: a.date_to, periods: a.periods?.length ? a.periods : null, orderId: 'order_id' in a ? (a.order_id ?? null) : undefined,
    })
  })

  // заповеди, издадени без часове — за лилавото отличаване в списъка
  const { data: nh } = await supabase.from('orders').select('id').eq('without_hours', true)
  const noHoursIds = new Set((nh || []).map((o: any) => o.id))

  // номерата на заповедите — за колона „Заповед“ в списъка
  const orderIds = Array.from(new Set([
    ...(data || []).map((r: any) => r.substitution_order_id),
    ...(asg || []).map((a: any) => a.order_id),
  ].filter(Boolean))) as string[]
  const orderNum: Record<string, string> = {}
  for (let i = 0; i < orderIds.length; i += 200) {
    const { data: os } = await supabase.from('orders').select('id, number').in('id', orderIds.slice(i, i + 200))
    ;(os || []).forEach((o: any) => { orderNum[o.id] = o.number || '' })
  }

  // кой кога отсъства (по регистъра) — за „заместник на заместника“
  const absencesBy: Record<string, { id: string; from: string; to: string }[]> = {}
  ;(data || []).forEach((r: any) => { (absencesBy[r.absent_staff_id] ||= []).push({ id: r.id, from: r.date_from, to: r.date_to }) })
  const fmtNm = (p: any) => p ? `${p.first_name} ${p.last_name}` : '—'
  function conflictsOf(r: any) {
    const cov = (assignsBy[r.id] || []).length
      ? assignsBy[r.id].map(a => ({ staffId: a.staffId, name: a.name, from: a.from, to: a.to }))
      : r.substitute_staff_id ? [{ staffId: r.substitute_staff_id, name: fmtNm(r.sub), from: r.date_from, to: r.date_to }] : []
    const out: SubRow['conflicts'] = []
    cov.forEach(c => (absencesBy[c.staffId] || []).forEach(a => {
      if (a.id === r.id || a.to < c.from || a.from > c.to) return
      const from = a.from > c.from ? a.from : c.from, to = a.to < c.to ? a.to : c.to
      if (!out.some(x => x.staffId === c.staffId && x.from === from && x.to === to)) out.push({ staffId: c.staffId, name: c.name, from, to })
    }))
    return out
  }
  // части след издадената заповед: редовете без своя заповед (или със своя, различна от основната)
  function partOrdersOf(r: any) {
    if (!r.substitution_order_id) return []
    const by: Record<string, SubRow['partOrders'][number]> = {}
    ;(assignsBy[r.id] || []).forEach(a => {
      if (a.orderId === r.substitution_order_id || a.orderId === undefined) return
      const k = `${a.staffId}|${a.orderId || ''}`
      const cur = by[k]
      if (!cur) by[k] = { staffId: a.staffId, name: a.name, from: a.from, to: a.to, orderNumber: a.orderId ? (orderNum[a.orderId] || null) : null }
      else { if (a.from < cur.from) cur.from = a.from; if (a.to > cur.to) cur.to = a.to }
    })
    return Object.values(by)
  }

  const rows: SubRow[] = (data || []).map((r: any) => ({
    id: r.id,
    absentName: r.absent ? `${r.absent.first_name} ${r.absent.last_name}` : '—',
    absentStaffId: r.absent_staff_id,
    absentRole: r.absent?.role || null,
    substituteName: r.sub ? `${r.sub.first_name} ${r.sub.last_name}` : null,
    substituteId: r.substitute_staff_id,
    dateFrom: r.date_from,
    dateTo: r.date_to,
    reason: r.reason,
    hasOrder: !!r.substitution_order_id,
    orderNumber: r.substitution_order_id ? (orderNum[r.substitution_order_id] || null) : null,
    noHours: !!r.substitution_order_id && noHoursIds.has(r.substitution_order_id),
    bsch: r.bsch_eligible === true,
    manualNumber: r.manual_order_number || null,
    manualDate: r.manual_order_date || null,
    noOrder: r.no_order_needed === true,
    overNorm: r.over_norm !== false,
    assigns: assignsBy[r.id] || [],
    partOrders: partOrdersOf(r),
    conflicts: conflictsOf(r),
  }))

  const { data: staffRaw } = await supabase
    .from('staff_profiles').select('id, first_name, last_name, role').eq('is_active', true)
  // с преподавателска заетост (разписание / ИЧ / учебен план) — заместват се, независимо от ролята
  const teaching = await teachingStaffIds(supabase)
  const staff = (staffRaw || []).map((s: any) => ({ ...s, teaching: teaching.has(s.id) }))

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="mb-5 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] text-slate-500 uppercase tracking-widest">Лекторски</div>
          <h1 className="text-2xl font-light text-[#0f2240] leading-tight mt-0.5">Замествания</h1>
        </div>
        <div className="text-sm text-slate-500 tabular-nums">
          {rows.length} записа
        </div>
      </header>
      <SubstitutionsClient rows={rows} staff={staff || []} />
    </div>
  )
}
