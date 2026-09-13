'use client'
import { useState, useRef, useLayoutEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  ShieldAlert, Crown, User, Plus, X, Loader2, UserPlus, 
  FileText, Trash2, CalendarDays, ChevronDown, Pencil, 
  Download, Paperclip, FolderArchive, FilePlus2, Search,
  Users, UserCog, CheckCircle2, AlertCircle
} from 'lucide-react'
import { generateBullyingProtocol } from '@/lib/docx-generator'

interface Member { id: string; staff_id: string | null; name: string; position: string | null; is_chair: boolean; sort: number }
interface Staff { id: string; first_name: string; last_name: string; position: string | null }
interface StudentOpt { id: string; name: string }
interface Protocol {
  id: string; number: number; date: string; kind: string
  agenda: string | null; decisions: string | null
  student_name: string | null; group_name: string | null; level: string | null; measures: string | null
  file_url: string | null
  created_by: string | null
}

function PersonCombo({ people, value, onChange, placeholder }: { people: Staff[]; value: string; onChange: (id: string) => void; placeholder: string }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState('')
  const selected = people.find(p => p.id === value)
  const list = people.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'bg')).slice(0, 40)
  return (
    <div className="relative">
      <div className="relative">
        {!selected && <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />}
        <input type="text" value={selected ? `${selected.first_name} ${selected.last_name}` : q}
          onChange={e => { setQ(e.target.value); onChange(''); setOpen(true) }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder} 
          className={`w-full py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm transition-all focus:bg-white focus:outline-none focus:border-[#0f2240] focus:ring-4 focus:ring-[#0f2240]/10 ${selected ? 'px-3 font-medium text-slate-800' : 'pl-9 pr-3 text-slate-600'}`} 
        />
        {selected && <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(''); setQ('') }} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"><X size={14} /></button>}
      </div>
      {open && !selected && (
        <div className="absolute z-30 mt-1.5 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl py-1">
          {list.map(p => (
            <button key={p.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(p.id); setOpen(false); setQ('') }} 
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50/80 text-slate-700 flex flex-col transition-colors">
              <span className="font-medium">{p.first_name} {p.last_name}</span>
              {p.position && <span className="text-xs text-slate-400 mt-0.5">{p.position}</span>}
            </button>
          ))}
          {list.length === 0 && <div className="px-4 py-3 text-sm text-slate-400 text-center flex items-center justify-center gap-2"><AlertCircle size={14}/> Няма намерени служители</div>}
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
      <div className="relative">
        {!selected && <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />}
        <input type="text" value={selected ? selected.name : q}
          onChange={e => { setQ(e.target.value); onChange(''); setOpen(true) }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Търси ученик по име..." 
          className={`w-full py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm transition-all focus:bg-white focus:outline-none focus:border-[#0f2240] focus:ring-4 focus:ring-[#0f2240]/10 ${selected ? 'px-3 font-medium text-slate-800' : 'pl-9 pr-3 text-slate-600'}`} 
        />
        {selected && <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(''); setQ('') }} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"><X size={14} /></button>}
      </div>
      {open && !selected && (
        <div className="absolute z-30 mt-1.5 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl py-1">
          {list.map(s => (
            <button key={s.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(s.id); setOpen(false); setQ('') }} 
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50/80 text-slate-700 font-medium transition-colors">
              {s.name}
            </button>
          ))}
          {list.length === 0 && <div className="px-4 py-3 text-sm text-slate-400 text-center flex items-center justify-center gap-2"><AlertCircle size={14}/> Няма намерени ученици</div>}
        </div>
      )}
    </div>
  )
}

