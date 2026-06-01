'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'

export default function NewSessionPage() {
  const params = useParams()
  const committeeId = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    session_date: new Date().toISOString().split('T')[0],
    agenda: '',
    protocol: '',
    decisions: '',
    deadline: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.session_date) { toast('Въведи дата на заседанието', 'error'); return }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('staff_profiles').select('id').eq('user_id', user?.id!).single()

    const { error } = await supabase.from('committee_sessions').insert({
      committee_id: committeeId,
      session_date: form.session_date,
      agenda: form.agenda || null,
      protocol: form.protocol || null,
      decisions: form.decisions || null,
      deadline: form.deadline || null,
      created_by: profile?.id,
    })

    if (error) { toast('Грешка при запис', 'error'); setSaving(false); return }

    toast('Заседанието е записано')
    router.push(`/committees/${committeeId}`)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Link href={`/committees/${committeeId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад към комисията
      </Link>

      <h1 className="text-xl md:text-2xl font-semibold text-slate-800 mb-6">Ново заседание</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card space-y-4">
          <div>
            <label className="label">Дата на заседанието <span className="text-red-500">*</span></label>
            <input type="date" className="input" value={form.session_date}
              onChange={e => setForm(p => ({ ...p, session_date: e.target.value }))} />
          </div>

          <div>
            <label className="label">Дневен ред</label>
            <textarea rows={3} className="input resize-y"
              placeholder="Точки от дневния ред..."
              value={form.agenda}
              onChange={e => setForm(p => ({ ...p, agenda: e.target.value }))} />
          </div>

          <div>
            <label className="label">Протокол</label>
            <textarea rows={4} className="input resize-y"
              placeholder="Съдържание на протокола..."
              value={form.protocol}
              onChange={e => setForm(p => ({ ...p, protocol: e.target.value }))} />
          </div>

          <div>
            <label className="label">Решения</label>
            <textarea rows={3} className="input resize-y"
              placeholder="Взети решения..."
              value={form.decisions}
              onChange={e => setForm(p => ({ ...p, decisions: e.target.value }))} />
          </div>

          <div>
            <label className="label">Срок за изпълнение</label>
            <input type="date" className="input" value={form.deadline}
              onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#0f2240' }}>
            {saving ? 'Запазване...' : 'Запази заседанието'}
          </button>
          <Link href={`/committees/${committeeId}`} className="btn-secondary">Отказ</Link>
        </div>
      </form>
    </div>
  )
}
