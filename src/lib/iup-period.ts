// Реализация на ИУП — ЕДНО правило за целия JORDAN (страницата, таблата, напомнянията)
//
// • Подава се от 27-ми до 8-ми на следващия месец, за изминалия месец.
// • СЕПТЕМВРИ и ОКТОМВРИ са ДВА ОТДЕЛНИ отчета, но се подават в един и същ прозорец 27.10–8.11
//   (септември е кратък и няма собствен прозорец).
// • После месец за месец; последният е за ЮНИ — подава се до 8.07.
// • Отчети за юли и август НЯМА.

// Прозорецът за въвеждане — сменя се само тук
export const IUP_OPEN_DAY = 27   // отваря се на този ден от отчетния месец
export const IUP_CLOSE_DAY = 8   // затваря се след този ден от следващия месец

// месеците, в които се ОТВАРЯ прозорец (септември се подава в прозореца на октомври)
const WINDOW_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6]
const MONTHS = ['', 'януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']

export type IupMonth = { month: number; year: number; label: string }

export type IupPeriod = {
  month: number          // главният месец на прозореца (октомври, ноември…) — за срока
  year: number
  months: IupMonth[]     // ВСИЧКИ отчети в този прозорец: [септември, октомври] или само [ноември]…
  label: string          // „септември и октомври“, „ноември“…
  open: boolean          // сега е 27-ми – 8-ми → може да се въвежда
  overdue: boolean       // прозорецът е затворен (9-ти – 26-ти) → неподадените са просрочени
  offSeason: boolean     // юли – 26.10: няма текущ отчет; months = следващите (септ.+окт.)
  window: string         // „27.10 – 8.11“
}

// Служебната паралелка (временно място за новите деца) не подава ИУП — нито се брои, нито се показва
export function inIup(className?: string | null) {
  return !!className && !/служебна/i.test(className)
}

export function iupMonthLabel(month: number) {
  return MONTHS[month] || ''
}

export function sofiaNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Sofia' }))
}

function monthsOfWindow(mm: number, yy: number): IupMonth[] {
  const list = mm === 10 ? [9, 10] : [mm]
  return list.map(month => ({ month, year: yy, label: MONTHS[month] }))
}

export function iupPeriod(now: Date = sofiaNow()): IupPeriod {
  const m = now.getMonth() + 1, d = now.getDate(), y = now.getFullYear()
  const inWindow = d >= IUP_OPEN_DAY || d <= IUP_CLOSE_DAY
  // месецът на последния отворил се прозорец
  const rm = d >= IUP_OPEN_DAY ? m : (m === 1 ? 12 : m - 1)
  const ry = d >= IUP_OPEN_DAY ? y : (m === 1 ? y - 1 : y)
  const win = (mm: number) => `${IUP_OPEN_DAY}.${String(mm).padStart(2, '0')} – ${IUP_CLOSE_DAY}.${String(mm === 12 ? 1 : mm + 1).padStart(2, '0')}`
  const build = (mm: number, yy: number) => {
    const months = monthsOfWindow(mm, yy)
    return { month: mm, year: yy, months, label: months.map(x => x.label).join(' и '), window: win(mm) }
  }
  if (WINDOW_MONTHS.includes(rm)) {
    return { ...build(rm, ry), open: inWindow, overdue: !inWindow, offSeason: false }
  }
  // юли–септември → следват отчетите за септември и октомври същата година
  return { ...build(10, ry), open: false, overdue: false, offSeason: true }
}

/** Паралелките, подали ВСИЧКИ отчети на прозореца (rows = monthly_absences: class_id, month, year). */
export function iupDoneClasses(rows: { class_id: string; month: number; year: number }[] | null | undefined, P: IupPeriod) {
  const have = new Map<string, Set<string>>()
  ;(rows || []).forEach(r => {
    if (!have.has(r.class_id)) have.set(r.class_id, new Set())
    have.get(r.class_id)!.add(`${r.year}-${r.month}`)
  })
  const done = new Set<string>()
  have.forEach((s, id) => { if (P.months.every(x => s.has(`${x.year}-${x.month}`))) done.add(id) })
  return done
}
