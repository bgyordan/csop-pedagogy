import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Coffee, CalendarClock, Users, Home, GraduationCap } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import { PERIOD_TIMES, coudPeriod } from '@/lib/periods'
import ClassTeacherDashboard from './ClassTeacherDashboard'
import ClassTeacherSide from './ClassTeacherSide'
import SharedFiles from './SharedFiles'

// Табло на възпитателя: неговата ЦОУД група (като паралелката при класния) — децата като карти
// + днешният ЦОУД график. Ако няма група → общото табло.
export default async function EducatorDashboard({ profile, currentYearId }: any) {
  const supabase = await createClient()

  const { data: groups } = await supabase
    .from('coud_groups').select('id, name')
    .eq('teacher_id', profile.id).eq('academic_year_id', currentYearId).order('name')
  if (!groups || groups.length === 0) return <ClassTeacherDashboard profile={profile} currentYearId={currentYearId} />
  const groupIds = groups.map((g: any) => g.id)

  const todayIso = new Date().toISOString().split('T')[0]
  const [{ data: enr }, { data: today }, { data: announcements }, { data: deadlines }] = await Promise.all([
    supabase.from('coud_enrollments')
      .select('coud_group_id, student:students(id, first_name, middle_name, last_name, status)')
      .in('coud_group_id', groupIds).eq('academic_year_id', currentYearId),
    supabase.from('academic_calendar_days').select('is_school_day, term, day_of_week').eq('date', todayIso).maybeSingle(),
    supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('calendar_deadlines').select('*').eq('academic_year_id', currentYearId).gte('deadline_date', todayIso).order('deadline_date').limit(5),
  ])
  const kids = (enr || []).filter((e: any) => e.student?.status === 'active')
  const studentIds = kids.map((e: any) => e.student.id)

  // паралелка + класен + форма на всяко дете
  const { data: studEnr } = studentIds.length > 0
    ? await supabase.from('student_enrollments').select('student_id, class_id, education_form, class:classes(name)')
        .in('student_id', studentIds).eq('academic_year_id', currentYearId)
    : { data: [] as any[] }
  const classIds = Array.from(new Set((studEnr || []).map((e: any) => e.class_id).filter(Boolean)))
  const { data: cta } = classIds.length > 0
    ? await supabase.from('class_teacher_assignments').select('class_id, staff:staff_profiles(first_name, last_name)')
        .in('class_id', classIds).eq('academic_year_id', currentYearId)
    : { data: [] as any[] }
  const teacherByClass: Record<string, string> = {}
  ;(cta || []).forEach((c: any) => { if (c.staff && !teacherByClass[c.class_id]) teacherByClass[c.class_id] = `${c.staff.first_name} ${c.staff.last_name}` })
  const infoByStudent: Record<string, { cls: string; teacher: string; form: string }> = {}
  ;(studEnr || []).forEach((e: any) => {
    infoByStudent[e.student_id] = { cls: e.class?.name || '', teacher: teacherByClass[e.class_id] || '', form: e.education_form || 'daily' }
  })

  const byGroup = groups.map((g: any) => ({
    ...g,
    kids: kids.filter((k: any) => k.coud_group_id === g.id)
      .map((k: any) => ({ id: k.student.id, name: getFullName(k.student), ...(infoByStudent[k.student.id] || { cls: '', teacher: '', form: 'daily' }) }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg')),
  }))

  // днешният ЦОУД график (ако днес е учебен ден)
  let todaySlots: { period: number; activity: string }[] = []
  if (today?.is_school_day && today.day_of_week >= 1 && today.day_of_week <= 5) {
    const { data: sl } = await supabase.from('educator_slots').select('period, activity')
      .eq('educator_id', profile.id).eq('academic_year_id', currentYearId)
      .eq('term', today.term === 2 ? 2 : 1).eq('day', today.day_of_week).order('period')
    todaySlots = sl || []
  }

  return (
    <div className="animate-in fade-in duration-500">
      {/* Лента на групата */}
      <div className="flex flex-wrap items-center gap-3 mb-6 px-5 py-3.5 rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 mr-auto">
          <Coffee size={18} className="text-amber-500" />
          <span className="text-base font-medium text-[#0f2240]">{groups.map((g: any) => /ЦОУД/i.test(g.name) ? g.name : `ЦОУД група ${g.name}`).join(', ')}</span>
          <span className="text-sm text-slate-400 font-light">· {kids.length} деца</span>
        </div>
        <Link href="/my-schedule"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-teal-200 bg-teal-50/50 text-sm text-slate-700 hover:bg-teal-50 hover:shadow-sm transition">
          <CalendarClock size={15} className="text-teal-600" /> Моят график
        </Link>
        <Link href="/students"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 hover:shadow-sm transition">
          <Users size={15} className="text-slate-400" /> Ученици
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {byGroup.map((g: any) => (
            <div key={g.id} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
              {byGroup.length > 1 && (
                <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/50 text-sm font-medium text-slate-700">{g.name} · {g.kids.length} деца</div>
              )}
              {g.kids.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Няма записани деца в групата.</div>
              ) : (
                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {g.kids.map((k: any) => (
                    <Link key={k.id} href={`/students/${k.id}`}
                      className="group flex flex-col gap-1.5 p-4 rounded-xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-amber-200 transition">
                      <span className="text-sm font-medium text-slate-800 group-hover:text-[#0f2240] leading-snug">{k.name}</span>
                      <div className="text-xs text-slate-500 font-light truncate">
                        {k.cls ? `паралелка ${k.cls}` : 'без паралелка'}{k.teacher ? ` · кл. ${k.teacher}` : ''}
                      </div>
                      <div className="mt-auto text-[11px] text-slate-500 inline-flex items-center gap-1">
                        {k.form === 'ifo' ? <><Home size={11} className="text-slate-400" /> ИФО</> : <><GraduationCap size={11} className="text-slate-400" /> Дневна</>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-6">
          {/* Днес */}
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
              <CalendarClock size={16} className="text-teal-500" />
              <h2 className="text-sm font-semibold text-slate-800">Днес</h2>
            </div>
            {todaySlots.length === 0 ? (
              <p className="text-sm text-slate-400">{today?.is_school_day ? 'Няма въведен график за днес.' : 'Днес не е учебен ден.'}</p>
            ) : (
              <div className="space-y-1.5">
                {todaySlots.map(s => (
                  <div key={s.period} className="flex items-center gap-3 text-sm">
                    <span className="text-[11px] font-mono text-slate-400 w-24 shrink-0">{PERIOD_TIMES[coudPeriod(s.period)]}</span>
                    <span className="text-slate-700 truncate">{s.activity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <ClassTeacherSide deadlines={deadlines || []} announcements={announcements || []} files={<SharedFiles bare />} />
        </div>
      </div>
    </div>
  )
}
