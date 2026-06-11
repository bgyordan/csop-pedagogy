'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, Save, Upload, FileText, Paperclip, ChevronDown } from 'lucide-react'

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
    }).eq('id', item.id)

    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }
    setSaving(false)
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl">
          <div>
            <h3 className="font-medium text-slate-800 text-sm uppercase tracking-wide">Редакция — Заповед</h3>
            <p className="text-[11px] text-[#0f2240] font-bold mt-0.5">{item.number}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1.5">Дата</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input w-44 text-xs" />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1.5">Заглавие *</label>
            <input type="text" list="title-list" value={title} onChange={e => setTitle(e.target.value)}
              required placeholder="Заглавие на заповедта..." className="input w-full" />
            <datalist id="title-list">{TITLE_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1.5">Забележка</label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Допълнителна информация..." className="input w-full resize-none" />
          </div>

          {/* Архивен индекс */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1.5">Архивен индекс</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {quickCodes.map(code => {
                const ni = nomenclature.find(n => n.item_code === code)
                if (!ni) return null
                return (
                  <button key={code} type="button"
                    onClick={() => setNomenclatureItem(nomenclatureItem === code ? '' : code)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      nomenclatureItem === code ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    {code}
                  </button>
                )
              })}
              <button type="button" onClick={() => setShowAllItems(!showAllItems)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${showAllItems ? 'bg-slate-200 border-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                <ChevronDown size={12} className={`transition-transform ${showAllItems ? 'rotate-180' : ''}`} />
                Всички...
              </button>
            </div>

            {showAllItems && (
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 mb-2">
                <input autoFocus placeholder="Търси..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} className="input w-full text-xs" />
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {Object.entries(filteredBySection).map(([section, items]) => (
                    <div key={section}>
                      <div className="text-[10px] font-medium text-slate-400 uppercase px-2 mb-1">{section}</div>
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
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-fit">
                <span className="font-medium text-[#0f2240]">{nomenclatureItem}</span>
                <span className="text-slate-500 truncate">{selectedItem.name}</span>
              </div>
            )}
          </div>

          {/* Файл */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1.5">Прикачен файл</label>
            {item.file_name && !newFile && (
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl mb-2">
                <Paperclip size={13} className="text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-600 truncate flex-1">{item.file_name}</span>
                <span className="text-[10px] text-slate-400">текущ</span>
              </div>
            )}
            {newFile ? (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <FileText size={15} className="text-slate-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-800 truncate">{newFile.name}</div>
                  <div className="text-[10px] text-slate-400">{(newFile.size / 1024).toFixed(0)} KB — нов файл</div>
                </div>
                <button type="button" onClick={() => setNewFile(null)} className="text-slate-400 hover:text-red-500 p-1"><X size={13} /></button>
              </div>
            ) : (
              <label className="flex items-center justify-center w-full h-9 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#0f2240] hover:bg-slate-50 transition-all">
                <div className="flex items-center gap-2 text-slate-400">
                  <Upload size={13} /><span className="text-xs font-medium">{item.file_name ? 'Смени файла' : 'Прикачи файл'}</span>
                </div>
                <input type="file" className="hidden" accept=".pdf,.doc,.docx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setNewFile(f) }} />
              </label>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end px-6 pb-6 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium">
            Отказ
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-white rounded-xl text-xs font-medium flex items-center gap-2 disabled:opacity-60 shadow-sm"
            style={{ backgroundColor: '#0f2240' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Запазване...' : 'Запази'}
          </button>
        </div>
      </div>
    </div>
  )
}
