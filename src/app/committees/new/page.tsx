'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, X } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import { getFullName } from '@/lib/utils'
import { StaffProfile } from '@/types'

export default function NewCommitteePage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [form, setForm] = useState({ name: '', description: '' })
  const [members, setMembers] = useState<{ staff_id: string; role: string }[]>([])
  const [selectedStaff, setSelectedStaff] = useState('')

  useEffect(() => {
    supabase.from('staff_profiles').select('*').eq('is_active', true).order('last_name')
      .then(({ data }) => setStaff(data || []))
  }, [])

  function addMember() {
    if (!selectedStaff || members.find(m => m.staff_id === selectedStaff)) return
    setMembers(prev => [...prev, { staff_id: selectedStaff, role: '' }])
    setSelectedStaff('')
  }

  function removeMember(staffId: string) {
    setMembers(prev => prev.filter(m => m.staff_id !== staffId))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast('Въведи наименование', 'error'); return }
    setSaving(true)

    const { data: profile } = await supabase.from('staff_profiles').select('id').eq('user_id', (await supabase.auth.getUser()).data.user?.id!).single()

    const { data: committee, error } = await supabase
      .from('committees')
      .insert({ name: form.name, description: form.description || null, created_by: profile?.id })
      .select('id')
      .single()

    if (error || !committee) { toast('Грешка при създаване', 'error'); setSaving(false); return }

    if (members.length > 0) {
      await supabase.from('committee_members').insert(
        members.map(m => ({ committee_id: committee.id, staff_id: m.staff_id, role: m.role || null }))
      )
    }

    toast('Комисията е създадена')
    router.push(`/committees/${committee.id}`)
  }

  return (
    <div className="p-8 max-w-lg">
      <Link href="/committees" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад
      </Link>

      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Нова комисия</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card space-y-4">
          <div>
            <label className="label">Наименование <span className="text-red-500">*</span></label>
            <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Напр. Педагогически съвет" />
          </div>
          <div>
            <label className="label">Описание</label>
            <textarea rows={2} className="input resize-none" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="По избор..." />
          </div>
        </div>

        <div className="card">
          <h2 className="font-medium text-slate-700 text-sm mb-4">Членове</h2>
          <div className="flex gap-2 mb-3">
            <select className="input flex-1" value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}>
              <option value="">— Избери служител —</option>
              {staff.filter(s => !members.find(m => m.staff_id === s.id)).map(s => (
                <option key={s.id} value={s.id}>{getFullName(s)}</option>
              ))}
            </select>
            <button type="button" onClick={addMember} className="btn-secondary px-3">Добави</button>
          </div>

          <div className="space-y-2">
            {members.map(m => {
              const s = staff.find(x => x.id === m.staff_id)
              return (
                <div key={m.staff_id} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-sm flex-1">{s ? getFullName(s) : m.staff_id}</span>
                  <input
                    className="input w-32 text-xs"
                    value={m.role}
                    onChange={e => setMembers(prev => prev.map(x => x.staff_id === m.staff_id ? { ...x, role: e.target.value } : x))}
                    placeholder="Роля..."
                  />
                  <button type="button" onClick={() => removeMember(m.staff_id)} className="text-slate-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary" style={{ backgroundColor: '#0f2240' }}>
            {saving ? 'Създаване...' : 'Създай комисия'}
          </button>
          <Link href="/committees" className="btn-secondary">Отказ</Link>
        </div>
      </form>
    </div>
  )
}
