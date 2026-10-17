'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, X, Loader2, Trash2, Pencil, Stethoscope, ShieldCheck, Utensils } from 'lucide-react'
import DateInput from '@/components/ui/DateInput'

interface DocRow {
  doc_type: string
  valid_until: string | null
  note: string | null
  doc_number: string | null
  issued_on: string | null
  support_type: string | null
  diagnosis: string | null
  indefinite?: boolean   // безсрочен (напр. ТЕЛК без срок) — различно от „срокът не е въведен“
  valid_label?: string | null   // РЦПППО: „до края на IV клас“ / „до края на начален етап“
}
interface Props { studentId: string; canManage: boolean; externalClass?: string | null }

// hasSupport = поле „интензивност" (само РЦПППО); hasDiagnosis = „Диагноза" (само ТЕЛК).
const DOC_TYPES: { key: string; label: string; icon: any; notePlaceholder?: string; hasSupport?: boolean; hasDiagnosis?: boolean }[] = [
  { key: 'telk',    label: 'ТЕЛК/ЛКК',                                 icon: Stethoscope, hasDiagnosis: true },
  { key: 'rcpppo',  label: 'Заповед за насочване (РЦПППО)',            icon: ShieldCheck, hasSupport: true },
  { key: 'allergy', label: 'Документ за алергии / специално хранене',  icon: Utensils, notePlaceholder: 'напр. без глутен и млечни продукти' },
]

// Интензивност на подкрепата (от заповедта/становището на РЦПППО). Пази се като текст;
// бутоните са бързи стойности, а полето позволява и свободен текст.
const INTENSITY_OPTIONS = ['висока', 'средна', 'ниска']
// Стари записи (short/long) се показват с предишния си текст.
const LEGACY_SUPPORT: Record<string, string> = { short: 'краткосрочна', long: 'дългосрочна' }
const supportLabel = (v?: string | null) => (v ? (LEGACY_SUPPORT[v] || v) : '')

// без часови зони: „2026-09-12“ → „12.09.2026“
function fmtDate(d: string) { return d.slice(0, 10).split('-').reverse().join('.') }

// Заповед РЦПППО — „валидна до края на клас / етап“; датата се изчислява (30.06 на съответната година)
const ROMAN = ['ПГ', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const STAGES: { key: string; label: string; last: number }[] = [
  { key: 'pg', label: 'предучилищно образование', last: 0 },
  { key: 'nach', label: 'начален етап', last: 4 },
  { key: 'progim', label: 'прогимназиален етап', last: 7 },
  { key: 'gim1', label: 'първи гимназиален етап', last: 10 },
  { key: 'gim2', label: 'втори гимназиален етап', last: 12 },
]
function gradeOf(ext?: string | null): number | null {
  const t = (ext || '').trim().toUpperCase()
  if (!t) return null
  if (t.startsWith('ПГ')) return 0
  const rm = t.match(/^(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b/)
  if (rm) return ROMAN.indexOf(rm[1])
  const m = t.match(/\d+/); return m ? parseInt(m[0]) : null
}
/** 30.06 на учебната година, в която детето завършва дадения клас (по сегашния му клас в училището) */
function endOfGrade(target: number, current: number | null): string {
  if (current === null || target < current) return ''
  const now = new Date(), y = now.getFullYear(), endYear = now.getMonth() >= 8 ? y + 1 : y
  return `${endYear + (target - current)}-06-30`
}

function hasAnyData(row?: DocRow) {
  if (!row) return false
  return !!(row.valid_until || row.indefinite || row.valid_label || (row.note && row.note.trim()) || (row.doc_number && row.doc_number.trim())
    || row.issued_on || row.support_type || (row.diagnosis && row.diagnosis.trim()))
}

function statusOf(row?: DocRow) {
  if (!hasAnyData(row)) return { kind: 'none' as const }
  if (row!.indefinite) return { kind: 'indefinite' as const }
  if (!row!.valid_until) return row!.valid_label ? { kind: 'label' as const } : { kind: 'nodate' as const }
  const validUntil = new Date(row!.valid_until)
  const now = new Date()
  const daysLeft = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 3600 * 24))
  if (daysLeft < 0) return { kind: 'expired' as const, date: row!.valid_until }
  if (daysLeft <= 30) return { kind: 'soon' as const, date: row!.valid_until, daysLeft }
  return { kind: 'valid' as const, date: row!.valid_until }
}

