'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, Save } from 'lucide-react'

const EXTERNAL_SUGGESTIONS = [
  'МОН — Министерство на образованието и науката',
  'РУО — Варна', 'Община Варна', 'РЦПППО — Варна',
  'Агенция за социално подпомагане', 'РЗОК — Варна',
  'НОИ — Варна', 'Дирекция "Социално подпомагане"',
]

const INTERNAL_PERSONS = [
  'Светлана Иванова — Директор',
  'Йордан Йорданов — ЗДАСД',
  'Силвия Кьошкерян — ЗДУД',
  'Радка Георгиева — Счетоводство',
]

interface Props {
  item: any
  onClose: () => void
}

export default function EditCorrespondenceModal({ item, onClose }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(item.date || '')
  const [fromWhom, setFromWhom] = useState(item.from_whom || '')
  const [toWhom, setToWhom] = useState(item.to_whom || '')
  const [subject, setSubject] = useState(item.subject || '')
  const [description, setDescription] = useState(item.description || '')

  const dir = item.direction

  async function handleSave() {
    if (!subject) return
    setSaving(true)

    const { error } = await supabase
      .from('correspondence')
      .update({
        date,
        from_whom: fromWhom || null,
        to_whom: toWhom || null,
        subject,
        description: description || null,
      })
      .eq('id', item.id)

    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }
    setSaving(false)
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">

        {/* Хедър */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Редакция</h3>
            <p className="text-[11px] font-mono text-[#0f2240] font-bold mt-0.5">{item.number}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {/* Дата */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Дата</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-44" />
          </div>

          {/* От кого — само за входящи */}
          {dir === 'incoming' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">От кого</label>
              <input type="text" list="from-list" value={fromWhom}
                onChange={e => setFromWhom(e.target.value)}
                placeholder="Институция / лице..." className="input w-full" />
            </div>
          )}
{dir === 'internal' && (
  <div>
    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">От кого</label>
    <input type="text" value={fromWhom}
      onChange={e => setFromWhom(e.target.value)}
      placeholder="Длъжностно лице..." className="input w-full" />
  </div>
)}
          {/* До кого — само за изходящи */}
          {dir === 'outgoing' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">До кого</label>
              <input type="text" list="to-list" value={toWhom}
                onChange={e => setToWhom(e.target.value)}
                placeholder="Институция / лице..." className="input w-full" />
            </div>
          )}

          {/* Тема */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Тема / Относно *</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              required placeholder="Относно..." className="input w-full" />
          </div>

          {/* Бележки */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Бележки</label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Допълнителна информация..." className="input w-full resize-none" />
          </div>

          <datalist id="from-list">{EXTERNAL_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
          <datalist id="to-list">{EXTERNAL_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
        </div>

        {/* Бутони */}
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
