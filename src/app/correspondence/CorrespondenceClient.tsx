'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Search, X, Upload, FileText, Loader2,
  ChevronLeft, ChevronRight, Paperclip, User, GraduationCap, FolderOpen,
  ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Download, Inbox, Send
} from 'lucide-react'

// Номенклатура на делата — одобрена от Държавен архив Варна
// 9 раздела, 101 дела
const NOMENCLATURE: { section: string; code: string; name: string }[] = [
  // РД — Ръководна дейност
  { section: 'РД', code: 'РД-01', name: 'Устройствен правилник' },
  { section: 'РД', code: 'РД-02', name: 'Правилник за вътрешния трудов ред' },
  { section: 'РД', code: 'РД-03', name: 'Длъжностно разписание' },
  { section: 'РД', code: 'РД-04', name: 'Годишен план' },
  { section: 'РД', code: 'РД-05', name: 'Отчети за дейността' },
  { section: 'РД', code: 'РД-06', name: 'Наредби по вътрешен ред' },
  { section: 'РД', code: 'РД-07', name: 'Книга за регистриране на заповеди' },
  { section: 'РД', code: 'РД-08', name: 'Класьор заповеди на директора' },
  { section: 'РД', code: 'РД-09', name: 'Трудови договори и заповеди' },
  { section: 'РД', code: 'РД-10', name: 'Протоколи от педагогически съвет' },
  { section: 'РД', code: 'РД-11', name: 'Кореспонденция с МОН' },
  { section: 'РД', code: 'РД-12', name: 'Кореспонденция с РУО' },
  // УН — Учебна и научна дейност
  { section: 'УН', code: 'УН-01', name: 'Учебни планове и програми' },
  { section: 'УН', code: 'УН-02', name: 'Разписание на учебните часове' },
  { section: 'УН', code: 'УН-03', name: 'Дневници на паралелките' },
  { section: 'УН', code: 'УН-04', name: 'Протоколи от изпити' },
  { section: 'УН', code: 'УН-05', name: 'Ученически книжки' },
  // УВД — Учебно-възпитателна дейност
  { section: 'УВД', code: 'УВД-01', name: 'Характеристики на учениците' },
  { section: 'УВД', code: 'УВД-02', name: 'Книга за подлежащите на обучение' },
  { section: 'УВД', code: 'УВД-03', name: 'Документи за записване' },
  { section: 'УВД', code: 'УВД-04', name: 'Заявления за записване' },
  { section: 'УВД', code: 'УВД-05', name: 'Заявления за ЦОУД' },
  { section: 'УВД', code: 'УВД-06', name: 'Заповеди за насочване' },
  { section: 'УВД', code: 'УВД-07', name: 'Оценки от РЦПППО' },
  { section: 'УВД', code: 'УВД-08', name: 'Медицинска документация' },
  { section: 'УВД', code: 'УВД-09', name: 'Социален доклад' },
  { section: 'УВД', code: 'УВД-10', name: 'План за контролната дейност' },
  { section: 'УВД', code: 'УВД-11', name: 'Доклади от проверки' },
  { section: 'УВД', code: 'УВД-20', name: 'ЕПЛР документация' },
  { section: 'УВД', code: 'УВД-21', name: 'Протоколи от ЕПЛР' },
  { section: 'УВД', code: 'УВД-22', name: 'Заповеди за определяне на ЕПЛР' },
  { section: 'УВД', code: 'УВД-23', name: 'Заповеди за утвърждаване на ИУП' },
  { section: 'УВД', code: 'УВД-24', name: 'Индивидуални учебни планове' },
  { section: 'УВД', code: 'УВД-25', name: 'Програми за допълнителна подкрепа' },
  // ФСД — Финансово-стопанска дейност
  { section: 'ФСД', code: 'ФСД-01', name: 'Указания по финансови въпроси' },
  { section: 'ФСД', code: 'ФСД-02', name: 'Бюджет и финансови отчети' },
  { section: 'ФСД', code: 'ФСД-03', name: 'Договори за доставки' },
  { section: 'ФСД', code: 'ФСД-04', name: 'Фактури и платежни документи' },
  { section: 'ФСД', code: 'ФСД-05', name: 'Инвентарни книги' },
  // ЛС — Личен състав
  { section: 'ЛС', code: 'ЛС-01', name: 'Лични досиета на служителите' },
  { section: 'ЛС', code: 'ЛС-02', name: 'Трудови договори' },
  { section: 'ЛС', code: 'ЛС-03', name: 'Заповеди за назначаване/освобождаване' },
  { section: 'ЛС', code: 'ЛС-04', name: 'Заповеди за отпуски' },
  { section: 'ЛС', code: 'ЛС-05', name: 'Длъжностни характеристики' },
  { section: 'ЛС', code: 'ЛС-06', name: 'Заявления на служители' },
  // АСД — Административно-стопанска дейност
  { section: 'АСД', code: 'АСД-01', name: 'Входяща кореспонденция' },
  { section: 'АСД', code: 'АСД-02', name: 'Изходяща кореспонденция' },
  { section: 'АСД', code: 'АСД-03', name: 'Вътрешна кореспонденция' },
  { section: 'АСД', code: 'АСД-04', name: 'Жалби и сигнали' },
  { section: 'АСД', code: 'АСД-05', name: 'Протоколи от комисии' },
  // БУТ — Безопасност и условия на труд
  { section: 'БУТ', code: 'БУТ-01', name: 'Правилник за охрана на труда' },
  { section: 'БУТ', code: 'БУТ-02', name: 'Инструктажни книги' },
  { section: 'БУТ', code: 'БУТ-03', name: 'Протоколи от проверки по БУТ' },
  { section: 'БУТ', code: 'БУТ-04', name: 'План за евакуация' },
  // ОД — Обществени дейности
  { section: 'ОД', code: 'ОД-01', name: 'Протоколи от обществен съвет' },
  { section: 'ОД', code: 'ОД-02', name: 'Кореспонденция с родители' },
  { section: 'ОД', code: 'ОД-03', name: 'Проекти и програми' },
  // ЗК — Здравна комисия
  { section: 'ЗК', code: 'ЗК-01', name: 'Медицински досиета' },
  { section: 'ЗК', code: 'ЗК-02', name: 'Протоколи от здравна комисия' },
]

