// „Развитие“ — функционална оценка по области, повтаряна във времето (входна → междинна → изходна).
// Идеята е заимствана от системите за проследяване на напредък (Portage, VB-MAPP/ABLLS „решетка“,
// IEP графики с линия към целта), но уменията и скалата са наши — свободни за промяна.

export type AreaKey = 'gross_motor' | 'fine_motor' | 'receptive' | 'expressive' | 'cognitive' | 'social' | 'self_care' | 'academic'

export const AREAS: { key: AreaKey; label: string; short: string; color: string; roles: string[] }[] = [
  { key: 'gross_motor', label: 'Груба моторика', short: 'Груба мот.', color: '#0d9488', roles: ['rehabilitator'] },
  { key: 'fine_motor', label: 'Фина моторика', short: 'Фина мот.', color: '#0891b2', roles: ['rehabilitator'] },
  { key: 'receptive', label: 'Разбиране на речта', short: 'Разбиране', color: '#7c3aed', roles: ['speech_therapist'] },
  { key: 'expressive', label: 'Изразяване и комуникация', short: 'Изразяване', color: '#c026d3', roles: ['speech_therapist'] },
  { key: 'cognitive', label: 'Познавателни умения', short: 'Познавателни', color: '#2563eb', roles: ['psychologist'] },
  { key: 'social', label: 'Социално-емоционално развитие', short: 'Социални', color: '#e11d48', roles: ['psychologist'] },
  { key: 'self_care', label: 'Самообслужване', short: 'Самообсл.', color: '#d97706', roles: ['class_teacher', 'educator', 'teacher'] },
  { key: 'academic', label: 'Учебни умения', short: 'Учебни', color: '#65a30d', roles: ['class_teacher', 'teacher'] },
]
export const areaMeta = (k: string) => AREAS.find(a => a.key === k) || AREAS[0]

/** Скала на самостоятелността (по йерархията на подкрепата) */
export const SCALE: { v: number; label: string; short: string; bg: string; fg: string }[] = [
  { v: 0, label: 'Не се проявява', short: 'Не', bg: '#e2e8f0', fg: '#475569' },
  { v: 1, label: 'С пълна помощ', short: 'Пълна помощ', bg: '#fecaca', fg: '#991b1b' },
  { v: 2, label: 'С частична помощ / подкана', short: 'Подкана', bg: '#fde68a', fg: '#92400e' },
  { v: 3, label: 'Самостоятелно', short: 'Сам', bg: '#bbf7d0', fg: '#166534' },
  { v: 4, label: 'Устойчиво, в различни ситуации', short: 'Устойчиво', bg: '#22c55e', fg: '#ffffff' },
]
export const MAX = 4

export const KINDS: Record<string, string> = { entry: 'Входна', mid: 'Междинна', exit: 'Изходна', current: 'Текуща' }

export interface Skill { id: string; area: AreaKey; label: string; sort: number; active: boolean }
export interface Assessment {
  id: string; student_id: string; assessed_on: string; kind: string; assessor_id: string | null
  notes: Record<string, string> | null; created_at: string
}
export interface Score { assessment_id: string; skill_id: string; score: number; note: string | null }
export interface Target { id: string; skill_id: string; set_at: string; achieved_at: string | null }

export const fmtD = (d: string) => d ? d.split('-').reverse().join('.') : ''

/** Профил „към оценка N“: за всяко умение — последната оценка до тази включително */
export function profileUpTo(assessments: Assessment[], scores: Score[], uptoIdx: number): Record<string, number> {
  const ids = new Set(assessments.slice(0, uptoIdx + 1).map(a => a.id))
  const order: Record<string, number> = {}
  assessments.forEach((a, i) => { order[a.id] = i })
  const best: Record<string, { s: number; i: number }> = {}
  for (const sc of scores) {
    if (!ids.has(sc.assessment_id)) continue
    const i = order[sc.assessment_id]
    if (!best[sc.skill_id] || best[sc.skill_id].i <= i) best[sc.skill_id] = { s: sc.score, i }
  }
  return Object.fromEntries(Object.entries(best).map(([k, v]) => [k, v.s]))
}

/** % по област (средно / максимум), null ако няма оценени умения */
export function areaPct(profile: Record<string, number>, skills: Skill[], area: AreaKey): number | null {
  const vals = skills.filter(s => s.area === area && profile[s.id] !== undefined).map(s => profile[s.id])
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * MAX)) * 100)
}

export const sortAssessments = (list: Assessment[]) =>
  [...list].sort((a, b) => a.assessed_on.localeCompare(b.assessed_on) || a.created_at.localeCompare(b.created_at))
