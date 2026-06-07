'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, FileText, Loader2, ChevronDown } from 'lucide-react'

// Бързи кодове за заповеди
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

const EMPLOYEE_SUGGESTIONS = [
  'Светлана Иванова — Директор',
  'Йордан Йорданов — ЗДАСД',
  'Силвия Кьошкерян — ЗДУД',
  'Радка Георгиева — Счетоводство',
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
  const [studentId, setStudentId] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const filteredItems = nomenclature.filter(i =>
    !itemSearch || i.item_code.toLowerCase().includes(itemSearch.toLowerCase()) || i.name.toLowerCase().includes(itemSearch.toLowerCase())
  )
  const filteredBySection = filteredItems.reduce((acc, item) => {
    if (!acc[item.section_code]) acc[item.section_code] = []
    acc[item.section_code].push(item)
    return acc
  }, {} as Record<string, NomenclatureItem[]>)

  function resetForm() {
    setOrderTypeCode('РД-08')
    setShowAllItems(false)
    setItemSearch('')
    setTitle('')
    setOrderDate(new Date().toISOString().split('T')[0])
    setDescription('')
    setStudentId('')
    setUploadedFile(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orderTypeCode || !title) return
    setSaving(true)

    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('date', `${schoolYear}-09-15`)
      .lte('date', `${schoolYear + 1}-09-14`)
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
      student_id: studentId || null, created_by: currentUserId,
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
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Нова заповед</h3>
            <p className="text-[11px] font-mono text-orange-600 font-bold mt-0.5">
              {orderTypeCode}-{String(1).padStart(3,'0')}/{orderDate.split('-').reverse().join('.')}г.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Дело от номенклатурата + Дата */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Дело от номенклатурата *</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_ORDER_CODES.map(code => {
                  const item = nomenclature.find(n => n.item_code === code)
                  if (!item) return null
                  return (
                    <button key={code} type="button"
                      onClick={() => { setOrderTypeCode(code); setShowAllItems(false) }}
                      title={item.name}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        orderTypeCode === code
                          ? 'bg-[#0f2240] text-white border-[#0f2240]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}>
                      <span className="font-mono">{code}</span>
                    </button>
                  )
                })}
                <button type="button" onClick={() => setShowAllItems(!showAllItems)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${showAllItems ? 'bg-slate-200 border-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                  <ChevronDown size={12} className={showAllItems ? 'rotate-180 transition-transform' : ''} />
                  Всички...
                </button>
              </div>

              {showAllItems && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 mb-2">
                  <input autoFocus placeholder="Търси..." value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)} className="input w-full text-xs" />
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

              {orderTypeCode && (
                <div className="flex items-center px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <span className="font-mono font-bold text-[#0f2240]">{orderTypeCode}</span>
                  <span className="ml-2 text-slate-500 truncate">{nomenclature.find(i => i.item_code === orderTypeCode)?.name}</span>
                  <span className="ml-auto text-slate-400 flex-shrink-0">Уч. год. {schoolYear}/{schoolYear+1}</span>
                </div>
              )}
            </div>
            <div className="w-36 flex-shrink-0">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Дата *</label>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} required className="input w-full" />
            </div>
          </div>

          {/* Заглавие */}
          <input type="text" list="title-list" required value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Заглавие на заповедта *"
            className="input w-full" />
          <datalist id="title-list">
            {TITLE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
          </datalist>

          {/* Бележки */}
          <textarea rows={1} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Бележки (незадължително)..."
            className="input w-full resize-none" />

          {/* Ученик */}
          <select value={studentId} onChange={e => setStudentId(e.target.value)} className="input w-full">
            <option value="">Свързан ученик (опционално)</option>
            {students.sort((a,b) => a.last_name.localeCompare(b.last_name)).map(s => (
              <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
            ))}
          </select>

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
