// Професионален календар — общи типове, дати, повтаряне, подреждане на събитията и експорт към .ics.
// Събитията от другите модули идват като CalItem (само за четене, с връзка към модула);
// собствените са в cal_events (виж supabase/migrations/2026-10-27_calendar.sql).

export type CalView = 'month' | 'week' | 'day' | 'agenda'

// Слоеве (като „календарите“ в Google): включват се/изключват се отляво
export type CalLayer =
  | 'mine' | 'shared' | 'school' | 'tasks' | 'deadlines' | 'control' | 'eval' | 'portfolio' | 'visits' | 'meetings' | 'duties'

export const LAYERS: { key: CalLayer; label: string; color: string; hint: string; mgmtOnly?: boolean }[] = [
  { key: 'mine', label: 'Моите събития', color: '#2563eb', hint: 'Създадени от мен и поканите към мен' },
  { key: 'shared', label: 'Общи събития', color: '#0f766e', hint: 'Публикувани от ръководството за персонала' },
  { key: 'school', label: 'Учебен календар', color: '#64748b', hint: 'Ваканции, празници и неучебни дни' },
  { key: 'meetings', label: 'Съвети и заседания', color: '#4f46e5', hint: 'Педагогически съвет, комисии, координиращ екип' },
  { key: 'control', label: 'Контролна дейност', color: '#0d9488', hint: 'Проверки и срокове за протоколите' },
  { key: 'eval', label: 'Оценяване и атестиране', color: '#9333ea', hint: 'Срокове на ДТВ и атестацията' },
  { key: 'visits', label: 'Посещения на час', color: '#0284c7', hint: 'Записани посещения' },
  { key: 'portfolio', label: 'Цели в портфолиото', color: '#65a30d', hint: 'Срокове на моите цели за развитие' },
  { key: 'duties', label: 'Дежурства', color: '#a16207', hint: 'Седмиците на дежурство' },
  { key: 'deadlines', label: 'Срокове на таблото', color: '#d97706', hint: 'Сроковете в календара на таблото' },
  { key: 'tasks', label: 'График срокове', color: '#ea580c', hint: 'Повтарящи се задължения', mgmtOnly: true },
]
export const LAYER_BY_KEY = Object.fromEntries(LAYERS.map(l => [l.key, l])) as Record<CalLayer, (typeof LAYERS)[number]>

export type CalCategory = 'meeting' | 'council' | 'deadline' | 'event' | 'training' | 'inspection' | 'parents' | 'holiday' | 'personal' | 'other'
export const CATEGORIES: { key: CalCategory; label: string; color: string }[] = [
  { key: 'meeting', label: 'Среща', color: '#2563eb' },
  { key: 'council', label: 'Съвет / заседание', color: '#4f46e5' },
  { key: 'deadline', label: 'Срок', color: '#dc2626' },
  { key: 'event', label: 'Събитие / празник', color: '#059669' },
  { key: 'training', label: 'Квалификация', color: '#d97706' },
  { key: 'inspection', label: 'Проверка', color: '#0891b2' },
  { key: 'parents', label: 'Родители', color: '#db2777' },
  { key: 'holiday', label: 'Неучебен ден', color: '#64748b' },
  { key: 'personal', label: 'Лично', color: '#7c3aed' },
  { key: 'other', label: 'Друго', color: '#475569' },
]
export const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map(c => [c.key, c])) as Record<CalCategory, (typeof CATEGORIES)[number]>
export const PALETTE = ['#2563eb', '#4f46e5', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#d97706', '#65a30d', '#059669', '#0d9488', '#0891b2', '#475569']

export type Visibility = 'private' | 'managers' | 'staff' | 'roles'
export const VISIBILITY_LABELS: Record<Visibility, string> = {
  private: 'Само аз и поканените',
  managers: 'Ръководството',
  staff: 'Целият персонал',
  roles: 'Избрани длъжности',
}
export const PUBLISHER_ROLES = ['director', 'zdud', 'admin', 'secretary']
export const MANAGER_ROLES = ['director', 'zdud', 'admin']

export type RecurFreq = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type Response = 'pending' | 'yes' | 'no' | 'maybe'
export const RESPONSE_LABELS: Record<Response, string> = { pending: 'Без отговор', yes: 'Ще дойда', no: 'Няма да дойда', maybe: 'Може би' }

/** Ред от cal_events (+ поканените) */
export interface CalEventRow {
  id: string
  owner_id: string
  title: string
  description: string | null
  location: string | null
  online_url: string | null
  category: CalCategory
  color: string | null
  all_day: boolean
  starts_at: string
  ends_at: string
  recur_freq: RecurFreq
  recur_interval: number
  recur_weekdays: number[] | null
  recur_until: string | null
  exdates: string[] | null
  visibility: Visibility
  roles: string[] | null
  remind_days: number | null
  owner?: { first_name: string; last_name: string } | null
  attendees?: { staff_id: string; response: Response }[]
}

/** Едно появяване в календара (собствено събитие или от модул) */
export interface CalItem {
  key: string
  layer: CalLayer
  title: string
  start: Date          // при целодневно — полунощ на първия ден
  end: Date            // при целодневно — полунощ на последния ден (включително); иначе — краят
  allDay: boolean
  color: string
  subtitle?: string    // кратък ред под заглавието (кой, къде, статус)
  location?: string
  description?: string
  href?: string        // връзка към модула
  sourceLabel?: string // „Контролна дейност“, „Оценяване“…
  done?: boolean       // отметнат / приключил
  event?: CalEventRow  // само за собствените събития
  occ?: string         // датата на появяването (за повтарящи се)
  myResponse?: Response
}

// ───────── дати ─────────
export const MONTHS = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']
export const MONTHS_CAP = MONTHS.map(m => m[0].toUpperCase() + m.slice(1))
export const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
export const WD_LONG = ['понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота', 'неделя']

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const parseYmd = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes())
export const addMinutes = (d: Date, n: number) => new Date(d.getTime() + n * 60000)
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
/** 1 = понеделник … 7 = неделя */
export const isoWd = (d: Date) => (d.getDay() === 0 ? 7 : d.getDay())
export const startOfWeek = (d: Date) => addDays(startOfDay(d), 1 - isoWd(d))
export const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 864e5)
export const hm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
export const dmy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
export const at = (dateStr: string, time = '00:00') => { const d = parseYmd(dateStr); const [h, m] = time.split(':').map(Number); d.setHours(h || 0, m || 0, 0, 0); return d }

