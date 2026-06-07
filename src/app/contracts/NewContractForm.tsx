'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, FileText, Loader2 } from 'lucide-react'

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
  currentUserId: string
  onClose: () => void
  onSaved: () => void
}

export default function NewContractForm({ currentUserId, onClose, onSaved }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [saveAction, setSaveAction] = useState<'save_close' | 'save_new'>('save_close')
  const [contractType, setContractType] = useState('service')
  const [counterparty, setCounterparty] = useState('')
  const [subject, setSubject] = useState('')
  const [contractDate, setContractDate] = useState(new Date().toISOString().split('T')[0])
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [durationMonths, setDurationMonths] = useState('')
  const [contractValue, setContractValue] = useState('')
  const [internalOwner, setInternalOwner] = useState('')
  const [description, setDescription] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const endDate = calcEndDate(startDate, durationMonths)
  const currentYear = new Date().getFullYear()

  const daysLeft = endDate ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null

  function resetForm() {
    setContractType('service')
    setCounterparty('')
    setSubject('')
    setContractDate(new Date().toISOString().split('T')[0])
    setStartDate(new Date().toISOString().split('T')[0])
    setDurationMonths('')
    setContractValue('')
    setInternalOwner('')
    setDescription('')
    setUploadedFile(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!counterparty || !subject) return
    setSaving(true)

    const { count } = await supabase.from('contracts').select('id', { count: 'exact', head: true }).like('number', `%/${currentYear}`)
    const nextNum = String((count || 0) + 1).padStart(3, '0')
    const docNumber = `ДГ-${nextNum}/${currentYear}`

    let fileUrl = '', fileName = ''
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop()
      const filePath = `contracts/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, uploadedFile, { upsert: true })
      if (!uploadError) { fileUrl = filePath; fileName = uploadedFile.name }
    }

    const { error } = await supabase.from('contracts').insert({
      number: docNumber, date: contractDate, counterparty, subject,
      start_date: startDate || null, end_date: endDate || null,
      description: description || null,
      file_url: fileUrl || null, file_name: fileName || null,
      created_by: currentUserId,
    })

    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }
    router.refresh()
    setSaving(false)
    if (saveAction === 'save_new') resetForm()
    else onSaved()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border border-slate-200/80 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">

        {/* Хедър */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl z-10">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Нов договор</h3>
            <p className="text-[11px] font-mono text-purple-600 font-bold mt-0.5">
              ДГ-???/{currentYear}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Вид + Дата */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Вид договор *</label>
              <div className="flex flex-wrap gap-1.5">
                {CONTRACT_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setContractType(t.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      contractType === t.value
                        ? 'bg-[#0f2240] text-white border-[#0f2240]'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Дата *</label>
              <input type="date" value={contractDate} onChange={e => setContractDate(e.target.value)} required className="input w-full" />
            </div>
          </div>

          {/* Контрагент */}
          <input type="text" required value={counterparty} onChange={e => setCounterparty(e.target.value)}
            placeholder="Контрагент (фирма / лице) *" className="input w-full" />

          {/* Предмет */}
          <input type="text" required value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="Предмет на договора *" className="input w-full" />

          {/* Начална дата + Срок + Крайна дата */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Начало *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="input w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Срок (месеци) *</label>
              <input type="number" min="1" max="999" placeholder="напр. 12" value={durationMonths}
                onChange={e => setDurationMonths(e.target.value)} required className="input w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Крайна дата</label>
              <input readOnly value={endDate ? new Date(endDate).toLocaleDateString('bg-BG') : '—'}
                className="input w-full bg-slate-50 cursor-not-allowed text-slate-500" />
            </div>
          </div>

          {/* Предупреждение за скоро изтичащ */}
          {daysLeft !== null && daysLeft < 30 && (
            <div className={`text-xs font-bold px-3 py-2 rounded-xl ${daysLeft < 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              {daysLeft < 0 ? `⚠ Изтекъл преди ${Math.abs(daysLeft)} дни!` : `⚠ Изтича след ${daysLeft} дни`}
            </div>
          )}

          {/* Стойност + Титуляр */}
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min="0" step="0.01" placeholder="Стойност (EUR) — незадължително"
              value={contractValue} onChange={e => setContractValue(e.target.value)} className="input w-full" />
            <select value={internalOwner} onChange={e => setInternalOwner(e.target.value)} className="input w-full">
              <option value="">Вътрешен титуляр</option>
              {INTERNAL_OWNERS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Бележки */}
          <textarea rows={1} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Бележки (незадължително)..." className="input w-full resize-none" />

          {/* Файл */}
          {uploadedFile ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <FileText size={16} className="text-emerald-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate">{uploadedFile.name}</div>
                <div className="text-[10px] text-slate-400">{(uploadedFile.size / 1024).toFixed(0)} KB</div>
              </div>
              <button type="button" onClick={() => setUploadedFile(null)} className="text-slate-400 hover:text-red-500 p-1"><X size={14} /></button>
            </div>
          ) : (
            <label className="flex items-center justify-center w-full h-10 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#0f2240] hover:bg-slate-50 transition-all">
              <div className="flex items-center gap-2 text-slate-400">
                <Upload size={15} /><span className="text-xs font-semibold">Прикачи файл (PDF/Word)</span>
              </div>
              <input type="file" className="hidden" accept=".pdf,.doc,.docx"
                onChange={e => { const f = e.target.files?.[0]; if (f) setUploadedFile(f) }} />
            </label>
          )}

          {/* Бутони */}
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors">
              Отказ
            </button>
            <button type="submit" disabled={saving}
              onClick={() => setSaveAction('save_new')}
              className="px-4 py-2.5 border border-[#0f2240] text-[#0f2240] rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60 hover:bg-slate-50 transition-colors">
              {saving && saveAction === 'save_new' && <Loader2 size={13} className="animate-spin" />}
              Запази и нов
            </button>
            <button type="submit" disabled={saving}
              onClick={() => setSaveAction('save_close')}
              className="px-5 py-2.5 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60 shadow-md hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#0f2240' }}>
              {saving && saveAction === 'save_close' && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Записване...' : 'Запази и затвори'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
