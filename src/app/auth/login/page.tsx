'use client'
import { createClient } from '@/lib/supabase/client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
            Използвайте служебния си имейл и парола
          </p>

          {(error || urlError) && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {urlError === 'unauthorized'
                ? 'Вашият имейл няма достъп до системата. Свържете се с администратора.'
                : error}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-3">
            <input
              type="email"
              required
              placeholder="Служебен имейл"
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
          </form>

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
