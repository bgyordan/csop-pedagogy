import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Eye } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import { MyScheduleView } from './MyScheduleView'
import EducatorScheduleView from './EducatorScheduleView'
import ScheduleTabs from './ScheduleTabs'
import { isScheduleLocked } from '@/lib/curriculum'
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

  // паралелките, на които е класен (табове „Паралелка X“)
  const { data: cta } = await supabase.from('class_teacher_assignments')
    .select('class:classes(id, name)').eq('staff_id', target.id).eq('academic_year_id', currentYear?.id)
  const myClasses = (cta || []).map((a: any) => a.class).filter(Boolean)
    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg')) as { id: string; name: string }[]
  // „Редактирай“: собственото разписание (учител/класен) или от името на друг (админ/ЗДУД)
  // Свое: учител/класен, управата (и тя има преподавателска заетост) и всеки с часове в паралелки по учебния план
  const { count: planCount } = await supabase.from('curriculum_lines').select('id', { count: 'exact', head: true })
    .eq('academic_year_id', currentYear?.id).eq('staff_id', target.id).not('class_id', 'is', null)
  // утвърдено разписание за срока — учителите само гледат, управата продължава да редактира
  const lock = await isScheduleLocked(supabase, currentYear?.id, term)
  const meManager = ['admin', 'zdud', 'director'].includes(me.role)
  const canEdit = viewingOther
    ? meManager
    : me.role !== 'educator' && (!lock || meManager) && (['class_teacher', 'teacher', 'admin', 'zdud', 'director'].includes(me.role) || (planCount || 0) > 0)
  const editHref = `/my-schedule/edit${[viewingOther ? `staff=${target.id}` : '', term === 2 ? 'term=2' : ''].filter(Boolean).join('&').replace(/^./, m => '?' + m)}`

  const isEducator = target.role === 'educator'
  let educatorView: { day: number; period: number; activity: string }[] = []
  if (isEducator) {
    const { data: eduSlots } = await supabase
      .from('educator_slots').select('day, period, activity')
      .eq('educator_id', target.id).eq('academic_year_id', currentYear?.id).eq('term', term)
    educatorView = (eduSlots || []).map((s: any) => ({ day: s.day, period: s.period, activity: s.activity }))
  }

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
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Разписание</h1>
          <p className="text-slate-500 text-sm mt-0.5">{target.first_name} {target.last_name} · {currentYear?.name}</p>
        </div>
      </div>
      {lock && !isEducator && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          Разписанието за {term === 2 ? 'II' : 'I'} срок е утвърдено{lock.by ? ` (${lock.by}, ${new Date(lock.locked_at).toLocaleDateString('bg-BG')})` : ''}{meManager ? ' — управата може да го променя.' : ' — промени само чрез управата.'}
        </div>
      )}
      {!isEducator && (
        <ScheduleTabs current="mine" classes={myClasses} staffId={viewingOther ? target.id : undefined} term={term} editHref={canEdit ? editHref : undefined} />
      )}
      {isEducator ? (
        <EducatorScheduleView term={term} slots={educatorView} staffId={viewingOther ? target.id : undefined} staffName={`${target.first_name} ${target.last_name}`} yearName={currentYear?.name} />
      ) : (
        <MyScheduleView term={term} classSlots={classSlots} ifoSlots={ifoView} hasClasses={hasClasses} staffId={viewingOther ? target.id : undefined} staffName={`${target.first_name} ${target.last_name}`} yearName={currentYear?.name} />
      )}
    </div>
  )
}
