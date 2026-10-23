'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { notify } from '@/components/ui/Toast'

// Вход и парола: имейлът за вход (сменя го администраторът) и смяна на паролата.
export default function ProfileSecurity({ loginEmail, workEmail }: { loginEmail: string; workEmail: string | null }) {
  const supabase = createClient()
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [saving, setSaving] = useState(false)

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pw1.length < 6) return notify('Паролата трябва да е поне 6 знака.')
    if (pw1 !== pw2) return notify('Двете пароли не съвпадат.')
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw1 })
    setSaving(false)
    if (error) return notify(`Грешка: ${error.message}`)
    notify('Паролата е сменена.', 'success')
    setPw1(''); setPw2('')
  }

  const input = 'w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'
  return (
    <div className="grid md:grid-cols-2 gap-5">
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-800 mb-4"><Mail size={16} className="text-slate-400" /> Вход в системата</h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[12px] text-slate-400">Имейл за вход</dt>
            <dd className="font-mono text-[13px] text-slate-800 break-all">{loginEmail || '—'}</dd>
          </div>
          {workEmail && workEmail.toLowerCase() !== loginEmail.toLowerCase() && (
            <div>
              <dt className="text-[12px] text-slate-400">Служебен имейл в ЕИС</dt>
              <dd className="font-mono text-[13px] text-slate-800 break-all">{workEmail}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 flex items-start gap-2 text-[12.5px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2.5">
          <ShieldCheck size={15} className="shrink-0 mt-0.5 text-emerald-600" />
          Имейлът за вход се сменя от администратора (Администрация → Служители). След 30 минути без действие системата излиза сама.
        </p>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-800 mb-4"><KeyRound size={16} className="text-slate-400" /> Смяна на парола</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Нова парола</label>
            <input type="password" autoComplete="new-password" value={pw1} onChange={e => setPw1(e.target.value)} placeholder="Поне 6 знака" className={input} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Повтори новата парола</label>
            <input type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} className={input} />
          </div>
          <button type="submit" disabled={saving}
            className="w-full py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 bg-[#0f2240] hover:opacity-90">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            {saving ? 'Запазване…' : 'Смени паролата'}
          </button>
        </form>
      </section>
    </div>
  )
}
