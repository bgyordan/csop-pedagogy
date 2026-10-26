// Събира събитията за календара от собствената таблица cal_events и от останалите модули.
// Всеки източник е отделна заявка: ако таблицата я няма или правата не позволяват — просто не се показва.
// Правата (RLS) решават кой какво вижда; тук само се стеснява до „моите“, където е уместно.
import {
  type CalItem, type CalEventRow, type CalLayer, LAYER_BY_KEY, expandEvent, eventColor,
  ymd, parseYmd, at, addDays, startOfDay, MANAGER_ROLES, PUBLISHER_ROLES, CATEGORY_BY_KEY,
} from '@/lib/calendar'
import { expandOccurrences, type RecTask } from '@/lib/recurring'
import { PERIOD_BY_N } from '@/lib/periods'

export interface Me { id: string; role: string; isCoordinator?: boolean }
const name = (p: any) => (p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : '')
const color = (l: CalLayer) => LAYER_BY_KEY[l].color

type Loader = (sb: any, me: Me, from: Date, to: Date) => Promise<CalItem[]>

// ── собствени и общи събития ──
const loadEvents: Loader = async (sb, me, from, to) => {
  const cols = '*, owner:staff_profiles!cal_events_owner_id_fkey(first_name, last_name), attendees:cal_event_attendees(staff_id, response)'
  const [single, recurring] = await Promise.all([
    sb.from('cal_events').select(cols).eq('recur_freq', 'none').lt('starts_at', to.toISOString()).gte('ends_at', addDays(from, -1).toISOString()),
    sb.from('cal_events').select(cols).neq('recur_freq', 'none').lt('starts_at', to.toISOString()),
  ])
  if (single.error) throw single.error
  const rows = [...(single.data || []), ...(recurring.data || [])] as CalEventRow[]
  const out: CalItem[] = []
  for (const e of rows) {
    // моите = създадени от мен или с покана към мен; останалите видими — общи
    const layer: CalLayer = e.owner_id === me.id || (e.attendees || []).some(a => a.staff_id === me.id) ? 'mine' : 'shared'
    const myResponse = (e.attendees || []).find(a => a.staff_id === me.id)?.response
    for (const o of expandEvent(e, from, to)) {
      out.push({
        key: `ev:${e.id}:${o.occ}`, layer, title: e.title, start: o.start, end: o.end, allDay: e.all_day,
        color: eventColor(e), location: e.location || undefined, description: e.description || undefined,
        subtitle: e.owner_id !== me.id && e.owner ? `Организатор: ${name(e.owner)}` : CATEGORY_BY_KEY[e.category]?.label,
        event: e, occ: o.occ, myResponse, done: myResponse === 'no',
      })
    }
  }
  return out
}

// ── учебен календар: ваканции, празници, неучебни дни (съседните дни с една и съща бележка — една лента) ──
const loadSchool: Loader = async (sb, _me, from, to) => {
  const { data, error } = await sb.from('academic_calendar_days').select('date, is_school_day, notes, spontaneous')
    .gte('date', ymd(addDays(from, -7))).lt('date', ymd(addDays(to, 7))).eq('is_school_day', false).order('date')
  if (error) throw error
  const out: CalItem[] = []
  let cur: { note: string; first: string; last: string; spont: boolean } | null = null
  const push = () => {
    if (!cur) return
    out.push({
      key: `school:${cur.first}`, layer: 'school', title: cur.note, start: parseYmd(cur.first), end: parseYmd(cur.last), allDay: true,
      color: cur.spont ? '#e11d48' : color('school'), subtitle: cur.spont ? 'Спонтанен неучебен ден' : 'Неучебен ден',
      sourceLabel: 'Учебен календар',
    })
  }
  for (const d of (data || []) as any[]) {
    const note = String(d.notes || '').trim()
    const dt = parseYmd(d.date)
    if (!note) continue
    // събота и неделя не прекъсват ваканцията
    if (cur && cur.note === note) {
      let gapOk = true
      for (let x = addDays(parseYmd(cur.last), 1); x < dt; x = addDays(x, 1)) if (x.getDay() !== 0 && x.getDay() !== 6) gapOk = false
      if (gapOk) { cur.last = d.date; continue }
    }
    push()
    cur = { note, first: d.date, last: d.date, spont: !!d.spontaneous }
  }
  push()
  return out
}

