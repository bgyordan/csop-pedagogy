import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Eye } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import { MyScheduleView } from './MyScheduleView'
export const dynamic = 'force-dynamic'

export default async function MySchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; staff?: string }>
}) {
  const { term: termParam, staff: staffParam } = await searchParams
  const term = termParam === '2' ? 2 : 1
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: me } = await supabase
    .from('staff_profiles').select('id, role, first_name, last_name').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')

  const isManager = ['admin', 'zdud', 'director'].includes(me.role)
  let target = me
  let viewingOther = false
  if (staffParam && staffParam !== me.id) {
    if (!isManager) redirect('/dashboard')
    const { data: other } = await supabase
      .from('staff_profiles').select('id, role, first_name, last_name').eq('id', staffParam).single()
    if (!other) redirect('/schedules?tab=teachers')
    target = other
    viewingOther = true
  }

  const { data: currentYear } = await supabase
    .from('academic_years').select('id, name').eq('is_current', true).single()

  // Всички разписания за текущата година и срок (НЕ само на паралелките, на които
  // учителят е класен). Учителят пише слотове със staff_id=аз и в ЧУЖДИ паралелки
  // (active-holder модел), затова слотовете се търсят по staff_id навсякъде, а
  // името на паралелката се взима от самото разписание.
  const { data: allSchedules } = await supabase
    .from('class_schedules').select('id, class:classes(name)')
    .eq('academic_year_id', currentYear?.id).eq('term', term)
  const scheduleNameById: Record<string, string> = {}
  ;(allSchedules || []).forEach((s: any) => { scheduleNameById[s.id] = s.class?.name || '' })
  const scheduleIds = (allSchedules || []).map((s: any) => s.id)

  let classSlots: any[] = []
  if (scheduleIds.length > 0) {
    const { data: slots } = await supabase
      .from('schedule_slots').select('schedule_id, day, period, subject:subjects(name, allows_pullout)')
      .in('schedule_id', scheduleIds).eq('staff_id', target.id)
    classSlots = (slots || []).map((s: any) => ({
      source: 'class' as const, day: s.day, period: s.period,
      subjectName: s.subject?.name || '', allowsPullout: s.subject?.allows_pullout || false,
      label: scheduleNameById[s.schedule_id] || '',
    }))
  }

  const { data: ifoSlots } = await supabase
    .from('teacher_ifo_slots')
    .select('day, period, subject:subjects(name, allows_pullout), student:students(first_name, middle_name, last_name)')
    .eq('teacher_id', target.id).eq('academic_year_id', currentYear?.id).eq('term', term)
  const ifoView = (ifoSlots || []).map((s: any) => ({
    source: 'ifo' as const, day: s.day, period: s.period,
    subjectName: s.subject?.name || '', allowsPullout: s.subject?.allows_pullout || false,
    label: s.student ? getFullName(s.student) : '',
  }))

  const hasClasses = classSlots.length > 0

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <Link href={viewingOther ? '/schedules?tab=teachers' : '/dashboard'} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} /> {viewingOther ? 'Назад към Разписания' : 'Назад'}
      </Link>
      {viewingOther && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-sm">
          <Eye size={15} /> Преглед на разписанието на служителя (само за четене)
        </div>
      )}
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}>
          <CalendarDays size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">{viewingOther ? 'Разписание' : 'Моето разписание'}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{target.first_name} {target.last_name} · {currentYear?.name}</p>
        </div>
      </div>
      <MyScheduleView term={term} classSlots={classSlots} ifoSlots={ifoView} hasClasses={hasClasses} staffId={viewingOther ? target.id : undefined} staffName={`${target.first_name} ${target.last_name}`} yearName={currentYear?.name} />
    </div>
  )
}
