// Общо за страницата на родителя: проверка на личния линк.
import type { SupabaseClient } from '@supabase/supabase-js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const MSG_LABEL: Record<string, string> = {
  ok: 'Разбрахме',
  unclear: 'Не разбирам — моля, обяснете',
  resend: 'Моля, изпратете материала отново',
  text: '',
}

export function todaySofia() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })   // YYYY-MM-DD
}

// ОРЕС периодът по линка — само ако е активен днес и детето е активно; иначе null
export async function activeOresByToken(db: SupabaseClient, token: string) {
  if (!UUID.test(token) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  const { data } = await db.from('student_ores')
    .select('id, from_date, to_date, room_closed_at, student:students(first_name, status)').eq('room_token', token).maybeSingle()
  const st = (data as any)?.student
  const today = todaySofia()
  if (!data || !st || st.status !== 'active' || (data as any).room_closed_at || data.from_date > today || (data.to_date && data.to_date < today)) return null
  return { id: data.id as string, from_date: data.from_date as string, to_date: data.to_date as string | null, firstName: st.first_name as string }
}
