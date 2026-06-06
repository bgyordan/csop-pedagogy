'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Search, X, Upload, FileText, Loader2,
  ArrowDownLeft, ArrowUpRight, ArrowRightLeft, ChevronLeft, ChevronRight, Paperclip
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

  // Сървърни филтри
  const [search, setSearch] = useState(searchValue || '')
  
  // UI State
  const [isOpeningForm, setIsOpeningForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form State
  const [direction, setDirection] = useState<'incoming' | 'outgoing' | 'internal'>('incoming')
  const [fromWhom, setFromWhom] = useState('')
  const [toWhom, setToWhom] = useState('')
  const [subject, setSubject] = useState('')
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [studentId, setStudentId] = useState('')

  const totalPages = Math.ceil(totalCount / pageSize)
  const currentYear = new Date().getFullYear()

  // ------------------------------------------------------------------
  // Навигация и Филтриране (Сървърно)
  // ------------------------------------------------------------------
  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (directionValue && directionValue !== 'all') params.set('direction', directionValue)
    params.set('page', '1')
    router.push(`/correspondence?${params.toString()}`)
  }

  function handleDirectionFilter(d: string) {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (d !== 'all') params.set('direction', d)
    params.set('page', '1')
    router.push(`/correspondence?${params.toString()}`)
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (directionValue && directionValue !== 'all') params.set('direction', directionValue)
    params.set('page', String(newPage))
    router.push(`/correspondence?${params.toString()}`)
  }

  // ------------------------------------------------------------------
  // Обработка на формата
  // ------------------------------------------------------------------
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
    setIsOpeningForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject) return

    setSaving(true)

    // Динамично определяне на подател/получател спрямо посоката
    const finalFromWhom = direction === 'outgoing' ? 'ЦСОП Варна' : fromWhom
    const finalToWhom = direction === 'incoming' ? 'ЦСОП Варна' : toWhom

    // 1. Генерирай номер
    const { data: existing } = await supabase
      .from('correspondence')
      .select('id', { count: 'exact', head: true })
      .like('number', `%/${currentYear}`)
    
    const nextNum = (existing as any)?.length !== undefined 
      ? (existing as any).length + 1 
      : totalCount + 1
    
    const docNumber = `${nextNum}/${currentYear}`

    // 2. Upload файл
    let fileUrl = ''
    let fileName = ''
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop()
      const filePath = `correspondence/${currentYear}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('documents') // Ако нямаш такъв, върни 'student-dossiers'
        .upload(filePath, uploadedFile, { upsert: true })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)
        fileUrl = urlData.publicUrl
        fileName = uploadedFile.name
      }
    }

    // 3. Запис в базата
    const { error } = await supabase.from('correspondence').insert({
      number: docNumber,
      date: docDate,
      direction,
      from_whom: finalFromWhom,
      to_whom: finalToWhom,
      subject,
      description: description || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      student_id: studentId || null,
      created_by: currentUserId,
      status: 'active',
    })

    if (error) { 
      alert(`Грешка: ${error.message}`)
      setSaving(false)
      return 
    }
    
    resetForm()
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Филтри и Търсачка */}
      <div className="bg-white border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Всички' },
            { key: 'incoming', label: '↙ Входяща' },
            { key: 'outgoing', label: '↗ Изходяща' },
            { key: 'internal', label: '⇄ Вътрешна' },
          ].map(({ key, label }) => {
            const isActive = (directionValue || 'all') === key
            return (
              <button key={key} onClick={() => handleDirectionFilter(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isActive ? 'bg-[#0f2240] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}>
                {label}
              </button>
            )
          })}
        </div>

        <div className="flex gap-3 items-center w-full md:w-auto justify-end">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Търсене по тема/номер..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-xl text-xs focus:outline-none w-52 border-slate-200" />
            <button type="submit" className="hidden" />
          </form>

          {canEdit && (
            <button onClick={() => setIsOpeningForm(true)}
              className="bg-[#0f2240] hover:bg-slate-800 transition-colors text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              Нов документ
            </button>
          )}
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-semibold text-slate-700 min-w-[800px]">
            <thead className="bg-[#f0f7ff] text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
              <tr>
                <th className="p-4 pl-6">№</th>
                <th className="p-4">Вид</th>
                <th className="p-4">Дата</th>
                <th className="p-4">От кого</th>
                <th className="p-4">До кого</th>
                <th className="p-4 w-1/4">Относно</th>
                <th className="p-4">Ученик</th>
                <th className="p-4 text-right">Файл</th>
              </tr>
            </thead>
            <tbody className="divide-y font-medium text-slate-800">
              {correspondence.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Няма намерени документи в регистъра.
                  </td>
                </tr>
              ) : (
                correspondence.map((item) => {
                  const student = students.find(s => s.id === item.student_id)
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 pl-6">
                        <span className="font-mono font-bold text-[#0f2240]">№ {item.number}</span>
                      </td>
                      <td className="p-4">
                        {item.direction === 'incoming' && <span className="bg-amber-100 text-amber-800 text-[10px] px-2.5 py-0.5 rounded-md font-bold uppercase">Входящ</span>}
                        {item.direction === 'outgoing' && <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-0.5 rounded-md font-bold uppercase">Изходящ</span>}
                        {item.direction === 'internal' && <span className="bg-purple-100 text-purple-800 text-[10px] px-2.5 py-0.5 rounded-md font-bold uppercase">Вътрешен</span>}
                      </td>
                      <td className="p-4 text-slate-500 font-mono">{item.date}</td>
                      <td className="p-4 font-bold text-slate-700">{item.from_whom}</td>
                      <td className="p-4 text-slate-600">{item.to_whom}</td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{item.subject}</div>
                        {item.description && <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs line-clamp-1">{item.description}</p>}
                      </td>
                      <td className="p-4">
                        {student ? (
                          <span className="text-[10px] font-bold text-[#0f2240] bg-slate-100 px-2 py-1 rounded-md">
                            {student.first_name} {student.last_name}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {item.file_url ? (
                          <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#0f2240] hover:underline text-[10px] font-bold">
                            <Paperclip className="h-3.5 w-3.5" /> Преглед
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Пагинация (Сървърна) */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-100 text-xs font-semibold text-slate-500">
            <span>Показване на {((page - 1) * pageSize) + 1} до {Math.min(page * pageSize, totalCount)} от общо {totalCount} записа</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => handlePageChange(page - 1)}
                className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors">
                <ChevronLeft className="h-4 w-4 text-slate-700" />
              </button>
              <button disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}
                className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors">
                <ChevronRight className="h-4 w-4 text-slate-700" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Модал за Нов Документ */}
      {isOpeningForm && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <button onClick={resetForm} className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
              <X className="h-5 w-5" />
            </button>
            
            <h3 className="font-bold text-slate-800 text-sm uppercase mb-1">Деловодно Вписване</h3>
            <p className="text-[10px] text-slate-500 mb-5 font-semibold">
              Записът ще бъде генериран с текущата година ({currentYear})
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Посока (Вид) */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Вид документ *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'incoming', label: 'Входяща' },
                    { key: 'outgoing', label: 'Изходяща' },
                    { key: 'internal', label: 'Вътрешна' },
                  ].map(({ key, label }) => (
                    <button key={key} type="button"
                      onClick={() => setDirection(key as 'incoming' | 'outgoing' | 'internal')}
                      className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                        direction === key
                          ? key === 'incoming' ? 'bg-amber-100 border-amber-300 text-amber-800'
                          : key === 'outgoing' ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                          : 'bg-purple-100 border-purple-300 text-purple-800'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Дата */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Дата на документа *</label>
                <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20" required />
              </div>

              {/* Динамични полета: От кого / До кого */}
              <div className="grid grid-cols-1 gap-3">
                {direction !== 'outgoing' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">От кого (Подател) *</label>
                    <input type="text" list="from-suggestions" required placeholder="напр. РУО Варна"
                      value={fromWhom} onChange={(e) => setFromWhom(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20" />
                  </div>
                )}
                
                {direction !== 'incoming' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">До кого (Получател) *</label>
                    <input type="text" list="to-suggestions" required placeholder="напр. РЦПППО Варна"
                      value={toWhom} onChange={(e) => setToWhom(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20" />
                  </div>
                )}
                <datalist id="from-suggestions">{FROM_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
                <datalist id="to-suggestions">{FROM_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
              </div>

              {/* Тема */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Тема / Относно *</label>
                <input type="text" list="subject-suggestions" required placeholder="напр. Молба за записване"
                  value={subject} onChange={(e) => setSubject(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20" />
                <datalist id="subject-suggestions">{SUBJECT_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
              </div>

              {/* Описание */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Допълнителни бележки</label>
                <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Кратко описание..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20 resize-none" />
              </div>

              {/* Ученик */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Свързан ученик (опционално)</label>
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20">
                  <option value="">Няма връзка към ученик</option>
                  {students.sort((a, b) => a.last_name.localeCompare(b.last_name)).map(s => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                  ))}
                </select>
              </div>

              {/* Файл */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Прикачен документ (PDF/Word)</label>
                {uploadedFile ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <FileText className="h-5 w-5 text-slate-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">{uploadedFile.name}</div>
                      <div className="text-[10px] text-slate-400">{(uploadedFile.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button type="button" onClick={() => setUploadedFile(null)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#0f2240] hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Upload className="h-4 w-4" />
                      <span className="text-xs font-bold">Избери файл</span>
                    </div>
                    <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
                  </label>
                )}
              </div>

              <div className="flex gap-3 justify-end border-t border-slate-100 pt-4 mt-2">
                <button type="button" onClick={resetForm} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors">
                  Отказ
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 bg-[#0f2240] hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60 shadow-sm transition-all">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {saving ? 'Записване...' : 'Впиши в регистъра'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
