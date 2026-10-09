'use server'
// ЕПЛР екип на ученика — запис през сървъра с проверка на правата:
// управата, координаторът и КЛАСНИЯТ РЪКОВОДИТЕЛ на паралелката на детето (за текущата година).
// Терапевтите (кой реално работи с детето) остават отделно — „Попълни от терапевтите“ ги копира веднъж, по желание.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function guard(studentId: string): Promise<{ ok: true; yearId: string; classTeacherId: string | null } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Не сте влезли' }
  const db = createAdminClient()
  const { data: me } = await db.from('staff_profiles').select('id, role, is_coordinator').eq('user_id', user.id).single()
  if (!me) return { ok: false, error: 'Няма профил' }
  const { data: year } = await db.from('academic_years').select('id').eq('is_current', true).single()
  if (!year) return { ok: false, error: 'Няма текуща учебна година' }
  const { data: enr } = await db.from('student_enrollments').select('class_id').eq('student_id', studentId).eq('academic_year_id', year.id).maybeSingle()
  const { data: cts } = enr?.class_id
    ? await db.from('class_teacher_assignments').select('staff_id').eq('class_id', enr.class_id).eq('academic_year_id', year.id)
    : { data: [] as any[] }
  const ctIds = (cts || []).map((c: any) => c.staff_id as string)
  const allowed = ['admin', 'zdud', 'director'].includes(me.role) || me.is_coordinator === true || ctIds.includes(me.id)
  if (!allowed) return { ok: false, error: 'ЕПЛР екипа го определят управата, координаторът и класният ръководител на паралелката' }
  return { ok: true, yearId: year.id, classTeacherId: ctIds[0] || null }
}

export async function canEditEplrTeam(studentId: string) {
  const g = await guard(studentId)
  return { ok: g.ok }
}

export async function saveEplrTeam(studentId: string, t: { psychologist_id: string | null; speech_therapist_id: string | null; rehabilitator_id: string | null }) {
  const g = await guard(studentId)
  if (!g.ok) return { error: g.error }
  const { error } = await createAdminClient().from('eplr_teams').upsert({
    student_id: studentId, academic_year_id: g.yearId,
    psychologist_id: t.psychologist_id || null, speech_therapist_id: t.speech_therapist_id || null, rehabilitator_id: t.rehabilitator_id || null,
    class_teacher_id: g.classTeacherId,   // класният винаги следва паралелката
  }, { onConflict: 'student_id,academic_year_id' })
  if (error) return { error: error.message }
  revalidatePath(`/students/${studentId}`)
  return { success: true }
}

/** ЕПЛР екипът = терапевтите, които работят с детето (рехабилитатор — първият; празните места не трият попълненото) */
export async function fillEplrFromTherapists(studentId: string) {
  const g = await guard(studentId)
  if (!g.ok) return { error: g.error }
  const db = createAdminClient()
  const { data: s } = await db.from('students').select('therapist_psychologist_id, therapist_speech_id, therapist_rehab_id, therapist_rehab2_id').eq('id', studentId).single()
  if (!s) return { error: 'Ученикът не е намерен' }
  const { data: cur } = await db.from('eplr_teams').select('psychologist_id, speech_therapist_id, rehabilitator_id').eq('student_id', studentId).eq('academic_year_id', g.yearId).maybeSingle()
  const { error } = await db.from('eplr_teams').upsert({
    student_id: studentId, academic_year_id: g.yearId,
    psychologist_id: s.therapist_psychologist_id || cur?.psychologist_id || null,
    speech_therapist_id: s.therapist_speech_id || cur?.speech_therapist_id || null,
    rehabilitator_id: s.therapist_rehab_id || s.therapist_rehab2_id || cur?.rehabilitator_id || null,
    class_teacher_id: g.classTeacherId,
  }, { onConflict: 'student_id,academic_year_id' })
  if (error) return { error: error.message }
  revalidatePath(`/students/${studentId}`)
  return { success: true }
}

export async function addEplrExternal(studentId: string, fullName: string) {
  const g = await guard(studentId)
  if (!g.ok) return { error: g.error }
  const name = fullName.trim()
  if (!name) return { error: 'Въведете име' }
  const { data, error } = await createAdminClient().from('eplr_external_members')
    .insert({ student_id: studentId, academic_year_id: g.yearId, full_name: name }).select('id, full_name').single()
  if (error) return { error: error.message }
  revalidatePath(`/students/${studentId}`)
  return { data }
}

export async function removeEplrExternal(studentId: string, extId: string) {
  const g = await guard(studentId)
  if (!g.ok) return { error: g.error }
  const { error } = await createAdminClient().from('eplr_external_members').delete().eq('id', extId).eq('student_id', studentId)
  if (error) return { error: error.message }
  revalidatePath(`/students/${studentId}`)
  return { success: true }
}
