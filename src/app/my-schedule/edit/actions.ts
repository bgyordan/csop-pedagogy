'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { periodsOverlap, PERIOD_LABEL } from '@/lib/periods'
import { isScheduleLocked } from '@/lib/curriculum'

const LOCKED_MSG = 'Разписанието за срока е утвърдено — промени може да направи само управата'

// Клетка от моята решетка: ден·час + носител (паралелка ИЛИ ИФО ученик) + предмет
export interface MyCell {
  day: number
  period: number
  holderType: 'class' | 'ifo'
  holderId: string        // class_id или student_id
  subjectId: string
  group?: boolean         // час на група — паралелката е разделена, в същия час има и друг учител
}

// Запазва РАЗПИСАНИЕТО НА ТЕКУЩИЯ УЧИТЕЛ (per-учител).
// Пише слотове в class_schedules (за паралелки) и teacher_ifo_slots (за ИФО ученици),
// всички със staff_id/teacher_id = този учител. Трие само СВОИТЕ стари слотове,
// за да не бърше слотовете на други учители в същата паралелка.
export async function saveMySchedule(
  academicYearId: string,
  term: number,
  cells: MyCell[],
  targetStaffId?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase
    .from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me) return { error: 'Няма профил' }
  // Админ/ЗДУД/директор могат да редактират от името на друг учител
  const isManager = ['admin', 'zdud', 'director'].includes(me.role || '')
  const myId = (targetStaffId && isManager) ? targetStaffId : me.id
  if (!isManager && await isScheduleLocked(supabase, academicYearId, term)) return { error: LOCKED_MSG }

  const classCells = cells.filter(c => c.holderType === 'class' && c.subjectId)
  const ifoCells = cells.filter(c => c.holderType === 'ifo' && c.subjectId)

  // ── ПАРАЛЕЛКИ (schedule_slots със staff_id) ──
  // Намираме/създаваме class_schedule за всяка паралелка, която пипам сега.
  const classIds = Array.from(new Set(classCells.map(c => c.holderId)))
  const schedByClass: Record<string, string> = {}
  for (const classId of classIds) {
    let { data: sched } = await supabase
      .from('class_schedules').select('id')
      .eq('class_id', classId).eq('academic_year_id', academicYearId).eq('term', term).maybeSingle()
    if (!sched) {
      const { data: created, error: cErr } = await supabase
        .from('class_schedules')
        .insert({ class_id: classId, academic_year_id: academicYearId, term, created_by: myId })
        .select('id').single()
      if (cErr) return { error: cErr.message }
      sched = created
    }
    schedByClass[classId] = sched!.id
  }

  // ЗАБРАНА: в една паралелка по едно и също време не може да има двама учители.
  // Ако друг учител вече е заел някой от часовете, които записвам → спираме с ясен списък.
  const DAYS_BG = ['', 'пон', 'вт', 'ср', 'чет', 'пет']
  const clashes: string[] = []
  for (const [classId, schedId] of Object.entries(schedByClass)) {
    const mine = classCells.filter(c => c.holderId === classId)
    if (mine.length === 0) continue
    const { data: others } = await supabase
      .from('schedule_slots')
      .select('day, period, is_group, subject:subjects(name), staff:staff_profiles(first_name, last_name)')
      .eq('schedule_id', schedId).neq('staff_id', myId)
    ;(others || []).forEach((o: any) => {
      // група: моят или чуждият час е отбелязан като група → позволено
      if (mine.some(c => c.day === o.day && c.period === o.period && !c.group && !o.is_group)) {
        clashes.push(`${DAYS_BG[o.day]} ${o.period}. час — ${o.subject?.name || ''} (${o.staff ? `${o.staff.first_name} ${o.staff.last_name}` : 'друг учител'})`)
      }
    })
  }
  if (clashes.length > 0) {
    return { error: `Тези часове в паралелката вече са заети от друг учител: ${clashes.join('; ')}. Махни ги от своето разписание или помоли класния да ги освободи.` }
  }

  // Кои разписания да изчистя от МОИТЕ слотове:
  // тези, които пипам сега + тези, в които ВЕЧЕ имам слотове — за да се махнат и
  // напълно премахнати паралелки (иначе последната изтрита клетка остава в базата).
  const { data: yearScheds } = await supabase
    .from('class_schedules').select('id')
    .eq('academic_year_id', academicYearId).eq('term', term)
  const yearSchedIds = (yearScheds || []).map((s: any) => s.id)
  let mineSchedIds: string[] = []
  if (yearSchedIds.length > 0) {
    const { data: mineSlots } = await supabase
      .from('schedule_slots').select('schedule_id')
      .in('schedule_id', yearSchedIds).eq('staff_id', myId)
    mineSchedIds = (mineSlots || []).map((s: any) => s.schedule_id)
  }
  const clearSchedIds = Array.from(new Set([...Object.values(schedByClass), ...mineSchedIds]))

  // Трия всичките си стари слотове в тези разписания (само моите, чуждите не се пипат)
  if (clearSchedIds.length > 0) {
    const { error: dErr } = await supabase
      .from('schedule_slots').delete().in('schedule_id', clearSchedIds).eq('staff_id', myId)
    if (dErr) return { error: dErr.message }
  }

  // Вмъквам новите си слотове
  const toInsert = classCells.map(c => ({
    schedule_id: schedByClass[c.holderId], day: c.day, period: c.period, subject_id: c.subjectId, staff_id: myId,
    is_group: !!c.group,
  }))
  if (toInsert.length > 0) {
    const { error: iErr } = await supabase.from('schedule_slots').insert(toInsert)
    if (iErr) return { error: /duplicate|unique/i.test(iErr.message) ? 'Някой от часовете в паралелката вече е зает от друг учител' : iErr.message }
  }

  // Отбелязвам пипнатите разписания като обновени
  for (const sid of Object.values(schedByClass)) {
    await supabase.from('class_schedules').update({ updated_at: new Date().toISOString() }).eq('id', sid)
  }

  // ── ИФО (teacher_ifo_slots) ──
  // Трия всички мои ИФО слотове за този срок/година, после вписвам новите.
  await supabase.from('teacher_ifo_slots').delete()
    .eq('teacher_id', myId).eq('academic_year_id', academicYearId).eq('term', term)
  if (ifoCells.length > 0) {
    const ins = ifoCells.map(c => ({
      teacher_id: myId, student_id: c.holderId, academic_year_id: academicYearId, term,
      day: c.day, period: c.period, subject_id: c.subjectId,
    }))
    const { error: iErr } = await supabase.from('teacher_ifo_slots').insert(ins)
    if (iErr) return { error: /duplicate|unique/i.test(iErr.message) ? 'ИФО дете вече е заето от друг учител в някой от тези часове' : iErr.message }
  }

  revalidatePath('/my-schedule')
  revalidatePath('/my-schedule/edit')
  return { success: true }
}

