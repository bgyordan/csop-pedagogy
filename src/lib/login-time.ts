// „днес 9:14“ / „вчера 16:42“ / „25.09 в 10:03“ / „25.09.2025“ — по българско време
export function loginTime(iso?: string | null) {
  if (!iso) return ''
  const tz = 'Europe/Sofia'
  const d = new Date(iso)
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: tz })
  const time = d.toLocaleTimeString('bg-BG', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
  const now = new Date()
  const y = new Date(now.getTime() - 86_400_000)
  if (day(d) === day(now)) return `днес ${time}`
  if (day(d) === day(y)) return `вчера ${time}`
  const sameYear = d.toLocaleDateString('en-CA', { timeZone: tz, year: 'numeric' }) === now.toLocaleDateString('en-CA', { timeZone: tz, year: 'numeric' })
  return sameYear
    ? `${d.toLocaleDateString('bg-BG', { timeZone: tz, day: '2-digit', month: '2-digit' })} в ${time}`
    : d.toLocaleDateString('bg-BG', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' })
}
