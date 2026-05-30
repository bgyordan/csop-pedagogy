'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Confirm } from '@/components/ui/Confirm'
import { formatDate } from '@/lib/utils'
import { UserRole, ROLE_LABELS } from '@/types'

export default function AnnouncementsPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', expires_at: '', target_roles: [] as UserRole[] })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setAnnouncements(data || [])
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.body) { toast('Попълни всички полета', 'error'); return }
    setSaving(true)

    const { data: profile } = await supabase.from('staff_profiles').select('id').eq('user_id', (await supabase.auth.getUser()).data.user?.id!).single()

    await supabase.from('announcements').insert({
      title: form.title,
      body: form.body,
      target_roles: form.target_roles,
      expires_at: form.expires_at || null,
      created_by: profile?.id,
      is_active: true,
    })

    toast('Съобщението е публикувано')
    setOpen(false)
    setSaving(false)
    setForm({ title: '', body: '', expires_at: '', target_roles: [] })
    load()
  }

  async function handleDelete() {
    if (!deleteId) return
    await supabase.from('announcements').update({ is_active: false }).eq('id', deleteId)
    toast('Съобщението е деактивирано')
    setDeleteId(null)
    load()
  }

  function toggleRole(role: UserRole) {
    setForm(p => ({
      ...p,
      target_roles: p.target_roles.includes(role)
        ? p.target_roles.filter(r => r !== role)
        : [...p.target_roles, role]
    }))
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Съобщения и обяви</h1>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0f2240' }}>
          <Plus size={16} />
          Ново съобщение
        </button>
      </div>

      <div className="space-y-3">
        {announcements.map(ann => (
          <div key={ann.id} className={`card flex items-start justify-between gap-4 ${!ann.is_active ? 'opacity-50' : ''}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-medium text-slate-800">{ann.title}</h2>
                {!ann.is_active && <span className="badge-empty text-xs">Неактивно</span>}
              </div>
              <p className="text-sm text-slate-600 mb-2">{ann.body}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{formatDate(ann.created_at)}</span>
                {ann.expires_at && <span>Изтича: {formatDate(ann.expires_at)}</span>}
                {ann.target_roles?.length > 0 && (
                  <span>За: {ann.target_roles.map((r: UserRole) => ROLE_LABELS[r]).join(', ')}</span>
                )}
              </div>
            </div>
            <button onClick={() => setDeleteId(ann.id)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {!announcements.length && <p className="text-sm text-slate-400 py-8 text-center">Няма съобщения</p>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Ново съобщение">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Заглавие</label>
            <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">Текст</label>
            <textarea rows={4} className="input resize-none" value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} />
          </div>
          <div>
            <label className="label">Изтича на (по избор)</label>
            <input type="date" className="input" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} />
          </div>
          <div>
            <label className="label">Целева аудитория (празно = всички)</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleRole(k as UserRole)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    form.target_roles.includes(k as UserRole)
                      ? 'border-navy bg-navy text-white'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  style={form.target_roles.includes(k as UserRole) ? { backgroundColor: '#0f2240', borderColor: '#0f2240' } : {}}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary" style={{ backgroundColor: '#0f2240' }}>
              {saving ? 'Публикуване...' : 'Публикувай'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Отказ</button>
          </div>
        </form>
      </Modal>

      <Confirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Деактивирай съобщение"
        message="Съобщението ще бъде скрито от потребителите. Можете да го активирате отново."
        confirmLabel="Деактивирай"
        danger
      />
    </div>
  )
}
