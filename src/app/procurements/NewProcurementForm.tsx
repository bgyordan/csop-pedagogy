'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'

const OBJECT_OPTIONS = [
  { value: 'supply', label: 'Доставка' },
  { value: 'service', label: 'Услуга' },
  { value: 'construction', label: 'Строителство' },
]

const PROCEDURE_OPTIONS = [
  { value: 'direct', label: 'Директно възлагане (чл. 20, ал. 4)' },
  { value: 'offers', label: 'Събиране на оферти с обява (чл. 20, ал. 3)' },
  { value: 'negotiation', label: 'Пряко договаряне' },
]

interface Props {
  currentUserId: string
  onClose: () => void
  onSaved: () => void
}

export default function NewProcurementForm({ currentUserId, onClose, onSaved }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [number, setNumber] = useState('')
  const [subject, setSubject] = useState('')
  const [objectType, setObjectType] = useState('supply')
  const [procedureType, setProcedureType] = useState('direct')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [cpvCode, setCpvCode] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject) return
    setSaving(true)

    const { error } = await supabase.from('procurements').insert({
      number: number || null,
      subject,
      object_type: objectType,
      procedure_type: procedureType,
      estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
      cpv_code: cpvCode || null,
      date,
      description: description || null,
      status: 'in_progress',
      created_by: currentUserId,
    })

    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border border-slate-200/80 max-w-xl w-full shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h3 className="font-medium text-slate-800 text-sm uppercase tracking-widest">Нова обществена поръчка</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Предмет */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Предмет на поръчката *</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                required placeholder="напр. Доставка на оборудване за специализирани кабинети"
                className="input w-full" />
            </div>

            {/* Номер и Дата */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Номер / Идент.</label>
                <input type="text" value={number} onChange={e => setNumber(e.target.value)}
                  placeholder="напр. 2026-01" className="input w-full text-xs" />
              </div>
              <div className="w-40">
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Дата</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-full text-xs" />
              </div>
            </div>

            {/* Обект */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Обект на поръчката *</label>
              <div className="flex gap-1.5">
                {OBJECT_OPTIONS.map(o => (
                  <button key={o.value} type="button" onClick={() => setObjectType(o.value)}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                      objectType === o.value ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Процедура */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Вид процедура *</label>
              <select value={procedureType} onChange={e => setProcedureType(e.target.value)} className="input w-full text-xs">
                {PROCEDURE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            {/* Стойност и CPV */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Прогнозна стойност (EUR)</label>
                <input type="number" step="0.01" value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)}
                  placeholder="0.00" className="input w-full text-xs" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">CPV код</label>
                <input type="text" value={cpvCode} onChange={e => setCpvCode(e.target.value)}
                  placeholder="напр. 39162200-7" className="input w-full text-xs" />
              </div>
            </div>

            {/* Описание */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Описание / Бележки</label>
              <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Допълнителна информация..." className="input w-full resize-none" />
            </div>

            <p className="text-[11px] text-slate-400">Файловете (докладна, обява, оферти, протокол, договор) се качват след създаване на поръчката.</p>
          </div>

          <div className="flex gap-2 justify-end px-5 py-4 border-t border-slate-100 flex-shrink-0 bg-white rounded-b-3xl">
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors">
              Отказ
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 disabled:opacity-60 shadow-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#0f2240' }}>
              {saving && <Loader2 size={12} className="animate-spin" />}
              {saving ? 'Създаване...' : 'Създай поръчка'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
