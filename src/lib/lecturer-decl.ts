// Декларации за лекторски над норматив — от отметнатите дати до Word файловете.
// Едно и също за колегата („Над норматив“) и за прегледа на управата („Проверка лекторски“),
// за да е прегледът точно това, което колегата ще изтегли.
//  • над норматив — „По Образец 3“, по заповедта „над норматив“;
//  • ИФО — отделен файл „По Образец 1“, по ИФО заповедта; детето — горе в текста (учител има най-много едно ИФО дете);
//  • логопед — „По Образец 1“, „…за допълнителна подкрепа“, колона „Учебен час“, предмет по учебния план.
// И трите — по месеци: ред-заглавие „Септември“ (годината е в периода горе), под него ред на седмичен слот, в „Дата“ само дните.

import { generateLecturerDeclarations } from './docx-substitution'
type DeclData = Parameters<typeof generateLecturerDeclarations>[0][number]
import { PERIOD_TIMES } from './periods'

export type DeclItem = { iso: string; period: number; subject: string; holderType?: string; holderLabel: string }
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

type Row = { iso: string; date: string; group: string; subject: string; hours: number; heading?: string }
/** dow/period — за сливане на поредни часове (блок от 2 часа) в един ред */
type Slot = { key: string; sort: string; group: string; subject: string; prefix: string; dow?: number; period?: number }

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
    const out: (typeof slots[number] & { last?: number })[] = []
    slots.forEach(g => {
      const p = out[out.length - 1]
      if (joinBlocks && p && p.dow === g.dow && p.subject === g.subject && p.last !== undefined && g.period === p.last + 1
          && p.dates.join() === g.dates.join()) {
        p.group = `${p.group.split('–')[0]}–${g.group.split('–')[1]}`
        p.hours += g.hours; p.last = g.period
      } else out.push({ ...g, last: g.period })
    })
    const m = MONTHS[Number(ym.slice(5, 7)) - 1]
    const head: Row = { iso: `${ym}-00`, date: '', group: '', subject: '', hours: 0, heading: `${m[0].toUpperCase()}${m.slice(1)}` }
    return [head, ...out.map(g => ({
      iso: g.dates[0], date: g.prefix + g.dates.map(x => String(Number(x.slice(8, 10)))).join(', '), group: g.group, subject: g.subject, hours: g.hours,
    }))]
  })
}

/** Тегли една или две декларации; връща колко часа влязоха във всяка */
export async function downloadLecturerDeclarations(d: DeclInput): Promise<{ over: number; ifo: number }> {
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
          return { key: `${dw}|${it.period}`, sort: `${dw}|${pad(it.period)}`, group: slotTime(it.period), dow: dw, period: it.period,
            subject: !it.subject || it.subject === 'Терапия' ? SPEECH_SUBJECT : it.subject, prefix: `${DAYS[dw]}\n` }
        }, true)
      // над норматив: паралелка → предмет → ден от седмицата; в „Дата“ „чет: 17, 24“
      : monthly(overItems, it => {
          const dw = dowOf(it.iso)
          return { key: `${it.holderLabel}|${it.subject}|${dw}`, sort: `${it.holderLabel}|${it.subject}|${dw}`,
            group: it.holderLabel, subject: it.subject, prefix: `${DAYS_SHORT[dw]}: ` }
        })
    docs.push({
      teacherName: d.teacherName, position: d.position, periodLabel: d.periodLabel, orderRef: d.orderOver,
      rows, totalHours: overItems.length, rate: d.rate,
      ...(d.isSpeech
        ? { form: 'По Образец 1', groupHeader: 'Учебен час', workNote: ' за допълнителна подкрепа', layout: 'speech' as const, fileTag: `лекторски${tag}` }
        : { fileTag: `лекторски${tag}` }),
    })
  }

  if (ifoItems.length) {
    // детето — горе в текста (учител има най-много едно ИФО дете)
    const student = Array.from(new Set(ifoItems.map(it => it.holderLabel.replace(/^ИФО\s*/, '').trim()).filter(Boolean))).join(', ')
    const rows = monthly(ifoItems, it => {
      const dw = dowOf(it.iso)
      return { key: `${dw}|${it.period}|${it.subject}`, sort: `${dw}|${pad(it.period)}|${it.subject}`, dow: dw, period: it.period,
        group: slotTime(it.period), subject: it.subject, prefix: `${DAYS[dw]}\n` }
    }, true)
    docs.push({
      teacherName: d.teacherName, position: d.position, periodLabel: d.periodLabel, orderRef: d.orderIfo,
      rows, totalHours: ifoItems.length, rate: d.rate, form: 'По Образец 1', fileTag: `ИФО${tag}`, layout: 'ifo',
      groupHeader: 'Учебен час', ifoStudent: student,
    })
  }
  const kinds = [overItems.length ? 'лекторски' : '', ifoItems.length ? 'ИФО' : ''].filter(Boolean).join('_и_')
  await generateLecturerDeclarations(docs, `декларация_${kinds}${tag}_${d.teacherName.replace(/\s+/g, '_')}.docx`)
  return { over: overItems.length, ifo: ifoItems.length }
}
