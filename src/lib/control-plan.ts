// Контролна дейност — годишен план (6 части + график по месеци) и годишен анализ.
// Рамката на плана: анализ на предходната година, цел и задачи, обект и предмет, методи, график, отчитане.
// Анализът е и доклад за ПС (февруари / юли), и част 1 на плана за следващата година.
import {
  KIND_LABEL, FORM_LABEL, FOCUS_LABEL, recOverdue,
  type CheckKind, type CheckFocus, type CheckForm, type ControlCheck, type CheckStaff, type Recommendation,
} from './control'

export type ControlPlan = {
  id: string; academic_year_id: string; owner_id: string; owner_title: string | null
  analysis: string | null; goals: string | null; objects: string | null; methods: string | null; reporting: string | null
  status: 'draft' | 'approved'; order_ref: string | null; approved_at: string | null
  owner?: { first_name: string; last_name: string; role?: string; position?: string | null } | null
}
export type PlanItem = {
  id: string; plan_id: string; month: number; kind: CheckKind; focus: CheckFocus; form: CheckForm
  subject: string; scope: string | null; template_id: string | null; target: number; sort: number
}

export const SCHOOL_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7]
export const MONTH_LABEL = ['', 'януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']
export const MONTH_SHORT = ['', 'яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек']

/** Календарната година на месеца в учебната година „2026-2027“. */
export const monthYear = (yearName: string, m: number) => (parseInt(yearName, 10) || new Date().getFullYear()) + (m >= 8 ? 0 : 1)
/** Последният ден на месеца от графика (ISO). */
export function monthEnd(yearName: string, m: number) {
  const y = monthYear(yearName, m)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}
/** Поредност на месеца в учебната година (за сортиране). */
export const monthOrder = (m: number) => (m >= 8 ? m - 8 : m + 4)

// ── Начално съдържание ───────────────────────────────────────────────────────
export type PlanRole = 'director' | 'zdud' | 'zdasd'
export const planRole = (role: string): PlanRole => (role === 'director' ? 'director' : role === 'zdud' ? 'zdud' : 'zdasd')

export function defaultPlanTexts(r: PlanRole) {
  const area = r === 'zdasd' ? 'административно-стопанската дейност' : r === 'zdud' ? 'учебната, корекционно-терапевтичната и рехабилитационната дейност' : 'цялостната дейност на центъра'
  return {
    goals: `Цел: Осигуряване на качество и законосъобразност на ${area} чрез навременна информация, подкрепа и обратна връзка към служителите.\n`
      + 'Задачи:\n'
      + (r === 'zdasd'
        ? '1. Проследяване на спазването на Правилника за вътрешния трудов ред, графиците за дежурства и правилата за безопасност.\n2. Контрол на опазването и стопанисването на материалната база.\n3. Контрол на документацията на непедагогическия персонал.'
        : '1. Проследяване на качеството на учебните часове, заниманията и терапевтичните сесии и на подкрепата за всеки ученик.\n2. Контрол на документацията по приобщаващото образование — ИУП, индивидуални учебни програми, планове за подкрепа, протоколи на ЕПЛР.\n3. Проследяване на реализацията на ИУП и своевременното водене на дневниците.\n4. Методическа подкрепа на новоназначените педагогически специалисти.\n5. Последващ контрол на изпълнението на дадените препоръки.'),
    objects: r === 'zdasd'
      ? 'Обект: непедагогическият персонал, материалната база, дежурствата.\nПредмет: спазване на трудовата дисциплина, безопасност, стопанисване на имуществото, документация.'
      : 'Обект: педагогическите специалисти — учители, учители ЦОУД, логопеди, психолози, рехабилитатори.\nПредмет: образователният процес, корекционно-терапевтичната и рехабилитационната дейност, документацията по приобщаващото образование, реализацията на ИУП.',
    methods: 'Видове контрол: превантивен, текущ, последващ.\nФорми: тематична проверка, текуща проверка, наблюдение, проучване.\nМетоди: наблюдение, проверка на документация, разговор, справки от информационната система на центъра.\nПроверките са предварително оповестени и неоповестени. Обратната връзка към проверения се дава до два работни дни след наблюдението; констативният протокол се изготвя в 15-дневен срок (чл. 41, ал. 7 от Наредба № 8/2016).',
    reporting: 'Констативните протоколи се вписват в Книгата за контролната дейност и се съхраняват 5 години.\nРезултатите от контролната дейност се отчитат пред педагогическия съвет в края на първия учебен срок (февруари) и в края на учебната година (юли).\nДадените препоръки се проследяват чрез последващ контрол.',
  }
}

