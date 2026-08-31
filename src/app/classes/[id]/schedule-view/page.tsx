import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { getFullName } from '@/lib/utils'
import ClassScheduleView from './ClassScheduleView'
export const dynamic = 'force-dynamic'

export default async function ClassScheduleViewPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ term?: string }> }) {
  const { id } = await params
  const { term: termParam } = await searchParams
  const term = termParam === '2' ? 2 : 1
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const { data: cls } = await supabase.from('classes').select('id, name').eq('id', id).single()
  if (!cls) notFound()

  const { data: sched } = await supabase
    .from('class_schedules').select('id')
    .eq('class_id', id).eq('academic_year_id', cy?.id).eq('term', term).maybeSingle()

  let slots: any[] = []
  let maxPeriod = 6
  if (sched) {
    const { data: rows } = await supabase
      .from('schedule_slots')
      .select('day, period, subject:subjects(name, allows_pullout), staff:staff_profiles(first_name, last_name)')
      .eq('schedule_id', sched.id)
    slots = (rows || []).map((r: any) => ({
      day: r.day, period: r.period,
      subjectName: r.subject?.name || '', allowsPullout: r.subject?.allows_pullout || false,
      teacher: r.staff ? `${r.staff.first_name} ${r.staff.last_name}` : '',
    }))
    if (slots.some((s: any) => s.period === 7)) maxPeriod = 7
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="mt-2 mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Разписание · Паралелка {cls.name}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{cy?.name} · сглобено от разписанията на учителите</p>
      </header>
      <ClassScheduleView term={term} slots={slots} className={cls.name} yearName={cy?.name || ''} maxPeriod={maxPeriod} classId={id} />
    </div>
  )
}
