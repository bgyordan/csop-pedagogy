// Контролна дейност — общи типове, етикети и правила (срокове, основание).
// Нормативно: протоколът се изготвя до 15 дни от проверката (чл. 41, ал. 7 от Наредба № 8/2016);
// номерацията в Книгата започва от № 1 всяка учебна година (чл. 41, ал. 3).

export type CheckKind = 'preliminary' | 'current' | 'follow_up'
export type CheckFocus = 'pedagogical' | 'administrative'
export type CheckForm = 'thematic' | 'current' | 'observation' | 'study'
export type CheckStatus = 'draft' | 'signed' | 'voided'

/** h — ред-заглавие без оценка; b — подточка (• без собствен номер) */
export type Criterion = { k: string; t: string; h?: boolean; b?: boolean }
export type CriteriaGroup = { g: string; items: Criterion[] }
export type Finding = { s?: number; n?: string }   // скала 3: 3 изпълнено, 2 частично, 1 не, 0 неприложимо · скала 4: 1–4 (виж SCORES4)

export type ControlTemplate = {
  id: string; code: string | null; name: string; kind: CheckKind; focus: CheckFocus; form: CheckForm
  subject: string | null; purpose: string | null; method: string | null; details: string[]
  criteria: CriteriaGroup[]; is_active: boolean; sort: number; scale?: number
}

export type CheckStaff = {
  check_id: string; staff_id: string; acked_at: string | null; objection: string | null; objection_at: string | null
  self_requested_at?: string | null; self_assessment?: (Record<string, Finding> & { _note?: string }) | null; self_assessed_at?: string | null
  staff?: { first_name: string; last_name: string; position: string | null } | null
}
export type RecStatus = 'open' | 'reported' | 'done' | 'not_done'
export type Recommendation = {
  id?: string; check_id?: string; sort: number; text: string; due_date: string | null; responsible_id: string | null
  status?: RecStatus; report?: string | null; reported_at?: string | null
  review_note?: string | null; reviewed_at?: string | null; verified_in?: string | null
}
/** Справка от системата — моментна снимка към деня на проверката (заключва се с протокола). */
export type Evidence = { taken_at: string; people: { staff_id: string; name: string; lines: string[] }[] }

export type ControlCheck = {
  id: string; academic_year_id: string | null; inspector_id: string; inspector_title: string | null
  template_id: string | null; visit_booking_id: string | null
  kind: CheckKind; focus: CheckFocus; form: CheckForm; planned: boolean; announced: boolean
  check_date: string; subject: string; purpose: string | null; basis: string | null; method: string | null
  details: Record<string, string>; criteria: CriteriaGroup[]; findings: Record<string, Finding>
  findings_text: string | null; strengths: string | null; conclusions: string | null
  status: CheckStatus; book_no: number | null; signed_at: string | null; scan_path: string | null
  voided_reason: string | null; voided_at: string | null; created_at: string
  follow_up_of?: string | null; evidence?: Evidence | null; plan_item_id?: string | null; scale?: number
  inspector?: { first_name: string; last_name: string; position: string | null } | null
}

export const KIND_LABEL: Record<CheckKind, string> = { preliminary: 'Превантивен', current: 'Текущ', follow_up: 'Последващ' }
export const FOCUS_LABEL: Record<CheckFocus, string> = { pedagogical: 'Педагогически', administrative: 'Административен' }
export const FORM_LABEL: Record<CheckForm, string> = {
  thematic: 'Тематична проверка', current: 'Текуща проверка', observation: 'Наблюдение', study: 'Проучване',
}
export const STATUS_LABEL: Record<CheckStatus, string> = { draft: 'Чернова', signed: 'Подписан', voided: 'Анулиран' }
export const REC_STATUS_LABEL: Record<RecStatus, string> = { open: 'Отворена', reported: 'Отчетена', done: 'Изпълнена', not_done: 'Неизпълнена' }
export const REC_STATUS_TONE: Record<RecStatus, string> = {
  open: 'bg-slate-100 text-slate-600', reported: 'bg-indigo-50 text-indigo-700', done: 'bg-emerald-50 text-emerald-700', not_done: 'bg-rose-50 text-rose-700',
}

/** Просрочена ли е препоръката (отворена/неизпълнена и срокът е минал). */
export const recOverdue = (r: { status?: RecStatus; due_date: string | null }) =>
  !!r.due_date && (r.status === 'open' || r.status === 'not_done' || !r.status) && r.due_date < todayIso()

/** Критериите на последващия контрол — по една точка за всяка неизпълнена препоръка. Ключът r_<id> свързва оценката с препоръката. */
export function followUpCriteria(bookNo: number | null, signedAt: string | null, recs: Recommendation[]): CriteriaGroup[] {
  const items = recs.filter(r => r.id && r.status !== 'done').map(r => ({ k: `r_${r.id}`, t: r.text + (r.due_date ? ` (срок ${dmy(r.due_date)})` : '') }))
  return items.length ? [{ g: `Изпълнение на препоръките от констативен протокол № ${bookNo ?? '…'} / ${dmy(signedAt)}`, items }] : []
}

