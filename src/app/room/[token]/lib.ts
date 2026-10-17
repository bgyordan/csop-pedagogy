// Общо за страницата на родителя: проверка на личния линк.
// Линкът е или от личната ОРЕС стая на детето (student_ores.room_token),
// или от стаята на паралелката (class_room_members.token) — по един за всяко дете.
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
    .select('id, student_id, from_date, to_date, room_closed_at, student:students(first_name, status)').eq('room_token', token).maybeSingle()
  const st = (data as any)?.student
  const today = todaySofia()
  if (!data || !st || st.status !== 'active' || (data as any).room_closed_at || data.from_date > today || (data.to_date && data.to_date < today)) return null
  return { id: data.id as string, studentId: (data as any).student_id as string, from_date: data.from_date as string, to_date: data.to_date as string | null, firstName: st.first_name as string }
}

// Детето в стаята на паралелката по личния линк — само ако линкът не е спрян, стаята е отворена днес и детето е активно
export async function activeMemberByToken(db: SupabaseClient, token: string) {
  if (!UUID.test(token) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  const { data, error } = await db.from('class_room_members')
    .select('id, room_id, student_id, revoked_at, student:students(first_name, status), room:class_rooms(from_date, to_date, reason, closed_at, class:classes(name))')
    .eq('token', token).maybeSingle()
  if (error || !data) return null
  const st = (data as any).student, r = (data as any).room
  const today = todaySofia()
  if (!st || st.status !== 'active' || !r || data.revoked_at || r.closed_at || r.from_date > today || r.to_date < today) return null
  return {
    memberId: data.id as string, roomId: data.room_id as string, studentId: data.student_id as string,
    firstName: st.first_name as string, from_date: r.from_date as string, to_date: r.to_date as string,
    reason: (r.reason || null) as string | null, className: (r.class?.name || '') as string,
  }
}
