'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, Save } from 'lucide-react'
import { FormSection, FileDrop, useFormKeys, KeysHint } from '@/components/registry/FormParts'

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
  const rootRef = useRef<HTMLDivElement>(null)
  useFormKeys(rootRef, onClose)
  const [date, setDate] = useState(item.date || '')
  const [counterparty, setCounterparty] = useState(item.counterparty || '')
  const [subject, setSubject] = useState(item.subject || '')
  const [startDate, setStartDate] = useState(item.start_date || '')
  const [durationMonths, setDurationMonths] = useState('')
  const [description, setDescription] = useState(item.description || '')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const endDate = durationMonths ? calcEndDate(startDate, durationMonths) : item.end_date

  async function handleSave() {
    if (!counterparty || !subject) return
    setSaving(true)

    let fileUrl = item.file_url || null
    let fileName = item.file_name || null
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop()
      const filePath = `contracts/${item.id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, uploadedFile, { upsert: true })
      if (!uploadError) { fileUrl = filePath; fileName = uploadedFile.name }
    }

    const { error } = await supabase
      .from('contracts')
      .update({
        date,
        counterparty,
        subject,
        start_date: startDate || null,
        end_date: endDate || null,
        description: description || null,
        file_url: fileUrl,
        file_name: fileName,
      })
      .eq('id', item.id)

    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }
    setSaving(false)
    onClose()
    router.refresh()
  }

  const LBL = 'block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div ref={rootRef} className="bg-white rounded-3xl border border-slate-200/80 max-w-4xl w-full shadow-2xl flex flex-col" style={{ maxHeight: '92vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <div className="text-[11px] text-slate-500 uppercase tracking-widest">Редакция на договор</div>
            <div className="text-lg font-medium text-[#0f2240] tabular-nums leading-tight mt-0.5">№ {item.number}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid md:grid-cols-[1.2fr_1fr] gap-6">
            <FormSection title="Данни">
              <div>
                <label className={LBL}>Дата</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-44" />
              </div>
              <div>
                <label className={LBL}>Контрагент *</label>
                <input type="text" required value={counterparty} onChange={e => setCounterparty(e.target.value)}
                  placeholder="фирма или лице" className="input w-full" />
              </div>
              <div>
                <label className={LBL}>Предмет *</label>
                <input type="text" required value={subject} onChange={e => setSubject(e.target.value)}
                  className="input w-full" />
              </div>
              <div className="grid grid-cols-[1.25fr_1fr_1fr] gap-3">
                <div>
                  <label className={LBL}>Начало</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-full" />
                </div>
                <div>
                  <label className={LBL}>Срок (мес.)</label>
                  <input type="number" min="1" placeholder="напр. 12" value={durationMonths}
                    onChange={e => setDurationMonths(e.target.value)} className="input w-full" />
                </div>
                <div>
                  <label className={LBL}>Край</label>
                  <input readOnly value={endDate ? new Date(endDate).toLocaleDateString('bg-BG') : '—'}
                    className="input w-full !bg-slate-100 cursor-not-allowed text-slate-600 tabular-nums" />
                </div>
              </div>
            </FormSection>

            <div className="space-y-6 md:border-l md:border-slate-200 md:pl-6">
              <FormSection title="Бележки">
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="по желание" className="input w-full resize-none" />
              </FormSection>
              <FormSection title="Сканиран договор">
                <FileDrop file={uploadedFile} onFile={setUploadedFile} currentName={item.file_name} missing={!item.file_url} />
              </FormSection>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end items-center px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <KeysHint submitLabel="записва" />
          <button type="button" onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium">
            Отказ
          </button>
          <button type="button" data-primary onClick={handleSave} disabled={saving || !counterparty || !subject}
            className="px-5 py-2 text-white rounded-xl text-xs font-medium flex items-center gap-2 whitespace-nowrap disabled:opacity-60 shadow-sm hover:opacity-90"
            style={{ backgroundColor: '#0f2240' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Запазване…' : 'Запази промените'}
          </button>
        </div>
      </div>
    </div>
  )
}