// Копира МОЕТО разписание от I срок във II срок (паралелки + ИФО).
// Заменя само моите слотове във II срок — чуждите не се пипат (както при запазване).
export async function copyMyScheduleFromTerm1(academicYearId: string, targetStaffId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase
    .from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me) return { error: 'Няма профил' }
  const isManager = ['admin', 'zdud', 'director'].includes(me.role || '')
  const myId = (targetStaffId && isManager) ? targetStaffId : me.id
  if (!isManager && await isScheduleLocked(supabase, academicYearId, 2)) return { error: LOCKED_MSG }

  const { data: t1 } = await supabase
    .from('class_schedules').select('id, class_id').eq('academic_year_id', academicYearId).eq('term', 1)
  const classOf: Record<string, string> = {}
  ;(t1 || []).forEach((s: any) => { classOf[s.id] = s.class_id })
  const ids = Object.keys(classOf)
  const { data: slots } = ids.length
    ? await supabase.from('schedule_slots').select('schedule_id, day, period, subject_id, is_group').in('schedule_id', ids).eq('staff_id', myId)
    : { data: [] as any[] }
  const { data: ifo } = await supabase
    .from('teacher_ifo_slots').select('student_id, day, period, subject_id')
    .eq('teacher_id', myId).eq('academic_year_id', academicYearId).eq('term', 1)

  const cells: MyCell[] = [
    ...(slots || []).map((s: any) => ({ day: s.day, period: s.period, holderType: 'class' as const, holderId: classOf[s.schedule_id], subjectId: s.subject_id, group: !!s.is_group })),
    ...(ifo || []).map((s: any) => ({ day: s.day, period: s.period, holderType: 'ifo' as const, holderId: s.student_id, subjectId: s.subject_id })),
  ].filter(c => c.holderId && c.subjectId)
  if (cells.length === 0) return { error: 'I срок е празен — няма какво да се копира' }

  const res = await saveMySchedule(academicYearId, 2, cells, targetStaffId)
  if ('error' in res) return res
  return { success: true, count: cells.length }
}

// Проверка за колизия на ПАРАЛЕЛКА-ниво: в дадена паралелка, ден, час —
// има ли вече зает слот (от друг учител)? Връща името на предмета/учителя ако да.
export async function checkClassCollision(
  classId: string, academicYearId: string, term: number, day: number, period: number, targetStaffId?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { busy: false }
  const { data: me0 } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  // в режим „управа редактира чуждо разписание“ — „моите“ часове са на избрания учител, не на управата
  const me = { id: (targetStaffId && ['admin', 'zdud', 'director'].includes(me0?.role || '')) ? targetStaffId : me0?.id }
  const { data: sched } = await supabase
    .from('class_schedules').select('id')
    .eq('class_id', classId).eq('academic_year_id', academicYearId).eq('term', term).maybeSingle()
  if (!sched) return { busy: false }
  const { data: slot } = await supabase
    .from('schedule_slots')
    .select('staff_id, subject:subjects(name), staff:staff_profiles(first_name, last_name)')
    .eq('schedule_id', sched.id).eq('day', day).eq('period', period)
    .neq('staff_id', me?.id || '')
    .limit(1).maybeSingle()
  if (!slot) return { busy: false }
  const s: any = slot
  return {
    busy: true,
    by: s.staff ? `${s.staff.first_name} ${s.staff.last_name}` : 'друг учител',
    subject: s.subject?.name || '',
  }
}


