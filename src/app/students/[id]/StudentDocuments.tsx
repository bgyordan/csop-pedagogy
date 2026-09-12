'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarClock, Check, X, Loader2, Trash2, Pencil, Stethoscope, ShieldCheck, Utensils } from 'lucide-react'

interface DocRow { doc_type: string; valid_until: string | null; note: string | null }
interface Props { studentId: string; canManage: boolean }

// Видовете следени документи. Добавяне на нов = един ред тук.
const DOC_TYPES: { key: string; label: string; icon: any; notePlaceholder?: string }[] = [
  { key: 'telk',   label: 'ТЕЛК / решение на МЕ',                    icon: Stethoscope },
  { key: 'rcpppo', label: 'Заповед за насочване (РЦПППО)',           icon: ShieldCheck },
  { key: 'allergy', label: 'Документ за алергии / специално хранене', icon: Utensils, notePlaceholder: 'напр. без глутен и млечни продукти' },
]

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('bg-BG')
}

function statusOf(row?: DocRow) {
  if (!row || (!row.valid_until && !(row.note && row.note.trim()))) {
    return { kind: 'none' as const }
  }
  if (!row.valid_until) {
    return { kind: 'nodate' as const }
  }
  const validUntil = new Date(row.valid_until)
  const now = new Date()
  const daysLeft = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 3600 * 24))
  if (daysLeft < 0) return { kind: 'expired' as const, date: row.valid_until }
  if (daysLeft <= 30) return { kind: 'soon' as const, date: row.valid_until, daysLeft }
  return { kind: 'valid' as const, date: row.valid_until }
}

export default function StudentDocuments({ studentId, canManage }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<Record<string, DocRow>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [draftDate, setDraftDate] = useState('')
  const [draftNote, setDraftNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('student_documents')
        .select('doc_type, valid_until, note')
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
    setDraftDate(r?.valid_until || '')
    setDraftNote(r?.note || '')
    setEditing(key)
  }

  async function save(key: string) {
    setSaving(true)
    const cleanDate = draftDate || null
    const cleanNote = draftNote.trim() || null
    // Ако и двете са празни — трети статус „не е въведено": трием реда.
    if (!cleanDate && !cleanNote) {
      await supabase.from('student_documents').delete().eq('student_id', studentId).eq('doc_type', key)
      setRows(prev => { const n = { ...prev }; delete n[key]; return n })
    } else {
      const payload = { student_id: studentId, doc_type: key, valid_until: cleanDate, note: cleanNote, updated_at: new Date().toISOString() }
      const { error } = await supabase.from('student_documents').upsert(payload, { onConflict: 'student_id,doc_type' })
      if (!error) setRows(prev => ({ ...prev, [key]: { doc_type: key, valid_until: cleanDate, note: cleanNote } }))
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

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-slate-400 py-4"><Loader2 size={14} className="animate-spin" /> Зареждане…</div>
  }

  return (
    <div className="space-y-2.5">
      {DOC_TYPES.map(t => {
        const Icon = t.icon
        const row = rows[t.key]
        const isEditing = editing === t.key
        return (
          <div key={t.key} className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-500 shrink-0">
                  <Icon size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-700 leading-tight">{t.label}</div>
                  {!isEditing && row?.note && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{row.note}</div>}
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
                    <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Валиден до</label>
                    <input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)}
                      className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white focus:outline-none focus:border-slate-400" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Бележка</label>
                    <input type="text" value={draftNote} onChange={e => setDraftNote(e.target.value)}
                      placeholder={t.notePlaceholder || 'незадължително'}
                      className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white focus:outline-none focus:border-slate-400" />
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
