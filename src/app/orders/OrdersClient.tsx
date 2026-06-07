'use client'

import { useState, useRef } from 'react'
import NewOrderForm from './NewOrderForm'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Search, X, Upload, FileText, Loader2,
  ClipboardList, ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react'

const QUICK_ORDER_ITEMS = [
  { code: 'РД-08', name: 'Класьор заповеди на директора' },
  { code: 'РД-09', name: 'Трудови договори и заповеди' },
  { code: 'УВД-23', name: 'Заповеди за утвърждаване на ИУП' },
  { code: 'УВД-22', name: 'Заповеди за определяне на ЕПЛР' },
]

const ALL_ORDER_ITEMS = [
  { code: 'РД-06', name: 'Наредби по вътрешен ред' },
  { code: 'РД-07', name: 'Книга за регистриране на заповеди' },
  { code: 'РД-08', name: 'Класьор заповеди на директора' },
  { code: 'РД-09', name: 'Трудови договори и заповеди' },
  { code: 'УВД-10', name: 'План за контролната дейност' },
  { code: 'УВД-22', name: 'Заповеди за определяне на ЕПЛР' },
  { code: 'УВД-23', name: 'Заповеди за утвърждаване на ИУП' },
  { code: 'ФСД-01', name: 'Указания по финансови въпроси' },
  { code: 'ЛС-05', name: 'Длъжностни характеристики' },
  { code: 'БУТ-01', name: 'Правилник за охрана на труда' },
  { code: 'БУТ-04', name: 'План за евакуация' },
]

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

interface Props {
  orders: any[]
  totalCount: number
  page: number
  pageSize: number
  searchValue: string
  canEdit: boolean
  currentUserId: string
  students: { id: string; first_name: string; last_name: string }[]
}