// Добавя нов предмет в движение (ползва се и от редактора на разписание)
export async function addSubjectQuick(name: string, allowsPullout: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: profile } = await supabase
    .from('staff_profiles').select('id').eq('user_id', user.id).single()
  const { data, error } = await supabase
    .from('subjects')
    .insert({ name: name.trim(), allows_pullout: allowsPullout, is_therapy: allowsPullout, created_by: profile?.id })
    .select('id, name, allows_pullout').single()
  if (error) {
    if (error.message.includes('duplicate')) return { error: 'Вече съществува такъв предмет' }
    return { error: error.message }
  }
  return { subject: data }
}


// Класният ръководител (или admin/zdud) освобождава час в СВОЯТА паралелка,
// зает от друг учител. Трие чужд слот → нужен е service-role клиент (RLS).
export async function releaseClassSlot(
  classId: string, academicYearId: string, term: number, day: number, period: number, keepStaffId?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me) return { error: 'Няма профил' }
  const isManager = ['admin', 'zdud', 'director'].includes(me.role || '')
  if (!isManager && await isScheduleLocked(supabase, academicYearId, term)) return { error: LOCKED_MSG }
  if (!isManager) {
    const { data: cta } = await supabase.from('class_teacher_assignments').select('class_id')
      .eq('staff_id', me.id).eq('class_id', classId).eq('academic_year_id', academicYearId).maybeSingle()
    if (!cta) return { error: 'Само класният ръководител може да освобождава часове в паралелката.' }
  }
  const { data: sched } = await supabase.from('class_schedules').select('id')
    .eq('class_id', classId).eq('academic_year_id', academicYearId).eq('term', term).maybeSingle()
  if (!sched) return { error: 'Няма разписание за паралелката' }
  const admin = createAdminClient()
  const { error } = await admin.from('schedule_slots').delete()
    .eq('schedule_id', sched.id).eq('day', day).eq('period', period)
    .neq('staff_id', (isManager && keepStaffId) ? keepStaffId : me.id)
  if (error) return { error: error.message }
  revalidatePath('/my-schedule')
  revalidatePath('/my-schedule/edit')
  return { success: true }
}


// Проверка за колизия на ИФО ДЕТЕ: при друг учител ли е вече в час, застъпващ се по време?
export async function checkIfoCollision(
  studentId: string, academicYearId: string, term: number, day: number, period: number, targetStaffId?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { busy: false }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  const myId = (targetStaffId && ['admin', 'zdud', 'director'].includes(me?.role || '')) ? targetStaffId : me?.id
  const { data: rows } = await supabase
    .from('teacher_ifo_slots')
    .select('period, teacher_id, subject:subjects(name), teacher:staff_profiles(first_name, last_name)')
    .eq('student_id', studentId).eq('academic_year_id', academicYearId).eq('term', term).eq('day', day)
    .neq('teacher_id', myId || '')
  const hit: any = (rows || []).find((r: any) => periodsOverlap(r.period, period))
  if (!hit) return { busy: false }
  return {
    busy: true,
    by: hit.teacher ? `${hit.teacher.first_name} ${hit.teacher.last_name}` : 'друг учител',
    subject: hit.subject?.name || '',
    at: PERIOD_LABEL[hit.period] || String(hit.period),
  }
}

// Свързва предмет от учебния план (името от НЕИСПУО) с предмет в EIS — важи за всички и при следващ внос.
// Ново свързване може да направи всеки служител от редактора; вече направено — само управата го сменя.
export async function linkCurriculumSubject(source: string, subjectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me) return { error: 'Няма профил' }
  if (!source.trim() || !subjectId) return { error: 'Липсва предмет' }
  const admin = createAdminClient()
  const { data: prev } = await admin.from('curriculum_name_map').select('target_id')
    .eq('kind', 'subject').eq('source_name', source).maybeSingle()
  if (prev && prev.target_id !== subjectId && !['admin', 'zdud', 'director'].includes(me.role || '')) {
    return { error: 'Предметът вече е свързан — смяна може да направи само управата' }
  }
  const { error } = await admin.from('curriculum_name_map')
    .upsert({ kind: 'subject', source_name: source, target_id: subjectId }, { onConflict: 'kind,source_name' })
  if (error) return { error: /check constraint|kind/i.test(error.message) ? 'Пуснете SQL файла 2026-10-07_curriculum_subject_map.sql' : error.message }
  return { success: true }
}