const QUICK_NOM_CODES = ['АСД-01', 'АСД-02', 'АСД-03', 'УВД-04', 'УВД-07', 'УВД-08', 'ЛС-06', 'РД-08']

const EXTERNAL_SUGGESTIONS = [
  'МОН — Министерство на образованието и науката',
  'РУО — Варна',
  'Община Варна',
  'РЦПППО — Варна',
  'Агенция за социално подпомагане',
  'РЗОК — Варна',
  'НОИ — Варна',
  'Дирекция "Социално подпомагане"',
  'Инспекторат по образованието',
]

const INTERNAL_PERSONS = [
  'Светлана Иванова — Директор',
  'Йордан Йорданов — ЗДАСД',
  'Силвия Кьошкерян — ЗДУД',
  'Радка Георгиева — Счетоводство',
]

const DOC_TYPES = {
  incoming: [
    { value: 'standard', label: 'Обикновен входящ документ' },
    { value: 'student_enroll', label: 'Заявление за записване на ученик' },
    { value: 'student_coud', label: 'Заявление за ЦОУД' },
    { value: 'staff_leave', label: 'Молба за отпуск от служител' },
  ],
  outgoing: [
    { value: 'standard', label: 'Обикновен изходящ документ' },
  ],
  internal: [
    { value: 'standard', label: 'Обикновен вътрешен документ' },
    { value: 'staff_leave', label: 'Молба за отпуск от служител' },
  ],
}

