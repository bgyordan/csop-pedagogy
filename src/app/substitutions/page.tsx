import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { CalendarClock } from 'lucide-react'
import SubstitutionsClient from './SubstitutionsClient'
export const dynamic = 'force-dynamic'
export interface SubRow {
  id: string
  absentName: string
  substituteName: string | null
  substituteId: string | null
  dateFrom: string
  dateTo: string
  reason: string
  hasOrder: boolean
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
    .select(`id, date_from, date_to, reason, substitute_staff_id, substitution_order_id,
      absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name),
      sub:staff_profiles!substitutions_substitute_staff_id_fkey(first_name, last_name)`)
    .order('date_from', { ascending: false })

  const rows: SubRow[] = (data || []).map((r: any) => ({
    id: r.id,
    absentName: r.absent ? `${r.absent.first_name} ${r.absent.last_name}` : '—',
    substituteName: r.sub ? `${r.sub.first_name} ${r.sub.last_name}` : null,
    substituteId: r.substitute_staff_id,
    dateFrom: r.date_from,
    dateTo: r.date_to,
    reason: r.reason,
    hasOrder: !!r.substitution_order_id,
  }))

  const { data: staff } = await supabase
    .from('staff_profiles').select('id, first_name, last_name').eq('is_active', true)

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto animate-in fade-in duration-500">
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
