// „Развитие“ — функционална оценка по области, повтаряна във времето (входна → междинна → изходна).
// Идеята е заимствана от системите за проследяване на напредък (Portage, VB-MAPP/ABLLS „решетка“,
// IEP графики с линия към целта), но уменията и скалата са наши — свободни за промяна.

export type AreaKey = 'gross_motor' | 'fine_motor' | 'receptive' | 'expressive' | 'cognitive' | 'social' | 'sensory' | 'self_care' | 'academic'

export const AREAS: { key: AreaKey; label: string; short: string; color: string; roles: string[] }[] = [
  { key: 'gross_motor', label: 'Груба моторика', short: 'Груба мот.', color: '#0d9488', roles: ['rehabilitator'] },
  { key: 'fine_motor', label: 'Фина моторика', short: 'Фина мот.', color: '#0891b2', roles: ['rehabilitator'] },
  { key: 'receptive', label: 'Разбиране на речта', short: 'Разбиране', color: '#7c3aed', roles: ['speech_therapist'] },
  { key: 'expressive', label: 'Изразяване и комуникация', short: 'Изразяване', color: '#c026d3', roles: ['speech_therapist'] },
  { key: 'cognitive', label: 'Познавателни умения', short: 'Познавателни', color: '#2563eb', roles: ['psychologist'] },
  { key: 'social', label: 'Социално-емоционално развитие', short: 'Социални', color: '#e11d48', roles: ['psychologist'] },
  { key: 'sensory', label: 'Сензорика и поведение', short: 'Сензорика', color: '#475569', roles: ['psychologist'] },
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
/** „Неприложимо“ — умението не се отнася до детето (напр. ходене при дете в количка); не влиза в %. */
export const NA = -1
export const NA_STYLE = { v: -1, label: 'Неприложимо', short: 'н/п', bg: '#f1f5f9', fg: '#94a3b8' }
export const scaleOf = (v: number) => v === NA ? NA_STYLE : SCALE[v]

/** Етапи — по три на учебна година („Текуща“ остава само за старите записи) */
export const STAGES: Record<string, string> = { entry: 'Входна', mid: 'Междинна', exit: 'Изходна' }
export const KINDS: Record<string, string> = { ...STAGES, current: 'Текуща' }

/** Нива на уменията — за да се показва първо подходящото за детето */
export const LEVELS: Record<number, string> = { 1: 'Ранни умения', 2: 'Основни умения', 3: 'Напреднали умения' }

export interface Skill { id: string; area: AreaKey; label: string; sort: number; active: boolean; level: number }
export interface Assessment {
  id: string; student_id: string; academic_year_id?: string | null; assessed_on: string; kind: string; assessor_id: string | null
  notes: Record<string, string> | null; created_at: string
}
export interface Score { assessment_id: string; skill_id: string; score: number; note: string | null }
export interface Target { id: string; skill_id: string; set_at: string; achieved_at: string | null; expected: string | null }

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
  const vals = skills.filter(s => s.area === area && profile[s.id] !== undefined && profile[s.id] !== NA).map(s => profile[s.id])
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * MAX)) * 100)
}

export const sortAssessments = (list: Assessment[]) =>
  [...list].sort((a, b) => a.assessed_on.localeCompare(b.assessed_on) || a.created_at.localeCompare(b.created_at))

// ── Цели с GAS (Goal Attainment Scaling): спрямо очакваното ЗА ТОВА дете, не спрямо норма за възрастта ──
export interface Gas { target_id: string; assessment_id: string; gas: number }
export const GAS: { v: number; label: string; bg: string; fg: string }[] = [
  { v: -2, label: 'Много под очакваното', bg: '#fecaca', fg: '#991b1b' },
  { v: -1, label: 'Под очакваното', bg: '#fed7aa', fg: '#9a3412' },
  { v: 0, label: 'Постигнато очакваното', bg: '#bbf7d0', fg: '#166534' },
  { v: 1, label: 'Над очакваното', bg: '#4ade80', fg: '#14532d' },
  { v: 2, label: 'Много над очакваното', bg: '#16a34a', fg: '#ffffff' },
]
export const gasOf = (v: number) => GAS.find(g => g.v === v)!

// ── Профил на детето: групи и стандартни нива ──
export interface Profile {
  student_id: string; groups: string[]; gmfcs: number | null; macs: number | null; cfcs: number | null
  asd_level: number | null; icf: number | null; note: string | null; updated_at?: string
}
export const GROUPS: Record<string, string> = {
  autism: 'Аутизъм', cp: 'ЦП', intellectual: 'Интелектуални затруднения', multiple: 'Множествени увреждания',
  speech: 'Езиково-говорни нарушения', hearing: 'Увреден слух', vision: 'Увредено зрение', adhd: 'ADHD / внимание', genetic: 'Генетичен синдром', other: 'Друго',
}
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']
export const roman = (n: number) => ROMAN[n] || String(n)
// Кратки описания по смисъла на международните класификации (GMFCS, MACS, CFCS, DSM-5, МКФ-ДЮ)
export const GMFCS: Record<number, string> = {
  1: 'Ходи без ограничения', 2: 'Ходи с ограничения (неравен терен, дълги разстояния)', 3: 'Ходи с ръчно помощно средство',
  4: 'Самостоятелното придвижване е ограничено; може с моторизирана количка', 5: 'Придвижва се в ръчна количка с помощ',
}
export const MACS: Record<number, string> = {
  1: 'Борави с предмети лесно и успешно', 2: 'Борави с повечето предмети, но по-бавно или по-неточно', 3: 'Борави трудно; нужна е помощ за подготовка',
  4: 'Борави с малко лесни предмети в адаптирана среда', 5: 'Не борави с предмети; нужна е пълна помощ',
}
export const CFCS: Record<number, string> = {
  1: 'Ефективна комуникация с познати и непознати', 2: 'Ефективна, но по-бавна комуникация', 3: 'Ефективна с познати хора',
  4: 'Непостоянно ефективна с познати хора', 5: 'Рядко ефективна дори с познати хора',
}
export const ASD: Record<number, string> = { 1: 'Нуждае се от подкрепа', 2: 'Нуждае се от значителна подкрепа', 3: 'Нуждае се от много значителна подкрепа' }
export const ICF: Record<number, string> = { 0: 'Няма затруднение', 1: 'Леко затруднение', 2: 'Умерено затруднение', 3: 'Тежко затруднение', 4: 'Пълно затруднение' }

/** Колко тежки са затрудненията — за това кои умения да са отворени първо */
export function severity(p: Profile | null): 'severe' | 'moderate' | 'mild' | null {
  if (!p) return null
  if ((p.icf ?? 0) >= 3 || (p.gmfcs ?? 0) >= 4 || (p.cfcs ?? 0) >= 4 || p.asd_level === 3 || p.groups.includes('multiple')) return 'severe'
  if (p.icf === 0 || p.icf === 1 || p.asd_level === 1) return 'mild'
  if (p.icf === 2 || p.asd_level === 2 || p.gmfcs || p.macs || p.cfcs) return 'moderate'
  return null
}
export const openLevels = (sev: ReturnType<typeof severity>) => sev === 'severe' ? [1, 2] : sev === 'mild' ? [2, 3] : [1, 2, 3]