// ── график срокове (повтарящи се задачи) ──
const loadTasks: Loader = async (sb, me, from, to) => {
  if (!PUBLISHER_ROLES.includes(me.role)) return []
  const [{ data: tasks, error }, { data: comp }] = await Promise.all([
    sb.from('recurring_tasks').select('*').eq('active', true),
    sb.from('recurring_task_completions').select('task_id, occurrence_date').gte('occurrence_date', ymd(from)).lt('occurrence_date', ymd(to)),
  ])
  if (error) throw error
  const done = new Set((comp || []).map((r: any) => `${r.task_id}:${r.occurrence_date}`))
  const out: CalItem[] = []
  for (const t of (tasks || []) as RecTask[]) {
    for (const d of expandOccurrences(t, from, addDays(to, -1))) {
      out.push({
        key: `task:${t.id}:${d}`, layer: 'tasks', title: t.title, start: parseYmd(d), end: parseYmd(d), allDay: true,
        color: color('tasks'), description: t.description || undefined, done: done.has(`${t.id}:${d}`),
        subtitle: done.has(`${t.id}:${d}`) ? 'Изпълнено' : 'Срок', href: '/admin/tasks', sourceLabel: 'График срокове',
      })
    }
  }
  return out
}

// ── срокове от календара на таблото (стария „Срокове в календара“) ──
const DEADLINE_COLORS: Record<string, string> = { red: '#dc2626', yellow: '#d97706', green: '#16a34a' }
const loadDeadlines: Loader = async (sb, me, from, to) => {
  const { data, error } = await sb.from('calendar_deadlines').select('id, title, deadline_date, color')
    .gte('deadline_date', ymd(from)).lt('deadline_date', ymd(to))
  if (error) throw error
  return ((data || []) as any[]).map(d => ({
    key: `dl:${d.id}`, layer: 'deadlines' as CalLayer, title: d.title, start: parseYmd(d.deadline_date), end: parseYmd(d.deadline_date), allDay: true,
    color: DEADLINE_COLORS[d.color] || (String(d.color || '').startsWith('#') ? d.color : color('deadlines')),
    subtitle: 'Срок', sourceLabel: 'Срокове на таблото', href: MANAGER_ROLES.includes(me.role) ? '/admin/deadlines' : undefined,
  }))
}

