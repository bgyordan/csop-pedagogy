// Документите със срок на децата (ТЕЛК/ЛКК, заповед РЦПППО, алергии) — видове и статус.
// Едно правило за таблото, справката и досието.

export type DocType = 'telk' | 'rcpppo' | 'allergy'
export const DOC_TYPES: { key: DocType; label: string; short: string }[] = [
  { key: 'telk', label: 'ТЕЛК/ЛКК', short: 'ТЕЛК/ЛКК' },
  { key: 'rcpppo', label: 'Заповед РЦПППО', short: 'РЦПППО' },
  { key: 'allergy', label: 'Алергии / хранене', short: 'Алергии' },
]
export const DOC_LABEL: Record<string, string> = Object.fromEntries(DOC_TYPES.map(d => [d.key, d.label]))

export type DocStatus = 'missing' | 'expired' | 'soon' | 'valid' | 'indefinite' | 'nodate' | 'has' | 'no'
export const STATUS: Record<DocStatus, { label: string; short: string; color: string; bg: string; border: string }> = {
  expired: { label: 'Изтекъл', short: 'изтекъл', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  soon: { label: 'Изтича скоро', short: 'изтича', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  valid: { label: 'Валиден', short: 'валиден', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  indefinite: { label: 'Безсрочен', short: 'безсрочен', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  nodate: { label: 'Без срок', short: 'без срок', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  missing: { label: 'Липсва', short: 'липсва', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  // алергии
  has: { label: 'Има алергия', short: 'има', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  no: { label: 'Няма алергия', short: 'няма', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
}
export type DocRow = { student_id: string; doc_type: string; valid_until: string | null; indefinite?: boolean | null; valid_label?: string | null; doc_number?: string | null; issued_on?: string | null
  allergy_status?: 'none' | 'has' | null; allergens?: string[] | null; allergy_kinds?: string[] | null; reaction_plan?: string | null; emergency_med?: boolean | null; note?: string | null }

export const todaySofia = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
export const daysTo = (iso: string, today = todaySofia()) => Math.round((new Date(iso + 'T12:00:00Z').getTime() - new Date(today + 'T12:00:00Z').getTime()) / 86400000)
export const fmt = (iso: string) => iso.slice(0, 10).split('-').reverse().join('.')

export function docStatus(row: DocRow | undefined, horizon = 30, today = todaySofia()): { s: DocStatus; days?: number } {
  if (!row) return { s: 'missing' }
  // алергии: „Няма“ / „Има“ (със срок — като документ); стар запис с текст → „Има“
  if (row.doc_type === 'allergy') {
    if (row.allergy_status === 'none') return { s: 'no' }
    if (row.allergy_status === 'has' || (row.note || '').trim()) {
      if (!row.valid_until) return { s: 'has' }
      const d = daysTo(row.valid_until, today)
      return d < 0 ? { s: 'expired', days: d } : d <= horizon ? { s: 'soon', days: d } : { s: 'has', days: d }
    }
  }
  if (row.indefinite) return { s: 'indefinite' }
  if (!row.valid_until) return { s: 'nodate' }
  const d = daysTo(row.valid_until, today)
  if (d < 0) return { s: 'expired', days: d }
  if (d <= horizon) return { s: 'soon', days: d }
  return { s: 'valid', days: d }
}
