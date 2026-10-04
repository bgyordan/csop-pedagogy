// Автоматично разпределение на годишните лекторски часове в разписанието на учителя.
// Броят се само реалните учебни дни от календара (без ваканции и празници).
//
//  • Всяка паралелка учи до последния учебен ден на детето с най-дълъг учебен срок в нея
//    (по класа му в изпращащото училище и датите на МОН: I–III, IV–VI, VII–XI, XII).
//  • Брои се по УЧЕБНИ СЕДМИЦИ (както МОН: учебни дни ÷ 5), не по дните на часа —
//    празник в деня на часа не намалява броя. 1 ч./седм. за година = 32 (I–III), 34 (IV–VI), 36 (VII–XI), 31 (XII).
//  • Пълни слотове, докато има място; остатъкът — един слот, който спира на датата,
//    на която се събира точният брой.
//  • По един час на ден (празник отнема най-много 1 час); втори в същия ден — само ако няма как иначе.
//  • ИФО не се ползва.

export type SchoolDay = { date: string; term: number }
export type SchedSlot = { day: number; period: number; subjectId: string | null; subject: string; holderType: string; holderLabel: string }
export type PlannedSlot = SchedSlot & { dateFrom: string; dateTo: string; hours: number }

export type Grp = '1-3' | '4-6' | '7-11' | '12'
export const GROUPS: { key: Grp; label: string }[] = [
  { key: '1-3', label: 'I–III клас' }, { key: '4-6', label: 'IV–VI клас' },
  { key: '7-11', label: 'VII–XI клас' }, { key: '12', label: 'XII клас' },
]
export type Ends = Partial<Record<Grp, string>>
/** Учебни седмици за годината по групи (18 + II срок) — 1 ч./седм. носи толкова часа */
export const YEAR_WEEKS: Record<Grp, number> = { '1-3': 32, '4-6': 34, '7-11': 36, '12': 31 }
/** Ако датата е последният учебен ден на група — седмиците ѝ по норматив */
export function normWeeks(end: string, ends: Ends): number | null {
  const g = (Object.keys(ends) as Grp[]).filter(k => ends[k] === end).sort((a, b) => YEAR_WEEKS[b] - YEAR_WEEKS[a])[0]
  return g ? YEAR_WEEKS[g] : null
}

export const dowOf = (date: string) => { const d = new Date(date + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d }

/** Клас в изпращащото училище: „5“, „V“, „IV“ → 5 / 4; иначе null (напр. ПГ) */
export function gradeOf(name: string | null | undefined): number | null {
  const s = (name || '').trim()
  const m = s.match(/^(\d{1,2})(?!\d)/)
  if (m) return Number(m[1])
  const R: [string, number][] = [['XII', 12], ['XI', 11], ['X', 10], ['IX', 9], ['VIII', 8], ['VII', 7], ['VI', 6], ['V', 5], ['IV', 4], ['III', 3], ['II', 2], ['I', 1]]
  for (const [r, n] of R) if (new RegExp(`^${r}(?![IVX])`, 'i').test(s)) return n
  return null
}
export function groupOf(g: number | null): Grp | null {
  if (g === null || g < 1 || g > 12) return null
  return g <= 3 ? '1-3' : g <= 6 ? '4-6' : g <= 11 ? '7-11' : '12'
}

/** Последният учебен ден на всяка паралелка — по детето с най-дълъг учебен срок */
export function classEndsFrom(rows: { className: string; externalClass: string | null }[], ends: Ends): Record<string, string> {
  const m: Record<string, string> = {}
  rows.forEach(r => {
    const grp = groupOf(gradeOf(r.externalClass))
    const e = grp ? ends[grp] : undefined
    if (e && r.className && (!m[r.className] || e > m[r.className])) m[r.className] = e
  })
  return m
}
/** Най-късната дата сред групите — за паралелка без данни за децата */
export const latestEnd = (ends: Ends) => Object.values(ends).filter(Boolean).sort().pop() || ''

/** Случайна подредба (с подаден генератор — за тестове) */
function shuffle<T>(a: T[], rnd: () => number): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] }
  return r
}

/**
 * total — годишен брой (последният час спира на точната дата);
 * perWeek — N часа седмично, всеки до края на годината на паралелката си (годишният брой излиза сам);
 *           дробна част (2,5) — още един час, който върви само тази част от своите учебни дни.
 */