// ── контролна дейност: проверки, срок за протокола (15 дни), срокове на препоръките ──
const loadControl: Loader = async (sb, me, from, to) => {
  const isMgr = MANAGER_ROLES.includes(me.role)
  const f = ymd(addDays(from, -15)), t = ymd(to)
  const [{ data: checks, error }, { data: recs }] = await Promise.all([
    sb.from('control_checks').select('id, subject, check_date, status, inspector_id, inspector:staff_profiles!control_checks_inspector_id_fkey(first_name, last_name), staff:control_check_staff(staff_id)')
      .neq('status', 'voided').gte('check_date', f).lt('check_date', t),
    sb.from('control_recommendations').select('id, text, due_date, status, responsible_id, check_id')
      .gte('due_date', ymd(from)).lt('due_date', t).in('status', ['open', 'reported']),
  ])
  if (error) throw error
  const out: CalItem[] = []
  for (const c of (checks || []) as any[]) {
    const involved = c.inspector_id === me.id || (c.staff || []).some((s: any) => s.staff_id === me.id)
    if (!isMgr && !involved) continue
    const d = parseYmd(c.check_date)
    if (d >= from && d < to) out.push({
      key: `cc:${c.id}`, layer: 'control', title: `Проверка: ${c.subject || 'контролна дейност'}`, start: d, end: d, allDay: true,
      color: color('control'), subtitle: `Проверяващ: ${name(c.inspector)}${c.status === 'signed' ? ' · подписан протокол' : ''}`,
      href: `/control/${c.id}`, sourceLabel: 'Контролна дейност', done: c.status === 'signed',
    })
    // срок за протокола — само за проверяващия, докато е чернова
    const due = addDays(d, 15)
    if (c.status === 'draft' && c.inspector_id === me.id && due >= from && due < to) out.push({
      key: `ccd:${c.id}`, layer: 'control', title: `Срок за протокол: ${c.subject || 'проверка'}`, start: due, end: due, allDay: true,
      color: '#dc2626', subtitle: '15 дни от проверката (чл. 41, ал. 7 от Наредба № 8)', href: `/control/${c.id}`, sourceLabel: 'Контролна дейност',
    })
  }
  for (const r of (recs || []) as any[]) {
    if (!isMgr && r.responsible_id !== me.id) continue
    const d = parseYmd(r.due_date)
    out.push({
      key: `cr:${r.id}`, layer: 'control', title: `Препоръка: ${r.text}`, start: d, end: d, allDay: true,
      color: color('control'), subtitle: r.status === 'reported' ? 'Отчетена — чака преглед' : 'Срок за изпълнение',
      href: `/control/${r.check_id}`, sourceLabel: 'Контролна дейност', done: r.status === 'reported',
    })
  }
  return out
}

// ── оценяване и атестиране: срокове на кампаниите, повторно атестиране ──
const loadEval: Loader = async (sb, me, from, to) => {
  const { data, error } = await sb.from('eval_campaigns').select('id, name, kind, status, self_by, score_by, order_by, period_from, period_to, protocol_date')
  if (error) throw error
  const out: CalItem[] = []
  const inRange = (s?: string | null) => !!s && parseYmd(s) >= from && parseYmd(s) < to
  for (const c of (data || []) as any[]) {
    const kind = c.kind === 'attest' ? 'Атестиране' : c.kind === 'dtv' ? 'ДТВ' : 'Оценяване'
    const add = (date: string, label: string, red = false) => out.push({
      key: `ev-${label}:${c.id}`, layer: 'eval', title: `${label} — ${c.name}`, start: parseYmd(date), end: parseYmd(date), allDay: true,
      color: red ? '#c026d3' : color('eval'), subtitle: kind, href: `/evaluation/${c.id}`, sourceLabel: 'Оценяване', done: c.status === 'closed',
    })
    if (inRange(c.self_by)) add(c.self_by, 'Самооценка до', true)
    if (inRange(c.score_by)) add(c.score_by, 'Оценяване до', true)
    if (inRange(c.order_by)) add(c.order_by, 'Заповед до')
    if (inRange(c.protocol_date)) add(c.protocol_date, 'Протокол на комисията')
  }
  if (MANAGER_ROLES.includes(me.role)) {
    const { data: sup } = await sb.from('eval_support').select('participant_id, reattest_by, status, p:eval_participants(campaign_id, staff:staff_profiles(first_name, last_name))')
      .gte('reattest_by', ymd(from)).lt('reattest_by', ymd(to)).eq('status', 'open')
    for (const s of (sup || []) as any[]) out.push({
      key: `reatt:${s.participant_id}`, layer: 'eval', title: `Повторно атестиране: ${name(s.p?.staff)}`, start: parseYmd(s.reattest_by), end: parseYmd(s.reattest_by), allDay: true,
      color: color('eval'), subtitle: 'Година след началото на мерките за подкрепа', href: s.p?.campaign_id ? `/evaluation/${s.p.campaign_id}` : '/evaluation', sourceLabel: 'Оценяване',
    })
  }
  return out
}

