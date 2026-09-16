'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function genPassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let p = ''
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)]
  return p
}

export async function createStaffAccount(staffId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!me || !['admin', 'zdud'].includes(me.role)) return { error: 'Само админ/ЗДУД може да създава достъп' }

  const { data: target } = await supabase.from('staff_profiles').select('id, email, user_id').eq('id', staffId).single()
  if (!target) return { error: 'Няма такъв профил' }
  if (target.user_id) return { error: 'Този служител вече има акаунт' }
  if (!target.email || !target.email.includes('@')) return { error: 'Профилът няма валиден имейл' }

  const admin = createAdminClient()
  const password = genPassword()
  const { data: created, error } = await admin.auth.admin.createUser({
    email: target.email, password, email_confirm: true,
  })
  if (error || !created?.user) return { error: 'Грешка при създаване на акаунт: ' + (error?.message || 'няма данни') }

  const { error: linkErr } = await admin.from('staff_profiles').update({ user_id: created.user.id }).eq('id', staffId)
  if (linkErr) return { error: 'Акаунтът е създаден, но връзката не мина: ' + linkErr.message }

  return { success: true, email: target.email, password }
}
