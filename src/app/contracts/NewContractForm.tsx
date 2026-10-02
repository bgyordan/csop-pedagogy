'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'
import { FormSection, FileDrop, useFormKeys, KeysHint } from '@/components/registry/FormParts'

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
  const rootRef = useRef<HTMLDivElement>(null)
  useFormKeys(rootRef, onClose)
  const [counterparty, setCounterparty] = useState('')
  const [subject, setSubject] = useState('')
  const [contractDate, setContractDate] = useState(new Date().toISOString().split('T')[0])
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [durationMonths, setDurationMonths] = useState('')
  const [description, setDescription] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const endDate = calcEndDate(startDate, durationMonths)
  const currentYear = new Date().getFullYear()

  const daysLeft = endDate ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null

  function resetForm() {
    setCounterparty('')
    setSubject('')
    setContractDate(new Date().toISOString().split('T')[0])
    setStartDate(new Date().toISOString().split('T')[0])
    setDurationMonths('')
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

  const LBL = 'block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div ref={rootRef} className="bg-white rounded-3xl border border-slate-200/80 max-w-4xl w-full shadow-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-[11px] text-slate-500 uppercase tracking-widest">Нов договор</h3>
            <p className="text-lg font-medium text-[#0f2240] tabular-nums leading-tight mt-1.5">ДГ-???/{currentYear}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid md:grid-cols-[1.2fr_1fr] gap-6">
              <FormSection title="Данни">
                <div>
                  <label className={LBL}>Дата *</label>
                  <input type="date" value={contractDate} onChange={e => setContractDate(e.target.value)} required className="input w-44" />
                </div>
                <div>
                  <label className={LBL}>Контрагент *</label>
                  <input autoFocus type="text" required value={counterparty} onChange={e => setCounterparty(e.target.value)}
                    placeholder="фирма или лице" className="input w-full" />
                </div>
                <div>
                  <label className={LBL}>Предмет *</label>
                  <input type="text" required value={subject} onChange={e => setSubject(e.target.value)}
                    placeholder="предмет на договора" className="input w-full" />
                </div>
                <div className="grid grid-cols-[1.25fr_1fr_1fr] gap-3">
                  <div>
                    <label className={LBL}>Начало *</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="input w-full" />
                  </div>
                  <div>
                    <label className={LBL}>Срок (мес.) *</label>
                    <input type="number" min="1" max="999" placeholder="напр. 12" value={durationMonths}
                      onChange={e => setDurationMonths(e.target.value)} required className="input w-full" />
                  </div>
                  <div>
                    <label className={LBL}>Край</label>
                    <input readOnly value={endDate ? new Date(endDate).toLocaleDateString('bg-BG') : '—'}
                      className="input w-full !bg-slate-100 cursor-not-allowed text-slate-600 tabular-nums" />
                  </div>
                </div>
                {daysLeft !== null && daysLeft < 30 && (
                  <div className={`text-sm px-4 py-2.5 rounded-xl border ${daysLeft < 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                    {daysLeft < 0 ? `Изтекъл преди ${Math.abs(daysLeft)} дни` : `Изтича след ${daysLeft} дни`}
                  </div>
                )}
              </FormSection>

              <div className="space-y-6 md:border-l md:border-slate-200 md:pl-6">
                <FormSection title="Бележки">
                  <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="по желание" className="input w-full resize-none" />
                </FormSection>
                <FormSection title="Сканиран договор">
                  <FileDrop file={uploadedFile} onFile={setUploadedFile} />
                </FormSection>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end items-center px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-white rounded-b-3xl">
            <KeysHint submitLabel="регистрира" />
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors">
              Отказ
            </button>
            <button type="submit" disabled={saving}
              onClick={() => setSaveAction('save_new')}
              className="px-4 py-2 border border-[#0f2240] text-[#0f2240] rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60 hover:bg-slate-50 transition-colors">
              {saving && saveAction === 'save_new' && <Loader2 size={12} className="animate-spin" />}
              Регистрирай и нов
            </button>
            <button type="submit" disabled={saving} data-primary
              onClick={() => setSaveAction('save_close')}
              className="px-5 py-2 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60 shadow-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#0f2240' }}>
              {saving && saveAction === 'save_close' && <Loader2 size={12} className="animate-spin" />}
              {saving ? 'Записване…' : 'Регистрирай договор'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
