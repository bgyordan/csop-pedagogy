'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { Plus, Trash2, BookOpen, HeartPulse, Loader2, Check } from 'lucide-react'

interface Subject {
  id: string
  name: string
  allows_pullout: boolean
  is_therapy: boolean
}

export function SubjectsClient({ subjects: initial }: { subjects: Subject[] }) {
  const supabase = createClient()
  const { toast } = useToast()
  const [subjects, setSubjects] = useState(initial)
  const [newName, setNewName] = useState('')
  const [newPullout, setNewPullout] = useState(false)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  async function togglePullout(s: Subject) {
    setBusy(s.id)
    const { error } = await supabase
      .from('subjects')
      .update({ allows_pullout: !s.allows_pullout, is_therapy: !s.allows_pullout })
      .eq('id', s.id)
    setBusy(null)
    if (error) { toast('Грешка', 'error'); return }
    setSubjects(prev => prev.map(x =>
      x.id === s.id ? { ...x, allows_pullout: !x.allows_pullout, is_therapy: !x.allows_pullout } : x
    ))
  }

  async function addSubject() {
    if (!newName.trim()) { toast('Въведи име', 'error'); return }
    setAdding(true)
    const { data, error } = await supabase
      .from('subjects')
      .insert({ name: newName.trim(), allows_pullout: newPullout, is_therapy: newPullout })
      .select().single()
    setAdding(false)
    if (error) {
      toast(error.message.includes('duplicate') ? 'Вече съществува такъв предмет' : `Грешка: ${error.message}`, 'error')
      return
    }
    setSubjects(prev => [...prev, data].sort((a, b) =>
      (b.allows_pullout ? 1 : 0) - (a.allows_pullout ? 1 : 0) || a.name.localeCompare(b.name, 'bg')
    ))
    setNewName('')
    setNewPullout(false)
    toast('Добавено')
  }

  async function deleteSubject(s: Subject) {
    if (!confirm(`Да изтрия „${s.name}"? Ако се ползва в разписания, това може да ги засегне.`)) return
    setBusy(s.id)
    const { error } = await supabase.from('subjects').delete().eq('id', s.id)
    setBusy(null)
    if (error) { toast('Грешка при изтриване', 'error'); return }
    setSubjects(prev => prev.filter(x => x.id !== s.id))
    toast('Изтрито')
  }

  const therapy = subjects.filter(s => s.allows_pullout)
  const regular = subjects.filter(s => !s.allows_pullout)

  return (
    <div className="space-y-5">
      {/* Добавяне */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSubject()}
            placeholder="Нов предмет или направление..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600 px-2 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={newPullout} onChange={e => setNewPullout(e.target.checked)} className="rounded" />
            позволява вземане
          </label>
          <button onClick={addSubject} disabled={adding}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: '#0f2240' }}>
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Добави
          </button>
        </div>
      </div>

      {/* Терапевтични */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 bg-teal-50/50 border-b border-slate-100">
          <HeartPulse size={15} className="text-teal-500" />
          <span className="text-sm font-medium text-slate-700">Позволяват вземане</span>
          <span className="ml-auto text-xs text-slate-400">{therapy.length}</span>
        </div>
        <div className="divide-y divide-slate-50">
          {therapy.map(s => (
            <Row key={s.id} s={s} busy={busy} onToggle={togglePullout} onDelete={deleteSubject} />
          ))}
          {therapy.length === 0 && <p className="text-sm text-slate-400 px-5 py-4">Няма</p>}
        </div>
      </div>

      {/* Учебни */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
          <BookOpen size={15} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Учебни (не позволяват вземане)</span>
          <span className="ml-auto text-xs text-slate-400">{regular.length}</span>
        </div>
        <div className="divide-y divide-slate-50">
          {regular.map(s => (
            <Row key={s.id} s={s} busy={busy} onToggle={togglePullout} onDelete={deleteSubject} />
          ))}
          {regular.length === 0 && <p className="text-sm text-slate-400 px-5 py-4">Няма</p>}
        </div>
      </div>
    </div>
  )
}

function Row({ s, busy, onToggle, onDelete }: {
  s: Subject, busy: string | null,
  onToggle: (s: Subject) => void, onDelete: (s: Subject) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-5 py-2.5 hover:bg-slate-50/50 transition-colors">
      <span className="text-sm text-slate-700">{s.name}</span>
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => onToggle(s)}
          disabled={busy === s.id}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            s.allows_pullout
              ? 'bg-teal-50 text-teal-700 hover:bg-teal-100'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}>
          {busy === s.id ? <Loader2 size={11} className="animate-spin" />
            : s.allows_pullout ? <Check size={11} /> : null}
          {s.allows_pullout ? 'вземане' : 'учебен'}
        </button>
        <button onClick={() => onDelete(s)} disabled={busy === s.id}
          className="text-slate-300 hover:text-red-500 transition-colors" title="Изтрий">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
