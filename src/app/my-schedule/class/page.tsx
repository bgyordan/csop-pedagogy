import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import ClassScheduleView from '@/app/classes/[id]/schedule-view/ClassScheduleView'
import ScheduleTabs from '../ScheduleTabs'
export const dynamic = 'force-dynamic'

// „Разписание → Паралелка X“: разписанието на паралелката на класния (само за четене),
// сглобено от часовете на всички учители.
export default async function MyClassSchedulePage({
  searchParams,
}: { searchParams: Promise<{ c?: string; term?: string; staff?: string }> }) {
  const { c, term: termParam, staff: staffParam } = await searchParams
  const term = termParam === '2' ? 2 : 1
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const isManager = ['admin', 'zdud', 'director'].includes(me.role)
  const targetId = staffParam && isManager ? staffParam : me.id
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const { data: cta } = await supabase.from('class_teacher_assignments')
    .select('class:classes(id, name)').eq('staff_id', targetId).eq('academic_year_id', cy?.id)
  const myClasses = (cta || []).map((a: any) => a.class).filter(Boolean)
    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg')) as { id: string; name: string }[]
  const cls = myClasses.find(x => x.id === c) || myClasses[0]
  if (!cls) redirect(`/my-schedule${staffParam && isManager ? `?staff=${staffParam}` : ''}`)

  const { data: sched } = await supabase.from('class_schedules').select('id')
    .eq('class_id', cls.id).eq('academic_year_id', cy?.id).eq('term', term).maybeSingle()
  let slots: any[] = []
  let maxPeriod = 6
  if (sched) {
    const { data: rows } = await supabase.from('schedule_slots')
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
      <div className="mb-5 flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><Users size={20} className="text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Разписание</h1>
          <p className="text-slate-500 text-sm mt-0.5">Паралелка {cls.name} · {cy?.name} · сглобено от часовете на всички учители</p>
        </div>
      </div>
      <ScheduleTabs current={cls.id} classes={myClasses} staffId={staffParam && isManager ? staffParam : undefined} term={term} />
      <ClassScheduleView term={term} slots={slots} className={cls.name} yearName={cy?.name || ''} maxPeriod={maxPeriod} classId={cls.id} extraQuery={`&c=${cls.id}${staffParam && isManager ? `&staff=${staffParam}` : ''}`} />
    </div>
  )
}
