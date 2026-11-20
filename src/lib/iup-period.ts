// Реализация на ИУП — ЕДНО правило за целия JORDAN (страницата, таблата, напомнянията)
//
// • Подава се от 27-ми до 8-ми на следващия месец, за изминалия месец.
// • СЕПТЕМВРИ и ОКТОМВРИ са ДВА ОТДЕЛНИ отчета, но се подават в един и същ прозорец 27.10–8.11
//   (септември е кратък и няма собствен прозорец).
// • После месец за месец; последният е за ЮНИ — подава се до 8.07.
// • Отчети за юли и август НЯМА.
// • ПРОСРОЧВАНЕ НЯМА: след 8-ми Excel файловете се изтеглят и на 9-ти системата минава на
//   СЛЕДВАЩИЯ отчет (този месец) — „предстои“ до 27-ми, когато прозорецът се отваря.
// • Нова паралелка дължи отчет само за месеците, в които вече е съществувала (по датата на създаване).

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
  upcoming: boolean      // 9-ти – 26-ти: отчетът на този месец предстои (прозорецът още не е отворен)
  offSeason: boolean     // 9.07 – 8.10: няма текущ отчет; months = следващите (септ.+окт.)
  window: string         // „27.10 – 8.11“
}

// Служебната паралелка (временно място за новите деца) не подава ИУП — нито се брои, нито се показва
export function inIup(className?: string | null) {
  return !!className && !/служебна/i.test(className)
}

/** Началото на отчетния период за месеца: септември — от началото на учебната година (15.09), иначе 1-во число. */
export function iupMonthStart(month: number, year: number, schoolYearStart?: string | null) {
  if (month === 9 && schoolYearStart) return String(schoolYearStart).slice(0, 10)
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** Дете, отписано В периода (на или след началото му), остава в отчета за този месец. */
export function leftDuringIup(archivedAt: string | null | undefined, monthStart: string) {
  return !!archivedAt && String(archivedAt).slice(0, 10) >= monthStart
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
  // 27-ми и след → прозорецът на този месец (отворен)
  // 1-ви – 8-ми  → прозорецът на миналия месец (още отворен)
  // 9-ти – 26-ти → следващият отчет е за ТОЗИ месец (предстои) — без просрочване
  let rm = m, ry = y, open = false
  if (d >= IUP_OPEN_DAY) open = true
  else if (d <= IUP_CLOSE_DAY) { open = true; rm = m === 1 ? 12 : m - 1; ry = m === 1 ? y - 1 : y }
  const win = (mm: number) => `${IUP_OPEN_DAY}.${String(mm).padStart(2, '0')} – ${IUP_CLOSE_DAY}.${String(mm === 12 ? 1 : mm + 1).padStart(2, '0')}`
  const build = (mm: number, yy: number) => {
    const months = monthsOfWindow(mm, yy)
    return { month: mm, year: yy, months, label: months.map(x => x.label).join(' и '), window: win(mm) }
  }
  if (WINDOW_MONTHS.includes(rm)) {
    return { ...build(rm, ry), open, upcoming: !open, offSeason: false }
  }
  // юли – септември → следват отчетите за септември и октомври същата година
  return { ...build(10, ry), open: false, upcoming: true, offSeason: true }
}

/** Приключилият преди текущия прозорец — за Excel файловете, които се теглят след 8-ми. */
export function iupPrevious(P: IupPeriod): IupPeriod {
  // 8-ми от месеца на текущия прозорец → още е отворен предишният; за септ.+окт. предишният е юни
  return iupPeriod(P.month === 10 ? new Date(P.year, 6, IUP_CLOSE_DAY) : new Date(P.year, P.month - 1, IUP_CLOSE_DAY))
}

function monthEnd(month: number, year: number) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

/** Дължи ли паралелката отчет за месеца — не, ако е създадена след края му (нова паралелка). */
export function iupOwes(m: IupMonth, classCreatedAt?: string | null) {
  return !classCreatedAt || String(classCreatedAt).slice(0, 10) <= monthEnd(m.month, m.year)
}

/** Месеците от прозореца, за които паралелката дължи отчет. */
export function iupMonthsFor(months: IupMonth[], classCreatedAt?: string | null) {
  return months.filter(m => iupOwes(m, classCreatedAt))
}

/** Паралелките, подали ВСИЧКИ дължими отчети на прозореца (rows = monthly_absences: class_id, month, year).
 *  created (по желание): class_id → дата на създаване; месеците преди нея не се искат. */
export function iupDoneClasses(
  rows: { class_id: string; month: number; year: number }[] | null | undefined,
  P: IupPeriod,
  created?: Map<string, string | null | undefined>,
) {
  const have = new Map<string, Set<string>>()
  ;(rows || []).forEach(r => {
    if (!have.has(r.class_id)) have.set(r.class_id, new Set())
    have.get(r.class_id)!.add(`${r.year}-${r.month}`)
  })
  const ids = new Set<string>(Array.from(have.keys()).concat(created ? Array.from(created.keys()) : []))
  const done = new Set<string>()
  ids.forEach(id => {
    const s = have.get(id) || new Set<string>()
    if (iupMonthsFor(P.months, created?.get(id)).every(x => s.has(`${x.year}-${x.month}`))) done.add(id)
  })
  return done
}
