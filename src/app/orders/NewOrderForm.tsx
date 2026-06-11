'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, FileText, Loader2, ChevronDown, Zap, User } from 'lucide-react'

const TITLE_SUGGESTIONS = [
  'Заповед за отпуск',
  'Заповед за назначаване',
  'Заповед за освобождаване',
  'Заповед за командировка',
  'Заповед за насочване на ученик',
  'Заповед за ЕПЛР екип',
  'Заповед за утвърждаване на ИУП',
  'Заповед за вътрешно съвместителство',
  'Заповед за допълнително възнаграждение',
]

const QUICK_SCENARIOS: Record<string, {
  label: string
  index: string
  titleTemplate: string
  needsStaff?: boolean
}> = {
  vacation: {
    label: 'Отпуск',
    index: 'РД-08',
    titleTemplate: 'Заповед за отпуск на {name}',
    needsStaff: true,
  },
}

interface NomenclatureItem {
  id: string; section_code: string; item_code: string; name: string; retention_years: string
  quick_orders?: boolean
}

interface Props {
  currentUserId: string
  students: { id: string; first_name: string; last_name: string }[]
  staff: { id: string; first_name: string; last_name: string }[]
  nomenclature: NomenclatureItem[]
  onClose: () => void
  onSaved: () => void
}

