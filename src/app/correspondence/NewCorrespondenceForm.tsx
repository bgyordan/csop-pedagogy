'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, FileText, Loader2, User, GraduationCap, ChevronDown } from 'lucide-react'

const SMART_CODES: Record<string, { type: 'staff' | 'student'; template: string }> = {
  'ЛС-02': { type: 'staff', template: 'Заявление за отпуск от {name}' },
  'УВД-09': { type: 'student', template: 'Заявление за прием на {name}' },
  'УВД-12': { type: 'student', template: 'Молба за ЦОУД на {name}' },
}

const QUICK_CODES: Record<string, string[]> = {
  incoming: ['АСД-02', 'УВД-09', 'УВД-12', 'УВД-07'],
  outgoing: ['АСД-02', 'УВД-07', 'УВД-08', 'РД-06'],
  internal: ['АСД-05', 'ЛС-02', 'РД-07', 'УВД-10'],
}

const EXTERNAL_SUGGESTIONS = [
  'МОН — Министерство на образованието и науката',
  'РУО — Варна', 'Община Варна', 'РЦПППО — Варна',
  'Агенция за социално подпомагане', 'РЗОК — Варна',
  'НОИ — Варна', 'Дирекция "Социално подпомагане"',
]

const INTERNAL_PERSONS = [
  'Светлана Иванова — Директор',
  'Йордан Йорданов — ЗДАСД',
  'Силвия Кьошкерян — ЗДУД',
  'Радка Георгиева — Счетоводство',
]

interface NomenclatureItem {
  id: string; section_code: string; item_code: string; name: string; retention_years: string
}

interface Props {
  totalCount: number
  currentUserId: string
  students: { id: string; first_name: string; last_name: string }[]
  staff: { id: string; first_name: string; last_name: string }[]
  nomenclature: NomenclatureItem[]
  onClose: () => void
  onSaved: () => void
}

