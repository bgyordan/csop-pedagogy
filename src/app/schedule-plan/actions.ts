'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { periodsOverlap, PERIOD_LABEL } from '@/lib/periods'
import { fetchAll } from '@/lib/supabase/fetch-all'

const DAYS_BG = ['', 'пон', 'вт', 'ср', 'чет', 'пет']
const hourLabel = (d: number, p: number) => `${DAYS_BG[d]} ${PERIOD_LABEL[p]}${p < 8 ? '. час' : ''}`

// „Разписание по план“ — само управата (админ, ЗДУД, директор)
async function manager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, me: null, error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me || !['admin', 'zdud', 'director'].includes(me.role || '')) return { supabase, me: null, error: 'Нямате права' }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
  if (!cy) return { supabase, me: null, error: 'Няма текуща учебна година' }
  return { supabase, me, yearId: cy.id as string, error: null }
}

const name = (s: any) => s ? `${s.first_name} ${s.last_name}` : 'друг учител'

/** Къде е учителят в този ден и час (друга паралелка или ИЧ) — празно, ако е свободен */
async function teacherBusy(supabase: any, yearId: string, term: number, staffId: string, day: number, period: number, exceptSchedule: string) {
  const { data: sl } = await supabase.from('schedule_slots')
    .select('period, schedule:class_schedules!inner(id, academic_year_id, term, class:classes(name))')
    .eq('staff_id', staffId).eq('day', day)
    .eq('schedule.academic_year_id', yearId).eq('schedule.term', term)
  const c = (sl || []).find((r: any) => r.schedule?.id !== exceptSchedule && r.schedule?.term === term && periodsOverlap(r.period, period))
  if (c) return `в паралелка ${c.schedule?.class?.name || ''}`
  const { data: ifo } = await supabase.from('teacher_ifo_slots')
    .select('period, student:students(first_name, last_name)')
    .eq('teacher_id', staffId).eq('academic_year_id', yearId).eq('term', term).eq('day', day)
  const i = (ifo || []).find((r: any) => periodsOverlap(r.period, period))
  if (i) return `ИЧ с ${name(i.student)}`
  return ''
}

/** Слага час от учебния план в паралелката: учителят е от реда на плана. group — паралелката е разделена на групи. */
export async function placeClassSlot(a: { classId: string; term: number; day: number; period: number; staffId: string; subjectId: string; group?: boolean }) {
  const { supabase, me, yearId, error } = await manager()
  if (error || !me || !yearId) return { error }
  const term = a.term === 2 ? 2 : 1
  let { data: sched } = await supabase.from('class_schedules').select('id')
    .eq('class_id', a.classId).eq('academic_year_id', yearId).eq('term', term).maybeSingle()
  if (!sched) {
    const { data: created, error: cErr } = await supabase.from('class_schedules')
      .insert({ class_id: a.classId, academic_year_id: yearId, term, created_by: me.id }).select('id').single()
    if (cErr) return { error: cErr.message }
    sched = created
  }
  const { data: cell } = await supabase.from('schedule_slots')
    .select('staff_id, is_group, subject:subjects(name), staff:staff_profiles(first_name, last_name)')
    .eq('schedule_id', sched!.id).eq('day', a.day).eq('period', a.period)
  if ((cell || []).some((r: any) => r.staff_id === a.staffId)) return { error: 'Учителят вече има час тук' }
  if ((cell || []).length && !a.group) {
    const o: any = cell![0]
    return { busy: true, error: `${hourLabel(a.day, a.period)} е зает: ${o.subject?.name || ''} (${name(o.staff)})` }
  }
  const where = await teacherBusy(supabase, yearId, term, a.staffId, a.day, a.period, sched!.id)
  if (where) return { error: `Учителят е зает ${hourLabel(a.day, a.period)} — ${where}` }
  const { data: slot, error: iErr } = await supabase.from('schedule_slots')
    .insert({ schedule_id: sched!.id, day: a.day, period: a.period, subject_id: a.subjectId, staff_id: a.staffId, is_group: !!a.group })
    .select('id').single()
  if (iErr) return { error: /duplicate|unique/i.test(iErr.message) ? 'Часът вече е зает' : iErr.message }
  await supabase.from('class_schedules').update({ updated_at: new Date().toISOString() }).eq('id', sched!.id)
  revalidatePath('/schedule-plan')
  return { success: true, id: slot!.id as string }
}

