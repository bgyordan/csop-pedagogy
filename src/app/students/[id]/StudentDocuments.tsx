'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, X, Loader2, Trash2, Pencil, Stethoscope, ShieldCheck, Utensils } from 'lucide-react'

interface DocRow {
  doc_type: string
  valid_until: string | null
  note: string | null
  doc_number: string | null
  issued_on: string | null
  support_type: string | null
  diagnosis: string | null
}
interface Props { studentId: string; canManage: boolean }

// hasSupport = поле „вид подкрепа" (само РЦПППО); hasDiagnosis = „Диагноза" (само ТЕЛК).
const DOC_TYPES: { key: string; label: string; icon: any; notePlaceholder?: string; hasSupport?: boolean; hasDiagnosis?: boolean }[] = [
  { key: 'telk',    label: 'ТЕЛК / решение на МЕ',                     icon: Stethoscope, hasDiagnosis: true },
  { key: 'rcpppo',  label: 'Заповед за насочване (РЦПППО)',            icon: ShieldCheck, hasSupport: true },
  { key: 'allergy', label: 'Документ за алергии / специално хранене',  icon: Utensils, notePlaceholder: 'напр. без глутен и млечни продукти' },
]

const SUPPORT_OPTIONS: { v: string; l: string }[] = [
  { v: 'short', l: 'краткосрочна' },
  { v: 'long',  l: 'дългосрочна' },
]
const supportLabel = (v?: string | null) => SUPPORT_OPTIONS.find(o => o.v === v)?.l || ''

function fmtDate(d: string) { return new Date(d).toLocaleDateString('bg-BG') }

function hasAnyData(row?: DocRow) {
  if (!row) return false
  return !!(row.valid_until || (row.note && row.note.trim()) || (row.doc_number && row.doc_number.trim())
    || row.issued_on || row.support_type || (row.diagnosis && row.diagnosis.trim()))
}

function statusOf(row?: DocRow) {
  if (!hasAnyData(row)) return { kind: 'none' as const }
  if (!row!.valid_until) return { kind: 'nodate' as const }
  const validUntil = new Date(row!.valid_until)
  const now = new Date()
  const daysLeft = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 3600 * 24))
  if (daysLeft < 0) return { kind: 'expired' as const, date: row!.valid_until }
  if (daysLeft <= 30) return { kind: 'soon' as const, date: row!.valid_until, daysLeft }
  return { kind: 'valid' as const, date: row!.valid_until }
}