export default function NewOrderForm({ currentUserId, students, staff, nomenclature, onClose, onSaved }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const descRef = useRef<HTMLTextAreaElement>(null)

  const [saving, setSaving] = useState(false)
  const [saveAction, setSaveAction] = useState<'save_close' | 'save_new'>('save_close')
  const [scenario, setScenario] = useState<string | null>(null)
  const [orderTypeCode, setOrderTypeCode] = useState('')
  const [showAllItems, setShowAllItems] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [title, setTitle] = useState('')
  const [staffId, setStaffId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [nextCount, setNextCount] = useState<number | null>(null)

  const currentYear = new Date().getFullYear()

  useEffect(() => {
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .gte('date', `${currentYear}-01-01`).lte('date', `${currentYear}-12-31`)
      .then(({ count }) => setNextCount(count || 0))
  }, [])

  useEffect(() => {
    if (descRef.current) {
      descRef.current.style.height = 'auto'
      descRef.current.style.height = descRef.current.scrollHeight + 'px'
    }
  }, [description])

  const nextNum = nextCount !== null ? String(nextCount + 1).padStart(3, '0') : '???'
  const previewNumber = `${nextNum}/${orderDate.split('-').reverse().join('.')}г.`

  const filteredItems = nomenclature.filter(i =>
    !itemSearch || i.item_code.toLowerCase().includes(itemSearch.toLowerCase()) || i.name.toLowerCase().includes(itemSearch.toLowerCase())
  )
  const filteredBySection = filteredItems.reduce((acc, item) => {
    if (!acc[item.section_code]) acc[item.section_code] = []
    acc[item.section_code].push(item)
    return acc
  }, {} as Record<string, NomenclatureItem[]>)

  const selectedItem = nomenclature.find(i => i.item_code === orderTypeCode)
  const activeScenario = scenario ? QUICK_SCENARIOS[scenario] : null
  const quickCodes = nomenclature.filter(n => n.quick_orders).map(n => n.item_code)

  function selectScenario(key: string) {
    if (scenario === key) {
      setScenario(null)
      setOrderTypeCode('')
      setTitle('')
      setStaffId('')
      return
    }
    const s = QUICK_SCENARIOS[key]
    setScenario(key)
    setOrderTypeCode(s.index)
    setTitle('')
    setStaffId('')
  }

  function handleStaffSelect(id: string) {
    setStaffId(id)
    const s = staff.find(x => x.id === id)
    if (s && activeScenario) {
      setTitle(activeScenario.titleTemplate.replace('{name}', `${s.first_name} ${s.last_name}`))
    }
  }

  function resetForm() {
    setScenario(null)
    setOrderTypeCode('')
    setShowAllItems(false)
    setItemSearch('')
    setTitle('')
    setStaffId('')
    setOrderDate(new Date().toISOString().split('T')[0])
    setDescription('')
    setUploadedFile(null)
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .gte('date', `${currentYear}-01-01`).lte('date', `${currentYear}-12-31`)
      .then(({ count }) => setNextCount(count || 0))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title) return
    setSaving(true)

    const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true })
      .gte('date', `${currentYear}-01-01`).lte('date', `${currentYear}-12-31`)
    const num = String((count || 0) + 1).padStart(3, '0')
    const formattedDate = orderDate.split('-').reverse().join('.')
    const docNumber = `${num}/${formattedDate}г.`

    let fileUrl = '', fileName = ''
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop()
      const filePath = `orders/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, uploadedFile, { upsert: true })
      if (!uploadError) { fileUrl = filePath; fileName = uploadedFile.name }
    }

    const { error } = await supabase.from('orders').insert({
      number: docNumber,
      date: orderDate,
      title,
      nomenclature_item: orderTypeCode || null,
      description: description || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
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
      <div className="bg-white rounded-3xl border border-slate-200/80 max-w-xl w-full shadow-2xl flex flex-col" style={{ height: '85vh' }}>

        {/* Хедър */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="font-medium text-slate-800 text-sm uppercase tracking-widest">Регистриране на заповед</h3>
            <p className="text-[11px] text-[#0f2240] font-bold mt-1">{previewNumber}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Бързо регистриране */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Zap size={11} /> Бързо регистриране
              </label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(QUICK_SCENARIOS).map(([key, s]) => (
                  <button key={key} type="button" onClick={() => selectScenario(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      scenario === key
                        ? 'bg-[#0f2240] text-white border-[#0f2240]'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    <User size={12} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Дата */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Дата на издаване *</label>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
                required className="input w-44 text-xs" />
            </div>

            {/* Избор на служител при сценарий */}
            {activeScenario?.needsStaff && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <User size={11} /> Служител *
                </label>
                <select value={staffId} onChange={e => handleStaffSelect(e.target.value)} required className="input w-full">
                  <option value="">— Избери служител —</option>
                  {staff.sort((a,b) => a.first_name.localeCompare(b.first_name, 'bg')).map(s => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                  ))}
                </select>
                {title && <div className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2">{title}</div>}
              </div>
            )}

            {/* Относно */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Относно / Заглавие *</label>
              <input type="text" list="title-list" required value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="напр. Заповед за отпуск на Мария Иванова"
                className="input w-full" />
              <datalist id="title-list">
                {TITLE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

            {/* Бележки */}
            <textarea ref={descRef} rows={1} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Допълнителна информация..."
              className="input w-full resize-none overflow-hidden" />

            {/* Архивен индекс — долу */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Архивен индекс {activeScenario && <span className="text-slate-300 normal-case">(зададен автоматично)</span>}
              </label>

              {activeScenario ? (
                selectedItem && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-fit">
                    <span className="font-medium text-[#0f2240]">{orderTypeCode}</span>
                    <span className="text-slate-500 truncate">{selectedItem.name}</span>
                  </div>
                )
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {quickCodes.map(code => {
                      const item = nomenclature.find(n => n.item_code === code)
                      if (!item) return null
                      return (
                        <button key={code} type="button"
                          onClick={() => setOrderTypeCode(orderTypeCode === code ? '' : code)}
                          title={item.name}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                            orderTypeCode === code
                              ? 'bg-[#0f2240] text-white border-[#0f2240]'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
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
                      <input autoFocus placeholder="Търси по код или наименование..."
                        value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                        className="input w-full text-xs" />
                      <div className="max-h-36 overflow-y-auto space-y-2">
                        {Object.entries(filteredBySection).map(([section, items]) => (
                          <div key={section}>
                            <div className="text-[10px] font-medium text-slate-400 uppercase px-2 mb-1">{section}</div>
                            {items.map(item => (
                              <button key={item.item_code} type="button"
                                onClick={() => { setOrderTypeCode(item.item_code); setShowAllItems(false); setItemSearch('') }}
                                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                  orderTypeCode === item.item_code ? 'bg-[#0f2240] text-white' : 'hover:bg-white text-slate-700'
                                }`}>
                                <span className="font-medium">{item.item_code}</span>
                                <span className="ml-2 opacity-70">{item.name}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedItem && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-fit">
                      <span className="font-medium text-[#0f2240]">{orderTypeCode}</span>
                      <span className="text-slate-500 truncate">{selectedItem.name}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Файл */}
            {uploadedFile ? (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <FileText size={16} className="text-slate-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-800 truncate">{uploadedFile.name}</div>
                  <div className="text-[10px] text-slate-400">{(uploadedFile.size / 1024).toFixed(0)} KB</div>
                </div>
                <button type="button" onClick={() => setUploadedFile(null)} className="text-slate-400 hover:text-red-500 p-1"><X size={14} /></button>
              </div>
            ) : (
              <label className="flex items-center justify-center w-full h-10 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#0f2240] hover:bg-slate-50 transition-all">
                <div className="flex items-center gap-2 text-slate-400">
                  <Upload size={14} /><span className="text-xs font-medium">Прикачи файл (PDF/Word, макс. 10MB)</span>
                </div>
                <input type="file" className="hidden" accept=".pdf,.doc,.docx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setUploadedFile(f) }} />
              </label>
            )}
          </div>

          {/* Бутони */}
          <div className="flex gap-2 justify-end px-5 py-4 border-t border-slate-100 flex-shrink-0 bg-white rounded-b-3xl">
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors">
              Отказ
            </button>
            <button type="submit" disabled={saving}
              onClick={() => setSaveAction('save_new')}
              className="px-4 py-2 border border-[#0f2240] text-[#0f2240] rounded-xl text-xs font-medium flex items-center gap-1.5 disabled:opacity-60 hover:bg-slate-50 transition-colors">
              {saving && saveAction === 'save_new' && <Loader2 size={12} className="animate-spin" />}
              Запази и нов
            </button>
            <button type="submit" disabled={saving}
              onClick={() => setSaveAction('save_close')}
              className="px-5 py-2 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 disabled:opacity-60 shadow-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#0f2240' }}>
              {saving && saveAction === 'save_close' && <Loader2 size={12} className="animate-spin" />}
              {saving ? 'Записване...' : 'Регистрирай заповед'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
