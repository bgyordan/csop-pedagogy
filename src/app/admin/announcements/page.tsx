'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Eye, EyeOff } from 'lucide-react'
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
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', expires_at: '', target_roles: [] as UserRole[] })
  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setAnnouncements(data || [])
  }
  function openNew() {
    setEditId(null)
    setForm({ title: '', body: '', expires_at: '', target_roles: [] })
    setOpen(true)
  }
  function openEdit(ann: any) {
    setEditId(ann.id)
    setForm({
      title: ann.title,
      body: ann.body,
      expires_at: ann.expires_at ? ann.expires_at.split('T')[0] : '',
      target_roles: ann.target_roles || [],
    })
    setOpen(true)
  }
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.body) { toast('Попълни всички полета', 'error'); return }
    setSaving(true)
    if (editId) {
      await supabase.from('announcements').update({
        title: form.title,
        body: form.body,
        target_roles: form.target_roles,
        expires_at: form.expires_at || null,
      }).eq('id', editId)
      toast('Съобщението е обновено')
    } else {
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
    }
    setOpen(false)
    setEditId(null)
    setSaving(false)
    setForm({ title: '', body: '', expires_at: '', target_roles: [] })
    load()
  }
  async function toggleActive(ann: any) {
    await supabase.from('announcements').update({ is_active: !ann.is_active }).eq('id', ann.id)
    toast(ann.is_active ? 'Съобщението е скрито' : 'Съобщението е активирано')
    load()
  }
  async function handleDelete() {
    if (!deleteId) return
    await supabase.from('announcements').delete().eq('id', deleteId)
    toast('Съобщението е изтрито')
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
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0f2240' }}>
          <Plus size={16} />
          Ново съобщение
        </button>
      </div>
      <div className="space-y-3">
        {announcements.map(ann => (
          <div key={ann.id} className={`group bg-white rounded-xl border border-slate-200/70 p-4 flex items-start justify-between gap-4 transition-all hover:border-slate-300 hover:shadow-sm ${!ann.is_active ? 'opacity-60' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-semibold text-slate-800">{ann.title}</h2>
                {!ann.is_active && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Скрито</span>}
              </div>
              <p className="text-sm text-slate-600 mb-2 whitespace-pre-wrap">{ann.body}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>{formatDate(ann.created_at)}</span>
                {ann.expires_at && <span>Изтича: {formatDate(ann.expires_at)}</span>}
                {ann.target_roles?.length > 0 && (
                  <span>За: {ann.target_roles.map((r: UserRole) => ROLE_LABELS[r]).join(', ')}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => toggleActive(ann)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title={ann.is_active ? 'Скрий' : 'Покажи'}>
                {ann.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button onClick={() => openEdit(ann)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100" title="Редактирай">
                <Pencil size={15} />
              </button>
              <button onClick={() => setDeleteId(ann.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100" title="Изтрий напълно">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {!announcements.length && <p className="text-sm text-slate-400 py-8 text-center">Няма съобщения</p>}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Редакция на съобщение' : 'Ново съобщение'}>
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
                      ? 'text-white'
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
              {saving ? 'Запазване...' : editId ? 'Запази промените' : 'Публикувай'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Отказ</button>
          </div>
        </form>
      </Modal>
      <Confirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Изтрий съобщение"
        message="Съобщението ще бъде изтрито напълно и безвъзвратно. Сигурни ли сте?"
        confirmLabel="Изтрий напълно"
        danger
      />
    </div>
  )
}