export default function StudentDocuments({ studentId, canManage }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<Record<string, DocRow>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [dNumber, setDNumber] = useState('')
  const [dIssued, setDIssued] = useState('')
  const [dValid, setDValid] = useState('')
  const [dNote, setDNote] = useState('')
  const [dSupport, setDSupport] = useState('')
  const [dDiagnosis, setDDiagnosis] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('student_documents')
        .select('doc_type, valid_until, note, doc_number, issued_on, support_type, diagnosis')
        .eq('student_id', studentId)
      if (!active) return
      const map: Record<string, DocRow> = {}
      ;(data || []).forEach((r: any) => { map[r.doc_type] = r })
      setRows(map)
      setLoading(false)
    })()
    return () => { active = false }
  }, [studentId])

  function startEdit(key: string) {
    const r = rows[key]
    setDNumber(r?.doc_number || '')
    setDIssued(r?.issued_on || '')
    setDValid(r?.valid_until || '')
    setDNote(r?.note || '')
    setDSupport(r?.support_type || '')
    setDDiagnosis(r?.diagnosis || '')
    setEditing(key)
  }

  async function save(key: string) {
    const t = DOC_TYPES.find(x => x.key === key)
    setSaving(true)
    const row: DocRow = {
      doc_type: key,
      doc_number: dNumber.trim() || null,
      issued_on: dIssued || null,
      valid_until: dValid || null,
      note: dNote.trim() || null,
      support_type: t?.hasSupport ? (dSupport || null) : null,
      diagnosis: t?.hasDiagnosis ? (dDiagnosis.trim() || null) : null,
    }
    if (!hasAnyData(row)) {
      await supabase.from('student_documents').delete().eq('student_id', studentId).eq('doc_type', key)
      setRows(prev => { const n = { ...prev }; delete n[key]; return n })
    } else {
      const { error } = await supabase.from('student_documents')
        .upsert({ student_id: studentId, ...row, updated_at: new Date().toISOString() }, { onConflict: 'student_id,doc_type' })
      if (!error) setRows(prev => ({ ...prev, [key]: row }))
    }
    setSaving(false)
    setEditing(null)
  }

  async function clear(key: string) {
    setSaving(true)
    await supabase.from('student_documents').delete().eq('student_id', studentId).eq('doc_type', key)
    setRows(prev => { const n = { ...prev }; delete n[key]; return n })
    setSaving(false)
    setEditing(null)
  }

  function StatusPill({ row }: { row?: DocRow }) {
    const st = statusOf(row)
    if (st.kind === 'none') return <span className="text-xs text-slate-400">Не е въведено</span>
    if (st.kind === 'nodate') return (
      <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200">Въведено</span>
    )
    const map = {
      valid:   { cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', txt: `Валиден до ${fmtDate(st.date!)}` },
      soon:    { cls: 'text-amber-700 bg-amber-50 border-amber-200',       txt: `Изтича след ${(st as any).daysLeft} дни · ${fmtDate(st.date!)}` },
      expired: { cls: 'text-rose-700 bg-rose-50 border-rose-200',          txt: `Изтекъл · ${fmtDate(st.date!)}` },
    }[st.kind]
    return (
      <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border ${map.cls}`}>{map.txt}</span>
    )
  }

  function metaLine(t: typeof DOC_TYPES[number], row: DocRow) {
    const parts: string[] = []
    if (row.doc_number) parts.push(`№ ${row.doc_number}`)
    if (row.issued_on) parts.push(`изд. ${fmtDate(row.issued_on)}`)
    if (t.hasSupport && row.support_type) parts.push(`подкрепа: ${supportLabel(row.support_type)}`)
    if (t.hasDiagnosis && row.diagnosis) parts.push(`диагноза: ${row.diagnosis}`)
    if (row.note) parts.push(row.note)
    return parts.join(' · ')
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-slate-400 py-4"><Loader2 size={14} className="animate-spin" /> Зареждане…</div>
  }

  const inputCls = "w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white focus:outline-none focus:border-slate-400"
  const labelCls = "block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1"

  return (
    <div className="space-y-2.5">
      {DOC_TYPES.map(t => {
        const Icon = t.icon
        const row = rows[t.key]
        const isEditing = editing === t.key
        const meta = row ? metaLine(t, row) : ''
        return (
          <div key={t.key} className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-500 shrink-0">
                  <Icon size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-700 leading-tight">{t.label}</div>
                  {!isEditing && meta && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{meta}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!isEditing && <StatusPill row={row} />}
                {canManage && !isEditing && (
                  <button type="button" onClick={() => startEdit(t.key)}
                    className="text-slate-400 hover:text-slate-700 transition-colors p-1" title="Редактирай">
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-slate-50/60 rounded-b-xl space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
                  <div>
                    <label className={labelCls}>№ на документа</label>
                    <input type="text" value={dNumber} onChange={e => setDNumber(e.target.value)} placeholder="напр. 123/12.09.2026" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Дата на издаване</label>
                    <input type="date" value={dIssued} onChange={e => setDIssued(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Валиден до</label>
                    <input type="date" value={dValid} onChange={e => setDValid(e.target.value)} className={inputCls} />
                  </div>
                  {t.hasSupport && (
                    <div>
                      <label className={labelCls}>Вид подкрепа</label>
                      <select value={dSupport} onChange={e => setDSupport(e.target.value)} className={inputCls + ' cursor-pointer'}>
                        <option value="">—</option>
                        {SUPPORT_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    </div>
                  )}
                  {t.hasDiagnosis && (
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Диагноза</label>
                      <input type="text" value={dDiagnosis} onChange={e => setDDiagnosis(e.target.value)} placeholder="свободен текст" className={inputCls} />
                    </div>
                  )}
                  <div className={t.hasSupport ? '' : 'sm:col-span-2'}>
                    <label className={labelCls}>Бележка</label>
                    <input type="text" value={dNote} onChange={e => setDNote(e.target.value)} placeholder={t.notePlaceholder || 'незадължително'} className={inputCls} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  {row ? (
                    <button type="button" onClick={() => clear(t.key)} disabled={saving}
                      className="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 transition-colors disabled:opacity-50">
                      <Trash2 size={12} /> Изчисти
                    </button>
                  ) : <span />}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditing(null)} disabled={saving}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                      <X size={12} /> Отказ
                    </button>
                    <button type="button" onClick={() => save(t.key)} disabled={saving}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-60 transition-opacity hover:opacity-90"
                      style={{ backgroundColor: '#0f2240' }}>
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Запази
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
