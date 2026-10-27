// Реализация на ИУП — ЕДНО правило за целия JORDAN (страницата, таблата, напомнянията)
//
// • Подава се от 27-ми до 8-ми на следващия месец, за изминалия месец.
// • Първият отчет е за ОКТОМВРИ (заедно с частта от септември) — подава се 27.10–8.11.
// • После месец за месец; последният е за ЮНИ — подава се до 8.07.
// • Отчети за юли, август и септември НЯМА.

// Прозорецът за въвеждане — сменя се само тук
export const IUP_OPEN_DAY = 27   // отваря се на този ден от отчетния месец
export const IUP_CLOSE_DAY = 8   // затваря се след този ден от следващия месец

const REPORT_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6]
const MONTHS = ['', 'януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']

export type IupPeriod = {
  month: number          // месецът, за който се отчита (записва се в monthly_absences.month)
  year: number
  label: string          // „октомври (и септември)“, „ноември“…
  open: boolean          // сега е 27-ми – 8-ми → може да се въвежда
  overdue: boolean       // прозорецът е затворен (9-ти – 26-ти) → неподадените са просрочени
  offSeason: boolean     // юли–септември: няма текущ отчет; month/year = следващият (октомври)
  window: string         // „27.10 – 8.11“
}

export function sofiaNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Sofia' }))
}

export function iupPeriod(now: Date = sofiaNow()): IupPeriod {
  const m = now.getMonth() + 1, d = now.getDate(), y = now.getFullYear()
  const inWindow = d >= IUP_OPEN_DAY || d <= IUP_CLOSE_DAY
  // месецът на последния отворил се прозорец
  const rm = d >= IUP_OPEN_DAY ? m : (m === 1 ? 12 : m - 1)
  const ry = d >= IUP_OPEN_DAY ? y : (m === 1 ? y - 1 : y)
  const label = (mm: number) => (mm === 10 ? 'октомври (и септември)' : MONTHS[mm])
  const win = (mm: number) => `${IUP_OPEN_DAY}.${String(mm).padStart(2, '0')} – ${IUP_CLOSE_DAY}.${String(mm === 12 ? 1 : mm + 1).padStart(2, '0')}`
  if (REPORT_MONTHS.includes(rm)) {
    return { month: rm, year: ry, label: label(rm), open: inWindow, overdue: !inWindow, offSeason: false, window: win(rm) }
  }
  // юли–септември → следва отчетът за октомври същата година
  return { month: 10, year: ry, label: label(10), open: false, overdue: false, offSeason: true, window: win(10) }
}
