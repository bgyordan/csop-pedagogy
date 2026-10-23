// Заседания на Педагогическия съвет (ПС) и на Общото събрание (ОС) — типове, етикети и правила.
// Нормативно: ЗПУО, чл. 262–263 (ПС); Наредба № 8/2016, чл. 41 и Приложение № 2 („Книга за решенията на
// педагогическия съвет и протоколи от заседанията“); Кодекс на труда, чл. 6–7 (ОС).

export type Body = 'ps' | 'os'
export type MeetingStatus = 'planned' | 'held' | 'final'
export type QuorumRule = 'two_thirds' | 'half'
export type AttRole = 'member' | 'advisory' | 'guest'
export type AttStatus = 'present' | 'absent' | 'late' | 'left'
export type DecKind = 'vote' | 'noted'
export type Majority = 'simple' | 'absolute' | 'two_thirds'
export type Outcome = 'adopted' | 'rejected' | 'noted'
export type TaskStatus = 'open' | 'reported' | 'done' | 'not_done'

export type Person = { id: string; first_name: string; last_name: string; role?: string | null; position?: string | null }

export type Meeting = {
  id: string; body: Body; academic_year_id: string | null; meeting_no: number | null; kind: 'regular' | 'extraordinary'
  title: string | null; meeting_date: string; start_time: string | null; end_time: string | null; place: string | null
  chair_id: string | null; secretary_id: string | null; quorum_rule: QuorumRule; council_set_id: string | null
  intro: string | null; status: MeetingStatus; finalized_at: string | null; amended_at: string | null; amend_note: string | null
  scan_path: string | null; created_by: string | null; created_at: string
}
export type Attendance = {
  id?: string; meeting_id?: string; staff_id: string | null; guest_name: string | null; guest_role: string | null
  role: AttRole; status: AttStatus; reason: string | null; sort: number
}
export type Item = {
  id: string; meeting_id?: string; sort: number; title: string; rapporteur_id: string | null; rapporteur_text: string | null; discussion: string | null
}
export type Decision = {
  id: string; meeting_id?: string; item_id: string | null; sort: number; text: string; kind: DecKind; majority: Majority
  votes_for: number | null; votes_against: number | null; votes_abstain: number | null; outcome: Outcome
  responsible_id: string | null; due_date: string | null; task_status: TaskStatus
  report: string | null; reported_at: string | null; review_note: string | null; reviewed_at: string | null
}

export const BODY_LABEL: Record<Body, string> = { ps: 'Педагогически съвет', os: 'Общо събрание' }
export const BODY_SHORT: Record<Body, string> = { ps: 'ПС', os: 'ОС' }
/** „на Педагогическия съвет“ / „на Общото събрание“ */
export const BODY_OF: Record<Body, string> = { ps: 'на Педагогическия съвет', os: 'на Общото събрание на работниците и служителите' }
export const BODY_DECIDES: Record<Body, string> = { ps: 'Педагогическият съвет', os: 'Общото събрание' }
export const BODY_TONE: Record<Body, { bg: string; fg: string; ring: string; soft: string }> = {
  ps: { bg: '#e8effc', fg: '#1d4ed8', ring: '#bfd2f8', soft: '#f4f7fe' },
  os: { bg: '#f3ecfb', fg: '#7c3aed', ring: '#dccaf5', soft: '#faf6fe' },
}