export default function OrdersClient({
  orders, totalCount, page, pageSize,
  searchValue, canEdit, currentUserId, students
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const schoolYear = getSchoolYear()

  const [search, setSearch] = useState(searchValue)
  const [showForm, setShowForm] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [orderTypeCode, setOrderTypeCode] = useState('')
  const [showAllItems, setShowAllItems] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [title, setTitle] = useState('')
  const [employee, setEmployee] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [studentId, setStudentId] = useState('')

  const totalPages = Math.ceil(totalCount / pageSize)

  const filteredItems = ALL_ORDER_ITEMS.filter(i =>
    !itemSearch || i.code.toLowerCase().includes(itemSearch.toLowerCase()) || i.name.toLowerCase().includes(itemSearch.toLowerCase())
  )

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    params.set('page', '1')
    router.push(`/orders?${params.toString()}`)
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams()
    if (searchValue) params.set('q', searchValue)
    params.set('page', String(newPage))
    router.push(`/orders?${params.toString()}`)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('Файлът е прекалено голям (макс. 10MB)'); return }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(ext || '')) { alert('Позволени са само PDF и Word файлове'); return }
    setUploadedFile(file)
  }

  function resetForm() {
    setOrderTypeCode('')
    setShowAllItems(false)
    setItemSearch('')
    setTitle('')
    setEmployee('')
    setOrderDate(new Date().toISOString().split('T')[0])
    setDescription('')
    setStudentId('')
    setUploadedFile(null)
    setShowForm(false)
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
    const nextNum = (count || 0) + 1

    let fileUrl = ''
    let fileName = ''
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop()
      const filePath = `orders/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadedFile, { upsert: true })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('student-dossiers').getPublicUrl(filePath)
        fileUrl = urlData.publicUrl
        fileName = uploadedFile.name
      }
    }

    const { error } = await supabase.from('orders').insert({
      number: `${orderTypeCode}-${nextNum}/${orderDate.slice(0, 10).split('-').reverse().join('.')}`,
      date: orderDate,
      title,
      description: description || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      student_id: studentId || null,
      created_by: currentUserId,
    })

    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }
    resetForm()
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Общо <span className="font-semibold text-slate-800">{totalCount}</span> заповеди
          <span className="ml-2 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-semibold">
            Уч. год. {schoolYear}/{schoolYear + 1}
          </span>
        </p>
        {canEdit && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md"
            style={{ backgroundColor: '#0f2240' }}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Затвори' : 'Нова заповед'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Нова заповед</h2>
            <button onClick={resetForm} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Дело от номенклатурата */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Дело от номенклатурата *</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {QUICK_ORDER_ITEMS.map(item => (
                  <button key={item.code} type="button"
                    onClick={() => { setOrderTypeCode(item.code); setShowAllItems(false) }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                      orderTypeCode === item.code
                        ? 'bg-[#0f2240] text-white border-[#0f2240]'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    <span className="font-mono">{item.code}</span>
                    <span className="ml-1.5 font-normal opacity-70 hidden sm:inline">{item.name.slice(0, 25)}...</span>
                  </button>
                ))}
                <button type="button" onClick={() => setShowAllItems(!showAllItems)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    showAllItems ? 'bg-slate-100 border-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}>
                  <ChevronDown size={13} className={showAllItems ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  Друго дело...
                </button>
              </div>

              {showAllItems && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                  <input autoFocus placeholder="Търси по код или описание..."
                    value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                    className="input w-full" />
                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {filteredItems.map(item => (
                      <button key={item.code} type="button"
                        onClick={() => { setOrderTypeCode(item.code); setShowAllItems(false); setItemSearch('') }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                          orderTypeCode === item.code ? 'bg-[#0f2240] text-white' : 'hover:bg-white text-slate-700'
                        }`}>
                        <span className="font-mono font-bold">{item.code}</span>
                        <span className="ml-2 opacity-70">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {orderTypeCode && (
                <p className="text-xs text-blue-700 font-semibold mt-1.5">
                  ✓ Избрано: <span className="font-mono">{orderTypeCode}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Дата *</label>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} required className="input w-48" />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Заглавие *</label>
              <input type="text" list="title-list" required value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="напр. Заповед за отпуск"
                className="input w-full" />
              <datalist id="title-list">
                {TITLE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Служител (опционално)</label>
              <input type="text" value={employee} onChange={e => setEmployee(e.target.value)}
                list="employee-list" placeholder="напр. Мария Иванова"
                className="input w-full" />
              <datalist id="employee-list">
                <option value="Светлана Иванова — Директор" />
                <option value="Йордан Йорданов — ЗДАСД" />
                <option value="Силвия Кьошкерян — ЗДУД" />
                <option value="Радка Георгиева — Счетоводство" />
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Описание</label>
              <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Допълнителна информация..." className="input w-full resize-none" />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Свързан ученик (опционално)</label>
              <select value={studentId} onChange={e => setStudentId(e.target.value)} className="input w-full">
                <option value="">Няма връзка към ученик</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Прикачен документ (PDF/Word, макс. 10MB)</label>
              {uploadedFile ? (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <FileText className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">{uploadedFile.name}</div>
                    <div className="text-[10px] text-slate-400">{(uploadedFile.size / 1024).toFixed(0)} KB</div>
                  </div>
                  <button type="button" onClick={() => setUploadedFile(null)} className="text-slate-400 hover:text-red-500 p-1"><X size={14} /></button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-full h-14 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Upload size={16} /><span className="text-xs font-semibold">Избери файл</span>
                  </div>
                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
                </label>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
              <button type="button" onClick={resetForm} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">Отказ</button>
              <button type="submit" disabled={saving || !orderTypeCode}
                className="px-4 py-2 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: '#0f2240' }}>
                {saving && <Loader2 size={13} className="animate-spin" />}
                {saving ? 'Записване...' : 'Запази заповедта'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Търсене */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Търсене по №, заглавие..." value={search}
              onChange={e => setSearch(e.target.value)} className="input pl-9 w-72" />
          </div>
          <button type="submit" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700">Търси</button>
        </form>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">№</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Дата</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Заглавие</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ученик</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Файл</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-16 text-center">
                  <ClipboardList size={32} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-400 text-sm">Няма регистрирани заповеди</p>
                </td></tr>
              ) : orders.map((item, idx) => (
                <tr key={item.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                  <td className="px-5 py-3"><span className="font-mono font-bold text-orange-700 text-xs">{item.number}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                    {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold text-slate-800">{item.title}</div>
                    {item.description && <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs">{item.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {item.student ? (
                      <span className="text-[10px] font-bold text-[#0f2240]">{item.student.last_name} {item.student.first_name}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {item.file_url ? (
                      <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0f2240] hover:underline">
                        <FileText size={12} />PDF
                      </a>
                    ) : <span className="text-slate-300 text-[10px]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">Страница <span className="font-semibold text-slate-700">{page}</span> от <span className="font-semibold text-slate-700">{totalPages}</span></p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => handlePageChange(page - 1)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft size={14} /> Назад
            </button>
            <button disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              Напред <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
      {/* Модал за нова заповед */}
      {showForm && (
        <NewOrderForm
          currentUserId={currentUserId}
          students={students}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); }}
        />
      )}
    </div>
  )
}
