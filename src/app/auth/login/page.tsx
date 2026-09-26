'use client'
import { createClient } from '@/lib/supabase/client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlError = searchParams.get('error')
  const supabase = createClient()

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Грешен имейл или парола.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  // domain = 'edu.mon.bg' → Google показва само акаунтите от МОН (НЕИСПУО / Teams)
  async function handleGoogleLogin(domain?: string) {
    setLoading(true)
    setError(null)
    const queryParams: Record<string, string> = { prompt: 'select_account' }
    if (domain) queryParams.hd = domain
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams,
      },
    })
    if (error) {
      setError('Входът с Google не успя. Опитайте отново.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
        <img src="/csop-varna-logo.jpg" alt="ЦСОП Варна"
               className="inline-block w-16 h-16 rounded-2xl mb-4 object-cover" />
          <h1 className="text-2xl font-semibold text-slate-800">ЦСОП Варна</h1>
          <p className="text-slate-500 text-sm mt-1">Информационна система</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-5 text-center">Вход</h2>

          {(error || urlError) && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {urlError === 'unauthorized'
                ? 'Този акаунт няма достъп до системата.'
                : (error || 'Входът не успя. Опитайте отново.')}
            </div>
          )}

          {/* ОСНОВНО: акаунтът от МОН (НЕИСПУО / Teams) */}
          <button
            type="button"
            onClick={() => handleGoogleLogin('edu.mon.bg')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-sky-200 bg-sky-50 text-sm font-medium hover:bg-sky-100 hover:shadow-sm transition disabled:opacity-50"
            style={{ color: '#0f2240' }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
            </svg>
            Вход с НЕИСПУО
          </button>

          {/* другите начини — дискретно */}
          {!showPassword ? (
            <div className="flex items-center justify-center gap-3 mt-5 text-xs text-slate-400">
              <button type="button" onClick={() => setShowPassword(true)} className="hover:text-slate-600 transition">
                Имейл и парола
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-3 mt-5 pt-5 border-t border-slate-100">
              <input
                type="email"
                required
                autoFocus
                placeholder="Имейл"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <input
                type="password"
                required
                placeholder="Парола"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: '#0f2240' }}
              >
                {loading ? 'Влизане...' : 'Вход'}
              </button>
              <button type="button" onClick={() => setShowPassword(false)} className="w-full text-xs text-slate-400 hover:text-slate-600 transition">
                Назад
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
