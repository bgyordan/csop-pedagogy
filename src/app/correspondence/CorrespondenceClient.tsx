'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Search, X, Upload, FileText, Loader2,
  ChevronLeft, ChevronRight, Paperclip, User, GraduationCap, FolderOpen,
  ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Download, ChevronDown
} from 'lucide-react'

// Кодове с умна логика — при избор показват допълнителни полета
const SMART_CODES: Record<string, { type: 'staff' | 'student'; subjectTemplate: string }> = {
  'ЛС-02': { type: 'staff', subjectTemplate: 'Заявление за отпуск от {name}' },
  'УВД-09': { type: 'student', subjectTemplate: 'Заявление за прием на {name}' },
  'УВД-12': { type: 'student', subjectTemplate: 'Молба за ЦОУД на {name}' },
}

// Бързи кодове по посока
const QUICK_CODES: Record<string, string[]> = {
  incoming: ['АСД-02', 'УВД-09', 'УВД-12', 'УВД-07', 'УВД-08', 'РД-10', 'ФСД-02'],
  outgoing: ['АСД-02', 'УВД-07', 'УВД-08', 'РД-06', 'ФСД-02', 'ОД-01'],
  internal: ['АСД-05', 'ЛС-02', 'РД-07', 'УВД-10', 'БУТ-01'],
}

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

const DIRECTION_CONFIG = {
  incoming: { label: 'Входящ', badge: 'bg-blue-100 text-blue-800 border-blue-200', icon: <ArrowDownLeft size={10} />, tabActive: 'bg-blue-100 text-blue-800 border border-blue-200', row: 'border-l-2 border-l-blue-300' },
  outgoing: { label: 'Изходящ', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <ArrowUpRight size={10} />, tabActive: 'bg-emerald-100 text-emerald-800 border border-emerald-200', row: 'border-l-2 border-l-emerald-300' },
  internal: { label: 'Вътрешен', badge: 'bg-purple-100 text-purple-800 border-purple-200', icon: <ArrowRightLeft size={10} />, tabActive: 'bg-purple-100 text-purple-800 border border-purple-200', row: 'border-l-2 border-l-purple-300' },
}

interface NomenclatureItem {
  id: string
  section_code: string
  item_code: string
  name: string
  retention_years: string
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
  nomenclature: NomenclatureItem[]
}

