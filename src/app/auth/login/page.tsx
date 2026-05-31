'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const supabase = createClient()

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `https://csop-pedagogy.vercel.app/auth/callback`,
      },
    })
    if (error) {
      setError('Грешка при влизане. Моля опитайте отново.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ backgroundColor: '#0f2240' }}>
            <span className="text-white text-2xl font-bold">Ц</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-800">ЦСОП Варна</h1>
          <p className="text-slate-500 text-sm mt-1">Педагогическа система</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Влезте в системата</h2>
          <p className="text-sm text-slate-500 mb-6">
            Използвайте вашия служебен Google акаунт
          </p>

          {(error || urlError) && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {urlError === 'unauthorized'
                ? 'Вашият имейл няма достъп до системата. Свържете се с администратора.'
                : urlError === 'auth_failed'
                ? 'Грешка при влизане. Моля опитайте отново.'
                : error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300
                       rounded-xl px-4 py-3 text-sm font-medium text-slate-700
                       hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? 'Влизане...' : 'Вход с Google'}
          </button>

          <p className="text-xs text-slate-400 text-center mt-6">
            Достъпът е само за служители на ЦСОП Варна
          </p>
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
