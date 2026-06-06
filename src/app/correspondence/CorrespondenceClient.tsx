'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Search, X, Upload, FileText, Loader2,
  ChevronLeft, ChevronRight, Paperclip, User, GraduationCap, FolderOpen,
  ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Download
} from 'lucide-react'

const OFFICIAL_NOMENCLATURES = [
  'АСД-01', 'АСД-02', 'АСД-03', 'АСД-04',
  'УД-01', 'УД-02', 'УД-03',
  'ЧР-01', 'ЧР-02', 'ЧР-05',
  'РД-01', 'РД-02', 'РД-08',
  'ФСД-01', 'ФСД-02'
]

const FROM_SUGGESTIONS = [
  'МОН — Министерство на образованието и науката',
  'РУО — Варна', 'Община Варна', 'РЦПППО — Варна', 'ЦСОП — Варна',
]

const SUBJECT_SUGGESTIONS = [
  'Докладна записка', 'Служебна бележка', 'Доклад', 
  'Уведомление', 'Медицинска документация', 'Оценка от РЦПППО',
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
  staff: { id: string; first_name: string; last_name: string }[]
}

export default function CorrespondenceClient({
  correspondence, totalCount, page, pageSize,
  searchValue, directionValue, canEdit, currentUserId, students, staff
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [search, setSearch] = useState(searchValue || '')
  
  const [isOpeningForm, setIsOpeningForm] = useState(false)
  const [viewItem, setViewItem] = useState<any | null>(null) // НОВО: State за преглед на документ
  const [saving, setSaving] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ФОРМА STATE
  const [direction, setDirection] = useState<'incoming' | 'outgoing' | 'internal'>('incoming')
  const [docType, setDocType] = useState<'standard' | 'staff_leave' | 'student_enroll' | 'student_coud'>('standard')
  
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0])
  const [folderIndex, setFolderIndex] = useState('АСД-02')
  const [folderNumber, setFolderNumber] = useState('')
  const [fromWhom, setFromWhom] = useState('')
  const [toWhom, setToWhom] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  
  const [studentId, setStudentId] = useState('')
  const [staffId, setStaffId] = useState('')

  const totalPages = Math.ceil(totalCount / pageSize)
  const currentYear = new Date().getFullYear()

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
  }

  function changeDirectionTab(newDir: 'incoming' | 'outgoing' | 'internal') {
    setDirection(newDir)
    setDocType('standard')
    setStaffId('')
    setStudentId('')
  }

  function resetForm() {
    setDirection('incoming')
    setDocType('standard')
    setFolderIndex('АСД-02')
    setFolderNumber('')
    setFromWhom('')
    setToWhom('')
    setSubject('')
    setDocDate(new Date().toISOString().split('T')[0])
    setDescription('')
    setStudentId('')
    setStaffId('')
    setUploadedFile(null)
    setIsOpeningForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const selectedStaff = staff.find(s => s.id === staffId)
    const selectedStudent = students.find(s => s.id === studentId)

    let finalSubject = subject
    let finalFrom = fromWhom
    let finalTo = toWhom
    let requestType = 'none'

    if (direction === 'internal' && docType === 'staff_leave' && selectedStaff) {
      finalSubject = `Заявление за отпуск на ${selectedStaff.first_name} ${selectedStaff.last_name}`
      finalFrom = `${selectedStaff.first_name} ${selectedStaff.last_name}`
      finalTo = 'Директор ЦСОП Варна'
    } else if (direction === 'incoming' && (docType === 'student_enroll' || docType === 'student_coud') && selectedStudent) {
      requestType = docType === 'student_enroll' ? 'enrollment' : 'coud'
      const reqLabel = requestType === 'coud' ? 'ЦОУД' : 'записване'
      finalSubject = `Заявление за ${reqLabel} на ${selectedStudent.first_name} ${selectedStudent.last_name}`
      finalTo = 'Директор ЦСОП Варна'
    } else {
      if (direction === 'outgoing') finalFrom = 'ЦСОП Варна'
      if (direction === 'incoming') finalTo = 'ЦСОП Варна'
      if (direction === 'internal' && !finalTo) finalTo = 'ЦСОП Варна'
    }

    if (!finalSubject) {
      alert("Моля, попълнете темата/относно.");
      setSaving(false); return;
    }

    const startOfYear = `${currentYear}-01-01`
    const endOfYear = `${currentYear}-12-31`
    const { count } = await supabase
      .from('correspondence')
      .select('id', { count: 'exact', head: true })
      .gte('date', startOfYear)
      .lte('date', endOfYear)

    const nextNum = (count || 0) + 1
    const paddedNum = String(nextNum).padStart(3, '0')
    const formattedDate = docDate.split('-').reverse().join('.')
    
    const docNumber = `${folderIndex}-${paddedNum}/${formattedDate}г.`

    let fileUrl = ''
    let fileName = ''
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop()
      const filePath = `correspondence/${currentYear}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, uploadedFile, { upsert: true })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)
        fileUrl = urlData.publicUrl
        fileName = uploadedFile.name
      }
    }

    const { error } = await supabase.from('correspondence').insert({
      number: docNumber,
      date: docDate,
      direction,
      from_whom: finalFrom,
      to_whom: finalTo,
      subject: finalSubject,
      description: description || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      student_id: studentId || null,
      staff_id: staffId || null,
      request_type: requestType !== 'none' ? requestType : null,
      folder_index: folderIndex || null,
      folder_number: folderNumber ? parseInt(folderNumber) : null,
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
            { key: 'incoming', label: '↙ Входящи' },
            { key: 'outgoing', label: '↗ Изходящи' },
            { key: 'internal', label: '⇄ Вътрешни' },
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
              Нов запис
            </button>
          )}
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-semibold text-slate-700 min-w-[900px]">
            <thead className="bg-[#f0f7ff] text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
              <tr>
                <th className="p-4 pl-6">Рег. Индекс</th>
                <th className="p-4">Дело/№</th>
                <th className="p-4">От/До</th>
                <th className="p-4 w-1/3">Относно (Тема)</th>
                <th className="p-4">Свързано лице</th>
                <th className="p-4 text-right">Файл</th>
              </tr>
            </thead>
            <tbody className="divide-y font-medium text-slate-800">
              {correspondence.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">Няма намерени документи.</td>
                </tr>
              ) : (
                correspondence.map((item) => {
                  const student = students.find(s => s.id === item.student_id)
                  const staffMember = staff?.find(s => s.id === item.staff_id)
                  
                  return (
                    <tr key={item.id} onClick={() => setViewItem({ ...item, student, staffMember })} 
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer">
                      <td className="p-4 pl-6">
                        <span className="font-mono font-bold text-[#0f2240] block">{item.number}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">{item.date}</span>
                      </td>
                      <td className="p-4">
                        {item.folder_index ? (
                          <div>
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border block w-max">{item.folder_index}</span>
                            {item.folder_number && <span className="text-[10px] text-slate-400 mt-1 block">№ {item.folder_number}</span>}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="p-4 text-[11px] leading-tight text-slate-600">
                        {item.direction === 'incoming' && <div><span className="text-amber-600 font-bold">От:</span> {item.from_whom}</div>}
                        {item.direction === 'outgoing' && <div><span className="text-emerald-600 font-bold">До:</span> {item.to_whom}</div>}
                        {item.direction === 'internal' && <div><span className="text-purple-600 font-bold">Вътр:</span> {item.from_whom}</div>}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          {item.request_type === 'enrollment' && <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 rounded">ЗАПИСВАНЕ</span>}
                          {item.request_type === 'coud' && <span className="bg-orange-100 text-orange-700 text-[9px] px-1.5 rounded">ЦОУД</span>}
                          {item.subject}
                        </div>
                        {item.description && <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs line-clamp-1">{item.description}</p>}
                      </td>
                      <td className="p-4">
                        {student && (
                          <span className="text-[10px] font-bold text-[#0f2240] bg-blue-50 border border-blue-100 px-2 py-1 rounded-md flex items-center gap-1 w-max">
                            <GraduationCap className="w-3 h-3"/> {student.first_name} {student.last_name}
                          </span>
                        )}
                        {staffMember && (
                          <span className="text-[10px] font-bold text-[#0f2240] bg-purple-50 border border-purple-100 px-2 py-1 rounded-md flex items-center gap-1 w-max mt-1">
                            <User className="w-3 h-3"/> {staffMember.first_name} {staffMember.last_name}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation() /* Предотвратява отварянето на модала, ако кликне директно на файла */}>
                        {item.file_url ? (
                          <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#0f2240] hover:underline text-[10px] font-bold bg-slate-100 px-2 py-1 rounded">
                            <Paperclip className="h-3.5 w-3.5" /> Файл
                          </a>
                        ) : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-100 text-xs font-semibold text-slate-500">
            <span>Показване на {((page - 1) * pageSize) + 1} до {Math.min(page * pageSize, totalCount)}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => handlePageChange(page - 1)} className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <button disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)} className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* МОДАЛ: Преглед на Документ */}
      {viewItem && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setViewItem(null)} className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X className="h-5 w-5" /></button>
            
            <h3 className="font-bold text-slate-800 text-sm uppercase mb-4 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-[#0f2240]" /> Детайли за документ
            </h3>

            <div className="space-y-6">
              {/* Header Info */}
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <div className="text-xl font-mono font-bold text-[#0f2240]">{viewItem.number}</div>
                  <div className="text-sm font-semibold text-slate-500 mt-1">Регистриран на: {viewItem.date}</div>
                </div>
                <div className="text-right">
                  {viewItem.direction === 'incoming' && <span className="bg-amber-100 text-amber-800 text-xs px-3 py-1 rounded-md font-bold uppercase">Входящ</span>}
                  {viewItem.direction === 'outgoing' && <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-md font-bold uppercase">Изходящ</span>}
                  {viewItem.direction === 'internal' && <span className="bg-purple-100 text-purple-800 text-xs px-3 py-1 rounded-md font-bold uppercase">Вътрешен</span>}
                </div>
              </div>

              {/* Grid Info */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">От кого (Подател)</div>
                  <div className="text-sm font-bold text-slate-800">{viewItem.from_whom || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">До кого (Получател)</div>
                  <div className="text-sm font-bold text-slate-800">{viewItem.to_whom || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Дело / Папка</div>
                  <div className="text-sm font-bold text-slate-800">
                    {viewItem.folder_index || '—'} {viewItem.folder_number ? `(№ ${viewItem.folder_number})` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Свързано лице</div>
                  {viewItem.student ? (
                    <div className="text-sm font-bold text-[#0f2240] flex items-center gap-1"><GraduationCap className="w-4 h-4" /> {viewItem.student.first_name} {viewItem.student.last_name}</div>
                  ) : viewItem.staffMember ? (
                    <div className="text-sm font-bold text-[#0f2240] flex items-center gap-1"><User className="w-4 h-4" /> {viewItem.staffMember.first_name} {viewItem.staffMember.last_name}</div>
                  ) : (
                    <div className="text-sm font-bold text-slate-400">—</div>
                  )}
                </div>
              </div>

              {/* Subject & Description */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Тема / Относно</div>
                <div className="text-sm font-bold text-slate-800 mb-4">{viewItem.subject}</div>
                
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Описание / Бележки</div>
                <div className="text-xs text-slate-600 whitespace-pre-wrap">{viewItem.description || 'Няма въведени допълнителни бележки.'}</div>
              </div>

              {/* File Button */}
              {viewItem.file_url ? (
                <div className="pt-2">
                  <a href={viewItem.file_url} target="_blank" rel="noopener noreferrer" 
                     className="w-full flex items-center justify-center gap-2 bg-[#0f2240] hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all shadow-md">
                    <Download className="w-5 h-5" /> Изтегли / Отвори файла
                  </a>
                </div>
              ) : (
                <div className="pt-2">
                  <div className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-400 font-bold py-3 rounded-xl border border-slate-200">
                    <FileText className="w-5 h-5" /> Няма прикачен файл
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛ: Нов Документ */}
      {isOpeningForm && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={resetForm} className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X className="h-5 w-5" /></button>
            
            <h3 className="font-bold text-slate-800 text-sm uppercase mb-4 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-[#0f2240]" /> Деловодно Вписване
            </h3>

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* 1. ГЛАВНИ ТАБОВЕ ЗА ПОСОКА */}
              <div className="flex gap-2 p-1.5 bg-slate-100 rounded-xl">
                <button type="button" onClick={() => changeDirectionTab('incoming')} 
                  className={`flex-1 text-xs font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${direction === 'incoming' ? 'bg-amber-100 shadow-sm text-amber-800 border border-amber-200' : 'text-slate-500 hover:text-slate-700'}`}>
                  <ArrowDownLeft className="w-4 h-4"/> Входящ
                </button>
                <button type="button" onClick={() => changeDirectionTab('outgoing')} 
                  className={`flex-1 text-xs font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${direction === 'outgoing' ? 'bg-emerald-100 shadow-sm text-emerald-800 border border-emerald-200' : 'text-slate-500 hover:text-slate-700'}`}>
                  <ArrowUpRight className="w-4 h-4"/> Изходящ
                </button>
                <button type="button" onClick={() => changeDirectionTab('internal')} 
                  className={`flex-1 text-xs font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${direction === 'internal' ? 'bg-purple-100 shadow-sm text-purple-800 border border-purple-200' : 'text-slate-500 hover:text-slate-700'}`}>
                  <ArrowRightLeft className="w-4 h-4"/> Вътрешен
                </button>
              </div>

              {/* 2. ПОД-ОПЦИИ (ВИД ДОКУМЕНТ) СПРЯМО ИЗБРАНИЯ ТАБ */}
              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                <label className="block text-[10px] font-bold text-[#0f2240] mb-1.5 uppercase">Опции за документа</label>
                
                {direction === 'incoming' && (
                  <select value={docType} onChange={(e) => setDocType(e.target.value as any)} className="w-full border border-blue-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700 bg-white cursor-pointer">
                    <option value="standard">Обикновен входящ документ</option>
                    <option value="student_enroll">Заявление за записване на ученик</option>
                    <option value="student_coud">Заявление за ЦОУД</option>
                  </select>
                )}

                {direction === 'internal' && (
                  <select value={docType} onChange={(e) => setDocType(e.target.value as any)} className="w-full border border-blue-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700 bg-white cursor-pointer">
                    <option value="standard">Обикновен вътрешен документ</option>
                    <option value="staff_leave">Заявление за отпуск (от персонал)</option>
                  </select>
                )}

                {direction === 'outgoing' && (
                  <select disabled className="w-full border border-blue-200 rounded-xl p-2.5 text-xs outline-none font-semibold text-slate-500 bg-slate-100 opacity-70">
                    <option value="standard">Обикновен изходящ документ</option>
                  </select>
                )}
              </div>

              {/* 3. ОБЩИ ДАННИ (ДАТА И НОМЕНКЛАТУРА) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Дата *</label>
                  <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#0f2240]/20 outline-none cursor-pointer" required />
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Папка/Индекс *</label>
                  <select value={folderIndex} onChange={(e) => setFolderIndex(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#0f2240]/20 outline-none bg-white font-bold text-[#0f2240] cursor-pointer" required>
                    {OFFICIAL_NOMENCLATURES.map(nom => <option key={nom} value={nom}>{nom}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">№ в папка</label>
                  <input type="number" value={folderNumber} onChange={(e) => setFolderNumber(e.target.value)} placeholder="напр. 23" className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#0f2240]/20 outline-none" />
                </div>
              </div>

              {/* 4. ДИНАМИЧНИ ПОЛЕТА СПРЯМО ВИДА */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                
                {/* 4A. СТАНДАРТЕН ДОКУМЕНТ */}
                {docType === 'standard' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {direction !== 'outgoing' && (
                        <div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">От кого *</label><input type="text" value={fromWhom} onChange={(e) => setFromWhom(e.target.value)} list="from-list" className="w-full border border-slate-200 rounded-xl p-2 text-xs outline-none" required placeholder="Подател..." /></div>
                      )}
                      {direction !== 'incoming' && (
                        <div><label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">До кого *</label><input type="text" value={toWhom} onChange={(e) => setToWhom(e.target.value)} list="to-list" className="w-full border border-slate-200 rounded-xl p-2 text-xs outline-none" required placeholder="Получател..." /></div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Тема / Относно *</label>
                      <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} list="subj-list" className="w-full border border-slate-200 rounded-xl p-2 text-xs outline-none" required placeholder="Кратко описание..." />
                    </div>
                  </>
                )}

                {/* 4B. ЗАЯВЛЕНИЕ ЗА ОТПУСК (ПЕРСОНАЛ) */}
                {docType === 'staff_leave' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-purple-600 mb-1.5 uppercase flex items-center gap-1"><User className="w-3 h-3"/> Избери служител (Подател) *</label>
                      <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-full border border-purple-200 bg-white rounded-xl p-2.5 text-xs outline-none focus:border-purple-500 font-bold cursor-pointer" required>
                        <option value="">-- Избери колега --</option>
                        {staff?.sort((a,b) => a.first_name.localeCompare(b.first_name)).map(s => (
                          <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-[11px] text-purple-800 font-medium">
                      Темата и подателят ще бъдат попълнени автоматично като "Заявление за отпуск на...". Получател е Директорът.
                    </div>
                  </div>
                )}

                {/* 4C. УЧЕНИЧЕСКО ЗАЯВЛЕНИЕ (ЦОУД/ЗАПИСВАНЕ) */}
                {(docType === 'student_enroll' || docType === 'student_coud') && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-blue-600 mb-1.5 uppercase flex items-center gap-1"><GraduationCap className="w-3 h-3"/> За кой ученик се отнася? *</label>
                      <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full border border-blue-200 bg-white rounded-xl p-2.5 text-xs outline-none focus:border-blue-500 font-bold cursor-pointer" required>
                        <option value="">-- Избери ученик --</option>
                        {students.sort((a,b) => a.last_name.localeCompare(b.last_name)).map(s => (
                          <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">От кого (Име на родител/настойник) *</label>
                      <input type="text" value={fromWhom} onChange={(e) => setFromWhom(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2 text-xs outline-none" required placeholder="Трите имена на родителя..." />
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-800 font-medium">
                      Темата ще се генерира автоматично ("Заявление за {docType === 'student_coud' ? 'ЦОУД' : 'записване'}..."). Получател е Директорът.
                    </div>
                  </div>
                )}

                {/* ОПИСАНИЕ (Общо за всички) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Допълнителни бележки</label>
                  <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Полезна информация..." className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-[#0f2240]/20 resize-none" />
                </div>
              </div>

              <datalist id="from-list">{FROM_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
              <datalist id="to-list">{FROM_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
              <datalist id="subj-list">{SUBJECT_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>

              {/* 5. КРАСИВ БУТОН ЗА ПРИКАЧВАНЕ НА ФАЙЛ */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Прикачен документ</label>
                {uploadedFile ? (
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-300">
                    <FileText className="h-6 w-6 text-[#0f2240]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{uploadedFile.name}</div>
                      <div className="text-xs text-slate-500">{(uploadedFile.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button type="button" onClick={() => setUploadedFile(null)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input type="file" id="file-upload" accept=".pdf,.doc,.docx" onChange={handleFileChange} className="hidden" />
                    <label htmlFor="file-upload" className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-slate-300 rounded-xl p-6 cursor-pointer hover:bg-slate-50 hover:border-[#0f2240] transition-colors group">
                      <Upload className="h-6 w-6 text-slate-400 group-hover:text-[#0f2240] transition-colors" />
                      <span className="text-xs font-bold text-slate-600 group-hover:text-[#0f2240]">ПРИКАЧИ ФАЙЛ (PDF / Word)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* 6. БУТОНИ */}
              <div className="flex gap-3 justify-end border-t border-slate-100 pt-4">
                <button type="button" onClick={resetForm} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">Отказ</button>
                <button type="submit" disabled={saving} className="px-6 py-2.5 bg-[#0f2240] hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60 shadow-md">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Вписване...' : 'Регистрирай документа'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
