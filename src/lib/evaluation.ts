// Оценяване на персонала — общи типове, етикети и сметки.
// ДТВ: по Вътрешните правила на ЦСОП – Варна — една комисия, карта по длъжност (общо 100 т.), корекция до 20%
// на показател, възражение до 3 работни дни, сума пропорционално на точките.
// Атестиране (Наредба № 15/2019): самооценка (СО) + оценка на комисията (ОАК), ОР = 0,25·СО + 0,75·ОАК, скала 25–50,
// възражение до 5 работни дни, работодателят потвърждава или променя с една степен, на всеки 4 години.
// Други карти: същият ред (комисия, средно или обща оценка, по желание самооценка), без суми.

export type Grp = 'ped' | 'nonped'
export type Kind = 'dtv' | 'attest' | 'other'
export type EvalItem = { k: string; t: string; max: number }
/** h — заглавие на раздела над показателя (напр. „I. Педагогически компетентности…“) */
export type EvalGroup = { n: string; g: string; max: number; items: EvalItem[]; h?: string }
export type Scores = Record<string, number>

export type EvalTemplate = {
  id: string; code: string | null; kind: string; grp: Grp; name: string; title: string; adopted: string | null
  col_label: string; roles: string[]; criteria: EvalGroup[]; base: EvalGroup[] | null; total: number
  is_active: boolean; sort: number; guide?: string | null
}

export type ScaleStep = { min: number; l: string; support?: boolean; reattest?: boolean }
export type CampaignStatus = 'setup' | 'scoring' | 'closed'
export type Campaign = {
  id: string; kind: string; name: string; academic_year_id: string | null; status: CampaignStatus
  aggregate: 'avg' | 'joint'; card_days: number; objection_days: number
  min_days_ped: number; min_days_nonped: number; sick_tolerance: number
  score_by: string | null; order_by: string | null; basis: string | null
  protocol_no: string | null; protocol_date: string | null; scan_path: string | null
  created_at: string; closed_at: string | null
  period_from?: string | null; period_to?: string | null; self_assess?: boolean; self_by?: string | null
  decide_days?: number; secretary_id?: string | null; scale?: ScaleStep[] | null; note?: string | null; source_id?: string | null
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
  self_scores?: Scores | null; self_total?: number | null; self_at?: string | null; section_a?: SectionA | null
  result?: number | null; grade?: string | null; commission_comment?: string | null
  employer_grade?: string | null; employer_note?: string | null; employer_at?: string | null
  staff?: Person | null
}
export type Member = { campaign_id: string; staff_id: string; role: 'chair' | 'member'; sort: number; org?: string | null; staff?: Person | null }
export type External = { id: string; campaign_id: string; name: string; org: string | null; sort: number }
export type ScoreRow = { id?: string; participant_id: string; member_id: string | null; ext_id?: string | null; scores: Scores; total: number; submitted_at: string | null }
export type EvalFile = { id: string; participant_id: string; name: string; path: string; note: string | null; uploaded_by: string | null; created_at: string }
export type Support = {
  participant_id: string; mentor_id: string | null; causes: string | null; measures: string | null; training: string | null
  start_date: string | null; reattest_by: string | null; status: 'open' | 'done'; result: string | null
}
export type History = { id: string; staff_id: string; attested_on: string; result: number | null; grade: string | null; note: string | null }
export type Evidence = {
  from: string; to: string
  checks: { id: string; date: string; book_no: number | null; subject: string; form: string; kind: string; inspector: string | null; strengths: string | null; conclusions: string | null; objection: string | null }[]
  recs: { text: string; due: string | null; status: string; report: string | null }[]
  counts: { k: string; l: string; n: number | null }[]
}
export type Pay = { participant_id: string; worked_days: number | null; sick_days: number | null; override: 'yes' | 'no' | null; note: string | null }

