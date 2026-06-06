'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Search, X, Upload, FileText, Loader2,
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ChevronLeft, ChevronRight
} from 'lucide-react'

const FROM_SUGGESTIONS = [
  'МОН — Министерство на образованието и науката',
  'РУО — Варна',
  'Община Варна',
  'Агенция за социално подпомагане',
  'РЗОК — Варна',
  'РЦПППО — Варна',
  'Национален осигурителен институт (НОИ)',
  'Инспекторат по образованието',
  'Дирекция "Социално подпомагане"',
  'ЦСОП — Варна',
  'Светлана Иванова — Директор',
  'Йордан Йорданов — ЗДАСД',
  'Силвия Кьошкерян — ЗДУД',
]

const SUBJECT_SUGGESTIONS = [
  'Докладна записка',
  'Заявление за отпуск',
  'Протокол от ЕПЛР',
  'Служебна бележка',
  'Доклад',
  'Уведомление',
  'Покана',
  'Молба за записване',
  'Заповед за насочване',
  'Медицинска документация',
  'Оценка от РЦПППО',
  'Становище',
  'Информация',
]

interface Props {
  correspondence: any[]
  totalCount: number
  page: number
  pageSize: number
  searchValue: string
  directionValue: string
  canEdit: boolean
  currentUserId: string
  students: { id: string; first_name: string; last_name: string }[]
}

