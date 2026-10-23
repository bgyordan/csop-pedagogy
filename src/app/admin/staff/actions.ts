'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncYearFolderAccess, removeStaffAccess } from '@/lib/drive-access'

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
  const password = 'Csop2026!'
  const { data: created, error } = await admin.auth.admin.createUser({
    email: target.email, password, email_confirm: true,
  })
  if (error || !created?.user) return { error: 'Грешка при създаване на акаунт: ' + (error?.message || 'няма данни') }

  const { error: linkErr } = await admin.from('staff_profiles').update({ user_id: created.user.id }).eq('id', staffId)
  if (linkErr) return { error: 'Акаунтът е създаден, но връзката не мина: ' + linkErr.message }

  return { success: true, email: target.email, password }
}

// ── Права в Drive („ЕПЛР документи“) ──────────────────────────────────

async function isAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  return !!me && ['admin', 'zdud', 'director'].includes(me.role)
}

// Бутон „Права в Drive“: психолози и логопеди — всички деца; останалите — махнати от папката на годината
export async function syncDriveAccess() {
  if (!(await isAdmin())) return { error: 'Нямате права' }
  try { return await syncYearFolderAccess() }
  catch (e: any) { return { error: e?.message || 'Грешка при връзката с Drive' } }
}

// При деактивиране: маха правата на служителя в Drive за текущата година
export async function removeDriveAccess(staffId: string) {
  if (!(await isAdmin())) return { error: 'Нямате права' }
  try {
    const r = await removeStaffAccess(staffId)
    await syncYearFolderAccess()
    return r
  } catch (e: any) { return { error: e?.message || 'Грешка при връзката с Drive' } }
}

// ── Смяна на имейла за вход ───────────────────────────────────────────
// Сменя имейла И в профила, И в акаунта за вход (Supabase Auth), за да може
// колегата да влезе с новия Google акаунт (напр. @csop-varna.bg вместо @edu.mon.bg).
// Новите регистрации са забранени, затова само смяна в профила не стига.
// Само админ/директор; директор не може да сменя имейла на администратор.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function changeLoginEmail(staffId: string, newEmailRaw: string): Promise<{ ok?: true; authChanged?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).maybeSingle()
  if (!me || !['admin', 'director'].includes(me.role)) return { error: 'Само администратор или директор може да сменя имейла за вход' }

  const email = (newEmailRaw || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { error: 'Невалиден имейл' }

  const admin = createAdminClient()
  const { data: target } = await admin.from('staff_profiles').select('id, email, user_id, role').eq('id', staffId).maybeSingle()
  if (!target) return { error: 'Няма такъв профил' }
  if (target.role === 'admin' && me.role !== 'admin') return { error: 'Имейлът на администратор може да се смени само от администратор' }

  // друг профил със същия имейл?
  const { data: sameProfile } = await admin.from('staff_profiles').select('id, first_name, last_name')
    .ilike('email', email).neq('id', staffId).limit(1)
  if (sameProfile && sameProfile.length) {
    return { error: `Имейлът вече е на друг служител: ${sameProfile[0].first_name} ${sameProfile[0].last_name}` }
  }

  let authChanged = false
  if (target.user_id) {
    // друг акаунт за вход със същия имейл?
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listErr) return { error: 'Не успях да проверя акаунтите: ' + listErr.message }
    const other = list.users.find(u => (u.email || '').toLowerCase() === email && u.id !== target.user_id)
    if (other) return { error: 'Вече има друг акаунт за вход с този имейл. Обърнете се към поддръжката.' }

    const current = list.users.find(u => u.id === target.user_id)
    if ((current?.email || '').toLowerCase() !== email) {
      const { error: upErr } = await admin.auth.admin.updateUserById(target.user_id, { email, email_confirm: true })
      if (upErr) return { error: 'Акаунтът за вход не беше сменен: ' + upErr.message }
      authChanged = true
    }
  }

  const { error: profErr } = await admin.from('staff_profiles').update({ email }).eq('id', staffId)
  if (profErr) return { error: (authChanged ? 'Акаунтът за вход е сменен, но профилът не: ' : 'Грешка: ') + profErr.message }

  // дневник (ако таблицата още не е създадена — нищо)
  try {
    await admin.from('login_email_log').insert({
      staff_id: staffId, old_email: target.email, new_email: email, auth_changed: authChanged, changed_by: me.id,
    })
  } catch { /* */ }

  return { ok: true, authChanged }
}