type Suggest = Omit<PlanItem, 'id' | 'plan_id' | 'template_id' | 'sort'> & { template?: string }
const S = (month: number, template: string | undefined, subject: string, scope: string, o: Partial<Suggest> = {}): Suggest => ({
  month, template, subject, scope, kind: 'current', focus: 'pedagogical', form: 'observation', target: 1, ...o,
})

/** Типов график за ЦСОП — отправна точка, редактира се свободно. */
export function suggestedItems(r: PlanRole): Suggest[] {
  if (r === 'zdasd') return [
    S(9, 'preventive', 'Готовност на сградата и материалната база за учебната година', 'помощен персонал, отговорници', { kind: 'preliminary', focus: 'administrative', form: 'study' }),
    S(10, 'discipline', 'Дежурства и трудова дисциплина', 'помощен персонал', { focus: 'administrative', form: 'current', target: 2 }),
    S(12, 'free', 'Безопасност и пожарна безопасност', 'отговорници', { focus: 'administrative', form: 'thematic' }),
    S(1, 'discipline', 'Дежурства и трудова дисциплина', 'помощен персонал', { focus: 'administrative', form: 'current', target: 2 }),
    S(3, 'free', 'Стопанисване на имуществото и материалната база', 'отговорници', { focus: 'administrative', form: 'thematic' }),
    S(4, 'discipline', 'Дежурства и трудова дисциплина', 'помощен персонал', { focus: 'administrative', form: 'current', target: 2 }),
    S(6, 'free', 'Подготовка на материалната база за летния период', 'помощен персонал', { kind: 'preliminary', focus: 'administrative', form: 'study' }),
  ]
  if (r === 'zdud') return [
    S(10, 'eplr_docs', 'Документация на ЕПЛР — изготвяне на ИУП и плановете за подкрепа', 'класни ръководители, координатор', { focus: 'administrative', form: 'thematic', target: 3 }),
    S(10, 'lesson', 'Наблюдение на учебни часове — новоназначени учители', 'новоназначени учители', { target: 2 }),
    S(11, 'iup', 'Реализация на ИУП и водене на дневника', 'класни ръководители', { focus: 'administrative', form: 'current', target: 3 }),
    S(11, 'therapy', 'Наблюдение на корекционно-терапевтични сесии', 'логопеди, психолози, рехабилитатори', { target: 2 }),
    S(12, 'lesson', 'Наблюдение на учебни часове', 'учители', { target: 3 }),
    S(12, 'coud', 'Наблюдение на занимания в ЦОУД', 'учители ЦОУД', { target: 2 }),
    S(1, 'iup', 'Реализация на ИУП в края на първия срок', 'класни ръководители', { focus: 'administrative', form: 'current', target: 3 }),
    S(2, 'eplr_docs', 'Документация на ЕПЛР — преглед на напредъка', 'класни ръководители, координатор', { focus: 'administrative', form: 'thematic', target: 3 }),
    S(3, 'lesson', 'Наблюдение на учебни часове', 'учители', { target: 3 }),
    S(3, 'therapy', 'Наблюдение на корекционно-терапевтични сесии', 'логопеди, психолози, рехабилитатори', { target: 2 }),
    S(4, 'coud', 'Наблюдение на занимания в ЦОУД', 'учители ЦОУД', { target: 2 }),
    S(5, 'lesson', 'Наблюдение на учебни часове', 'учители', { target: 3 }),
    S(6, 'iup', 'Реализация на ИУП и документация в края на учебната година', 'класни ръководители', { focus: 'administrative', form: 'thematic', target: 3 }),
  ]
  return [
    S(9, 'preventive', 'Готовност на центъра за учебната година — документация, разписания, безопасност', 'всички служители', { kind: 'preliminary', focus: 'administrative', form: 'study' }),
    S(10, 'eplr_docs', 'Документация на ЕПЛР — изготвяне в срок', 'класни ръководители, координатор', { focus: 'administrative', form: 'thematic', target: 2 }),
    S(11, 'lesson', 'Наблюдение на учебни часове — новоназначени учители', 'новоназначени учители', { target: 2 }),
    S(12, 'discipline', 'Дежурства и трудова дисциплина', 'всички служители', { focus: 'administrative', form: 'current' }),
    S(1, 'iup', 'Реализация на ИУП в края на първия срок', 'класни ръководители', { focus: 'administrative', form: 'current', target: 2 }),
    S(2, 'eplr_docs', 'Документация на ЕПЛР — преглед на напредъка', 'класни ръководители, координатор', { focus: 'administrative', form: 'thematic', target: 2 }),
    S(3, 'therapy', 'Наблюдение на корекционно-терапевтични сесии', 'логопеди, психолози, рехабилитатори', { target: 2 }),
    S(4, 'coud', 'Наблюдение на занимания в ЦОУД', 'учители ЦОУД', { target: 2 }),
    S(5, 'lesson', 'Наблюдение на учебни часове', 'учители', { target: 2 }),
    S(6, 'iup', 'Документация в края на учебната година', 'класни ръководители', { focus: 'administrative', form: 'thematic', target: 2 }),
  ]
}

