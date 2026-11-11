// „Децата днес“ — за всяко активно дете: какво има днес, при кого и кога.
// Дневна форма: разписанието на паралелката (сглобено от учителите); ако по същото време има терапия — терапията.
// ИФО: ИФО часовете на детето + терапиите.
// Отсъстващ учител/терапевт → кой замества (или че отсъства). Отсъстващо дете → absent.
// Чете се със service-role на сървъра — само тези полета, нищо от досието.
import { createAdminClient } from '@/lib/supabase/admin'
import { PERIOD_BY_N, byStartTime, periodsOverlap } from '@/lib/periods'

export type TodayRow = { period: number; time: string; start: number; end: number; what: string; who: string; note: string; therapy: boolean }
export type TodayKid = { id: string; name: string; cls: string; ifo: boolean; absent: boolean; rows: TodayRow[] }
export type ChildrenToday = { schoolDay: boolean; nowMin: number; kids: TodayKid[] }

const ROLE_LABEL: Record<string, string> = { psychologist: 'Психолог', speech_therapist: 'Логопед', rehabilitator: 'Рехабилитатор' }
const nm = (p: any) => (p ? `${p.first_name} ${p.last_name}` : '')

export function sofiaNow() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Sofia' }))
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return { now, iso, dow: now.getDay(), nowMin: now.getHours() * 60 + now.getMinutes() }
}