export const STATUS_LABEL: Record<MeetingStatus, string> = { planned: 'Насрочено', held: 'Протокол в работа', final: 'Вписан в Книгата' }
export const STATUS_TONE: Record<MeetingStatus, string> = {
  planned: 'bg-sky-50 text-sky-700 border-sky-100',
  held: 'bg-amber-50 text-amber-700 border-amber-100',
  final: 'bg-emerald-50 text-emerald-700 border-emerald-100',
}
export const QUORUM_LABEL: Record<QuorumRule, string> = { two_thirds: 'поне 2/3 от членовете', half: 'повече от половината от членовете' }
export const MAJORITY_LABEL: Record<Majority, string> = {
  simple: 'обикновено (> 1/2 от присъстващите)',
  absolute: 'абсолютно (> 1/2 от всички членове)',
  two_thirds: 'квалифицирано (≥ 2/3 от присъстващите)',
}
export const OUTCOME_LABEL: Record<Outcome, string> = { adopted: 'Приема се', rejected: 'Не се приема', noted: 'Приема за сведение' }
export const TASK_LABEL: Record<TaskStatus, string> = { open: 'За изпълнение', reported: 'Отчетено', done: 'Изпълнено', not_done: 'Неизпълнено' }
export const TASK_TONE: Record<TaskStatus, string> = {
  open: 'bg-slate-100 text-slate-600', reported: 'bg-indigo-50 text-indigo-700', done: 'bg-emerald-50 text-emerald-700', not_done: 'bg-rose-50 text-rose-700',
}
export const ATT_LABEL: Record<AttStatus, string> = { present: 'присъства', absent: 'отсъства', late: 'закъснял/а', left: 'напуснал/а по-рано' }
export const ROLE_LABEL: Record<AttRole, string> = { member: 'член', advisory: 'съвещателен глас', guest: 'гост' }
export const ABSENCE_REASONS = ['болничен', 'платен отпуск', 'неплатен отпуск', 'командировка', 'служебен ангажимент', 'майчинство', 'без уважителна причина']

/** По подразбиране: ПС — поне 2/3 (практиката в правилниците); ОС — > 1/2 (чл. 6 КТ). */
export const defaultQuorum = (b: Body): QuorumRule => (b === 'ps' ? 'two_thirds' : 'half')

// ── кворум и гласуване ──
const presentLike = (s: AttStatus) => s !== 'absent'
export function quorum(att: Attendance[], rule: QuorumRule) {
  const members = att.filter(a => a.role === 'member')
  const present = members.filter(a => presentLike(a.status)).length
  const total = members.length
  const need = rule === 'two_thirds' ? Math.ceil(total * 2 / 3) : Math.floor(total / 2) + 1
  return { total, present, need, ok: total > 0 && present >= need, absent: total - present }
}

/** Приема ли се решението според гласовете и вида мнозинство. */
export function voteResult(d: Pick<Decision, 'votes_for' | 'votes_against' | 'votes_abstain' | 'majority'>, present: number, total: number) {
  const f = d.votes_for ?? 0, a = d.votes_against ?? 0, ab = d.votes_abstain ?? 0
  const cast = f + a + ab
  let need: number
  if (d.majority === 'absolute') need = Math.floor(total / 2) + 1
  else if (d.majority === 'two_thirds') need = Math.ceil(present * 2 / 3)
  else need = Math.floor(present / 2) + 1
  return { need, adopted: f >= need && f > 0, cast, over: cast > present, empty: d.votes_for == null }
}

/** Номерата на решенията в протокола (1, 2, 3 …) — по реда на точките, после по реда в точката. */
export function decisionNumbers(items: Item[], decs: Decision[]): Record<string, number> {
  const order = new Map(items.map((it, i) => [it.id, i]))
  const sorted = [...decs].sort((x, y) => {
    const ix = x.item_id ? order.get(x.item_id) ?? 999 : 999, iy = y.item_id ? order.get(y.item_id) ?? 999 : 999
    return ix - iy || x.sort - y.sort
  })
  return Object.fromEntries(sorted.map((d, i) => [d.id, i + 1]))
}

export const voteLine = (d: Decision) => d.kind === 'noted'
  ? 'Приема за сведение.'
  : `Гласували: „за“ – ${d.votes_for ?? 0}, „против“ – ${d.votes_against ?? 0}, „въздържал се“ – ${d.votes_abstain ?? 0}.`

/** Срок за изготвяне на протокола на ПС — 10 дни от заседанието (чл. 41, ал. 6 от Наредба № 8). */
export function protocolDue(m: Pick<Meeting, 'meeting_date' | 'status' | 'body'>) {
  if (m.status === 'final') return null
  const due = addDaysIso(m.meeting_date, 10)
  return { due, left: daysBetween(todayIso(), due) }
}

