// Дневник на случаите — тормоз (по Механизма) и инциденти с поведение: списъците, статусите и анализът.
// Анализът е това, което хартиената книга не може: кога и къде, кои деца повтарят, кои двойки,
// какво предшества поведението, колко бързо се приключва.

export type Kind = 'bullying' | 'behavior'
export type Status = 'new' | 'review' | 'measures' | 'closed'
export type Role = 'victim' | 'perpetrator' | 'witness' | 'involved' | 'affected'
export type Case = {
  id: string; academic_year_id: string | null; number: number; kind: Kind; occurred_on: string; occurred_time: string | null; place: string | null
  forms: string[]; level: number | null; description: string; antecedents: string[]; antecedent_note: string | null
  consequences: string[]; consequence_note: string | null; actions: string[]; parents_notified: boolean
  status: Status; closed_on: string | null; outcome: string | null; protocol_id: string | null; reported_by: string | null; created_at: string
}
export type Participant = { id: string; case_id: string; student_id: string | null; name: string | null; role: Role }
export type Event = { id: string; case_id: string; kind: 'note' | 'status' | 'measure' | 'parent' | 'protocol'; text: string; staff_id: string | null; at: string }

export const KINDS: Record<Kind, { label: string; short: string; color: string; bg: string }> = {
  bullying: { label: 'Тормоз / насилие', short: 'Тормоз', color: '#b91c1c', bg: '#fef2f2' },
  behavior: { label: 'Поведение', short: 'Поведение', color: '#7c3aed', bg: '#f5f3ff' },
}
export const STATUS: Record<Status, { label: string; color: string; bg: string }> = {
  new: { label: 'Нов', color: '#b45309', bg: '#fffbeb' },
  review: { label: 'Разглежда се', color: '#1d4ed8', bg: '#eff6ff' },
  measures: { label: 'Взети мерки', color: '#7c3aed', bg: '#f5f3ff' },
  closed: { label: 'Приключен', color: '#15803d', bg: '#f0fdf4' },
}
export const ROLES: Record<Kind, { v: Role; label: string }[]> = {
  bullying: [{ v: 'victim', label: 'пострадал' }, { v: 'perpetrator', label: 'извършител' }, { v: 'witness', label: 'свидетел' }],
  behavior: [{ v: 'involved', label: 'дете с поведението' }, { v: 'affected', label: 'засегнат' }, { v: 'witness', label: 'свидетел' }],
}
export const ROLE_LABEL: Record<Role, string> = { victim: 'пострадал', perpetrator: 'извършител', witness: 'свидетел', involved: 'с поведението', affected: 'засегнат' }

export const FORMS: Record<Kind, string[]> = {
  bullying: ['физически', 'вербален', 'психически', 'социален (изолиране)', 'кибертормоз', 'сексуален', 'увреждане на вещи'],
  behavior: ['агресия към дете', 'агресия към възрастен', 'самонараняване', 'разрушаване на вещи', 'бягство', 'криза/срив', 'отказ от дейност', 'неприлично поведение', 'друго'],
}
export const LEVELS: Record<Kind, { n: number; label: string; hint: string }[]> = {
  bullying: [
    { n: 1, label: 'I ниво', hint: 'Еднократно, без сериозни последици — овладява се от учителя на място.' },
    { n: 2, label: 'II ниво', hint: 'Повтарящо се или с последици — включва се класният, родителите, Координационният съвет.' },
    { n: 3, label: 'III ниво', hint: 'Сериозна заплаха за безопасността — незабавно директор, родители, при нужда ОЗД/полиция.' },
  ],
  behavior: [
    { n: 1, label: 'Леко', hint: 'Овладяно бързо, без вреда.' },
    { n: 2, label: 'Средно', hint: 'Нужна намеса и време за успокояване.' },
    { n: 3, label: 'Тежко', hint: 'Опасност за детето или другите, нараняване.' },
  ],
}
export const PLACES = ['Класна стая', 'Коридор', 'Двор', 'Столова', 'Тоалетна', 'Физкултурен салон', 'Кабинет (терапия)', 'ЦОУД', 'Транспорт', 'Извън ЦСОП', 'Онлайн']
export const ANTECEDENTS = ['преход/смяна на дейност', 'искане/задача', 'отказ (казано „не“)', 'шум/много хора', 'чакане', 'конфликт за предмет', 'провокация от друго дете', 'неструктурирано време', 'умора/глад/болка', 'нов човек/място', 'без видима причина']
export const CONSEQUENCES = ['пренасочване', 'успокояване/тиха зона', 'разговор', 'отстраняване от дейността', 'раздяла на децата', 'получи искания предмет', 'медицинска помощ', 'без реакция']
export const ACTIONS = ['прекратено на място', 'уведомен класен', 'уведомен ЗДУД/директор', 'уведомен родител', 'медицинска помощ', 'уведомен психолог', 'сигнал до ОЗД', 'сигнал до полиция']

export const todaySofia = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
export const fmtDate = (d: string) => (d ? d.split('-').reverse().join('.') : '')
const DAYS = ['нед', 'пон', 'вт', 'ср', 'чет', 'пет', 'съб']
const MONTHS = ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек']