const DIRECTION_CONFIG = {
  incoming: {
    label: 'Входящ',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <ArrowDownLeft size={10} />,
    tabActive: 'bg-blue-100 text-blue-800 border border-blue-200',
    row: 'border-l-2 border-l-blue-300',
  },
  outgoing: {
    label: 'Изходящ',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: <ArrowUpRight size={10} />,
    tabActive: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    row: 'border-l-2 border-l-emerald-300',
  },
  internal: {
    label: 'Вътрешен',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: <ArrowRightLeft size={10} />,
    tabActive: 'bg-purple-100 text-purple-800 border border-purple-200',
    row: 'border-l-2 border-l-purple-300',
  },
}

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
  staff?: { id: string; first_name: string; last_name: string }[]
}

export default function CorrespondenceClient({
  correspondence, totalCount, page, pageSize,
  searchValue, directionValue, canEdit, currentUserId, students, staff = []
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [search, setSearch] = useState(searchValue || '')
  const [isOpeningForm, setIsOpeningForm] = useState(false)
  const [viewItem, setViewItem] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [nomSearch, setNomSearch] = useState('')
  const [showAllNom, setShowAllNom] = useState(false)

  const [direction, setDirection] = useState<'incoming' | 'outgoing' | 'internal'>('incoming')
  const [docType, setDocType] = useState<'standard' | 'staff_leave' | 'student_enroll' | 'student_coud'>('standard')
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0])
  const [folderIndex, setFolderIndex] = useState('АСД-01')
  const [fromWhom, setFromWhom] = useState('')
  const [toWhom, setToWhom] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [studentId, setStudentId] = useState('')
  const [staffId, setStaffId] = useState('')

  const totalPages = Math.ceil(totalCount / pageSize)
  const currentYear = new Date().getFullYear()

  const filteredNom = NOMENCLATURE.filter(n =>
    !nomSearch || n.code.toLowerCase().includes(nomSearch.toLowerCase()) || n.name.toLowerCase().includes(nomSearch.toLowerCase())
  )

  // Групиране по раздел
  const nomBySection = filteredNom.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = []
    acc[item.section].push(item)
    return acc
  }, {} as Record<string, typeof NOMENCLATURE>)

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

  function changeDirectionTab(d: 'incoming' | 'outgoing' | 'internal') {
    setDirection(d)
    setDocType('standard')
    setStudentId('')
    setStaffId('')
    setFromWhom('')
    setToWhom('')
    setSubject('')
    if (d === 'incoming') setFolderIndex('АСД-01')
    else if (d === 'outgoing') setFolderIndex('АСД-02')
    else setFolderIndex('АСД-03')
  }

  function resetForm() {
    setDirection('incoming')
    setDocType('standard')
    setFolderIndex('АСД-01')
    setFromWhom('')
    setToWhom('')
    setSubject('')
    setDocDate(new Date().toISOString().split('T')[0])
    setDescription('')
    setStudentId('')
    setStaffId('')
    setUploadedFile(null)
    setNomSearch('')
    setShowAllNom(false)
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
    let requestType = null

    if (direction === 'internal' && docType === 'staff_leave' && selectedStaff) {
      finalSubject = `Заявление за отпуск на ${selectedStaff.first_name} ${selectedStaff.last_name}`
      finalFrom = `${selectedStaff.first_name} ${selectedStaff.last_name}`
      finalTo = 'Директор ЦСОП Варна'
    } else if (docType === 'student_enroll' && selectedStudent) {
      requestType = 'enrollment'
      finalSubject = `Заявление за записване на ${selectedStudent.first_name} ${selectedStudent.last_name}`
      finalTo = 'Директор ЦСОП Варна'
    } else if (docType === 'student_coud' && selectedStudent) {
      requestType = 'coud'
      finalSubject = `Заявление за ЦОУД на ${selectedStudent.first_name} ${selectedStudent.last_name}`
      finalTo = 'Директор ЦСОП Варна'
    } else {
      if (direction === 'outgoing' && !finalFrom) finalFrom = 'ЦСОП Варна'
      if (direction === 'incoming' && !finalTo) finalTo = 'ЦСОП Варна'
    }

    if (!finalSubject) { alert('Моля попълнете темата.'); setSaving(false); return }

    const { count } = await supabase
      .from('correspondence')
      .select('id', { count: 'exact', head: true })
      .gte('date', `${currentYear}-01-01`)
      .lte('date', `${currentYear}-12-31`)

    const nextNum = String((count || 0) + 1).padStart(3, '0')
    const formattedDate = docDate.split('-').reverse().join('.')
    const docNumber = `${folderIndex}-${nextNum}/${formattedDate}г.`

    let fileUrl = '', fileName = ''
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop()
      const filePath = `correspondence/${currentYear}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, uploadedFile, { upsert: true })
      if (!uploadError) {
        fileUrl = filePath  // Записваме пътя, не публичния URL
        fileName = uploadedFile.name
      }
    }

    const { error } = await supabase.from('correspondence').insert({
      number: docNumber,
      date: docDate,
      direction,
      from_whom: finalFrom || null,
      to_whom: finalTo || null,
      subject: finalSubject,
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

  return (
    <div className="space-y-6 font-sans">

      {/* Филтри */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Всички' },
            { key: 'incoming', label: 'Входящи', icon: <ArrowDownLeft size={13} /> },
            { key: 'outgoing', label: 'Изходящи', icon: <ArrowUpRight size={13} /> },
            { key: 'internal', label: 'Вътрешни', icon: <ArrowRightLeft size={13} /> },
          ].map(({ key, label, icon }) => {
            const isActive = (directionValue || 'all') === key
            return (
              <button key={key} onClick={() => handleDirectionFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isActive ? 'bg-[#0f2240] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}>
                {icon}{label}
              </button>
            )
          })}
        </div>
        <div className="flex gap-3 items-center w-full md:w-auto justify-end">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Търсене..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none w-52" />
          </form>
          {canEdit && (
            <button onClick={() => setIsOpeningForm(true)}
              className="text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5"
              style={{ backgroundColor: '#0f2240' }}>
              <Plus className="h-4 w-4" /> Нов запис
            </button>
          )}
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-semibold text-slate-700 min-w-[800px]">
            <thead className="bg-[#f0f7ff] text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
              <tr>
                <th className="p-4 pl-6 w-[140px]">Рег. номер</th>
                <th className="p-4 w-[90px]">Вид</th>
                <th className="p-4 w-[80px]">Дата</th>
                <th className="p-4">От / До</th>
                <th className="p-4">Относно</th>
                <th className="p-4">Лице</th>
                <th className="p-4 text-right">Файл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {correspondence.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-slate-400">Няма намерени документи.</td></tr>
              ) : correspondence.map((item) => {
                const dir = item.direction as keyof typeof DIRECTION_CONFIG
                const cfg = DIRECTION_CONFIG[dir] || DIRECTION_CONFIG.incoming
                const student = students.find(s => s.id === item.student_id)
                const staffMember = staff?.find(s => s.id === item.staff_id)
                return (
                  <tr key={item.id}
                    onClick={() => setViewItem({ ...item, student, staffMember })}
                    className={`hover:bg-slate-50/60 transition-colors cursor-pointer ${cfg.row}`}>
                    <td className="p-4 pl-5">
                      <span className="font-mono font-bold text-[#0f2240] text-xs block">{item.number}</span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${cfg.badge}`}>
                        {cfg.icon}{cfg.label}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 font-mono whitespace-nowrap text-[10px]">
                      {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : '—'}
                    </td>
                    <td className="p-4 text-slate-600 text-[11px]">
                      {dir === 'incoming' && item.from_whom && <span><span className="text-blue-600 font-bold">От:</span> {item.from_whom}</span>}
                      {dir === 'outgoing' && item.to_whom && <span><span className="text-emerald-600 font-bold">До:</span> {item.to_whom}</span>}
                      {dir === 'internal' && <span><span className="text-purple-600 font-bold">От:</span> {item.from_whom} <span className="text-purple-600 font-bold">→ До:</span> {item.to_whom}</span>}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-xs">{item.subject}</div>
                      {item.description && <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs line-clamp-1">{item.description}</p>}
                    </td>
                    <td className="p-4">
                      {student && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0f2240] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                          <GraduationCap size={11} />{student.first_name} {student.last_name}
                        </span>
                      )}
                      {staffMember && !student && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md">
                          <User size={11} />{staffMember.first_name} {staffMember.last_name}
                        </span>
                      )}
                      {!student && !staffMember && <span className="text-slate-300">—</span>}
                    </td>
                    <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                      {item.file_url ? (
                        <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0f2240] bg-slate-100 px-2 py-1 rounded hover:bg-slate-200">
                          <Paperclip size={11} />Файл
                        </a>
                      ) : <span className="text-slate-300 text-[10px]">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-100 text-xs font-semibold text-slate-500">
            <span>Показване {((page-1)*pageSize)+1}–{Math.min(page*pageSize, totalCount)} от {totalCount}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => handlePageChange(page-1)}
                className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40">
                <ChevronLeft size={15} />
              </button>
              <button disabled={page >= totalPages} onClick={() => handlePageChange(page+1)}
                className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* МОДАЛ: Преглед */}
      {viewItem && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <button onClick={() => setViewItem(null)} className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
            <h3 className="font-bold text-slate-800 text-sm uppercase mb-4 flex items-center gap-2">
              <FolderOpen size={18} className="text-[#0f2240]" /> Детайли за документ
            </h3>
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <div className="text-xl font-mono font-bold text-[#0f2240]">{viewItem.number}</div>
                  <div className="text-sm text-slate-500 mt-1">Регистриран: {viewItem.date ? new Date(viewItem.date).toLocaleDateString('bg-BG') : viewItem.date}</div>
                </div>
                {(() => {
                  const cfg = DIRECTION_CONFIG[viewItem.direction as keyof typeof DIRECTION_CONFIG]
                  if (!cfg) return null
                  return <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border ${cfg.badge}`}>{cfg.icon}{cfg.label}</span>
                })()}
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">От кого</div>
                  <div className="text-sm font-bold text-slate-800">{viewItem.from_whom || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">До кого</div>
                  <div className="text-sm font-bold text-slate-800">{viewItem.to_whom || '—'}</div>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Тема / Относно</div>
                <div className="text-sm font-bold text-slate-800 mb-3">{viewItem.subject}</div>
                {viewItem.description && <>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Бележки</div>
                  <div className="text-xs text-slate-600">{viewItem.description}</div>
                </>}
              </div>
              {(viewItem.student || viewItem.staffMember) && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Свързано лице</div>
                  {viewItem.student && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0f2240] bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl">
                      <GraduationCap size={15} />{viewItem.student.first_name} {viewItem.student.last_name}
                    </span>
                  )}
                  {viewItem.staffMember && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-xl">
                      <User size={15} />{viewItem.staffMember.first_name} {viewItem.staffMember.last_name}
                    </span>
                  )}
                </div>
              )}
              {viewItem.file_url ? (
                <button type="button"
                  onClick={async () => {
                    const { data, error } = await supabase.storage
                      .from('documents')
                      .createSignedUrl(viewItem.file_url, 120)
                    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                    else alert('Грешка при изтегляне')
                  }}
                  className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl shadow-md transition-all"
                  style={{ backgroundColor: '#0f2240' }}>
                  <Download size={18} /> Изтегли / Отвори файла
                </button>
              ) : (
                <div className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-400 font-bold py-3 rounded-xl border">
                  <FileText size={18} /> Няма прикачен файл
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛ: Нов запис */}
      {isOpeningForm && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={resetForm} className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
            <h3 className="font-bold text-slate-800 text-sm uppercase mb-5 flex items-center gap-2">
              <FolderOpen size={18} className="text-[#0f2240]" /> Деловодно вписване
            </h3>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Посока */}
              <div className="flex gap-2 p-1.5 bg-slate-100 rounded-xl">
                {(['incoming', 'outgoing', 'internal'] as const).map(d => {
                  const cfg = DIRECTION_CONFIG[d]
                  return (
                    <button key={d} type="button" onClick={() => changeDirectionTab(d)}
                      className={`flex-1 text-xs font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        direction === d ? cfg.tabActive : 'text-slate-500 hover:text-slate-700'
                      }`}>
                      {d === 'incoming' ? <ArrowDownLeft size={14} /> : d === 'outgoing' ? <ArrowUpRight size={14} /> : <ArrowRightLeft size={14} />}
                      {cfg.label}
                    </button>
                  )
                })}
              </div>

              {/* Вид документ */}
              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                <label className="block text-[10px] font-bold text-[#0f2240] mb-1.5 uppercase">Вид документ</label>
                <select value={docType}
                  onChange={e => { setDocType(e.target.value as any); setStudentId(''); setStaffId(''); setSubject(''); }}
                  className="w-full border border-blue-200 rounded-xl p-2.5 text-xs bg-white font-semibold text-slate-700 focus:outline-none">
                  {DOC_TYPES[direction].map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Дата */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Дата *</label>
                <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} required className="input w-48" />
              </div>

              {/* Номенклатура */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Индекс от номенклатурата *</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {QUICK_NOM_CODES.map(code => {
                    const item = NOMENCLATURE.find(n => n.code === code)
                    return (
                      <button key={code} type="button" onClick={() => { setFolderIndex(code); setShowAllNom(false) }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          folderIndex === code
                            ? 'bg-[#0f2240] text-white border-[#0f2240]'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}>
                        <span className="font-mono">{code}</span>
                        <span className="ml-1 font-normal opacity-60 hidden sm:inline text-[10px]">{item?.name.slice(0, 20)}</span>
                      </button>
                    )
                  })}
                  <button type="button" onClick={() => setShowAllNom(!showAllNom)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${showAllNom ? 'bg-slate-100 border-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                    Всички дела...
                  </button>
                </div>

                {showAllNom && (
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                    <input autoFocus placeholder="Търси по код или наименование..."
                      value={nomSearch} onChange={e => setNomSearch(e.target.value)}
                      className="input w-full" />
                    <div className="max-h-52 overflow-y-auto space-y-3">
                      {Object.entries(nomBySection).map(([section, items]) => (
                        <div key={section}>
                          <div className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-1">{section}</div>
                          {items.map(item => (
                            <button key={item.code} type="button"
                              onClick={() => { setFolderIndex(item.code); setShowAllNom(false); setNomSearch('') }}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                folderIndex === item.code ? 'bg-[#0f2240] text-white' : 'hover:bg-white text-slate-700'
                              }`}>
                              <span className="font-mono font-bold">{item.code}</span>
                              <span className="ml-2 opacity-70">{item.name}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {folderIndex && (
                  <p className="text-xs text-blue-700 font-semibold mt-1.5">
                    ✓ <span className="font-mono">{folderIndex}</span>
                    <span className="ml-1 font-normal text-slate-500">— {NOMENCLATURE.find(n => n.code === folderIndex)?.name}</span>
                  </p>
                )}
              </div>

              {/* Динамични полета */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">

                {/* Молба за отпуск — избор на служител */}
                {docType === 'staff_leave' && (
                  <div>
                    <label className="block text-[10px] font-bold text-purple-600 uppercase mb-1.5 flex items-center gap-1">
                      <User size={11} /> Служител (подател) *
                    </label>
                    <select value={staffId}
                      onChange={e => {
                        setStaffId(e.target.value)
                        const s = staff.find(x => x.id === e.target.value)
                        if (s) setSubject(`Молба за отпуск от ${s.first_name} ${s.last_name}`)
                      }}
                      required className="input w-full">
                      <option value="">— Избери служител —</option>
                      {staff.sort((a,b) => a.last_name.localeCompare(b.last_name)).map(s => (
                        <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
                      ))}
                    </select>
                    {staffId && (
                      <div className="mt-2 p-2 bg-purple-50 border border-purple-100 rounded-lg text-[11px] text-purple-700 font-semibold">
                        Относно: {subject}
                      </div>
                    )}
                  </div>
                )}

                {/* Заявление за записване / ЦОУД — избор на ученик */}
                {(docType === 'student_enroll' || docType === 'student_coud') && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1.5 flex items-center gap-1">
                        <GraduationCap size={11} /> Ученик *
                      </label>
                      <select value={studentId}
                        onChange={e => {
                          setStudentId(e.target.value)
                          const s = students.find(x => x.id === e.target.value)
                          if (s) {
                            const label = docType === 'student_coud' ? 'ЦОУД' : 'записване'
                            setSubject(`Заявление за ${label} на ${s.first_name} ${s.last_name}`)
                            setToWhom('Директор ЦСОП Варна')
                          }
                        }}
                        required className="input w-full">
                        <option value="">— Избери ученик —</option>
                        {students.sort((a,b) => a.last_name.localeCompare(b.last_name)).map(s => (
                          <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">От кого (родител/настойник) *</label>
                      <input type="text" value={fromWhom} onChange={e => setFromWhom(e.target.value)} required
                        placeholder="Трите имена на родителя" className="input w-full" />
                    </div>
                    {studentId && (
                      <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-[11px] text-blue-700 font-semibold">
                        Относно: {subject}
                      </div>
                    )}
                  </div>
                )}

                {/* Стандартен документ */}
                {docType === 'standard' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {direction !== 'outgoing' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">От кого *</label>
                          <input type="text"
                            list={direction === 'internal' ? 'internal-list' : 'external-list'}
                            value={fromWhom} onChange={e => setFromWhom(e.target.value)} required
                            placeholder={direction === 'internal' ? 'Длъжностно лице...' : 'Институция / лице...'}
                            className="input w-full" />
                        </div>
                      )}
                      {direction !== 'incoming' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">До кого *</label>
                          <input type="text"
                            list={direction === 'internal' ? 'internal-list' : 'external-list'}
                            value={toWhom} onChange={e => setToWhom(e.target.value)} required
                            placeholder={direction === 'internal' ? 'Длъжностно лице...' : 'Институция / лице...'}
                            className="input w-full" />
                        </div>
                      )}
                      {direction === 'incoming' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">От кого *</label>
                          <input type="text" list="external-list"
                            value={fromWhom} onChange={e => setFromWhom(e.target.value)} required
                            placeholder="Институция / лице..."
                            className="input w-full" />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Тема / Относно *</label>
                      <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required
                        placeholder="Кратко описание..." className="input w-full" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Бележки</label>
                  <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Допълнителна информация..." className="input w-full resize-none" />
                </div>
              </div>

              <datalist id="external-list">{EXTERNAL_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
              <datalist id="internal-list">{INTERNAL_PERSONS.map(s => <option key={s} value={s} />)}</datalist>

              {/* Файл */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Прикачен документ</label>
                {uploadedFile ? (
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <FileText size={18} className="text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">{uploadedFile.name}</div>
                      <div className="text-[10px] text-slate-400">{(uploadedFile.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button type="button" onClick={() => setUploadedFile(null)} className="text-slate-400 hover:text-red-500 p-1"><X size={14} /></button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center w-full h-14 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#0f2240] hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Upload size={16} /><span className="text-xs font-semibold">Прикачи файл (PDF/Word)</span>
                    </div>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setUploadedFile(f) }} />
                  </label>
                )}
              </div>

              <div className="flex gap-3 justify-end border-t border-slate-100 pt-4">
                <button type="button" onClick={resetForm}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">Отказ</button>
                <button type="submit" disabled={saving}
                  className="px-6 py-2.5 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60 shadow-md"
                  style={{ backgroundColor: '#0f2240' }}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
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
