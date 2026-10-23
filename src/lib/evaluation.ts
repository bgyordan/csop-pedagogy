// Оценяване на персонала (ДТВ за постигнати резултати) — общи типове, етикети и сметки.
// Правилата са по Вътрешните правила за ДТВ на ЦСОП – Варна: една комисия, карта по длъжност (общо 100 т.),
// корекция на точките до 20% на показател, възражение до 3 работни дни, сума пропорционално на точките.

export type Grp = 'ped' | 'nonped'
export type EvalItem = { k: string; t: string; max: number }
export type EvalGroup = { n: string; g: string; max: number; items: EvalItem[] }
export type Scores = Record<string, number>

export type EvalTemplate = {
  id: string; code: string | null; kind: string; grp: Grp; name: string; title: string; adopted: string | null
  col_label: string; roles: string[]; criteria: EvalGroup[]; base: EvalGroup[] | null; total: number
  is_active: boolean; sort: number
}

export type CampaignStatus = 'setup' | 'scoring' | 'closed'
export type Campaign = {
  id: string; kind: string; name: string; academic_year_id: string | null; status: CampaignStatus
  aggregate: 'avg' | 'joint'; card_days: number; objection_days: number
  min_days_ped: number; min_days_nonped: number; sick_tolerance: number
  score_by: string | null; order_by: string | null; basis: string | null
  protocol_no: string | null; protocol_date: string | null; scan_path: string | null
  created_at: string; closed_at: string | null
}

export type PStatus = 'pending' | 'scored' | 'sent' | 'acked' | 'objected' | 'resolved'
export type Person = { id: string; first_name: string; last_name: string; role: string; position: string | null }
export type Participant = {
  id: string; campaign_id: string; staff_id: string; template_id: string | null; grp: Grp; position: string | null
  evaluator: 'commission' | 'director'; criteria: EvalGroup[] | null; status: PStatus
  final_scores: Scores | null; final_total: number | null; finalized_at: string | null; sent_at: string | null
  acked_at: string | null; objection: string | null; objection_at: string | null
  decision: string | null; decision_changed: boolean | null; decided_at: string | null
  scan_path: string | null; note: string | null
  staff?: Person | null
}
export type Member = { campaign_id: string; staff_id: string; role: 'chair' | 'member'; sort: number; staff?: Person | null }
export type ScoreRow = { participant_id: string; member_id: string; scores: Scores; total: number; submitted_at: string | null }
export type Pay = { participant_id: string; worked_days: number | null; sick_days: number | null; override: 'yes' | 'no' | null; note: string | null }

export const GRP_LABEL: Record<Grp, string> = { ped: 'Педагогически специалисти', nonped: 'Непедагогически персонал' }
export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = { setup: 'Подготовка', scoring: 'Оценяване', closed: 'Приключена' }
export const P_STATUS_LABEL: Record<PStatus, string> = {
  pending: 'Оценява се', scored: 'Утвърдена', sent: 'Чака запознаване', acked: 'Запознат/а', objected: 'Възражение', resolved: 'Решено възражение',
}
export const P_STATUS_TONE: Record<PStatus, string> = {
  pending: 'bg-slate-100 text-slate-600', scored: 'bg-indigo-50 text-indigo-700', sent: 'bg-amber-50 text-amber-800',
  acked: 'bg-emerald-50 text-emerald-700', objected: 'bg-rose-50 text-rose-700', resolved: 'bg-emerald-50 text-emerald-700',
}

export const CENTER_NAME = 'Център за специална образователна подкрепа – гр. Варна'
export const CENTER_ADDRESS = 'ул. „Петко Стайнов“ № 7, e-mail: info-400052@edu.mon.bg, тел. 052 619 456'

export const pname = (p?: { first_name: string; last_name: string } | null) => (p ? `${p.first_name} ${p.last_name}` : '—')
export const dmy = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '')
export const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
export const isoOf = (ts: string | null | undefined) => (ts ? new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' }) : '')
/** Число по български: 12,5 */
export const num = (v: number | null | undefined, digits = 2) =>
  v == null || isNaN(v) ? '' : (Math.round(v * 10 ** digits) / 10 ** digits).toLocaleString('bg-BG', { maximumFractionDigits: digits })
export const money = (v: number | null | undefined) =>
  v == null || isNaN(v) ? '' : v.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const items = (c: EvalGroup[] | null | undefined) => (c || []).flatMap(g => g.items)
export const maxTotal = (c: EvalGroup[] | null | undefined) => (c || []).reduce((s, g) => s + Number(g.max || 0), 0)
/** Сбор на точките (липсващите — 0) */
export const sumScores = (c: EvalGroup[] | null | undefined, s: Scores | null | undefined) =>
  Math.round(items(c).reduce((a, it) => a + Number(s?.[it.k] || 0), 0) * 100) / 100
export const groupSum = (g: EvalGroup, s: Scores | null | undefined) =>
  Math.round(g.items.reduce((a, it) => a + Number(s?.[it.k] || 0), 0) * 100) / 100
/** Всички критерии оценени и в границите */
export function scoresComplete(c: EvalGroup[] | null | undefined, s: Scores | null | undefined) {
  return items(c).every(it => s?.[it.k] != null && !isNaN(Number(s[it.k])) && Number(s[it.k]) >= 0 && Number(s[it.k]) <= it.max)
}

/** Средно от подадените оценки на членовете (по критерий, до 2 знака) — същото като в базата. */
export function averageScores(rows: { scores: Scores; submitted_at: string | null }[]): Scores | null {
  const done = rows.filter(r => r.submitted_at)
  if (!done.length) return null
  const keys = new Set(done.flatMap(r => Object.keys(r.scores || {})))
  const out: Scores = {}
  keys.forEach(k => {
    const vals = done.map(r => Number(r.scores?.[k])).filter(v => !isNaN(v))
    if (vals.length) out[k] = Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 100) / 100
  })
  return out
}