// ── портфолио: срокове на моите цели ──
const loadPortfolio: Loader = async (sb, me, from, to) => {
  const { data, error } = await sb.from('pp_goals').select('id, goal, due, status').eq('staff_id', me.id)
    .gte('due', ymd(from)).lt('due', ymd(to)).neq('status', 'dropped')
  if (error) throw error
  return ((data || []) as any[]).map(g => ({
    key: `ppg:${g.id}`, layer: 'portfolio' as CalLayer, title: `Цел: ${g.goal}`, start: parseYmd(g.due), end: parseYmd(g.due), allDay: true,
    color: color('portfolio'), subtitle: g.status === 'done' ? 'Постигната' : 'Срок на цел за развитие', done: g.status === 'done',
    href: '/pro-portfolio?tab=goals', sourceLabel: 'Професионално портфолио',
  }))
}

// ── дати и събития от портфолиото (проекти, кабинети, събития) — акцентираните; правата решават кой какво вижда ──
const loadProjects: Loader = async (sb, _me, from, to) => {
  const post = 'post:portfolio_posts(id, title, kind, is_shared, author:staff_profiles(first_name, last_name))'
  const [dates, events] = await Promise.all([
    sb.from('portfolio_dates').select(`id, date, time_from, time_to, title, place, note, ${post}`)
      .eq('highlight', true).gte('date', ymd(from)).lt('date', ymd(to)),
    sb.from('portfolio_posts').select('id, title, event_date, is_shared, author:staff_profiles(first_name, last_name)')
      .eq('kind', 'event').gte('event_date', ymd(from)).lt('event_date', ymd(to)),
  ])
  if (dates.error && events.error) throw dates.error
  const KIND: Record<string, string> = { project: 'Проект', cabinet: 'Кабинет', event: 'Събитие', material: 'Материал' }
  const out: CalItem[] = []
  const seen = new Set<string>()
  for (const d of (dates.data || []) as any[]) {
    if (!d.post) continue
    seen.add(`${d.post.id}:${d.date}`)
    const timed = !!d.time_from
    const start = timed ? at(d.date, String(d.time_from).slice(0, 5)) : parseYmd(d.date)
    const end = timed ? (d.time_to ? at(d.date, String(d.time_to).slice(0, 5)) : new Date(start.getTime() + 60 * 60000)) : start
    out.push({
      key: `pfd:${d.id}`, layer: 'projects', title: d.title, start, end, allDay: !timed, color: color('projects'),
      location: d.place || undefined, description: d.note || undefined,
      subtitle: `${KIND[d.post.kind] || 'Портфолио'}: ${d.post.title}${d.post.author ? ' · ' + name(d.post.author) : ''}${d.post.is_shared === false ? ' · само за мен' : ''}`,
      href: `/portfolio?open=${d.post.id}`, sourceLabel: 'Портфолио',
    })
  }
  for (const p of (events.data || []) as any[]) {
    if (seen.has(`${p.id}:${p.event_date}`)) continue
    out.push({
      key: `pfe:${p.id}`, layer: 'projects', title: p.title, start: parseYmd(p.event_date), end: parseYmd(p.event_date), allDay: true,
      color: color('projects'), subtitle: `Събитие${p.author ? ' · ' + name(p.author) : ''}${p.is_shared === false ? ' · само за мен' : ''}`,
      href: `/portfolio?open=${p.id}`, sourceLabel: 'Портфолио',
    })
  }
  return out
}

