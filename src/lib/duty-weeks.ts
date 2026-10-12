// Седмиците за дежурство — само тези с поне един учебен ден (по учебния календар).
// start/end = първият и последният учебен ден в седмицата (пон–пет).

export type DutyWeek = { key: string; monday: string; start: string; end: string; label: string; days: number }

const pad = (n: number) => String(n).padStart(2, '0')
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export function mondayOf(iso: string) {
  const d = new Date(iso + 'T00:00'); const w = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - w); return isoOf(d)
}
const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`

export function buildDutyWeeks(schoolDays: string[]): DutyWeek[] {
  const by: Record<string, string[]> = {}
  schoolDays.forEach(d => { (by[mondayOf(d)] ||= []).push(d) })
  return Object.keys(by).sort().map(m => {
    const ds = by[m].sort()
    const start = ds[0], end = ds[ds.length - 1]
    return { key: m, monday: m, start, end, days: ds.length, label: `${dm(start)} – ${dm(end)}.${end.slice(0, 4)}` }
  })
}

/** Към коя седмица принадлежи записът (по началната му дата — старите записи са с понеделник/15.09) */
export const weekKeyOfDuty = (startDate: string) => mondayOf(startDate)
