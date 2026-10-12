import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { BackButton } from '@/components/ui/BackButton'
import CalendarClient, { type CalDay } from './CalendarClient'
export const dynamic = 'force-dynamic'

export default async function SchoolCalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director'].includes(me?.role || '')) redirect('/dashboard')

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()
  let needSql = false
  let res: any = await supabase.from('academic_calendar_days')
    .select('date, is_school_day, spontaneous, notes, term').eq('academic_year_id', cy?.id).order('date')
  if (res.error) {
    needSql = true
    res = await supabase.from('academic_calendar_days')
      .select('date, is_school_day, notes, term').eq('academic_year_id', cy?.id).order('date')
  }
  const days: CalDay[] = (res.data || []).map((d: any) => ({
    date: d.date, school: !!d.is_school_day, spontaneous: !!d.spontaneous, notes: d.notes || '', term: d.term,
  }))

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-6 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
          <CalendarDays size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Учебен календар</h1>
          <p className="text-sm text-slate-500 mt-0.5">{cy?.name} · щракни учебен ден, за да го маркираш като спонтанен неучебен</p>
        </div>
      </header>
      {needSql && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800">
          Пуснете SQL файла 2026-10-12_calendar_spontaneous.sql — дотогава календарът е само за преглед.
        </div>
      )}
      <CalendarClient days={days} readOnly={needSql} />
    </div>
  )
}
