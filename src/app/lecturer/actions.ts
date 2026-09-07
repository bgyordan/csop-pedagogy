'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Разписанието на избран учител (за да маркираме слотове) — I срок
export async function getTeacherSchedule(staffId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { slots: [] }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  const { data: scheds } = await supabase
    .from('class_schedules').select('id, class:classes(name)')
    .eq('academic_year_id', cy?.id).eq('term', 1)
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
    .eq('teacher_id', staffId).eq('academic_year_id', cy?.id).eq('term', 1)
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
  slots: { day: number; period: number; subjectId: string | null; holderType: string; holderLabel: string }[]
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
        .eq('staff_id', staffId).eq('academic_year_id', cy?.id).eq('day', s.day).eq('period', s.period)
    }
    const ins = slots.map(s => ({
      staff_id: staffId, day: s.day, period: s.period, subject_id: s.subjectId,
      holder_type: s.holderType, holder_label: s.holderLabel,
      date_from: dateFrom, date_to: dateTo,
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
  const { data } = await supabase
    .from('academic_calendar_days')
    .select('week_number')
    .gte('date', from).lte('date', to).eq('is_school_day', true)
  const weeks = new Set((data || []).map((d: any) => d.week_number))
  return weeks.size
}

// Премахва един лекторски слот (day/period) на учител
export async function removeLecturerSlot(staffId: string, day: number, period: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
  await supabase.from('lecturer_slots').delete()
    .eq('staff_id', staffId).eq('academic_year_id', cy?.id).eq('day', day).eq('period', period)
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
  const NORMS: Record<string, number> = { class_teacher: 21, teacher: 21, educator: 25, psychologist: 30, speech_therapist: 21, rehabilitator: 21 }

  // групиране: учител -> (предмет+клас) -> {дни:Set, часа, period}
  const byStaff: Record<string, any> = {}
  for (const s of (slots as any[])) {
    const sid = s.staff_id
    if (!byStaff[sid]) {
      byStaff[sid] = {
        name: s.staff ? `${s.staff.first_name} ${s.staff.last_name}` : '',
        position: s.staff?.position || 'учител',
        norm: NORMS[s.staff?.role || ''] || 21,
        from: s.date_from, to: s.date_to,
        groups: {} as Record<string, { subject: string; cls: string; days: Set<number>; hours: number }>,
      }
    }
    const key = `${s.subject?.name || ''}||${s.holder_label || ''}`
    if (!byStaff[sid].groups[key]) byStaff[sid].groups[key] = { subject: s.subject?.name || '—', cls: s.holder_label || '—', days: new Set(), hours: 0 }
    byStaff[sid].groups[key].days.add(s.day)
    byStaff[sid].groups[key].hours++  // брой слотове = часа/седмица за тази комбинация
  }

  // седмици по период (кеш)
  const weeksCache: Record<string, number> = {}
  async function weeksOf(from: string, to: string) {
    const k = `${from}|${to}`
    if (weeksCache[k] !== undefined) return weeksCache[k]
    const { data } = await supabase.from('academic_calendar_days').select('week_number')
      .gte('date', from).lte('date', to).eq('is_school_day', true)
    const w = new Set((data || []).map((d: any) => d.week_number)).size
    weeksCache[k] = w
    return w
  }

  const teachers: any[] = []
  for (const sid of Object.keys(byStaff)) {
    const t = byStaff[sid]
    const weeks = await weeksOf(t.from, t.to)
    const rows = Object.values(t.groups).map((g: any) => {
      const days = Array.from(g.days).sort().map((d: any) => DOW[d]).join(', ')
      return { subject: g.subject, cls: g.cls, days, perWeek: g.hours, weeks, total: g.hours * weeks }
    })
    const totalHours = rows.reduce((a, r) => a + r.total, 0)
    teachers.push({ name: t.name, position: t.position, norm: t.norm, from: t.from, to: t.to, rows, totalHours })
  }
  teachers.sort((a, b) => a.name.localeCompare(b.name, 'bg'))

  return { success: true, data: { teachers, yearName: cy?.name || '' } }
}
