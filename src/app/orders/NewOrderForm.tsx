'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FileDrop, useFormKeys, KeysHint } from '@/components/registry/FormParts'
import { X, Loader2, ChevronDown, Zap, User } from 'lucide-react'

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
    index: 'РД-10',
    titleTemplate: 'Заповед за отпуск на {name}',
    needsStaff: true,
  },
}

// Деловодна година: 15.09 – 14.09 следващата. Връща [начало, край] като ISO дати.
function deloYearBounds(ref: Date): { start: string; end: string } {
  const y = ref.getFullYear()
  const m = ref.getMonth() + 1
  const d = ref.getDate()
  const afterStart = m > 9 || (m === 9 && d >= 15)
  const startYear = afterStart ? y : y - 1
  const iso = (yy: number, mm: number, dd: number) =>
    `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  return { start: iso(startYear, 9, 15), end: iso(startYear + 1, 9, 14) }
}

// Най-голям seq за периода + 1
async function nextSeq(supabase: any, start: string, end: string): Promise<number> {
  const { data } = await supabase.from('orders')
    .select('seq').gte('date', start).lte('date', end)
    .order('seq', { ascending: false, nullsFirst: false }).limit(1)
  const maxSeq = data && data[0] && typeof data[0].seq === 'number' ? data[0].seq : 0
  return maxSeq + 1
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
  /** Попълване на резервиран номер — записът се обновява, номерът и датата остават */
  reserved?: any
  onClose: () => void
  onSaved: () => void
}

export default function NewOrderForm({ currentUserId, students, staff, nomenclature, reserved, onClose, onSaved }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const descRef = useRef<HTMLTextAreaElement>(null)

  const [saving, setSaving] = useState(false)
  const [saveAction, setSaveAction] = useState<'save_close' | 'save_new'>('save_close')
  const rootRef = useRef<HTMLDivElement>(null)
  useFormKeys(rootRef, onClose)
  const [scenario, setScenario] = useState<string | null>(null)
  const [orderTypeCode, setOrderTypeCode] = useState('')
  const [showAllItems, setShowAllItems] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [title, setTitle] = useState('')
  const [staffId, setStaffId] = useState('')
  const [orderDate, setOrderDate] = useState(reserved?.date || new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState<string>(reserved?.description || '')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [nextNumVal, setNextNumVal] = useState<number | null>(null)

  async function refreshNext(dateStr: string) {
    const { start, end } = deloYearBounds(new Date(dateStr))
    const n = await nextSeq(supabase, start, end)
    setNextNumVal(n)
  }

  useEffect(() => { refreshNext(orderDate) }, [orderDate])

  useEffect(() => {
    if (descRef.current) {
      descRef.current.style.height = 'auto'
      descRef.current.style.height = descRef.current.scrollHeight + 'px'
    }
  }, [description])

  const nextNum = nextNumVal !== null ? String(nextNumVal).padStart(3, '0') : '???'
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
    refreshNext(new Date().toISOString().split('T')[0])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title) return
    setSaving(true)

    const { start, end } = deloYearBounds(new Date(orderDate))
    // Резервиран номер: номерът и поредността остават същите, записът се обновява
    const seq = reserved ? reserved.seq : await nextSeq(supabase, start, end)
    const num = String(seq).padStart(3, '0')
    const formattedDate = orderDate.split('-').reverse().join('.')
    const docNumber = reserved ? reserved.number : `${num}/${formattedDate}г.`

    let fileUrl = '', fileName = ''
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop()
      const filePath = `orders/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, uploadedFile, { upsert: true })
      if (!uploadError) { fileUrl = filePath; fileName = uploadedFile.name }
    }

    const row = {
      number: docNumber,
      date: orderDate,
      title,
      nomenclature_item: orderTypeCode || null,
      description: description || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      created_by: currentUserId,
      seq,
    }
    const { error } = reserved
      ? await supabase.from('orders').update({ ...row, created_by: undefined, is_reserved: false }).eq('id', reserved.id)
      : await supabase.from('orders').insert(row)

    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }
    router.refresh()
    setSaving(false)
    if (saveAction === 'save_new') resetForm()
    else onSaved()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div ref={rootRef} className="bg-white rounded-3xl border border-slate-200/80 max-w-4xl w-full shadow-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Хедър */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-[11px] text-slate-500 uppercase tracking-widest">Регистриране на заповед</h3>
            <p className="text-lg font-medium text-[#0f2240] tabular-nums leading-tight mt-1.5 flex items-center gap-2">{reserved ? reserved.number : previewNumber}{reserved && <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">попълване на резервиран номер</span>}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid md:grid-cols-[1.2fr_1fr] gap-6">
          <div className="space-y-4 min-w-0">

            {/* Бързо регистриране */}
            <div>
              <h4 className="text-[11px] font-semibold text-[#0f2240] uppercase tracking-widest flex items-center gap-2 mb-2.5"><Zap size={12} /><span>Бързо регистриране</span><span className="flex-1 h-px bg-slate-200" /></h4>
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

            <h4 className="text-[11px] font-semibold text-[#0f2240] uppercase tracking-widest flex items-center gap-2"><span>Данни</span><span className="flex-1 h-px bg-slate-200" /></h4>
            {/* Дата */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5">Дата на издаване *</label>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} disabled={!!reserved}
                title={reserved ? 'Датата е част от резервирания номер' : undefined} required className="input w-44 text-xs disabled:opacity-70" />
            </div>

            {/* Избор на служител при сценарий */}
            {activeScenario?.needsStaff && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1">
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
              <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5">Относно / Заглавие *</label>
              <input autoFocus type="text" list="title-list" required value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="напр. Заповед за отпуск на Мария Иванова"
                className="input w-full" />
              <datalist id="title-list">
                {TITLE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

          </div>
          <div className="space-y-4 min-w-0 md:border-l md:border-slate-200 md:pl-6">
            {/* Бележки */}
            <h4 className="text-[11px] font-semibold text-[#0f2240] uppercase tracking-widest flex items-center gap-2"><span>Бележка</span><span className="flex-1 h-px bg-slate-200" /></h4>
            <textarea ref={descRef} rows={1} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="по желание"
              className="input w-full resize-none overflow-hidden min-h-[72px]" />

            {/* Архивен индекс */}
            <div>
              <h4 className="text-[11px] font-semibold text-[#0f2240] uppercase tracking-widest flex items-center gap-2 mb-2.5"><span>Архивен индекс</span>{activeScenario && <span className="normal-case tracking-normal font-normal text-slate-400">зададен автоматично</span>}<span className="flex-1 h-px bg-slate-200" /></h4>

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

            <div>
              <h4 className="text-[11px] font-semibold text-[#0f2240] uppercase tracking-widest flex items-center gap-2"><span>Файл</span><span className="flex-1 h-px bg-slate-200" /></h4>
              <div className="mt-3"><FileDrop file={uploadedFile} onFile={setUploadedFile} /></div>
            </div>
          </div>
          </div>
          </div>

          {/* Бутони */}
          <div className="flex gap-2 justify-end items-center px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-white rounded-b-3xl">
            <KeysHint submitLabel="регистрира" />
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors">
              Отказ
            </button>
            {!reserved && <button type="submit" disabled={saving}
              onClick={() => setSaveAction('save_new')}
              className="px-4 py-2 border border-[#0f2240] text-[#0f2240] rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60 hover:bg-slate-50 transition-colors">
              {saving && saveAction === 'save_new' && <Loader2 size={12} className="animate-spin" />}
              Регистрирай и нов
            </button>}
            <button type="submit" disabled={saving}
              data-primary onClick={() => setSaveAction('save_close')}
              className="px-5 py-2 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60 shadow-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#0f2240' }}>
              {saving && saveAction === 'save_close' && <Loader2 size={12} className="animate-spin" />}
              {saving ? 'Записване…' : reserved ? 'Запиши в резервирания номер' : 'Регистрирай заповед'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