// ── посещения на час (часът — по единната номерация) ──
const loadVisits: Loader = async (sb, me, from, to) => {
  let q = sb.from('visit_bookings').select('id, date, period, class_name, subject, topic, staff_id, staff:staff_profiles(first_name, last_name), campaign:visit_campaigns(title)')
    .gte('date', ymd(from)).lt('date', ymd(to))
  if (!MANAGER_ROLES.includes(me.role)) q = q.eq('staff_id', me.id)
  const { data, error } = await q
  if (error) throw error
  return ((data || []) as any[]).map(b => {
    const p = PERIOD_BY_N[b.period]
    const start = p ? addMin(parseYmd(b.date), p.start) : parseYmd(b.date)
    const end = p ? addMin(parseYmd(b.date), p.end) : parseYmd(b.date)
    const who = b.staff_id === me.id ? 'Посещение на мой час' : `Посещение: ${name(b.staff)}`
    return {
      key: `vb:${b.id}`, layer: 'visits' as CalLayer, title: `${who}${b.class_name ? ` · ${b.class_name}` : ''}`, start, end, allDay: !p,
      color: color('visits'), subtitle: [p ? `${p.label} час` : '', b.subject, b.topic].filter(Boolean).join(' · '),
      href: '/visits', sourceLabel: b.campaign?.title || 'Посещения на час',
    }
  })
}
const addMin = (d: Date, min: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(min / 60), min % 60)

// ── съвети и заседания ──
const loadMeetings: Loader = async (sb, me, from, to) => {
  const f = ymd(from), t = ymd(to)
  const isMgr = MANAGER_ROLES.includes(me.role)
  const [council, committees, coord, mtg, mtgDec] = await Promise.all([
    sb.from('council_sets').select('id, title, event_date, event_time').gte('event_date', f).lt('event_date', t),
    sb.from('committee_sessions').select('id, committee_id, session_date, agenda, deadline, committee:committees(name)').gte('session_date', f).lt('session_date', t),
    (isMgr || me.isCoordinator) ? sb.from('coordinating_team_sessions').select('id, session_date, agenda').gte('session_date', f).lt('session_date', t) : Promise.resolve({ data: [] }),
    // заседания на ПС / ОС и сроковете на решенията (отговорникът вижда своите, ръководството — всички)
    sb.from('mtg_meetings').select('id, body, title, meeting_date, start_time, end_time, place, status, meeting_no').gte('meeting_date', f).lt('meeting_date', t),
    (() => {
      let dq = sb.from('mtg_decisions').select('id, text, due_date, task_status, responsible_id, meeting_id, meeting:mtg_meetings!inner(body, meeting_no, status)')
        .eq('meeting.status', 'final').gte('due_date', f).lt('due_date', t).in('task_status', ['open', 'reported'])
      if (!isMgr) dq = dq.eq('responsible_id', me.id)
      return dq
    })(),
  ])
  const out: CalItem[] = []
  for (const s of (council.data || []) as any[]) {
    const timed = !!s.event_time
    const start = timed ? at(s.event_date, String(s.event_time).slice(0, 5)) : parseYmd(s.event_date)
    out.push({
      key: `pc:${s.id}`, layer: 'meetings', title: s.title || 'Педагогически съвет', start, end: timed ? new Date(start.getTime() + 90 * 60000) : start, allDay: !timed,
      color: color('meetings'), subtitle: 'Материали за съгласуване', href: '/council', sourceLabel: 'Педагогически съвет',
    })
  }
  for (const s of (committees.data || []) as any[]) out.push({
    key: `cs:${s.id}`, layer: 'meetings', title: `Заседание: ${s.committee?.name || 'комисия'}`, start: parseYmd(s.session_date), end: parseYmd(s.session_date), allDay: true,
    color: color('meetings'), description: s.agenda || undefined, href: `/committees/${s.committee_id}`, sourceLabel: 'Комисии',
  })
  for (const s of (coord.data || []) as any[]) out.push({
    key: `ct:${s.id}`, layer: 'meetings', title: 'Заседание на координиращия екип', start: parseYmd(s.session_date), end: parseYmd(s.session_date), allDay: true,
    color: color('meetings'), description: s.agenda || undefined, href: '/admin/coordinating-team', sourceLabel: 'Координиращ екип',
  })
  for (const s of (mtg.data || []) as any[]) {
    const label = s.body === 'os' ? 'Общо събрание' : 'Педагогически съвет'
    const timed = !!s.start_time
    const start = timed ? at(s.meeting_date, String(s.start_time).slice(0, 5)) : parseYmd(s.meeting_date)
    const end = timed ? (s.end_time ? at(s.meeting_date, String(s.end_time).slice(0, 5)) : new Date(start.getTime() + 90 * 60000)) : start
    out.push({
      key: `mtg:${s.id}`, layer: 'meetings', title: s.title ? `${label}: ${s.title}` : label, start, end, allDay: !timed,
      color: s.body === 'os' ? '#7c3aed' : color('meetings'), location: s.place || undefined,
      subtitle: s.meeting_no ? `Протокол № ${s.meeting_no}` : 'Дневен ред и покана', href: `/meetings/${s.id}`, sourceLabel: label,
      done: s.status === 'final',
    })
  }
  for (const d of (mtgDec.data || []) as any[]) out.push({
    key: `mtgd:${d.id}`, layer: 'meetings', title: `Решение: ${d.text}`, start: parseYmd(d.due_date), end: parseYmd(d.due_date), allDay: true,
    color: '#0891b2', subtitle: d.task_status === 'reported' ? 'Отчетено — чака преглед' : `Срок · протокол № ${d.meeting?.meeting_no ?? ''} ${d.meeting?.body === 'os' ? 'ОС' : 'ПС'}`,
    href: '/meetings?tab=decisions', sourceLabel: 'Решения на ПС / ОС', done: d.task_status === 'reported',
  })
  if (council.error && committees.error) throw council.error
  return out
}