export function planDistribution({ dates, total, perWeek, schedule, classEnd, defaultEnd, ends = {}, taken = [], rnd = Math.random }: {
  dates: string[]; total?: number; perWeek?: number; schedule: SchedSlot[]; classEnd: Record<string, string>; defaultEnd: string; ends?: Ends
  /** клетки, вече заети от ръчно сложени часове — не се пипат, а дните им се ползват последни */
  taken?: { day: number; period: number }[]
  rnd?: () => number
}): { slots: PlannedSlot[]; placed: number; missing: number } {
  const from = dates[0]
  // клетките от разписанието (без ИФО; при групи в един час — една клетка), всяка със своя край
  const cells: (SchedSlot & { end: string; occ: string[] })[] = []
  schedule.filter(s => s.holderType !== 'ifo').forEach(s => {
    if (cells.some(c => c.day === s.day && c.period === s.period)) return
    const end = classEnd[s.holderLabel] || defaultEnd
    // седмиците до края на паралелката; i-тата седмица свършва на 5·i-тия учебен ден
    const upTo = dates.filter(d => d <= end)
    const weeks = normWeeks(end, ends) ?? Math.round(upTo.length / 5)
    cells.push({ ...s, end, occ: Array.from({ length: weeks }, (_, i) => upTo[Math.min(upTo.length - 1, 5 * (i + 1) - 1)]) })
  })

  const used = new Set<string>(taken.map(t => `${t.day}-${t.period}`))
  const busyDays = new Set(taken.map(t => t.day))
  const out: PlannedSlot[] = []
  const weekly = !!perWeek && perWeek > 0
  const whole = weekly ? Math.floor(perWeek! + 1e-9) : 0
  const frac = weekly ? Math.round((perWeek! - whole) * 100) / 100 : 0
  const need = whole + (frac > 0 ? 1 : 0)
  let rem = weekly ? need : (total || 0)
  // кръгове: в първия — по един час на ден; следващите — само ако не стига
  let round = 0
  while (rem > 0) {
    let added = false
    const days = shuffle(Array.from(new Set(cells.map(c => c.day))), rnd)
    // при годишен брой — първо дните с паралелка с най-дълга година (пълният час да е при нея);
    // между равните — случайно (sort е стабилен след разбъркването)
    if (!weekly) {
      const dayEnd = (d: number) => cells.filter(c => c.day === d && !used.has(`${c.day}-${c.period}`)).reduce((a, c) => c.end > a ? c.end : a, '')
      days.sort((a, b) => dayEnd(b).localeCompare(dayEnd(a)))
    }
    // в първия кръг — първо дните без ръчен час (по един час на ден)
    const order = round === 0 ? [...days.filter(d => !busyDays.has(d)), ...days.filter(d => busyDays.has(d))] : days
    round++
    for (const day of order) {
      if (rem <= 0) break
      const free = cells.filter(c => c.day === day && !used.has(`${c.day}-${c.period}`) && c.occ.length > 0)
      if (!free.length) continue
      // в деня — паралелка с най-дълга година (часът стига до края), случайно между равните
      const best = free.reduce((a, c) => c.end > a ? c.end : a, '')
      const pick = shuffle(free.filter(c => c.end === best), rnd)[0]
      used.add(`${pick.day}-${pick.period}`)
      const { end, occ, ...slot } = pick
      if (weekly) {
        if (rem > 1 || frac === 0) out.push({ ...slot, dateFrom: from, dateTo: end, hours: occ.length })
        else { const h = Math.max(1, Math.round(frac * occ.length)); out.push({ ...slot, dateFrom: from, dateTo: occ[h - 1], hours: h }) }
        rem -= 1
      }
      else if (rem >= occ.length) { out.push({ ...slot, dateFrom: from, dateTo: end, hours: occ.length }); rem -= occ.length }
      else { out.push({ ...slot, dateFrom: from, dateTo: occ[rem - 1], hours: rem }); rem = 0 }
      added = true
    }
    if (!added) break
  }
  const placed = out.reduce((a, s) => a + s.hours, 0)
  const missing = weekly ? Math.max(0, need - out.length) : Math.max(0, (total || 0) - placed)
  return { slots: out.sort((a, b) => a.day - b.day || a.period - b.period), placed, missing }
}

/**
 * Часове на слот = учебните седмици между двете дати; денят на часа няма значение.
 * До края на годината на група — по норматив (32/34/36/31); иначе учебни дни ÷ 5 (както МОН).
 */
export function slotHours(dates: string[], _day: number, from: string, to: string, ends: Ends = {}) {
  const n = normWeeks(to, ends)
  if (n !== null && (!dates.length || from <= dates[0])) return n
  return Math.round(dates.filter(d => d >= from && d <= to).length / 5)
}
