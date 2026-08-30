'use client'
import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, FileText, Loader2, User, GraduationCap, ChevronDown, ArrowDownLeft, ArrowUpRight, Zap, ClipboardList } from 'lucide-react'
// Деловодна година: 15.09 – 14.09 следващата
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
async function nextSeqCorr(supabase: any, direction: string, start: string, end: string): Promise<number> {
  const { data } = await supabase.from('correspondence')
    .select('seq').eq('direction', direction).gte('date', start).lte('date', end)
    .order('seq', { ascending: false, nullsFirst: false }).limit(1)
  const maxSeq = data && data[0] && typeof data[0].seq === 'number' ? data[0].seq : 0
  return maxSeq + 1
}
// Пореден номер за заповеди (РД) за деловодната година
async function nextSeqOrders(supabase: any, start: string, end: string): Promise<number> {
  const { data } = await supabase.from('orders')
    .select('seq').gte('date', start).lte('date', end)
    .order('seq', { ascending: false, nullsFirst: false }).limit(1)
  const maxSeq = data && data[0] && typeof data[0].seq === 'number' ? data[0].seq : 0
  return maxSeq + 1
}
// Бързи сценарии
const QUICK_SCENARIOS: Record<string, {
  label: string
  icon: 'staff' | 'student'
  index: string
  template: string
  directions: ('incoming' | 'outgoing')[]
  dossierDocType?: string
}> = {
  vacation: { label: 'Отпуск', icon: 'staff', index: 'ЛС-02', template: 'Заявление за отпуск', directions: ['incoming'] },
  enrollment: { label: 'Прием на ученик', icon: 'student', index: 'УВД-09', template: 'Заявление за прием на {name}', directions: ['incoming'], dossierDocType: 'enrollment_application' },
  coud: { label: 'ЦОУД', icon: 'student', index: 'УВД-12', template: 'Молба за ЦОУД на {name}', directions: ['incoming'], dossierDocType: 'coud_application' },
}
const EXTERNAL_SUGGESTIONS = [
  'МОН — Министерство на образованието и науката',
  'РУО — Варна', 'Община Варна', 'РЦПППО — Варна',
  'Агенция за социално подпомагане', 'РЗОК — Варна',
  'НОИ — Варна', 'Дирекция "Социално подпомагане"',
]
type Direction = 'incoming' | 'outgoing'
interface NomenclatureItem {
  id: string
  section_code: string
  item_code: string
  name: string
  retention_years: string
  quick_incoming?: boolean
  quick_outgoing?: boolean
}
interface Props {
  totalCount: number
  currentUserId: string
  students: { id: string; first_name: string; last_name: string }[]
  staff: { id: string; first_name: string; last_name: string }[]
  nomenclature: NomenclatureItem[]
  direction: Direction
  onClose: () => void
  onSaved: () => void
}
export default function NewCorrespondenceForm({
  totalCount, currentUserId, students, staff, nomenclature, direction, onClose, onSaved
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const descRef = useRef<HTMLTextAreaElement>(null)
  const [saving, setSaving] = useState(false)
  const [saveAction, setSaveAction] = useState<'save_close' | 'save_new'>('save_close')
  const [scenario, setScenario] = useState<string | null>(null)
  const [folderIndex, setFolderIndex] = useState('')
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0])
  const [fromWhom, setFromWhom] = useState('')
  const [toWhom, setToWhom] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [studentId, setStudentId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [guardians, setGuardians] = useState<{ full_name: string; relation: string }[]>([])
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [nomSearch, setNomSearch] = useState('')
  const [showAllNom, setShowAllNom] = useState(false)
  const [addToDossier, setAddToDossier] = useState(true)
  const [createOrder, setCreateOrder] = useState(true)
  // Заместване (само сценарий отпуск, опционално)
  const [substituteId, setSubstituteId] = useState('')
  const [subSearch, setSubSearch] = useState('')
  const [subOpen, setSubOpen] = useState(false)
  const [subFrom, setSubFrom] = useState('')
  const [subTo, setSubTo] = useState('')
  const currentYear = new Date().getFullYear()
  const activeScenario = scenario ? QUICK_SCENARIOS[scenario] : null
  const selectedNomItem = nomenclature.find(n => n.item_code === folderIndex)
  const [nextNumVal, setNextNumVal] = useState<number | null>(null)
  useEffect(() => {
    const { start, end } = deloYearBounds(new Date(docDate))
    nextSeqCorr(supabase, direction, start, end).then(setNextNumVal)
  }, [docDate, direction])
  const nextNum = nextNumVal !== null ? String(nextNumVal).padStart(3, '0') : '???'
  const nextNumPreview = `${nextNum}/${docDate.split('-').reverse().join('.')}г.`
  const dirLabel = direction === 'incoming' ? 'Входящ' : 'Изходящ'
  const dirIcon = direction === 'incoming' ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />
  useEffect(() => {
    if (descRef.current) {
      descRef.current.style.height = 'auto'
      descRef.current.style.height = descRef.current.scrollHeight + 'px'
    }
  }, [description])
  const filteredNom = nomenclature.filter(n =>
    !nomSearch || n.item_code.toLowerCase().includes(nomSearch.toLowerCase()) || n.name.toLowerCase().includes(nomSearch.toLowerCase())
  )
  const nomBySection = filteredNom.reduce((acc, item) => {
    if (!acc[item.section_code]) acc[item.section_code] = []
    acc[item.section_code].push(item)
    return acc
  }, {} as Record<string, NomenclatureItem[]>)
  // Бързи индекси от настройките
  const quickCodes = nomenclature
    .filter(n => direction === 'incoming' ? n.quick_incoming : n.quick_outgoing)
    .map(n => n.item_code)
  // Сценарии валидни за тази посока
  const availableScenarios = Object.entries(QUICK_SCENARIOS)
    .filter(([_, s]) => s.directions.includes(direction))
  function selectScenario(key: string) {
    if (scenario === key) {
      // Изключване
      setScenario(null)
      setFolderIndex('')
      setSubject('')
      setFromWhom('')
      setToWhom('')
      setStudentId('')
      setStaffId('')
      setGuardians([])
      return
    }
    const s = QUICK_SCENARIOS[key]
    setScenario(key)
    setFolderIndex(s.index)
    setSubject('')
    setFromWhom('')
    setToWhom('')
    setStudentId('')
    setStaffId('')
    setGuardians([])
    setCreateOrder(true)
  }
  function handleStaffSelect(id: string) {
    setStaffId(id)
    const s = staff.find(x => x.id === id)
    if (s && activeScenario) {
      setSubject(activeScenario.template)
      setFromWhom(`${s.first_name} ${s.last_name}`)
    }
  }
  async function handleStudentSelect(id: string) {
    setStudentId(id)
    setFromWhom('')
    const s = students.find(x => x.id === id)
    if (s && activeScenario) {
      setSubject(activeScenario.template.replace('{name}', `${s.first_name} ${s.last_name}`))
    }
    // Зареди родителите на ученика
    const { data } = await supabase.from('student_guardians')
      .select('full_name, relation').eq('student_id', id).order('relation')
    setGuardians(data || [])
    // Ако има само един родител — налей го автоматично
    if (data && data.length === 1) {
      setFromWhom(data[0].full_name)
    }
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject) { alert('Моля попълнете темата.'); return }
    setSaving(true)
    const { start: dStart, end: dEnd } = deloYearBounds(new Date(docDate))
    const seq = await nextSeqCorr(supabase, direction, dStart, dEnd)
    const num = String(seq).padStart(3, '0')
    const docNumber = `${num}/${docDate.split('-').reverse().join('.')}г.`
    let fileUrl = '', fileName = ''
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop()
      const filePath = `correspondence/${currentYear}/${direction}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, uploadedFile, { upsert: true })
      if (!uploadError) { fileUrl = filePath; fileName = uploadedFile.name }
    }
    const { error } = await supabase.from('correspondence').insert({
      number: docNumber,
      date: docDate,
      direction,
      nomenclature_item: folderIndex || null,
      from_whom: fromWhom || null,
      to_whom: toWhom || null,
      subject,
      description: description || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      student_id: studentId || null,
      staff_id: staffId || null,
      created_by: currentUserId,
      status: 'active',
      seq,
    })
    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }

    // Автоматична заповед за отпуск (сценарий vacation, отметка включена)
    if (scenario === 'vacation' && createOrder) {
      try {
        const oSeq = await nextSeqOrders(supabase, dStart, dEnd)
        const oNum = String(oSeq).padStart(3, '0')
        const orderNumber = `${oNum}/${docDate.split('-').reverse().join('.')}г.`
        await supabase.from('orders').insert({
          number: orderNumber,
          date: docDate,
          title: `Заповед за отпуск на ${fromWhom || ''}`.trim(),
          nomenclature_item: 'РД-10',
          description: `Издадена въз основа на Вх. ${docNumber}`,
                    file_url: fileUrl || null,
          file_name: fileName || null,
          created_by: currentUserId,
          seq: oSeq,
        })
      } catch (_) { /* заповедта не бива да блокира деловодството */ }
    }

    // Заместване (сценарий vacation, ако е избран заместник) -> ред в substitutions
    if (scenario === 'vacation' && substituteId && subFrom && subTo) {
      try {
        await supabase.from('substitutions').insert({
          absent_staff_id: staffId || null,
          substitute_staff_id: substituteId,
          date_from: subFrom,
          date_to: subTo,
          reason: 'vacation',
          leave_order_date: docDate,
          created_by: currentUserId,
        })
      } catch (_) { /* заместването не бива да блокира деловодството */ }
    }

    // Прикачване към досието на ученика (заявление за прием / ЦОУД)
    if (uploadedFile && studentId && activeScenario?.icon === 'student' && activeScenario.dossierDocType && addToDossier) {
      try {
        const ext = uploadedFile.name.split('.').pop()
        const dossierPath = `${studentId}/${Date.now()}_delo.${ext}`
        const { error: dossierUploadErr } = await supabase.storage
          .from('student-dossiers').upload(dossierPath, uploadedFile)
        if (!dossierUploadErr) {
          await supabase.from('student_attachments').insert({
            student_id: studentId,
            file_name: uploadedFile.name,
            file_path: dossierPath,
            file_size: uploadedFile.size,
            doc_type: activeScenario.dossierDocType,
            uploaded_by: currentUserId,
            valid_until_year: null,
          })
        }
      } catch (_) { /* прикачването към досието не бива да блокира деловодството */ }
    }

    setSaving(false)
    router.refresh()
    if (saveAction === 'save_new') {
      setScenario(null); setFolderIndex('')
      setDocDate(new Date().toISOString().split('T')[0])
      setFromWhom(''); setToWhom(''); setSubject(''); setDescription('')
      setStudentId(''); setStaffId(''); setUploadedFile(null)
      setGuardians([])
      setNomSearch(''); setShowAllNom(false)
      setAddToDossier(true)
      setCreateOrder(true)
    } else {
      onSaved()
    }
  }
  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-3xl border border-slate-200/80 max-w-2xl w-full shadow-2xl flex flex-col" style={{ maxHeight: '92vh' }}>
        {/* Хедър */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg bg-slate-50">
                {dirIcon}{dirLabel}
              </span>
              <h3 className="font-medium text-slate-800 text-sm">Деловодно вписване</h3>
            </div>
            <p className="text-[11px] text-[#0f2240] font-bold mt-1">{nextNumPreview}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Бързо регистриране */}
            {availableScenarios.length > 0 && (
              <div>
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Zap size={11} /> Бързо регистриране
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableScenarios.map(([key, s]) => (
                    <button key={key} type="button" onClick={() => selectScenario(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        scenario === key
                          ? 'bg-[#0f2240] text-white border-[#0f2240]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}>
                      {s.icon === 'staff' ? <User size={12} /> : <GraduationCap size={12} />}
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Дата */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Дата *</label>
              <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} required className="input w-44 text-xs" />
            </div>
            {/* Сценарий: служител */}
            {activeScenario?.icon === 'staff' && (
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
                {subject && <div className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2">{subject}</div>}
                {/* Автоматична заповед за отпуск */}
                {scenario === 'vacation' && (
                  <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                    <input type="checkbox" checked={createOrder} onChange={e => setCreateOrder(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 accent-[#0f2240] mt-0.5" />
                    <span className="text-[11px] text-slate-600 leading-snug">
                      Създай и <strong>заповед за отпуск</strong> (РД-10) с общия файл
                    </span>
                  </label>
                )}
                {/* Заместване (опционално) */}
                {scenario === 'vacation' && (
                  <div className="pt-2 mt-1 border-t border-slate-200 space-y-2">
                    <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Заместване (по избор)</div>
                    {/* Комбо заместник */}
                    <div className="relative">
                      <input type="text"
                        value={substituteId ? (staff.find(x => x.id === substituteId) ? `${staff.find(x => x.id === substituteId)!.first_name} ${staff.find(x => x.id === substituteId)!.last_name}` : subSearch) : subSearch}
                        onChange={e => { setSubSearch(e.target.value); setSubstituteId(''); setSubOpen(true) }}
                        onFocus={() => setSubOpen(true)}
                        placeholder="Заместник — търси по име…"
                        className="input w-full text-xs" />
                      {substituteId && (
                        <button type="button" onClick={() => { setSubstituteId(''); setSubSearch(''); setSubFrom(''); setSubTo('') }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={13} /></button>
                      )}
                      {subOpen && !substituteId && (
                        <div className="absolute z-20 mt-1 w-full max-h-44 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                          {staff
                            .filter(x => x.id !== staffId)
                            .filter(x => `${x.first_name} ${x.last_name}`.toLowerCase().includes(subSearch.toLowerCase()))
                            .sort((a,b) => a.first_name.localeCompare(b.first_name, 'bg'))
                            .slice(0, 30)
                            .map(x => (
                              <button key={x.id} type="button"
                                onClick={() => { setSubstituteId(x.id); setSubOpen(false); setSubSearch('') }}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700">
                                {x.first_name} {x.last_name}
                              </button>
                            ))}
                          {staff.filter(x => x.id !== staffId).filter(x => `${x.first_name} ${x.last_name}`.toLowerCase().includes(subSearch.toLowerCase())).length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-400">Няма съвпадение</div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Срок — само ако има избран заместник */}
                    {substituteId && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="block text-[10px] text-slate-400 mb-0.5">От</label>
                          <input type="date" value={subFrom} onChange={e => setSubFrom(e.target.value)} className="input w-full text-xs" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] text-slate-400 mb-0.5">До</label>
                          <input type="date" value={subTo} onChange={e => setSubTo(e.target.value)} className="input w-full text-xs" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Сценарий: ученик */}
            {activeScenario?.icon === 'student' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <GraduationCap size={11} /> Ученик *
                </label>
                <select value={studentId} onChange={e => handleStudentSelect(e.target.value)} required className="input w-full">
                  <option value="">— Избери ученик —</option>
                  {students.sort((a,b) => a.first_name.localeCompare(b.first_name, 'bg')).map(s => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                  ))}
                </select>
                {studentId && (
                  <>
                    <input type="text" list="guardian-list" value={fromWhom} onChange={e => setFromWhom(e.target.value)} required
                      placeholder="От кого (родител/настойник) *" className="input w-full" />
                    <datalist id="guardian-list">
                      {guardians.map((g, i) => (
                        <option key={i} value={g.full_name}>{g.relation}</option>
                      ))}
                    </datalist>
                    {guardians.length > 1 && (
                      <div className="flex flex-wrap gap-1.5">
                        {guardians.map((g, i) => (
                          <button key={i} type="button" onClick={() => setFromWhom(g.full_name)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] border transition-all ${
                              fromWhom === g.full_name ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}>
                            {g.full_name} <span className="opacity-60">({g.relation})</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {guardians.length === 0 && (
                      <p className="text-[11px] text-slate-400">Няма записани родители за този ученик — въведете ръчно.</p>
                    )}
                  </>
                )}
                {subject && <div className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2">{subject}</div>}
                {/* Прикачи към досие */}
                {uploadedFile && (
                  <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                    <input type="checkbox" checked={addToDossier} onChange={e => setAddToDossier(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 accent-[#0f2240]" />
                    <span className="text-[11px] text-slate-600">Прикачи файла и към <strong>досието</strong> на ученика</span>
                  </label>
                )}
              </div>
            )}
            {/* Стандартни полета */}
            {!activeScenario && (
              <div className="space-y-3">
                {direction === 'incoming' ? (
                  <>
                    <input type="text" list="from-list" value={fromWhom} onChange={e => setFromWhom(e.target.value)}
                      required placeholder="От кого *" className="input w-full" />
                    <datalist id="from-list">{EXTERNAL_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
                  </>
                ) : (
                  <>
                    <input type="text" list="to-list" value={toWhom} onChange={e => setToWhom(e.target.value)}
                      required placeholder="До кого *" className="input w-full" />
                    <datalist id="to-list">{EXTERNAL_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
                  </>
                )}
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  required placeholder="Тема / Относно *" className="input w-full" />
              </div>
            )}
            {activeScenario && !subject && (
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                required placeholder="Тема / Относно *" className="input w-full" />
            )}
            {/* Бележки */}
            <textarea ref={descRef} rows={1} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Допълнителна информация..."
              className="input w-full resize-none overflow-hidden" />
            {/* Архивен индекс — в дъното */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Архивен индекс {activeScenario && <span className="text-slate-300 normal-case">(зададен автоматично)</span>}
              </label>
              {activeScenario ? (
                selectedNomItem && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-fit">
                    <span className="font-medium text-[#0f2240]">{folderIndex}</span>
                    <span className="text-slate-500 truncate">{selectedNomItem.name}</span>
                  </div>
                )
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {quickCodes.map(code => {
                      const item = nomenclature.find(n => n.item_code === code)
                      if (!item) return null
                      return (
                        <button key={code} type="button" onClick={() => setFolderIndex(folderIndex === code ? '' : code)} title={item.name}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                            folderIndex === code ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}>
                          {code}
                        </button>
                      )
                    })}
                    <button type="button" onClick={() => setShowAllNom(!showAllNom)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${showAllNom ? 'bg-slate-200 border-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                      <ChevronDown size={12} className={`transition-transform ${showAllNom ? 'rotate-180' : ''}`} />
                      Всички...
                    </button>
                  </div>
                  {showAllNom && (
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 mb-2">
                      <input autoFocus placeholder="Търси по код или наименование..."
                        value={nomSearch} onChange={e => setNomSearch(e.target.value)}
                        className="input w-full text-xs" />
                      <div className="max-h-36 overflow-y-auto space-y-2">
                        {Object.entries(nomBySection).map(([section, items]) => (
                          <div key={section}>
                            <div className="text-[10px] font-medium text-slate-400 uppercase px-2 mb-1">{section}</div>
                            {items.map(item => (
                              <button key={item.item_code} type="button"
                                onClick={() => { setFolderIndex(item.item_code); setShowAllNom(false); setNomSearch('') }}
                                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                  folderIndex === item.item_code ? 'bg-[#0f2240] text-white' : 'hover:bg-white text-slate-700'
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
                  {selectedNomItem && !activeScenario && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-fit">
                      <span className="font-medium text-[#0f2240]">{folderIndex}</span>
                      <span className="text-slate-500 truncate">{selectedNomItem.name}</span>
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
            <button type="submit" disabled={saving} onClick={() => setSaveAction('save_new')}
              className="px-4 py-2 border border-[#0f2240] text-[#0f2240] rounded-xl text-xs font-medium flex items-center gap-1.5 disabled:opacity-60 hover:bg-slate-50 transition-colors">
              {saving && saveAction === 'save_new' && <Loader2 size={12} className="animate-spin" />}
              Запази и нов
            </button>
            <button type="submit" disabled={saving} onClick={() => setSaveAction('save_close')}
              className="px-5 py-2 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 disabled:opacity-60 shadow-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#0f2240' }}>
              {saving && saveAction === 'save_close' && <Loader2 size={12} className="animate-spin" />}
              {saving ? 'Записване...' : 'Запази и затвори'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
