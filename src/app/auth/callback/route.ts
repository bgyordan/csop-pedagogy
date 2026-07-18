import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
  }

  // Създаваме временен response за да можем да записваме cookies
  const response = NextResponse.redirect(`${origin}/dashboard`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Разменяме кода за сесия
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
  }

  // Свързваме user_id с предварително създаден профил (по email)
  await supabase
    .from('staff_profiles')
    .update({ user_id: user.id })
    .eq('email', user.email)
    .is('user_id', null)

  // Проверяваме дали има профил — по user_id ИЛИ по email
  // (maybeSingle не хвърля грешка при 0 реда — избягва фалшив signOut)
  const { data: profileByUser } = await supabase
    .from('staff_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  let hasProfile = !!profileByUser

  // Резервна проверка по email, ако връзката още не се е "хванала"
  if (!hasProfile) {
    const { data: profileByEmail } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()
    hasProfile = !!profileByEmail
  }

  // Само ако наистина няма профил (нито по user_id, нито по email) — изход
  if (!hasProfile) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/auth/login?error=unauthorized`)
  }

  return response
}
