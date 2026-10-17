// Декларации за лекторски над норматив — от отметнатите дати до Word файловете.
// Едно и също за колегата („Над норматив“) и за прегледа на управата („Проверка лекторски“),
// за да е прегледът точно това, което колегата ще изтегли.
//  • над норматив — „По Образец 3“, по заповедта „над норматив“;
//  • ИФО — отделен файл „По Образец 1“, по ИФО заповедта; детето — горе в текста (учител има най-много едно ИФО дете);
//  • логопед — „По Образец 1“, „…за допълнителна подкрепа“, колона „Учебен час“, предмет по учебния план.
// И трите — по месеци: ред-заглавие „Септември“ (годината е в периода горе), под него ред на седмичен слот, в „Дата“ само дните.

import { generateLecturerDeclarations } from './docx-substitution'
export type DeclData = Parameters<typeof generateLecturerDeclarations>[0][number]
import { PERIOD_TIMES } from './periods'

/** validFrom/validTo — срокът на часа от графика (за „в сила от … до …“ до заповедта) */
export type DeclItem = { iso: string; period: number; subject: string; holderType?: string; holderLabel: string; validFrom?: string; validTo?: string }
export type DeclInput = {
  teacherName: string; position: string; periodLabel: string
  orderOver: string; orderIfo: string
  isSpeech?: boolean; rate?: number
  items: DeclItem[]
  /** „_ПРЕГЛЕД“ към името на файла — при прегледа от управата */
  tagSuffix?: string
}

// „9:15–9:50“ → „09:15 – 09:50“ (като в бланката)
export const hourText = (p: number) => (PERIOD_TIMES[p] || `${p}. час`).split('–').map(x => x.padStart(5, '0')).join(' – ')
export const SPEECH_SUBJECT = 'Рехабилитация на комуникативните нарушения'

/** „за периода септември – октомври 2026 година“ — само месеците, без датите */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function declPeriodLabel(label: string, _from?: string, _to?: string) {
  return label
}