export async function getChildrenToday(yearId: string): Promise<ChildrenToday> {
  const db = createAdminClient()
  const { now, iso, dow, nowMin } = sofiaNow()

  const { data: calDay } = await db.from('academic_calendar_days').select('term, is_school_day').eq('date', iso).maybeSingle()
  const mo = now.getMonth() + 1
  const term = calDay?.term ?? (mo >= 2 && mo <= 8 ? 2 : 1)
  const schoolDay = (calDay ? !!calDay.is_school_day : true) && dow >= 1 && dow <= 5

  const { data: enr } = await db.from('student_enrollments')
    .select('student_id, class_id, education_form, class:classes(name), student:students(first_name, last_name, status)')
    .eq('academic_year_id', yearId)
  const all = (enr || []).filter((e: any) => e.student?.status === 'active')
  const ids = all.map((e: any) => e.student_id)

  const base = (e: any): TodayKid => ({
    id: e.student_id, name: nm(e.student), cls: e.class?.name || '', ifo: e.education_form === 'ifo', absent: false, rows: [],
  })
  if (!schoolDay || ids.length === 0) return { schoolDay, nowMin, kids: all.map(base).sort((a, b) => a.name.localeCompare(b.name, 'bg')) }

  const classIds = Array.from(new Set(all.filter((e: any) => e.education_form !== 'ifo').map((e: any) => e.class_id).filter(Boolean)))

  const [{ data: scheds }, { data: ifo }, { data: ther }, { data: absKids }, { data: subs }, { data: assigns }] = await Promise.all([
    db.from('class_schedules').select('id, class_id').in('class_id', classIds.length ? classIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('academic_year_id', yearId).eq('term', term),
    db.from('teacher_ifo_slots')
      .select('student_id, period, teacher_id, subject:subjects(name), teacher:staff_profiles(first_name, last_name)')
      .eq('academic_year_id', yearId).eq('term', term).eq('day', dow),
    db.from('therapist_slots')
      .select('student_id, period, schedule:therapist_schedules!inner(staff_id, term, academic_year_id, staff:staff_profiles(first_name, last_name, role, position))')
      .eq('day', dow).eq('schedule.term', term).eq('schedule.academic_year_id', yearId),
    db.from('student_absences').select('student_id').lte('date_from', iso).gte('date_to', iso),
    db.from('substitutions')
      .select('id, absent_staff_id, sub:staff_profiles!substitutions_substitute_staff_id_fkey(first_name, last_name)')
      .lte('date_from', iso).gte('date_to', iso),
    db.from('substitution_assignments')
      .select('substitution_id, sub:staff_profiles!substitution_assignments_substitute_staff_id_fkey(first_name, last_name)')
      .lte('date_from', iso).gte('date_to', iso),
  ])

  const schedIds = (scheds || []).map((s: any) => s.id)
  const { data: classSlots } = schedIds.length
    ? await db.from('schedule_slots')
        .select('schedule_id, period, staff_id, subject:subjects(name), staff:staff_profiles(first_name, last_name)')
        .in('schedule_id', schedIds).eq('day', dow)
    : { data: [] as any[] }

  // кой отсъства днес → кой го замества („“ = никой не е посочен)
  const extra: Record<string, string[]> = {}
  ;(assigns || []).forEach((a: any) => { if (a.sub) (extra[a.substitution_id] ||= []).push(nm(a.sub)) })
  const absentStaff: Record<string, string> = {}
  ;(subs || []).forEach((s: any) => { absentStaff[s.absent_staff_id] = extra[s.id]?.length ? extra[s.id].join(', ') : nm(s.sub) })
  const who = (staffId: string, name: string) => {
    if (!(staffId in absentStaff)) return { who: name, note: '' }
    const by = absentStaff[staffId]
    return by ? { who: by, note: `замества ${name}` } : { who: name, note: `${name} отсъства` }
  }
  const row = (period: number, what: string, w: { who: string; note: string }, therapy: boolean): TodayRow => {
    const p = PERIOD_BY_N[period]
    return { period, time: p?.time || String(period), start: p?.start ?? 0, end: p?.end ?? 0, what, who: w.who, note: w.note, therapy }
  }

  // паралелка → редовете ѝ за днес (сливаме учителите в един и същи час — разделени групи)
  const schedClass: Record<string, string> = {}
  ;(scheds || []).forEach((s: any) => { schedClass[s.id] = s.class_id })
  const byClassPeriod: Record<string, Record<number, { what: string; whos: string[]; notes: string[] }>> = {}
  ;(classSlots || []).forEach((s: any) => {
    const cid = schedClass[s.schedule_id]
    const cell = ((byClassPeriod[cid] ||= {})[s.period] ||= { what: s.subject?.name || 'Час', whos: [], notes: [] })
    const w = who(s.staff_id, nm(s.staff))
    if (w.who && !cell.whos.includes(w.who)) cell.whos.push(w.who)
    if (w.note) cell.notes.push(w.note)
  })

  const ifoRows: Record<string, TodayRow[]> = {}
  ;(ifo || []).forEach((s: any) => {
    ;(ifoRows[s.student_id] ||= []).push(row(s.period, s.subject?.name || 'Час', who(s.teacher_id, nm(s.teacher)), false))
  })
  const therRows: Record<string, TodayRow[]> = {}
  ;(ther || []).forEach((t: any) => {
    const st = t.schedule?.staff
    const off = !!t.schedule?.staff_id && t.schedule.staff_id in absentStaff
    ;(therRows[t.student_id] ||= []).push(row(t.period, st?.position || ROLE_LABEL[st?.role] || 'Терапия',
      { who: nm(st), note: off ? 'отсъства — няма терапия' : '' }, true))
  })
  const absentKid = new Set((absKids || []).map((a: any) => a.student_id))

  const kids = all.map((e: any) => {
    const k = base(e)
    k.absent = absentKid.has(k.id)
    const th = therRows[k.id] || []
    if (k.ifo) {
      k.rows = [...(ifoRows[k.id] || []), ...th]
    } else {
      const cells = byClassPeriod[e.class_id] || {}
      const cls = Object.entries(cells)
        .filter(([p]) => !th.some(t => periodsOverlap(t.period, Number(p)))) // в часа на терапия детето е при терапевта
        .map(([p, c]) => row(Number(p), c.what, { who: c.whos.join(', '), note: c.notes.join('; ') }, false))
      k.rows = [...cls, ...th]
    }
    k.rows.sort((a, b) => byStartTime(a.period, b.period))
    return k
  }).sort((a, b) => a.name.localeCompare(b.name, 'bg'))

  return { schoolDay, nowMin, kids }
}
