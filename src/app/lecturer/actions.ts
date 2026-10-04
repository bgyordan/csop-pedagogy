'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { teacherYear, planDistribution, slotHours, classWeeksFrom } from './distribute'

// Разписанието на избран учител (за да маркираме слотове) — за избрания срок
export async function getTeacherSchedule(staffId: string, term: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { slots: [] }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  const { data: scheds } = await supabase
    .from('class_schedules').select('id, class:classes(name)')
    .eq('academic_year_id', cy?.id).eq('term', term)
  const schedName: Record<string, string> = {}
  ;(scheds || []).forEach((s: any) => { schedName[s.id] = s.class?.name || '' })
  const schedIds = (scheds || []).map((s: any) => s.id)

  const out: { day: number; period: number; subjectId: string | null; subject: string; holderType: string; holderLabel: string }[] = []
  if (schedIds.length > 0) {
    const { data: slots } = await supabase
      .from('schedule_slots').select('schedule_id, day, period, subject_id, subject:subjects(name)')
      .in('schedule_id', schedIds).eq('staff_id', staffId)
    ;(slots || []).forEach((sl: any) => out.push({
      day: sl.day, period: sl.period, subjectId: sl.subject_id, subject: sl.subject?.name || '',
      holderType: 'class', holderLabel: schedName[sl.schedule_id] || '',
    }))
  }
  const { data: ifo } = await supabase
    .from('teacher_ifo_slots').select('day, period, subject_id, subject:subjects(name), student:students(first_name, last_name)')
    .eq('teacher_id', staffId).eq('academic_year_id', cy?.id).eq('term', term)
  ;(ifo || []).forEach((sl: any) => out.push({
    day: sl.day, period: sl.period, subjectId: sl.subject_id, subject: sl.subject?.name || '',
    holderType: 'ifo', holderLabel: sl.student ? `ИФО ${sl.student.first_name} ${sl.student.last_name}` : 'ИФО',
  }))
  return { slots: out }
}

// Записва маркираните лекторски слотове за учител + период.
// Заменя предишните за същия учител/година (пренареждане).
export async function saveLecturerSlots(
  staffId: string, dateFrom: string, dateTo: string,
  slots: { day: number; period: number; subjectId: string | null; holderType: string; holderLabel: string }[],
  term: number = 1
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director'].includes(me?.role || '')) return { error: 'Нямате права' }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  // ДОБАВЯЩ режим: трием само точно тези (day/period), които сега записваме (да не дублират),
  // после ги вписваме с ТЕКУЩИЯ период — така стари слотове с ДРУГ период остават непокътнати
  if (slots.length > 0) {
    for (const s of slots) {
      await supabase.from('lecturer_slots').delete()
        .eq('staff_id', staffId).eq('academic_year_id', cy?.id).eq('day', s.day).eq('period', s.period).eq('term', term)
    }
    const ins = slots.map(s => ({
      staff_id: staffId, day: s.day, period: s.period, subject_id: s.subjectId,
      holder_type: s.holderType, holder_label: s.holderLabel,
      date_from: dateFrom, date_to: dateTo, term,
      academic_year_id: cy?.id, created_by: me?.id,
    }))
    const { error } = await supabase.from('lecturer_slots').insert(ins)
    if (error) return { error: error.message }
  }
  revalidatePath('/lecturer')
  return { success: true }
}

// Изтрива всички лекторски слотове на учител
export async function clearLecturerSlots(staffId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
  await supabase.from('lecturer_slots').delete().eq('staff_id', staffId).eq('academic_year_id', cy?.id)
  revalidatePath('/lecturer')
  return { success: true }
}
export async function schoolWeeks(from: string, to: string): Promise<number> {
  const supabase = await createClient()
    const { count } = await supabase
    .from('academic_calendar_days')
    .select('*', { count: 'exact', head: true })
    .gte('date', from).lte('date', to).eq('is_school_day', true)
  return Math.round((count || 0) / 5)
}

// Премахва един лекторски слот (day/period) на учител
export async function removeLecturerSlot(staffId: string, day: number, period: number, term: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
  await supabase.from('lecturer_slots').delete()
    .eq('staff_id', staffId).eq('academic_year_id', cy?.id).eq('day', day).eq('period', period).eq('term', term)
  revalidatePath('/lecturer')
  return { success: true }
}