const MONTHS = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']
const DAYS = ['неделя', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота']
const DAYS_SHORT = ['нед', 'пон', 'вт', 'ср', 'чет', 'пет', 'съб']
const pad = (n: number) => String(n).padStart(2, '0')
const dowOf = (iso: string) => new Date(iso + 'T00:00').getDay()
const slotTime = (p: number) => hourText(p).replace(' – ', '–')

/** time — учебният час („13:30–14:05“, блок „13:30–14:45 (2)“); valid — срокът на часа от графика */
type Row = { iso: string; date: string; group: string; subject: string; hours: number; heading?: string; time?: string; valid?: string }
/** dow/period — за сливане на поредни часове (блок от 2 часа) в един ред */
type Slot = { key: string; sort: string; group: string; subject: string; prefix: string; dow?: number; period?: number; time?: string; valid?: string }

/**
 * По месеци: ред-заглавие за месеца, под него ред на слот с дните от месеца („21, 28“) и часовете.
 * joinBlocks — поредни часове в един ден със същия предмет и същите дати стават един ред
 * („13:25–14:40“), часовете се сумират.
 */
function monthly(list: DeclItem[], slotOf: (it: DeclItem) => Slot, joinBlocks = false): Row[] {
  const months = Array.from(new Set(list.map(r => r.iso.slice(0, 7)))).sort()
  return months.flatMap(ym => {
    const by: Record<string, Slot & { dates: string[]; hours: number }> = {}
    list.filter(r => r.iso.startsWith(ym)).forEach(r => {
      const s = slotOf(r)
      const g = (by[s.key] ||= { ...s, dates: [], hours: 0 })
      g.dates.push(r.iso); g.hours++
    })
    const slots = Object.values(by)
      .map(g => ({ ...g, dates: Array.from(new Set(g.dates)).sort() }))
      .sort((a, b) => a.sort.localeCompare(b.sort, 'bg', { numeric: true }))
    // блок от поредни часове → един ред, часовете се сумират
    const out: (typeof slots[number] & { last?: number; span?: number })[] = []
    slots.forEach(g => {
      const p = out[out.length - 1]
      if (joinBlocks && p && p.dow === g.dow && p.subject === g.subject && p.group === g.group && p.valid === g.valid
          && p.last !== undefined && g.period === p.last + 1 && p.dates.join() === g.dates.join() && p.time && g.time) {
        p.span = (p.span || 1) + 1
        p.time = `${p.time.split('–')[0]}–${g.time.split('–')[1].split(' ')[0]} (${p.span})`
        p.hours += g.hours; p.last = g.period
      } else out.push({ ...g, last: g.period })
    })
    const m = MONTHS[Number(ym.slice(5, 7)) - 1]
    const head: Row = { iso: `${ym}-00`, date: '', group: '', subject: '', hours: 0, heading: `${m[0].toUpperCase()}${m.slice(1)}` }
    // един месец (от ноември нататък) — месецът е в периода горе, ред-заглавие не трябва
    return [...(months.length > 1 ? [head] : []), ...out.map(g => ({
      iso: g.dates[0], date: g.prefix + g.dates.map(x => String(Number(x.slice(8, 10)))).join(', '),
      // ИФО и логопед: колоната „Учебен час“ е самият час (group празно); над норматив — отделна колона
      group: g.group || g.time || '', time: g.group ? g.time : undefined, subject: g.subject, hours: g.hours, valid: g.valid,
    }))]
  })
}

const dmy = (iso: string) => iso.split('-').reverse().join('.')
/** срокът на часа от графика — „15.09.2026 – 23.12.2026“ (в таблицата, в курсив под предмета) */
const validOf = (it: DeclItem) => (it.validFrom && it.validTo ? `${dmy(it.validFrom)} – ${dmy(it.validTo)}` : '')

/** Тегли една или две декларации; връща колко часа влязоха във всяка */
export async function downloadLecturerDeclarations(d: DeclInput): Promise<{ over: number; ifo: number }> {
  const b = buildLecturerDecls(d)
  await generateLecturerDeclarations(b.docs, `декларация_${b.kinds}${d.tagSuffix || ''}_${d.teacherName.replace(/\s+/g, '_')}.docx`)
  return { over: b.over, ifo: b.ifo }
}

/** Данните за декларациите над норматив / ИФО / логопед — без да тегли файл (за общия файл „всички мои декларации“) */
export function buildLecturerDecls(d: DeclInput): { docs: DeclData[]; over: number; ifo: number; kinds: string } {
  const overItems = d.items.filter(it => it.holderType !== 'ifo')
  const ifoItems = d.items.filter(it => it.holderType === 'ifo')
  const tag = d.tagSuffix || ''
  // над норматив и ИФО — в ЕДИН файл, всяка на своя страница (браузърът не се стряска от два файла)
  const docs: DeclData[] = []

  if (overItems.length) {
    const rows = d.isSpeech
      // логопед: „понеделник / 09:15–09:50“, предметът по учебния план
      ? monthly(overItems, it => {
          const dw = dowOf(it.iso)
          const v = validOf(it)
          return { key: `${dw}|${it.period}|${v}`, sort: `${dw}|${pad(it.period)}|${v}`, group: '', time: slotTime(it.period), dow: dw, period: it.period, valid: v,
            subject: !it.subject || it.subject === 'Терапия' ? SPEECH_SUBJECT : it.subject, prefix: `${DAYS[dw]}\n` }
        }, true)
      // над норматив: паралелка → предмет → ден → учебен час; в „Дата“ „чет: 17, 24“; поредните часове — блок
      : monthly(overItems, it => {
          const dw = dowOf(it.iso), v = validOf(it)
          return { key: `${it.holderLabel}|${it.subject}|${dw}|${it.period}|${v}`, sort: `${it.holderLabel}|${it.subject}|${v}|${dw}|${pad(it.period)}`,
            group: it.holderLabel, subject: it.subject, time: slotTime(it.period), dow: dw, period: it.period, valid: v, prefix: `${DAYS_SHORT[dw]}: ` }
        }, true)
    // логопед: ако предметът е един (обикновено „Рехабилитация на комуникативните нарушения“) — той е в текста, колоната отпада
    const speechSubjects = Array.from(new Set(rows.filter(r => !r.heading).map(r => r.subject)))
    const oneSubject = d.isSpeech && speechSubjects.length === 1 ? speechSubjects[0] : ''
    docs.push({
      teacherName: d.teacherName, position: d.position, periodLabel: d.periodLabel, orderRef: d.orderOver,
      rows, totalHours: overItems.length, rate: d.rate,
      ...(d.isSpeech
        ? { form: 'По Образец 1', groupHeader: 'Учебен час', layout: 'speech' as const, fileTag: `лекторски${tag}`,
            workNote: ' за допълнителна подкрепа', speechSubject: oneSubject ? oneSubject.toLowerCase() : undefined, noSubject: !!oneSubject }
        : { fileTag: `лекторски${tag}` }),
    })
  }

  if (ifoItems.length) {
    // детето — горе в текста (учител има най-много едно ИФО дете)
    const student = Array.from(new Set(ifoItems.map(it => it.holderLabel.replace(/^ИФО\s*/, '').trim()).filter(Boolean))).join(', ')
    const rows = monthly(ifoItems, it => {
      const dw = dowOf(it.iso)
      const v = validOf(it)
      return { key: `${dw}|${it.period}|${it.subject}|${v}`, sort: `${dw}|${pad(it.period)}|${it.subject}|${v}`, dow: dw, period: it.period,
        group: '', time: slotTime(it.period), subject: it.subject, valid: v, prefix: `${DAYS[dw]}\n` }
    }, true)
    docs.push({
      teacherName: d.teacherName, position: d.position, periodLabel: d.periodLabel, orderRef: d.orderIfo,
      rows, totalHours: ifoItems.length, rate: d.rate, form: 'По Образец 1', fileTag: `ИФО${tag}`, layout: 'ifo',
      groupHeader: 'Учебен час', ifoStudent: student,
    })
  }
  const kinds = [overItems.length ? 'лекторски' : '', ifoItems.length ? 'ИФО' : ''].filter(Boolean).join('_и_')
  return { docs, over: overItems.length, ifo: ifoItems.length, kinds }
}