/** Проверка на картата: показателите = сбор от критериите, общо 100, корекция до 20% спрямо приетата. */
export function validateTemplate(t: { criteria: EvalGroup[]; base: EvalGroup[] | null; total: number }): string[] {
  const errs: string[] = []
  const total = maxTotal(t.criteria)
  if (Math.abs(total - Number(t.total || 100)) > 0.001) errs.push(`Общият брой точки е ${num(total)}, а трябва да е ${num(t.total || 100)}.`)
  t.criteria.forEach(g => {
    const s = g.items.reduce((a, it) => a + Number(it.max || 0), 0)
    if (Math.abs(s - Number(g.max)) > 0.001) errs.push(`Показател ${g.n}: критериите дават ${num(s)} т., а показателят е ${num(g.max)} т.`)
    if (!g.items.length) errs.push(`Показател ${g.n} няма критерии.`)
    const b = t.base?.find(x => x.n === g.n)
    if (b && Number(b.max) > 0) {
      const ch = Math.abs(Number(g.max) - Number(b.max)) / Number(b.max)
      if (ch > 0.2 + 1e-9) errs.push(`Показател ${g.n}: от ${num(b.max)} на ${num(g.max)} т. е промяна с ${Math.round(ch * 100)}% — позволено е до 20%.`)
    }
  })
  return errs
}

/** Има ли право на ДТВ по отработените дни (с допустимия недостиг по здравословни причини). */
export function eligibility(c: Pick<Campaign, 'min_days_ped' | 'min_days_nonped' | 'sick_tolerance'>, grp: Grp, pay?: Pay | null) {
  if (pay?.override === 'yes') return { ok: true as boolean | null, why: 'Право по решение' }
  if (pay?.override === 'no') return { ok: false as boolean | null, why: 'Без право по решение' }
  if (pay?.worked_days == null) return { ok: null as boolean | null, why: 'Няма въведени дни' }
  const min = grp === 'ped' ? c.min_days_ped : c.min_days_nonped
  const short = min - pay.worked_days
  if (short <= 0) return { ok: true as boolean | null, why: `${pay.worked_days} от ${min} дни` }
  const sick = Math.min(Number(pay.sick_days || 0), c.sick_tolerance)
  if (short <= sick) return { ok: true as boolean | null, why: `Недостиг ${short} дни по здравословни причини (до ${c.sick_tolerance})` }
  return { ok: false as boolean | null, why: `Недостиг ${short} дни (минимум ${min})` }
}

/** Разпределение на фонда пропорционално на точките (по група). Закръгля до стотинка и показва остатъка. */
export function distribute(rows: { id: string; grp: Grp; points: number; eligible: boolean | null }[], funds: Partial<Record<Grp, number>>) {
  const out: Record<string, number> = {}
  const info: Record<Grp, { fund: number; points: number; perPoint: number; paid: number; rest: number; people: number }> = {} as any
  ;(['ped', 'nonped'] as Grp[]).forEach(g => {
    const list = rows.filter(r => r.grp === g && r.eligible === true && r.points > 0)
    const fund = Number(funds[g] || 0)
    const pts = list.reduce((a, r) => a + r.points, 0)
    const per = pts > 0 ? fund / pts : 0
    let paid = 0
    list.forEach(r => { const v = Math.floor(r.points * per * 100) / 100; out[r.id] = v; paid += v })
    info[g] = { fund, points: Math.round(pts * 100) / 100, perPoint: per, paid: Math.round(paid * 100) / 100, rest: Math.round((fund - paid) * 100) / 100, people: list.length }
  })
  return { amounts: out, info }
}

/** Работни дни след дата (без събота и неделя) — срокът за възражение. */
export function addWorkdays(iso: string, n: number) {
  let d = Date.parse(iso + 'T00:00:00Z'), k = 0
  while (k < n) { d += 864e5; const w = new Date(d).getUTCDay(); if (w !== 0 && w !== 6) k++ }
  return new Date(d).toISOString().slice(0, 10)
}
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
export const daysLeft = (due: string) => Math.round((Date.parse(due + 'T00:00:00Z') - Date.parse(todayIso() + 'T00:00:00Z')) / 864e5)

/** Карта по подразбиране според ролята. */
export function defaultTemplate(templates: EvalTemplate[], role: string) {
  const act = templates.filter(t => t.is_active && t.kind === 'dtv')
  return act.find(t => t.roles?.includes(role)) || null
}
/** Педагогически специалист ли е (за групата и фонда). */
export const PED_ROLES = ['class_teacher', 'teacher', 'educator', 'speech_therapist', 'psychologist', 'zdud', 'coordinator']
export const grpForRole = (role: string): Grp => (PED_ROLES.includes(role) ? 'ped' : 'nonped')

/** Предложение за име: „ДТВ 2025/2026“ */
export const campaignName = (yearName?: string | null) => `ДТВ за постигнати резултати ${(yearName || '').replace('-', '/')}`.trim()
