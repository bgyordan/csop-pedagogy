import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { IMP_COOKIE, IMP_BACK_COOKIE, parseImp } from '@/lib/impersonate'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/auth') || pathname.startsWith('/impersonate/stop')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // „Влез като…“: ако сесията вече не е на колегата (излязъл/влязъл друг) — чистим бисквитките;
  // ако часът е изтекъл — автоматично връщане към админа
  let imp = parseImp(request.cookies.get(IMP_COOKIE)?.value)
  if (imp && imp.targetUserId !== user.id) {
    supabaseResponse.cookies.delete(IMP_COOKIE)
    supabaseResponse.cookies.delete(IMP_BACK_COOKIE)
    imp = null
  }
  if (imp && Date.now() > imp.until && request.method === 'GET') {
    return NextResponse.redirect(new URL('/impersonate/stop', request.url))
  }

  // Неактивен служител (напуснал, пенсиониран, в дълъг отпуск) не влиза в системата.
  // Проверява се най-много веднъж на 5 минути (бисквитка eis_ok).
  if (!request.cookies.get('eis_ok')) {
    const { data: prof } = await supabase.from('staff_profiles').select('is_active').eq('user_id', user.id).maybeSingle()
    if (prof && prof.is_active === false) {
      try { await supabase.auth.signOut() } catch { /* бисквитките се трият и без това */ }
      const res = NextResponse.redirect(new URL('/auth/login?error=inactive', request.url))
      request.cookies.getAll().filter(c => c.name.startsWith('sb-')).forEach(c => res.cookies.delete(c.name))
      return res
    }
    supabaseResponse.cookies.set('eis_ok', '1', { maxAge: 300, path: '/', httpOnly: true, sameSite: 'lax' })
  }

  // „На линия сега“ (не и докато админ действа като колегата): отбелязваме активност най-много веднъж на 5 минути на потребител
  if (!imp && !request.cookies.get('eis_seen') && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/staff_profiles?user_id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
      })
    } catch { /* не пречи на страницата */ }
    supabaseResponse.cookies.set('eis_seen', '1', { maxAge: 300, path: '/', httpOnly: true, sameSite: 'lax' })
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
