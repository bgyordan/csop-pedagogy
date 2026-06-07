'use client'

import { useState, useRef } from 'react'
import NewContractForm from './NewContractForm'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Search, X, Upload, FileText, Loader2,
  FileSignature, ChevronLeft, ChevronRight, AlertTriangle
} from 'lucide-react'

const CONTRACT_TYPES = [
  { value: '', label: 'Изберете вид...' },
  { value: 'delivery', label: 'Доставка' },
  { value: 'service', label: 'Услуга' },
  { value: 'rent', label: 'Наем' },
  { value: 'labor', label: 'Трудов' },
  { value: 'civil', label: 'Граждански' },
  { value: 'other', label: 'Друг' },
]

const CONTRACT_STATUSES = [
  { value: 'active', label: 'В изпълнение' },
  { value: 'expired', label: 'Изтекъл' },
  { value: 'terminated', label: 'Прекратен' },
]

const INTERNAL_OWNERS = [
  'Светлана Иванова (Директор)',
  'Йордан Йорданов (ЗДАСД)',
  'Силвия Кьошкерян (ЗДУД)',
  'Радка Георгиева (Счетоводство)',
]

function calcEndDate(start: string, months: string): string {
  if (!start || !months) return ''
  const d = new Date(start)
  d.setMonth(d.getMonth() + parseInt(months))
  return d.toISOString().slice(0, 10)
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

interface Props {
  contracts: any[]
  totalCount: number
  page: number
  pageSize: number
  searchValue: string
  canEdit: boolean
  currentUserId: string
  students: { id: string; first_name: string; last_name: string }[]
}

export default function ContractsClient({
  contracts, totalCount, page, pageSize,
  searchValue, canEdit, currentUserId, students
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [search, setSearch] = useState(searchValue)
  const [showForm, setShowForm] = useState(false)
  const [viewItem, setViewItem] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [counterparty, setCounterparty] = useState('')
  const [contractType, setContractType] = useState('')
  const [subject, setSubject] = useState('')
  const [contractDate, setContractDate] = useState(new Date().toISOString().split('T')[0])
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [durationMonths, setDurationMonths] = useState('')
  const [contractValue, setContractValue] = useState('')
  const [internalOwner, setInternalOwner] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [status, setStatus] = useState('active')
  const [description, setDescription] = useState('')
  const [studentId, setStudentId] = useState('')

  const endDate = calcEndDate(startDate, durationMonths)
  const totalPages = Math.ceil(totalCount / pageSize)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    params.set('page', '1')
    router.push(`/contracts?${params.toString()}`)
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams()
    if (searchValue) params.set('q', searchValue)
    params.set('page', String(newPage))
    router.push(`/contracts?${params.toString()}`)
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
    setCounterparty(''); setContractType(''); setSubject('')
    setContractDate(new Date().toISOString().split('T')[0])
    setStartDate(new Date().toISOString().split('T')[0])
    setDurationMonths(''); setContractValue(''); setInternalOwner('')
    setContactPerson(''); setContactInfo(''); setStatus('active')
    setDescription(''); setStudentId(''); setUploadedFile(null); setShowForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!counterparty || !subject) return
    setSaving(true)

    const currentYear = new Date().getFullYear()
    const { count } = await supabase.from('contracts').select('id', { count: 'exact', head: true }).like('number', `%/${currentYear}`)
    const nextNum = (count || 0) + 1

    let fileUrl = '', fileName = ''
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop()
      const filePath = `contracts/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('student-dossiers').upload(filePath, uploadedFile, { upsert: true })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('student-dossiers').getPublicUrl(filePath)
        fileUrl = urlData.publicUrl; fileName = uploadedFile.name
      }
    }

    const { error } = await supabase.from('contracts').insert({
      number: `ДГ-${nextNum}/${currentYear}`,
      date: contractDate,
      counterparty,
      subject,
      start_date: startDate || null,
      end_date: endDate || null,
      description: description || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      student_id: studentId || null,
      created_by: currentUserId,
    })

    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }
    resetForm(); setSaving(false); router.refresh()
  }

  function ExpiryBadge({ endDate }: { endDate: string }) {
    const days = daysUntil(endDate)
    if (days === null) return null
    if (days < 0) return <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Изтекъл</span>
    if (days < 30) return <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">→ {days} дни</span>
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-slate-500">Общо <span className="font-semibold text-slate-800">{totalCount}</span> договора</p>
        {canEdit && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md"
            style={{ backgroundColor: '#0f2240' }}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Затвори' : 'Нов договор'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Нов договор</h2>
            <button onClick={resetForm} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Дата на завеждане *</label>
                <input type="date" value={contractDate} onChange={e => setContractDate(e.target.value)} required className="input w-full" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Вид договор *</label>
                <select value={contractType} onChange={e => setContractType(e.target.value)} required className="input w-full">
                  {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Контрагент *</label>
              <input type="text" required value={counterparty} onChange={e => setCounterparty(e.target.value)}
                placeholder="Фирма / лице" className="input w-full" />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Предмет *</label>
              <textarea rows={2} required value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Кратко описание на договора..." className="input w-full resize-none" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Начална дата *</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="input w-full" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Срок (месеци) *</label>
                <input type="number" min="1" max="999" placeholder="напр. 12" value={durationMonths}
                  onChange={e => setDurationMonths(e.target.value)} required className="input w-full" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Крайна дата</label>
                <input readOnly value={endDate ? new Date(endDate).toLocaleDateString('bg-BG') : '—'}
                  className="input w-full bg-slate-50 cursor-not-allowed text-slate-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Стойност (лв.)</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={contractValue}
                  onChange={e => setContractValue(e.target.value)} className="input w-full" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Статус *</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="input w-full">
                  {CONTRACT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Вътрешен титуляр</label>
                <select value={internalOwner} onChange={e => setInternalOwner(e.target.value)} className="input w-full">
                  <option value="">Изберете...</option>
                  {INTERNAL_OWNERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Лице за контакт</label>
                <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)}
                  placeholder="Ime и длъжност" className="input w-full" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Телефон / Имейл</label>
              <input type="text" value={contactInfo} onChange={e => setContactInfo(e.target.value)}
                placeholder="0888 123 456 / email@firma.bg" className="input w-full" />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Бележки</label>
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
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: '#0f2240' }}>
                {saving && <Loader2 size={13} className="animate-spin" />}
                {saving ? 'Записване...' : 'Запази договора'}
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
            <input placeholder="Търсене по №, предмет, контрагент..." value={search}
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
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Контрагент</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Предмет</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Период</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Файл</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-16 text-center">
                  <FileSignature size={32} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-400 text-sm">Няма регистрирани договори</p>
                </td></tr>
              ) : contracts.map((item, idx) => {
                const days = daysUntil(item.end_date)
                const isExpiring = days !== null && days < 30
                return (
                  <tr key={item.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/30' : ''} ${isExpiring ? 'bg-amber-50/20' : ''}`}>
                    <td className="px-5 py-3"><span className="font-mono font-bold text-purple-700 text-xs">{item.number}</span></td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-800">{item.counterparty}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-slate-800 max-w-[180px] truncate">{item.subject}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {item.start_date && item.end_date
                          ? `${new Date(item.start_date).toLocaleDateString('bg-BG')} — ${new Date(item.end_date).toLocaleDateString('bg-BG')}`
                          : '—'}
                        {isExpiring && <ExpiryBadge endDate={item.end_date} />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.file_url ? (
                        <button type="button"
                          onClick={async (e) => {
                            e.stopPropagation()
                            const win = window.open('', '_blank')
                            const { data } = await supabase.storage.from('documents').createSignedUrl(item.file_url, 120)
                            if (data?.signedUrl && win) win.location.href = data.signedUrl
                            else if (win) win.close()
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0f2240] hover:underline">
                          <FileText size={12} />PDF
                        </button>
                      ) : <span className="text-slate-300 text-[10px]">—</span>}
                    </td>
                  </tr>
                )
              })}
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
    </div>
  )

}
