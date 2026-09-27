// „Виж като…“ — админът вижда МЕНЮТО и ТАБЛОТО на друг служител (само /dashboard).
// Нищо не се записва от чуждо име: страниците и действията си остават с правата на админа.
import { cookies } from 'next/headers'

export const VIEW_AS_COOKIE = 'eis_view_as'

// Връща профила, който да се ПОКАЖЕ (чуждия, ако админът е избрал „Виж като“), и истинския
export async function viewProfile(supabase: any, userId: string) {
  const { data: real } = await supabase.from('staff_profiles').select('*').eq('user_id', userId).maybeSingle()
  if (!real || real.role !== 'admin') return { profile: real, real, viewingAs: false }
  const id = (await cookies()).get(VIEW_AS_COOKIE)?.value
  if (!id || id === real.id) return { profile: real, real, viewingAs: false }
  const { data: other } = await supabase.from('staff_profiles').select('*').eq('id', id).maybeSingle()
  if (!other) return { profile: real, real, viewingAs: false }
  return { profile: other, real, viewingAs: true }
}