export async function removeClassSlot(slotId: string) {
  const { supabase, error } = await manager()
  if (error) return { error }
  const { error: dErr } = await supabase.from('schedule_slots').delete().eq('id', slotId)
  if (dErr) return { error: dErr.message }
  revalidatePath('/schedule-plan')
  return { success: true }
}

/** Утвърждава (заключва) или отключва разписанието за срока */
export async function setScheduleLock(term: number, locked: boolean) {
  const { supabase, me, yearId, error } = await manager()
  if (error || !me || !yearId) return { error }
  const t = term === 2 ? 2 : 1
  const { error: e } = locked
    ? await supabase.from('schedule_locks').upsert({ academic_year_id: yearId, term: t, locked_by: me.id, locked_at: new Date().toISOString() })
    : await supabase.from('schedule_locks').delete().eq('academic_year_id', yearId).eq('term', t)
  if (e) return { error: /schedule_locks/.test(e.message) ? 'Пуснете SQL файла 2026-10-07_schedule_locks.sql' : e.message }
  revalidatePath('/schedule-plan')
  revalidatePath('/my-schedule')
  return { success: true }
}

/**
 * Копира разписанието на цялото училище от I във II срок (паралелки + ИЧ), БЕЗ да дублира:
 *  • час, който вече го има във II срок (същата паралелка, ден, час и учител / същото дете и учител) — пропуска се;
 *  • клетка, заета във II срок от друг учител, или учител / дете, заети по това време — пропуска се (конфликт);
 *  • нищо съществуващо във II срок не се трие и не се променя.
 */
export async function copySchoolTerm1To2() {
  const { supabase, me, yearId, error } = await manager()
  if (error || !me || !yearId) return { error }
  const { data: scheds } = await supabase.from('class_schedules').select('id, class_id, term').eq('academic_year_id', yearId)
  const t1 = (scheds || []).filter((s: any) => s.term === 1)
  const t2ByClass: Record<string, string> = {}
  ;(scheds || []).filter((s: any) => s.term === 2).forEach((s: any) => { t2ByClass[s.class_id] = s.id })
  for (const s of t1) {
    if (t2ByClass[s.class_id]) continue
    const { data: c, error: cErr } = await supabase.from('class_schedules')
      .insert({ class_id: s.class_id, academic_year_id: yearId, term: 2, created_by: me.id }).select('id').single()
    if (cErr) return { error: cErr.message }
    t2ByClass[s.class_id] = c!.id
  }
  const t1Ids = t1.map((s: any) => s.id), t2Ids = Object.values(t2ByClass)
  const load = async (ids: string[]) => {
    const out: any[] = []
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await fetchAll(() => supabase.from('schedule_slots').select('schedule_id, day, period, subject_id, staff_id, is_group')
        .in('schedule_id', ids.slice(i, i + 100)).order('id'))
      out.push(...(data || []))
    }
    return out
  }
  const [src, dst] = await Promise.all([load(t1Ids), load(t2Ids)])
  const { data: ifoAll } = await fetchAll(() => supabase.from('teacher_ifo_slots')
    .select('teacher_id, student_id, day, period, subject_id, term').eq('academic_year_id', yearId).order('id'))
  const ifo1 = (ifoAll || []).filter((r: any) => r.term === 1), ifo2 = (ifoAll || []).filter((r: any) => r.term === 2)

  // заетост във II срок
  const cellTaken = new Set<string>()      // паралелка·ден·час с обикновен (не групов) час
  const cellStaff = new Set<string>()      // паралелка·ден·час·учител
  const teacherAt: Record<string, { day: number; period: number }[]> = {}
  const studentAt: Record<string, { day: number; period: number }[]> = {}
  const clsOf2: Record<string, string> = {}
  Object.entries(t2ByClass).forEach(([c, id]) => { clsOf2[id] = c })
  const addSlot = (cls: string, r: any) => {
    if (!r.is_group) cellTaken.add(`${cls}|${r.day}|${r.period}`)
    cellStaff.add(`${cls}|${r.day}|${r.period}|${r.staff_id}`)
    if (r.staff_id) (teacherAt[r.staff_id] ||= []).push({ day: r.day, period: r.period })
  }
  dst.forEach(r => addSlot(clsOf2[r.schedule_id], r))
  const ifoKey = new Set<string>()
  const addIfo = (r: any) => {
    ifoKey.add(`${r.teacher_id}|${r.student_id}|${r.day}|${r.period}`)
    ;(teacherAt[r.teacher_id] ||= []).push({ day: r.day, period: r.period })
    ;(studentAt[r.student_id] ||= []).push({ day: r.day, period: r.period })
  }
  ifo2.forEach(addIfo)
  const busy = (list: { day: number; period: number }[] | undefined, d: number, p: number) =>
    (list || []).some(x => x.day === d && periodsOverlap(x.period, p))

  const clsOf1: Record<string, string> = {}
  t1.forEach((s: any) => { clsOf1[s.id] = s.class_id })
  let copied = 0, already = 0, conflicts = 0
  const ins: any[] = []
  for (const r of src) {
    const cls = clsOf1[r.schedule_id]
    if (cellStaff.has(`${cls}|${r.day}|${r.period}|${r.staff_id}`)) { already++; continue }
    if ((!r.is_group && cellTaken.has(`${cls}|${r.day}|${r.period}`)) || (r.staff_id && busy(teacherAt[r.staff_id], r.day, r.period))) { conflicts++; continue }
    ins.push({ schedule_id: t2ByClass[cls], day: r.day, period: r.period, subject_id: r.subject_id, staff_id: r.staff_id, is_group: !!r.is_group })
    addSlot(cls, r)
  }
  for (let i = 0; i < ins.length; i += 500) {
    const { error: e } = await supabase.from('schedule_slots').insert(ins.slice(i, i + 500))
    if (e) return { error: e.message }
  }
  copied += ins.length
  const insIfo: any[] = []
  for (const r of ifo1) {
    if (ifoKey.has(`${r.teacher_id}|${r.student_id}|${r.day}|${r.period}`)) { already++; continue }
    if (busy(teacherAt[r.teacher_id], r.day, r.period) || busy(studentAt[r.student_id], r.day, r.period)) { conflicts++; continue }
    insIfo.push({ teacher_id: r.teacher_id, student_id: r.student_id, academic_year_id: yearId, term: 2, day: r.day, period: r.period, subject_id: r.subject_id })
    addIfo(r)
  }
  for (let i = 0; i < insIfo.length; i += 500) {
    const { error: e } = await supabase.from('teacher_ifo_slots').insert(insIfo.slice(i, i + 500))
    if (e) return { error: e.message }
  }
  copied += insIfo.length
  revalidatePath('/schedule-plan')
  revalidatePath('/my-schedule')
  return { success: true, copied, already, conflicts }
}

