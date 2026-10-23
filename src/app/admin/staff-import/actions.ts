'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ImportRow = {
  staff_id: string; neispuo_id: string | null
  set: Record<string, unknown>; staff: { position?: string; phone?: string }; neispuo: Record<string, unknown>
}

/** Записва избраните промени (правата се проверяват и в базата — neispuo_import_staff). */
export async function importStaff(rows: ImportRow[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'director', 'zdud'].includes(me?.role || '')) return { error: 'Нямате права' }
  const { data, error } = await supabase.rpc('neispuo_import_staff', { p_rows: rows })
  if (error) return { error: /neispuo_import_staff|neispuo/.test(error.message) && /exist|schema cache/.test(error.message) ? 'Пуснете SQL файла 2026-10-31_neispuo_staff_import.sql' : error.message }
  revalidatePath('/admin/staff-import'); revalidatePath('/pro-portfolio')
  return { success: true, count: Number(data) || 0 }
}