export default function CorrespondenceClient({
  correspondence, totalCount, page, pageSize,
  searchValue, directionValue, canEdit, currentUserId, students
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [search, setSearch] = useState(searchValue)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [direction, setDirection] = useState<'incoming' | 'outgoing' | 'internal'>('incoming')
  const [fromWhom, setFromWhom] = useState('')
  const [toWhom, setToWhom] = useState('')
  const [subject, setSubject] = useState('')
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [studentId, setStudentId] = useState('')

  const totalPages = Math.ceil(totalCount / pageSize)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (directionValue) params.set('direction', directionValue)
    params.set('page', '1')
    router.push(`/correspondence?${params.toString()}`)
  }

  function handleDirectionFilter(d: string) {
    const params = new URLSearchParams()
    if (searchValue) params.set('q', searchValue)
    if (d) params.set('direction', d)
    params.set('page', '1')
    router.push(`/correspondence?${params.toString()}`)
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams()
    if (searchValue) params.set('q', searchValue)
    if (directionValue) params.set('direction', directionValue)
    params.set('page', String(newPage))
    router.push(`/correspondence?${params.toString()}`)
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
    setDirection('incoming')
    setFromWhom('')
    setToWhom('')
    setSubject('')
    setDocDate(new Date().toISOString().split('T')[0])
    setDescription('')
    setStudentId('')
    setUploadedFile(null)
    setShowForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject || !fromWhom) return
    setSaving(true)

    // Генерирай номер
    const currentYear = new Date().getFullYear()
    const { data: existing } = await supabase
      .from('correspondence')
      .select('id', { count: 'exact', head: true })
      .like('number', `%/${currentYear}`)
    const nextNum = (existing as any)?.length !== undefined
      ? (existing as any).length + 1
      : totalCount + 1

    // Upload файл
    let fileUrl = ''
    let fileName = ''
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop()
      const filePath = `correspondence/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('student-dossiers')
        .upload(filePath, uploadedFile, { upsert: true })
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('student-dossiers')
          .getPublicUrl(filePath)
        fileUrl = urlData.publicUrl
        fileName = uploadedFile.name
      }
    }

    const { error } = await supabase.from('correspondence').insert({
      number: `${nextNum}/${currentYear}`,
      date: docDate,
      direction,
      from_whom: fromWhom,
      to_whom: toWhom || 'ЦСОП Варна',
      subject,
      description: description || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      student_id: studentId || null,
      created_by: currentUserId,
      status: 'active',
    })

    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }
    resetForm()
    setSaving(false)
    router.refresh()
  }

  const directionConfig = {
    incoming: { label: 'Входящ', badge: 'bg-blue-100 text-blue-800', icon: <ArrowDownLeft size={10} /> },
    outgoing: { label: 'Изходящ', badge: 'bg-emerald-100 text-emerald-800', icon: <ArrowUpRight size={10} /> },
    internal: { label: 'Вътрешен', badge: 'bg-amber-100 text-amber-800', icon: <ArrowLeftRight size={10} /> },
  }

  return (
    <div className="space-y-6">
      {/* Хедър */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Общо <span className="font-semibold text-slate-800">{totalCount}</span> документа
        </p>
        {canEdit && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all"
            style={{ backgroundColor: '#0f2240' }}>
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Затвори' : 'Нов документ'}
          </button>
        )}
      </div>

      {/* Форма */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Регистрация на нов документ</h2>
            <button onClick={resetForm} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Посока */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Посока *</label>
              <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1">
                {(['incoming', 'outgoing', 'internal'] as const).map(d => (
                  <button key={d} type="button" onClick={() => setDirection(d)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      direction === d
                        ? d === 'incoming' ? 'bg-white text-blue-700 shadow-sm'
                        : d === 'outgoing' ? 'bg-white text-emerald-700 shadow-sm'
                        : 'bg-white text-amber-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {d === 'incoming' ? <ArrowDownLeft size={14} /> : d === 'outgoing' ? <ArrowUpRight size={14} /> : <ArrowLeftRight size={14} />}
                    {d === 'incoming' ? 'Входящ' : d === 'outgoing' ? 'Изходящ' : 'Вътрешен'}
                  </button>
                ))}
              </div>
            </div>

            {/* Дата */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Дата *</label>
              <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} required
                className="input w-48" />
            </div>

            {/* От / До */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">От кого *</label>
                <input type="text" list="from-list" required value={fromWhom}
                  onChange={e => setFromWhom(e.target.value)}
                  placeholder="напр. РУО Варна"
                  className="input w-full" />
                <datalist id="from-list">
                  {FROM_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">До кого</label>
                <input type="text" list="to-list" value={toWhom}
                  onChange={e => setToWhom(e.target.value)}
                  placeholder="напр. Директор ЦСОП"
                  className="input w-full" />
                <datalist id="to-list">
                  {FROM_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>

            {/* Относно */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Относно *</label>
              <input type="text" list="subject-list" required value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="напр. Молба за записване"
                className="input w-full" />
              <datalist id="subject-list">
                {SUBJECT_SUGGESTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

            {/* Описание */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Бележки</label>
              <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Допълнителна информация..."
                className="input w-full resize-none" />
            </div>

            {/* Ученик */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Свързан ученик (опционално)</label>
              <select value={studentId} onChange={e => setStudentId(e.target.value)} className="input w-full">
                <option value="">Няма връзка към ученик</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
                ))}
              </select>
            </div>

            {/* Файл */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Прикачен документ (PDF/Word, макс. 10MB)</label>
              {uploadedFile ? (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <FileText className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">{uploadedFile.name}</div>
                    <div className="text-[10px] text-slate-400">{(uploadedFile.size / 1024).toFixed(0)} KB</div>
                  </div>
                  <button type="button" onClick={() => setUploadedFile(null)} className="text-slate-400 hover:text-red-500 p-1">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-full h-14 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Upload size={16} />
                    <span className="text-xs font-semibold">Избери файл</span>
                  </div>
                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
                </label>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
              <button type="button" onClick={resetForm}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">
                Отказ
              </button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: '#0f2240' }}>
                {saving && <Loader2 size={13} className="animate-spin" />}
                {saving ? 'Записване...' : 'Впиши в регистъра'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Филтри */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input placeholder="Търсене по №, от/до, относно..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-9 w-72" />
            </div>
            <button type="submit" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700">
              Търси
            </button>
          </form>

          <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-0.5">
            {[
              { key: '', label: 'Всички' },
              { key: 'incoming', label: 'Входящи', icon: <ArrowDownLeft size={12} /> },
              { key: 'outgoing', label: 'Изходящи', icon: <ArrowUpRight size={12} /> },
              { key: 'internal', label: 'Вътрешни', icon: <ArrowLeftRight size={12} /> },
            ].map(({ key, label, icon }) => (
              <button key={key} onClick={() => handleDirectionFilter(key)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  directionValue === key
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}>
                {icon}{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">№</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Вид</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Дата</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">От кого</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">До кого</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Относно</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ученик</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Файл</th>
              </tr>
            </thead>
            <tbody>
              {correspondence.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-slate-400 text-sm">
                    Няма намерени документи
                  </td>
                </tr>
              ) : correspondence.map((item, idx) => {
                const cfg = directionConfig[item.direction as keyof typeof directionConfig] || directionConfig.incoming
                const student = item.student
                return (
                  <tr key={item.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      <span className="font-mono font-bold text-[#0f2240] text-xs">№ {item.number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${cfg.badge}`}>
                        {cfg.icon}{cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 max-w-[150px] truncate">{item.from_whom || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[150px] truncate">{item.to_whom || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-slate-800 max-w-[200px] truncate">{item.subject}</div>
                      {item.description && <div className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate">{item.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {student ? (
                        <span className="text-[10px] font-bold text-[#0f2240]">
                          {student.last_name} {student.first_name}
                        </span>
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
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">
            Страница <span className="font-semibold text-slate-700">{page}</span> от <span className="font-semibold text-slate-700">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => handlePageChange(page - 1)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft size={14} /> Назад
            </button>
            <button disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
              Напред <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
