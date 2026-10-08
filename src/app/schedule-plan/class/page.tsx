import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'
import { loadPlanCards, isScheduleLocked } from '@/lib/curriculum'
import ClassPlanEditor from './ClassPlanEditor'
import { fetchAll } from '@/lib/supabase/fetch-all'
export const dynamic = 'force-dynamic'

// „Разписание по план“ → паралелка: управата нарежда всички предмети на паралелката от учебния план;
// часът се записва на учителя от плана (виждат го и в своето разписание).
export default async function ClassPlanPage({ searchParams }: { searchParams: Promise<{ c?: string; term?: string }> }) {
  const { c, term: termParam } = await searchParams
  const term = termParam === '2' ? 2 : 1
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me || !['admin', 'zdud', 'director'].includes(me.role)) redirect('/dashboard')
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const { data: classesRaw } = await supabase.from('classes').select('id, name').eq('academic_year_id', cy?.id)
  const classes = ((classesRaw || []) as { id: string; name: string }[]).sort((a, b) => a.name.localeCompare(b.name, 'bg', { numeric: true }))
  const cls = classes.find(x => x.id === c) || classes[0]
  if (!cls) redirect('/schedule-plan')

  const { data: subjects } = await supabase.from('subjects').select('id, name, allows_pullout').order('name')
  const cards = await loadPlanCards(supabase, cy?.id, { classId: cls.id }, term, subjects || [])

  // часовете на паралелката (от всички учители)
  const { data: scheds } = await supabase.from('class_schedules').select('id, class_id, class:classes(name)')
    .eq('academic_year_id', cy?.id).eq('term', term)
  const mine = (scheds || []).find((s: any) => s.class_id === cls.id)
  let slots: any[] = []
  if (mine) {
    const { data: rows } = await supabase.from('schedule_slots')
      .select('id, day, period, staff_id, subject_id, is_group, subject:subjects(name), staff:staff_profiles(first_name, last_name)')
      .eq('schedule_id', mine.id)
    slots = (rows || []).map((r: any) => ({
      id: r.id, day: r.day, period: r.period, staffId: r.staff_id, subjectId: r.subject_id, group: !!r.is_group,
      subject: r.subject?.name || '', teacher: r.staff ? `${r.staff.first_name} ${r.staff.last_name}` : '',
    }))
  }

  // заетостта на учителите от плана другаде (други паралелки и ИЧ) — за да се вижда къде не могат
  const teacherIds = Array.from(new Set(cards.map(x => x.staffId).filter(Boolean))) as string[]
  const busy: Record<string, { day: number; period: number; label: string }[]> = {}
  if (teacherIds.length) {
    const others = (scheds || []).filter((s: any) => s.id !== mine?.id)
    const nameOf: Record<string, string> = {}
    others.forEach((s: any) => { nameOf[s.id] = s.class?.name || '' })
    const ids = Object.keys(nameOf)
    for (let i = 0; i < ids.length; i += 100) {
      const { data: sl } = await fetchAll(() => supabase.from('schedule_slots').select('schedule_id, staff_id, day, period')
        .in('schedule_id', ids.slice(i, i + 100)).in('staff_id', teacherIds).order('id'))
      ;(sl || []).forEach((r: any) => { (busy[r.staff_id] ||= []).push({ day: r.day, period: r.period, label: `пар. ${nameOf[r.schedule_id]}` }) })
    }
    const { data: ifo } = await fetchAll(() => supabase.from('teacher_ifo_slots').select('teacher_id, day, period')
      .eq('academic_year_id', cy?.id).eq('term', term).in('teacher_id', teacherIds).order('id'))
    ;(ifo || []).forEach((r: any) => { (busy[r.teacher_id] ||= []).push({ day: r.day, period: r.period, label: 'ИЧ' }) })
  }
  const lock = await isScheduleLocked(supabase, cy?.id, term)

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <Link href={`/schedule-plan${term === 2 ? '?term=2' : ''}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} /> Разписание по план
      </Link>
      <div className="mb-5 flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><Users size={20} className="text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Паралелка {cls.name} · по учебния план</h1>
          <p className="text-slate-500 text-sm mt-0.5">{cy?.name} · часът се записва на учителя от плана и се вижда и в неговото разписание</p>
        </div>
      </div>
      {lock && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          Разписанието за {term === 2 ? 'II' : 'I'} срок е утвърдено — учителите не могат да го променят; управата може.
        </div>
      )}
      <ClassPlanEditor key={`${cls.id}-${term}`} classId={cls.id} term={term} classes={classes} cards={cards} slots={slots} busy={busy} subjects={subjects || []} />
    </div>
  )
}