// ── Анализ ───────────────────────────────────────────────────────────────────
export type AnalysisCheck = ControlCheck & { staff?: CheckStaff[] }
export type AnalysisRec = Recommendation & { check?: { id: string; inspector_id: string } | null }
export type Period = 'year' | 't1' | 't2'
export const PERIOD_LABEL: Record<Period, string> = { year: 'учебната година', t1: 'първия учебен срок (септември – януари)', t2: 'втория учебен срок (февруари – юли)' }

/** В периода ли е датата: първи срок — септември до януари, втори — февруари до август. */
export function inPeriod(iso: string, p: Period) {
  if (p === 'year') return true
  const m = parseInt(iso.slice(5, 7), 10)
  const t1 = m >= 9 || m === 1
  return p === 't1' ? t1 : !t1
}

export type Analysis = ReturnType<typeof analyzeControl>

export function analyzeControl(o: {
  checks: AnalysisCheck[]; recs: AnalysisRec[]; items: PlanItem[]; yearName: string; period: Period; today: string
  inspectorNames?: Record<string, string>
}) {
  const checks = o.checks.filter(c => c.status === 'signed' && inPeriod(c.check_date, o.period))
  const ids = new Set(checks.map(c => c.id))
  const count = <K extends string>(f: (c: AnalysisCheck) => K) => {
    const m: Record<string, number> = {}
    checks.forEach(c => { const k = f(c); m[k] = (m[k] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }
  const byKind = count(c => c.kind).map(([k, n]) => [KIND_LABEL[k as CheckKind], n] as const)
  const byForm = count(c => c.form).map(([k, n]) => [FORM_LABEL[k as CheckForm], n] as const)
  const byFocus = count(c => c.focus).map(([k, n]) => [FOCUS_LABEL[k as CheckFocus], n] as const)
  const byInspector = count(c => c.inspector_id).map(([k, n]) => [o.inspectorNames?.[k] || 'Проверяващ', n] as const)
  const staffIds = new Set(checks.flatMap(c => (c.staff || []).map(s => s.staff_id)))
  const planned = checks.filter(c => c.planned).length
  const announced = checks.filter(c => c.announced).length
  const objections = checks.filter(c => (c.staff || []).some(s => s.objection)).length

  // изпълнение на графика: редовете, чийто месец е минал (в периода)
  const linked: Record<string, number> = {}
  o.checks.filter(c => c.status === 'signed' && c.plan_item_id).forEach(c => { linked[c.plan_item_id!] = (linked[c.plan_item_id!] || 0) + 1 })
  const dueItems = o.items.filter(i => monthEnd(o.yearName, i.month) < o.today && inPeriod(monthEnd(o.yearName, i.month), o.period))
  const itemsDone = dueItems.filter(i => (linked[i.id] || 0) >= i.target)
  const itemsPartial = dueItems.filter(i => (linked[i.id] || 0) > 0 && (linked[i.id] || 0) < i.target)
  const itemsMissed = dueItems.filter(i => !linked[i.id])

  // критерии: по текста (ключовете се различават между шаблоните)
  const crit: Record<string, { t: string; n: number; low: number; high: number }> = {}
  checks.forEach(c => (c.criteria || []).forEach(g => g.items.forEach(it => {
    if (it.k.startsWith('r_')) return   // последващ контрол — това са препоръки, не критерии
    const s = c.findings?.[it.k]?.s
    if (!s) return
    const x = crit[it.t] ||= { t: it.t, n: 0, low: 0, high: 0 }
    x.n++; if (s <= 2) x.low++; if (s === 3) x.high++
  })))
  const critList = Object.values(crit).filter(x => x.n >= 2)
  const weak = critList.filter(x => x.low > 0).sort((a, b) => b.low / b.n - a.low / a.n || b.n - a.n).slice(0, 8)
  const strong = critList.filter(x => x.high > 0).sort((a, b) => b.high / b.n - a.high / a.n || b.n - a.n).slice(0, 5)

  const recs = o.recs.filter(r => r.check && ids.has(r.check.id))
  const rec = {
    total: recs.length,
    done: recs.filter(r => r.status === 'done').length,
    notDone: recs.filter(r => r.status === 'not_done').length,
    reported: recs.filter(r => r.status === 'reported').length,
    open: recs.filter(r => r.status === 'open').length,
    overdue: recs.filter(r => recOverdue(r)).length,
  }
  const followUps = checks.filter(c => c.kind === 'follow_up').length

  return {
    total: checks.length, planned, announced, objections, staff: staffIds.size, followUps,
    byKind, byForm, byFocus, byInspector,
    plan: { due: dueItems.length, done: itemsDone.length, partial: itemsPartial.length, missed: itemsMissed, total: o.items.length },
    weak, strong, rec,
  }
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
/** Малка първа буква, без да пипа съкращения („ЕПЛР“, „ИУП“). */
const lc = (s: string) => (s.length > 1 && s[1] === s[1].toUpperCase() && s[1] !== s[1].toLowerCase() ? s : s.charAt(0).toLowerCase() + s.slice(1))
/** 1 проверка / 2 проверки */
const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const list = (xs: readonly (readonly [string, number])[]) => xs.map(([l, n]) => `${lc(l)} — ${n}`).join('; ')

/** Анализът като текст — за доклада пред ПС и за част 1 на следващия план. */
export function analysisText(a: Analysis, o: { yearName: string; period: Period; who?: string }) {
  const y = o.yearName.replace('-', '/')
  const out: string[] = []
  if (!a.total) return [`През ${PERIOD_LABEL[o.period]} ${y} г. няма подписани констативни протоколи${o.who ? ` (${o.who})` : ''}.`]
  out.push(`През ${PERIOD_LABEL[o.period]} ${y} г. ${o.who ? `${o.who} ` : ''}${a.total === 1 ? 'е извършена 1 проверка, отразена в констативен протокол и вписана' : `са извършени ${a.total} проверки, отразени в констативни протоколи и вписани`} в Книгата за контролната дейност. Проверени служители: ${a.staff}. По плана: ${a.planned}, извън плана: ${a.total - a.planned}; предварително оповестени: ${a.announced}.`)
  out.push(`По вид: ${list(a.byKind)}. По насоченост: ${list(a.byFocus)}. По форма: ${list(a.byForm)}.`)
  if (a.byInspector.length > 1) out.push(`По проверяващи: ${a.byInspector.map(([l, n]) => `${l} — ${n}`).join('; ')}.`)
  if (a.plan.total) {
    out.push(a.plan.due
      ? `Изпълнение на графика: от ${pl(a.plan.due, 'планирана дейност', 'планирани дейности')} с изтекъл срок изцяло изпълнени — ${a.plan.done} (${pct(a.plan.done, a.plan.due)}%)${a.plan.partial ? `, частично — ${a.plan.partial}` : ''}${a.plan.missed.length ? `, непроведени — ${a.plan.missed.length} (${a.plan.missed.map(i => `${MONTH_LABEL[i.month]}: ${lc(i.subject)}`).join('; ')})` : ''}.`
      : 'Срокът на дейностите от графика още не е изтекъл.')
  }
  if (a.strong.length) out.push(`Силни страни — най-често изпълнени критерии: ${a.strong.map(x => `${lc(x.t)} (${pct(x.high, x.n)}%)`).join('; ')}.`)
  if (a.weak.length) out.push(`Области за подобрение — критерии, оценени като частично или неизпълнени: ${a.weak.map(x => `${lc(x.t)} (${x.low} от ${x.n})`).join('; ')}.`)
  if (a.rec.total) out.push(`Дадени препоръки: ${a.rec.total} — изпълнени — ${a.rec.done}, отчетени и очакващи потвърждение — ${a.rec.reported}, неизпълнени — ${a.rec.notDone}, отворени — ${a.rec.open}${a.rec.overdue ? ` (от тях ${a.rec.overdue} с изтекъл срок)` : ''}. Последващи проверки: ${a.followUps}.`)
  if (a.objections) out.push(`Протоколи с постъпило възражение: ${a.objections}.`)
  const next: string[] = []
  if (a.weak.length) next.push(`да се насочи контролът към ${a.weak.slice(0, 3).map(x => lc(x.t)).join(', ')}`)
  if (a.rec.notDone + a.rec.overdue) next.push('да се проведе последващ контрол по неизпълнените препоръки')
  if (a.plan.missed.length) next.push('да се планират реалистично натоварени месеци, за да няма пропуснати дейности')
  if (next.length) out.push(`Изводи за следващия период: ${next.join('; ')}.`)
  return out
}

