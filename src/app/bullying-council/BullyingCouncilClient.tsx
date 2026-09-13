'use client'
import { useState, useRef, useLayoutEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ShieldAlert, Crown, User, Plus, X, Loader2, UserPlus, FileText, Trash2, CalendarDays, ChevronDown, Pencil, Download, Paperclip } from 'lucide-react'
import { generateBullyingProtocol } from '@/lib/docx-generator'

interface Member { id: string; staff_id: string | null; name: string; position: string | null; is_chair: boolean; sort: number }
interface Staff { id: string; first_name: string; last_name: string; position: string | null }
interface StudentOpt { id: string; name: string }
interface Protocol {
  id: string; number: number; date: string; kind: string
  agenda: string | null; decisions: string | null
  student_name: string | null; group_name: string | null; level: string | null; measures: string | null
  created_by: string | null
}

function PersonCombo({ people, value, onChange, placeholder }: { people: Staff[]; value: string; onChange: (id: string) => void; placeholder: string }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState('')
  const selected = people.find(p => p.id === value)
  const list = people.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'bg')).slice(0, 40)
  return (
    <div className="relative">
      <input type="text" value={selected ? `${selected.first_name} ${selected.last_name}` : q}
        onChange={e => { setQ(e.target.value); onChange(''); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" />
      {selected && <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(''); setQ('') }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
      {open && !selected && (
        <div className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
          {list.map(p => <button key={p.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(p.id); setOpen(false); setQ('') }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 text-slate-700">{p.first_name} {p.last_name}{p.position ? ` · ${p.position}` : ''}</button>)}
          {list.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Няма съвпадение</div>}
        </div>
      )}
    </div>
  )
}

function StudentCombo({ students, value, onChange }: { students: StudentOpt[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState('')
  const selected = students.find(s => s.id === value)
  const list = students.filter(s => s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40)
  return (
    <div className="relative">
      <input type="text" value={selected ? selected.name : q}
        onChange={e => { setQ(e.target.value); onChange(''); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Търси ученик по име..." className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" />
      {selected && <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(''); setQ('') }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
      {open && !selected && (
        <div className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
          {list.map(s => <button key={s.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(s.id); setOpen(false); setQ('') }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 text-slate-700">{s.name}</button>)}
          {list.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Няма съвпадение</div>}
        </div>
      )}
    </div>
  )
}

function AutoGrow({ value, onChange, placeholder, minRows = 2 }: { value: string; onChange: (v: string) => void; placeholder?: string; minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => { const el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }, [value])
  return <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={minRows}
    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none overflow-hidden" />
}

const fmtDate = (d: string) => d ? d.split('-').reverse().join('.') : ''
function suggestDesc(filename: string): string {
  let n = filename.replace(/\.[a-z0-9]+$/i, '')
  n = n.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return n.charAt(0).toUpperCase() + n.slice(1)
}
function fmtSize(b?: number | null) { if (!b) return ''; return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB' }
const DOC_CATEGORIES: { key: string; label: string }[] = [
  { key: 'prevention_plan', label: 'План за превенция' },
  { key: 'uks_plan', label: 'План на УКС' },
  { key: 'materials', label: 'Материали / анкети' },
  { key: 'other', label: 'Други документи' },
]
interface DocRow { id: string; category: string; name: string; description: string | null; path: string; size: number | null; mime_type: string | null }

export default function BullyingCouncilClient({ meId, isManager, members, staff, protocols, students, documents, academicYearId, yearName }: {
  meId: string; isManager: boolean; members: Member[]; staff: Staff[]; protocols: Protocol[]; students: StudentOpt[]; documents: DocRow[]; academicYearId: string | null; yearName: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [list, setList] = useState<Member[]>(members)
  const [busy, setBusy] = useState(false)
  const [addStaffId, setAddStaffId] = useState('')
  const [openComp, setOpenComp] = useState(false)
  const [extName, setExtName] = useState(''); const [extPos, setExtPos] = useState('')

  // Заседания
  const [prots, setProts] = useState<Protocol[]>(protocols)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [kind, setKind] = useState<'general' | 'case'>('general')
  const [pDate, setPDate] = useState(new Date().toISOString().split('T')[0])
  const [pAgenda, setPAgenda] = useState(''); const [pDecisions, setPDecisions] = useState('')
  const [pStudentId, setPStudentId] = useState(''); const [pGroup, setPGroup] = useState(''); const [pLevel, setPLevel] = useState(''); const [pMeasures, setPMeasures] = useState('')

  const usedStaff = new Set(list.map(m => m.staff_id).filter(Boolean))
  const freeStaff = staff.filter(s => !usedStaff.has(s.id))

  async function reloadMembers() {
    const { data } = await supabase.from('bullying_council_members').select('id, staff_id, name, position, is_chair, sort')
      .eq('academic_year_id', academicYearId).order('is_chair', { ascending: false }).order('sort').order('name')
    setList(data || [])
  }
  async function addStaff() {
    if (!addStaffId) return; const s = staff.find(x => x.id === addStaffId); if (!s) return
    setBusy(true)
    await supabase.from('bullying_council_members').insert({ academic_year_id: academicYearId, staff_id: s.id, name: `${s.first_name} ${s.last_name}`, position: s.position || '', is_chair: false, sort: list.length })
    setAddStaffId(''); await reloadMembers(); setBusy(false); router.refresh()
  }
  async function addExternal() {
    if (!extName.trim()) return
    setBusy(true)
    await supabase.from('bullying_council_members').insert({ academic_year_id: academicYearId, staff_id: null, name: extName.trim(), position: extPos.trim() || '', is_chair: false, sort: list.length })
    setExtName(''); setExtPos(''); await reloadMembers(); setBusy(false); router.refresh()
  }
  async function removeMember(id: string) { setBusy(true); await supabase.from('bullying_council_members').delete().eq('id', id); await reloadMembers(); setBusy(false); router.refresh() }
  async function setChair(id: string) {
    setBusy(true)
    await supabase.from('bullying_council_members').update({ is_chair: false }).eq('academic_year_id', academicYearId)
    await supabase.from('bullying_council_members').update({ is_chair: true }).eq('id', id)
    await reloadMembers(); setBusy(false); router.refresh()
  }

  function resetForm() { setKind('general'); setPDate(new Date().toISOString().split('T')[0]); setPAgenda(''); setPDecisions(''); setPStudentId(''); setPGroup(''); setPLevel(''); setPMeasures('') }

  function openEdit(p: Protocol) {
    setEditId(p.id)
    setKind((p.kind === 'case' ? 'case' : 'general'))
    setPDate(p.date)
    setPAgenda(p.agenda || ''); setPDecisions(p.decisions || '')
    setPStudentId(students.find(s => s.name === p.student_name)?.id || '')
    setPGroup(p.group_name || ''); setPLevel(p.level || ''); setPMeasures(p.measures || '')
    setShowForm(true)
  }
  async function saveMeeting() {
    if (!pDate) return
    setSaving(true)
    const studentName = kind === 'case' ? (students.find(s => s.id === pStudentId)?.name || null) : null
    const common = {
      date: pDate, kind,
      agenda: pAgenda.trim() || null, decisions: pDecisions.trim() || null,
      student_name: studentName, group_name: kind === 'case' ? (pGroup.trim() || null) : null,
      level: kind === 'case' ? (pLevel.trim() || null) : null, measures: kind === 'case' ? (pMeasures.trim() || null) : null,
    }
    if (editId) {
      const { data, error } = await supabase.from('bullying_protocols').update(common).eq('id', editId).select('*').single()
      setSaving(false)
      if (error || !data) { alert('Грешка при запис: ' + (error?.message || '')); return }
      setProts(prev => prev.map(p => p.id === editId ? (data as Protocol) : p))
    } else {
      const nextNum = (prots.reduce((m, p) => Math.max(m, p.number), 0)) + 1
      const { data, error } = await supabase.from('bullying_protocols').insert({ ...common, academic_year_id: academicYearId, number: nextNum, created_by: meId }).select('*').single()
      setSaving(false)
      if (error || !data) { alert('Грешка при запис: ' + (error?.message || '')); return }
      setProts(prev => [data as Protocol, ...prev])
    }
    setShowForm(false); setEditId(null); resetForm(); router.refresh()
  }
  async function removeMeeting(id: string) {
    if (!confirm('Изтриване на заседанието?')) return
    await supabase.from('bullying_protocols').delete().eq('id', id)
    setProts(prev => prev.filter(p => p.id !== id)); router.refresh()
  }
  function genProtocol(p: Protocol) {
    generateBullyingProtocol(p, list.map(m => ({ name: m.name, position: m.position, is_chair: m.is_chair })))
  }

  // ── Документи ──
  const [docs, setDocs] = useState<DocRow[]>(documents)
  const [uploadingCat, setUploadingCat] = useState<string | null>(null)
  const [editDocId, setEditDocId] = useState<string | null>(null)
  const [editDocDesc, setEditDocDesc] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingCat = useRef<string | null>(null)

  function pickFile(cat: string) { pendingCat.current = cat; fileRef.current?.click() }
  async function onFiles(listFiles: FileList | null) {
    const cat = pendingCat.current; if (!cat || !listFiles) return
    setUploadingCat(cat)
    for (const file of Array.from(listFiles)) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
      const path = `${cat}/${Date.now()}_${safe}`
      const { error } = await supabase.storage.from('bullying-council').upload(path, file)
      if (error) { alert('Грешка при качване: ' + file.name); continue }
      const { data } = await supabase.from('bullying_documents')
        .insert({ academic_year_id: academicYearId, category: cat, name: file.name, description: suggestDesc(file.name), path, size: file.size, mime_type: file.type, uploaded_by: meId })
        .select('*').single()
      if (data) setDocs(prev => [data as DocRow, ...prev])
    }
    setUploadingCat(null); if (fileRef.current) fileRef.current.value = ''; router.refresh()
  }
  async function downloadDoc(d: DocRow) {
    const { data, error } = await supabase.storage.from('bullying-council').download(d.path)
    if (error || !data) { alert('Грешка при сваляне'); return }
    const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = d.name; a.click(); URL.revokeObjectURL(url)
  }
  async function removeDoc(d: DocRow) {
    if (!confirm(`Изтриване на „${d.name}"?`)) return
    await supabase.storage.from('bullying-council').remove([d.path])
    await supabase.from('bullying_documents').delete().eq('id', d.id)
    setDocs(prev => prev.filter(x => x.id !== d.id)); router.refresh()
  }
  async function saveDocDesc(id: string) {
    await supabase.from('bullying_documents').update({ description: editDocDesc.trim() || null }).eq('id', id)
    setDocs(prev => prev.map(d => d.id === id ? { ...d, description: editDocDesc.trim() || null } : d))
    setEditDocId(null)
  }

  const chair = list.find(m => m.is_chair)
  const others = list.filter(m => !m.is_chair)
  const canEditMeeting = (p: Protocol) => isManager || p.created_by === meId

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><ShieldAlert size={20} className="text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Координационен съвет</h1>
          <p className="text-slate-500 text-sm mt-0.5">{yearName} · противодействие на тормоза и насилието</p>
        </div>
      </div>

      {/* Състав (сгъваем) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4">
        <button type="button" onClick={() => setOpenComp(v => !v)} className="w-full flex items-center justify-between gap-3 p-4">
          <h3 className="text-sm font-semibold text-slate-800">Състав <span className="text-slate-400 font-normal">({list.length} {list.length === 1 ? 'член' : 'члена'})</span></h3>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${openComp ? 'rotate-180' : ''}`} />
        </button>
        {openComp && (
        <div className="px-4 pb-4">
        {list.length === 0 && <p className="text-sm text-slate-400 mb-3">Още няма зададен състав.</p>}
        <div className="space-y-1.5">
          {chair && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-200">
              <div className="flex items-center gap-2 min-w-0"><Crown size={15} className="text-amber-500 shrink-0" /><span className="text-sm font-medium text-slate-800 truncate">{chair.name}</span>{chair.position && <span className="text-xs text-slate-500 truncate">· {chair.position}</span>}<span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">председател</span></div>
              {isManager && <button onClick={() => removeMember(chair.id)} disabled={busy} className="text-slate-400 hover:text-rose-500 p-1"><X size={14} /></button>}
            </div>
          )}
          {others.map(m => (
            <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 min-w-0"><User size={14} className="text-slate-400 shrink-0" /><span className="text-sm text-slate-700 truncate">{m.name}</span>{m.position && <span className="text-xs text-slate-400 truncate">· {m.position}</span>}{!m.staff_id && <span className="text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shrink-0">външен</span>}</div>
              {isManager && <div className="flex items-center gap-1 shrink-0"><button onClick={() => setChair(m.id)} disabled={busy} title="Направи председател" className="text-slate-400 hover:text-amber-500 p-1"><Crown size={13} /></button><button onClick={() => removeMember(m.id)} disabled={busy} title="Премахни" className="text-slate-400 hover:text-rose-500 p-1"><X size={14} /></button></div>}
            </div>
          ))}
        </div>
        {isManager && (
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]"><label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Добави служител</label><PersonCombo people={freeStaff} value={addStaffId} onChange={setAddStaffId} placeholder="Търси колега по име..." /></div>
              <button onClick={addStaff} disabled={busy || !addStaffId} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Добави</button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]"><label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Външен член — име</label><input value={extName} onChange={e => setExtName(e.target.value)} placeholder="напр. Ивелина Василева" className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white" /></div>
              <div className="w-40"><label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Роля</label><input value={extPos} onChange={e => setExtPos(e.target.value)} placeholder="родител / лекар" className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white" /></div>
              <button onClick={addExternal} disabled={busy || !extName.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"><UserPlus size={14} /> Външен</button>
            </div>
          </div>
        )}
        </div>
        )}
      </div>

      {/* Заседания */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Заседания</h3>
          <button onClick={() => { setShowForm(v => !v); if (!showForm) { resetForm(); setEditId(null) } }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
            <Plus size={14} className={showForm ? 'rotate-45 transition-transform' : 'transition-transform'} /> {showForm ? 'Затвори' : 'Ново заседание'}
          </button>
        </div>

        {showForm && (
          <div className="mb-4 p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1.5">
                {([['general', 'Общо заседание'], ['case', 'По казус']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setKind(v)}
                    className="px-3 py-1.5 rounded-xl text-sm border transition-all"
                    style={kind === v ? { backgroundColor: '#475569', color: '#fff', borderColor: '#475569' } : { backgroundColor: '#fff', color: '#475569', borderColor: '#e2e8f0' }}>{l}</button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <label className="text-xs text-slate-500">Дата</label>
                <input type="date" value={pDate} onChange={e => setPDate(e.target.value)} className="text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white" />
              </div>
            </div>

            {kind === 'case' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div><label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Ученик</label><StudentCombo students={students} value={pStudentId} onChange={setPStudentId} /></div>
                <div><label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Група / паралелка</label><input value={pGroup} onChange={e => setPGroup(e.target.value)} placeholder="напр. 24-група" className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white" /></div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">{kind === 'case' ? 'Описание на случая' : 'Дневен ред'}</label>
              <AutoGrow value={pAgenda} onChange={setPAgenda} placeholder={kind === 'case' ? 'Какво се е случило, обстоятелства...' : '1. ...\n2. ...'} />
            </div>

            {kind === 'case' && (
              <div>
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Ниво на проявата</label>
                <input value={pLevel} onChange={e => setPLevel(e.target.value)} placeholder="напр. 3-то ниво – физическа агресия" className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white" />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Решения</label>
              <AutoGrow value={pDecisions} onChange={setPDecisions} placeholder="Взетите решения..." />
            </div>

            {kind === 'case' && (
              <div>
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Мерки</label>
                <AutoGrow value={pMeasures} onChange={setPMeasures} placeholder="напр. информиране на родителите, сигнал до ОЗД..." />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowForm(false); setEditId(null) }} disabled={saving} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">Отказ</button>
              <button onClick={saveMeeting} disabled={saving || !pDate} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Запази</button>
            </div>
          </div>
        )}

        {prots.length === 0 ? (
          <p className="text-sm text-slate-400">Още няма заседания.</p>
        ) : (
          <div className="space-y-1.5">
            {prots.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-slate-100 bg-slate-50/60">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">Протокол № {p.number}</span>
                    <span className="text-xs text-slate-400 inline-flex items-center gap-1"><CalendarDays size={11} /> {fmtDate(p.date)}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${p.kind === 'case' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{p.kind === 'case' ? 'по казус' : 'общо'}</span>
                  </div>
                  {p.kind === 'case' && p.student_name && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{p.student_name}{p.group_name ? ` · ${p.group_name}` : ''}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => genProtocol(p)} title="Свали протокол (Word)" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border shrink-0 hover:bg-slate-50" style={{ color: '#0f2240', borderColor: 'rgba(15,34,64,0.28)' }}><FileText size={13} /> Протокол</button>
                  {canEditMeeting(p) && <button onClick={() => openEdit(p)} title="Редактирай" className="p-1.5 text-slate-400 hover:text-slate-700"><Pencil size={13} /></button>}
                  {canEditMeeting(p) && <button onClick={() => removeMeeting(p.id)} title="Изтрий" className="p-1.5 text-slate-400 hover:text-rose-500"><Trash2 size={13} /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Документи */}
      <input ref={fileRef} type="file" multiple className="hidden" onChange={e => onFiles(e.target.files)} />
      <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Документи</h3>
        <div className="space-y-4">
          {DOC_CATEGORIES.map(cat => {
            const files = docs.filter(d => d.category === cat.key)
            return (
              <div key={cat.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{cat.label}</span>
                  <button onClick={() => pickFile(cat.key)} disabled={uploadingCat === cat.key}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-50">
                    {uploadingCat === cat.key ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Качи
                  </button>
                </div>
                {files.length === 0 ? (
                  <p className="text-xs text-slate-300 italic pl-1">— няма файлове</p>
                ) : (
                  <div className="space-y-1">
                    {files.map(d => (
                      <div key={d.id} className="group flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-100 bg-slate-50/60">
                        <Paperclip size={13} className="text-slate-400 shrink-0" />
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => editDocId !== d.id && downloadDoc(d)}>
                          {editDocId === d.id ? (
                            <input value={editDocDesc} autoFocus onChange={e => setEditDocDesc(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveDocDesc(d.id) }} onBlur={() => saveDocDesc(d.id)}
                              className="w-full text-sm rounded border border-slate-300 px-2 py-1" onClick={e => e.stopPropagation()} />
                          ) : (
                            <div className="text-sm text-slate-700 truncate">{d.description || d.name}</div>
                          )}
                          <div className="text-[10px] text-slate-400">{d.name}{d.size ? ` · ${fmtSize(d.size)}` : ''}</div>
                        </div>
                        <button onClick={() => { setEditDocId(d.id); setEditDocDesc(d.description || '') }} title="Редактирай описанието" className="p-1 text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100"><Pencil size={12} /></button>
                        <button onClick={() => downloadDoc(d)} title="Изтегли" className="p-1 text-slate-400 hover:text-[#0f2240]"><Download size={13} /></button>
                        <button onClick={() => removeDoc(d)} title="Изтрий" className="p-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