// ── дати ──
export const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
export const dmy = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '')
export const hm = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : '')
export function addDaysIso(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000)
const WD = ['неделя', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота']
const MON = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']
export const longDate = (iso: string) => { const d = new Date(iso + 'T12:00:00Z'); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()} г.` }
export const weekday = (iso: string) => WD[new Date(iso + 'T12:00:00Z').getUTCDay()]
export const monthShort = (iso: string) => MON[new Date(iso + 'T12:00:00Z').getUTCMonth()].slice(0, 3)

export const fullName = (p?: { first_name: string; last_name: string } | null) => (p ? `${p.first_name} ${p.last_name}`.trim() : '')
export const attName = (a: Attendance, byId: Record<string, Person>) => a.staff_id ? fullName(byId[a.staff_id]) : (a.guest_name || '')

/** Кой е член на ПС по подразбиране: педагогическите специалисти (чл. 262, ал. 2 ЗПУО). ОС — всички служители. */
export const PS_ROLES = ['class_teacher', 'teacher', 'educator', 'speech_therapist', 'psychologist', 'zdud', 'director', 'admin']
export const defaultMembers = (body: Body, people: Person[]) =>
  people.filter(p => body === 'os' || PS_ROLES.includes(p.role || ''))

// ── библиотека с точки за дневния ред ──
export type AgendaPreset = { label: string; hint?: string; items: string[] }
export const PS_PRESETS: AgendaPreset[] = [
  {
    label: 'Откриване на учебната година', hint: 'септември',
    items: [
      'Отчет за изпълнението на решенията от предходното заседание',
      'Приемане на годишния план за дейността на ЦСОП за учебната година',
      'Приемане на правилника за дейността на ЦСОП',
      'Приемане на учебните планове и формите на обучение',
      'Приемане на плана за квалификационната дейност',
      'Приемане на мерки за повишаване на качеството на образованието',
      'Приемане на програмата за предоставяне на равни възможности и за приобщаване',
      'Определяне на постоянните комисии и екипите',
      'Разни',
    ],
  },
  {
    label: 'Резултати от I срок', hint: 'февруари',
    items: [
      'Отчет за изпълнението на решенията от предходното заседание',
      'Анализ на резултатите от обучението и подкрепата през първия учебен срок',
      'Отчет за изпълнението на индивидуалните учебни планове и програми',
      'Резултати от контролната дейност на директора и заместник-директорите',
      'Отчет за квалификационната дейност през първия срок',
      'Разни',
    ],
  },
  {
    label: 'Годишен отчет', hint: 'юни – юли',
    items: [
      'Отчет за изпълнението на решенията от предходното заседание',
      'Анализ и отчет на дейността на ЦСОП през учебната година',
      'Отчет на постоянните комисии и екипите за подкрепа',
      'Резултати от контролната дейност през учебната година',
      'Отчет за изпълнението на плана за квалификационната дейност',
      'Насоки и предложения за следващата учебна година',
      'Разни',
    ],
  },
]
export const PS_ITEMS = [
  'Отчет за изпълнението на решенията от предходното заседание',
  'Приемане на стратегия за развитие (актуализация)',
  'Приемане на годишния план за дейността',
  'Приемане на правилника за дейността',
  'Приемане на план за квалификационната дейност',
  'Приемане на мерки за повишаване на качеството на образованието',
  'Приемане на програма за превенция на ранното напускане',
  'Приемане на програма за равни възможности и приобщаване',
  'Обсъждане на мерки за подкрепа на ученици',
  'Предложения за награждаване на ученици и учители',
  'Иновации и участие в проекти и програми',
  'Резултати от контролната дейност',
  'Разни',
]
export const OS_PRESETS: AgendaPreset[] = [
  {
    label: 'Годишно общо събрание',
    items: [
      'Информация за изпълнението на бюджета',
      'Вътрешни правила за работната заплата — запознаване и становище',
      'Правилник за вътрешния трудов ред — запознаване',
      'Разни',
    ],
  },
  {
    label: 'Избор на представители',
    items: ['Избор на представители на работниците и служителите по чл. 7, ал. 2 от Кодекса на труда', 'Разни'],
  },
]
export const OS_ITEMS = [
  'Избор на представители по чл. 7, ал. 2 от Кодекса на труда',
  'Избор на представители в групата по условия на труд',
  'Информация за бюджета и средствата за работна заплата',
  'Вътрешни правила за работната заплата',
  'Правилник за вътрешния трудов ред',
  'Колективен трудов договор — информация',
  'Обществен съвет — излъчване на представител',
  'Разни',
]