export default function CorrespondenceClient({
  correspondence, totalCount, page, pageSize,
  searchValue, directionValue, canEdit, currentUserId, students, staff = [], nomenclature
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
  const [folderIndex, setFolderIndex] = useState('АСД-02')
  const [folderCount, setFolderCount] = useState<number | null>(null)
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0])
  const [toWhomSuggestions, setToWhomSuggestions] = useState<string[]>([...EXTERNAL_SUGGESTIONS])
  const [fromWhomSuggestions, setFromWhomSuggestions] = useState<string[]>([...EXTERNAL_SUGGESTIONS])
  const [fromWhom, setFromWhom] = useState('')
  const [toWhom, setToWhom] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [studentId, setStudentId] = useState('')
  const [staffId, setStaffId] = useState('')

  const totalPages = Math.ceil(totalCount / pageSize)
  const currentYear = new Date().getFullYear()

  const smartCode = SMART_CODES[folderIndex]
  const selectedNomItem = nomenclature.find(n => n.item_code === folderIndex)

  // Групиране по раздел
  const filteredNom = nomenclature.filter(n =>
    !nomSearch || n.item_code.toLowerCase().includes(nomSearch.toLowerCase()) || n.name.toLowerCase().includes(nomSearch.toLowerCase())
  )
  const nomBySection = filteredNom.reduce((acc, item) => {
    if (!acc[item.section_code]) acc[item.section_code] = []
    acc[item.section_code].push(item)
    return acc
  }, {} as Record<string, NomenclatureItem[]>)

  // Генериране на следващ номер за preview
  // Глобален пореден номер за годината
  const nextGlobalNum = String(totalCount + 1).padStart(3, '0')
  const nextNumPreview = `${folderIndex}-${nextGlobalNum}/${docDate.split('-').reverse().join('.')}г.`

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

  async function selectNomCode(code: string) {
    setFolderIndex(code)
    setShowAllNom(false)
    setNomSearch('')
    setStudentId('')
    setStaffId('')
    setSubject('')
    if (direction === 'incoming') setToWhom('ЦСОП Варна')
    if (direction === 'outgoing') setFromWhom('ЦСОП Варна')
    // Броим документи в тази папка
    setFolderCount(null)
    const { count } = await supabase
      .from('correspondence')
      .select('id', { count: 'exact', head: true })
      .like('number', `${code}-%`)
      .gte('date', `${currentYear}-01-01`)
      .lte('date', `${currentYear}-12-31`)
    setFolderCount(count || 0)
  }

  function changeDirectionTab(d: 'incoming' | 'outgoing' | 'internal') {
    setDirection(d)
    setStudentId('')
    setStaffId('')
    setFromWhom('')
    setToWhom('')
    setSubject('')
    if (d === 'incoming') { setFolderIndex('АСД-02'); setToWhom('ЦСОП Варна') }
    else if (d === 'outgoing') { setFolderIndex('АСД-02'); setFromWhom('ЦСОП Варна') }
    else setFolderIndex('АСД-02')
  }

  function handleStaffSelect(id: string) {
    setStaffId(id)
    const s = staff.find(x => x.id === id)
    if (s && smartCode) {
      setSubject(smartCode.subjectTemplate.replace('{name}', `${s.first_name} ${s.last_name}`))
      setFromWhom(`${s.first_name} ${s.last_name}`)
      setToWhom('Директор ЦСОП Варна')
    }
  }

  function handleStudentSelect(id: string) {
    setStudentId(id)
    const s = students.find(x => x.id === id)
    if (s && smartCode) {
      setSubject(smartCode.subjectTemplate.replace('{name}', `${s.first_name} ${s.last_name}`))
      setToWhom('Директор ЦСОП Варна')
    }
  }

  function resetForm() {
    setFolderIndex('АСД-02')
    setDirection('incoming')
    setFromWhom('')
    setToWhom('ЦСОП Варна')
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

  async function fetchFrequentRecipients() {
    // Зарежда получателите наредени по честота на ползване
    const { data } = await supabase
      .from('correspondence')
      .select('to_whom, from_whom, direction')
      .not('to_whom', 'is', null)
    
    if (!data) return

    // Брой за изходящи получатели
    const toCount: Record<string, number> = {}
    data.filter(r => r.direction === 'outgoing' && r.to_whom).forEach(r => {
      toCount[r.to_whom] = (toCount[r.to_whom] || 0) + 1
    })
    const sortedTo = [...new Set([
      ...Object.entries(toCount).sort((a,b) => b[1]-a[1]).map(([k]) => k),
      ...EXTERNAL_SUGGESTIONS
    ])]
    setToWhomSuggestions(sortedTo)

    // Брой за входящи изпращачи
    const fromCount: Record<string, number> = {}
    data.filter(r => r.direction === 'incoming' && r.from_whom).forEach(r => {
      fromCount[r.from_whom] = (fromCount[r.from_whom] || 0) + 1
    })
    const sortedFrom = [...new Set([
      ...Object.entries(fromCount).sort((a,b) => b[1]-a[1]).map(([k]) => k),
      ...EXTERNAL_SUGGESTIONS
    ])]
    setFromWhomSuggestions(sortedFrom)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject) { alert('Моля попълнете темата.'); return }
    setSaving(true)

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
      if (!uploadError) { fileUrl = filePath; fileName = uploadedFile.name }
    }

    const { error } = await supabase.from('correspondence').insert({
      number: docNumber,
      date: docDate,
      direction,
      from_whom: fromWhom || null,
      to_whom: toWhom || null,
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

  return (
    <div className="space-y-5 font-sans">

      {/* Филтри */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Всички' },
            { key: 'incoming', label: 'Входящи', icon: <ArrowDownLeft size={13} /> },
            { key: 'outgoing', label: 'Изходящи', icon: <ArrowUpRight size={13} /> },
            { key: 'internal', label: 'Вътрешни', icon: <ArrowRightLeft size={13} /> },
          ].map(({ key, label, icon }) => (
            <button key={key} onClick={() => handleDirectionFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                (directionValue || 'all') === key ? 'bg-[#0f2240] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}>
              {icon}{label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 items-center w-full md:w-auto justify-end">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Търсене..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none w-48" />
          </form>
          {canEdit && (
            <button onClick={() => setIsOpeningForm(true)}
              className="text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 whitespace-nowrap"
              style={{ backgroundColor: '#0f2240' }}>
              <Plus size={15} /> Нов запис
            </button>
          )}
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-[#f0f7ff] text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-4 py-2.5 pl-5">Номер</th>
                <th className="px-3 py-2.5">Вид</th>
                <th className="px-3 py-2.5">От / До</th>
                <th className="px-3 py-2.5">Относно</th>
                <th className="px-3 py-2.5">Лице</th>
                <th className="px-3 py-2.5 text-right">Файл</th>
              </tr>
            </thead>
            <tbody>
              {correspondence.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-slate-400">Няма намерени документи.</td></tr>
              ) : correspondence.map((item, idx) => {
                const dir = item.direction as keyof typeof DIRECTION_CONFIG
                const cfg = DIRECTION_CONFIG[dir] || DIRECTION_CONFIG.incoming
                const student = students.find(s => s.id === item.student_id)
                const staffMember = staff?.find(s => s.id === item.staff_id)
                return (
                  <tr key={item.id}
                    onClick={() => setViewItem({ ...item, student, staffMember })}
                    className={`cursor-pointer transition-colors ${cfg.row} ${idx % 2 === 0 ? 'bg-white hover:bg-slate-50/60' : 'bg-slate-50/30 hover:bg-slate-100/40'}`}>
                    <td className="px-4 py-2 pl-5">
                      <span className="font-mono font-bold text-[#0f2240] text-[11px]">{item.number}</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {item.date ? new Date(item.date).toLocaleDateString('bg-BG') : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${cfg.badge}`}>
                        {cfg.icon}{cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-600 max-w-[140px]">
                      {dir === 'incoming' && item.from_whom && <span><span className="text-blue-600 font-bold">От:</span> {item.from_whom}</span>}
                      {dir === 'outgoing' && item.to_whom && <span><span className="text-emerald-600 font-bold">До:</span> {item.to_whom}</span>}
                      {dir === 'internal' && <span><span className="text-purple-600 font-bold">Вътр.</span></span>}
                    </td>
                    <td className="px-3 py-2 max-w-[220px]">
                      <div className="font-semibold text-slate-800 text-[11px] truncate">{item.subject}</div>
                      {item.description && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{item.description}</p>}
                    </td>
                    <td className="px-3 py-2">
                      {student && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0f2240] bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md">
                          <GraduationCap size={10} />{student.last_name}
                        </span>
                      )}
                      {staffMember && !student && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-md">
                          <User size={10} />{staffMember.last_name}
                        </span>
                      )}
                      {!student && !staffMember && <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                      {item.file_url ? (
                        <button type="button"
                          onClick={async () => {
                            const win = window.open('', '_blank')
                            const { data } = await supabase.storage.from('documents').createSignedUrl(item.file_url, 120)
                            if (data?.signedUrl && win) win.location.href = data.signedUrl
                            else if (win) win.close()
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0f2240] bg-slate-100 px-2 py-0.5 rounded hover:bg-slate-200">
                          <Paperclip size={10} />PDF
                        </button>
                      ) : <span className="text-slate-300 text-[10px]">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 bg-slate-50 border-t border-slate-100 text-xs font-semibold text-slate-500">
            <span>{((page-1)*pageSize)+1}–{Math.min(page*pageSize, totalCount)} от {totalCount}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => handlePageChange(page-1)}
                className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40">
                <ChevronLeft size={14} />
              </button>
              <button disabled={page >= totalPages} onClick={() => handlePageChange(page+1)}
                className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40">
                <ChevronRight size={14} />
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
                    const win = window.open('', '_blank')
                    const { data } = await supabase.storage.from('documents').createSignedUrl(viewItem.file_url, 120)
                    if (data?.signedUrl && win) win.location.href = data.signedUrl
                    else { if (win) win.close(); alert('Грешка при изтегляне') }
                  }}
                  className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl shadow-md"
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

              {/* Номенклатура */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Индекс от номенклатурата *</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(QUICK_CODES[direction] || []).map(code => {
                    const item = nomenclature.find(n => n.item_code === code)
                    if (!item) return null
                    return (
                      <button key={code} type="button" onClick={() => selectNomCode(code)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          folderIndex === code
                            ? 'bg-[#0f2240] text-white border-[#0f2240]'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}>
                        <span className="font-mono">{code}</span>
                      </button>
                    )
                  })}
                  <button type="button" onClick={() => setShowAllNom(!showAllNom)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${showAllNom ? 'bg-slate-100 border-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                    <ChevronDown size={13} className={showAllNom ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    Всички...
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
                            <button key={item.item_code} type="button"
                              onClick={() => selectNomCode(item.item_code)}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                folderIndex === item.item_code ? 'bg-[#0f2240] text-white' : 'hover:bg-white text-slate-700'
                              }`}>
                              <span className="font-mono font-bold">{item.item_code}</span>
                              <span className="ml-2 opacity-70">{item.name}</span>
                              {item.retention_years && <span className="ml-2 text-[10px] opacity-50">({item.retention_years}г.)</span>}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Показваме избраното дело и следващия номер */}
                {selectedNomItem && (
                  <div className="mt-2 p-3 bg-[#f0f7ff] border border-blue-100 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-[#0f2240] text-xs">{folderIndex}</span>
                        <span className="ml-2 text-xs text-slate-500">{selectedNomItem.name}</span>
                      </div>
                      {selectedNomItem.retention_years && (
                        <span className="text-[10px] text-slate-400">Срок: {selectedNomItem.retention_years}г.</span>
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400">Следващ номер: </span>
                        <span className="font-mono font-bold text-[#0f2240] text-sm">{nextNumPreview}</span>
                      </div>
                      {folderCount !== null && (
                        <span className="text-[10px] text-slate-400">
                          {folderCount} документа в папка {folderIndex}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Дата */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Дата *</label>
                <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} required className="input w-48" />
              </div>

              {/* Умни полета при специални кодове */}
              {smartCode?.type === 'staff' && (
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
                  <label className="block text-[11px] font-bold text-purple-700 uppercase flex items-center gap-1">
                    <User size={12} /> Служител *
                  </label>
                  <select value={staffId} onChange={e => handleStaffSelect(e.target.value)} required className="input w-full">
                    <option value="">— Избери служител —</option>
                    {staff.sort((a,b) => a.last_name.localeCompare(b.last_name)).map(s => (
                      <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
                    ))}
                  </select>
                  {subject && (
                    <div className="text-xs text-purple-700 font-semibold bg-white border border-purple-100 rounded-lg px-3 py-2">
                      Относно: {subject}
                    </div>
                  )}
                </div>
              )}

              {smartCode?.type === 'student' && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                  <label className="block text-[11px] font-bold text-blue-700 uppercase flex items-center gap-1">
                    <GraduationCap size={12} /> Ученик *
                  </label>
                  <select value={studentId} onChange={e => handleStudentSelect(e.target.value)} required className="input w-full">
                    <option value="">— Избери ученик —</option>
                    {students.sort((a,b) => a.last_name.localeCompare(b.last_name)).map(s => (
                      <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
                    ))}
                  </select>
                  {studentId && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">От кого (родител/настойник) *</label>
                      <input type="text" value={fromWhom} onChange={e => setFromWhom(e.target.value)} required
                        placeholder="Трите имена на родителя" className="input w-full" />
                    </div>
                  )}
                  {subject && (
                    <div className="text-xs text-blue-700 font-semibold bg-white border border-blue-100 rounded-lg px-3 py-2">
                      Относно: {subject}
                    </div>
                  )}
                </div>
              )}

              {/* Стандартни полета */}
              {!smartCode && (
                <div className="space-y-3">
                  {direction === 'incoming' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">От кого *</label>
                      <input type="text" list="from-list"
                        value={fromWhom} onChange={e => setFromWhom(e.target.value)} required
                        placeholder="Институция / лице..."
                        className="input w-full" />
                    </div>
                  )}
                  {direction === 'outgoing' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">До кого *</label>
                      <input type="text" list="to-list"
                        value={toWhom} onChange={e => setToWhom(e.target.value)} required
                        placeholder="Институция / лице..."
                        className="input w-full" />
                    </div>
                  )}
                  {direction === 'internal' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">До кого (длъжностно лице) *</label>
                      <input type="text" list="internal-list"
                        value={toWhom} onChange={e => setToWhom(e.target.value)} required
                        placeholder="Длъжностно лице..."
                        className="input w-full" />
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Тема / Относно *</label>
                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required
                      placeholder="Кратко описание..." className="input w-full" />
                  </div>
                </div>
              )}

              {/* При умни кодове — показваме само Относно ако не е попълнено */}
              {smartCode && !subject && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Тема / Относно *</label>
                  <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required
                    placeholder="Ще се попълни автоматично при избор..." className="input w-full" />
                </div>
              )}

              {/* Описание */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Бележки</label>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Допълнителна информация..." className="input w-full resize-none" />
              </div>

              <datalist id="from-list">{fromWhomSuggestions.map(s => <option key={s} value={s} />)}</datalist>
              <datalist id="to-list">{toWhomSuggestions.map(s => <option key={s} value={s} />)}</datalist>
              <datalist id="internal-list">{INTERNAL_PERSONS.map(s => <option key={s} value={s} />)}</datalist>

              {/* Файл */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Прикачен документ (PDF/Word, макс. 10MB)</label>
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
                      <Upload size={16} /><span className="text-xs font-semibold">Прикачи файл</span>
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
