// Периоди за деклариране на лекторски (над норматив и заместване).
// Декларира се САМО приключил период: септември + октомври заедно (от 01.11), после всеки месец
// поотделно (ноември — от 01.12, декември — от 01.01, … юни — от 01.07).
// Нереализираните часове не се прехвърлят към друг период — графикът си е график.

export type DeclPeriod = {
  key: string        // = from
  from: string       // ISO
  to: string         // ISO
  label: string      // „септември – октомври 2026“, „ноември 2026“
  opensOn: string    // ISO — денят, от който може да се декларира
  open: boolean      // периодът е приключил → може да се декларира
  current: boolean   // днес е в периода
}

const MONTHS = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']
const pad = (n: number) => String(n).padStart(2, '0')
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Днешна дата по българско време (ISO) */
export function sofiaTodayIso() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return p // en-CA → YYYY-MM-DD
}

/** Всички периоди на учебната година, в която е `today` (юли–август — още предходната) */
export function declarationPeriods(today = sofiaTodayIso()): DeclPeriod[] {
  const [y, m] = today.split('-').map(Number)
  const sy = m >= 9 ? y : y - 1
  const mk = (fy: number, fm: number, ty: number, tm: number, label: string): DeclPeriod => {
    const from = `${fy}-${pad(fm)}-01`
    const to = `${ty}-${pad(tm)}-${pad(lastDay(ty, tm))}`
    const ny = tm === 12 ? ty + 1 : ty, nm = tm === 12 ? 1 : tm + 1
    const opensOn = `${ny}-${pad(nm)}-01`
    return { key: from, from, to, label, opensOn, open: today >= opensOn, current: today >= from && today <= to }
  }
  const out: DeclPeriod[] = [mk(sy, 9, sy, 10, `септември – октомври ${sy}`)]
  for (const mm of [11, 12, 1, 2, 3, 4, 5, 6]) {
    const yy = mm >= 9 ? sy : sy + 1
    out.push(mk(yy, mm, yy, mm, `${MONTHS[mm - 1]} ${yy}`))
  }
  return out
}

/** Периодът [from, to], ако е от списъка и вече може да се декларира; иначе — причината */
export function checkDeclarablePeriod(from: string, to: string, today = sofiaTodayIso()): { ok: true; period: DeclPeriod } | { ok: false; error: string } {
  const p = declarationPeriods(today).find(x => x.from === from && x.to === to)
  if (!p) return { ok: false, error: 'Декларира се за цял период: септември – октомври заедно, после по месеци' }
  if (!p.open) return { ok: false, error: `Периодът „${p.label}“ още не е приключил — декларацията се подава от ${p.opensOn.split('-').reverse().join('.')}` }
  return { ok: true, period: p }
}

/** Последният приключил период (за подразбиране), иначе текущият */
export function defaultPeriod(periods: DeclPeriod[]) {
  const open = periods.filter(p => p.open)
  return open.length ? open[open.length - 1] : (periods.find(p => p.current) || periods[0])
}
