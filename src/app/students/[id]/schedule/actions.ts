'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveIfoSchedule(
  studentId: string,
  academicYearId: string,
  term: number,
  slots: { day: number; period: number; subjectId: string | null }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }

  let { data: schedule } = await supabase
    .from('class_schedules')
    .select('id')
    .eq('student_id', studentId)
    .eq('academic_year_id', academicYearId)
    .eq('term', term)
    .maybeSingle()

  if (!schedule) {
    const { data: profile } = await supabase
      .from('staff_profiles').select('id').eq('user_id', user.id).single()
    const { data: created, error: createErr } = await supabase
      .from('class_schedules')
      .insert({ student_id: studentId, academic_year_id: academicYearId, term, created_by: profile?.id })
      .select('id').single()
    if (createErr) return { error: createErr.message }
    schedule = created
  }

  await supabase.from('schedule_slots').delete().eq('schedule_id', schedule.id)

  const toInsert = slots
    .filter(s => s.subjectId)
    .map(s => ({ schedule_id: schedule!.id, day: s.day, period: s.period, subject_id: s.subjectId }))

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from('schedule_slots').insert(toInsert)
    if (insErr) return { error: insErr.message }
  }

  await supabase.from('class_schedules').update({ updated_at: new Date().toISOString() }).eq('id', schedule.id)

  revalidatePath(`/students/${studentId}/schedule`)
  return { success: true }
}

export async function copyIfoFromTerm1(studentId: string, academicYearId: string) {
  const supabase = await createClient()
  const { data: term1 } = await supabase
    .from('class_schedules').select('id')
    .eq('student_id', studentId).eq('academic_year_id', academicYearId).eq('term', 1)
    .maybeSingle()
  if (!term1) return { error: 'Няма разписание за I срок' }

  const { data: slots } = await supabase
    .from('schedule_slots').select('day, period, subject_id').eq('schedule_id', term1.id)
  if (!slots || slots.length === 0) return { error: 'I срок е празен' }
  return { slots }
}
