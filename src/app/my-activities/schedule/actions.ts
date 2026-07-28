'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveTherapistSchedule(
  academicYearId: string,
  term: number,
  slots: { day: number; period: number; studentId: string | null }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }

  const { data: profile } = await supabase
    .from('staff_profiles').select('id').eq('user_id', user.id).single()
  if (!profile) return { error: 'Няма профил' }

  let { data: schedule } = await supabase
    .from('therapist_schedules').select('id')
    .eq('staff_id', profile.id).eq('academic_year_id', academicYearId).eq('term', term)
    .maybeSingle()

  if (!schedule) {
    const { data: created, error: createErr } = await supabase
      .from('therapist_schedules')
      .insert({ staff_id: profile.id, academic_year_id: academicYearId, term })
      .select('id').single()
    if (createErr) return { error: createErr.message }
    schedule = created
  }

  await supabase.from('therapist_slots').delete().eq('schedule_id', schedule.id)

  const toInsert = slots
    .filter(s => s.studentId)
    .map(s => ({ schedule_id: schedule!.id, day: s.day, period: s.period, student_id: s.studentId }))

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from('therapist_slots').insert(toInsert)
    if (insErr) return { error: insErr.message }
  }

  await supabase.from('therapist_schedules').update({ updated_at: new Date().toISOString() }).eq('id', schedule.id)

  revalidatePath('/my-activities/schedule')
  return { success: true }
}

export async function copyTherapistFromTerm1(academicYearId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }

  const { data: profile } = await supabase
    .from('staff_profiles').select('id').eq('user_id', user.id).single()
  if (!profile) return { error: 'Няма профил' }

  const { data: term1 } = await supabase
    .from('therapist_schedules').select('id')
    .eq('staff_id', profile.id).eq('academic_year_id', academicYearId).eq('term', 1)
    .maybeSingle()
  if (!term1) return { error: 'Няма график за I срок' }

  const { data: slots } = await supabase
    .from('therapist_slots').select('day, period, student_id').eq('schedule_id', term1.id)
  if (!slots || slots.length === 0) return { error: 'I срок е празен' }
  return { slots }
}