export const KIND_LABEL: Record<Kind, string> = { dtv: 'ДТВ за постигнати резултати', attest: 'Атестиране', other: 'Друга оценка' }
export const KIND_SHORT: Record<Kind, string> = { dtv: 'ДТВ', attest: 'Атестиране', other: 'Оценка' }
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
export function validateTemplate(t: { criteria: EvalGroup[]; base: EvalGroup[] | null; total: number; kind?: string }): string[] {
  const errs: string[] = []
  const total = maxTotal(t.criteria)
  if (Math.abs(total - Number(t.total || 100)) > 0.001) errs.push(`Общият брой точки е ${num(total)}, а трябва да е ${num(t.total || 100)}.`)
  t.criteria.forEach(g => {
    const s = g.items.reduce((a, it) => a + Number(it.max || 0), 0)
    if (Math.abs(s - Number(g.max)) > 0.001) errs.push(`Показател ${g.n}: критериите дават ${num(s)} т., а показателят е ${num(g.max)} т.`)
    if (!g.items.length) errs.push(`Показател ${g.n} няма критерии.`)
    const b = t.kind && t.kind !== 'dtv' ? null : t.base?.find(x => x.n === g.n)
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
export function defaultTemplate(templates: EvalTemplate[], role: string, kind: string = 'dtv') {
  const act = templates.filter(t => t.is_active && t.kind === kind)
  const hit = act.find(t => t.roles?.includes(role))
  if (hit) return hit
  // Една обща карта за групата (напр. за всички педагози) — ползва се за всяка длъжност от групата.
  const same = act.filter(t => t.grp === grpForRole(role))
  return same.length === 1 ? same[0] : null
}
/** Педагогически специалист ли е (за групата и фонда). */
export const PED_ROLES = ['class_teacher', 'teacher', 'educator', 'speech_therapist', 'psychologist', 'zdud', 'coordinator']
export const grpForRole = (role: string): Grp => (PED_ROLES.includes(role) ? 'ped' : 'nonped')

/** Предложение за име: „ДТВ за постигнати резултати 2025/2026“ */
export const campaignName = (yearName?: string | null, kind: Kind = 'dtv') =>
  `${kind === 'dtv' ? 'ДТВ за постигнати резултати' : kind === 'attest' ? 'Атестиране' : 'Оценяване'} ${(yearName || '').replace('-', '/')}`.trim()

// ── Атестиране ────────────────────────────────────────────────────────────
export const DEFAULT_SCALE: ScaleStep[] = [
  { min: 45, l: 'Изключително изпълнение' },
  { min: 40, l: 'Надвишава изискванията' },
  { min: 35, l: 'Отговаря на изискванията' },
  { min: 30, l: 'Отговаря частично на изискванията', support: true },
  { min: 25, l: 'Съответства в минимална степен на изискванията', support: true, reattest: true },
]
export const scaleOf = (c?: { scale?: ScaleStep[] | null } | null) => (c?.scale?.length ? c.scale : DEFAULT_SCALE)
/** Степента по скалата — като в базата (eval_grade) */
export function gradeOf(scale: ScaleStep[], v: number | null | undefined) {
  if (v == null || isNaN(v)) return null
  return (scale.find(s => v >= s.min) || scale[scale.length - 1])?.l || null
}
export const stepOf = (scale: ScaleStep[], grade: string | null | undefined) => scale.find(s => s.l === grade) || null
/** ОР = 0,25·СО + 0,75·ОАК (до 2 знака) */
export const attestResult = (so: number | null | undefined, oak: number | null | undefined) =>
  so == null || oak == null ? null : Math.round((0.25 * Number(so) + 0.75 * Number(oak)) * 100) / 100
/** Крайната оценка: на работодателя, ако е вписал, иначе на комисията */
export const finalGrade = (x: { employer_grade?: string | null; grade?: string | null }) => x.employer_grade || x.grade || null
/** Степените, до които работодателят може да промени оценката (± една) */
export function employerOptions(scale: ScaleStep[], grade: string | null | undefined, objected: boolean) {
  const i = scale.findIndex(s => s.l === grade)
  if (i < 0) return scale.map(s => s.l)
  return objected ? scale.filter((_, j) => Math.abs(j - i) <= 1).map(s => s.l) : [scale[i].l]
}
export const ATTEST_YEARS = 4
export const addYears = (iso: string, n: number) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${y + n}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` }

/** Раздел А „Съответствие с изискванията на длъжността“ (прил. № 20) — попълва атестираният. */
export type SectionA = {
  edu1?: string; edu2?: string; specialty?: string; teacher_q?: 'yes' | 'no'; other_q?: 'yes' | 'no'; other_q_text?: string
  pks?: string; years_total?: number | null; years_teacher?: number | null
  hours_internal?: number | null; hours_mandatory?: number | null; credits?: number | null; prev_recs?: 'yes' | 'no' | 'na'
}
export const EDU_LEVELS = ['Средно образование', 'Професионален бакалавър', 'Бакалавър', 'Магистър', 'Доктор', 'Доктор на науките']
export const PKS_LEVELS = ['няма', 'V ПКС', 'IV ПКС', 'III ПКС', 'II ПКС', 'I ПКС']

/** Атестиращите роли по подразбиране (педагогически специалисти без директора) */
export const ATTEST_ROLES = ['class_teacher', 'teacher', 'educator', 'speech_therapist', 'psychologist', 'zdud', 'coordinator']
