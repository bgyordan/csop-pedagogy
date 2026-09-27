'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VIEW_AS_COOKIE } from '@/lib/view-as'

// Само админ. staffId = null → връщане към собствения изглед
export async function setViewAs(staffId: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).maybeSingle()
  if (me?.role !== 'admin') redirect('/dashboard')
  const jar = await cookies()
  if (staffId) jar.set(VIEW_AS_COOKIE, staffId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 4 })
  else jar.delete(VIEW_AS_COOKIE)
  redirect('/dashboard')
}