// ── дежурства (колегата вижда своите; ръководството — всички) ──
const loadDuties: Loader = async (sb, me, from, to) => {
  let q = sb.from('duty_slots').select('id, staff_id, start_date, end_date, p:staff_profiles(first_name, last_name)')
    .lt('start_date', ymd(to)).gte('end_date', ymd(from))
  if (!MANAGER_ROLES.includes(me.role)) q = q.eq('staff_id', me.id)
  const { data, error } = await q
  if (error) throw error
  return ((data || []) as any[]).map(d => ({
    key: `duty:${d.id}`, layer: 'duties' as CalLayer, title: d.staff_id === me.id ? 'Дежурство' : `Дежурен: ${name(d.p)}`,
    start: parseYmd(d.start_date), end: parseYmd(d.end_date || d.start_date), allDay: true, color: color('duties'),
    href: MANAGER_ROLES.includes(me.role) ? '/duties' : undefined, sourceLabel: 'Дежурства',
  }))
}

const LOADERS: Record<CalLayer, Loader | null> = {
  mine: loadEvents, shared: null, school: loadSchool, tasks: loadTasks, deadlines: loadDeadlines, control: loadControl,
  eval: loadEval, portfolio: loadPortfolio, projects: loadProjects, visits: loadVisits, meetings: loadMeetings, duties: loadDuties,
}

export interface LoadResult { items: CalItem[]; failed: CalLayer[]; needSql: boolean }

/** Всичко за интервала [from, to). Грешка в един източник не спира останалите. */
export async function loadCalendar(sb: any, me: Me, from: Date, to: Date): Promise<LoadResult> {
  const failed: CalLayer[] = []
  let needSql = false
  const parts = await Promise.all((Object.entries(LOADERS) as [CalLayer, Loader | null][]).map(async ([k, fn]) => {
    if (!fn) return []
    try { return await fn(sb, me, startOfDay(from), startOfDay(to)) } catch (e: any) {
      if (k === 'mine') needSql = /cal_events|does not exist|schema cache/i.test(String(e?.message || e))
      failed.push(k)
      return []
    }
  }))
  return { items: parts.flat(), failed, needSql }
}
