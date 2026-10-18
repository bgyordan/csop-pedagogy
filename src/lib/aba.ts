// АБА в досието: ABC картон (поведение) и DTT (дискретни опити).
// Списъците са в духа на „Дневник на случаите“ (src/lib/incidents.ts), разширени за ежедневния запис.

// ── ABC ──
export const ANTECEDENTS = [
  'дадена инструкция/задача', 'преход/смяна на дейност', 'отказ (казано „не“)', 'отказан предмет/играчка',
  'чакане', 'шум/много хора', 'липса на внимание', 'свободно (неструктурирано) време',
  'провокация от друго дете', 'нов човек/място', 'умора/глад/болка', 'без видима причина',
]
export const BEHAVIORS = [
  'писък/плач', 'хвърляне на предмети', 'агресия към дете', 'агресия към възрастен', 'самонараняване',
  'бягство/ставане от масата', 'отказ от дейност', 'стереотипии (самостимулация)', 'разрушаване на вещи', 'криза/срив', 'друго',
]
export const CONSEQUENCES = [
  'планирано игнориране', 'пренасочване', 'задачата е временно махната', 'почивка', 'тиха зона/успокояване',
  'физическо блокиране/подсказка', 'получи искания предмет', 'внимание/разговор', 'раздяла на децата',
]
export const ABC_PLACES = ['Класна стая', 'Кабинет (терапия)', 'Коридор', 'Двор', 'ЦОУД', 'Транспорт', 'Друго']

export const INTENSITY: { n: number; label: string; color: string; bg: string }[] = [
  { n: 1, label: 'много леко', color: '#166534', bg: '#f0fdf4' },
  { n: 2, label: 'леко', color: '#3f6212', bg: '#f7fee7' },
  { n: 3, label: 'умерено', color: '#a16207', bg: '#fefce8' },
  { n: 4, label: 'силно', color: '#c2410c', bg: '#fff7ed' },
  { n: 5, label: 'опасно', color: '#b91c1c', bg: '#fef2f2' },
]

// Възможна функция на поведението по последствието — само хипотеза за екипа, не заключение
const FUNCTION_OF: Record<string, string> = {
  'задачата е временно махната': 'бягство от задачата',
  'почивка': 'бягство от задачата',
  'тиха зона/успокояване': 'бягство от задачата',
  'внимание/разговор': 'търсене на внимание',
  'получи искания предмет': 'получаване на предмет/дейност',
}

export type AbcRecord = {
  id: string; student_id: string; occurred_on: string; occurred_time: string | null; place: string | null
  antecedent: string; behavior: string; consequence: string; intensity: number; note: string | null
  staff_id: string | null; created_at: string
}

const count = (xs: string[]) => {
  const m: Record<string, number> = {}
  xs.forEach(x => { m[x] = (m[x] || 0) + 1 })
  return Object.entries(m).sort((a, b) => b[1] - a[1])
}

export function abcAnalysis(rs: AbcRecord[]) {
  const n = rs.length
  const ants = count(rs.map(r => r.antecedent))
  const behs = count(rs.map(r => r.behavior))
  const cons = count(rs.map(r => r.consequence))
  const pct = (k: number) => (n ? Math.round((k / n) * 100) : 0)
  // часовете от деня (8–17)
  const hours: Record<number, number> = {}
  rs.forEach(r => { if (r.occurred_time) { const h = Number(r.occurred_time.slice(0, 2)); hours[h] = (hours[h] || 0) + 1 } })
  // по седмици (последните 10) — брой и среден интензитет
  const wk = (d: string) => { const x = new Date(d + 'T12:00:00'); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x.toISOString().slice(0, 10) }
  const wm = new Map<string, { n: number; sum: number }>()
  rs.forEach(r => { const k = wk(r.occurred_on); const v = wm.get(k) || { n: 0, sum: 0 }; v.n++; v.sum += r.intensity; wm.set(k, v) })
  const weeks = Array.from(wm.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-10).map(([w, v]) => ({ w, n: v.n, avg: v.sum / v.n }))
  // хипотеза за функцията
  const fn = count(rs.map(r => FUNCTION_OF[r.consequence]).filter(Boolean) as string[])
  const avg = n ? rs.reduce((s, r) => s + r.intensity, 0) / n : 0
  const headline = ants[0] && n >= 3 ? `${pct(ants[0][1])}% от записаните поведения са при „${ants[0][0]}“.` : ''
  const fnHint = fn[0] && n >= 5 && fn[0][1] / n >= 0.4
    ? `В ${pct(fn[0][1])}% от случаите след поведението следва нещо, което може да го поддържа — възможна функция: ${fn[0][0]}. Обсъдете с екипа.`
    : ''
  return { n, ants, behs, cons, pct, hours, weeks, avg, headline, fnHint }
}

// ── DTT ──
export type Mark = '+' | '-' | 'P'
export const MARKS: Record<Mark, { label: string; hint: string; color: string; bg: string }> = {
  '+': { label: 'Вярно', hint: 'напълно самостоятелно', color: '#15803d', bg: '#f0fdf4' },
  'P': { label: 'С подсказка', hint: 'след помощ — физическа, словесна или с жест; не се брои за самостоятелен', color: '#b45309', bg: '#fffbeb' },
  '-': { label: 'Грешно', hint: 'грешка или липса на реакция', color: '#b91c1c', bg: '#fef2f2' },
}
export const DTT_AREAS = ['Разпознаване', 'Имитация', 'Рецептивен език', 'Експресивен език', 'Съпоставяне', 'Самообслужване', 'Игра', 'Академични', 'Друго']

export type Target = {
  id: string; student_id: string; title: string; area: string | null
  criterion_pct: number; criterion_sessions: number; trials_per_session: number
  status: 'active' | 'mastered' | 'paused'; added_on: string; mastered_on: string | null
  added_by: string | null; note: string | null; created_at: string
}
export type DttSession = {
  id: string; target_id: string; student_id: string; held_on: string; marks: string
  staff_id: string | null; note: string | null; created_at: string
}

export const scoreOf = (marks: string) => {
  const total = marks.length, correct = marks.split('').filter(c => c === '+').length
  const prompted = marks.split('').filter(c => c === 'P').length
  return { total, correct, prompted, wrong: total - correct - prompted, pct: total ? Math.round((correct / total) * 100) : 0 }
}

export const sortSessions = (ss: DttSession[]) => ss.slice().sort((a, b) => a.held_on.localeCompare(b.held_on) || a.created_at.localeCompare(b.created_at))

// Поредни успешни сесии (от последната назад) и дали критерият е изпълнен
export function streakOf(t: Target, ss: DttSession[]) {
  const list = sortSessions(ss)
  let streak = 0
  for (let i = list.length - 1; i >= 0; i--) {
    if (scoreOf(list[i].marks).pct >= t.criterion_pct) streak++
    else break
  }
  return { streak, met: streak >= t.criterion_sessions }
}

export const todaySofia = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
export const nowSofia = () => new Date().toLocaleTimeString('sv-SE', { timeZone: 'Europe/Sofia', hour: '2-digit', minute: '2-digit' })
export const fmtDate = (d: string) => (d ? d.split('-').reverse().join('.') : '')
export const fmtShort = (d: string) => (d ? d.split('-').reverse().slice(0, 2).join('.') : '')
