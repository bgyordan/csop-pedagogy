// Импорт на данни за педагогическия персонал от експорта „Персонал“ на НЕИСПУО (.xlsx):
// образование, квалификации, ПКС, стаж, длъжност. Файлът има по един ред за всяко образование /
// квалификация на човека — редовете се групират по лице. Колоните се намират по заглавие.
import type { Edu, PPProfile } from './pro-portfolio'

/** Данни от НЕИСПУО, които пазим към профила като справка (без адреси и дата на раждане). */
export type NeispuoSnapshot = {
  as_of: string
  position?: string | null; category?: string | null; titular?: string | null
  contract?: string | null; contract_basis?: string | null; contract_no?: string | null; since_year?: number | null
  years_total?: number | null; years_specialty?: number | null; years_teacher?: number | null
  credits?: number | null; pks?: string | null
  znpr_min?: number | null; znpr_ind?: number | null; hours_total?: number | null
  email?: string | null; phone?: string | null
}

export type NeispuoPerson = {
  key: string
  first: string; middle: string; last: string
  /** „Персонален образователен номер“ — потребителското име в НЕИСПУО; стабилен ключ за следващи импорти */
  poid: string | null
  email: string | null; phone: string | null; position: string | null
  rows: number
  snap: NeispuoSnapshot
  /** Предложени стойности за профила в портфолиото */
  profile: {
    education: Edu[]; specialty: string | null; teacher_q: boolean | null; other_q: string | null
    pks: string | null; work_since: string | null; teacher_since: string | null
  }
}

