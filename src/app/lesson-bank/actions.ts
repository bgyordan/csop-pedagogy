'use server'

// Файловете се качват през подписан адрес от сървъра — така в storage не остава кой е качил.
// Изтриването на файла също минава оттук (след проверка, че е ваш или че сте от ръководството).

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'lesson-bank'

async function me() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!data || ['secretary', 'support'].includes(data.role)) return null
  return { supabase, staff: data }
}

export async function getUploadUrl(ext: string): Promise<{ path?: string; token?: string; error?: string }> {
  const m = await me()
  if (!m) return { error: 'Нямате достъп до банката' }
  const safe = (ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
  const path = `${crypto.randomUUID()}.${safe}`
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { error: error?.message || 'Грешка при подготовка на качването' }
  return { path: data.path, token: data.token }
}

// Файл, качен, но записът не е станал — чистим
export async function discardUpload(path: string) {
  const m = await me()
  if (!m) return
  const { data } = await m.supabase.from('lesson_bank_items').select('id').eq('file_path', path).maybeSingle()
  if (data) return   // вече е в банката — не пипаме
  await createAdminClient().storage.from(BUCKET).remove([path])
}

export async function removeItem(id: string): Promise<{ error?: string }> {
  const m = await me()
  if (!m) return { error: 'Нямате достъп' }
  const { data: item } = await m.supabase.from('lesson_bank_items').select('file_path').eq('id', id).single()
  if (!item) return { error: 'Няма такъв файл' }
  // RLS пуска изтриването само за автора или ръководството
  const { data: gone, error } = await m.supabase.from('lesson_bank_items').delete().eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!gone?.length) return { error: 'Можете да изтриете само свой файл' }
  await createAdminClient().storage.from(BUCKET).remove([item.file_path])
  return {}
}
