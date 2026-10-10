import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { IMP_COOKIE, IMP_BACK_COOKIE, parseImp } from '@/lib/impersonate'

// „Върни се“ — затваря сесията на колегата и възстановява админската (без ново влизане)
export async function GET() {
  const jar = await cookies()
  const imp = parseImp(jar.get(IMP_COOKIE)?.value)
  const back = jar.get(IMP_BACK_COOKIE)?.value
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  jar.delete(IMP_COOKIE)
  jar.delete(IMP_BACK_COOKIE)
  jar.delete('eis_ok')

  // вече не сме в сесията на колегата (излязъл е, влязъл е някой друг) — само чистим
  if (!imp || !back || !user || user.id !== imp.targetUserId) redirect('/dashboard')

  // затваря САМО тази сесия на колегата (неговите собствени остават)
  await supabase.auth.signOut({ scope: 'local' })
  const { error } = await supabase.auth.refreshSession({ refresh_token: back })
  redirect(error ? '/auth/login' : '/dashboard')
}
