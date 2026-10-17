// Отсъствия на децата по период (семейни причини / медицинска бележка) — за терапевтите и учителите.
export type AbsenceReason = 'family' | 'medical' | 'other'
export type StudentAbsence = { id: string; student_id: string; date_from: string; date_to: string; reason: AbsenceReason; note: string | null; created_by: string | null }

export const REASONS: Record<AbsenceReason, { label: string; short: string; color: string; bg: string }> = {
  family: { label: 'Семейни причини', short: 'семейни', color: '#1d4ed8', bg: '#eff6ff' },
  medical: { label: 'Медицинска бележка', short: 'медицинска', color: '#b91c1c', bg: '#fef2f2' },
  other: { label: 'Друго', short: 'друго', color: '#475569', bg: '#f1f5f9' },
}

export const todaySofia = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
export const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
/** „21.10“ или „21.10 – 24.10“ */
export const span = (a: string, b: string) => {
  const f = (x: string) => x.split('-').reverse().slice(0, 2).join('.')
  return a === b ? f(a) : `${f(a)} – ${f(b)}`
}
