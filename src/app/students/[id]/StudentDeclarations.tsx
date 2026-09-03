'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileCheck, Upload, Download, Trash2, Loader2, AlertTriangle, ShieldCheck, ShieldX, Plus, X } from 'lucide-react'

// Временни типове — етикетите се сменят лесно после
const DECL_TYPES: { code: string; label: string }[] = [
  { code: 'decl_1', label: 'Декларация 1' },
  { code: 'decl_2', label: 'Декларация 2' },
  { code: 'decl_3', label: 'Декларация 3' },
  { code: 'decl_4', label: 'Декларация 4' },
  { code: 'decl_5', label: 'Декларация 5' },
  { code: 'decl_6', label: 'Декларация 6' },
  { code: 'decl_7', label: 'Декларация 7' },
]
const MONTHS = ['—', 'януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']

interface Decl { id: string; decl_type: string; name: string; path: string; size: number | null; valid_month: number | null; valid_year: number | null }

function labelFor(code: string) { return DECL_TYPES.find(t => t.code === code)?.label || code }
function fmtSize(b: number | null) { if (!b) return ''; if (b < 1024) return `${b} B`; if (b < 1048576) return `${Math.round(b/1024)} KB`; return `${(b/1048576).toFixed(1)} MB` }

// Статус по валидност (месец+година): изтекла / изтича (месец преди) / валидна
function validityStatus(m: number | null, y: number | null): { level: 'ok' | 'warn' | 'err' | 'none'; text: string } {
  if (!m || !y) return { level: 'none', text: 'без срок' }
  const now = new Date()
  const end = new Date(y, m, 0) // последен ден на месеца
  const monthBefore = new Date(y, m - 1, 1); monthBefore.setMonth(monthBefore.getMonth() - 1)
  if (now > end) return { level: 'err', text: `изтекла (${MONTHS[m]} ${y})` }
  if (now >= monthBefore) return { level: 'warn', text: `изтича ${MONTHS[m]} ${y}` }
  return { level: 'ok', text: `валидна до ${MONTHS[m]} ${y}` }
}

export default function StudentDeclarations({ studentId, canManage }: { studentId: string; canManage: boolean }) {
  const supabase = createClient()
  const [items, setItems] = useState<Decl[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [type, setType] = useState('decl_1')
  const [vMonth, setVMonth] = useState('')
  const [vYear, setVYear] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('student_declarations')
      .select('id, decl_type, name, path, size, valid_month, valid_year')
      .eq('student_id', studentId).order('created_at', { ascending: false })
    setItems(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [studentId])

  async function upload(file: File) {
    setBusy(true)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
    const path = `${studentId}/${Date.now()}_${safe}`
    const { error } = await supabase.storage.from('student-declarations').upload(path, file)
    if (error) { alert('Грешка при качване'); setBusy(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('staff_profiles').select('id').eq('user_id', user?.id!).single()
    await supabase.from('student_declarations').insert({
      student_id: studentId, decl_type: type, name: file.name, path, size: file.size, mime_type: file.type,
      valid_month: vMonth ? parseInt(vMonth) : null, valid_year: vYear ? parseInt(vYear) : null, uploaded_by: prof?.id,
    })
    setAdding(false); setVMonth(''); setVYear(''); setType('decl_1')
    await load(); setBusy(false)
  }
  async function download(d: Decl) {
    const { data, error } = await supabase.storage.from('student-declarations').download(d.path)
    if (error || !data) return
    const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = d.name
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }
  async function del(d: Decl) {
    if (!confirm(`Изтрий „${labelFor(d.decl_type)}"?`)) return
    await supabase.storage.from('student-declarations').remove([d.path])
    await supabase.from('student_declarations').delete().eq('id', d.id)
    setItems(prev => prev.filter(x => x.id !== d.id))
  }

  const nowY = new Date().getFullYear()
  const years = [nowY, nowY + 1, nowY + 2]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <FileCheck size={17} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-slate-800">Декларации</h3>
        </div>
        {canManage && (
          <button onClick={() => setAdding(v => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-[#0f2240] hover:underline">
            {adding ? <><X size={13} /> Затвори</> : <><Plus size={13} /> Добави</>}
          </button>
        )}
      </div>

      {adding && (
        <div className="px-4 py-3 border-b border-slate-100 bg-blue-50/30 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Тип</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none">
                {DECL_TYPES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Валидна до — месец</label>
              <select value={vMonth} onChange={e => setVMonth(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none">
                <option value="">без срок</option>
                {MONTHS.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Година</label>
              <select value={vYear} onChange={e => setVYear(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none" disabled={!vMonth}>
                <option value="">—</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-300 cursor-pointer hover:border-blue-400 hover:bg-white text-sm text-slate-500">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {busy ? 'Качване…' : 'Избери файл'}
            <input ref={fileRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = '' }} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center"><Loader2 size={16} className="animate-spin inline text-slate-400" /></div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">Няма качени декларации.</div>
      ) : (
        <div className="divide-y divide-slate-50">
          {items.map(d => {
            const st = validityStatus(d.valid_month, d.valid_year)
            const badge = st.level === 'err' ? 'bg-rose-50 text-rose-600 border-rose-100'
              : st.level === 'warn' ? 'bg-amber-50 text-amber-600 border-amber-100'
              : st.level === 'ok' ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
              : 'bg-slate-100 text-slate-400 border-slate-200'
            return (
              <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 group">
                {st.level === 'err' ? <ShieldX size={16} className="text-rose-500 shrink-0" />
                  : st.level === 'warn' ? <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                  : <ShieldCheck size={16} className="text-emerald-500 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-800">{labelFor(d.decl_type)}</div>
                  <button onClick={() => download(d)} className="text-[11px] text-slate-400 hover:text-[#0f2240] hover:underline truncate max-w-full text-left">{d.name}</button>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${badge}`}>{st.text}</span>
                <button onClick={() => download(d)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] shrink-0" title="Изтегли"><Download size={14} /></button>
                {canManage && <button onClick={() => del(d)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 shrink-0" title="Изтрий"><Trash2 size={13} /></button>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
