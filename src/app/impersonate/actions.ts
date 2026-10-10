'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { VIEW_AS_COOKIE } from '@/lib/view-as'
import { IMP_COOKIE, IMP_BACK_COOKIE, IMP_MINUTES } from '@/lib/impersonate'

// Само админ. Отваря истинска сесия на избрания служител; админската се пази за „Върни се“.
export async function startImpersonation(staffId: string): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const jar = await cookies()
  if (jar.get(IMP_COOKIE)) return { error: 'Вече действаш като друг служител — първо се върни.' }

  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).maybeSingle()
  if (me?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()
  const { data: target } = await admin.from('staff_profiles')
    .select('id, user_id, role, is_active').eq('id', staffId).maybeSingle()
  if (!target?.user_id) return { error: 'Този служител няма акаунт в системата.' }
  if (target.role === 'admin') return { error: 'Не може да се влиза като друг администратор.' }
  if (target.is_active === false) return { error: 'Служителят е неактивен.' }

  const { data: au } = await admin.auth.admin.getUserById(target.user_id)
  const email = au?.user?.email
  if (!email) return { error: 'Акаунтът на служителя няма имейл.' }

  // админската сесия — пази се, за да се върнеш без ново влизане
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.refresh_token) return { error: 'Не успях да запазя твоята сесия — влез наново и опитай пак.' }

  // еднократен линк (не се праща имейл) → потвърждава се веднага тук → сесия на колегата
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = link?.properties?.hashed_token
  if (!tokenHash) return { error: 'Неуспешно: ' + (linkErr?.message || 'няма линк') }
  const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  if (otpErr) return { error: 'Неуспешно: ' + otpErr.message }

  const opts = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 8 }
  jar.set(IMP_BACK_COOKIE, session.refresh_token, opts)
  jar.set(IMP_COOKIE, `${Date.now() + IMP_MINUTES * 60 * 1000}.${target.user_id}`, opts)
  jar.delete(VIEW_AS_COOKIE)
  jar.delete('eis_ok')

  // дневник (ако таблицата още не е създадена — нищо)
  try { await admin.from('impersonation_log').insert({ admin_staff_id: me.id, target_staff_id: target.id }) } catch { /* */ }

  return { ok: true }
}
