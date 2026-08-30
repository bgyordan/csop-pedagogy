import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { CalendarClock } from 'lucide-react'
import MySubstitutionsClient from './MySubstitutionsClient'
export const dynamic = 'force-dynamic'
export interface MySubRow {
  id: string
  absentName: string
  dateFrom: string
  dateTo: string
  reason: string
  bsch: boolean
  hasOrder: boolean
}
export default async function MySubstitutionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase
    .from('staff_profiles').select('id, first_name, last_name').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')

  const { data } = await supabase
    .from('substitutions')
    .select(`id, date_from, date_to, reason, bsch_eligible, substitution_order_id,
      absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name)`)
    .eq('substitute_staff_id', me.id)
    .order('date_from', { ascending: false })

  const rows: MySubRow[] = (data || []).map((r: any) => ({
    id: r.id,
    absentName: r.absent ? `${r.absent.first_name} ${r.absent.last_name}` : '—',
    dateFrom: r.date_from, dateTo: r.date_to, reason: r.reason,
    bsch: r.bsch_eligible === true, hasOrder: !!r.substitution_order_id,
  }))

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
          <CalendarClock size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Моите замествания</h1>
          <p className="text-sm text-slate-500 mt-0.5">Замествания, в които участвате — изтеглете декларация за плащане</p>
        </div>
      </header>
      <MySubstitutionsClient rows={rows} />
    </div>
  )
}
