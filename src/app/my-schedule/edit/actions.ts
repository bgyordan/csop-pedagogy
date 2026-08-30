'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Клетка от моята решетка: ден·час + носител (паралелка ИЛИ ИФО ученик) + предмет
export interface MyCell {
  day: number
  period: number
  holderType: 'class' | 'ifo'
  holderId: string        // class_id или student_id
  subjectId: string
}

// Запазва РАЗПИСАНИЕТО НА ТЕКУЩИЯ УЧИТЕЛ (per-учител).
// Пише слотове в class_schedules (за паралелки) и teacher_ifo_slots (за ИФО ученици),
// всички със staff_id/teacher_id = този учител. Трие само СВОИТЕ стари слотове,
// за да не бърше слотовете на други учители в същата паралелка.
export async function saveMySchedule(
  academicYearId: string,
  term: number,
  cells: MyCell[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase
    .from('staff_profiles').select('id').eq('user_id', user.id).single()
  if (!me) return { error: 'Няма профил' }
  const myId = me.id

  const classCells = cells.filter(c => c.holderType === 'class' && c.subjectId)
  const ifoCells = cells.filter(c => c.holderType === 'ifo' && c.subjectId)

  // ── ПАРАЛЕЛКИ (schedule_slots със staff_id) ──
  // Групираме по паралелка; за всяка намираме/създаваме class_schedule.
  const classIds = Array.from(new Set(classCells.map(c => c.holderId)))
  // Изтриваме МОИТЕ стари слотове във всички паралелки, които въобще пипам сега
  // (за да махна и такива, които съм премахнал от решетката)
  for (const classId of classIds.length ? classIds : []) {
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
    // трия само моите слотове в това разписание
    await supabase.from('schedule_slots').delete().eq('schedule_id', sched!.id).eq('staff_id', myId)
    // вписвам новите мои
    const mine = classCells.filter(c => c.holderId === classId)
      .map(c => ({ schedule_id: sched!.id, day: c.day, period: c.period, subject_id: c.subjectId, staff_id: myId }))
    if (mine.length > 0) {
      const { error: iErr } = await supabase.from('schedule_slots').insert(mine)
      if (iErr) return { error: iErr.message }
    }
    await supabase.from('class_schedules').update({ updated_at: new Date().toISOString() }).eq('id', sched!.id)
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
    if (iErr) return { error: iErr.message }
  }

  revalidatePath('/my-schedule')
  revalidatePath('/my-schedule/edit')
  return { success: true }
}

// Проверка за колизия на ПАРАЛЕЛКА-ниво: в дадена паралелка, ден, час —
// има ли вече зает слот (от друг учител)? Връща името на предмета/учителя ако да.
export async function checkClassCollision(
  classId: string, academicYearId: string, term: number, day: number, period: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { busy: false }
  const { data: me } = await supabase.from('staff_profiles').select('id').eq('user_id', user.id).single()
  const { data: sched } = await supabase
    .from('class_schedules').select('id')
    .eq('class_id', classId).eq('academic_year_id', academicYearId).eq('term', term).maybeSingle()
  if (!sched) return { busy: false }
  const { data: slot } = await supabase
    .from('schedule_slots')
    .select('staff_id, subject:subjects(name), staff:staff_profiles(first_name, last_name)')
    .eq('schedule_id', sched.id).eq('day', day).eq('period', period)
    .neq('staff_id', me?.id || '')
    .maybeSingle()
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
