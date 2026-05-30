'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { useToast } from '@/components/ui/Toast'
import { getFullName } from '@/lib/utils'

export default function EditStudentPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '', birth_date: '',
  })

  useEffect(() => {
    supabase.from('students').select('*').eq('id', id).single()
      .then(({ data }) => {
        if (data) setForm({
          first_name: data.first_name,
          middle_name: data.middle_name || '',
          last_name: data.last_name,
          birth_date: data.birth_date,
        })
      })
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name || !form.last_name) { toast('Попълни задължителните полета', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('students').update({
      first_name: form.first_name,
      middle_name: form.middle_name || null,
      last_name: form.last_name,
      birth_date: form.birth_date,
    }).eq('id', id)

    if (error) { toast('Грешка при запис', 'error'); setSaving(false); return }
    toast('Данните са обновени')
    router.push(`/students/${id}`)
  }

  return (
    <div className="p-8 max-w-md">
      <BackButton />
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Редактирай ученик</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Първо име <span className="text-red-500">*</span></label>
          <input className="input" value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Презиме</label>
          <input className="input" value={form.middle_name} onChange={e => setForm(p => ({ ...p, middle_name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Фамилия <span className="text-red-500">*</span></label>
          <input className="input" value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Дата на раждане</label>
          <input type="date" className="input" value={form.birth_date} onChange={e => setForm(p => ({ ...p, birth_date: e.target.value }))} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary" style={{ backgroundColor: '#0f2240' }}>
            {saving ? 'Запазване...' : 'Запази'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">Отказ</button>
        </div>
      </form>
    </div>
  )
}
