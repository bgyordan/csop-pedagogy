'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VIEW_AS_COOKIE } from '@/lib/view-as'
import { canViewAs, viewAsBlocked } from '@/lib/impersonate'

// Админ и ЗДУД. staffId = null → връщане към собствения изглед
export async function setViewAs(staffId: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).maybeSingle()
  if (!canViewAs(me?.role)) redirect('/dashboard')
  if (staffId) {
    const { data: t } = await supabase.from('staff_profiles').select('role').eq('id', staffId).maybeSingle()
    if (!t || viewAsBlocked(me?.role, t.role, 'view')) redirect('/dashboard')
  }
  const jar = await cookies()
  if (staffId) jar.set(VIEW_AS_COOKIE, staffId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 4 })
  else jar.delete(VIEW_AS_COOKIE)
  redirect('/dashboard')
}
