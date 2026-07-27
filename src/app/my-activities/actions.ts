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
  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!profile) return { error: 'Няма профил' as const }
  return { supabase, profile }
}

export async function assignToMe(studentId: string) {
  const r = await myProfile()
  if ('error' in r) return r
  const { supabase, profile } = r

  const field = ROLE_FIELD[profile.role]
  if (!field) return { error: 'Само психолог, логопед или рехабилитатор може да зачислява деца.' }

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

  // Маха само ако наистина е зачислено при мен
  const { data: student } = await supabase
    .from('students').select(`id, ${field}`).eq('id', studentId).single()
  if ((student as any)?.[field] !== profile.id) {
    return { error: 'Това дете не е зачислено при вас.' }
  }

  const { error } = await supabase
    .from('students').update({ [field]: null }).eq('id', studentId)
  if (error) return { error: error.message }

  revalidatePath('/my-activities')
  return { success: true }
}