// ── Данни за ОБЩАТА ЗАПОВЕД за лекторски (таблица човек по човек) ──
export async function getLecturerFrameworkData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const { data: slots } = await supabase
    .from('lecturer_slots')
    .select(`staff_id, day, period, holder_label, date_from, date_to,
      subject:subjects(name),
      staff:staff_profiles!lecturer_slots_staff_id_fkey(first_name, last_name, position, role)`)
    .eq('academic_year_id', cy?.id)
  if (!slots || slots.length === 0) return { error: 'Няма определени лекторски часове' }

  const DOW = ['', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък']
  const NORMS: Record<string, number> = { class_teacher: 21, teacher: 21, educator: 30, psychologist: 30, speech_therapist: 21, rehabilitator: 21 }

  // точен брой часове: учебните дни от календара в делничния ден на слота
  const cal = (await yearSchoolDays()).map(d => d.date)

  // групиране: учител -> (предмет+клас+период) -> {дни, часа/седм., общо}
  const byStaff: Record<string, any> = {}
  for (const s of (slots as any[])) {
    const sid = s.staff_id
    if (!byStaff[sid]) {
      byStaff[sid] = {
        name: s.staff ? `${s.staff.first_name} ${s.staff.last_name}` : '',
        position: s.staff?.position || 'учител',
        norm: NORMS[s.staff?.role || ''] || 21,
        from: s.date_from, to: s.date_to,
        groups: {} as Record<string, { subject: string; cls: string; days: Set<number>; hours: number; total: number; from: string; to: string }>,
      }
    }
    const t = byStaff[sid]
    if (s.date_from < t.from) t.from = s.date_from
    if (s.date_to > t.to) t.to = s.date_to
    const key = `${s.subject?.name || ''}||${s.holder_label || ''}||${s.date_from}||${s.date_to}`
    if (!t.groups[key]) t.groups[key] = { subject: s.subject?.name || '—', cls: s.holder_label || '—', days: new Set(), hours: 0, total: 0, from: s.date_from, to: s.date_to }
    const g = t.groups[key]
    g.days.add(s.day)
    g.hours++  // брой слотове = часа/седмица за тази комбинация
    g.total += slotHours(cal, s.day, s.date_from, s.date_to)
  }

  const teachers: any[] = []
  for (const sid of Object.keys(byStaff)) {
    const t = byStaff[sid]
    const rows = Object.values(t.groups).map((g: any) => {
      const days = Array.from(g.days as Set<number>).sort().map(d => DOW[d]).join(', ')
      return { subject: g.subject, cls: g.cls, days, perWeek: g.hours, weeks: Math.round(g.total / g.hours), total: g.total }
    })
    const totalHours = rows.reduce((a, r) => a + r.total, 0)
    teachers.push({ name: t.name, position: t.position, norm: t.norm, from: t.from, to: t.to, rows, totalHours })
  }
  teachers.sort((a, b) => a.name.localeCompare(b.name, 'bg'))

  return { success: true, data: { teachers, yearName: cy?.name || '' } }
}


// ── БЪРЗА ТАБЛИЦА: годишен брой лекторски → автоматично разпределение ──
const startYearNow = () => { const d = new Date(); return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1 }

/** Учебните дни на текущата година от календара (без ваканции и празници) */
export async function yearSchoolDays() {
  const supabase = await createClient()
  const y = startYearNow()
  const { data } = await supabase.from('academic_calendar_days').select('date, term')
    .gte('date', `${y}-09-01`).lte('date', `${y + 1}-08-31`).eq('is_school_day', true).order('date')
  return (data || []).map((d: any) => ({ date: d.date as string, term: d.term === 2 ? 2 : 1 }))
}

/** Седмиците на всяка паралелка в ЦСОП — по класа на децата в изпращащите училища */
export async function getClassWeeks(yearId: string) {
  const supabase = await createClient()
  const rows: { className: string; externalClass: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('student_enrollments')
      .select('class:classes(name), student:students(external_class, status)')
      .eq('academic_year_id', yearId).is('left_at', null).range(from, from + 999)
    ;(data || []).forEach((r: any) => {
      if (r.student?.status === 'active') rows.push({ className: r.class?.name || '', externalClass: r.student?.external_class || null })
    })
    if (!data || data.length < 1000) break
  }
  return classWeeksFrom(rows)
}

async function manager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director'].includes(me?.role || '')) return null
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
  return { supabase, me: me!, yearId: cy?.id as string }
}

/** Записва числото (и седмиците) без да разпределя */
export async function saveLecturerPlan(staffId: string, total: number, term2Weeks: number) {
  const m = await manager()
  if (!m) return { error: 'Нямате права' }
  const { error } = await m.supabase.from('lecturer_plans').upsert({
    staff_id: staffId, academic_year_id: m.yearId, total_hours: Math.max(0, Math.round(total || 0)), term2_weeks: term2Weeks,
    updated_by: m.me.id, updated_at: new Date().toISOString(),
  }, { onConflict: 'staff_id,academic_year_id' })
  if (error) return { error: error.message.includes('lecturer_plans') ? 'Пуснете SQL файла 2026-10-04_lecturer_plans.sql' : error.message }
  return { success: true }
}

/** Разпределя годишния брой в разписанието на учителя (заменя досегашните му лекторски) */
export async function autoDistribute(staffId: string, total: number, term2Weeks: number) {
  const m = await manager()
  if (!m) return { error: 'Нямате права' }
  const saved = await saveLecturerPlan(staffId, total, term2Weeks)
  if ('error' in saved) return saved

  const days = await yearSchoolDays()
  const year = teacherYear(days, term2Weeks)
  if (!year.dates.length) return { error: 'Няма въведен учебен календар за годината' }
  if (!year.hasTerm2) return { error: 'В календара няма дни от II срок — първо го попълнете' }

  // разписанието: от I срок (обикновено е същото и за II); ако няма — от II срок
  let term = 1
  let { slots: sched } = await getTeacherSchedule(staffId, 1)
  if (!sched.length) { term = 2; sched = (await getTeacherSchedule(staffId, 2)).slots }
  if (!sched.length) return { error: 'Учителят няма въведено разписание' }

  const classWeeks = await getClassWeeks(m.yearId)
  const plan = planDistribution({ dates: year.dates, total, term2Weeks, schedule: sched, classWeeks })

  await m.supabase.from('lecturer_slots').delete().eq('staff_id', staffId).eq('academic_year_id', m.yearId)
  if (plan.slots.length) {
    const { error } = await m.supabase.from('lecturer_slots').insert(plan.slots.map(s => ({
      staff_id: staffId, day: s.day, period: s.period, subject_id: s.subjectId,
      holder_type: s.holderType, holder_label: s.holderLabel,
      date_from: s.dateFrom, date_to: s.dateTo, term,
      academic_year_id: m.yearId, created_by: m.me.id,
    })))
    if (error) return { error: error.message }
  }
  await m.supabase.from('lecturer_plans').update({ distributed_at: new Date().toISOString() })
    .eq('staff_id', staffId).eq('academic_year_id', m.yearId)
  revalidatePath('/lecturer')
  return { success: true, placed: plan.placed, missing: plan.missing, slots: plan.slots.length }
}
