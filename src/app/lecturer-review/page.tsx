import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { ClipboardCheck } from 'lucide-react'
import ReviewClient from './ReviewClient'
export const dynamic = 'force-dynamic'

export default async function LecturerReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director', 'secretary'].includes(me?.role || '')) redirect('/dashboard')

  const { data } = await supabase
    .from('lecturer_declarations')
    .select('id, period_from, period_to, total_hours, status, created_at, staff:staff_profiles!lecturer_declarations_staff_id_fkey(first_name, last_name)')
    .order('created_at', { ascending: false })
  const rows = (data || []).map((d: any) => ({
    id: d.id,
    staffName: d.staff ? `${d.staff.first_name} ${d.staff.last_name}` : '—',
    periodFrom: d.period_from, periodTo: d.period_to, totalHours: d.total_hours, status: d.status,
  }))

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
          <ClipboardCheck size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Проверка на лекторски декларации</h1>
          <p className="text-sm text-slate-500 mt-0.5">Сверете взетите часове с НЕИСПУО и потвърдете</p>
        </div>
      </header>
      <ReviewClient rows={rows} />
    </div>
  )
}
