'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileCheck, Upload, Download, Trash2, Loader2, FileText, ShieldCheck, AlertTriangle, ShieldX } from 'lucide-react'

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
const MONTHS = ['', 'януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']

interface Decl { id: string; decl_type: string; name: string; path: string; size: number | null; valid_month: number | null; valid_year: number | null }
function labelFor(code: string) { return DECL_TYPES.find(t => t.code === code)?.label || code }
function fmtSize(b: number | null) { if (!b) return ''; if (b < 1024) return `${b} B`; if (b < 1048576) return `${Math.round(b/1024)} KB`; return `${(b/1048576).toFixed(1)} MB` }
function validity(m: number | null, y: number | null): { level: 'ok' | 'warn' | 'err' | 'none'; label: string; upto: string } {
  if (!m || !y) return { level: 'none', label: '', upto: 'безсрочен' }
  const now = new Date()
  const end = new Date(y, m, 0)
  const before = new Date(y, m - 1, 1); before.setMonth(before.getMonth() - 1)
  const upto = `${MONTHS[m]} ${y}`
  if (now > end) return { level: 'err', label: 'Изтекъл', upto: `валиден до ${upto}` }
  if (now >= before) return { level: 'warn', label: 'Изтича', upto: `валиден до ${upto}` }
  return { level: 'ok', label: 'Валиден', upto: `валиден до ${upto}` }
}

export default function StudentDeclarations({ studentId, canManage }: { studentId: string; canManage: boolean }) {
  const supabase = createClient()
  const [items, setItems] = useState<Decl[]>([])
  const [loading, setLoading] = useState(true)
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
    setVMonth(''); setVYear(''); setType('decl_1')
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
  const years = [nowY, nowY + 1, nowY + 2, nowY + 3]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileCheck size={18} className="text-blue-500" />
        <h3 className="text-base font-semibold text-slate-800">Декларации</h3>
      </div>

      {/* Форма за качване (като „Досие — външни документи") */}
      {canManage && (
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <select value={type} onChange={e => setType(e.target.value)}
              className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400 cursor-pointer">
              {DECL_TYPES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
            <div className="flex gap-2 sm:w-64">
              <select value={vMonth} onChange={e => setVMonth(e.target.value)}
                className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400 cursor-pointer">
                <option value="">без срок</option>
                {MONTHS.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={vYear} onChange={e => setVYear(e.target.value)} disabled={!vMonth}
                className="w-24 px-2 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400 cursor-pointer disabled:opacity-50">
                <option value="">год.</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => fileRef.current?.click()} disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: '#0f2240' }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Прикачи файл
            </button>
            <span className="text-xs text-slate-400">PDF или Word, макс. 10MB</span>
            <input ref={fileRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = '' }} />
          </div>
        </div>
      )}

      {/* Списък */}
      {loading ? (
        <div className="py-6 text-center"><Loader2 size={16} className="animate-spin inline text-slate-400" /></div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">Няма качени декларации.</div>
      ) : (
        <div className="space-y-2">
          {items.map(d => {
            const v = validity(d.valid_month, d.valid_year)
            const badge = v.level === 'err' ? 'bg-rose-50 text-rose-600 border-rose-100'
              : v.level === 'warn' ? 'bg-amber-50 text-amber-600 border-amber-100'
              : v.level === 'ok' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : ''
            return (
              <div key={d.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors group">
                <FileText size={18} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800">{labelFor(d.decl_type)}</span>
                    {v.label && (
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${badge}`}>
                        {v.level === 'err' ? <ShieldX size={11} /> : v.level === 'warn' ? <AlertTriangle size={11} /> : <ShieldCheck size={11} />}
                        {v.label}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">{d.name} · {fmtSize(d.size)} · {v.upto}</div>
                </div>
                <button onClick={() => download(d)} className="p-2 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-slate-100 shrink-0" title="Изтегли"><Download size={16} /></button>
                {canManage && <button onClick={() => del(d)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0" title="Изтрий"><Trash2 size={15} /></button>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
