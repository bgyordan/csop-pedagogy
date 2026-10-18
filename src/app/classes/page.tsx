import { createClient } from '@/lib/supabase/server'
import OutreachBadge from '@/components/OutreachBadge'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings2, CalendarClock, Users, Check } from 'lucide-react'
import { BackButton } from '@/components/ui/BackButton'
import { getFullName } from '@/lib/utils'
import CoudTabs from './CoudTabs'
import { iupPeriod } from '@/lib/iup-period'
import ClassesTable, { type ClassRow } from './ClassesTable'
import { isOresActive, todaySofia, ORES_ACTIVE_COLS } from '@/lib/ores'
export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; out?: string }>
}) {
  const params = await searchParams
  const tab = params.tab === 'coud' ? 'coud' : 'classes'
  const onlyOutreach = params.out === '1'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()
  const { data: myProfile } = await supabase
    .from('staff_profiles').select('id, role, is_coordinator').eq('user_id', user.id).single()
  const isManager = ['admin', 'zdud', 'director'].includes(myProfile?.role || '') || myProfile?.is_coordinator === true
  let myClassIds: string[] | null = null
  if (!isManager && myProfile?.id) {
    // моите паралелки: класен + където имам часове по разписание + паралелките на „моите“ деца (терапевт / възпитател)
    const me = myProfile.id, role = myProfile.role || ''
    const ids = new Set<string>()
    const { data: myCta } = await supabase
      .from('class_teacher_assignments').select('class_id')
      .eq('staff_id', me).eq('academic_year_id', currentYear?.id)
    ;(myCta || []).forEach((a: any) => ids.add(a.class_id))
    const { data: mySlots } = await supabase.from('schedule_slots').select('schedule:class_schedules(class_id, academic_year_id)').eq('staff_id', me)
    ;(mySlots || []).forEach((sl: any) => { if (sl.schedule?.class_id && sl.schedule.academic_year_id === currentYear?.id) ids.add(sl.schedule.class_id) })
    let kidIds: string[] = []
    if (['psychologist', 'speech_therapist', 'rehabilitator'].includes(role)) {
      const f = role === 'psychologist' ? 'psychologist_id' : role === 'speech_therapist' ? 'speech_therapist_id' : 'rehabilitator_id'
      const [{ data: et }, { data: tk }] = await Promise.all([
        supabase.from('eplr_teams').select('student_id').eq(f, me).eq('academic_year_id', currentYear?.id),
        supabase.from('students').select('id').or(`therapist_psychologist_id.eq.${me},therapist_speech_id.eq.${me},therapist_rehab_id.eq.${me},therapist_rehab2_id.eq.${me}`),
      ])
      kidIds = [...(et || []).map((r: any) => r.student_id), ...(tk || []).map((r: any) => r.id)]
    } else if (role === 'educator') {
      const { data: gs } = await supabase.from('coud_groups').select('id').eq('teacher_id', me).eq('academic_year_id', currentYear?.id)
      const gIds = (gs || []).map((g: any) => g.id)
      if (gIds.length) {
        const { data: ce } = await supabase.from('coud_enrollments').select('student_id').in('coud_group_id', gIds).eq('academic_year_id', currentYear?.id)
        kidIds = (ce || []).map((r: any) => r.student_id)
      }
    }
    if (kidIds.length) {
      const { data: ke } = await supabase.from('student_enrollments').select('class_id').in('student_id', kidIds).eq('academic_year_id', currentYear?.id)
      ;(ke || []).forEach((e: any) => ids.add(e.class_id))
    }
    myClassIds = Array.from(ids)
  }
  let classesQuery = supabase
    .from('classes').select('*').eq('academic_year_id', currentYear?.id).order('name')
  if (myClassIds !== null) {
    classesQuery = classesQuery.in('id', myClassIds.length > 0 ? myClassIds : ['no-results'])
  }
  const { data: classesAll } = await classesQuery
  const classes = classesAll
  const { data: allEnrollmentsRaw } = await supabase
    .from('student_enrollments')
    .select('class_id, student_id, education_form, student:students(id, status, is_new)')
    .eq('academic_year_id', currentYear?.id)
  const enrollments = (allEnrollmentsRaw || []).filter((e: any) => e.student?.status === 'active')
  const { data: assignments } = await supabase
    .from('class_teacher_assignments')
        .select('class_id, staff:staff_profiles(id, first_name, last_name, is_active)')
    .eq('academic_year_id', currentYear?.id)
  const countByClass = new Map<string, number>()
  const ifoByClass = new Map<string, number>()
  const idsByClass = new Map<string, string[]>()
  enrollments?.forEach((e: any) => {
    countByClass.set(e.class_id, (countByClass.get(e.class_id) || 0) + 1)
    if (e.education_form === 'ifo') ifoByClass.set(e.class_id, (ifoByClass.get(e.class_id) || 0) + 1)
    idsByClass.set(e.class_id, [...(idsByClass.get(e.class_id) || []), e.student_id])
  })
  // ── Състояние: разписание (текущия срок) и ИУП (месеца за отчет) ──
  const P = iupPeriod()
  const { data: calDay } = await supabase.from('academic_calendar_days').select('term').eq('date', new Date().toISOString().slice(0, 10)).maybeSingle()
  const mo = new Date().getMonth() + 1
  const term = calDay?.term ?? (mo >= 2 && mo <= 8 ? 2 : 1)
  const [{ data: scheds }, { data: iupDone }] = await Promise.all([
    supabase.from('class_schedules').select('id, class_id').eq('academic_year_id', currentYear?.id).eq('term', term),
    P.offSeason ? Promise.resolve({ data: [] as any[] })
      : supabase.from('monthly_absences').select('class_id').eq('month', P.month).eq('year', P.year),
  ])
  const schedIds = (scheds || []).map((x: any) => x.id)
  const { data: filled } = schedIds.length
    ? await supabase.from('schedule_slots').select('schedule_id').in('schedule_id', schedIds)
    : { data: [] as any[] }
  const filledSched = new Set((filled || []).map((x: any) => x.schedule_id))
  const hasSchedule = new Set((scheds || []).filter((x: any) => filledSched.has(x.id)).map((x: any) => x.class_id))
  const iupSet = new Set((iupDone || []).map((x: any) => x.class_id))
    const teachersByClass = new Map<string, string[]>()
  const teacherIdByClass = new Map<string, string>()
  assignments?.forEach((a: any) => {
    if (!teachersByClass.has(a.class_id)) teachersByClass.set(a.class_id, [])
    if (a.staff && a.staff.is_active !== false) {
      teachersByClass.get(a.class_id)!.push(getFullName(a.staff))
      if (!teacherIdByClass.has(a.class_id)) teacherIdByClass.set(a.class_id, a.staff.id)
    }
  })
  // ── Редовете на таблицата: децата с полезното за тях + какво иска внимание ──
  const activeIds = enrollments.map((e: any) => e.student_id)
  const today = todaySofia()
  const [{ data: coudYear }, { data: eplrYear }, { data: oresRows }, { data: absRows }] = await Promise.all([
    supabase.from('coud_enrollments').select('student_id').eq('academic_year_id', currentYear?.id),
    supabase.from('eplr_teams').select('student_id').eq('academic_year_id', currentYear?.id),
    activeIds.length ? supabase.from('student_ores').select(ORES_ACTIVE_COLS).in('student_id', activeIds).lte('from_date', today) : Promise.resolve({ data: [] as any[] }),
    supabase.from('student_absences').select('student_id').lte('date_from', today).gte('date_to', today),
  ])
  const coudSet = new Set((coudYear || []).map((r: any) => r.student_id))
  const eplrSet = new Set((eplrYear || []).map((r: any) => r.student_id))
  const oresSet = new Set((oresRows || []).filter((o: any) => isOresActive(o, today)).map((o: any) => o.student_id))
  const absSet = new Set((absRows || []).map((r: any) => r.student_id))
  const newSet = new Set(enrollments.filter((e: any) => e.student?.is_new).map((e: any) => e.student_id))
  const iupState = (id: string): ClassRow['iup'] => P.offSeason ? 'off' : iupSet.has(id) ? 'done' : (P.open || P.overdue) ? 'due' : 'later'
  const classRows: ClassRow[] = (classes || []).map((c: any) => {
    const ids = idsByClass.get(c.id) || []
    const n = (set: Set<string>) => ids.filter(i => set.has(i)).length
    return {
      id: c.id, name: c.name, outreach: c.outreach_location || null,
      teachers: teachersByClass.get(c.id) || [], teacherId: teacherIdByClass.get(c.id) || null,
      studentIds: ids, count: countByClass.get(c.id) || 0, ifo: ifoByClass.get(c.id) || 0,
      coud: n(coudSet), isNew: n(newSet), ores: n(oresSet), absentToday: n(absSet),
      // „само класен“ (отметка в ЕПЛР разпределението) — не се брои като липсващ екип
      noEplr: c.eplr_class_teacher_only ? 0 : ids.filter(i => !eplrSet.has(i)).length,
      hasSchedule: hasSchedule.has(c.id), iup: iupState(c.id),
    }
  })

  // ── ЦОУД данни ──
  const { data: coudGroups } = await supabase
    .from('coud_groups')
    .select('*, teacher:staff_profiles(first_name, last_name)')
    .eq('academic_year_id', currentYear?.id)
    .order('name')
  const { data: coudEnrollments } = await supabase
    .from('coud_enrollments')
    .select('coud_group_id, student:students(id, first_name, middle_name, last_name, external_class)')
    .eq('academic_year_id', currentYear?.id)
  // паралелка (в ЦСОП) по ученик
  const classNameByStudent = new Map<string, string>()
  const classIdByStudent = new Map<string, string>()
  ;(allEnrollmentsRaw || []).forEach((e: any) => {
    const cls = (classes || []).find(c => c.id === e.class_id)
    if (cls) { classNameByStudent.set(e.student_id, cls.name); classIdByStudent.set(e.student_id, cls.id) }
  })
  // заявление ЦОУД по ученик
  const coudStudentIds = (coudEnrollments || []).map((e: any) => e.student?.id).filter(Boolean)
  const applSet = new Set<string>()
  if (coudStudentIds.length > 0) {
    const { data: coudAppls } = await supabase
      .from('student_attachments')
      .select('student_id')
      .eq('doc_type', 'coud_application')
      .in('student_id', coudStudentIds)
    ;(coudAppls || []).forEach((a: any) => applSet.add(a.student_id))
  }
  type CoudStudent = { name: string; className: string; externalClass: string; classTeacher: string; hasAppl: boolean }
  type CoudGroupData = { id: string; name: string; teacher: string; students: CoudStudent[] }
  const coudData: CoudGroupData[] = (coudGroups || []).map(g => {
    const teacher = (g.teacher as any) ? `${(g.teacher as any).first_name} ${(g.teacher as any).last_name}` : '—'
    const students: CoudStudent[] = (coudEnrollments || [])
      .filter((e: any) => e.coud_group_id === g.id && e.student)
      .map((e: any) => ({
        name: getFullName(e.student),
        className: classNameByStudent.get(e.student.id) || '—',
        externalClass: e.student.external_class || '—',
        classTeacher: (teachersByClass.get(classIdByStudent.get(e.student.id) || '') || []).join(', ') || '—',
        hasAppl: applSet.has(e.student.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
    return { id: g.id, name: g.name, teacher, students }
  })
  const coudStudentCount = (coudEnrollments || []).length
  const coudApplCount = applSet.size
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <BackButton />
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">
          {tab === 'coud' ? 'ЦОУД групи' : 'Паралелки'}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {tab === 'coud'
            ? `${coudGroups?.length || 0} групи · ${coudStudentCount} ученика · ${coudApplCount} със заявление · ${currentYear?.name}`
            : `${classes?.length || 0} паралелки · ${currentYear?.name}${!isManager ? ' · моите' : ''}`}
        </p>
      </div>
      {/* ТАБОВЕ */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-sm w-fit">
        <Link href="/classes"
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'classes' ? 'bg-[#0f2240] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}>
          Паралелки
        </Link>
        <Link href="/classes?tab=coud"
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'coud' ? 'bg-[#0f2240] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}>
          ЦОУД групи
        </Link>
      </div>
     {isManager && (
        <Link href={tab === 'coud' ? '/admin/coud' : '/admin/years'}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-sm transition-all">
          <Settings2 size={13} className="text-slate-400" />
          {tab === 'coud' ? 'Редакция на ЦОУД групите' : 'Редакция на паралелките'}
        </Link>
      )}
      </div>
      {tab === 'coud' ? (
        /* ── ЦОУД ГРУПИ (табове) ── */
        <CoudTabs groups={coudData} showPassports={!['secretary', 'support'].includes(myProfile?.role || '')} />
      ) : (
        <ClassesTable rows={classRows} term={term} iupLabel={P.label} initialFilter={onlyOutreach ? 'outreach' : 'all'} />
      )}
    </div>
  )
}
