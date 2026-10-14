'use server'

// Изтриване на ГРЕШНО ВЪВЕДЕН ученик — само за администратор. Истинските деца се архивират.
// Изтрива се само ако детето няма вързани данни, които базата пази (ОРЕС, документи и т.н.) —
// тогава се връща в коя таблица са, вместо да се трият тихо.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const TABLE_BG: Record<string, string> = {
  student_ores: 'ОРЕС', online_room_posts: 'онлайн стаята', student_guardians: 'родители',
  student_attachments: 'документи', student_declarations: 'декларации', student_drive_files: 'документи в Drive',
  coud_enrollments: 'ЦОУД', teacher_ifo_slots: 'ИФО разписание', therapist_slots: 'терапевтичен график',
  eplr_teams: 'ЕПЛР екип', student_surveys: 'анкета', dev_assessments: 'развитие', orders: 'заповеди',
  correspondence: 'деловодство', lecturer_slots: 'лекторски',
}

export async function deleteWrongStudent(studentId: string, confirmLastName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const db = createAdminClient()
  const { data: me } = await db.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (me?.role !== 'admin') return { error: 'Само администраторът може да изтрие ученик' }

  const { data: st } = await db.from('students').select('id, first_name, last_name').eq('id', studentId).maybeSingle()
  if (!st) return { error: 'Ученикът не е намерен' }
  if ((confirmLastName || '').trim().toLowerCase() !== (st.last_name || '').trim().toLowerCase())
    return { error: 'Фамилията не съвпада — нищо не е изтрито' }

  const { error } = await db.from('students').delete().eq('id', studentId)
  if (error) {
    if (error.code === '23503') {
      const t = (error.message.match(/on table "([^"]+)"/g) || []).map(x => x.replace(/on table "|"/g, '')).find(x => x !== 'students') || ''
      return { error: `Детето има записи в „${TABLE_BG[t] || t || 'друга таблица'}“ — изтрийте ги първо или го архивирайте.` }
    }
    return { error: error.message }
  }
  revalidatePath('/students')
  return { success: true }
}
