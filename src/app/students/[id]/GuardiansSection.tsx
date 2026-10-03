'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Phone, Mail, Trash2, Save, Loader2 } from 'lucide-react'

const RELATION_OPTIONS = ['майка', 'баща', 'настойник', 'баба', 'дядо', 'приемен родител', 'друг']

const RELATION_LABELS: Record<string, string> = {
  'майка': 'Майка', 'баща': 'Баща', 'настойник': 'Настойник',
  'баба': 'Баба', 'дядо': 'Дядо', 'приемен родител': 'Приемен родител', 'друг': 'Друг',
}

interface Guardian {
  id: string
  student_id: string
  full_name: string
  relation: string
  phone: string | null
  email?: string | null
}

interface Props {
  studentId: string
  guardians: Guardian[]
  canManage: boolean
}

const LBL = 'block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1'
const INP = 'w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:border-[#0f2240] focus:ring-4 focus:ring-[#0f2240]/10'
const okEmail = (e: string) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export default function GuardiansSection({ studentId, guardians: initial, canManage }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [guardians, setGuardians] = useState<Guardian[]>(initial)
  const [editId, setEditId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const [formName, setFormName] = useState('')
  const [formRelation, setFormRelation] = useState('майка')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')

  function startEdit(g: Guardian) {
    setEditId(g.id); setShowAdd(false); setErr('')
    setFormName(g.full_name); setFormRelation(g.relation); setFormPhone(g.phone || ''); setFormEmail(g.email || '')
  }
  function startAdd() {
    setShowAdd(true); setEditId(null); setErr('')
    setFormName(''); setFormRelation('майка'); setFormPhone(''); setFormEmail('')
  }
  function cancel() { setEditId(null); setShowAdd(false); setErr('') }

  async function handleSave() {
    if (!formName.trim()) return
    const email = formEmail.trim().toLowerCase()
    if (!okEmail(email)) { setErr('Имейлът не изглежда правилен.'); return }
    setSaving(true); setErr('')
    const payload = { full_name: formName.trim(), relation: formRelation, phone: formPhone.trim() || null, email: email || null }
    const res = editId
      ? await supabase.from('student_guardians').update(payload).eq('id', editId).select().single()
      : await supabase.from('student_guardians').insert({ student_id: studentId, ...payload }).select().single()
    setSaving(false)
    if (res.error) {
      setErr(res.error.message.includes('email') ? 'Полето за имейл още не е добавено в базата (SQL файлът 2026-10-03_guardian_email.sql).' : res.error.message)
      return
    }
    if (editId) setGuardians(prev => prev.map(g => g.id === editId ? res.data : g))
    else setGuardians(prev => [...prev, res.data])
    cancel()
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Изтриване на родителя?')) return
    await supabase.from('student_guardians').delete().eq('id', id)
    setGuardians(prev => prev.filter(g => g.id !== id))
    router.refresh()
  }

  const formRow = (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-[140px_1fr] gap-3">
        <div>
          <label className={LBL}>Връзка</label>
          <select value={formRelation} onChange={e => setFormRelation(e.target.value)} className={INP}>
            {RELATION_OPTIONS.map(r => <option key={r} value={r}>{RELATION_LABELS[r]}</option>)}
          </select>
        </div>
        <div>
          <label className={LBL}>Три имена *</label>
          <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className={INP} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={LBL}>Телефон</label>
          <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="08…" className={INP} />
        </div>
        <div>
          <label className={LBL}>Имейл</label>
          <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="напр. ime@gmail.com" className={INP} />
        </div>
      </div>
      {err && <p className="text-xs text-rose-700">{err}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={cancel} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100">Отказ</button>
        <button type="button" onClick={handleSave} disabled={saving || !formName.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#0f2240] hover:bg-[#1a3560] disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Запази
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-2.5">
      {guardians.length === 0 && !showAdd && <p className="text-sm text-slate-400">Няма данни</p>}

      {guardians.map(g => (
        <div key={g.id}>
          {editId === g.id ? formRow : (
            <div className="rounded-xl border border-slate-200 px-3.5 py-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{RELATION_LABELS[g.relation] || g.relation}</div>
                  <div className="text-[15px] font-medium text-slate-900 mt-0.5">{g.full_name}</div>
                </div>
                {canManage && (
                  <div className="flex gap-0.5">
                    <button type="button" onClick={() => startEdit(g)} title="Редактирай" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100"><Pencil size={14} /></button>
                    <button type="button" onClick={() => handleDelete(g.id)} title="Изтрий" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {g.phone
                  ? <a href={`tel:${g.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm tabular-nums hover:bg-emerald-100"><Phone size={14} /> {g.phone}</a>
                  : canManage && <button type="button" onClick={() => startEdit(g)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-400 text-sm hover:text-slate-700"><Phone size={14} /> добави телефон</button>}
                {g.email
                  ? <a href={`mailto:${g.email}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-sm hover:bg-sky-100 break-all"><Mail size={14} /> {g.email}</a>
                  : canManage && <button type="button" onClick={() => startEdit(g)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-400 text-sm hover:text-slate-700"><Mail size={14} /> добави имейл</button>}
              </div>
            </div>
          )}
        </div>
      ))}

      {showAdd && formRow}

      {canManage && !showAdd && editId === null && (
        <button type="button" onClick={startAdd} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-700 hover:border-[#0f2240]">
          <Plus size={14} /> Добави родител
        </button>
      )}
    </div>
  )
}
