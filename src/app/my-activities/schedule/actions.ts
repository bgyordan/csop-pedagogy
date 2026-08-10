'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Помощна: намира с кой staff_id да работим.
// Ако е подаден targetStaffId и извикващият е admin/zdud/director → него.
// Иначе → собствения профил.
async function resolveStaffId(supabase: any, targetStaffId?: string | null) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' as const }
  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!profile) return { error: 'Няма профил' as const }
  if (targetStaffId && targetStaffId !== profile.id) {
    if (!['admin', 'zdud', 'director'].includes(profile.role)) {
      return { error: 'Нямате право да редактирате чужд график' as const }
    }
    return { staffId: targetStaffId as string }
  }
  return { staffId: profile.id as string }
}

export async function saveTherapistSchedule(
  academicYearId: string,
  term: number,
  slots: { day: number; period: number; studentId: string | null }[],
  targetStaffId?: string | null
) {
  const supabase = await createClient()
  const r = await resolveStaffId(supabase, targetStaffId)
  if ('error' in r) return { error: r.error }
  const staffId = r.staffId

  let { data: schedule } = await supabase
    .from('therapist_schedules').select('id')
    .eq('staff_id', staffId).eq('academic_year_id', academicYearId).eq('term', term)
    .maybeSingle()
  if (!schedule) {
    const { data: created, error: createErr } = await supabase
      .from('therapist_schedules')
      .insert({ staff_id: staffId, academic_year_id: academicYearId, term })
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

export async function copyTherapistFromTerm1(academicYearId: string, targetStaffId?: string | null) {
  const supabase = await createClient()
  const r = await resolveStaffId(supabase, targetStaffId)
  if ('error' in r) return { error: r.error }
  const staffId = r.staffId
  const { data: term1 } = await supabase
    .from('therapist_schedules').select('id')
    .eq('staff_id', staffId).eq('academic_year_id', academicYearId).eq('term', 1)
    .maybeSingle()
  if (!term1) return { error: 'Няма график за I срок' }
  const { data: slots } = await supabase
    .from('therapist_slots').select('day, period, student_id').eq('schedule_id', term1.id)
  if (!slots || slots.length === 0) return { error: 'I срок е празен' }
  return { slots }
}
