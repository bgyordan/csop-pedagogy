'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, X, Save, Loader2 } from 'lucide-react'

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
}

interface Props {
  studentId: string
  guardians: Guardian[]
  canManage: boolean
}

export default function GuardiansSection({ studentId, guardians: initial, canManage }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [guardians, setGuardians] = useState<Guardian[]>(initial)
  const [editId, setEditId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState('')
  const [formRelation, setFormRelation] = useState('майка')
  const [formPhone, setFormPhone] = useState('')

  function startEdit(g: Guardian) {
    setEditId(g.id)
    setFormName(g.full_name)
    setFormRelation(g.relation)
    setFormPhone(g.phone || '')
    setShowAdd(false)
  }

  function startAdd() {
    setShowAdd(true)
    setEditId(null)
    setFormName('')
    setFormRelation('майка')
    setFormPhone('')
  }

  function cancel() {
    setEditId(null)
    setShowAdd(false)
  }

  async function handleSave() {
    if (!formName.trim()) return
    setSaving(true)

    if (editId) {
      const { data, error } = await supabase.from('student_guardians')
        .update({ full_name: formName.trim(), relation: formRelation, phone: formPhone.trim() || null })
        .eq('id', editId).select().single()
      if (!error && data) {
        setGuardians(prev => prev.map(g => g.id === editId ? data : g))
        setEditId(null)
      }
    } else {
      const { data, error } = await supabase.from('student_guardians')
        .insert({ student_id: studentId, full_name: formName.trim(), relation: formRelation, phone: formPhone.trim() || null })
        .select().single()
      if (!error && data) {
        setGuardians(prev => [...prev, data])
        setShowAdd(false)
      }
    }
    setSaving(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Изтриване на родителя?')) return
    await supabase.from('student_guardians').delete().eq('id', id)
    setGuardians(prev => prev.filter(g => g.id !== id))
    router.refresh()
  }

  const FormRow = () => (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
      <select value={formRelation} onChange={e => setFormRelation(e.target.value)}
        className="input w-full text-xs">
        {RELATION_OPTIONS.map(r => <option key={r} value={r}>{RELATION_LABELS[r]}</option>)}
      </select>
      <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
        placeholder="Три имена *" className="input w-full text-xs" />
      <input type="text" value={formPhone} onChange={e => setFormPhone(e.target.value)}
        placeholder="Телефон (незадължително)" className="input w-full text-xs" />
      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={cancel}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs transition-colors">
          Отказ
        </button>
        <button type="button" onClick={handleSave} disabled={saving || !formName.trim()}
          className="px-3 py-1.5 text-white rounded-lg text-xs flex items-center gap-1 disabled:opacity-50"
          style={{ backgroundColor: '#0f2240' }}>
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
          Запази
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      {guardians.length === 0 && !showAdd && (
        <p className="text-sm text-slate-400">Няма данни</p>
      )}

      {guardians.map(g => (
        <div key={g.id}>
          {editId === g.id ? (
            <FormRow />
          ) : (
            <div className="group flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {RELATION_LABELS[g.relation] || g.relation}
                </div>
                <div className="text-sm font-medium text-slate-700 mt-0.5">{g.full_name}</div>
                {g.phone && <div className="text-xs text-slate-500 mt-0.5">{g.phone}</div>}
              </div>
              {canManage && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => startEdit(g)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <Pencil size={12} />
                  </button>
                  <button type="button" onClick={() => handleDelete(g.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {showAdd && <FormRow />}

      {canManage && !showAdd && editId === null && (
        <button type="button" onClick={startAdd}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors mt-1">
          <Plus size={13} /> Добави
        </button>
      )}
    </div>
  )
}
