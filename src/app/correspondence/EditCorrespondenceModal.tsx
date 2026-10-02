'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, Save } from 'lucide-react'
import { FormSection, FileDrop } from '@/components/registry/FormParts'

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

interface NomItem { item_code: string; name: string; section_code: string }

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
  const [nomenclatureItem, setNomenclatureItem] = useState(item.nomenclature_item || '')
  const [newFile, setNewFile] = useState<File | null>(null)

  const [nomenclature, setNomenclature] = useState<NomItem[]>([])

  const dir = item.direction

  useEffect(() => {
    supabase.from('nomenclature_items')
      .select('item_code, name, section_code')
      .eq('for_correspondence', true)
      .order('item_code')
      .then(({ data }) => setNomenclature(data || []))
  }, [])

  async function handleSave() {
    if (!subject) return
    setSaving(true)

    let fileUrl = item.file_url
    let fileName = item.file_name

    if (newFile) {
      const currentYear = new Date().getFullYear()
      const ext = newFile.name.split('.').pop()
      const filePath = `correspondence/${currentYear}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, newFile, { upsert: true })
      if (!uploadError) { fileUrl = filePath; fileName = newFile.name }
    }

        const { error } = await supabase.from('correspondence').update({
      date,
      from_whom: fromWhom || null,
      to_whom: toWhom || null,
      subject,
      description: description || null,
      nomenclature_item: nomenclatureItem || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      is_reserved: false,
    }).eq('id', item.id)

    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }
    setSaving(false)
    onClose()
    router.refresh()
  }

  // Групиране по секция за падащото меню
  const bySection = nomenclature.reduce((acc, n) => {
    if (!acc[n.section_code]) acc[n.section_code] = []
    acc[n.section_code].push(n)
    return acc
  }, {} as Record<string, NomItem[]>)

  const LBL = 'block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5'
  const kindLabel = dir === 'outgoing' ? 'изходящ' : dir === 'internal' ? 'вътрешен' : 'входящ'

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border border-slate-200/80 max-w-3xl w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col" style={{ maxHeight: '92vh' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <div className="text-[11px] text-slate-500 uppercase tracking-widest">Редакция — {kindLabel}</div>
            <div className="text-lg font-medium text-[#0f2240] tabular-nums leading-tight mt-0.5">№ {item.number}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid md:grid-cols-[1.2fr_1fr] gap-6">
            <FormSection title="Данни">
              <div>
                <label className={LBL}>Дата</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-44" />
              </div>

              {dir === 'incoming' && (
                <div>
                  <label className={LBL}>От кого</label>
                  <input type="text" list="from-list" value={fromWhom} onChange={e => setFromWhom(e.target.value)}
                    placeholder="институция или лице" className="input w-full" />
                  <datalist id="from-list">{EXTERNAL_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
                </div>
              )}

              {dir === 'outgoing' && (
                <div>
                  <label className={LBL}>До кого</label>
                  <input type="text" list="to-list" value={toWhom} onChange={e => setToWhom(e.target.value)}
                    placeholder="институция или лице" className="input w-full" />
                  <datalist id="to-list">{EXTERNAL_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
                </div>
              )}

              {dir === 'internal' && (
                <div>
                  <label className={LBL}>От кого</label>
                  <input type="text" list="internal-list" value={fromWhom} onChange={e => setFromWhom(e.target.value)}
                    placeholder="длъжностно лице" className="input w-full" />
                  <datalist id="internal-list">{INTERNAL_PERSONS.map(s => <option key={s} value={s} />)}</datalist>
                </div>
              )}

              <div>
                <label className={LBL}>Относно *</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  required className="input w-full" />
              </div>

              <div>
                <label className={LBL}>Забележка</label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                  className="input w-full resize-none" />
              </div>
            </FormSection>

            <div className="space-y-6 md:border-l md:border-slate-200 md:pl-6">
              <FormSection title="Архивен индекс">
                <select value={nomenclatureItem} onChange={e => setNomenclatureItem(e.target.value)} className="input w-full cursor-pointer">
                  <option value="">— Без индекс —</option>
                  {Object.entries(bySection).map(([section, items]) => (
                    <optgroup key={section} label={section}>
                      {items.map(n => (
                        <option key={n.item_code} value={n.item_code}>{n.item_code} — {n.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </FormSection>

              <FormSection title="Файл">
                <FileDrop file={newFile} onFile={setNewFile} currentName={item.file_name} missing={!item.file_url && !item.is_reserved} />
              </FormSection>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium">
            Отказ
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !subject}
            className="px-5 py-2 text-white rounded-xl text-xs font-medium flex items-center gap-2 disabled:opacity-60 shadow-sm hover:opacity-90"
            style={{ backgroundColor: '#0f2240' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Запазване…' : 'Запази промените'}
          </button>
        </div>
      </div>
    </div>
  )
}
