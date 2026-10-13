'use server'

// Изтриване на ТЕСТОВ ОРЕС заедно с онлайн стаята му — само за администратор.
// Истинските ОРЕС не се трият (хронологията е доказателство) — приключват се от „Приключи ОРЕС“.
// Трие: въпросите на родителя, посещенията, публикациите, файловете в кофата online-room и самия ОРЕС запис.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function deleteTestOres(oresId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const db = createAdminClient()
  const { data: me } = await db.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (me?.role !== 'admin') return { error: 'Само администраторът може да изтрие тестов ОРЕС' }

  const { data: ores } = await db.from('student_ores').select('id, student_id').eq('id', oresId).maybeSingle()
  if (!ores) return { error: 'ОРЕС записът не е намерен' }

  // файловете, качени в стаята (материалите от библиотеката са в своята кофа и остават)
  const { data: posts } = await db.from('online_room_posts').select('file_path').eq('ores_id', oresId)
  const paths = (posts || []).map((p: any) => p.file_path).filter(Boolean) as string[]
  if (paths.length) {
    const { error } = await db.storage.from('online-room').remove(paths)
    if (error) return { error: 'Файловете не се изтриха: ' + error.message }
  }

  for (const table of ['online_room_messages', 'online_room_visits', 'online_room_posts']) {
    const { error } = await db.from(table).delete().eq('ores_id', oresId)
    if (error) return { error: `Грешка при триене (${table}): ${error.message}` }
  }
  const { error } = await db.from('student_ores').delete().eq('id', oresId)
  if (error) return { error: 'Грешка при триене на ОРЕС: ' + error.message }

  revalidatePath(`/students/${ores.student_id}`)
  revalidatePath('/dashboard')
  return { ok: true }
}
