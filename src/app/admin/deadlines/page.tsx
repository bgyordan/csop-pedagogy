'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Confirm } from '@/components/ui/Confirm'
import { formatDate, getDaysUntil } from '@/lib/utils'
import { DocumentType, DOCUMENT_TYPE_LABELS } from '@/types'

export default function DeadlinesPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [deadlines, setDeadlines] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [currentYearId, setCurrentYearId] = useState<string>('')
  const [form, setForm] = useState({
    title: '',
    deadline_date: '',
    doc_type: '' as DocumentType | '',
    color: 'yellow' as 'red' | 'yellow' | 'green',
  })

  useEffect(() => { load() }, [])

  async function load() {
    const { data: year } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
    setCurrentYearId(year?.id || '')
    const { data } = await supabase
      .from('calendar_deadlines')
      .select('*')
      .eq('academic_year_id', year?.id)
      .order('deadline_date')
    setDeadlines(data || [])
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.deadline_date) { toast('Попълни задължителните полета', 'error'); return }
    setSaving(true)

    const { data: profile } = await supabase.from('staff_profiles').select('id').eq('user_id', (await supabase.auth.getUser()).data.user?.id!).single()

    await supabase.from('calendar_deadlines').insert({
      title: form.title,
      deadline_date: form.deadline_date,
      doc_type: form.doc_type || null,
      color: form.color,
      academic_year_id: currentYearId,
      created_by: profile?.id,
    })

    toast('Срокът е добавен')
    setOpen(false)
    setSaving(false)
    setForm({ title: '', deadline_date: '', doc_type: '', color: 'yellow' })
    load()
  }

  async function handleDelete() {
    if (!deleteId) return
    await supabase.from('calendar_deadlines').delete().eq('id', deleteId)
    toast('Срокът е изтрит')
    setDeleteId(null)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Срокове в календара</h1>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0f2240' }}>
          <Plus size={16} />
          Нов срок
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Срок</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Документ</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Дата</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Оставащо</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {deadlines.map(d => {
              const days = getDaysUntil(d.deadline_date)
              return (
                <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-medium text-slate-800">{d.title}</td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">
                    {d.doc_type ? DOCUMENT_TYPE_LABELS[d.doc_type as DocumentType] : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{formatDate(d.deadline_date)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      d.color === 'red' ? 'bg-red-100 text-red-700' :
                      d.color === 'yellow' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {days < 0 ? 'Изтекъл' : days === 0 ? 'Днес' : `${days} дни`}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => setDeleteId(d.id)} className="text-slate-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!deadlines.length && <p className="text-sm text-slate-400 py-10 text-center">Няма добавени срокове</p>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Нов срок">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Наименование <span className="text-red-500">*</span></label>
            <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Напр. Предаване на Протокол 1" />
          </div>
          <div>
            <label className="label">Крайна дата <span className="text-red-500">*</span></label>
            <input type="date" className="input" value={form.deadline_date} onChange={e => setForm(p => ({ ...p, deadline_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Свързан документ (по избор)</label>
            <select className="input" value={form.doc_type} onChange={e => setForm(p => ({ ...p, doc_type: e.target.value as DocumentType }))}>
              <option value="">— Без документ —</option>
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Цвят на индикатора</label>
            <div className="flex gap-3 mt-1">
              {(['red', 'yellow', 'green'] as const).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${
                    form.color === c ? 'ring-2 ring-offset-1' : ''
                  } ${
                    c === 'red' ? 'bg-red-100 text-red-700 border-red-200 ring-red-400' :
                    c === 'yellow' ? 'bg-amber-100 text-amber-700 border-amber-200 ring-amber-400' :
                    'bg-green-100 text-green-700 border-green-200 ring-green-400'
                  }`}
                >
                  {c === 'red' ? 'Червен' : c === 'yellow' ? 'Жълт' : 'Зелен'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary" style={{ backgroundColor: '#0f2240' }}>
              {saving ? 'Запазване...' : 'Добави'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Отказ</button>
          </div>
        </form>
      </Modal>

      <Confirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Изтрий срок"
        message="Сигурен ли си, че искаш да изтриеш този срок?"
        confirmLabel="Изтрий"
        danger
      />
    </div>
  )
}
