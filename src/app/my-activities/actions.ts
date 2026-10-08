'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
// Кое поле отговаря на коя роля
const ROLE_FIELD: Record<string, string> = {
  psychologist: 'therapist_psychologist_id',
  speech_therapist: 'therapist_speech_id',
  rehabilitator: 'therapist_rehab_id',
}
async function myProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' as const }
  const { data: p } = await supabase
    .from('staff_profiles').select('id, role, therapy_role').eq('user_id', user.id).single()
  if (!p) return { error: 'Няма профил' as const }
  // терапевтичната роля: основната, ако е терапевтична, иначе втората (напр. ЗДУД + логопед)
  const profile = { id: p.id as string, role: (ROLE_FIELD[p.role] ? p.role : (p as any).therapy_role || p.role) as string }
  return { supabase, profile }
}
export async function assignToMe(studentId: string) {
  const r = await myProfile()
  if ('error' in r) return r
  const { supabase, profile } = r
  const field = ROLE_FIELD[profile.role]
  if (!field) return { error: 'Само психолог, логопед или рехабилитатор може да зачислява деца.' }
  // Рехабилитаторите имат ДВЕ места при детето (ерго/кинези/рехаб. са с една роля)
  if (profile.role === 'rehabilitator') {
    const { data: st } = await supabase
      .from('students').select('id, therapist_rehab_id, therapist_rehab2_id').eq('id', studentId).single()
    const s1 = (st as any)?.therapist_rehab_id as string | null
    const s2 = (st as any)?.therapist_rehab2_id as string | null
    if (s1 === profile.id || s2 === profile.id) return { success: true }
    const target = !s1 ? 'therapist_rehab_id' : !s2 ? 'therapist_rehab2_id' : null
    if (!target) return { error: 'Детето вече е при двама рехабилитатори.' }
    const { error } = await supabase
      .from('students').update({ [target]: profile.id }).eq('id', studentId)
    if (error) return { error: error.message }
    revalidatePath('/my-activities')
    return { success: true }
  }
  // Проверка дали полето вече е заето
  const { data: student } = await supabase
    .from('students').select(`id, ${field}`).eq('id', studentId).single()
  const current = (student as any)?.[field]
  if (current && current !== profile.id) {
    return { error: 'Това дете вече е зачислено при друг специалист.' }
  }
  const { error } = await supabase
    .from('students').update({ [field]: profile.id }).eq('id', studentId)
  if (error) return { error: error.message }
  revalidatePath('/my-activities')
  return { success: true }
}
export async function removeFromMe(studentId: string) {
  const r = await myProfile()
  if ('error' in r) return r
  const { supabase, profile } = r
  const field = ROLE_FIELD[profile.role]
  if (!field) return { error: 'Невалидна роля.' }
  // Маха само ако наистина е зачислено при мен (рехабилитатор — от което от двете места е)
  const fields = profile.role === 'rehabilitator' ? ['therapist_rehab_id', 'therapist_rehab2_id'] : [field]
  const { data: student } = await supabase
    .from('students').select(`id, ${fields.join(', ')}`).eq('id', studentId).single()
  const myField = fields.find(f => (student as any)?.[f] === profile.id)
  if (!myField) {
    return { error: 'Това дете не е зачислено при вас.' }
  }
  const { error } = await supabase
    .from('students').update({ [myField]: null }).eq('id', studentId)
  if (error) return { error: error.message }
  // Чистене на слотовете на това дете от графика на терапевта
  const { data: mySchedules } = await supabase
    .from('therapist_schedules').select('id').eq('staff_id', profile.id)
  const scheduleIds = (mySchedules || []).map((s: any) => s.id)
  if (scheduleIds.length > 0) {
    await supabase
      .from('therapist_slots')
      .delete()
      .eq('student_id', studentId)
      .in('schedule_id', scheduleIds)
  }
  revalidatePath('/my-activities')
  return { success: true }
}
