'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Запазва всички слотове на едно разписание наведнъж
export async function saveSchedule(
  classId: string,
  academicYearId: string,
  term: number,
  slots: { day: number; period: number; subjectId: string | null }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }

  // Намери или създай разписанието
  let { data: schedule } = await supabase
    .from('class_schedules')
    .select('id')
    .eq('class_id', classId)
    .eq('academic_year_id', academicYearId)
    .eq('term', term)
    .maybeSingle()

  if (!schedule) {
    const { data: profile } = await supabase
      .from('staff_profiles').select('id').eq('user_id', user.id).single()
    const { data: created, error: createErr } = await supabase
      .from('class_schedules')
      .insert({ class_id: classId, academic_year_id: academicYearId, term, created_by: profile?.id })
      .select('id').single()
    if (createErr) return { error: createErr.message }
    schedule = created
  }

  // Изтрий старите слотове и запиши новите (само непразните)
  await supabase.from('schedule_slots').delete().eq('schedule_id', schedule.id)

  const toInsert = slots
    .filter(s => s.subjectId)
    .map(s => ({ schedule_id: schedule!.id, day: s.day, period: s.period, subject_id: s.subjectId }))

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from('schedule_slots').insert(toInsert)
    if (insErr) return { error: insErr.message }
  }

  await supabase.from('class_schedules').update({ updated_at: new Date().toISOString() }).eq('id', schedule.id)

  revalidatePath(`/classes/${classId}/schedule`)
  return { success: true }
}

// Добавя нов предмет в движение
export async function addSubject(name: string, allowsPullout: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }

  const { data: profile } = await supabase
    .from('staff_profiles').select('id').eq('user_id', user.id).single()

  const { data, error } = await supabase
    .from('subjects')
    .insert({ name: name.trim(), allows_pullout: allowsPullout, is_therapy: allowsPullout, created_by: profile?.id })
    .select().single()

  if (error) {
    if (error.message.includes('duplicate')) return { error: 'Вече съществува такъв предмет' }
    return { error: error.message }
  }
  return { subject: data }
}

// Копира слотовете от I срок в II срок
export async function copyFromTerm1(classId: string, academicYearId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }

  const { data: term1 } = await supabase
    .from('class_schedules').select('id')
    .eq('class_id', classId).eq('academic_year_id', academicYearId).eq('term', 1)
    .maybeSingle()

  if (!term1) return { error: 'Няма разписание за I срок' }

  const { data: slots } = await supabase
    .from('schedule_slots').select('day, period, subject_id').eq('schedule_id', term1.id)

  if (!slots || slots.length === 0) return { error: 'I срок е празен' }

  return { slots }
}