const count = (xs: string[]) => {
  const m: Record<string, number> = {}
  xs.forEach(x => { m[x] = (m[x] || 0) + 1 })
  return Object.entries(m).sort((a, b) => b[1] - a[1])
}

/** Целият анализ — от вече филтрираните случаи */
export function analyze(cases: Case[], parts: Participant[], names: Record<string, string>, today: string) {
  const byCase: Record<string, Participant[]> = {}
  parts.forEach(p => { (byCase[p.case_id] ||= []).push(p) })

  // по месеци (учебната година — от септември)
  const months: { key: string; label: string; bullying: number; behavior: number }[] = []
  const keys = Array.from(new Set(cases.map(c => c.occurred_on.slice(0, 7)))).sort()
  if (keys.length) {
    let [y, m] = keys[0].split('-').map(Number)
    const [ly, lm] = keys[keys.length - 1].split('-').map(Number)
    while (y < ly || (y === ly && m <= lm)) {
      const k = `${y}-${String(m).padStart(2, '0')}`
      months.push({ key: k, label: MONTHS[m - 1], bullying: 0, behavior: 0 })
      m++; if (m > 12) { m = 1; y++ }
    }
  }
  const mi = Object.fromEntries(months.map((x, i) => [x.key, i]))
  cases.forEach(c => { const i = mi[c.occurred_on.slice(0, 7)]; if (i !== undefined) months[i][c.kind]++ })

  // кога: ден от седмицата × час
  const heat: Record<string, number> = {}
  cases.forEach(c => {
    const d = new Date(c.occurred_on + 'T00:00').getDay()
    const h = c.occurred_time ? Number(c.occurred_time.slice(0, 2)) : -1
    if (h >= 0) heat[`${d}|${h}`] = (heat[`${d}|${h}`] || 0) + 1
  })
  const hours = Array.from(new Set(Object.keys(heat).map(k => Number(k.split('|')[1])))).sort((a, b) => a - b)

  // деца: колко пъти и в каква роля
  const kids: Record<string, { id: string; name: string; total: number; roles: Record<string, number>; last: string; cases: string[] }> = {}
  cases.forEach(c => (byCase[c.id] || []).forEach(p => {
    const id = p.student_id || `name:${p.name}`
    if (!p.student_id && !p.name) return
    const k = (kids[id] ||= { id, name: p.student_id ? names[p.student_id] || '—' : p.name || '—', total: 0, roles: {}, last: '', cases: [] })
    if (p.role === 'witness') return
    k.total++; k.roles[p.role] = (k.roles[p.role] || 0) + 1; k.cases.push(c.id)
    if (c.occurred_on > k.last) k.last = c.occurred_on
  }))
  const repeat = Object.values(kids).filter(k => k.total >= 2).sort((a, b) => b.total - a.total)

  // двойки пострадал → извършител, повторени
  const pairs: Record<string, { a: string; b: string; n: number }> = {}
  cases.filter(c => c.kind === 'bullying').forEach(c => {
    const ps = byCase[c.id] || []
    ps.filter(p => p.role === 'perpetrator').forEach(x => ps.filter(p => p.role === 'victim').forEach(v => {
      const a = x.student_id ? names[x.student_id] : x.name, b = v.student_id ? names[v.student_id] : v.name
      if (!a || !b) return
      const k = `${a}→${b}`; (pairs[k] ||= { a, b, n: 0 }).n++
    }))
  })

  const closed = cases.filter(c => c.status === 'closed' && c.closed_on)
  const avgClose = closed.length ? Math.round(closed.reduce((t, c) => t + (new Date(c.closed_on!).getTime() - new Date(c.occurred_on).getTime()) / 86400000, 0) / closed.length) : null
  const open = cases.filter(c => c.status !== 'closed')
  const stale = open.filter(c => (new Date(today).getTime() - new Date(c.occurred_on).getTime()) / 86400000 > 14)

  return {
    total: cases.length,
    bullying: cases.filter(c => c.kind === 'bullying').length,
    behavior: cases.filter(c => c.kind === 'behavior').length,
    open: open.length, stale, avgClose,
    levels: [1, 2, 3].map(n => ({ n, bullying: cases.filter(c => c.kind === 'bullying' && c.level === n).length, behavior: cases.filter(c => c.kind === 'behavior' && c.level === n).length })),
    months,
    places: count(cases.map(c => c.place || 'не е посочено')),
    forms: count(cases.flatMap(c => c.forms)),
    antecedents: count(cases.flatMap(c => c.antecedents)),
    consequences: count(cases.flatMap(c => c.consequences)),
    heat, hours, days: [1, 2, 3, 4, 5].map(d => ({ d, label: DAYS[d] })),
    repeat,
    pairs: Object.values(pairs).filter(p => p.n >= 2).sort((a, b) => b.n - a.n),
    parentsPct: cases.length ? Math.round((cases.filter(c => c.parents_notified).length / cases.length) * 100) : 0,
  }
}
export type Analysis = ReturnType<typeof analyze>
