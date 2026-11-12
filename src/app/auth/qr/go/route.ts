import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Потвърждава еднократния QR код (magic link token_hash) → сесия на колегата → таблото.
export async function POST(request: NextRequest) {
  const fwdHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const fwdProto = request.headers.get('x-forwarded-proto') || 'https'
  const origin = fwdHost ? `${fwdProto}://${fwdHost}` : new URL(request.url).origin

  const form = await request.formData()
  const t = String(form.get('t') || '')
  if (!t) return NextResponse.redirect(`${origin}/auth/login?error=qr`, 303)

  const response = NextResponse.redirect(`${origin}/dashboard`, 303)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )
  const { error } = await supabase.auth.verifyOtp({ token_hash: t, type: 'magiclink' })
  if (error) return NextResponse.redirect(`${origin}/auth/login?error=qr`, 303)
  return response
}
