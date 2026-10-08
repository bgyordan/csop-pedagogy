// ЕДИННА номерация на учебните часове (разписания на паралелки, ИФО, ЦОУД, замествания, терапевти):
// 1–7 = сутрешни часове; 8–13 = следобедни ИФО часове („ИФО 1“–„ИФО 6“);
// 21–26 = ЦОУД блоковете на възпитателите („ЦОУД 1“–„ЦОУД 6“). В educator_slots се пазят като 1–6 → coudPeriod(p).
// Номерът НЕ е час от деня — сравнявай по start/end (минути от полунощ).
export interface PeriodDef { n: number; label: string; time: string; start: number; end: number; afternoon: boolean }

const t = (h: number, m: number) => h * 60 + m
export const PERIOD_DEFS: PeriodDef[] = [
  { n: 1, label: '1', time: '8:30–9:05', start: t(8, 30), end: t(9, 5), afternoon: false },
  { n: 2, label: '2', time: '9:15–9:50', start: t(9, 15), end: t(9, 50), afternoon: false },
  { n: 3, label: '3', time: '10:20–10:55', start: t(10, 20), end: t(10, 55), afternoon: false },
  { n: 4, label: '4', time: '11:05–11:40', start: t(11, 5), end: t(11, 40), afternoon: false },
  { n: 5, label: '5', time: '11:50–12:25', start: t(11, 50), end: t(12, 25), afternoon: false },
  { n: 6, label: '6', time: '12:35–13:05', start: t(12, 35), end: t(13, 5), afternoon: false },
  { n: 7, label: '7', time: '13:15–13:50', start: t(13, 15), end: t(13, 50), afternoon: false },
  { n: 8, label: 'ИФО 1', time: '12:45–13:15', start: t(12, 45), end: t(13, 15), afternoon: true },
  { n: 9, label: 'ИФО 2', time: '13:20–13:50', start: t(13, 20), end: t(13, 50), afternoon: true },
  { n: 10, label: 'ИФО 3', time: '13:55–14:25', start: t(13, 55), end: t(14, 25), afternoon: true },
  { n: 11, label: 'ИФО 4', time: '14:30–15:00', start: t(14, 30), end: t(15, 0), afternoon: true },
  { n: 12, label: 'ИФО 5', time: '15:05–15:35', start: t(15, 5), end: t(15, 35), afternoon: true },
  { n: 13, label: 'ИФО 6', time: '15:40–16:10', start: t(15, 40), end: t(16, 10), afternoon: true },
  { n: 21, label: 'ЦОУД 1', time: '12:25–13:00', start: t(12, 25), end: t(13, 0), afternoon: true },
  { n: 22, label: 'ЦОУД 2', time: '13:20–13:55', start: t(13, 20), end: t(13, 55), afternoon: true },
  { n: 23, label: 'ЦОУД 3', time: '14:15–14:50', start: t(14, 15), end: t(14, 50), afternoon: true },
  { n: 24, label: 'ЦОУД 4', time: '15:05–15:40', start: t(15, 5), end: t(15, 40), afternoon: true },
  { n: 25, label: 'ЦОУД 5', time: '15:55–16:30', start: t(15, 55), end: t(16, 30), afternoon: true },
  { n: 26, label: 'ЦОУД 6', time: '16:45–17:20', start: t(16, 45), end: t(17, 20), afternoon: true },
]
// ЦОУД блок (1–6 от educator_slots) → номер в единната карта (21–26)
export const COUD_OFFSET = 20
export const coudPeriod = (p: number) => COUD_OFFSET + p
export const COUD_PERIODS = [1, 2, 3, 4, 5, 6].map(coudPeriod)
export const PERIOD_BY_N: Record<number, PeriodDef> = Object.fromEntries(PERIOD_DEFS.map(p => [p.n, p]))
export const PERIOD_TIMES: Record<number, string> = Object.fromEntries(PERIOD_DEFS.map(p => [p.n, p.time]))
export const PERIOD_LABEL: Record<number, string> = Object.fromEntries(PERIOD_DEFS.map(p => [p.n, p.label]))
export const MORNING_PERIODS = PERIOD_DEFS.filter(p => !p.afternoon).map(p => p.n)
export const AFTERNOON_PERIODS = PERIOD_DEFS.filter(p => p.afternoon && p.n < COUD_OFFSET).map(p => p.n)

// Застъпват ли се два часа по време (напр. 6. час и „ИФО 1“)
export function periodsOverlap(a: number, b: number): boolean {
  const x = PERIOD_BY_N[a], y = PERIOD_BY_N[b]
  if (!x || !y) return a === b
  return x.start < y.end && y.start < x.end
}
// Подреждане по начален час (не по номер — „ИФО 1“ е преди 7. час)
export const byStartTime = (a: number, b: number) => (PERIOD_BY_N[a]?.start ?? a * 100) - (PERIOD_BY_N[b]?.start ?? b * 100)
