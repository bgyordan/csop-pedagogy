import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user?.email) {
        // 1. Опитваме да свържем user_id с предварително създаден профил
        await supabase
          .from('staff_profiles')
          .update({ user_id: user.id })
          .eq('email', user.email)
          .is('user_id', null)

        // 2. Проверяваме дали този потребител реално ИМА профил в системата
        const { data: profile } = await supabase
          .from('staff_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single()

        // 3. Ако няма профил (неодобрен имейл), прекратяваме сесията!
        if (!profile) {
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/auth/login?error=unauthorized`)
        }
      }
      return response
    }
  }

  // Ако има грешка с кода
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