/** Видимият интервал за изгледа [от, до) */
export function viewRange(view: CalView, anchor: Date): { from: Date; to: Date } {
  if (view === 'day') return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1) }
  if (view === 'week') { const f = startOfWeek(anchor); return { from: f, to: addDays(f, 7) } }
  if (view === 'agenda') return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 31) }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const f = startOfWeek(first)
  return { from: f, to: addDays(f, 42) }
}

export function shiftAnchor(view: CalView, anchor: Date, dir: 1 | -1): Date {
  if (view === 'day') return addDays(anchor, dir)
  if (view === 'week') return addDays(anchor, 7 * dir)
  if (view === 'agenda') return addDays(anchor, 30 * dir)
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1)
}

export function rangeTitle(view: CalView, anchor: Date): string {
  if (view === 'day') return `${WD_LONG[isoWd(anchor) - 1]}, ${anchor.getDate()} ${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
  if (view === 'week' || view === 'agenda') {
    const { from, to } = viewRange(view, anchor)
    const last = addDays(to, -1)
    if (from.getMonth() === last.getMonth()) return `${from.getDate()}–${last.getDate()} ${MONTHS[from.getMonth()]} ${from.getFullYear()}`
    if (from.getFullYear() === last.getFullYear()) return `${from.getDate()} ${MONTHS[from.getMonth()]} – ${last.getDate()} ${MONTHS[last.getMonth()]} ${last.getFullYear()}`
    return `${dmy(from)} – ${dmy(last)}`
  }
  return `${MONTHS_CAP[anchor.getMonth()]} ${anchor.getFullYear()}`
}

/** Кои дни (полунощ) покрива появяването */
export function itemDays(it: CalItem): { first: Date; last: Date } {
  const first = startOfDay(it.start)
  if (it.allDay) return { first, last: startOfDay(it.end) }
  // събитие, което свършва точно в полунощ, не „прелива“ в следващия ден
  const endAdj = it.end.getTime() > it.start.getTime() ? new Date(it.end.getTime() - 1) : it.end
  return { first, last: startOfDay(endAdj) }
}
export const isMultiDay = (it: CalItem) => { const { first, last } = itemDays(it); return it.allDay || last.getTime() > first.getTime() }

export function whenText(it: CalItem): string {
  const { first, last } = itemDays(it)
  const d = (x: Date) => `${WD_SHORT[isoWd(x) - 1]}, ${x.getDate()} ${MONTHS[x.getMonth()]}`
  if (it.allDay) return sameDay(first, last) ? `${d(first)} · цял ден` : `${d(first)} – ${d(last)}`
  if (sameDay(first, last)) return `${d(first)} · ${hm(it.start)}–${hm(it.end)}`
  return `${d(first)}, ${hm(it.start)} – ${d(last)}, ${hm(it.end)}`
}

// ───────── повтаряне ─────────
export function recurText(e: Pick<CalEventRow, 'recur_freq' | 'recur_interval' | 'recur_weekdays' | 'recur_until' | 'starts_at'>): string {
  if (e.recur_freq === 'none') return ''
  const n = e.recur_interval || 1
  const s = new Date(e.starts_at)
  let t = ''
  if (e.recur_freq === 'daily') t = n === 1 ? 'Всеки ден' : `На всеки ${n} дни`
  if (e.recur_freq === 'weekly') {
    const wds = (e.recur_weekdays?.length ? e.recur_weekdays : [isoWd(s)]).slice().sort((a, b) => a - b)
    const days = wds.length === 5 && wds.every((d, i) => d === i + 1) ? 'делничните дни' : wds.map(w => WD_SHORT[w - 1]).join(', ')
    t = `${n === 1 ? 'Всяка седмица' : `На всеки ${n} седмици`} · ${days}`
  }
  if (e.recur_freq === 'monthly') t = `${n === 1 ? 'Всеки месец' : `На всеки ${n} месеца`} на ${s.getDate()}-о число`
  if (e.recur_freq === 'yearly') t = `Всяка година на ${s.getDate()} ${MONTHS[s.getMonth()]}`
  if (e.recur_until) t += ` · до ${dmy(parseYmd(e.recur_until))}`
  return t
}

/** Появяванията на събитие в [from, to) */
export function expandEvent(e: CalEventRow, from: Date, to: Date): { start: Date; end: Date; occ: string }[] {
  const s0 = new Date(e.starts_at)
  const e0 = new Date(e.ends_at)
  const dur = Math.max(0, e0.getTime() - s0.getTime())
  const overlaps = (s: Date, en: Date) => (e.all_day
    ? startOfDay(s) < to && startOfDay(en) >= from
    : s < to && (en > from || (dur === 0 && s >= from)))
  if (e.recur_freq === 'none') return overlaps(s0, e0) ? [{ start: s0, end: e0, occ: ymd(s0) }] : []

  const out: { start: Date; end: Date; occ: string }[] = []
  const ex = new Set(e.exdates || [])
  const n = Math.max(1, e.recur_interval || 1)
  const startDay = startOfDay(s0)
  const until = e.recur_until ? addDays(parseYmd(e.recur_until), 1) : null
  const spanDays = Math.ceil(dur / 864e5) + 1
  let d = addDays(startOfDay(from), -spanDays)
  if (d < startDay) d = startDay
  const wds = e.recur_weekdays?.length ? e.recur_weekdays : [isoWd(s0)]
  const w0 = startOfWeek(s0)
  for (let guard = 0; d < to && guard < 800; guard++, d = addDays(d, 1)) {
    if (until && d >= until) break
    let hit = false
    const diff = dayDiff(startDay, d)
    if (e.recur_freq === 'daily') hit = diff % n === 0
    else if (e.recur_freq === 'weekly') hit = wds.includes(isoWd(d)) && Math.floor(dayDiff(w0, startOfWeek(d)) / 7) % n === 0
    else if (e.recur_freq === 'monthly') {
      const months = (d.getFullYear() - s0.getFullYear()) * 12 + d.getMonth() - s0.getMonth()
      hit = d.getDate() === s0.getDate() && months % n === 0
    } else if (e.recur_freq === 'yearly') hit = d.getDate() === s0.getDate() && d.getMonth() === s0.getMonth() && (d.getFullYear() - s0.getFullYear()) % n === 0
    if (!hit) continue
    const occ = ymd(d)
    if (ex.has(occ)) continue
    const st = new Date(d.getFullYear(), d.getMonth(), d.getDate(), s0.getHours(), s0.getMinutes())
    const en = new Date(st.getTime() + dur)
    if (overlaps(st, en)) out.push({ start: st, end: en, occ })
  }
  return out
}

export function eventColor(e: Pick<CalEventRow, 'color' | 'category'>) {
  return e.color || CATEGORY_BY_KEY[e.category]?.color || '#2563eb'
}

// ───────── подреждане ─────────
export const sortItems = (a: CalItem, b: CalItem) =>
  (Number(b.allDay) - Number(a.allDay)) || a.start.getTime() - b.start.getTime() ||
  (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime()) || a.title.localeCompare(b.title, 'bg')

/** Ленти в една седмица (месечен изглед / целодневния ред): всяко появяване получава ред (lane) и колони 0–6 */
export interface Segment { item: CalItem; col: number; span: number; lane: number; contLeft: boolean; contRight: boolean }
export function weekSegments(items: CalItem[], weekStart: Date, nDays = 7): Segment[] {
  const weekEnd = addDays(weekStart, nDays - 1)
  const segs: Omit<Segment, 'lane'>[] = []
  for (const it of items) {
    const { first, last } = itemDays(it)
    if (last < weekStart || first > weekEnd) continue
    const a = first < weekStart ? weekStart : first
    const b = last > weekEnd ? weekEnd : last
    segs.push({ item: it, col: dayDiff(weekStart, a), span: dayDiff(a, b) + 1, contLeft: first < weekStart, contRight: last > weekEnd })
  }
  // по-дългите първо, после по начало
  segs.sort((x, y) => (y.span - x.span) || (Number(isMultiDay(y.item)) - Number(isMultiDay(x.item))) || sortItems(x.item, y.item))
  const lanes: boolean[][] = []
  return segs.map(s => {
    let lane = 0
    for (; ; lane++) {
      const row = lanes[lane] || (lanes[lane] = Array(nDays).fill(false))
      let free = true
      for (let c = s.col; c < s.col + s.span; c++) if (row[c]) { free = false; break }
      if (free) { for (let c = s.col; c < s.col + s.span; c++) row[c] = true; break }
    }
    return { ...s, lane }
  }).sort((x, y) => x.lane - y.lane || x.col - y.col)
}

/** Часовата мрежа: колони за застъпващите се събития в един ден */
export interface Placed { item: CalItem; top: number; height: number; left: number; width: number }
export function layoutDay(items: CalItem[], day: Date, pxPerMin: number): Placed[] {
  const d0 = startOfDay(day).getTime()
  const d1 = d0 + 864e5
  const evs = items
    .map(it => {
      const s = Math.max(it.start.getTime(), d0)
      const e = Math.min(Math.max(it.end.getTime(), it.start.getTime() + 15 * 60000), d1)
      return { it, s: (s - d0) / 60000, e: (e - d0) / 60000 }
    })
    .filter(x => x.e > x.s)
    .sort((a, b) => a.s - b.s || b.e - a.e)
  const out: Placed[] = []
  let cluster: { it: CalItem; s: number; e: number; col: number }[] = []
  let clusterEnd = -1
  const flush = () => {
    const cols = Math.max(1, ...cluster.map(c => c.col + 1))
    for (const c of cluster) {
      // разтегни надясно, ако съседните колони са свободни
      let span = 1
      while (c.col + span < cols && !cluster.some(o => o.col === c.col + span && o.s < c.e && c.s < o.e)) span++
      out.push({ item: c.it, top: c.s * pxPerMin, height: Math.max((c.e - c.s) * pxPerMin, 20), left: c.col / cols, width: span / cols })
    }
    cluster = []
  }
  for (const x of evs) {
    if (cluster.length && x.s >= clusterEnd) flush()
    const used = new Set(cluster.filter(c => c.e > x.s).map(c => c.col))
    let col = 0
    while (used.has(col)) col++
    cluster.push({ ...x, col })
    clusterEnd = Math.max(clusterEnd, x.e)
  }
  if (cluster.length) flush()
  return out
}

// ───────── .ics (Outlook / Google / телефона) ─────────
const icsEsc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m)
const icsUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsDate = (d: Date) => ymd(d).replace(/-/g, '')
function fold(line: string) {
  const out: string[] = []
  let s = line
  while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74) }
  out.push(s)
  return out.join('\r\n')
}
export function toIcs(items: CalItem[], origin = ''): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CSOP Varna//Kalendar//BG', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  const stamp = icsUtc(new Date())
  for (const it of items) {
    lines.push('BEGIN:VEVENT', `UID:${it.key.replace(/[^\w.-]/g, '-')}@csop-varna`, `DTSTAMP:${stamp}`)
    if (it.allDay) lines.push(`DTSTART;VALUE=DATE:${icsDate(it.start)}`, `DTEND;VALUE=DATE:${icsDate(addDays(startOfDay(it.end), 1))}`)
    else lines.push(`DTSTART:${icsUtc(it.start)}`, `DTEND:${icsUtc(it.end > it.start ? it.end : addMinutes(it.start, 30))}`)
    lines.push(fold(`SUMMARY:${icsEsc(it.title)}`))
    const desc = [it.subtitle, it.description, it.href && origin ? origin + it.href : ''].filter(Boolean).join('\n')
    if (desc) lines.push(fold(`DESCRIPTION:${icsEsc(desc)}`))
    if (it.location) lines.push(fold(`LOCATION:${icsEsc(it.location)}`))
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
export function downloadIcs(items: CalItem[], name = 'kalendar') {
  const blob = new Blob([toIcs(items, typeof window !== 'undefined' ? window.location.origin : '')], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name}.ics`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
