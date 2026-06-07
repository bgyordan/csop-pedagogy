'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, Save } from 'lucide-react'

const CONTRACT_TYPES = [
  { value: 'delivery', label: 'Доставка' },
  { value: 'service', label: 'Услуга' },
  { value: 'rent', label: 'Наем' },
  { value: 'labor', label: 'Трудов' },
  { value: 'civil', label: 'Граждански' },
  { value: 'other', label: 'Друг' },
]

const INTERNAL_OWNERS = [
  'Светлана Иванова (Директор)',
  'Йордан Йорданов (ЗДАСД)',
  'Силвия Кьошкерян (ЗДУД)',
  'Радка Георгиева (Счетоводство)',
]

function calcEndDate(start: string, months: string): string {
  if (!start || !months) return ''
  const d = new Date(start)
  d.setMonth(d.getMonth() + parseInt(months))
  return d.toISOString().slice(0, 10)
}

interface Props {
  item: any
  onClose: () => void
}

export default function EditContractModal({ item, onClose }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(item.date || '')
  const [contractType, setContractType] = useState(item.contract_type || 'service')
  const [counterparty, setCounterparty] = useState(item.counterparty || '')
  const [subject, setSubject] = useState(item.subject || '')
  const [startDate, setStartDate] = useState(item.start_date || '')
  const [durationMonths, setDurationMonths] = useState('')
  const [internalOwner, setInternalOwner] = useState(item.internal_owner || '')
  const [description, setDescription] = useState(item.description || '')

  const endDate = durationMonths ? calcEndDate(startDate, durationMonths) : item.end_date

  async function handleSave() {
    if (!counterparty || !subject) return
    setSaving(true)

    const { error } = await supabase
      .from('contracts')
      .update({
        date,
        contract_type: contractType,
        counterparty,
        subject,
        start_date: startDate || null,
        end_date: endDate || null,
        internal_owner: internalOwner || null,
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
      <div className="bg-white rounded-3xl border max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Редакция — Договор</h3>
            <p className="text-[11px] font-mono text-purple-600 font-bold mt-0.5">{item.number}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Дата</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Вид</label>
              <select value={contractType} onChange={e => setContractType(e.target.value)} className="input w-full">
                {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Контрагент *</label>
            <input type="text" required value={counterparty} onChange={e => setCounterparty(e.target.value)}
              placeholder="Фирма / лице" className="input w-full" />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Предмет *</label>
            <input type="text" required value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Предмет на договора" className="input w-full" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Начало</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Срок (мес.)</label>
              <input type="number" min="1" placeholder="12" value={durationMonths}
                onChange={e => setDurationMonths(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Край</label>
              <input readOnly value={endDate ? new Date(endDate).toLocaleDateString('bg-BG') : '—'}
                className="input w-full bg-slate-50 cursor-not-allowed text-slate-500" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Вътрешен титуляр</label>
            <select value={internalOwner} onChange={e => setInternalOwner(e.target.value)} className="input w-full">
              <option value="">—</option>
              {INTERNAL_OWNERS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
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