export type StaffRef = {
  id: string; first_name: string; middle_name: string | null; last_name: string; email: string | null
  phone: string | null; position: string | null; neispuo_id: string | null; is_active: boolean
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[„“"']/g, '').replace(/\s+/g, ' ').trim()
const str = (v: unknown) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s || null }
const num = (v: unknown) => { const s = String(v ?? '').replace(',', '.').trim(); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null }

/** Степените по реда, в който се придобиват; „специалист“ в НЕИСПУО е следдипломна квалификация, не степен. */
const LEVELS: [RegExp, string, number][] = [
  [/доктор на науките/, 'Доктор на науките', 7],
  [/доктор/, 'Доктор', 6],
  [/магистър/, 'Магистър', 5],
  [/професионален бакалавър/, 'Професионален бакалавър', 3],
  [/бакалавър/, 'Бакалавър', 4],
  [/полувисше/, 'Полувисше', 2],
  [/средно/, 'Средно образование', 1],
]
export const levelOf = (raw: string | null) => {
  const n = norm(raw)
  if (!n || n === 'специалист') return null
  const hit = LEVELS.find(([re]) => re.test(n))
  return hit ? { label: hit[1], rank: hit[2] } : { label: raw!, rank: 0 }
}

/** „ПКС IV“ / „IV ПКС“ / „Пета ПКС“ → „IV ПКС“ (както е в атестационната карта) */
export function pksOf(raw: unknown): string | null {
  const n = norm(raw)
  if (!n) return null
  const words: Record<string, string> = { първа: 'I', втора: 'II', трета: 'III', четвърта: 'IV', пета: 'V' }
  for (const [w, r] of Object.entries(words)) if (n.includes(w)) return `${r} ПКС`
  const m = n.match(/\b(i{1,3}|iv|v)\b/)
  return m ? `${m[1].toUpperCase()} ПКС` : null
}

const TEACHER_RE = /учител|педагог|учителк/i

/** Дата „преди N години (и един ден)“ — за да се смята стажът напред във времето, без да се закръгля нагоре. */
export function sinceFromYears(asOf: string, years: number | null): string | null {
  if (years == null || years < 0) return null
  const whole = Math.floor(years)
  const months = Math.round((years - whole) * 12)
  const d = new Date(asOf + 'T00:00:00Z')
  d.setUTCFullYear(d.getUTCFullYear() - whole)
  d.setUTCMonth(d.getUTCMonth() - months)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Дата на експорта от името на файла (НЕИСПУО добавя време в милисекунди), иначе днес. */
export function asOfFromFileName(name: string, today = new Date()): string {
  const m = name.match(/(\d{13})/)
  if (m) { const d = new Date(Number(m[1])); if (d.getUTCFullYear() > 2015 && d <= new Date(today.getTime() + 864e5)) return d.toISOString().slice(0, 10) }
  return today.toISOString().slice(0, 10)
}

/** Листът (масив от масиви) → лица. */
export function parsePersonnel(rows: unknown[][], asOf: string): { people: NeispuoPerson[]; error?: string } {
  const hi = rows.slice(0, 20).findIndex(r => r.some(c => norm(c) === 'име') && r.some(c => norm(c) === 'фамилия'))
  if (hi < 0) return { people: [], error: 'Не намирам заглавния ред (Име, Презиме, Фамилия …). Това ли е справката „Персонал“ от НЕИСПУО?' }
  const h = rows[hi].map(norm)
  const col = (...tests: ((x: string) => boolean)[]) => { for (const t of tests) { const i = h.findIndex(t); if (i >= 0) return i } return -1 }
  const c = {
    first: col(x => x === 'име'), middle: col(x => x === 'презиме'), last: col(x => x === 'фамилия'),
    poid: col(x => x.startsWith('персонален образователен номер')),
    position: col(x => x === 'длъжност'), category: col(x => x === 'категория персонал'), titular: col(x => x.startsWith('титуляр')),
    contract: col(x => x === 'вид на договора'), basis: col(x => x.startsWith('основание по кт')), contractNo: col(x => x.startsWith('№ на договора')),
    since: col(x => x.startsWith('година на постъпване')),
    yTotal: col(x => x === 'трудов стаж - общ'), ySpec: col(x => x.startsWith('трудов стаж - по специалност')), yTeach: col(x => x.startsWith('трудов стаж - учителски')),
    phone: col(x => x.startsWith('телефон')), email: col(x => x === 'имейл' || x === 'e-mail' || x === 'email'),
    pq: col(x => x.startsWith('придобита професионална квалификация')),
    level: col(x => x.startsWith('образователна степен')), spec: col(x => x === 'специалност'),
    credits: col(x => x.includes('редити')),   // в НЕИСПУО заглавието е с латинско „K“
    pks: col(x => x.startsWith('професионална квалификационна степен'), x => x.includes('пкс')),
    znprMin: col(x => x.startsWith('минимална знпр')), znprInd: col(x => x.startsWith('индивидуална знпр')),
    hours: col(x => x.startsWith('всичко възложени часове')),
  }
  if (c.first < 0 || c.last < 0) return { people: [], error: 'Липсват колоните „Име“ и „Фамилия“' }
  const g = (r: unknown[], i: number) => (i >= 0 ? r[i] : null)

  const groups = new Map<string, unknown[][]>()
  for (const r of rows.slice(hi + 1)) {
    if (!r || !str(g(r, c.first)) || !str(g(r, c.last))) continue
    const key = str(g(r, c.poid)) || [g(r, c.first), g(r, c.middle), g(r, c.last)].map(norm).join('|')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  const people: NeispuoPerson[] = []
  for (const [key, rs] of Array.from(groups.entries())) {
    const r0 = rs[0]
    const first = (rs.map(r => str(g(r, c.first))).find(Boolean)) || ''
    const firstOf = (i: number) => { for (const r of rs) { const v = str(g(r, i)); if (v) return v } return null }
    const numOf = (i: number) => { for (const r of rs) { const v = num(g(r, i)); if (v != null) return v } return null }

    // образование: редове със степен; останалите (без степен или „специалист“) — допълнителни квалификации
    const edu: (Edu & { rank: number })[] = []
    const extra: string[] = []
    let teacher = false, anyQ = false
    for (const r of rs) {
      const lvl = levelOf(str(g(r, c.level)))
      const spec = str(g(r, c.spec)), pq = str(g(r, c.pq))
      if (!lvl && !spec && !pq) continue
      anyQ = true
      if (TEACHER_RE.test(spec || '') || TEACHER_RE.test(pq || '')) teacher = true
      if (lvl) {
        const e: Edu & { rank: number } = { level: lvl.label, rank: lvl.rank }
        if (spec) e.specialty = spec
        if (pq && norm(pq) !== norm(spec)) e.qualification = pq
        if (!edu.some(x => x.level === e.level && norm(x.specialty) === norm(e.specialty) && norm(x.qualification) === norm(e.qualification))) edu.push(e)
      } else {
        const t = spec && pq && !norm(spec).includes(norm(pq)) && !/степен/i.test(pq) ? `${spec} (${pq})` : (spec || pq)!
        if (!extra.some(x => norm(x) === norm(t))) extra.push(t)
      }
    }
    edu.sort((a, b) => a.rank - b.rank)
    const higher = edu.find(e => e.rank >= 3)
    const yTotal = numOf(c.yTotal), yTeach = numOf(c.yTeach)
    const pks = pksOf(firstOf(c.pks))
    const position = (firstOf(c.position) || '').replace(/^\d{4}-\d{4}\s+/, '').trim() || null
    const email = firstOf(c.email), phone = firstOf(c.phone)

    people.push({
      key,
      first, middle: firstOf(c.middle) || '', last: firstOf(c.last) || '',
      poid: str(g(r0, c.poid)),
      email, phone, position, rows: rs.length,
      snap: {
        as_of: asOf, position, category: firstOf(c.category), titular: firstOf(c.titular),
        contract: firstOf(c.contract), contract_basis: firstOf(c.basis), contract_no: firstOf(c.contractNo),
        since_year: numOf(c.since), years_total: yTotal, years_specialty: numOf(c.ySpec), years_teacher: yTeach,
        credits: numOf(c.credits), pks, znpr_min: numOf(c.znprMin), znpr_ind: numOf(c.znprInd), hours_total: numOf(c.hours),
        email, phone,
      },
      profile: {
        education: edu.map(({ rank, ...e }) => e),
        specialty: higher?.specialty || null,
        teacher_q: anyQ ? teacher : null,
        other_q: extra.length ? extra.join('; ') : null,
        pks,   // празно в НЕИСПУО не значи непременно „няма“ — не се попълва
        work_since: sinceFromYears(asOf, yTotal),
        teacher_since: sinceFromYears(asOf, yTeach),
      },
    })
  }
  people.sort((a, b) => `${a.first} ${a.last}`.localeCompare(`${b.first} ${b.last}`, 'bg'))
  return { people }
}

/** Свързване със служител: номер от НЕИСПУО → три имена → име и фамилия → имейл. */
export function matchPerson(p: NeispuoPerson, staff: StaffRef[]): { id: string | null; how: string; candidates: string[] } {
  if (p.poid) { const s = staff.find(x => x.neispuo_id && norm(x.neispuo_id) === norm(p.poid)); if (s) return { id: s.id, how: 'номер в НЕИСПУО', candidates: [s.id] } }
  const f = norm(p.first), m = norm(p.middle), l = norm(p.last)
  const three = staff.filter(s => norm(s.first_name) === f && norm(s.last_name) === l && norm(s.middle_name) === m && m)
  if (three.length === 1) return { id: three[0].id, how: 'три имена', candidates: [three[0].id] }
  const two = staff.filter(s => norm(s.first_name) === f && norm(s.last_name) === l && (!norm(s.middle_name) || !m || norm(s.middle_name) === m))
  const pref = two.filter(s => s.is_active)
  if (two.length === 1) return { id: two[0].id, how: 'име и фамилия', candidates: [two[0].id] }
  if (pref.length === 1) return { id: pref[0].id, how: 'име и фамилия (активен)', candidates: two.map(s => s.id) }
  if (p.email) { const e = staff.filter(s => s.email && norm(s.email) === norm(p.email)); if (e.length === 1) return { id: e[0].id, how: 'имейл', candidates: [e[0].id] } }
  // жени с нова фамилия: същото име и презиме
  const mid = m ? staff.filter(s => norm(s.first_name) === f && norm(s.middle_name) === m) : []
  return { id: null, how: two.length > 1 ? 'няколко съвпадения' : 'няма съвпадение', candidates: (two.length ? two : mid).map(s => s.id) }
}

export type FieldKey = 'education' | 'specialty' | 'teacher_q' | 'other_q' | 'pks' | 'work' | 'teacher' | 'position' | 'phone'
export const FIELD_LABEL: Record<FieldKey, string> = {
  education: 'Образование', specialty: 'Специалност', teacher_q: 'ПК „учител“', other_q: 'Допълнителна квалификация', pks: 'ПКС',
  work: 'Общ стаж', teacher: 'Учителски стаж', position: 'Длъжност', phone: 'Телефон',
}
export type Change = { field: FieldKey; from: string; to: string; state: 'new' | 'same' | 'diff' }
export type Mode = 'fill' | 'replace'

export const eduText = (e: Edu) => [e.level, e.specialty, e.qualification ? `ПК: ${e.qualification}` : null, e.school, e.year].filter(Boolean).join(', ')
const yn = (v: boolean | null | undefined) => (v == null ? '' : v ? 'да' : 'не')
const sameEdu = (a: Edu, b: Edu) => a.level === b.level && norm(a.specialty) === norm(b.specialty)

/** Какво ще се промени за един човек и какво точно се изпраща за запис. */
export function planFor(p: NeispuoPerson, cur: PPProfile | null, s: StaffRef, mode: Mode, fields: Set<FieldKey>, yearsAt: (since: string | null | undefined, extra?: number) => number | null) {
  const changes: Change[] = []
  const set: Record<string, unknown> = {}
  const add = (field: FieldKey, from: string, to: string, apply: () => void) => {
    if (!to || !fields.has(field)) return
    const state: Change['state'] = !from ? 'new' : norm(from) === norm(to) ? 'same' : 'diff'
    changes.push({ field, from, to, state })
    if (state === 'new' || (state === 'diff' && mode === 'replace')) apply()
  }
  const pr = p.profile

  // образование: при „допълни“ се добавят само липсващите записи
  const curEdu = cur?.education || []
  if (pr.education.length && fields.has('education')) {
    const missing = pr.education.filter(e => !curEdu.some(x => sameEdu(x, e)))
    const from = curEdu.map(eduText).join('; ')
    if (mode === 'replace') {
      const next = pr.education.map(e => ({ ...curEdu.find(x => sameEdu(x, e)), ...e }))
      add('education', from, next.map(eduText).join('; '), () => { set.education = next })
    } else if (!missing.length) changes.push({ field: 'education', from, to: from, state: 'same' })
    else {
      const next = [...curEdu, ...missing]
      changes.push({ field: 'education', from, to: next.map(eduText).join('; '), state: 'new' })   // само добавя
      set.education = next
    }
  }
  add('specialty', cur?.specialty || '', pr.specialty || '', () => { set.specialty = pr.specialty })
  add('teacher_q', yn(cur?.teacher_q), yn(pr.teacher_q), () => { set.teacher_q = pr.teacher_q })
  add('other_q', cur?.other_q || '', pr.other_q || '', () => { set.other_q = pr.other_q })
  add('pks', cur?.pks || '', pr.pks || '', () => { set.pks = pr.pks })

  // стаж: сравнява се изчисленият брой години към датата на експорта
  const extra = { ...(cur?.years_extra || {}) }
  const yt = yearsAt(cur?.work_since, Number(extra.total || 0)), yy = yearsAt(cur?.teacher_since, Number(extra.teacher || 0))
  const ys = (n: number | null | undefined) => (n == null ? '' : `${n} г.`)
  let extraChanged = false
  add('work', ys(yt), pr.work_since ? ys(p.snap.years_total) : '', () => { set.work_since = pr.work_since; delete extra.total; extraChanged = true })
  add('teacher', ys(yy), pr.teacher_since ? ys(p.snap.years_teacher) : '', () => { set.teacher_since = pr.teacher_since; delete extra.teacher; extraChanged = true })
  if (extraChanged) set.years_extra = Object.keys(extra).length ? extra : null

  const staff: { position?: string; phone?: string } = {}
  add('position', s.position || '', p.position || '', () => { staff.position = p.position! })
  add('phone', s.phone || '', p.phone || '', () => { staff.phone = p.phone! })
  return { changes, set, staff }
}
