import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { GraduationCap } from 'lucide-react'
import MyLecturerClient from './MyLecturerClient'
export const dynamic = 'force-dynamic'

export default async function MyLecturerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase
    .from('staff_profiles').select('id, first_name, last_name, position').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  // моите лекторски слотове
  const { data: slots } = await supabase
    .from('lecturer_slots')
    .select('id, day, period, holder_label, date_from, date_to, order_number, subject:subjects(name)')
    .eq('staff_id', me.id).eq('academic_year_id', cy?.id).order('day').order('period')
  const mySlots = (slots || []).map((r: any) => ({
    id: r.id, day: r.day, period: r.period, subject: r.subject?.name || '',
    holderLabel: r.holder_label || '', dateFrom: r.date_from, dateTo: r.date_to, orderNumber: r.order_number || '',
  }))

  // предишни декларации
  const { data: decls } = await supabase
    .from('lecturer_declarations')
    .select('id, period_from, period_to, total_hours, status, created_at')
    .eq('staff_id', me.id).order('created_at', { ascending: false })
  const declarations = (decls || []).map((d: any) => ({
    id: d.id, periodFrom: d.period_from, periodTo: d.period_to, totalHours: d.total_hours, status: d.status,
  }))

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
          <GraduationCap size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Лекторски — над норматив</h1>
          <p className="text-sm text-slate-500 mt-0.5">Отчетете реално взетите часове и изтеглете декларация</p>
        </div>
      </header>
      <MyLecturerClient
        teacherName={`${me.first_name} ${me.last_name}`}
        position={me.position || 'Учител/старши учител на ДУИ'}
        slots={mySlots}
        declarations={declarations}
      />
    </div>
  )
}
