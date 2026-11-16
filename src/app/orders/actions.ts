'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Изтриване на заповед — админ и деловодство (secretary).
// Правата се проверяват тук, после се трие със service-role (не зависи от политиките в базата).
// Заповед, вързана към заместване, не се трие оттук — първо се изтрива/отвързва заместването.
export async function deleteOrder(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'secretary'].includes(me?.role || '')) return { error: 'Нямате права да триете заповеди' }

  const db = createAdminClient()
  const { count } = await db.from('substitutions').select('id', { count: 'exact', head: true }).eq('substitution_order_id', id)
  if (count) return { error: 'Заповедта е към заместване — изтрийте/променете първо заместването (в „Отсъствия и замествания“).' }

  const { error } = await db.from('orders').delete().eq('id', id)
  if (error) return { error: 'Грешка при изтриване: ' + error.message }
  return {}
}