export default function NewCorrespondenceForm({
  totalCount, currentUserId, students, staff, nomenclature, onClose, onSaved
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [saveAction, setSaveAction] = useState<'save_close' | 'save_new'>('save_close')
  const [direction, setDirection] = useState<'incoming' | 'outgoing' | 'internal'>('incoming')
  const [folderIndex, setFolderIndex] = useState('АСД-02')
  const [folderCount, setFolderCount] = useState<number | null>(null)
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0])
  const [fromWhom, setFromWhom] = useState('')
  const [toWhom, setToWhom] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [studentId, setStudentId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [nomSearch, setNomSearch] = useState('')
  const [showAllNom, setShowAllNom] = useState(false)

  const currentYear = new Date().getFullYear()
  const smartCode = SMART_CODES[folderIndex]
  const selectedNomItem = nomenclature.find(n => n.item_code === folderIndex)
  const nextGlobalNum = String(totalCount + 1).padStart(3, '0')
  const nextNumPreview = `${folderIndex}-${nextGlobalNum}/${docDate.split('-').reverse().join('.')}г.`

  const filteredNom = nomenclature.filter(n =>
    !nomSearch || n.item_code.toLowerCase().includes(nomSearch.toLowerCase()) || n.name.toLowerCase().includes(nomSearch.toLowerCase())
  )
  const nomBySection = filteredNom.reduce((acc, item) => {
    if (!acc[item.section_code]) acc[item.section_code] = []
    acc[item.section_code].push(item)
    return acc
  }, {} as Record<string, NomenclatureItem[]>)

  async function selectNomCode(code: string) {
    setFolderIndex(code)
    setShowAllNom(false)
    setNomSearch('')
    setStudentId('')
    setStaffId('')
    setSubject('')
    const { count } = await supabase
      .from('correspondence')
      .select('id', { count: 'exact', head: true })
      .like('number', `${code}-%`)
      .gte('date', `${currentYear}-01-01`)
      .lte('date', `${currentYear}-12-31`)
    setFolderCount(count || 0)
  }

  function changeDirection(d: 'incoming' | 'outgoing' | 'internal') {
    setDirection(d)
    setStudentId(''); setStaffId(''); setFromWhom(''); setToWhom(''); setSubject('')
    setFolderIndex(QUICK_CODES[d][0])
  }

  function handleStaffSelect(id: string) {
    setStaffId(id)
    const s = staff.find(x => x.id === id)
    if (s && smartCode) setSubject(smartCode.template.replace('{name}', `${s.first_name} ${s.last_name}`))
  }

  function handleStudentSelect(id: string) {
    setStudentId(id)
    const s = students.find(x => x.id === id)
    if (s && smartCode) {
      setSubject(smartCode.template.replace('{name}', `${s.first_name} ${s.last_name}`))
      setToWhom('Директор ЦСОП Варна')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject) { alert('Моля попълнете темата.'); return }
    setSaving(true)

    const { count } = await supabase.from('correspondence').select('id', { count: 'exact', head: true })
      .gte('date', `${currentYear}-01-01`).lte('date', `${currentYear}-12-31`)

    const num = String((count || 0) + 1).padStart(3, '0')
    const docNumber = `${folderIndex}-${num}/${docDate.split('-').reverse().join('.')}г.`

    let fileUrl = '', fileName = ''
    if (uploadedFile) {
      const ext = uploadedFile.name.split('.').pop()
      const filePath = `correspondence/${currentYear}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, uploadedFile, { upsert: true })
      if (!uploadError) { fileUrl = filePath; fileName = uploadedFile.name }
    }

    const { error } = await supabase.from('correspondence').insert({
      number: docNumber, date: docDate, direction,
      from_whom: fromWhom || null, to_whom: toWhom || null,
      subject, description: description || null,
      file_url: fileUrl || null, file_name: fileName || null,
      student_id: studentId || null, created_by: currentUserId, status: 'active',
    })

    if (error) { alert(`Грешка: ${error.message}`); setSaving(false); return }
    setSaving(false)
    router.refresh()
    if (saveAction === 'save_new') {
      setDirection('incoming'); setFolderIndex('АСД-02'); setFolderCount(null)
      setDocDate(new Date().toISOString().split('T')[0])
      setFromWhom(''); setToWhom(''); setSubject(''); setDescription('')
      setStudentId(''); setStaffId(''); setUploadedFile(null)
      setNomSearch(''); setShowAllNom(false)
    } else {
      onSaved()
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border border-slate-200/80 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Хедър */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl z-10">
          <div>
            <h3 className="font-bold text-slate-800 text-sm tracking-widest uppercase">Деловодно вписване</h3>
            <p className="text-[11px] font-mono text-[#0f2240] font-bold mt-0.5">{nextNumPreview}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Посока */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {(['incoming', 'outgoing', 'internal'] as const).map(d => (
              <button key={d} type="button" onClick={() => changeDirection(d)}
                className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${
                  direction === d
                    ? d === 'incoming' ? 'bg-white text-blue-800 shadow-sm border border-blue-100'
                    : d === 'outgoing' ? 'bg-white text-emerald-800 shadow-sm border border-emerald-100'
                    : 'bg-white text-purple-800 shadow-sm border border-purple-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}>
                {d === 'incoming' ? '↙ Входящ' : d === 'outgoing' ? '↗ Изходящ' : '⇄ Вътрешен'}
              </button>
            ))}
          </div>

          {/* Номенклатура + Дата */}
          <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Индекс от номенклатурата *</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(QUICK_CODES[direction] || []).map(code => {
                  const item = nomenclature.find(n => n.item_code === code)
                  if (!item) return null
                  return (
                    <button key={code} type="button" onClick={() => selectNomCode(code)} title={item.name}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        folderIndex === code ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}>
                      <span className="font-mono">{code}</span>
                    </button>
                  )
                })}
                <button type="button" onClick={() => setShowAllNom(!showAllNom)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${showAllNom ? 'bg-slate-200 border-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                  <ChevronDown size={12} className={`transition-transform ${showAllNom ? 'rotate-180' : ''}`} />
                  Всички...
                </button>
              </div>

              {showAllNom && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 mb-2">
                  <input autoFocus placeholder="Търси по код или наименование..."
                    value={nomSearch} onChange={e => setNomSearch(e.target.value)}
                    className="input w-full text-xs" />
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {Object.entries(nomBySection).map(([section, items]) => (
                      <div key={section}>
                        <div className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-1">{section}</div>
                        {items.map(item => (
                          <button key={item.item_code} type="button" onClick={() => selectNomCode(item.item_code)}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                              folderIndex === item.item_code ? 'bg-[#0f2240] text-white' : 'hover:bg-white text-slate-700'
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

              {/* Избраното дело — компактно */}
              {selectedNomItem && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <span className="font-mono font-bold text-[#0f2240] flex-shrink-0">{folderIndex}</span>
                  <span className="text-slate-500 truncate">{selectedNomItem.name}</span>
                </div>
              )}
            </div>

            <div className="w-32 pt-5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Дата *</label>
              <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} required className="input w-full text-xs" />
            </div>
          </div>

          {/* Умни полета */}
          {smartCode?.type === 'staff' && (
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 space-y-2">
              <label className="block text-[10px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1">
                <User size={11} /> Служител *
              </label>
              <select value={staffId} onChange={e => handleStaffSelect(e.target.value)} required className="input w-full">
                <option value="">— Избери служител —</option>
                {staff.sort((a,b) => a.last_name.localeCompare(b.last_name)).map(s => (
                 <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                ))}
              </select>
              {subject && <div className="text-xs text-purple-700 font-semibold bg-white border border-purple-100 rounded-lg px-3 py-2">{subject}</div>}
            </div>
          )}

          {smartCode?.type === 'student' && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
              <label className="block text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                <GraduationCap size={11} /> Ученик *
              </label>
              <select value={studentId} onChange={e => handleStudentSelect(e.target.value)} required className="input w-full">
                <option value="">— Избери ученик —</option>
                {students.sort((a,b) => a.last_name.localeCompare(b.last_name)).map(s => (
                  <option key={s.id} value={s.id}>{s.last_name} {s.first_name}</option>
                ))}
              </select>
              {studentId && (
                <input type="text" value={fromWhom} onChange={e => setFromWhom(e.target.value)} required
                  placeholder="От кого (родител/настойник) *" className="input w-full" />
              )}
              {subject && <div className="text-xs text-blue-700 font-semibold bg-white border border-blue-100 rounded-lg px-3 py-2">{subject}</div>}
            </div>
          )}

          {/* Стандартни полета */}
          {!smartCode && (
            <div className="space-y-3">
              {direction === 'incoming' && (
                <>
                  <input type="text" list="from-list" value={fromWhom} onChange={e => setFromWhom(e.target.value)}
                    required placeholder="От кого *" className="input w-full" />
                  <datalist id="from-list">{EXTERNAL_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
                </>
              )}
              {direction === 'outgoing' && (
                <>
                  <input type="text" list="to-list" value={toWhom} onChange={e => setToWhom(e.target.value)}
                    required placeholder="До кого *" className="input w-full" />
                  <datalist id="to-list">{EXTERNAL_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
                </>
              )}
              {direction === 'internal' && (
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" list="internal-list" value={fromWhom} onChange={e => setFromWhom(e.target.value)}
                    required placeholder="От кого *" className="input w-full" />
                  <input type="text" list="internal-list" value={toWhom} onChange={e => setToWhom(e.target.value)}
                    required placeholder="До кого *" className="input w-full" />
                  <datalist id="internal-list">{INTERNAL_PERSONS.map(s => <option key={s} value={s} />)}</datalist>
                </div>
              )}
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                required placeholder="Тема / Относно *" className="input w-full" />
            </div>
          )}

          {smartCode && !subject && (
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              required placeholder="Тема / Относно *" className="input w-full" />
          )}

          {/* Бележки — без лейбъл */}
          <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Допълнителна информация..." className="input w-full resize-none" />

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
                <Upload size={14} /><span className="text-xs font-semibold">Прикачи файл (PDF/Word, макс. 10MB)</span>
              </div>
              <input type="file" className="hidden" accept=".pdf,.doc,.docx"
                onChange={e => { const f = e.target.files?.[0]; if (f) setUploadedFile(f) }} />
            </label>
          )}

          {/* Бутони */}
          <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors">
              Отказ
            </button>
            <button type="submit" disabled={saving} onClick={() => setSaveAction('save_new')}
              className="px-4 py-2 border border-[#0f2240] text-[#0f2240] rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 hover:bg-slate-50 transition-colors">
              {saving && saveAction === 'save_new' && <Loader2 size={12} className="animate-spin" />}
              Запази и нов
            </button>
            <button type="submit" disabled={saving} onClick={() => setSaveAction('save_close')}
              className="px-5 py-2 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 shadow-sm hover:opacity-90 transition-opacity"
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
