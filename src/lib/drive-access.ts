// Права в Drive („ЕПЛР документи“), които не зависят от едно дете:
//  • психолозите и логопедите редактират ВСИЧКИ деца — правото е на папката на годината и се наследява
//  • неактивен служител губи правата си в папките от текущата година

import { createClient } from '@/lib/supabase/server'
import { ensureYearFolder, listYearFolders, shareWriter, unshareEmails, accountEmails } from '@/lib/google-drive'

export const ALL_KIDS_ROLES = ['psychologist', 'speech_therapist']

export function seesAllKids(p?: { role?: string | null; therapy_role?: string | null } | null) {
  return !!p && (ALL_KIDS_ROLES.includes(p.role || '') || ALL_KIDS_ROLES.includes(p.therapy_role || ''))
}

// Вече дадени права в този процес — да не питаме Google при всяко отваряне
const done = new Set<string>()

// Дава редакция на тези акаунти върху папката (веднъж на процес). Несъществуващ акаунт се прескача.
export async function ensureWriters(folderId: string, accounts: string[]) {
  for (const e of accounts) {
    const key = `${folderId}|${e}`
    if (done.has(key)) continue
    done.add(key)
    try { await shareWriter(folderId, e) } catch { /* няма такъв акаунт (напр. csop-varna.bg) */ }
  }
}

async function currentYearName() {
  const supabase = await createClient()
  const { data } = await supabase.from('academic_years').select('name').eq('is_current', true).single()
  return (data?.name as string) || ''
}

// Синхронизира папката на текущата година: психолози и логопеди — да; всички други служители — не
export async function syncYearFolderAccess() {
  const supabase = await createClient()
  const yearName = await currentYearName()
  if (!yearName) return { error: 'Няма текуща учебна година' }

  const { data: staff } = await supabase.from('staff_profiles').select('email, role, therapy_role, is_active')
  const allowed = new Set<string>()
  const others = new Set<string>()
  for (const s of (staff || []) as any[]) {
    const acc = accountEmails(s.email)
    if (s.is_active !== false && seesAllKids(s)) acc.forEach(e => allowed.add(e))
    else acc.forEach(e => others.add(e))
  }
  allowed.forEach(e => others.delete(e))

  const yearId = await ensureYearFolder(yearName)
  for (const e of Array.from(allowed)) done.delete(`${yearId}|${e}`)   // ръчно пускане — питаме Google наново
  await ensureWriters(yearId, Array.from(allowed))
  const removed = await unshareEmails(yearId, Array.from(others))
  return { year: yearName, people: allowed.size / 2, removed }
}

// Неактивен служител: маха правата му от папката на годината и от всички папки на деца/паралелки в нея
export async function removeStaffAccess(staffId: string) {
  const supabase = await createClient()
  const { data: s } = await supabase.from('staff_profiles').select('email').eq('id', staffId).single()
  const emails = accountEmails(s?.email)
  if (!emails.length) return { removed: 0 }
  const yearName = await currentYearName()
  if (!yearName) return { removed: 0 }

  const ids = [await ensureYearFolder(yearName), ...(await listYearFolders(yearName))]
  let removed = 0
  // по 5 наведнъж — иначе ~200 папки стават бавно
  for (let i = 0; i < ids.length; i += 5) {
    const r = await Promise.all(ids.slice(i, i + 5).map(id => unshareEmails(id, emails).catch(() => 0)))
    removed += r.reduce((a, b) => a + b, 0)
  }
  for (const k of Array.from(done)) if (emails.some(e => k.endsWith(`|${e}`))) done.delete(k)
  return { removed }
}
