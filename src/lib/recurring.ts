// Логика за повтарящи се задачи/срокове (график).
// Моделът е нарочно олекотен (à la Google Calendar "custom recurrence"):
//   once    – еднократно на дата
//   weekly  – в избрани дни от седмицата
//   monthly – на дадено число, всеки месец ИЛИ в избрани месеци
//   yearly  – веднъж годишно (месечно с точно един месец)

export type RecFreq = 'once' | 'weekly' | 'monthly' | 'yearly'

export interface RecTask {
  id: string
  title: string
  description?: string | null
  freq: RecFreq
  weekdays?: number[] | null   // 1=Пн .. 7=Нд (ISO)
  day_of_month?: number | null // 1..31, а 0 = "последния ден от месеца"
  months?: number[] | null     // 1..12; празно/null = всеки месец
  once_date?: string | null    // 'YYYY-MM-DD'
  lead_days?: number | null    // напомни N дни преди
  color?: string | null
  active?: boolean
}

export const MONTHS_BG = ['', 'януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']
export const MONTHS_SHORT_BG = ['', 'Яну', 'Фев', 'Мар', 'Апр', 'Май', 'Юни', 'Юли', 'Авг', 'Сеп', 'Окт', 'Ное', 'Дек']
export const WD_BG = ['', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота', 'неделя']
export const WD_SHORT_BG = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

export function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate()
}

function isoWeekday(d: Date): number {
  const g = d.getDay() // 0=Нд .. 6=Сб
  return g === 0 ? 7 : g
}

function daysBetween(fromStr: string, toStr: string): number {
  const a = new Date(fromStr + 'T00:00:00')
  const b = new Date(toStr + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

// Всички дати на повторение в интервала [from, to] (включително).
export function expandOccurrences(t: RecTask, from: Date, to: Date): string[] {
  const out: string[] = []
  const fromStr = ymd(from)
  const toStr = ymd(to)

  if (t.freq === 'once') {
    if (t.once_date && t.once_date >= fromStr && t.once_date <= toStr) out.push(t.once_date)
    return out
  }

  if (t.freq === 'weekly') {
    const wd = new Set(t.weekdays && t.weekdays.length ? t.weekdays : [1])
    const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate())
    while (cur <= to) {
      if (wd.has(isoWeekday(cur))) out.push(ymd(cur))
      cur.setDate(cur.getDate() + 1)
    }
    return out
  }

  // monthly / yearly
  const monthsList = (t.months && t.months.length)
    ? t.months
    : (t.freq === 'yearly' ? [1] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  const dom = t.day_of_month ?? 1
  for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
    for (const m of monthsList) {
      const day = dom === 0 ? lastDayOfMonth(y, m) : Math.min(dom, lastDayOfMonth(y, m))
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      if (dateStr >= fromStr && dateStr <= toStr) out.push(dateStr)
    }
  }
  out.sort()
  return out
}

export type TaskState = 'overdue' | 'due-soon' | 'upcoming' | 'none'

export interface TaskStatus {
  current: string | null   // повода, който следим (просрочен или предстоящ)
  daysUntil: number | null // + бъдещ, - минал, 0 днес
  state: TaskState
}

// Текущият актуален повод = най-ранният НЕотметнат повод в прозорец около днес.
export function taskStatus(t: RecTask, completed: Set<string>, today = new Date()): TaskStatus {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const from = new Date(t0); from.setDate(from.getDate() - 31)
  const to = new Date(t0); to.setDate(to.getDate() + 400)
  const occ = expandOccurrences(t, from, to)
  const todayStr = ymd(t0)

  const current = occ.find(d => !completed.has(d))
  if (!current) return { current: null, daysUntil: null, state: 'none' }

  const days = daysBetween(todayStr, current)
  const lead = t.lead_days ?? 3
  let state: TaskState
  if (days < 0) state = 'overdue'
  else if (days <= lead) state = 'due-soon'
  else state = 'upcoming'
  return { current, daysUntil: days, state }
}

// Четлив текст на правилото за списъка.
export function recSummary(t: RecTask): string {
  if (t.freq === 'once') return t.once_date ? `Еднократно на ${fmt(t.once_date)}` : 'Еднократно'

  if (t.freq === 'weekly') {
    const wd = (t.weekdays && t.weekdays.length ? t.weekdays : [1]).slice().sort((a, b) => a - b)
    if (wd.length === 1) return `Всяка седмица в ${WD_BG[wd[0]]}`
    if (wd.length === 5 && wd.every((d, i) => d === i + 1)) return 'Всеки учебен ден (Пн–Пт)'
    return `Всяка седмица: ${wd.map(d => WD_SHORT_BG[d]).join(', ')}`
  }

  const dayLabel = (t.day_of_month === 0) ? 'последния ден' : `${t.day_of_month ?? 1}-о число`

  if (t.freq === 'yearly') {
    const m = (t.months && t.months[0]) || 1
    return `Всяка година · ${MONTHS_BG[m]}, ${dayLabel}`
  }

  // monthly
  if (!t.months || !t.months.length) return `Всеки месец · ${dayLabel}`
  const ms = t.months.slice().sort((a, b) => a - b).map(m => MONTHS_SHORT_BG[m]).join(', ')
  return `${dayLabel} · ${ms}`
}

function fmt(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}
