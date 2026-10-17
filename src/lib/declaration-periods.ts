// Периоди за деклариране на лекторски (над норматив и заместване) — еднакви за двата вида:
// първият е от началото на учебната година (15.09) до края на октомври, после всеки месец.
// Колегата генерира декларациите си една седмица: от 5-то до 11-то число на следващия месец
// (сеп.–окт. → 05.11 – 11.11, ноември → 05.12 – 11.12 …). Хартията се предава до 10-то.
// Управата (Отчитане лекторски) може да генерира и извън тази седмица.
// Нереализираните часове не се прехвърлят към друг период — графикът си е график.

export type DeclPeriod = {
  key: string        // = from
  from: string       // ISO
  to: string         // ISO
  label: string      // „септември 2026“, „ноември 2026“
  opensOn: string    // ISO — денят, от който може да се декларира (5-то число на следващия месец)
  closesOn: string   // ISO — последният ден, в който колегата може да генерира (11-то число)
  open: boolean      // от opensOn нататък (управата — и след closesOn)
  genOpen: boolean   // колегата може да генерира сега (opensOn ≤ днес ≤ closesOn)
  current: boolean   // днес е в периода
  overOpen?: boolean // (review) може ли за него да има декларация над норматив — само ако съвпада с периодите 'over'
}
export type DeclKind = 'over' | 'sub' | 'review'

/** Седмицата за генериране от колегите: от GEN_FROM_DAY до GEN_TO_DAY число на месеца след периода (вкл.) */
export const GEN_FROM_DAY = 5
export const GEN_TO_DAY = 11

const MONTHS = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']
const pad = (n: number) => String(n).padStart(2, '0')
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Днешна дата по българско време (ISO) */
export function sofiaTodayIso() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return p // en-CA → YYYY-MM-DD
}

/** Всички периоди на учебната година, в която е `today` (юли–август — още предходната) */
export function declarationPeriods(kind: DeclKind = 'over', today = sofiaTodayIso()): DeclPeriod[] {
  const [y, m] = today.split('-').map(Number)
  const sy = m >= 9 ? y : y - 1
  const mk = (fy: number, fm: number, ty: number, tm: number, label: string): DeclPeriod => {
    const from = `${fy}-${pad(fm)}-01`
    const to = `${ty}-${pad(tm)}-${pad(lastDay(ty, tm))}`
    const ny = tm === 12 ? ty + 1 : ty, nm = tm === 12 ? 1 : tm + 1
    const opensOn = `${ny}-${pad(nm)}-${pad(GEN_FROM_DAY)}`
    const closesOn = `${ny}-${pad(nm)}-${pad(GEN_TO_DAY)}`
    return { key: from, from, to, label, opensOn, closesOn, open: today >= opensOn, genOpen: today >= opensOn && today <= closesOn, current: today >= from && today <= to }
  }
  const month = (mm: number) => { const yy = mm >= 9 ? sy : sy + 1; return mk(yy, mm, yy, mm, `${MONTHS[mm - 1]} ${yy}`) }
  // ключът остава 01.09 (така са записани проверките); учебните часове започват от 15.09
  const sepOct = mk(sy, 9, sy, 10, `септември – октомври ${sy}`)
  const rest = [11, 12, 1, 2, 3, 4, 5, 6].map(month)
  if (kind === 'review') return [sepOct, ...rest].map(p => ({ ...p, overOpen: p.open }))
  return [sepOct, ...rest]
}

const dmy = (iso: string) => iso.split('-').reverse().join('.')

/** Периодът [from, to], ако е от списъка и колегата може да генерира сега (седмицата 5-то – 11-то); иначе — причината */
export function checkDeclarablePeriod(from: string, to: string, kind: Exclude<DeclKind, 'review'> = 'over', today = sofiaTodayIso()): { ok: true; period: DeclPeriod } | { ok: false; error: string } {
  const p = declarationPeriods(kind, today).find(x => x.from === from && x.to === to)
  if (!p) return { ok: false, error: 'Декларира се за цял период: септември – октомври заедно, после по месеци' }
  if (!p.open) return { ok: false, error: `Декларациите за „${p.label}“ се генерират от ${dmy(p.opensOn)} до ${dmy(p.closesOn)}` }
  if (!p.genOpen) return { ok: false, error: `Седмицата за генериране (${dmy(p.opensOn)} – ${dmy(p.closesOn)}) мина — обърнете се към ЗДУД или ЗАС` }
  return { ok: true, period: p }
}

/** За колегата: периодът, чиято седмица за генериране е сега; иначе следващият; иначе последният */
export function genPeriod(periods: DeclPeriod[]) {
  return periods.find(p => p.genOpen) || periods.find(p => !p.open) || periods[periods.length - 1]
}

/** Последният приключил период (за подразбиране), иначе текущият */
export function defaultPeriod(periods: DeclPeriod[]) {
  const open = periods.filter(p => p.open)
  return open.length ? open[open.length - 1] : (periods.find(p => p.current) || periods[0])
}

/** Срок за предаване на подписаната декларация — до DEADLINE_DAY-то число на месеца след периода */
export const DEADLINE_DAY = 10
/** Следи ли се срокът (просрочени / закъснели). Засега НЕ — септември беше тестов/извънреден; включва се с true. */
export const DEADLINE_ACTIVE = false
export function deadlineOf(periodTo: string) {
  const [y, m] = periodTo.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1
  return `${ny}-${pad(nm)}-${pad(DEADLINE_DAY)}`
}
