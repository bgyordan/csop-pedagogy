'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, FileText, Loader2, User, GraduationCap, ChevronDown, ArrowDownLeft, ArrowUpRight, Zap } from 'lucide-react'

// Бързи сценарии
const QUICK_SCENARIOS: Record<string, {
  label: string
  icon: 'staff' | 'student'
  index: string
  template: string
  directions: ('incoming' | 'outgoing')[]
}> = {
  vacation: { label: 'Отпуск', icon: 'staff', index: 'ЛС-02', template: 'Заявление за отпуск', directions: ['incoming'] },
  enrollment: { label: 'Прием на ученик', icon: 'student', index: 'УВД-09', template: 'Заявление за прием на {name}', directions: ['incoming'] },
  coud: { label: 'ЦОУД', icon: 'student', index: 'УВД-12', template: 'Молба за ЦОУД на {name}', directions: ['incoming'] },
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

  const currentYear = new Date().getFullYear()
  const activeScenario = scenario ? QUICK_SCENARIOS[scenario] : null
  const selectedNomItem = nomenclature.find(n => n.item_code === folderIndex)

  const nextNum = String(totalCount + 1).padStart(3, '0')
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

    const { count } = await supabase.from('correspondence')
      .select('id', { count: 'exact', head: true })
      .eq('direction', direction)
      .gte('date', `${currentYear}-01-01`)
      .lte('date', `${currentYear}-12-31`)

    const num = String((count || 0) + 1).padStart(3, '0')
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
    })

    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }
    setSaving(false)
    router.refresh()
    if (saveAction === 'save_new') {
      setScenario(null); setFolderIndex('')
      setDocDate(new Date().toISOString().split('T')[0])
      setFromWhom(''); setToWhom(''); setSubject(''); setDescription('')
      setStudentId(''); setStaffId(''); setUploadedFile(null)
      setGuardians([])
      setNomSearch(''); setShowAllNom(false)
    } else {
      onSaved()
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border border-slate-200/80 max-w-xl w-full shadow-2xl flex flex-col" style={{ height: '85vh' }}>

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
