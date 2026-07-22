'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { KeyRound, User, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setEmail(user.email || '')
      const { data: profile } = await supabase
        .from('staff_profiles')
        .select('first_name, middle_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle()
      if (profile) {
        setName([profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' '))
      }
    })()
  }, [])

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    if (pw1.length < 6) {
      setMsg({ type: 'err', text: 'Паролата трябва да е поне 6 знака.' })
      return
    }
    if (pw1 !== pw2) {
      setMsg({ type: 'err', text: 'Двете пароли не съвпадат.' })
      return
    }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw1 })
    setSaving(false)

    if (error) {
      setMsg({ type: 'err', text: `Грешка: ${error.message}` })
      return
    }
    setMsg({ type: 'ok', text: 'Паролата е сменена успешно.' })
    setPw1('')
    setPw2('')
  }

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} /> Назад
      </Link>

      <h1 className="text-xl md:text-2xl font-semibold text-slate-800 mb-6">Моят профил</h1>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-4">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">
          <User size={14} /> Данни
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Име</span>
            <span className="text-slate-700 font-medium">{name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Имейл</span>
            <span className="text-slate-700 font-mono text-xs">{email}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">
          <KeyRound size={14} /> Смяна на парола
        </div>

        {msg && (
          <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
            msg.type === 'ok'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {msg.type === 'ok' && <CheckCircle2 size={15} />}
            {msg.text}
          </div>
        )}

        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Нова парола</label>
            <input
              type="password"
              value={pw1}
              onChange={e => setPw1(e.target.value)}
              placeholder="Поне 6 знака"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Повтори новата парола</label>
            <input
              type="password"
              value={pw2}
              onChange={e => setPw2(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#0f2240' }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            {saving ? 'Запазване...' : 'Смени паролата'}
          </button>
        </form>
      </div>
    </div>
  )
}
