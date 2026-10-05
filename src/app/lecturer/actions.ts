'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { planDistribution, slotHours, classEndsFrom, latestEnd } from './distribute'
import type { Ends, Grp } from './distribute'
import { loadCurriculum, lecturerOf } from '@/lib/curriculum'

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

  const out: { day: number; period: number; subjectId: string | null; subject: string; holderType: string; holderLabel: string; norm30?: boolean }[] = []
  // норма 30: терапии („позволява вземане“ или „терапи“ в името); „Час на класа“ е винаги 21
  const isN30 = (sub: any) => {
    const n = String(sub?.name || '').toLowerCase()
    return !n.includes('час на класа') && (!!sub?.allows_pullout || /терапи/.test(n))
  }
  if (schedIds.length > 0) {
    const { data: slots } = await supabase
      .from('schedule_slots').select('schedule_id, day, period, subject_id, subject:subjects(name, allows_pullout)')
      .in('schedule_id', schedIds).eq('staff_id', staffId)
    ;(slots || []).forEach((sl: any) => out.push({
      day: sl.day, period: sl.period, subjectId: sl.subject_id, subject: sl.subject?.name || '',
      holderType: 'class', holderLabel: schedName[sl.schedule_id] || '', norm30: isN30(sl.subject),
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
      academic_year_id: cy?.id, created_by: me?.id, is_manual: true,
    }))
    const { error } = await supabase.from('lecturer_slots').insert(ins)
    if (error) return { error: error.message.includes('is_manual') ? 'Пуснете SQL файла 2026-10-04_lecturer_manual.sql' : error.message }
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

/**
 * Премества един лекторски час в друга клетка от разписанието — със същите дати.
 * Ако новата паралелка учи по-кратко, крайната дата се скъсява до нейния край и се връща колко часа липсват.
 * Преместеният час става „ръчен“ (катинарче) и остава при „Наново“.
 */
export async function moveLecturerSlot(staffId: string, term: number,
  from: { day: number; period: number },
  to: { day: number; period: number; subjectId: string | null; holderType: string; holderLabel: string }) {
  const m = await manager()
  if (!m) return { error: 'Нямате права' }
  const { data: old } = await m.supabase.from('lecturer_slots').select('id, date_from, date_to')
    .eq('staff_id', staffId).eq('academic_year_id', m.yearId).eq('day', from.day).eq('period', from.period).eq('term', term).maybeSingle()
  if (!old) return { error: 'Часът не е намерен — презаредете страницата' }
  const { data: busy } = await m.supabase.from('lecturer_slots').select('id')
    .eq('staff_id', staffId).eq('academic_year_id', m.yearId).eq('day', to.day).eq('period', to.period).eq('term', term).maybeSingle()
  if (busy) return { error: 'В тази клетка вече има лекторски час' }

  // краят на новата паралелка (по детето с най-дълъг срок); ИФО / без данни — най-късният край
  const { ends, classEnd } = await getClassEnds(m.yearId)
  const newEnd = (to.holderType === 'class' && classEnd[to.holderLabel]) || latestEnd(ends) || old.date_to
  const dateTo = newEnd < old.date_to ? newEnd : old.date_to

  const { error } = await m.supabase.from('lecturer_slots').update({
    day: to.day, period: to.period, subject_id: to.subjectId, holder_type: to.holderType, holder_label: to.holderLabel,
    date_to: dateTo, is_manual: true,
  }).eq('id', old.id)
  if (error) return { error: error.message.includes('is_manual') ? 'Пуснете SQL файла 2026-10-04_lecturer_manual.sql' : error.message }

  let lost = 0
  if (dateTo !== old.date_to) {
    const dates = (await yearSchoolDays()).map(d => d.date)
    lost = Math.max(0, slotHours(dates, from.day, old.date_from, old.date_to, ends) - slotHours(dates, to.day, old.date_from, dateTo, ends))
  }
  revalidatePath('/lecturer')
  return { success: true, dateTo, lost }
}


// ── Данни за ОБЩАТА ЗАПОВЕД за лекторски (таблица човек по човек) ──
/** Данни за заповедта за лекторски (часовете от разписанието — без ИЧ; ИЧ са по отделна заповед). staffId — само за един човек */
export async function getLecturerFrameworkData(staffId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  let sq = supabase
    .from('lecturer_slots')
    .select(`staff_id, day, period, holder_label, date_from, date_to,
      subject:subjects(name),
      staff:staff_profiles!lecturer_slots_staff_id_fkey(first_name, last_name, position, role)`)
    .eq('academic_year_id', cy?.id)
  if (staffId) sq = sq.eq('staff_id', staffId)
  const { data: slots } = await sq
  if (!slots || slots.length === 0) return { error: 'Няма определени лекторски часове' }

  // норма — както в „Кратко“ (по длъжност, специалист, годишна за управата)
  const ids = Array.from(new Set((slots as any[]).map(s => s.staff_id)))
  const [{ lines }, { data: profs }] = await Promise.all([
    loadCurriculum(supabase, cy?.id, { all: true }),
    supabase.from('staff_profiles').select('*').in('id', ids),
  ])
  const normOf: Record<string, string> = {}
  ;(profs || []).forEach((p: any) => {
    const L = lecturerOf(lines.filter(l => l.staffId === p.id), p)
    normOf[p.id] = L.normYear ? `${L.normYear} ч. годишно` : L.normAll ? `${L.normAll} ч./седмично` : ''
  })

  const DOW = ['', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък']
  const NORMS: Record<string, number> = { class_teacher: 21, teacher: 21, educator: 30, psychologist: 30, speech_therapist: 21, rehabilitator: 21 }

  // точен брой часове: учебните дни от календара в делничния ден на слота
  const cal = (await yearSchoolDays()).map(d => d.date)
  const { ends } = await getClassEnds(cy?.id)

  // групиране: учител -> (предмет+клас+период) -> {дни, часа/седм., общо}
  const byStaff: Record<string, any> = {}
  for (const s of (slots as any[])) {
    const sid = s.staff_id
    if (!byStaff[sid]) {
      byStaff[sid] = {
        name: s.staff ? `${s.staff.first_name} ${s.staff.last_name}` : '',
        position: s.staff?.position || 'учител',
        norm: normOf[sid] ?? `${NORMS[s.staff?.role || ''] || 21} ч./седмично`,
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
    g.total += slotHours(cal, s.day, s.date_from, s.date_to, ends)
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

/** Последните учебни дни по групи класове (по МОН) и краят на всяка паралелка — по детето с най-дълъг срок */
export async function getClassEnds(yearId: string) {
  const supabase = await createClient()
  const { data: e } = await supabase.from('school_year_ends').select('grp, end_date').eq('academic_year_id', yearId)
  const ends: Ends = {}
  ;(e || []).forEach((r: any) => { ends[r.grp as Grp] = r.end_date })
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
  return { ends, classEnd: classEndsFrom(rows, ends), ready: !!e }
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

/** Записва часовете над норматива на седмица за I и II срок (без да разпределя); null = по учебния план */
export async function saveLecturerPlan(staffId: string, w1: number | null, w2: number | null, opts: { total?: number; reset?: boolean } = {}) {
  const m = await manager()
  if (!m) return { error: 'Нямате права' }
  const r2 = (x: number | null) => x === null || x === undefined || Number.isNaN(x) ? null : Math.max(0, Math.round(x * 100) / 100)
  const { error } = await m.supabase.from('lecturer_plans').upsert({
    staff_id: staffId, academic_year_id: m.yearId, per_week: r2(w1), per_week_t2: r2(w2),
    ...(opts.total !== undefined ? { total_hours: Math.max(0, Math.round(opts.total)) } : {}),
    ...(opts.reset ? { distributed_at: null } : {}),   // числото е сменено → трябва ново разпределяне
    updated_by: m.me.id, updated_at: new Date().toISOString(),
  }, { onConflict: 'staff_id,academic_year_id' })
  if (error) return { error: error.message.includes('per_week_t2') ? 'Пуснете SQL файла 2026-10-04_lecturer_per_term.sql'
    : error.message.includes('per_week') || error.message.includes('smallint') ? 'Пуснете SQL файла 2026-10-04_lecturer_per_week_fraction.sql'
    : error.message.includes('lecturer_plans') ? 'Пуснете SQL файла 2026-10-04_lecturer_plans.sql' : error.message }
  return { success: true }
}

/** ИЧ, признати за лекторски по заповед (ч./седм., еднакво за годината); null — няма */
export async function saveIchLecturer(staffId: string, value: number | null) {
  const m = await manager()
  if (!m) return { error: 'Нямате права' }
  const v = value === null || Number.isNaN(value) ? null : Math.max(0, Math.round(value * 10) / 10)
  const { error } = await m.supabase.from('lecturer_plans').upsert({
    staff_id: staffId, academic_year_id: m.yearId, ich_lecturer: v, distributed_at: null,
    updated_by: m.me.id, updated_at: new Date().toISOString(),
  }, { onConflict: 'staff_id,academic_year_id' })
  if (error) return { error: error.message.includes('ich_lecturer') ? 'Пуснете SQL файла 2026-10-05_lecturer_ich.sql' : error.message }
  return { success: true }
}

/** Записва последните учебни дни по групи класове */
export async function saveYearEnds(ends: Ends) {
  const m = await manager()
  if (!m) return { error: 'Нямате права' }
  const rows = (Object.entries(ends) as [Grp, string][]).filter(([, v]) => v).map(([grp, end_date]) => ({ academic_year_id: m.yearId, grp, end_date }))
  const { error } = await m.supabase.from('school_year_ends').upsert(rows, { onConflict: 'academic_year_id,grp' })
  if (error) return { error: error.message.includes('school_year_ends') ? 'Пуснете SQL файла 2026-10-04_class_end_dates.sql' : error.message }
  revalidatePath('/lecturer')
  return { success: true }
}

/**
 * Разпределя лекторските в разписанието на учителя (заменя автоматичните; ръчните с катинарче остават).
 * w1 / w2 — часове над норматива на седмица за I / II срок (само се записват);
 * total — годишният брой (колоната „за годината“). Разпределя се ГОДИШНИЯТ брой:
 *  • 1 час седмично от началото на годината, докато се събере числото (напр. 20 → 20 седмици);
 *  • ако е повече от годината на паралелката (32 / 34 / 36 седмици) — този час върви цялата година,
 *    а остатъкът — втори час, пак от началото на годината; и т.н.
 */
/** w1/w2 — числата на ръка (ч./седм. по срокове); null — по учебния план (тогава total е годишният брой оттам) */
export async function autoDistribute(staffId: string, w1: number | null, w2: number | null, total?: number) {
  const m = await manager()
  if (!m) return { error: 'Нямате права' }
  const saved = await saveLecturerPlan(staffId, w1, w2)
  if ('error' in saved) return saved

  const days = await yearSchoolDays()
  const dates = days.map(d => d.date)
  if (!dates.length) return { error: 'Няма въведен учебен календар за годината' }
  const t1 = days.filter(d => d.term !== 2).map(d => d.date), t2 = days.filter(d => d.term === 2).map(d => d.date)
  const { ends, classEnd } = await getClassEnds(m.yearId)
  const defaultEnd = latestEnd(ends)
  if (!defaultEnd) return { error: 'Не са въведени последните учебни дни по класове (горе в таблицата)' }

  // разписанието: от I срок (II срок е почти същото); ако няма — от II срок
  const s1 = (await getTeacherSchedule(staffId, 1)).slots
  const s2own = (await getTeacherSchedule(staffId, 2)).slots
  const sched = s1.length ? s1 : s2own, term = s1.length ? 1 : 2
  if (!sched.some(s => s.holderType !== 'ifo')) return { error: 'Учителят няма въведено разписание' }

  // ръчно сложените часове остават; разпределя се само остатъкът
  const { data: man, error: manErr } = await m.supabase.from('lecturer_slots').select('day, period, date_from, date_to')
    .eq('staff_id', staffId).eq('academic_year_id', m.yearId).eq('is_manual', true)
  if (manErr) return { error: manErr.message.includes('is_manual') ? 'Пуснете SQL файла 2026-10-04_lecturer_manual.sql' : manErr.message }
  const manual = man || []
  const manualHours = manual.reduce((a: number, x: any) => a + slotHours(dates, x.day, x.date_from, x.date_to, ends), 0)

  // годишният брой: I срок × седмиците му + II срок × седмиците му
  const yearTotal = total !== undefined && Number.isFinite(total)
    ? Math.max(0, Math.round(total))
    : Math.round((w1 || 0) * Math.round(t1.length / 5) + (w2 || 0) * Math.round(t2.length / 5))

  type Row = { day: number; period: number; subjectId: string | null; holderType: string; holderLabel: string; dateFrom: string; dateTo: string; hours: number; term: number }
  const out: Row[] = []
  let missing = 0
  const r = Math.max(0, yearTotal - manualHours)
  if (r > 0) {
    const p = planDistribution({ dates, total: r, schedule: sched, classEnd, defaultEnd, ends, taken: manual })
    p.slots.forEach(x => out.push({ ...x, term })); missing += p.missing
  }

  await m.supabase.from('lecturer_slots').delete().eq('staff_id', staffId).eq('academic_year_id', m.yearId).eq('is_manual', false)
  if (out.length) {
    const { error } = await m.supabase.from('lecturer_slots').insert(out.map(s => ({
      staff_id: staffId, day: s.day, period: s.period, subject_id: s.subjectId,
      holder_type: s.holderType, holder_label: s.holderLabel,
      date_from: s.dateFrom, date_to: s.dateTo, term: s.term,
      academic_year_id: m.yearId, created_by: m.me.id,
    })))
    if (error) return { error: error.message }
  }
  // часовете — както ги брои навсякъде другаде (по седмици)
  const placed = out.reduce((a, s) => a + slotHours(dates, s.day, s.dateFrom, s.dateTo, ends), 0) + manualHours
  await m.supabase.from('lecturer_plans').update({ distributed_at: new Date().toISOString(), total_hours: placed })
    .eq('staff_id', staffId).eq('academic_year_id', m.yearId)
  revalidatePath('/lecturer')
  return { success: true, placed, missing, slots: out.length + manual.length, manual: manual.length }
}