/**
 * Свързва вече въведени часове („извън плана“) с ред от учебния план: сменя предмета (и учителя, ако е друг)
 * на тези часове. Час, при който новият учител е зает по това време, се пропуска.
 */
export async function relinkSlots(slotIds: string[], staffId: string, subjectId: string) {
  const { supabase, yearId, error } = await manager()
  if (error || !yearId) return { error }
  if (!slotIds.length || !staffId || !subjectId) return { error: 'Липсват данни' }
  const { data: rows } = await supabase.from('schedule_slots')
    .select('id, day, period, staff_id, schedule_id, schedule:class_schedules!inner(term)').in('id', slotIds)
  const ok: string[] = [], skipped: string[] = []
  for (const r of (rows || []) as any[]) {
    if (r.staff_id !== staffId) {
      const term = r.schedule?.term === 2 ? 2 : 1
      const where = await teacherBusy(supabase, yearId, term, staffId, r.day, r.period, r.schedule_id)
      if (where) { skipped.push(`${hourLabel(r.day, r.period)} — учителят е зает ${where}`); continue }
      const { data: same } = await supabase.from('schedule_slots').select('id')
        .eq('schedule_id', r.schedule_id).eq('day', r.day).eq('period', r.period).eq('staff_id', staffId).limit(1)
      if (same?.length) { skipped.push(`${hourLabel(r.day, r.period)} — учителят вече има час тук`); continue }
    }
    ok.push(r.id)
  }
  if (ok.length) {
    const { error: uErr } = await supabase.from('schedule_slots').update({ staff_id: staffId, subject_id: subjectId }).in('id', ok)
    if (uErr) return { error: uErr.message }
  }
  revalidatePath('/schedule-plan')
  return { success: true, updated: ok, skipped }
}
