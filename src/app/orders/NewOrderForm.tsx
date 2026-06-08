'use client'

iimport { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, FileText, Loader2, ChevronDown } from 'lucide-react'

const QUICK_ORDER_CODES = ['РД-08', 'РД-09', 'УВД-22', 'УВД-23']

const TITLE_SUGGESTIONS = [
  'Заповед за назначаване',
  'Заповед за освобождаване',
  'Заповед за отпуск',
  'Заповед за командировка',
  'Заповед за насочване на ученик',
  'Заповед за ЕПЛР екип',
  'Заповед за утвърждаване на ИУП',
  'Заповед за вътрешно съвместителство',
  'Заповед за допълнително възнаграждение',
]

function getSchoolYear(): number {
  const now = new Date()
  return now >= new Date(now.getFullYear(), 8, 15) ? now.getFullYear() : now.getFullYear() - 1
}

interface NomenclatureItem {
  id: string; section_code: string; item_code: string; name: string; retention_years: string
}

interface Props {
  currentUserId: string
  students: { id: string; first_name: string; last_name: string }[]
  nomenclature: NomenclatureItem[]
  onClose: () => void
  onSaved: () => void
}

export default function NewOrderForm({ currentUserId, students, nomenclature, onClose, onSaved }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const schoolYear = getSchoolYear()

  const [saving, setSaving] = useState(false)
  const [saveAction, setSaveAction] = useState<'save_close' | 'save_new'>('save_close')
  const [orderTypeCode, setOrderTypeCode] = useState('РД-08')
  const [showAllItems, setShowAllItems] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [title, setTitle] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const filteredItems = nomenclature.filter(i =>
    !itemSearch || i.item_code.toLowerCase().includes(itemSearch.toLowerCase()) || i.name.toLowerCase().includes(itemSearch.toLowerCase())
  )
  const filteredBySection = filteredItems.reduce((acc, item) => {
    if (!acc[item.section_code]) acc[item.section_code] = []
    acc[item.section_code].push(item)
    return acc
  }, {} as Record<string, NomenclatureItem[]>)

  const selectedItem = nomenclature.find(i => i.item_code === orderTypeCode)
  const [nextCount, setNextCount] = useState<number | null>(null)

// Зареди count при отваряне
useEffect(() => {
  supabase.from('orders').select('id', { count: 'exact', head: true })
    .then(({ count }) => setNextCount(count || 0))
}, [])

const nextNum = nextCount !== null ? String(nextCount + 1).padStart(3, '0') : '???'
const previewNumber = `${orderTypeCode}-${nextNum}/${orderDate.split('-').reverse().join('.')}г.`

  function resetForm() {
    setOrderTypeCode('РД-08')
    setShowAllItems(false)
    setItemSearch('')
    setTitle('')
    setOrderDate(new Date().toISOString().split('T')[0])
    setDescription('')
    setUploadedFile(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orderTypeCode || !title) return
    setSaving(true)

    const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true })
    const nextNum = String((count || 0) + 1).padStart(3, '0')
    const formattedDate = orderDate.split('-').reverse().join('.')
    const docNumber = `${orderTypeCode}-${nextNum}/${formattedDate}г.`

    let fileUrl = '', fileName = ''
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop()
      const filePath = `orders/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, uploadedFile, { upsert: true })
      if (!uploadError) { fileUrl = filePath; fileName = uploadedFile.name }
    }

    const { error } = await supabase.from('orders').insert({
      number: docNumber, date: orderDate, title,
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
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl z-10">
          <div>
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Добавяне на заповед</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Регистрирайте заповедта в деловодния регистър.</p>
            <p className="text-[11px] font-mono text-orange-600 font-bold mt-1">{previewNumber}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Дело от номенклатурата */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Дело от номенклатурата *</label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ORDER_CODES.map(code => {
                const item = nomenclature.find(n => n.item_code === code)
                if (!item) return null
                return (
                  <button key={code} type="button"
                    onClick={() => { setOrderTypeCode(code); setShowAllItems(false) }}
                    title={item.name}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      orderTypeCode === code
                        ? 'bg-[#0f2240] text-white border-[#0f2240] shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    <span className="font-mono">{code}</span>
                  </button>
                )
              })}
              <button type="button" onClick={() => setShowAllItems(!showAllItems)}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${showAllItems ? 'bg-slate-200 border-slate-300 text-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                <ChevronDown size={12} className={`transition-transform ${showAllItems ? 'rotate-180' : ''}`} />
                Всички...
              </button>
            </div>

            {showAllItems && (
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                <input autoFocus placeholder="Търси по код или наименование..."
                  value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                  className="input w-full text-xs" />
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {Object.entries(filteredBySection).map(([section, items]) => (
                    <div key={section}>
                      <div className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-1">{section}</div>
                      {items.map(item => (
                        <button key={item.item_code} type="button"
                          onClick={() => { setOrderTypeCode(item.item_code); setShowAllItems(false); setItemSearch('') }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                            orderTypeCode === item.item_code ? 'bg-[#0f2240] text-white' : 'hover:bg-white text-slate-700'
                          }`}>
                          <span className="font-mono font-bold">{item.item_code}</span>
                          <span className="ml-2 opacity-70">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedItem && (
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-100 rounded-xl text-xs">
                <span className="font-mono font-bold text-orange-700">{orderTypeCode}</span>
                <span className="text-slate-500 truncate flex-1">{selectedItem.name}</span>
                <span className="text-slate-400 flex-shrink-0 font-semibold">Уч. год. {schoolYear}/{schoolYear+1}</span>
              </div>
            )}
          </div>

          {/* Дата */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Дата на издаване *</label>
            <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
              required className="input w-full" />
          </div>

          {/* Заглавие */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Относно / Заглавие на заповедта *</label>
            <input type="text" list="title-list" required value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="напр. Заповед за отпуск на Мария Иванова"
              className="input w-full" />
            <datalist id="title-list">
              {TITLE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          {/* Бележки */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Бележки</label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Допълнителна информация..."
              className="input w-full resize-none" />
          </div>

          {/* Файл */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Сканиран оригинал (PDF/Word, макс. 10MB)</label>
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
              <label className="flex items-center justify-center w-full h-11 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#0f2240] hover:bg-slate-50 transition-all">
                <div className="flex items-center gap-2 text-slate-400">
                  <Upload size={15} /><span className="text-xs font-semibold">Избери файл</span>
                </div>
                <input type="file" className="hidden" accept=".pdf,.doc,.docx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setUploadedFile(f) }} />
              </label>
            )}
          </div>

          {/* Бутони */}
          <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors">
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
              className="px-5 py-2.5 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60 shadow-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#0f2240' }}>
              {saving && saveAction === 'save_close' && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Записване...' : 'Регистрирай заповед'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
