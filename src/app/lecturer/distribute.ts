// Автоматично разпределение на годишните лекторски часове в разписанието на учителя.
// Броят се само реалните учебни дни от календара (без ваканции и празници).
//
//  1. Краят на годината за учителя = началото на II срок + N учебни седмици (18 / 16 / 14).
//  2. Всеки слот (ден+час) дава толкова часа, колкото са учебните дни в този делничен ден.
//  3. Пълни слотове до края на годината, докато има място; остатъкът — един слот,
//     който спира на датата, на която се събира точният брой.
//  4. По един час на ден (празник отнема най-много 1 час); втори в същия ден — само ако няма как иначе.

export type SchoolDay = { date: string; term: number }
export type SchedSlot = { day: number; period: number; subjectId: string | null; subject: string; holderType: string; holderLabel: string }
export type PlannedSlot = SchedSlot & { dateFrom: string; dateTo: string; hours: number }

export const dowOf = (date: string) => { const d = new Date(date + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d }

/** Клас от името на паралелката: „1А“, „1 а“, „IV б“ → 1 / 4; иначе null */
export function gradeOf(name: string): number | null {
  const s = (name || '').trim()
  const m = s.match(/^(\d{1,2})/)
  if (m) return Number(m[1])
  const R: [string, number][] = [['XII', 12], ['XI', 11], ['X', 10], ['IX', 9], ['VIII', 8], ['VII', 7], ['VI', 6], ['V', 5], ['IV', 4], ['III', 3], ['II', 2], ['I', 1]]
  for (const [r, n] of R) if (new RegExp(`^${r}(?![IVX])`, 'i').test(s)) return n
  return null
}
/** Седмици във II срок според класа: I клас — 14, II–VI — 16, VII+ — 18 */
export function term2WeeksOf(name: string): number | null {
  const g = gradeOf(name)
  if (g === null) return null
  return g === 1 ? 14 : g <= 6 ? 16 : 18
}
/** Предложение за учителя: най-дългата година сред класовете му (по подразбиране 18) */
export function suggestWeeks(classNames: string[]): number {
  const w = classNames.map(term2WeeksOf).filter((x): x is number => x !== null)
  return w.length ? Math.max(...w) : 18
}

const mondayOf = (date: string) => {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (dowOf(date) - 1))
  return d.toISOString().slice(0, 10)
}

/** Учебните дни на учителя: целият I срок + първите N седмици от II срок */
export function teacherYear(days: SchoolDay[], term2Weeks: number) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const t1 = sorted.filter(d => d.term !== 2)
  const t2 = sorted.filter(d => d.term === 2)
  const weeks: string[] = []
  const t2Kept: SchoolDay[] = []
  for (const d of t2) {
    const w = mondayOf(d.date)
    if (!weeks.includes(w)) { if (weeks.length >= term2Weeks) break; weeks.push(w) }
    t2Kept.push(d)
  }
  const all = [...t1, ...t2Kept].map(d => d.date)
  return { dates: all, from: all[0] || '', to: all[all.length - 1] || '', hasTerm2: t2.length > 0 }
}

/** Случайна подредба (с подаден генератор — за тестове) */
function shuffle<T>(a: T[], rnd: () => number): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] }
  return r
}

export function planDistribution({ dates, total, term2Weeks, schedule, rnd = Math.random }: {
  dates: string[]; total: number; term2Weeks: number; schedule: SchedSlot[]; rnd?: () => number
}): { slots: PlannedSlot[]; placed: number; missing: number } {
  const from = dates[0], to = dates[dates.length - 1]
  const byDow: Record<number, string[]> = {}
  dates.forEach(d => { (byDow[dowOf(d)] ||= []).push(d) })

  // часовете в класове с по-кратка година не стигат до края — оставяме ги за последно
  const fits = (s: SchedSlot) => { const w = term2WeeksOf(s.holderLabel); return w === null || w >= term2Weeks }
  // уникални клетки (при групи в един час — една клетка)
  const cells: SchedSlot[] = []
  schedule.forEach(s => { if (!cells.some(c => c.day === s.day && c.period === s.period)) cells.push(s) })

  const used = new Set<string>()
  const out: PlannedSlot[] = []
  let rem = total
  // кръгове: в първия — по един час на ден; следващите — само ако не стига
  while (rem > 0) {
    let added = false
    const days = shuffle(Array.from(new Set(cells.map(c => c.day))), rnd).filter(d => (byDow[d] || []).length > 0)
    for (const day of days) {
      if (rem <= 0) break
      const free = cells.filter(c => c.day === day && !used.has(`${c.day}-${c.period}`))
      if (!free.length) continue
      const good = free.filter(fits)
      const pick = shuffle(good.length ? good : free, rnd)[0]
      used.add(`${pick.day}-${pick.period}`)
      const occ = byDow[day]
      if (rem >= occ.length) {
        out.push({ ...pick, dateFrom: from, dateTo: to, hours: occ.length })
        rem -= occ.length
      } else {
        out.push({ ...pick, dateFrom: from, dateTo: occ[rem - 1], hours: rem })
        rem = 0
      }
      added = true
    }
    if (!added) break
  }
  const placed = out.reduce((a, s) => a + s.hours, 0)
  return { slots: out.sort((a, b) => a.day - b.day || a.period - b.period), placed, missing: Math.max(0, total - placed) }
}

/** Точен брой часове на слот: учебните дни в неговия делничен ден между двете дати */
export function slotHours(dates: string[], day: number, from: string, to: string) {
  return dates.filter(d => d >= from && d <= to && dowOf(d) === day).length
}