function AutoGrow({ value, onChange, placeholder, minRows = 2 }: { value: string; onChange: (v: string) => void; placeholder?: string; minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => { const el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }, [value])
  return <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={minRows}
    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm transition-all focus:bg-white focus:outline-none focus:border-[#0f2240] focus:ring-4 focus:ring-[#0f2240]/10 resize-none overflow-hidden placeholder:text-slate-400" />
}

const fmtDate = (d: string) => d ? d.split('-').reverse().join('.') : ''
function suggestDesc(filename: string): string {
  let n = filename.replace(/\.[a-z0-9]+$/i, '')
  n = n.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return n.charAt(0).toUpperCase() + n.slice(1)
}
function fmtSize(b?: number | null) { if (!b) return ''; return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB' }

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

  // Подписан скан на протокола (на самото заседание)
  const protoFileRef = useRef<HTMLInputElement>(null)
  const pendingProto = useRef<string | null>(null)
  const [uploadingProto, setUploadingProto] = useState<string | null>(null)
  function pickProtoScan(id: string) { pendingProto.current = id; protoFileRef.current?.click() }
  async function onProtoScan(listFiles: FileList | null) {
    const id = pendingProto.current; if (!id || !listFiles || !listFiles[0]) return
    const file = listFiles[0]; setUploadingProto(id)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
    const path = `protocols/${id}_${Date.now()}_${safe}`
    const { error } = await supabase.storage.from('bullying-council').upload(path, file)
    if (!error) { await supabase.from('bullying_protocols').update({ file_url: path }).eq('id', id); setProts(prev => prev.map(p => p.id === id ? { ...p, file_url: path } : p)) }
    else alert('Грешка при качване: ' + file.name)
    setUploadingProto(null); if (protoFileRef.current) protoFileRef.current.value = ''; router.refresh()
  }
  async function downloadScan(p: Protocol) {
    if (!p.file_url) return
    const { data, error } = await supabase.storage.from('bullying-council').download(p.file_url)
    if (error || !data) { alert('Грешка при сваляне'); return }
    const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = `протокол_${p.number}_подписан`; a.click(); URL.revokeObjectURL(url)
  }
  async function removeScan(p: Protocol) {
    if (!p.file_url || !confirm('Премахване на качения скан?')) return
    await supabase.storage.from('bullying-council').remove([p.file_url])
    await supabase.from('bullying_protocols').update({ file_url: null }).eq('id', p.id)
    setProts(prev => prev.map(x => x.id === p.id ? { ...x, file_url: null } : x)); router.refresh()
  }

  // ── Документи ──
  const [docs, setDocs] = useState<DocRow[]>(documents)
  const [isUploadingDoc, setIsUploadingDoc] = useState(false)
  const [editDocId, setEditDocId] = useState<string | null>(null)
  const [editDocDesc, setEditDocDesc] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function pickFile() { fileRef.current?.click() }
  async function onFiles(listFiles: FileList | null) {
    if (!listFiles) return
    setIsUploadingDoc(true)
    for (const file of Array.from(listFiles)) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
      const path = `docs/${Date.now()}_${safe}`
      const { error } = await supabase.storage.from('bullying-council').upload(path, file)
      if (error) { alert('Грешка при качване: ' + file.name); continue }
      
      const { data } = await supabase.from('bullying_documents')
        .insert({ academic_year_id: academicYearId, category: 'general', name: file.name, description: suggestDesc(file.name), path, size: file.size, mime_type: file.type, uploaded_by: meId })
        .select('*').single()
        
      if (data) setDocs(prev => [data as DocRow, ...prev])
    }
    setIsUploadingDoc(false); if (fileRef.current) fileRef.current.value = ''; router.refresh()
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
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 bg-slate-50/50 min-h-screen">
      
      {/* Заглавка */}
      <div className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-3.5 rounded-2xl shadow-inner" style={{ backgroundColor: '#0f2240' }}><ShieldAlert size={28} className="text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">Координационен съвет</h1>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
            <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{yearName}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            Противодействие на тормоза и насилието
          </p>
        </div>
      </div>

      {/* Състав */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300">
        <button type="button" onClick={() => setOpenComp(v => !v)} className="w-full flex items-center justify-between gap-3 p-5 hover:bg-slate-50/80 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50/80 p-2.5 rounded-xl text-blue-600 group-hover:scale-105 transition-transform"><Users size={20} /></div>
            <div className="text-left">
              <h3 className="text-base font-bold text-slate-800">Състав на съвета</h3>
              <p className="text-xs text-slate-500 mt-0.5">Всички членове и председател</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold tracking-wide">{list.length} ЧЛЕНА</span>
            <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ${openComp ? 'rotate-180' : ''}`} />
          </div>
        </button>
        
        {openComp && (
        <div className="px-5 pb-5 border-t border-slate-100 mt-1 pt-5 bg-slate-50/30">
        {list.length === 0 && (
          <div className="text-center py-8">
            <UserCog size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500 font-medium">Още няма зададен състав за тази година.</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {chair && (
            <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 shadow-sm col-span-full group/card transition-all">
              <div className="flex items-center gap-4 min-w-0">
                <div className="bg-amber-100/80 p-2.5 rounded-xl"><Crown size={20} className="text-amber-600 shrink-0" /></div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-bold text-slate-800 truncate">{chair.name}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 bg-amber-100/50 px-2 py-0.5 rounded-md">Председател</span>
                    {chair.position && <span className="text-xs font-medium text-slate-500 truncate">{chair.position}</span>}
                  </div>
                </div>
              </div>
              {isManager && <button onClick={() => removeMember(chair.id)} disabled={busy} title="Премахни" className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors opacity-0 group-hover/card:opacity-100"><X size={18} /></button>}
            </div>
          )}
          {others.map(m => (
            <div key={m.id} className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all group/card">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg"><User size={16} className="text-slate-400" /></div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-slate-700 truncate">{m.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {!m.staff_id && <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">Външен</span>}
                    {m.position && <span className="text-xs font-medium text-slate-400 truncate">{m.position}</span>}
                  </div>
                </div>
              </div>
              {isManager && (
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <button onClick={() => setChair(m.id)} disabled={busy} title="Направи председател" className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 p-1.5 rounded-lg transition-colors"><Crown size={16} /></button>
                  <button onClick={() => removeMember(m.id)} disabled={busy} title="Премахни" className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"><X size={16} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {isManager && (
          <div className="mt-6 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden">
            {/* Декоративен кант */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
            
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <UserCog size={14} className="text-blue-500" /> Управление на състава
            </h4>
            
            <div className="flex flex-col lg:flex-row gap-5">
              <div className="flex-1 space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Добави служител</label>
                <div className="flex gap-2">
                  <div className="flex-1"><PersonCombo people={freeStaff} value={addStaffId} onChange={setAddStaffId} placeholder="Търси по име..." /></div>
                  <button onClick={addStaff} disabled={busy || !addStaffId} className="h-[42px] px-4 rounded-xl text-sm font-semibold text-white shadow-md disabled:opacity-50 flex items-center justify-center min-w-[100px] transition-transform active:scale-[0.98]" style={{ backgroundColor: '#0f2240' }}>{busy ? <Loader2 size={16} className="animate-spin" /> : 'Добави'}</button>
                </div>
              </div>
              
              <div className="w-px bg-slate-200 hidden lg:block"></div>
              
              <div className="flex-1 space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Добави външен член</label>
                <div className="flex gap-2">
                  <input value={extName} onChange={e => setExtName(e.target.value)} placeholder="Име и фамилия" className="flex-1 w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-[#0f2240]/10 focus:border-[#0f2240] outline-none transition-all placeholder:text-slate-400" />
                  <input value={extPos} onChange={e => setExtPos(e.target.value)} placeholder="Роля / позиция" className="w-[120px] text-sm rounded-xl border border-slate-200 px-3 py-2.5 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-[#0f2240]/10 focus:border-[#0f2240] outline-none transition-all placeholder:text-slate-400" />
                  <button onClick={addExternal} disabled={busy || !extName.trim()} className="h-[42px] px-4 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-[#0f2240] hover:border-[#0f2240]/30 disabled:opacity-50 flex items-center justify-center transition-all active:scale-[0.98] shadow-sm"><UserPlus size={18} /></button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
        )}
      </div>

      {/* Заседания */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50/80 p-2.5 rounded-xl text-emerald-600"><CalendarDays size={20} /></div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Заседания и протоколи</h3>
              <p className="text-xs text-slate-500 mt-0.5">Регистър на проведените срещи</p>
            </div>
          </div>
          <button onClick={() => { setShowForm(v => !v); if (!showForm) { resetForm(); setEditId(null) } }}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all active:scale-[0.98] ${showForm ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200' : 'text-white hover:shadow-lg'}`}
            style={showForm ? {} : { backgroundColor: '#0f2240' }}>
            <Plus size={18} className={showForm ? 'rotate-45 transition-transform duration-300' : 'transition-transform duration-300'} /> 
            {showForm ? 'Отказ' : 'Ново заседание'}
          </button>
        </div>

        {showForm && (
          <div className="mb-8 p-6 rounded-2xl border border-slate-200 bg-slate-50/50 shadow-inner relative overflow-hidden">
            {/* Декоративен кант */}
            <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: '#0f2240' }}></div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-slate-200 pb-5 mb-5">
              
              {/* Segmented Control */}
              <div className="bg-slate-200/60 p-1 rounded-xl inline-flex shadow-inner">
                {([['general', 'Общо заседание'], ['case', 'По казус']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setKind(v)}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                      kind === v 
                        ? 'bg-white text-[#0f2240] shadow-sm ring-1 ring-slate-900/5' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                <CalendarDays size={16} className="text-slate-400" />
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Дата:</label>
                <input type="date" value={pDate} onChange={e => setPDate(e.target.value)} className="text-sm font-medium text-slate-800 bg-transparent outline-none cursor-pointer" />
              </div>
            </div>

            <div className="space-y-5">
              {kind === 'case' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-white rounded-xl border border-rose-100 shadow-sm relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-400"></div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><User size={12} className="text-rose-400"/> Ученик</label>
                    <StudentCombo students={students} value={pStudentId} onChange={setPStudentId} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Група / паралелка</label>
                    <input value={pGroup} onChange={e => setPGroup(e.target.value)} placeholder="напр. 10 'А' клас" className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm transition-all focus:bg-white focus:outline-none focus:border-[#0f2240] focus:ring-4 focus:ring-[#0f2240]/10 placeholder:text-slate-400" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                  {kind === 'case' ? 'Описание на случая / Обстоятелства' : 'Дневен ред'}
                </label>
                <AutoGrow value={pAgenda} onChange={setPAgenda} placeholder={kind === 'case' ? 'Опишете накратко фактите и обстоятелствата около случая...' : '1. Разглеждане на превантивния план...\n2. Други...'} minRows={3} />
              </div>

              {kind === 'case' && (
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Ниво на проявата според алгоритъма</label>
                  <input value={pLevel} onChange={e => setPLevel(e.target.value)} placeholder="напр. Трето ниво – физическа агресия" className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm transition-all focus:bg-white focus:outline-none focus:border-[#0f2240] focus:ring-4 focus:ring-[#0f2240]/10 placeholder:text-slate-400" />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-500"/> Взети решения
                </label>
                <AutoGrow value={pDecisions} onChange={setPDecisions} placeholder="Опишете какви решения е взел съветът..." minRows={3} />
              </div>

              {kind === 'case' && (
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Предприети мерки</label>
                  <AutoGrow value={pMeasures} onChange={setPMeasures} placeholder="напр. Информиране на родителите, работа с психолог..." />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-slate-200">
              <button onClick={() => { setShowForm(false); setEditId(null) }} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors">Отказ</button>
              <button onClick={saveMeeting} disabled={saving || !pDate} className="inline-flex items-center justify-center min-w-[140px] gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md disabled:opacity-50 transition-transform active:scale-[0.98]" style={{ backgroundColor: '#0f2240' }}>{saving ? <Loader2 size={18} className="animate-spin" /> : (editId ? 'Обнови' : 'Запази протокола')}</button>
            </div>
          </div>
        )}

        {prots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
            <div className="bg-white p-4 rounded-full shadow-sm mb-4"><CalendarDays size={32} className="text-slate-300" /></div>
            <p className="text-base font-bold text-slate-700">Няма проведени заседания</p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm text-center">Използвайте бутона горе вдясно, за да създадете първия протокол на съвета.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <input ref={protoFileRef} type="file" className="hidden" onChange={e => onProtoScan(e.target.files)} />
            {prots.map(p => (
              <div key={p.id} className="group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 lg:p-5 rounded-2xl border border-slate-200 bg-white hover:border-[#0f2240]/20 hover:shadow-md transition-all duration-300 relative overflow-hidden">
                {/* Индикатор за вид заседание (лента отляво) */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${p.kind === 'case' ? 'bg-rose-400' : 'bg-slate-300'}`}></div>
                
                <div className="min-w-0 flex-1 pl-2">
                  <div className="flex items-center gap-3 flex-wrap mb-1.5">
                    <span className="text-base font-extrabold text-slate-800">Протокол № {p.number}</span>
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md flex items-center gap-1.5"><CalendarDays size={12} /> {fmtDate(p.date)}</span>
                    <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-md ${p.kind === 'case' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>{p.kind === 'case' ? 'По казус' : 'Общо заседание'}</span>
                  </div>
                  
                  {p.kind === 'case' && p.student_name ? (
                     <div className="text-sm font-medium text-slate-700 truncate flex items-center gap-1.5">
                       <User size={14} className="text-rose-400"/> {p.student_name}
                       {p.group_name && <span className="text-xs font-normal text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">({p.group_name})</span>}
                     </div>
                  ) : (
                    <div className="text-sm text-slate-500 truncate max-w-2xl font-medium">{p.agenda ? p.agenda.split('\n')[0] : 'Няма въведен дневен ред'}</div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-5">
                  {p.file_url ? (
                    <button onClick={() => downloadScan(p)} title="Изтегли подписания скан" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-all shadow-sm active:scale-[0.98]">
                      <CheckCircle2 size={16} /> Подписан
                    </button>
                  ) : (
                    <button onClick={() => pickProtoScan(p.id)} disabled={uploadingProto === p.id} title="Качи подписания скан" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50">
                      {uploadingProto === p.id ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />} Качи подписан
                    </button>
                  )}
                  <button onClick={() => genProtocol(p)} title="Свали като Word" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-slate-50 border border-slate-200 text-[#0f2240] hover:bg-[#0f2240] hover:text-white hover:border-[#0f2240] transition-all shadow-sm active:scale-[0.98]">
                    <FileText size={16} /> Word
                  </button>
                  {canEditMeeting(p) && (
                    <div className="flex gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {p.file_url && <button onClick={() => removeScan(p)} title="Премахни скана" className="p-2.5 text-slate-400 hover:text-white hover:bg-rose-500 rounded-xl transition-colors"><X size={16} /></button>}
                      <button onClick={() => openEdit(p)} title="Редактирай" className="p-2.5 text-slate-400 hover:text-[#0f2240] hover:bg-slate-100 rounded-xl transition-colors"><Pencil size={16} /></button>
                      <button onClick={() => removeMeeting(p.id)} title="Изтрий" className="p-2.5 text-slate-400 hover:text-white hover:bg-rose-500 rounded-xl transition-colors"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ДОКУМЕНТИ - ИЗЧИСТЕН ИЗГЛЕД */}
      <input ref={fileRef} type="file" multiple className="hidden" onChange={e => onFiles(e.target.files)} />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
             <div className="bg-purple-50/80 p-2.5 rounded-xl text-purple-600"><FolderArchive size={20} /></div>
             <div>
               <h3 className="text-base font-bold text-slate-800">Архив документи</h3>
               <p className="text-xs text-slate-500 mt-0.5">Всички прикачени файлове и материали</p>
             </div>
          </div>
          
          <button onClick={() => pickFile()} disabled={isUploadingDoc}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {isUploadingDoc ? <Loader2 size={18} className="animate-spin" /> : <FilePlus2 size={18} />} 
            Качи документ
          </button>
        </div>

        {/* Списък с файлове */}
        <div className="min-h-[150px]">
          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <div className="bg-white p-4 rounded-full shadow-sm mb-4"><FileText size={32} className="text-slate-300" /></div>
              <p className="text-base font-bold text-slate-700">Все още няма качени документи</p>
              <button onClick={() => pickFile()} className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                Качете първия файл тук
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {docs.map(d => (
                <div key={d.id} className="group flex items-start gap-4 p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#0f2240]/30 hover:shadow-md transition-all">
                  <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl shrink-0 mt-0.5 group-hover:bg-[#0f2240]/5 transition-colors">
                    <Paperclip size={18} className="text-[#0f2240]/60" />
                  </div>
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => editDocId !== d.id && downloadDoc(d)}>
                    {editDocId === d.id ? (
                      <input value={editDocDesc} autoFocus onChange={e => setEditDocDesc(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveDocDesc(d.id) }} onBlur={() => saveDocDesc(d.id)}
                        className="w-full text-sm font-semibold rounded-lg border-2 border-[#0f2240] px-3 py-1.5 shadow-sm outline-none" onClick={e => e.stopPropagation()} />
                    ) : (
                      <div className="text-sm font-bold text-slate-800 truncate group-hover:text-[#0f2240] transition-colors" title={d.description || d.name}>
                        {d.description || d.name}
                      </div>
                    )}
                    <div className="text-[11px] font-medium text-slate-400 mt-1.5 truncate bg-slate-50 inline-block px-2 py-0.5 rounded-md border border-slate-100">
                      {d.name}{d.size ? ` • ${fmtSize(d.size)}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => downloadDoc(d)} title="Изтегли" className="p-2 text-slate-400 hover:text-[#0f2240] bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"><Download size={14} /></button>
                    <div className="flex gap-1.5">
                       <button onClick={() => { setEditDocId(d.id); setEditDocDesc(d.description || '') }} title="Редактирай името" className="p-2 text-slate-400 hover:text-[#0f2240] bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"><Pencil size={14} /></button>
                       <button onClick={() => removeDoc(d)} title="Изтрий" className="p-2 text-slate-400 hover:text-white hover:bg-rose-500 bg-slate-50 rounded-xl transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