export const SCORES: { v: number; l: string; short: string }[] = [
  { v: 3, l: 'Изпълнено', short: '3' },
  { v: 2, l: 'Частично', short: '2' },
  { v: 1, l: 'Не е изпълнено', short: '1' },
  { v: 0, l: 'Неприложимо', short: 'н/п' },
]
/** Скалата от протокола на директора — степени по бланката, отляво надясно */
export const SCORES4: { v: number; l: string; short: string }[] = [
  { v: 1, l: 'Незадоволителна', short: 'Незадоволителна' },
  { v: 2, l: 'Задоволителна', short: 'Задоволителна' },
  { v: 3, l: 'Достатъчна', short: 'Достатъчна' },
  { v: 4, l: 'Значителна', short: 'Значителна' },
]
export const scoresFor = (scale?: number) => (scale === 4 ? SCORES4 : SCORES)
export const scoreLabel = (s?: number, scale?: number) => scoresFor(scale).find(x => x.v === s)?.l || ''
/** Цвят на избраната степен: зелено — най-високата, после синьо/жълто/червено */
export function scoreTone(v: number, scale?: number) {
  if (scale === 4) return v === 4 ? 'bg-emerald-600 border-emerald-600 text-white' : v === 3 ? 'bg-sky-600 border-sky-600 text-white' : v === 2 ? 'bg-amber-500 border-amber-500 text-white' : 'bg-rose-600 border-rose-600 text-white'
  return v === 3 ? 'bg-emerald-600 border-emerald-600 text-white' : v === 2 ? 'bg-amber-500 border-amber-500 text-white' : v === 1 ? 'bg-rose-600 border-rose-600 text-white' : 'bg-slate-500 border-slate-500 text-white'
}
/** Номерата на критериите в раздела (подточките „•“ не получават номер) */
export function itemNumbers(items: Criterion[]) {
  let n = 0
  return items.map(it => (it.b ? '' : String(++n)))
}

export const DETAIL_FIELDS: { k: string; l: string }[] = [
  { k: 'class', l: 'Паралелка / група' },
  { k: 'subject', l: 'Учебен предмет' },
  { k: 'topic', l: 'Тема' },
  { k: 'attendance', l: 'Присъстващи / отсъстващи ученици' },
  { k: 'place', l: 'Обект / помещения' },
  { k: 'period', l: 'Проверен период' },
  { k: 'lesson_goals', l: 'Цел и задачи на ситуацията/урока' },
  { k: 'check_tasks', l: 'Задачи на проверката' },
]
/** Полета с повече текст (textarea) */
export const LONG_DETAILS = ['lesson_goals', 'check_tasks']
/** Стойности по подразбиране за полетата при нов протокол — по кода на образеца */
export const DETAIL_DEFAULTS: Record<string, Record<string, string>> = {
  director_lesson: {
    check_tasks: 'Прилагане на съвременни теоретични постановки и педагогически технологии при организацията и провеждане на учебна дейност с деца със СОП',
  },
}

export const PROTOCOL_DAYS = 15        // чл. 41, ал. 7 от Наредба № 8
export const OBJECTION_DAYS = 7

const DAY = 864e5
const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10)
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY)

/** Срокът за протокола: последният ден и колко дни остават (отрицателно — просрочен). */
export function protocolDeadline(checkDate: string) {
  const due = addDays(checkDate, PROTOCOL_DAYS)
  return { due, left: daysBetween(todayIso(), due) }
}

export const dmy = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '')

/** Кой проверява: „Директор“, „ЗДУД“… — от длъжността, иначе по ролята. */
export function inspectorTitle(role: string, position: string | null | undefined) {
  if (position && position.trim()) return position.trim()
  if (role === 'director') return 'Директор'
  if (role === 'zdud') return 'Заместник-директор по учебната дейност'
  return 'Заместник-директор по административно-стопанската дейност'
}

/** Шаблон за административно-стопанска проверка (ЗДАСД). */
export const isAsdTemplate = (t: { code: string | null; focus: string }) =>
  t.code ? t.code.startsWith('asd_') || t.code === 'discipline' : t.focus === 'administrative'
/** Шаблоните, които вижда проверяващият: директорът — всички; ЗДУД — учебните; ЗДАСД — само административно-стопанските. */
export function templatesFor<T extends { code: string | null; focus: string }>(list: T[], role: string): T[] {
  if (role === 'director') return list
  if (role === 'zdud') return list.filter(t => !t.code?.startsWith('asd_'))
  return list.filter(isAsdTemplate)
}

/** Основанието по подразбиране — зависи от това кой проверява (директор или заместник). */
export function defaultBasis(o: { role: string; planned: boolean; yearName?: string | null }) {
  const year = (o.yearName || '').replace('-', '/')
  const plan = o.planned ? ` и План за контролната дейност за учебната ${year || '…/…'} година` : ''
  if (o.role === 'director') {
    return `чл. 258, ал. 1 от Закона за предучилищното и училищното образование, във връзка с чл. 31, ал. 1, т. 3 от Наредба № 15 от 22.07.2019 г. за статута и професионалното развитие на учителите, директорите и другите педагогически специалисти${plan}`
  }
  return `чл. 258, ал. 1 и чл. 260 от Закона за предучилищното и училищното образование, Заповед № …… на директора за определяне на функциите на заместник-директорите${plan}`
}

export const CENTER_NAME = 'Център за специална образователна подкрепа – гр. Варна'