export default function StudentDocuments({ studentId, canManage, externalClass }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<Record<string, DocRow>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [dNumber, setDNumber] = useState('')
  const [dIssued, setDIssued] = useState('')
  const [dValid, setDValid] = useState('')
  const [dIndef, setDIndef] = useState(false)
  const [dNote, setDNote] = useState('')
  const [dSupport, setDSupport] = useState('')
  const [dDiagnosis, setDDiagnosis] = useState('')
  // РЦПППО: валидна до — дата / края на клас / края на етап
  const [vMode, setVMode] = useState<'date' | 'class' | 'stage'>('date')
  const [vClass, setVClass] = useState(4)
  const [vStage, setVStage] = useState('nach')
  const curGrade = gradeOf(externalClass)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('student_documents')
        .select('*')
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
    setDIndef(!!r?.indefinite)
    setDNote(r?.note || '')
    setDSupport(r?.support_type || '')
    setDDiagnosis(r?.diagnosis || '')
    const lbl = r?.valid_label || ''
    const st = STAGES.find(x => lbl.includes(x.label))
    const cl = lbl.match(/края на (\S+) клас/)
    if (st) { setVMode('stage'); setVStage(st.key) }
    else if (cl && ROMAN.includes(cl[1])) { setVMode('class'); setVClass(ROMAN.indexOf(cl[1])) }
    else { setVMode('date'); setVClass(Math.max(curGrade ?? 4, 0)); setVStage(STAGES.find(x => x.last >= (curGrade ?? 1))?.key || 'nach') }
    setEditing(key)
  }

  async function save(key: string) {
    const t = DOC_TYPES.find(x => x.key === key)
    setSaving(true)
    // РЦПППО до края на клас/етап → текст + изчислена дата
    let validLabel: string | null = null, validDate = dValid || null
    if (t?.hasSupport && !dIndef && vMode !== 'date') {
      if (vMode === 'class') { validLabel = vClass === 0 ? 'до края на подготвителната група' : `до края на ${ROMAN[vClass]} клас`; validDate = endOfGrade(vClass, curGrade) || null }
      else { const st = STAGES.find(x => x.key === vStage)!; validLabel = `до края на ${st.label}`; validDate = endOfGrade(st.last, curGrade) || null }
    }
    const row: DocRow = {
      doc_type: key,
      doc_number: dNumber.trim() || null,
      issued_on: dIssued || null,
      valid_until: dIndef ? null : validDate,
      indefinite: dIndef,
      valid_label: validLabel,
      note: dNote.trim() || null,
      support_type: t?.hasSupport ? (dSupport || null) : null,
      diagnosis: t?.hasDiagnosis ? (dDiagnosis.trim() || null) : null,
    }
    if (!hasAnyData(row)) {
      await supabase.from('student_documents').delete().eq('student_id', studentId).eq('doc_type', key)
      setRows(prev => { const n = { ...prev }; delete n[key]; return n })
    } else {
      // indefinite само ако е отбелязано (без миграцията колоната я няма)
      const { indefinite, valid_label, ...base } = row
      const { error } = await supabase.from('student_documents')
        .upsert({ student_id: studentId, ...base, ...(indefinite || rows[key]?.indefinite ? { indefinite } : {}),
          ...(valid_label || rows[key]?.valid_label ? { valid_label } : {}), updated_at: new Date().toISOString() }, { onConflict: 'student_id,doc_type' })
      if (error && /indefinite/.test(error.message)) alert('За „безсрочен“ пуснете SQL файла 2026-10-09_student_documents_indefinite.sql')
      if (error && /valid_label/.test(error.message)) alert('За „до края на клас/етап“ пуснете SQL файла 2026-10-17_student_documents_valid_label.sql')
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
    if (st.kind === 'indefinite') return (
      <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border text-emerald-700 bg-emerald-50 border-emerald-200">Безсрочен</span>
    )
    if (st.kind === 'label') return (
      <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border text-emerald-700 bg-emerald-50 border-emerald-200">Валидна {row!.valid_label}</span>
    )
    if (st.kind === 'nodate') return (
      <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200">Въведено</span>
    )
    const map = {
      valid:   { cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', txt: row?.valid_label ? `Валидна ${row.valid_label} · ${fmtDate(st.date!)}` : `Валиден до ${fmtDate(st.date!)}` },
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
    if (t.hasSupport && row.support_type) parts.push(`интензивност: ${supportLabel(row.support_type)}`)
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
                    <DateInput value={dIssued} onChange={setDIssued} />
                  </div>
                  <div>
                    <label className={labelCls}>{t.hasSupport ? 'Валидна до' : 'Валиден до'}</label>
                    {t.hasSupport && !dIndef && (
                      <div className="flex gap-1 mb-1.5">
                        {([['date', 'дата'], ['class', 'края на клас'], ['stage', 'края на етап']] as const).map(([m, l]) => (
                          <button key={m} type="button" onClick={() => setVMode(m)}
                            className={`px-2.5 py-0.5 rounded-full text-[11.5px] border ${vMode === m ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-300'}`}>{l}</button>
                        ))}
                      </div>
                    )}
                    {(!t.hasSupport || dIndef || vMode === 'date') && <DateInput value={dIndef ? '' : dValid} disabled={dIndef} onChange={setDValid} />}
                    {t.hasSupport && !dIndef && vMode === 'class' && (
                      <select value={vClass} onChange={e => setVClass(Number(e.target.value))} className={inputCls}>
                        {ROMAN.map((r, i) => <option key={r} value={i}>{i === 0 ? 'края на подготвителната група' : `края на ${r} клас`}</option>)}
                      </select>
                    )}
                    {t.hasSupport && !dIndef && vMode === 'stage' && (
                      <select value={vStage} onChange={e => setVStage(e.target.value)} className={inputCls}>
                        {STAGES.map(x => <option key={x.key} value={x.key}>края на {x.label}</option>)}
                      </select>
                    )}
                    {t.hasSupport && !dIndef && vMode !== 'date' && (() => {
                      const g = vMode === 'class' ? vClass : STAGES.find(x => x.key === vStage)!.last
                      const d = endOfGrade(g, curGrade)
                      return <p className="mt-1 text-[11px] text-slate-500">{d ? `≈ ${fmtDate(d)} (сега: ${externalClass} клас) — за напомнянето` : curGrade === null ? 'Класът в училището не е въведен — без дата за напомняне' : 'Детето вече е след този клас'}</p>
                    })()}
                    <label className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                      <input type="checkbox" checked={dIndef} onChange={e => { setDIndef(e.target.checked); if (e.target.checked) setDValid('') }}
                        className="w-3.5 h-3.5 rounded border-slate-300 accent-[#0f2240]" />
                      безсрочен
                    </label>
                  </div>
                  {t.hasSupport && (
                    <div>
                      <label className={labelCls}>Интензивност</label>
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {INTENSITY_OPTIONS.map(o => (
                          <button key={o} type="button" onClick={() => setDSupport(dSupport === o ? '' : o)}
                            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                              dSupport === o ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                            }`}>
                            {o}
                          </button>
                        ))}
                      </div>
                      <input type="text" value={supportLabel(dSupport)} onChange={e => setDSupport(e.target.value)}
                        placeholder="или напиши друго" className={inputCls} />
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
