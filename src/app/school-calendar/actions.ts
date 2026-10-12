'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const MANAGERS = ['admin', 'zdud', 'director']

/**
 * Спонтанен неучебен ден: reason = причината → денят става неучебен;
 * reason = null → връща се като учебен. Пипа само учебни дни или вече маркирани спонтанни.
 */
export async function setSpontaneousDay(date: string, reason: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!MANAGERS.includes(me?.role || '')) return { error: 'Нямате права' }

  const { data: day, error: e1 } = await supabase.from('academic_calendar_days').select('date, is_school_day, spontaneous').eq('date', date).maybeSingle()
  if (e1) return { error: /spontaneous/.test(e1.message) ? 'Пуснете SQL файла 2026-10-12_calendar_spontaneous.sql' : e1.message }
  if (!day) return { error: 'Денят го няма в учебния календар' }

  if (reason !== null) {
    if (!day.is_school_day) return { error: 'Денят и без това не е учебен' }
    const { error } = await supabase.from('academic_calendar_days')
      .update({ is_school_day: false, spontaneous: true, notes: reason.trim() || 'Неучебен ден' }).eq('date', date)
    if (error) return { error: error.message }
  } else {
    if (!day.spontaneous) return { error: 'Само спонтанен неучебен ден може да се върне' }
    const { error } = await supabase.from('academic_calendar_days')
      .update({ is_school_day: true, spontaneous: false, notes: null }).eq('date', date)
    if (error) return { error: error.message }
  }
  revalidatePath('/school-calendar')
  revalidatePath('/dashboard')
  return { ok: true }
}
