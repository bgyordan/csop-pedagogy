import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { CalendarClock } from 'lucide-react'
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
  noHours?: boolean   // заповедта е издадена без часове (разписанието беше непълно)
  bsch: boolean
  manualNumber: string | null
  manualDate: string | null
  noOrder: boolean
  overNorm: boolean
  // няколко заместника — периоди по заместник (празно = един заместник)
  assigns: { staffId: string; name: string; from: string; to: string }[]
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
    .select('substitution_id, substitute_staff_id, date_from, date_to, sub:staff_profiles!substitution_assignments_substitute_staff_id_fkey(first_name, last_name)')
    .order('date_from')
  const assignsBy: Record<string, SubRow['assigns']> = {}
  ;(asg || []).forEach((a: any) => {
    ;(assignsBy[a.substitution_id] ||= []).push({
      staffId: a.substitute_staff_id,
      name: a.sub ? `${a.sub.first_name} ${a.sub.last_name}` : '—',
      from: a.date_from, to: a.date_to,
    })
  })

  // заповеди, издадени без часове — за лилавото отличаване в списъка
  const { data: nh } = await supabase.from('orders').select('id').eq('without_hours', true)
  const noHoursIds = new Set((nh || []).map((o: any) => o.id))

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
    noHours: !!r.substitution_order_id && noHoursIds.has(r.substitution_order_id),
    bsch: r.bsch_eligible === true,
    manualNumber: r.manual_order_number || null,
    manualDate: r.manual_order_date || null,
    noOrder: r.no_order_needed === true,
    overNorm: r.over_norm !== false,
    assigns: assignsBy[r.id] || [],
  }))

  const { data: staff } = await supabase
    .from('staff_profiles').select('id, first_name, last_name, role').eq('is_active', true)

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
          <CalendarClock size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Замествания</h1>
          <p className="text-sm text-slate-500 mt-0.5">Отсъстващи, заместници и заповеди за заместване</p>
        </div>
      </header>
      <SubstitutionsClient rows={rows} staff={staff || []} />
    </div>
  )
}
