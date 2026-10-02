'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, Save, ChevronDown } from 'lucide-react'
import { FormSection, FileDrop, useFormKeys, KeysHint } from '@/components/registry/FormParts'

const TITLE_SUGGESTIONS = [
  'Заповед за назначаване', 'Заповед за освобождаване',
  'Заповед за отпуск', 'Заповед за командировка',
  'Заповед за насочване на ученик', 'Заповед за ЕПЛР екип',
  'Заповед за утвърждаване на ИУП', 'Заповед за вътрешно съвместителство',
]

interface Props {
  item: any
  nomenclature?: { id: string; item_code: string; name: string; section_code: string; quick_orders?: boolean }[]
  onClose: () => void
}

export default function EditOrderModal({ item, nomenclature = [], onClose }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useFormKeys(rootRef, onClose)
  const [date, setDate] = useState(item.date || '')
  const [title, setTitle] = useState(item.title || '')
  const [description, setDescription] = useState(item.description || '')
  const [nomenclatureItem, setNomenclatureItem] = useState(item.nomenclature_item || '')
  const [newFile, setNewFile] = useState<File | null>(null)
  const [showAllItems, setShowAllItems] = useState(false)
  const [itemSearch, setItemSearch] = useState('')

  const quickCodes = nomenclature.filter(n => n.quick_orders).map(n => n.item_code)
  const selectedItem = nomenclature.find(i => i.item_code === nomenclatureItem)

  const filteredItems = nomenclature.filter(i =>
    !itemSearch || i.item_code.toLowerCase().includes(itemSearch.toLowerCase()) || i.name.toLowerCase().includes(itemSearch.toLowerCase())
  )
  const filteredBySection = filteredItems.reduce((acc, item) => {
    if (!acc[item.section_code]) acc[item.section_code] = []
    acc[item.section_code].push(item)
    return acc
  }, {} as Record<string, any[]>)

  async function handleSave() {
    if (!title) return
    setSaving(true)

    let fileUrl = item.file_url
    let fileName = item.file_name

    if (newFile) {
      const ext = newFile.name.split('.').pop()
      const filePath = `orders/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, newFile, { upsert: true })
      if (!uploadError) { fileUrl = filePath; fileName = newFile.name }
    }

        const { error } = await supabase.from('orders').update({
      date,
      title,
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

  const LBL = 'block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div ref={rootRef} className="bg-white rounded-3xl border border-slate-200/80 max-w-3xl w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col" style={{ maxHeight: '92vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <div className="text-[11px] text-slate-500 uppercase tracking-widest">Редакция на заповед</div>
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
                <label className={LBL}>Заглавие *</label>
                <input type="text" list="title-list" value={title} onChange={e => setTitle(e.target.value)}
                  required placeholder="напр. Заповед за отпуск" className="input w-full" />
                <datalist id="title-list">{TITLE_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
              </div>
              <div>
                <label className={LBL}>Забележка</label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                  className="input w-full resize-none" />
              </div>
            </FormSection>

            <div className="space-y-6 md:border-l md:border-slate-200 md:pl-6">
              <FormSection title="Архивен индекс">
                <div className="flex flex-wrap gap-1.5">
                  {quickCodes.map(code => {
                    const ni = nomenclature.find(n => n.item_code === code)
                    if (!ni) return null
                    return (
                      <button key={code} type="button" title={ni.name}
                        onClick={() => setNomenclatureItem(nomenclatureItem === code ? '' : code)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                          nomenclatureItem === code ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}>
                        {code}
                      </button>
                    )
                  })}
                  <button type="button" onClick={() => setShowAllItems(!showAllItems)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${showAllItems ? 'bg-slate-200 border-slate-300' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}>
                    <ChevronDown size={12} className={`transition-transform ${showAllItems ? 'rotate-180' : ''}`} />
                    Всички…
                  </button>
                </div>

                {showAllItems && (
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                    <input autoFocus placeholder="Търси по код или наименование…" value={itemSearch} onChange={e => setItemSearch(e.target.value)} className="input w-full text-xs" />
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {Object.entries(filteredBySection).map(([section, items]) => (
                        <div key={section}>
                          <div className="text-[10px] font-medium text-slate-500 uppercase px-2 mb-1">{section}</div>
                          {items.map((ni: any) => (
                            <button key={ni.item_code} type="button"
                              onClick={() => { setNomenclatureItem(ni.item_code); setShowAllItems(false); setItemSearch('') }}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                nomenclatureItem === ni.item_code ? 'bg-[#0f2240] text-white' : 'hover:bg-white text-slate-700'
                              }`}>
                              <span className="font-medium">{ni.item_code}</span>
                              <span className="ml-2 opacity-70">{ni.name}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedItem && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <span className="font-medium text-[#0f2240]">{nomenclatureItem}</span>
                    <span className="text-slate-600 truncate">{selectedItem.name}</span>
                  </div>
                )}
              </FormSection>

              <FormSection title="Файл">
                <FileDrop file={newFile} onFile={setNewFile} currentName={item.file_name} missing={!item.file_url && !item.is_reserved} />
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
          <button type="button" data-primary onClick={handleSave} disabled={saving || !title}
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
