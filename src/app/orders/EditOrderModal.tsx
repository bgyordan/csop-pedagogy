'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, Save } from 'lucide-react'

const TITLE_SUGGESTIONS = [
  'Заповед за назначаване', 'Заповед за освобождаване',
  'Заповед за отпуск', 'Заповед за командировка',
  'Заповед за насочване на ученик', 'Заповед за ЕПЛР екип',
  'Заповед за утвърждаване на ИУП', 'Заповед за вътрешно съвместителство',
]

interface Props {
  item: any
  onClose: () => void
}

export default function EditOrderModal({ item, onClose }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(item.date || '')
  const [title, setTitle] = useState(item.title || '')
  const [description, setDescription] = useState(item.description || '')

  async function handleSave() {
    if (!title) return
    setSaving(true)

    const { error } = await supabase
      .from('orders')
      .update({ date, title, description: description || null })
      .eq('id', item.id)

    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }
    setSaving(false)
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Редакция — Заповед</h3>
            <p className="text-[11px] font-mono text-orange-600 font-bold mt-0.5">{item.number}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Дата</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-44" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Заглавие *</label>
            <input type="text" list="title-list" value={title} onChange={e => setTitle(e.target.value)}
              required placeholder="Заглавие на заповедта..." className="input w-full" />
            <datalist id="title-list">{TITLE_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Бележки</label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Допълнителна информация..." className="input w-full resize-none" />
          </div>
        </div>

        <div className="flex gap-3 justify-end px-6 pb-6 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">
            Отказ
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60 shadow-md"
            style={{ backgroundColor: '#0f2240' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Запазване...' : 'Запази'}
          </button>
        </div>
      </div>
    </div>
  )
}
