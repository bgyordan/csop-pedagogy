import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, ImageRun,
  Tab, TabStopType, LeaderType, VerticalAlign, TableLayoutType, LineRuleType, HeightRule, VerticalMergeType,
} from 'docx'
import { CSOP_LOGO_B64 } from './docx-generator'
import { saveAs } from 'file-saver'
import { formatDate } from './utils'
import { PERIOD_LABEL, PERIOD_TIMES, byStartTime } from './periods'
import { DEFAULT_RATES } from '@/lib/lecturer-rates'

function bold(text: string, size = 22): TextRun { return new TextRun({ text, bold: true, size }) }
function normal(text: string, size = 22): TextRun { return new TextRun({ text, size }) }
// ═══ ХЕДЪР (лого вляво + текст) ═══
export function header(): any[] {
  const noB = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
      columnWidths: [1100, 8500],
      rows: [ new TableRow({ children: [
        new TableCell({ borders: noB, verticalAlign: 'center', children: [
          new Paragraph({ children: [new ImageRun({ data: Uint8Array.from(atob(CSOP_LOGO_B64), c => c.charCodeAt(0)), transformation: { width: 60, height: 60 }, type: 'jpg' })] }),
        ] }),
        new TableCell({ borders: noB, verticalAlign: 'center', children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Център за специална образователна подкрепа – гр. Варна', bold: true, size: 24 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ул. „Петко Стайнов" №7, гр. Варна', size: 20, italics: true })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'e-mail: info-400052@edu.mon.bg · тел. 052 619 456, 0878 521 823', size: 20, italics: true })] }),
        ] }),
      ] }) ],
    }),
    new Paragraph({ text: '' }),
  ]
}

export interface SubstOrderData {
  orderNumber: string
  orderDate: string
  absentName: string
  absentPosition: string
  substituteName: string
  substitutePosition: string
  className: string
  holderType: 'class' | 'ifo' | 'coud'
  leaveRef: string
  reason: 'vacation' | 'sick' | 'other'
  overNorm: boolean
  isBsch: boolean
  dateFrom: string
  dateTo: string
  zdudName: string
  yearName: string
  days: { date: string; items: { period: number; subject: string; cls: string }[] }[]
  substitutes?: { name: string; position: string; from: string; to: string; overNorm: boolean; periods?: number[] | null }[]
  npSplit?: { npFrom: string; npTo: string; budgetFrom: string; budgetTo: string } | null
  /** отпуск по няколко члена от КТ: дните по НП и дните от бюджета (непрекъснати периоди) */
  funding?: { np: { from: string; to: string }[]; budget: { from: string; to: string }[] } | null
  rate?: number   // € за учебен час на заместника (lecturer_rates) — влиза в т. 3 на заповедта
  noHours?: boolean   // разписанието на отсъстващия още не е пълно → заповед без часове и таблица
}

// „12.10.2026 – 13.10.2026 и 15.10.2026“ — периодите на финансирането в заповедта
function rangesText(rs: { from: string; to: string }[]) {
  return rs.map(r => r.from === r.to ? formatDate(r.from) : `${formatDate(r.from)} – ${formatDate(r.to)}`).join(' и ')
}

// Матрица на седмичното разписание: дни (Пн-Пт) колони, часове редове.
// Преизползваем блок — при няколко заместника се вика за всеки.
// Таблица с часовете. Кратко (≤4 работни дни) → колони = конкретните дати.
// Дълго (≥5) → пълна седмична матрица Пон-Пет + "часа седмично".
// И двата с ред "Общо за деня". Преизползваем блок (за всеки заместник).
function scheduleMatrix(days: { date: string; items: { period: number; subject: string; cls: string }[] }[]): any[] {
  const B = { style: BorderStyle.SINGLE, size: 4, color: '595959' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const th = (t: string) => new TableCell({ borders: CELLS, shading: { type: ShadingType.CLEAR, fill: 'EEEEEE' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(t, 19)] })] })
  const td = (t: string, center = true, bold_ = false) => new TableCell({ borders: CELLS, children: [new Paragraph({ alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [bold_ ? bold(t, 19) : normal(t, 19)] })] })
  const DOW_SHORT = ['', 'Пон', 'Вт', 'Ср', 'Чет', 'Пет']
  const DOW_FULL = ['', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък']
  const dowOf = (dstr: string) => { const [dd, mm, yy] = dstr.split('.').map(Number); return new Date(yy, mm - 1, dd).getDay() }
  const workdays = days.filter(d => { const w = dowOf(d.date); return w >= 1 && w <= 5 })

  // всички реално срещани часове, подредени по начален час (1–7 сутрин, ИФО 8–12, ЦОУД 21–26)
  const periods = Array.from(new Set(workdays.flatMap(d => d.items.map(it => it.period)))).sort(byStartTime)
  // надпис на реда: „1.“ за сутрешен час; „ИФО 1 (12:50–13:25)“ / „ЦОУД 1 (12:25–13:00)“ за следобедните
  const rowLabel = (p: number) => p <= 7 ? `${p}.` : `${PERIOD_LABEL[p] || p} (${PERIOD_TIMES[p] || ''})`

  const out: any[] = []
  const SHORT = workdays.length <= 4

  if (SHORT) {
    // колони = конкретните дати
    const cols = workdays
    const head = [th('Уч. час'), ...cols.map(c => th(`${DOW_FULL[dowOf(c.date)]}\n(${c.date.slice(0, 5)})`))]
    const rows: TableRow[] = [new TableRow({ children: head })]
    const usedPeriods = periods.filter(p => cols.some(c => c.items.some(it => it.period === p)))
    usedPeriods.forEach(p => {
      const cells = [td(rowLabel(p), true, true)]
      cols.forEach(c => { const it = c.items.find(x => x.period === p); cells.push(td(it ? (it.subject || '—') : '—')) })
      rows.push(new TableRow({ children: cells }))
    })
    // ред "Общо за деня"
    const totalCells = [td('Общо:', true, true)]
    cols.forEach(c => totalCells.push(td(`${c.items.length} ч.`, true, true)))
    rows.push(new TableRow({ children: totalCells }))
    out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
  } else {
    // пълна седмична матрица Пон-Пет (шаблон); клетка = първата среща на предмет за този ден+час
    const grid: Record<number, Record<number, string>> = {}
    const dayCount: Record<number, number> = {}
    workdays.forEach(d => {
      const col = dowOf(d.date) // 1..5
      d.items.forEach(it => { if (!grid[it.period]) grid[it.period] = {}; grid[it.period][col] = it.subject || '—' })
    })
    // общо за типичен ден от седмицата — вземаме макс срещан брой за деня
    for (let c = 1; c <= 5; c++) {
      const perDay = workdays.filter(d => dowOf(d.date) === c)
      dayCount[c] = perDay.length ? Math.max(...perDay.map(d => d.items.length)) : 0
    }
    const usedPeriods = periods.filter(p => grid[p])
    const rows: TableRow[] = [new TableRow({ children: [th('Уч. час'), th('Пон'), th('Вт'), th('Ср'), th('Чет'), th('Пет')] })]
    usedPeriods.forEach(p => {
      const cells = [td(rowLabel(p), true, true)]
      for (let c = 1; c <= 5; c++) cells.push(td(grid[p]?.[c] || '—'))
      rows.push(new TableRow({ children: cells }))
    })
    const totalCells = [td('Общо:', true, true)]
    for (let c = 1; c <= 5; c++) totalCells.push(td(`${dayCount[c]} ч.`, true, true))
    rows.push(new TableRow({ children: totalCells }))
    out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [1000, 1720, 1720, 1720, 1720, 1720], rows }))
    const weekTotal = Object.values(dayCount).reduce((a, b) => a + b, 0)
    out.push(new Paragraph({ spacing: { before: 60 }, children: [normal(`Общ брой часове за една пълна работна седмица съгласно разписанието: ${weekTotal} учебни часа.`, 20)] }))
  }
  return out
}
// „за периода 05.10 – 09.10“ / „за 07.10.2026“ + часовете, ако заместването е по часове
function sbWhen(sb: { from: string; to: string; periods?: number[] | null }) {
  const when = sb.from === sb.to ? `за ${formatDate(sb.from)}` : `за периода ${formatDate(sb.from)} – ${formatDate(sb.to)}`
  if (!sb.periods || !sb.periods.length) return when
  const ps = [...sb.periods].sort((a, b) => a - b).map(p => `${PERIOD_LABEL[p] ?? p}${p <= 7 ? '.' : ''}`)
  return `${when}, ${ps.join(', ')}${sb.periods.every(p => p <= 7) ? ' час' : ''}`
}
export async function generateSubstitutionOrder(d: SubstOrderData) {
  const children: any[] = []
  header().forEach(p => children.push(p))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('ЗАПОВЕД', 28)], spacing: { before: 120, after: 60 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal(`№ ${d.orderNumber}`, 22)], spacing: { after: 160 } }))

  const df = formatDate(d.dateFrom), dt = formatDate(d.dateTo)
  const reasonWord = d.reason === 'sick' ? 'отсъствие поради болничен отпуск' : 'отсъствие поради отпуск'

  const baseText = d.overNorm
    ? 'На основание чл. 259, ал. 1 от Закона за предучилищното и училищното образование, във връзка с чл. 110 от Кодекса на труда и чл. 5, ал. 2 от Наредбата за финансиране на институциите в системата на предучилищното и училищното образование, във връзка '
    : 'На основание чл. 259, ал. 1 от Закона за предучилищното и училищното образование, във връзка с чл. 259, ал. 1 от Кодекса на труда и чл. 5 от Наредбата за финансиране на институциите в системата на предучилищното и училищното образование, във връзка '
  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [
    normal(baseText, 22), normal(/^[сСзЗ]/.test(d.leaveRef) ? 'с ' : 'със ', 22), bold(d.leaveRef, 22),
    normal(` за ${reasonWord} на титуляра `, 22),
    bold(`${d.absentName}${d.absentPosition ? ' – ' + d.absentPosition : ''}`, 22),
    normal(',', 22),
  ] }))

  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('ВЪЗЛАГАМ:', 24)], spacing: { after: 120 } }))

  const isEducator = /възпитател|цоуд/i.test(d.absentPosition || '')
  const holderWord = d.holderType === 'coud' || isEducator ? 'група ЦОУД' : 'паралелка'
  const normPhraseFor = (on: boolean) => on ? 'извън времето на задължителната норма преподавателска заетост' : 'в рамките на задължителната норма преподавателска заетост'
  const holderTail = d.noHours
    ? (isEducator ? 'да замества отсъстващия титуляр в група ЦОУД' : 'да замества отсъстващия титуляр в неговите часове')
    : d.holderType === 'ifo'
    ? `да замества отсъстващия титуляр в часовете с ${d.className || '…………'} по утвърдено седмично разписание`
    : /ЦОУД|група|паралелка/i.test(d.className || '')
      ? `да замества отсъстващия титуляр в ${d.className}`
      : `да замества отсъстващия титуляр в ${holderWord} № ${d.className || '…………'}`

  const multi = d.substitutes && d.substitutes.length > 0
  if (multi) {
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 40 }, children: [
      normal(`1. Заместването на отсъстващия титуляр, ${holderTail}, се възлага, както следва:`, 22),
    ] }))
    d.substitutes!.forEach((sb, i) => {
      children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 40 }, indent: { left: 400 }, children: [
        normal(`${i + 1}) ${sbWhen(sb)}: `, 22),
        bold(sb.name, 22),
        normal(`, на длъжност ${sb.position || 'учител'}, ${normPhraseFor(sb.overNorm)};`, 22),
      ] }))
    })
  } else {
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: [
      normal('1. На ', 22), bold(d.substituteName, 22),
      normal(`, на длъжност ${d.substitutePosition || 'учител'}, ${holderTail}, ${normPhraseFor(d.overNorm)}.`, 22),
    ] }))
  }

  if (d.noHours) {
    // Разписанието още не е пълно → без брой часове и без таблица
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: [
      normal('2. Заместването да се извърши за периода от ', 22),
      bold(df, 22), normal(' до ', 22), bold(dt, 22),
      normal(' включително, съгласно седмичното разписание на отсъстващия титуляр.', 22),
    ] }))
  } else {
  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: [
    normal('2. Заместването да се извърши за периода от ', 22),
    bold(df, 22), normal(' до ', 22), bold(dt, 22),
    normal(' включително, общо ', 22), bold(`${d.days.reduce((a, x) => a + x.items.length, 0)} учебни часа`, 22),
    normal(', съгласно утвърденото седмично разписание на отсъстващия титуляр:', 22),
  ] }))
  }

  // Матрица (при няколко заместника — по една на всеки с неговия под-период)
  if (d.noHours) {
    // без таблица
  } else if (multi) {
    d.substitutes!.forEach(sb => {
      // сравняваме като ISO текст — с Date() първият ден на всеки заместник изпадаше (UTC срещу местно време)
      const sbDays = d.days.filter(day => {
        const iso = day.date.split('.').reverse().join('-')
        return iso >= sb.from && iso <= sb.to
      }).map(day => sb.periods ? { ...day, items: day.items.filter(it => sb.periods!.includes(it.period)) } : day)
      children.push(new Paragraph({ spacing: { before: 80, after: 40 }, children: [bold(`${sb.name} (${sbWhen(sb)}):`, 20)] }))
      children.push(...scheduleMatrix(sbDays))
    })
  } else {
    children.push(new Paragraph({ text: '', spacing: { after: 40 } }))
    children.push(...scheduleMatrix(d.days))
  }
  children.push(new Paragraph({ text: '', spacing: { after: 120 } }))

  const P = (t: string) => children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: [normal(t, 22)] }))

  let n = 3
  if (d.overNorm) {
    P(d.rate && d.rate > 0
      ? `3. Проведените часове по заместването да се изплатят на заместващия педагогически специалист като лекторски часове в размер на ${d.rate.toFixed(2).replace('.', ',')} евро за един учебен час.`
      : '3. Проведените часове по заместването да се изплатят на заместващия педагогически специалист като лекторски часове.')
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: [
      normal('4. Източник на финансиране: ', 22),
      ...(d.isBsch && d.funding
        ? [bold('Национална програма „Без свободен час", Модул 1', 22),
           normal(` – за ${rangesText(d.funding.np)}; `, 22),
           bold('бюджет на ЦСОП (собствени средства)', 22),
           normal(` – за ${rangesText(d.funding.budget)}.`, 22)]
        : d.isBsch && d.npSplit
        ? [bold('Национална програма „Без свободен час", Модул 1', 22),
           normal(` – за ${formatDate(d.npSplit.npFrom)} – ${formatDate(d.npSplit.npTo)} (първите два работни дни от временната неработоспособност); `, 22),
           bold('бюджет на ЦСОП (собствени средства)', 22),
           normal(` – за ${formatDate(d.npSplit.budgetFrom)} – ${formatDate(d.npSplit.budgetTo)}.`, 22)]
        : [bold(d.isBsch ? 'Национална програма „Без свободен час", Модул 1.' : 'бюджет на ЦСОП (собствени средства).', 22)]),
    ] }))
    P('5. Отчитането да се извърши в края на месеца въз основа на данните в електронния дневник и представена справка-декларация. Възнаграждението да се изплати съгласно ВПРЗ на Центъра.')
    n = 5
  } else {
    P('3. Заместването се извършва в рамките на установеното работно време на заместващия педагогически специалист, без допълнително заплащане.')
    n = 3
  }
  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160 }, children: [
    normal(`${n + 1}. Контрол по изпълнението на заповедта възлагам на `, 22), bold(d.zdudName || '…………………', 22),
    normal(', заместник-директор.', 22),
  ] }))

  const dutyName = multi ? 'заместващите учители' : d.substituteName
  children.push(new Paragraph({ spacing: { after: 60 }, children: [bold(`Задълженията на ${dutyName} са:`, 22)] }))
  P('1. Работи с поверените ученици;')
  P('2. Води задължителната учебна документация;')
  P('3. Планира, организира и провежда образователно-възпитателния процес с използването на подходящи методи и средства;')
  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 }, children: [normal('4. Носи отговорност за опазване живота и здравето на учениците.', 22)] }))

  children.push(new Paragraph({ children: [normal('Настоящата заповед да се връчи на лицето и на счетоводството за сведение и изпълнение.', 22)], spacing: { after: 300 } }))
  children.push(new Paragraph({ children: [bold('ДИРЕКТОР ЦСОП: ', 22), normal('.............................', 22)] }))
  children.push(new Paragraph({ children: [normal('/ Светлана Иванова /', 20)] }))
  children.push(new Paragraph({ children: [normal('(подпис и печат)', 18)], spacing: { before: 40, after: 240 } }))

  children.push(new Paragraph({ children: [bold('Запознати:', 22)], spacing: { after: 80 } }))
  if (multi) {
    // всеки заместник веднъж (при заместване по часове един човек има няколко реда)
    const names = Array.from(new Set(d.substitutes!.map(sb => sb.name)))
    names.forEach((nm, i) => children.push(new Paragraph({ spacing: { after: 60 }, children: [normal(`${i + 1}. ${nm} – заместващ     ..............................`, 22)] })))
    const k = names.length + 1
    children.push(new Paragraph({ children: [normal(`${k}. ${d.zdudName || '…………………'} – заместник-директор     ..............................`, 22)] }))
  } else {
    children.push(new Paragraph({ spacing: { after: 60 }, children: [normal(`1. ${d.substituteName} – заместващ     ..............................`, 22)] }))
    children.push(new Paragraph({ children: [normal(`2. ${d.zdudName || '…………………'} – заместник-директор     ..............................`, 22)] }))
  }

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `заповед_заместване_${d.orderNumber.replace(/[^0-9]/g, '_')}.docx`)
}
// ═══ СПРАВКА-ДЕКЛАРАЦИЯ (Приложение 2, НП "Без свободен час") ═══
export interface SubstDeclData {
  substituteName: string       // заместник (декларатор)
  substitutePosition: string
  absentName: string           // отсъстващ титуляр
  orderRef: string             // "Заповед № 045/…"
  periodFrom: string           // ISO
  periodTo: string             // ISO
  yearName: string
  // редове: { date, orderRef, cls, hours }  (тема остава празна за ръчно)
  rows: { date: string; cls: string; hours: number }[]
  totalHours: number
}

export async function generateSubstitutionDeclaration(d: SubstDeclData) {
  const children: any[] = []
  const dots = (n: number) => '.'.repeat(n)

  // Приложение № 2 — горе вдясно, курсив
  children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Приложение № 2', italics: true, size: 20 })] }))
  children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Справка - декларация по Модул 1 и Модул 2', italics: true, size: 20 })] }))
  children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Образец', italics: true, size: 20 })], spacing: { after: 200 } }))

  // Шапка — попълнена с данните на ЦСОП, с вида на образеца
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('Център за специална образователна подкрепа', 22)] }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '( детска градина/училище/ЦСОП/ЦПЛР)', italics: true, size: 20 })], spacing: { after: 120 } }))
  children.push(new Paragraph({ children: [normal('ПК 9000, гр. Варна, община Варна, област Варна', 22)], spacing: { after: 40 } }))
  children.push(new Paragraph({ children: [normal('ул. „Петко Стайнов" № 7, тел.: 052 619 456, e-mail: info-400052@edu.mon.bg', 22)], spacing: { after: 240 } }))

  // Заглавие с разредка
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'С П Р А В К А   –   Д Е К Л А Р А Ц И Я', bold: true, size: 26 })], spacing: { after: 40 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal('за възнаграждение на учител за реално взетите учебни/астрономически часове', 20)], spacing: { after: 20 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal('по Националната програма „Без свободен час" за 2026 г.,', 20)], spacing: { after: 20 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal('модул „Без свободен час в ........................ "', 20)], spacing: { after: 240 } }))

  // Долуподписаният / длъжност / институция — три реда с курсив-пояснения
  children.push(new Paragraph({ children: [normal('Долуподписаният (ата) ', 22), bold(d.substituteName, 22), normal(' ' + dots(30), 22)], spacing: { after: 20 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(име, презиме, фамилия)', italics: true, size: 20 })], spacing: { after: 80 } }))
  children.push(new Paragraph({ children: [normal('заемащ (а) длъжността ', 22), bold(d.substitutePosition || 'учител', 22), normal(' ' + dots(25), 22)], spacing: { after: 20 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(наименование на длъжността)', italics: true, size: 20 })], spacing: { after: 80 } }))
  children.push(new Paragraph({ children: [normal('в Център за специална образователна подкрепа – гр. Варна', 22)], spacing: { after: 20 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(училище/ЦСОП/ДГ/ЦПЛР)', italics: true, size: 20 })], spacing: { after: 200 } }))

  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Д Е К Л А Р И Р А М ,', bold: true, size: 24 })], spacing: { after: 160 } }))

  const pf = formatDate(d.periodFrom), pt = formatDate(d.periodTo)
  children.push(new Paragraph({ children: [
    normal(`че за периода от ${pf} до ${pt} действително съм провел/а следните учебни/астрономически часове като заместващ/а на отсъстващ учител `, 22),
    bold(d.absentName, 22), normal(':', 22),
  ], spacing: { after: 160 } }))

  const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const th = (t: string) => new TableCell({ borders: CELLS, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(t, 20)] })] })
  const td = (t: string, c = false) => new TableCell({ borders: CELLS, children: [new Paragraph({ alignment: c ? AlignmentType.CENTER : AlignmentType.LEFT, children: [normal(t, 20)] })] })
  const rows: TableRow[] = [ new TableRow({ children: [
    th('Дата'), th('Заповед №… от…  Договор №… от…'), th('Клас'), th('Тема от учебното/образователното съдържание'), th('Брой часове'), th('Име на отсъстващия учител'),
  ] }) ]
  d.rows.forEach(r => {
    rows.push(new TableRow({ children: [
      td(r.date, true), td(d.orderRef), td(r.cls, true), td(''), td(String(r.hours), true), td(d.absentName),
    ] }))
  })
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [1100, 1900, 800, 3000, 900, 2100], rows }))
  children.push(new Paragraph({ text: '', spacing: { after: 160 } }))

  children.push(new Paragraph({ children: [
    normal('Общ брой учебни/астрономически часове: ', 22), bold(String(d.totalHours), 22),
    normal(' х ................ лв. = ........................ лв.', 22),
  ], spacing: { after: 40 } }))
  children.push(new Paragraph({ children: [normal(dots(90), 20)], spacing: { after: 10 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(цифром, словом)', italics: true, size: 20 })], spacing: { after: 200 } }))

  children.push(new Paragraph({ children: [normal('Темите на преподаденото учебно/образователно съдържание са вписани в дневника на класа/групата.', 20)], spacing: { after: 80 } }))
  children.push(new Paragraph({ children: [normal('Известно ми е, че при деклариране на неверни данни в настоящата декларация, нося отговорност съгласно законите на Република България.', 20)], spacing: { after: 300 } }))

  children.push(new Paragraph({ children: [normal('Декларатор: ' + dots(50), 22)], spacing: { after: 10 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(личен подпис)                    (дата)', italics: true, size: 20 })], spacing: { after: 200 } }))
  children.push(new Paragraph({ children: [normal('Директор: ' + dots(50), 22)], spacing: { after: 10 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(име, фамилия, подпис, кръгъл печат)          (дата)', italics: true, size: 20 })] }))

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1100, right: 1100 } } }, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `справка_декларация_НП_${d.substituteName.replace(/\s+/g, '_')}.docx`)
}

// Ред „… часа по X евро на час – … евро“: с ставка — попълнен; без — трите празни реда от образеца
const eurD = (v: number) => v.toFixed(2).replace('.', ',')
// Сума в евро с думи: 56,61 → „петдесет и шест евро и шестдесет и един евроцента“
export function eurWords(v: number) {
  const cents = Math.round(v * 100), e = Math.floor(cents / 100), c = cents % 100
  const UN: Record<'m' | 'n' | 'f', string[]> = {
    m: ['', 'един', 'два', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет'],
    n: ['', 'едно', 'две', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет'],
    f: ['', 'една', 'две', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет'],
  }
  const TEEN = ['десет', 'единадесет', 'дванадесет', 'тринадесет', 'четиринадесет', 'петнадесет', 'шестнадесет', 'седемнадесет', 'осемнадесет', 'деветнадесет']
  const TENS = ['', '', 'двадесет', 'тридесет', 'четиридесет', 'петдесет', 'шестдесет', 'седемдесет', 'осемдесет', 'деветдесет']
  const HUND = ['', 'сто', 'двеста', 'триста', 'четиристотин', 'петстотин', 'шестстотин', 'седемстотин', 'осемстотин', 'деветстотин']
  const parts999 = (n: number, g: 'm' | 'n' | 'f') => {
    const out: string[] = [], h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10
    if (h) out.push(HUND[h])
    if (t === 1) out.push(TEEN[u]); else { if (t) out.push(TENS[t]); if (u) out.push(UN[g][u]) }
    return out
  }
  const join = (p: string[]) => p.length > 1 ? p.slice(0, -1).join(' ') + ' и ' + p[p.length - 1] : p.join('')
  const words = (n: number, g: 'm' | 'n' | 'f') => {
    if (n === 0) return 'нула'
    const th = Math.floor(n / 1000), rest = n % 1000, p: string[] = []
    if (th) p.push(th === 1 ? 'хиляда' : `${join(parts999(th, 'f'))} хиляди`)
    p.push(...parts999(rest, g))
    return join(p)
  }
  let s = `${words(e, 'n')} евро`
  if (c) s += ` и ${words(c, 'm')} ${c === 1 ? 'евроцент' : 'евроцента'}`
  return s
}

// „Математика (2); Социални умения (1)“ → всеки предмет на отделен ред: „Математика - 2“, „Социални умения - 1“
function subjectLines(subject: string): string[] {
  const parts = (subject || '').split(/;\s*/).filter(Boolean)
  if (parts.length <= 1) return [subject || '']
  return parts.map(x => { const m = x.match(/^(.*)\s\((\d+)\)$/); return m ? `${m[1]} - ${m[2]}` : x })
}
function rateLines(total: number, rate: number | undefined, sep: string) {
  if (rate && rate > 0) return [`${total} часа по ${eurD(rate)} евро на час ${sep} ${eurD(total * rate)} евро (${eurWords(total * rate)}).`]
  return ['6,29', '5,16', '4,62'].map(r => `………… часа по ${r} евро на час ${sep} …………………… евро;`)
}

export interface SubstInternalDeclData {
  substituteName: string
  subjectLabel: string
  education: string
  monthName: string
  orderRef: string
  absentName: string
  yearName: string
  rows: { date: string; cls: string; subject: string; hours: number }[]
  totalHours: number
  rate?: number            // ставка €/час (lecturer_rates) — попълва реда; без нея — празните редове по образец
}

export async function generateSubstitutionInternalDecl(d: SubstInternalDeclData) {
  const children: any[] = []
  header().forEach(p => children.push(p))

  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal('По заместване', 20)], spacing: { after: 20 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('Д Е К Л А Р А Ц И Я', 26)], spacing: { after: 160 } }))

  children.push(new Paragraph({ children: [
    normal('Долуподписаният/та ', 22), bold(d.substituteName, 22),
    normal(`, учител по ${d.subjectLabel || '……………'}, образование ${d.education || '……………'}`, 22),
  ], spacing: { after: 120 } }))

  children.push(new Paragraph({ children: [
    bold('ДЕКЛАРИРАМ, ', 22),
    normal(`че за месец ${d.monthName} 2026 година, съм взел/а следните часове над минималната норма задължителна преподавателска работа, съгласно ${d.orderRef} за заместване на отсъстващ учител `, 22),
    bold(d.absentName, 22), normal('.', 22),
  ], spacing: { after: 120 } }))

  const B = { style: BorderStyle.SINGLE, size: 4, color: '595959' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const th = (t: string) => new TableCell({ borders: CELLS, shading: { type: ShadingType.CLEAR, fill: 'EEEEEE' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(t, 20)] })] })
  const td = (t: string, c = false) => new TableCell({ borders: CELLS, children: [new Paragraph({ alignment: c ? AlignmentType.CENTER : AlignmentType.LEFT, children: [normal(t, 20)] })] })
  const rows: TableRow[] = [ new TableRow({ children: [th('№'), th('Дата'), th('Паралелка – клас'), th('Предмет'), th('Брой часове')] }) ]
  d.rows.forEach((r, i) => {
    rows.push(new TableRow({ children: [
      td(String(i + 1), true), td(r.date, true), td(r.cls, true), td(r.subject), td(String(r.hours), true),
    ] }))
  })
  rows.push(new TableRow({ children: [
    new TableCell({ borders: CELLS, columnSpan: 4, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [bold('Всичко:', 20)] })] }),
    td(String(d.totalHours), true),
  ] }))
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [700, 1400, 2400, 3400, 1100], rows }))
  children.push(new Paragraph({ text: '', spacing: { after: 120 } }))

  children.push(new Paragraph({ children: [normal('Общ брой учебни часове: ', 22), bold(String(d.totalHours), 22)], spacing: { after: 80 } }))
  rateLines(d.totalHours, d.rate, '—').forEach(l => children.push(new Paragraph({ children: [normal(l, 22)] })))
  if (!d.rate) children.push(new Paragraph({ children: [normal('/ попълва се от декларатор / учител /', 19)], spacing: { after: 120 } }))
  else children.push(new Paragraph({ text: '', spacing: { after: 120 } }))

  children.push(new Paragraph({ children: [normal('Известно ми е, че при деклариране на неверни данни в настоящата декларация, нося наказателна отговорност съгласно законите на Република България.', 20)], spacing: { after: 200 } }))

  children.push(new Paragraph({ children: [normal('…………………… 2026 година            ДЕКЛАРАТОР: ........................  /подпис/', 22)], spacing: { after: 160 } }))
  children.push(new Paragraph({ children: [normal('Посочените часове са действително проведени и са вписани в дневника на класа.', 20)], spacing: { after: 60 } }))
  children.push(new Paragraph({ children: [normal('Дата: …………… 2026 г.            Проверил: ........................  ЗДУД', 22)], spacing: { after: 160 } }))
  children.push(new Paragraph({ children: [normal('Сумата е проверена, начислена и изплатена по ведомост за месец …………… 2026 г.', 20)], spacing: { after: 60 } }))
  children.push(new Paragraph({ children: [normal('…………………… 2026 година            Счетоводител: ........................', 22)] }))

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 800, right: 800 } } }, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `декларация_вътрешна_${d.substituteName.replace(/\s+/g, '_')}.docx`)
}

// ═══ ДЕКЛАРАЦИЯ ЗА ЛЕКТОРСКИ НАД НОРМАТИВА (По Образец 3) ═══
export interface LecturerDeclData {
  teacherName: string
  position: string         // "Учител/старши учител на ДУИ"
  periodLabel: string      // "01.09 – 31.10" или месец
  orderRef: string         // "Заповед № …"
  /** heading — ред-заглавие през цялата ширина (логопед: „Септември 2026“) */
  /** time — учебният час (над норматив — отделна колона); valid — срокът на часа, в курсив под предмета */
  rows: { date: string; group: string; subject: string; hours: number; heading?: string; time?: string; valid?: string }[]
  totalHours: number
  rate?: number            // ставка €/час (lecturer_rates) — попълва реда; без нея — празните редове по образец
  /** „По Образец 3“ (над норматив, по подразбиране) или „По Образец 1“ (ИФО) */
  form?: string
  fileTag?: string
  /** вид: над норматив (по подразбиране), ИФО или логопед — ширини на колоните и денят към датата */
  layout?: 'over' | 'ifo' | 'speech'
  /** без колона „Предмет“ (логопед с един предмет — той е удебелен в текста, speechSubject) */
  noSubject?: boolean
  /** логопед: предметът — удебелен в текста след workNote („… – рехабилитация на комуникативните нарушения“) */
  speechSubject?: string
  /** ИФО: детето — удебелено в текста („…в индивидуална форма на обучение (ИФО) – Име Фамилия“) */
  ifoStudent?: string
  /** заглавие на 3-тата колона — „Група“ (по подразбиране) или „Учебен час“ (логопеди) */
  groupHeader?: string
  /** след „задължителна преподавателска работа“ — напр. „ за допълнителна подкрепа“ (логопеди) */
  workNote?: string
}

/** Една декларация като раздел (страница) — за общ файл с няколко декларации */
function lecturerDeclSection(d: LecturerDeclData) {
  const children: any[] = []
  const dots = (n: number) => '.'.repeat(n)
  const Y = String(new Date().getFullYear())
  // „септември – октомври (15.09.2026 – 30.10.2026)“ вече носи годината
  const yearPart = /\d{4}/.test(d.periodLabel) ? '' : ` ${Y}`
  const layout = d.layout || 'over'
  // ИФО и логопед — ред на седмичен слот с колона „Учебен час“ (ден / час)
  const slotLayout = layout === 'speech' || layout === 'ifo'
  // ширините: над норматив — тясна „Група“ (само паралелката); ИФО — по-широка (името на детето); логопед — часът
  // над норматив с часа: № | Дата | Учебен час | Група | Предмет | Брой
  const overTime = layout === 'over' && d.rows.some(r => r.time)
  const WIDTHS: Record<string, number[]> = { over: overTime ? [800, 1950, 1650, 1250, 3450, 1000] : [900, 2250, 1050, 4900, 1000], ifo: [800, 2300, 1600, 4400, 1000], speech: [800, 2300, 1600, 4400, 1000] }

  children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: d.form || 'По Образец 3', bold: true, size: 20, underline: {} })], spacing: { after: 120 } }))
  // шапката — само името на ЦСОП
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal('Център за специална образователна подкрепа – гр. Варна', 22)],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } }, spacing: { after: 240 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Д Е К Л А Р А Ц И Я', bold: true, size: 26 })], spacing: { after: 200 } }))

  // встъпителните полета — на един ред; удебелено е само името
  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [
    normal('Долуподписаният (ата) ', 22), bold(d.teacherName, 22),
    normal(`, заемащ (а) длъжността ${d.position || 'Учител/старши учител на ДУИ'} в ЦСОП – гр. Варна,`, 22),
  ], spacing: { after: 120 } }))

  children.push(new Paragraph({ children: [
    bold('ДЕКЛАРИРАМ, че ', 22),
    normal(`за периода ${d.periodLabel}${yearPart} година, съм взел/а следните часове над минималната норма задължителна преподавателска работа${d.workNote || ''}`, 22),
    ...(d.speechSubject ? [normal(' – ', 22), bold(d.speechSubject, 22)] : []),
    ...(d.ifoStudent ? [normal(' в индивидуална форма на обучение (ИФО) – ', 22), bold(d.ifoStudent, 22)] : []),
    normal(`, съгласно ${d.orderRef}`, 22),
  ], spacing: { after: 160 } }))

  const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  // ширините са фиксирани (в DXA) — иначе Word ги разпределя сам и дългите дати изяждат колоната с часа
  // логопед с един предмет — без колона „Предмет“ (предметът е в текста)
  const W = d.noSubject ? [1000, 4800, 2700, 1600] : (WIDTHS[layout] || WIDTHS.over)
  const subjCol = d.noSubject ? -1 : overTime ? 4 : 3, hoursCol = d.noSubject ? 3 : overTime ? 5 : 4
  const wOf = (col: number) => ({ size: W[col], type: WidthType.DXA })
  const th = (t: string, col: number) => new TableCell({ width: wOf(col), borders: CELLS, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(t, 20)] })] })
  const td = (t: string, c = false) => new TableCell({ borders: CELLS, children: [new Paragraph({ alignment: c ? AlignmentType.CENTER : AlignmentType.LEFT, children: [normal(t, 20)] })] })
  const rows: TableRow[] = [ new TableRow({ tableHeader: true, children: overTime
    ? [th('№ по ред', 0), th('Дата', 1), th('Учебен час', 2), th(d.groupHeader || 'Паралелка', 3), th('Предмет', 4), th('Брой часове', 5)]
    : [th('№ по ред', 0), th('Дата', 1), th(d.groupHeader || (layout === 'over' ? 'Паралелка' : 'Група'), 2), ...(subjCol < 0 ? [] : [th('Предмет', subjCol)]), th('Брой часове', hoursCol)] }) ]
  // логопед — само датата (иначе не се събира); над норматив и ИФО — с деня на същия ред
  // еднаквите поредни клетки в „Група“ и „Предмет“ се сливат (предметът — само в рамките на една група)
  // на смяна на предмет/група — по-дебела линия отгоре през реда (без слятата клетка на групата, ако тя продължава)
  // без дебели линии — всички граници еднакво тънки
  const cellB = (_sep: boolean) => CELLS
  // „\n“ в текста — нов ред в клетката (логопед: „понеделник“ / „09:15 – 09:50“)
  const paras = (t: string, c: boolean) => t.split('\n').map(x => new Paragraph({ alignment: c ? AlignmentType.CENTER : AlignmentType.LEFT, children: [normal(x, 20)] }))
  // срокът на часа — малко, в курсив, под текста на клетката
  // ако се побира — на същия ред след текста („Математика  12.10.2026 – 30.06.2027“), иначе на нов ред
  const vRun = (valid: string, lead = '') => new TextRun({ text: lead + valid, italics: true, size: 16, color: '404040' })
  const withValid = (t: string, c: boolean, valid: string | undefined, col: number) => {
    if (!valid) return paras(t, c)
    const lines = t.split('\n'), last = lines[lines.length - 1]
    // ~100 DXA на знак (10 pt), ~80 DXA на знак за срока (8 pt); минус отстъпите в клетката
    const fits = !c && last.length * 100 + (valid.length + 2) * 80 <= W[col] - 160
    if (!fits) return [...paras(t, c), new Paragraph({ alignment: c ? AlignmentType.CENTER : AlignmentType.LEFT, children: [vRun(valid)] })]
    return lines.map((x, i) => new Paragraph({ alignment: AlignmentType.LEFT, children: [normal(x, 20), ...(i === lines.length - 1 ? [vRun(valid, '  ')] : [])] }))
  }
  const cell = (t: string, c: boolean, sep: boolean, col: number, valid?: string) => new TableCell({ width: wOf(col), borders: cellB(sep), verticalAlign: VerticalAlign.CENTER, children: withValid(t, c, valid, col) })
  const merged = (t: string, first: boolean, c: boolean, sep: boolean, col: number, valid?: string) => new TableCell({
    width: wOf(col), borders: cellB(sep), verticalAlign: VerticalAlign.CENTER,
    verticalMerge: first ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE,
    children: first ? withValid(t, c, valid, col) : [new Paragraph({ children: [] })],
  })
  let n = 0
  d.rows.forEach((r, i) => {
    // ред-заглавие (месец) — през цялата ширина; сливането почва наново под него
    if (r.heading) {
      rows.push(new TableRow({ children: [new TableCell({
        width: { size: W.reduce((a, x) => a + x, 0), type: WidthType.DXA }, columnSpan: W.length, borders: cellB(i > 0),
        shading: { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' },
        children: [new Paragraph({ children: [bold(r.heading, 20)] })],
      })] }))
      n = 0   // номерацията почва отначало за всеки месец
      return
    }
    n++
    const prev = d.rows[i - 1]?.heading ? undefined : d.rows[i - 1]
    const newGroup = !prev || prev.group !== r.group
    // логопед: часът се сменя ред по ред, а предметът е един — слива се сам
    // вече форматирана: само дните („понеделник / 21, 28“ / „чет: 17, 24“); без колона „Предмет“ има място — на един ред
    const dt = d.noSubject ? r.date.replace('\n', ': ') : r.date
    if (slotLayout) {
      // ИФО и логопед: денят с датите — една слята клетка за всички часове от този ден; часът е сам на ред;
      // дебела линия на смяна на деня; предметът се слива в рамките на деня (логопедът — за целия месец)
      const newDate = !prev || prev.date !== r.date
      const newSubj = !prev || prev.subject !== r.subject || prev.valid !== r.valid || (layout === 'ifo' && newDate)
      const sepD = !!prev && newDate
      // без колона „Предмет“ (логопед) — срокът е под часа
      rows.push(new TableRow({ children: [
        cell(String(n), true, sepD, 0), merged(dt, newDate, true, sepD, 1), cell(r.group, true, sepD, 2, subjCol < 0 ? r.valid : undefined),
        ...(subjCol < 0 ? [] : [merged(r.subject, newSubj, false, sepD && newSubj, subjCol, r.valid)]), cell(String(r.hours), true, sepD, hoursCol),
      ] }))
      return
    }
    const newSubject = newGroup || prev!.subject !== r.subject || prev!.valid !== r.valid
    const sep = !!prev && newSubject
    if (overTime) {
      // денят с датите — слят за поредните часове в същия ден (същата група и предмет)
      const newDate = newSubject || prev!.date !== r.date
      rows.push(new TableRow({ children: [
        cell(String(n), true, sep, 0), merged(dt, newDate, true, sep, 1), cell(r.time || '', true, sep, 2),
        merged(r.group, newGroup, true, sep && newGroup, 3), merged(r.subject, newSubject, false, sep, 4, r.valid), cell(String(r.hours), true, sep, 5),
      ] }))
      return
    }
    rows.push(new TableRow({ children: [
      cell(String(n), true, sep, 0), cell(dt, true, sep, 1), merged(r.group, newGroup, true, sep && newGroup, 2), merged(r.subject, newSubject, false, sep, 3, r.valid), cell(String(r.hours), true, sep, 4),
    ] }))
  })
  children.push(new Table({ width: { size: W.reduce((a, x) => a + x, 0), type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: W, rows }))
  children.push(new Paragraph({ text: '', spacing: { after: 60 } }))

  // общо по ставката + словом — като в декларациите за заместване (ставката от „Проверка лекторски“; иначе 6,29 €)
  const rate = d.rate && d.rate > 0 ? d.rate : DEFAULT_RATES.over
  children.push(new Paragraph({ children: [normal('Общ брой учебни часове: ', 22), bold(String(d.totalHours), 22), normal(' х ', 22), bold(eurD(rate), 22),
    normal(' EUR = ', 22), bold(eurD(d.totalHours * rate), 22), normal(' EUR', 22)], spacing: { before: 120, after: 0 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal(eurWords(d.totalHours * rate), 22)], spacing: { before: 100, after: 0 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(цифром, словом)', italics: true, size: 20 })], spacing: { after: 200 } }))

  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [normal('Известно ми е, че при деклариране на неверни данни в настоящата декларация, нося наказателна отговорност съгласно законите на Република България.', 20)], spacing: { after: 480 } }))

  // подписи — вляво датата, вдясно в една колона ролята с точки до края; пояснението — центрирано под точките
  const TEXT_W = 11906 - 900 - 900
  const SIG_X = 5900
  const SIGT = [{ type: TabStopType.LEFT, position: SIG_X }, { type: TabStopType.RIGHT, position: TEXT_W, leader: LeaderType.DOT }]
  const CAP = [{ type: TabStopType.CENTER, position: Math.round((SIG_X + 1400 + TEXT_W) / 2) }]
  const KEEP = { keepNext: true, keepLines: true }
  const tabR = () => new TextRun({ children: [new Tab()], size: 22 })
  const sign = (role: string, caption: string, after = 0) => {
    children.push(new Paragraph({ tabStops: SIGT, children: [normal(`Дата: ${'…'.repeat(14)} ${Y} г.`, 22), tabR(), normal(role + ' ', 22), tabR()], spacing: { after: 40 }, ...KEEP }))
    children.push(new Paragraph({ tabStops: CAP, children: [tabR(), new TextRun({ text: caption, italics: true, size: 18, color: '595959' })], spacing: { after }, ...(after ? {} : KEEP) }))
  }
  // фина сива линия — отделя частта на декларатора от проверката
  const divider = () => children.push(new Paragraph({ children: [], border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'A6A6A6', space: 1 } }, spacing: { before: 360, after: 200 } }))

  sign('Декларатор:', '(подпис)')
  divider()
  children.push(new Paragraph({ children: [normal('Посочените часове са действително проведени и са вписани в дневника на класа.', 20)], spacing: { after: 280 }, ...KEEP }))
  sign('Проверил:', '(ЗДУД)', 360)
  children.push(new Paragraph({ children: [normal(`Сумата е проверена, начислена и изплатена по ведомост за месец ${'…'.repeat(12)} ${Y} г.`, 20)], spacing: { after: 280 }, ...KEEP }))
  sign('Счетоводител:', '(подпис)')

  return { properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }
}

export async function generateLecturerDeclaration(d: LecturerDeclData) {
  const blob = await Packer.toBlob(new Document({ sections: [lecturerDeclSection(d)] }))
  saveAs(blob, `декларация_${d.fileTag || 'лекторски'}_${d.teacherName.replace(/\s+/g, '_')}.docx`)
}

/** Няколко декларации в един Word файл — всяка на нова страница (напр. над норматив + ИФО) */
export async function generateLecturerDeclarations(list: LecturerDeclData[], fileName: string) {
  if (!list.length) return
  const blob = await Packer.toBlob(new Document({ sections: list.map(lecturerDeclSection) }))
  saveAs(blob, fileName)
}
// ═══ МЕСЕЧНА справка-декларация за ЗАМЕСТВАНЕ ═══
export interface MonthlyDeclData {
  substituteName: string
  substitutePosition: string
  monthName: string
  year: number
  yearName: string
  rows: { date: string; orderRef: string; cls: string; subject: string; hours: number; items?: { period: number; subject: string }[]; bsch: boolean; kt: string; absentName: string }[]
  totalHours: number
  periodFrom?: string
  periodTo?: string
  rate?: number            // ставка €/час за заместване от бюджета (lecturer_rates)
}

// НП вариант (само НП редове) — точно по бланката Приложение № 2 (Times New Roman 12, полета и таблица като образеца)
function npDeclSection(d: MonthlyDeclData) {
  const rows = d.rows.filter(r => r.bsch)
  const total = rows.reduce((a, r) => a + r.hours, 0)
  const F = 'Times New Roman'
  const TEXT_W = 9214                        // ширина на текста между полетата (като образеца)
  const t = (text: string, o: any = {}) => new TextRun({ text, font: F, size: 24, ...o })
  const it = (text: string, size = 24) => new TextRun({ text, font: F, size, italics: true })
  const dotTab = () => new TextRun({ font: F, size: 24, children: [new Tab()] })
  const DOTS = [{ type: TabStopType.RIGHT, position: TEXT_W, leader: LeaderType.DOT }]
  const P = (children: any[], o: any = {}) => new Paragraph({ children, spacing: { after: 0, line: 276 }, ...o })

  const period = d.periodFrom && d.periodTo
    ? `${formatDate(d.periodFrom)} – ${formatDate(d.periodTo)}`
    : d.monthName.replace(/^периода\s*/, '')

  const children: any[] = []
  // горе вдясно
  children.push(P([it('Приложение № 2')], { alignment: AlignmentType.RIGHT }))
  children.push(P([it('Справка - декларация по Модул 1 и Модул 2')], { alignment: AlignmentType.RIGHT, spacing: { after: 240 } }))

  // институция
  children.push(P([t('Център за специална образователна подкрепа – гр. Варна', { bold: true })], { alignment: AlignmentType.CENTER }))
  children.push(P([t('ПК 9000, гр. Варна, община Варна, област Варна')], { spacing: { before: 120, after: 0 } }))
  children.push(P([t('ул. „Петко Стайнов“ № 7, тел.: 052 619 456, e-mail: info-400052@edu.mon.bg')], { spacing: { before: 120, after: 280 } }))

  // заглавие
  children.push(P([t('С П Р А В К А   –   Д Е К Л А Р А Ц И Я', { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 120 } }))
  children.push(P([t('за възнаграждение на учител за реално взетите учебни/астрономически часове')], { alignment: AlignmentType.CENTER, spacing: { after: 60 } }))
  children.push(P([t('по Националната програма „Без свободен час“ за 2026 г.,')], { alignment: AlignmentType.CENTER, spacing: { after: 60 } }))
  children.push(P([t('модул „Без свободен час в училище“')], { alignment: AlignmentType.CENTER, spacing: { after: 280 } }))

  // долуподписаният — без поясненията в скоби
  // попълнените автоматично полета — без точки след тях
  children.push(P([t('Долуподписаният (ата) '), t(d.substituteName, { bold: true })], { spacing: { after: 80 } }))
  children.push(P([t('заемащ (а) длъжността '), t(d.substitutePosition || 'учител', { bold: true })], { spacing: { after: 80 } }))
  children.push(P([t('в '), t('ЦСОП – гр. Варна', { bold: true })]))

  children.push(P([t('Д Е К Л А Р И Р А М ,', { bold: true })], { alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 } }))
  // месец: един месец → „септември 2026 г.“; повече → „септември – октомври 2026 г.“
  const NP_MONTHS = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември']
  let npMonth = period
  if (d.periodFrom && d.periodTo) {
    const a = new Date(d.periodFrom + 'T00:00'), b = new Date(d.periodTo + 'T00:00')
    const m1 = NP_MONTHS[a.getMonth()], m2 = NP_MONTHS[b.getMonth()]
    npMonth = m1 === m2 ? `${m1} ${a.getFullYear()} г.` : `${m1} – ${m2} ${b.getFullYear()} г.`
  }
  children.push(P([t('че за месец '), t(npMonth, { bold: true }), t(' действително съм провел следните учебни часове като заместващ на отсъстващ учител:')],
    { spacing: { after: 120, line: 360, lineRule: LineRuleType.AUTO } }))

  // таблица — колоните от образеца
  const COLS = [1300, 1850, 1150, 2330, 820, 1764]   // сума 9214 — датата и „014/12.10.2026г.“ се побират на един ред
  const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const cell = (i: number, lines: string[], bold = false, center = true, merge?: 'start' | 'cont') => new TableCell({
    borders: CELLS, width: { size: COLS[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    ...(merge ? { verticalMerge: merge === 'start' ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE } : {}),
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: lines.map(l => new Paragraph({ alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 0, line: 252 }, children: [t(l, { size: 20, ...(bold ? { bold: true } : {}) })] })),
  })
  const head = new TableRow({ tableHeader: true, children: [
    cell(0, ['Дата'], true), cell(1, ['Заповед №… от…', 'Договор №… от…'], true), cell(2, ['Клас'], true),
    cell(3, ['Тема от учебното', '/образователното', 'съдържание'], true), cell(4, ['Брой', 'часове'], true), cell(5, ['Име на отсъстващия', 'учител'], true),
  ] })
  // всеки час на отделен ред (по реда в деня) — „Тема“ е празна: попълва се на ръка от дневника
  const perHour = rows.flatMap(r => {
    const its = (r.items || []).slice().sort((a, b) => a.period - b.period)
    return its.length === r.hours ? its.map(it => ({ r, subject: it.subject })) : Array.from({ length: r.hours }, () => ({ r, subject: r.subject }))
  })
  // „Тема“ и „Брой часове“ — на всеки ред (темата се пише за всеки час); останалите колони се обединяват,
  // всяка в рамките на колоните вляво: дата → заповед → клас; отсъстващият — в рамките на датата и заповедта
  const keys = perHour.map(({ r }) => [r.date, `${r.date}|${r.orderRef}`, `${r.date}|${r.orderRef}|${r.cls}`, `${r.date}|${r.orderRef}|${r.absentName}`])
  const mg = (k: number, i: number): 'start' | 'cont' => (i > 0 && keys[i - 1][k] === keys[i][k] ? 'cont' : 'start')
  const body = perHour.map(({ r }, i) => new TableRow({ cantSplit: true, height: { value: 420, rule: HeightRule.ATLEAST }, children: [
    cell(0, mg(0, i) === 'cont' ? [''] : [r.date], false, true, mg(0, i)),
    cell(1, mg(1, i) === 'cont' ? [''] : [r.orderRef], false, true, mg(1, i)),
    cell(2, mg(2, i) === 'cont' ? [''] : [/^\d+$/.test(r.cls.trim()) ? `паралелка №${r.cls.trim()}` : r.cls], false, true, mg(2, i)),
    cell(3, ['']), cell(4, ['1']),
    cell(5, mg(3, i) === 'cont' ? [''] : [r.absentName], false, false, mg(3, i)),
  ] }))
  children.push(new Table({ width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: COLS, layout: TableLayoutType.FIXED, rows: [head, ...body] }))

  // общо + цифром/словом
  // ставката е тази за заместване (6,29 €); 7,38 € е само таванът с осигуровките за МОН
  const npRate = d.rate && d.rate > 0 ? d.rate : 0
  children.push(P([t('Общ брой учебни часове: '), t(String(total), { bold: true }),
    ...(npRate ? [t(' х '), t(eurD(npRate), { bold: true }), t(' EUR = '), t(eurD(total * npRate), { bold: true }), t(' EUR')] : [t(' х ………… EUR = ……………… EUR')])],
    { spacing: { before: 240, after: 0 } }))
  children.push(npRate
    ? P([t(eurWords(total * npRate))], { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 0 } })
    : P([dotTab()], { tabStops: DOTS, spacing: { before: 120, after: 0 } }))
  children.push(P([it('(цифром, словом)')], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))

  children.push(P([t('Темите на преподаденото учебно /образователно съдържание са вписани в дневника на класа/групата.')], { alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 360, lineRule: LineRuleType.AUTO } }))
  children.push(P([t('Известно ми е, че при деклариране на неверни данни в настоящата декларация, нося отговорност съгласно законите на Република България.')], { alignment: AlignmentType.JUSTIFIED, spacing: { after: 360, line: 360, lineRule: LineRuleType.AUTO } }))

  // подписи
  const KEEP = { keepNext: true, keepLines: true }
  children.push(P([t('Декларатор: '), dotTab()], { tabStops: DOTS, ...KEEP }))
  const TABS2 = [{ type: TabStopType.CENTER, position: 4200 }, { type: TabStopType.CENTER, position: 8000 }]
  const tab = () => new TextRun({ font: F, size: 24, children: [new Tab()] })
  children.push(P([tab(), it('(личен подпис)'), tab(), it('(дата)')], { tabStops: TABS2, spacing: { after: 400 }, ...KEEP }))
  children.push(P([t('Директор: '), t('Светлана Иванова', { bold: true }), t(' '), dotTab()], { tabStops: DOTS, ...KEEP }))
  children.push(P([tab(), it('(име, фамилия, подпис, кръгъл печат)'), tab(), it('(дата)')], { tabStops: TABS2 }))

  return {
    section: { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 709, right: 1134, bottom: 567, left: 1701 } } }, children },
    stem: period.replace(/\s+/g, '').replace(/[–.]/g, '-'),
  }
}
const NP_STYLES = { default: { document: { run: { font: 'Times New Roman', size: 24 } } } }
const BUDGET_STYLES = { default: { document: { run: { font: 'Times New Roman', size: 20 } } } }

export async function generateMonthlyNPDeclaration(d: MonthlyDeclData) {
  const { section, stem } = npDeclSection(d)
  const blob = await Packer.toBlob(new Document({ styles: NP_STYLES, sections: [section] }))
  saveAs(blob, `декларация_НП_${stem}_${d.substituteName.replace(/\s+/g, '_')}.docx`)
}

// Бюджетен вариант (само бюджетните редове) — точно по бланката „По заместване / ДЕКЛАРАЦИЯ“
function budgetDeclSection(d: MonthlyDeclData) {
  const rows = d.rows.filter(r => !r.bsch)
  const total = rows.reduce((a, r) => a + r.hours, 0)
  const F = 'Times New Roman'
  const TEXT_W = 11906 - 1417 - 707          // 9782 — полетата от бланката
  const t = (text: string, o: any = {}) => new TextRun({ text, font: F, size: 20, ...o })
  const tab = () => new TextRun({ font: F, size: 20, children: [new Tab()] })
  const DOTS = [{ type: TabStopType.RIGHT, position: TEXT_W, leader: LeaderType.DOT }]
  const P = (children: any[], o: any = {}) => new Paragraph({ children, spacing: { after: 0, line: 276 }, ...o })

  // месец: един месец → „септември“; повече → „септември – октомври“
  const MONTHS = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември']
  let monthLabel = d.monthName.replace(/^периода\s*/, '')
  if (d.periodFrom && d.periodTo) {
    const m1 = MONTHS[new Date(d.periodFrom + 'T00:00').getMonth()], m2 = MONTHS[new Date(d.periodTo + 'T00:00').getMonth()]
    monthLabel = m1 === m2 ? m1 : `${m1} – ${m2}`
  }
  const children: any[] = []
  // хедър — само името на центъра (като при НП)
  children.push(P([new TextRun({ text: 'Център за специална образователна подкрепа – гр. Варна', font: F, size: 24, bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))
  children.push(P([t('По заместване', { bold: true, underline: {} })], { alignment: AlignmentType.RIGHT, spacing: { after: 240 } }))
  children.push(P([new TextRun({ text: 'Д Е К Л А Р А Ц И Я', font: F, size: 24, bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))

  // един абзац за декларатора, втори — „ДЕКЛАРИРАМ, че…“ (без излишни нови редове)
  children.push(P([t('Долуподписаният/та '), t(d.substituteName, { bold: true }), t(', заемащ длъжността '), t(d.substitutePosition || 'учител', { bold: true }), t(' в ЦСОП – гр. Варна,')],
    { alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 } }))
  // заповедта и отсъстващият — на всеки ред в таблицата (като при НП)
  children.push(P([
    t('ДЕКЛАРИРАМ, че ', { bold: true }), t(monthLabel.includes('–') ? 'за периода ' : 'за месец '), t(monthLabel, { bold: true }), t(` ${d.year || new Date().getFullYear()} година, съм взел/а следните часове над минималната норма задължителна преподавателска работа за заместване на отсъстващ учител:`),
  ], { alignment: AlignmentType.JUSTIFIED, spacing: { after: 160 } }))

  // таблица — като при НП (заповедта на всеки ред), „Тема“ → „Предмет“
  const COLS = [1250, 1850, 1250, 2700, 900, 1832]   // сума 9782
  const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const cell = (i: number, lines: string[], o: { bold?: boolean; align?: any; span?: number; merge?: 'start' | 'cont' } = {}) => new TableCell({
    borders: CELLS, columnSpan: o.span, verticalAlign: VerticalAlign.CENTER,
    ...(o.merge ? { verticalMerge: o.merge === 'start' ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE } : {}),
    width: { size: o.span ? COLS.slice(i, i + o.span).reduce((a, x) => a + x, 0) : COLS[i], type: WidthType.DXA },
    margins: { top: 20, bottom: 20, left: 60, right: 60 },
    children: lines.map(l => new Paragraph({ alignment: o.align ?? AlignmentType.CENTER, spacing: { after: 0, line: 240 }, children: [t(l, { bold: !!o.bold })] })),
  })
  const trows: TableRow[] = [new TableRow({ tableHeader: true, children: [
    cell(0, ['Дата'], { bold: true }), cell(1, ['Заповед №… от…'], { bold: true }), cell(2, ['Паралелка /', 'група'], { bold: true }),
    cell(3, ['Предмет'], { bold: true }), cell(4, ['Брой', 'часове'], { bold: true }), cell(5, ['Име на отсъстващия', 'учител'], { bold: true }),
  ] })]
  // часовете по реда в деня, с предмета им
  const perHour = rows.flatMap(r => {
    const its = (r.items || []).slice().sort((a, b) => a.period - b.period)
    if (its.length === r.hours) return its.map(it => ({ r, subject: it.subject || r.subject }))
    // без часовете поотделно: „Математика (2); БЕЛ (3)“ → 2 реда математика, 3 реда БЕЛ
    const parts = r.subject.split(/;\s*/).map(x => x.match(/^(.*?)\s*\((\d+)\)$/)).filter(Boolean) as RegExpMatchArray[]
    if (parts.length && parts.reduce((a, m) => a + Number(m[2]), 0) === r.hours)
      return parts.flatMap(m => Array.from({ length: Number(m[2]) }, () => ({ r, subject: m[1] })))
    return Array.from({ length: r.hours }, () => ({ r, subject: r.subject }))
  })
  // еднаквите поредни стойности се обединяват — всяка колона в рамките на колоните вляво
  // (датата → заповедта → паралелката → предметът); отсъстващият — в рамките на датата и заповедта
  // поредните часове по един и същ предмет (същия ден, заповед, паралелка, отсъстващ) — един ред, часовете сумирани
  const grp: { r: typeof rows[number]; subject: string; cls: string; hours: number; keys: string[] }[] = []
  perHour.forEach(({ r, subject }) => {
    const cls = /^\d+$/.test(r.cls.trim()) ? `№${r.cls.trim()}` : r.cls
    const keys = [r.date, `${r.date}|${r.orderRef}`, `${r.date}|${r.orderRef}|${cls}`, `${r.date}|${r.orderRef}|${cls}|${subject}`, `${r.date}|${r.orderRef}|${r.absentName}`]
    const p = grp[grp.length - 1]
    if (p && p.keys[3] === keys[3] && p.keys[4] === keys[4]) p.hours++
    else grp.push({ r, subject, cls, hours: 1, keys })
  })
  const m = (k: number, i: number): 'start' | 'cont' => (i > 0 && grp[i - 1].keys[k] === grp[i].keys[k] ? 'cont' : 'start')
  grp.forEach(({ r, subject, cls, hours }, i) => trows.push(new TableRow({ cantSplit: true, children: [
    cell(0, m(0, i) === 'cont' ? [''] : [r.date], { merge: m(0, i) }),
    cell(1, m(1, i) === 'cont' ? [''] : [r.orderRef], { merge: m(1, i) }),
    cell(2, m(2, i) === 'cont' ? [''] : [cls], { merge: m(2, i) }),
    cell(3, m(3, i) === 'cont' ? [''] : subjectLines(subject), { merge: m(3, i) }),
    cell(4, [String(hours)]),
    cell(5, m(4, i) === 'cont' ? [''] : [r.absentName], { merge: m(4, i), align: AlignmentType.LEFT }),
  ] })))
  trows.push(new TableRow({ children: [
    cell(0, ['Всичко:'], { span: 4, align: AlignmentType.RIGHT, bold: true }), cell(4, [String(total)], { bold: true }), cell(5, ['']),
  ] }))
  children.push(new Table({ width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: COLS, layout: TableLayoutType.FIXED, rows: trows }))

  // общо по ставката + словом — като при НП (ставката за заместване от „Проверка лекторски“; иначе 6,29 €)
  const rate = d.rate && d.rate > 0 ? d.rate : DEFAULT_RATES.sub
  children.push(P([t('Общ брой учебни часове: '), t(String(total), { bold: true }), t(' х '), t(eurD(rate), { bold: true }),
    t(' EUR = '), t(eurD(total * rate), { bold: true }), t(' EUR')], { spacing: { before: 240, after: 0 } }))
  children.push(P([t(eurWords(total * rate))], { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 0 } }))
  children.push(P([t('(цифром, словом)', { italics: true })], { alignment: AlignmentType.CENTER, spacing: { after: 200 } }))

  children.push(P([t('Известно ми е, че при деклариране на неверни данни в настоящата декларация, нося наказателна отговорност съгласно законите на Република България.')], { alignment: AlignmentType.JUSTIFIED, spacing: { after: 480 } }))

  // подписи — вляво датата, вдясно в една колона ролята с точки до края; пояснението — центрирано под точките
  const SIG_X = 5600
  const SIG = [{ type: TabStopType.LEFT, position: SIG_X }, { type: TabStopType.RIGHT, position: TEXT_W, leader: LeaderType.DOT }]
  const CAP = [{ type: TabStopType.CENTER, position: Math.round((SIG_X + 1300 + TEXT_W) / 2) }]
  const KEEP = { keepNext: true, keepLines: true }
  const sign = (left: string, role: string, caption: string, after = 0) => {
    children.push(P([t(left), tab(), t(role + ' '), tab()], { tabStops: SIG, spacing: { before: 0, after: 40 }, ...KEEP }))
    children.push(P([tab(), t(caption, { italics: true, size: 18, color: '595959' })], { tabStops: CAP, spacing: { after }, ...(after ? {} : KEEP) }))
  }
  // фина сива линия между частите
  const divider = () => children.push(P([], { border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'A6A6A6', space: 1 } }, spacing: { before: 360, after: 200 } }))

  sign('Дата: ………………… 2026 г.', 'Декларатор:', '(подпис)')
  divider()
  children.push(P([t('Посочените часове са действително проведени и са вписани в дневника на класа.')], { spacing: { after: 280 }, ...KEEP }))
  sign('Дата: ………………… 2026 г.', 'Проверил:', '(ЗДУД)', 360)
  children.push(P([t('Сумата е проверена, начислена и изплатена по ведомост за месец ……………………… 2026 г.')], { spacing: { after: 280 }, ...KEEP }))
  sign('Дата: ………………… 2026 г.', 'Счетоводител:', '(подпис)')

  return {
    section: { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 709, right: 707, bottom: 851, left: 1417 } } }, children },
    stem: monthLabel.replace(/\s+/g, ''),
  }
}

export async function generateMonthlyBudgetDeclaration(d: MonthlyDeclData) {
  const { section, stem } = budgetDeclSection(d)
  const blob = await Packer.toBlob(new Document({ styles: BUDGET_STYLES, sections: [section] }))
  saveAs(blob, `декларация_бюджет_${stem}_${d.substituteName.replace(/\s+/g, '_')}.docx`)
}

/** Декларациите по заместване на ЕДИН колега за месеца — в един файл: НП и бюджет, всяка на своя страница
 *  (само тези, по които има часове). Шрифтовете са изрично в секциите, затова стиловете не се бият. */
export async function generateMonthlySubstitutionDeclarations(d: MonthlyDeclData) {
  const hasNp = d.rows.some(r => r.bsch), hasBudget = d.rows.some(r => !r.bsch)
  const parts = [...(hasNp ? [npDeclSection(d)] : []), ...(hasBudget ? [budgetDeclSection(d)] : [])]
  if (!parts.length) return
  const blob = await Packer.toBlob(new Document({ styles: BUDGET_STYLES, sections: parts.map(p => p.section) }))
  const kinds = [hasNp ? 'НП' : '', hasBudget ? 'бюджет' : ''].filter(Boolean).join('_и_')
  saveAs(blob, `декларация_заместване_${kinds}_${parts[0].stem}_${d.substituteName.replace(/\s+/g, '_')}.docx`)
}

/** ВСИЧКИ декларации на един колега за периода — един файл, всяка на своя страница:
 *  заместване НП, заместване бюджет, над норматив, ИФО / логопед (само тези, по които има часове).
 *  Без общ стил на документа — всяка секция си носи шрифта, както в отделните файлове. */
export async function generateAllMyDeclarations(sub: MonthlyDeclData | null, lect: LecturerDeclData[], fileName: string) {
  const sections: any[] = []
  if (sub && sub.rows.some(r => r.bsch)) sections.push(npDeclSection(sub).section)
  if (sub && sub.rows.some(r => !r.bsch)) sections.push(budgetDeclSection(sub).section)
  lect.forEach(l => sections.push(lecturerDeclSection(l)))
  if (!sections.length) return 0
  const blob = await Packer.toBlob(new Document({ sections }))
  saveAs(blob, fileName)
  return sections.length
}

/** Декларациите на няколко колеги в един файл — всяка на нова страница (за печат наведнъж) */
export async function generateMonthlyDeclarationsBatch(list: MonthlyDeclData[], kind: 'np' | 'budget', label: string) {
  const parts = list.map(d => (kind === 'np' ? npDeclSection(d) : budgetDeclSection(d)).section)
  if (!parts.length) return
  const blob = await Packer.toBlob(new Document({ styles: kind === 'np' ? NP_STYLES : BUDGET_STYLES, sections: parts }))
  saveAs(blob, `декларации_${kind === 'np' ? 'НП' : 'бюджет'}_${label.replace(/\s+/g, '_')}.docx`)
}
// ═══ ЗАПОВЕД ЗА ПОЛЗВАНЕ НА ОТПУСК (образец №1 на НП „Без свободен час") ═══
export interface NpLeaveOrderData {
  orderNumber: string
  absentName: string
  absentPosition: string
  ktArticle: string        // 155/157/159/161/162/168/169/170/176
  /** части от периода с друг член (напр. последните 2 дни — чл. 160) */
  ktParts?: { from: string; to: string; kt: string }[]
  dateFrom: string
  dateTo: string
  workDays: number         // брой работни/учебни дни отпуск
  leaveRef: string         // "Заявление вх. № …"
  zdudName: string
}
const KT_TEXT: Record<string, string> = {
  '155': 'чл. 155 – платен годишен отпуск',
  '157': 'чл. 157 – отпуск при определени събития',
  '159': 'чл. 159 – отпуск за синдикална дейност',
  '160': 'чл. 160 – неплатен отпуск',
  '161': 'чл. 161 – платен служебен/творчески отпуск',
  '162': 'чл. 162 – отпуск при временна неработоспособност',
  '168': 'чл. 168 – допълнителен отпуск за отглеждане на дете',
  '169': 'чл. 169 – отпуск при осиновяване',
  '170': 'чл. 170 – отпуск за граждански и обществени задължения',
  '176': 'чл. 176 – неплатен/друг отпуск',
}
export async function generateNpLeaveOrder(d: NpLeaveOrderData) {
  const children: any[] = []
  header().forEach(p => children.push(p))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('ЗАПОВЕД', 28)], spacing: { before: 120, after: 60 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal(`№ ${d.orderNumber}`, 22)], spacing: { after: 160 } }))

  const df = formatDate(d.dateFrom), dt = formatDate(d.dateTo)
  const ktText = KT_TEXT[d.ktArticle] || `чл. ${d.ktArticle} КТ`
  // няколко члена → непрекъснати периоди по член (календарни дни)
  const runs: { kt: string; from: string; to: string }[] = []
  if (d.ktParts?.length) {
    const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    for (let x = new Date(d.dateFrom + 'T00:00'); iso(x) <= d.dateTo; x.setDate(x.getDate() + 1)) {
      const day = iso(x), kt = d.ktParts.find(p => day >= p.from && day <= p.to)?.kt || d.ktArticle
      const last = runs[runs.length - 1]
      if (last && last.kt === kt) last.to = day; else runs.push({ kt, from: day, to: day })
    }
  }
  const multi = runs.length > 1
  const arts = Array.from(new Set(runs.map(r => r.kt)))

  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [
    normal('На основание чл. 259, ал. 1 от Закона за предучилищното и училищното образование, ', 22),
    normal(multi
      ? `${arts.map(k => `чл. ${k}`).join(' и ')} от Глава осма, раздел I от Кодекса на труда`
      : `${ktText.replace(/^чл\. \d+[^–]*– /, 'чл. ' + d.ktArticle + ' ')} от Глава осма, раздел I от Кодекса на труда`, 22),
    normal(` и подадено `, 22), bold(d.leaveRef || 'заявление', 22),
    normal(', както и във връзка с осигуряване на заместване по Национална програма „Без свободен час", Модул 1,', 22),
  ] }))

  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('РАЗРЕШАВАМ:', 24)], spacing: { after: 120 } }))

  if (multi) {
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 }, children: [
      normal('Ползване на отпуск на ', 22),
      bold(`${d.absentName}${d.absentPosition ? ' – ' + d.absentPosition : ''}`, 22), normal(', както следва:', 22),
    ] }))
    runs.forEach((r, i) => children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 60 }, indent: { left: 360 }, children: [
      normal(`– на основание ${KT_TEXT[r.kt] || `чл. ${r.kt} КТ`}, за периода от `, 22), bold(formatDate(r.from), 22), normal(' до ', 22), bold(formatDate(r.to), 22),
      normal(` включително${i === runs.length - 1 ? '.' : ';'}`, 22),
    ] })))
  } else {
  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 }, children: [
    normal('Ползване на отпуск на ', 22),
    bold(`${d.absentName}${d.absentPosition ? ' – ' + d.absentPosition : ''}`, 22),
    normal(`, на основание ${ktText},`, 22),
  ] }))
  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 }, children: [
    normal('за периода от ', 22), bold(df, 22), normal(' до ', 22), bold(dt, 22),
    normal(` включително${d.workDays ? ` (${d.workDays} работни дни)` : ''}.`, 22),
  ] }))
  }

  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 }, children: [
    normal('Заместването на отсъстващия учител да се осигури по реда на Националната програма „Без свободен час", Модул 1, за реално проведените учебни часове.', 22),
  ] }))
  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 }, children: [
    normal('Контрол по изпълнението на заповедта възлагам на ', 22), bold(d.zdudName || '…………………', 22),
    normal(', заместник-директор.', 22),
  ] }))
  children.push(new Paragraph({ children: [normal('Настоящата заповед да се сведе до знанието на съответните лица за сведение и изпълнение.', 22)], spacing: { after: 300 } }))

    children.push(new Paragraph({
    tabStops: [{ type: 'right', position: 9600 }],
    spacing: { after: 20 },
    children: [
      bold('ДИРЕКТОР ЦСОП: ', 22), normal('.....................', 22),
      new TextRun({ text: '\tЗапознат: .....................', size: 22 }),
    ],
  }))
  children.push(new Paragraph({
    tabStops: [{ type: 'right', position: 9600 }],
    children: [
      normal('        / Светлана Иванова /', 20),
      new TextRun({ text: `\t/ ${d.absentName} /`, size: 20 }),
    ],
  }))

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `заповед_отпуск_НП_${d.orderNumber.replace(/[^0-9]/g, '_')}.docx`)
}
// ═══ ЗАПОВЕД за ЛЕКТОРСКИ над норматив — обща за всички или отделна за всеки (без ИЧ — те са по отделна заповед) ═══
export interface LecturerFrameworkData {
  teachers: {
    /** norm — текст: „21 ч./седмично“, „144 ч. годишно“ или празно (без норма) */
    name: string; position: string; norm: string; from: string; to: string
    rows: { subject: string; cls: string; days: string; perWeek: number; weeks: number; total: number; from?: string; to?: string }[]
    totalHours: number
  }[]
  yearName: string
  orderNumber?: string
}
/** mode: 'common' — една заповед за всички; 'separate' — отделна заповед за всеки (всяка на нова страница, в един файл) */
export async function generateLecturerFrameworkOrder(d: LecturerFrameworkData, mode: 'common' | 'separate' = 'common') {
  const B = { style: BorderStyle.SINGLE, size: 4, color: '595959' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const th = (t: string) => new TableCell({ borders: CELLS, shading: { type: ShadingType.CLEAR, fill: 'EDF2F7' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(t, 19)] })] })
  const td = (t: string, c = false) => new TableCell({ borders: CELLS, children: [new Paragraph({ alignment: c ? AlignmentType.CENTER : AlignmentType.LEFT, children: [normal(t, 19)] })] })
  const normPart = (t: LecturerFrameworkData['teachers'][number]) => `– ${t.position}${t.norm ? `, минимална норма ${t.norm}` : ''}. Общо `

  // една заповед за дадените хора
  const order = (list: LecturerFrameworkData['teachers']) => {
    const children: any[] = []
    header().forEach(p => children.push(p))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('ЗАПОВЕД', 28)], spacing: { before: 120, after: 40 } }))
    // в номера — само календарната година на издаване („… / ……… 2026 г.“), не учебната
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal(`№ ${d.orderNumber || '............'} / ............ ${new Date().getFullYear()} г.`, 22)], spacing: { after: 160 } }))
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [
      normal('На основание чл. 259, ал. 1 от Кодекса на труда, във връзка с чл. 4, ал. 11, чл. 10, ал. 2 и чл. 20, ал. 1, т. 1 от Наредба № 4 от 20.04.2017 г. за нормиране и заплащане на труда, Приложение № 1 към чл. 4, ал. 11 от същата наредба, утвърденото разпределение на преподавателската работа, чл. 10, ал. 2 от Вътрешните правила за работна заплата, въз основа на Списък-образец № 3 за учебната ', 22),
      bold(`${(d.yearName || '').replace('/', '-')} година`, 22),
      normal(', утвърденото седмично разписание и с оглед обезпечаване на образователния и терапевтичния процес в ЦСОП – гр. Варна,', 22),
    ] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('НАРЕЖДАМ:', 24)], spacing: { after: 120 } }))
    const one = list.length === 1
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [
      normal(one
        ? '1. Възлагам на посочения педагогически специалист провеждането на учебни/терапевтични часове над определената му минимална норма преподавателска работа, които се възлагат като лекторски часове, както следва:'
        : '1. Възлагам на изброените педагогически специалисти провеждането на учебни/терапевтични часове над определената им минимална норма преподавателска работа, които се възлагат като лекторски часове, както следва:', 22),
    ] }))
    list.forEach((t, ti) => {
      children.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [
        bold(one ? t.name : `${ti + 1}. ${t.name}`, 20), normal(` ${normPart(t)}`, 20),
        bold(`${t.totalHours} лекторски часа`, 20),
        normal(` за периода ${formatDate(t.from)} – ${formatDate(t.to)}:`, 18),
      ] }))
      const rows: TableRow[] = [new TableRow({ children: [
        th('Предмет / дейност'), th('Клас / група'), th('Дни'), th('Ч./седм.'), th('Период'), th('Седмици'), th('Общо'),
      ] })]
      // период на всеки ред; ако часът спира преди края на периода на лицето — крайната дата е с удебелен шрифт
      const period = (r: LecturerFrameworkData['teachers'][number]['rows'][number]) => {
        const f = r.from || t.from, e = r.to || t.to
        return new TableCell({ borders: CELLS, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
          normal(`${formatDate(f)} – `, 19), e < t.to ? bold(formatDate(e), 19) : normal(formatDate(e), 19),
        ] })] })
      }
      t.rows.forEach(r => rows.push(new TableRow({ children: [
        td(r.subject), td(r.cls, true), td(r.days), td(String(r.perWeek), true), period(r), td(String(r.weeks), true), td(String(r.total), true),
      ] })))
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [2600, 1300, 1700, 800, 2300, 900, 700], rows }))
      if (t.rows.some(r => (r.to || t.to) < t.to)) children.push(new Paragraph({ spacing: { before: 40 }, children: [
        normal('Часовете с удебелена крайна дата се провеждат до посочената дата (с нея се изчерпва определеният брой лекторски часове).', 17),
      ] }))
    })
    const P = (t: string) => children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { before: 100, after: 60 }, children: [normal(t, 20)] }))
    P('2. Лекторските часове се провеждат съобразно утвърденото седмично разписание и утвърдената учебна документация.')
    P('3. Часовете се отчитат като действително проведени въз основа на съответната задължителна документация и установения в ЦСОП ред за отчитане.')
    P('4. За действително проведените и отчетени часове над минималната норма да се изплаща допълнително трудово възнаграждение съгласно чл. 20, ал. 1, т. 1 от Наредба № 4 от 20.04.2017 г. и Вътрешните правила за организация на работната заплата в ЦСОП – Варна.')
    P('5. Контрол по изпълнението на заповедта възлагам на заместник-директора по учебната дейност.')
    children.push(new Paragraph({ spacing: { before: 60, after: 240 }, children: [normal(one ? 'Настоящата заповед да се доведе до знанието на заинтересованото лице за сведение и изпълнение.' : 'Настоящата заповед да се доведе до знанието на заинтересованите лица за сведение и изпълнение.', 20)] }))
    children.push(new Paragraph({ children: [bold('ДИРЕКТОР ЦСОП: ', 22), normal('.............................', 22)] }))
    children.push(new Paragraph({ children: [normal('/ Светлана Иванова /', 20)], spacing: { after: 200 } }))
    children.push(new Paragraph({ children: [bold(one ? 'Запознат(а):' : 'Запознати:', 20)], spacing: { after: 60 } }))
    list.forEach((t, i) => children.push(new Paragraph({ spacing: { after: 50 }, children: [normal(`${one ? '' : `${i + 1}. `}${t.name}     ..............................`, 20)] })))
    return { properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }
  }

  // отделни — всяка заповед в своя секция (започва на нова страница)
  const sections = mode === 'separate' ? d.teachers.map(t => order([t])) : [order(d.teachers)]
  const doc = new Document({ sections })
  const blob = await Packer.toBlob(doc)
  const y = (d.yearName || '').replace('/', '_')
  const name = d.teachers.length === 1 ? `заповед_лекторски_${d.teachers[0].name.replace(/\s+/g, '_')}_${y}.docx`
    : mode === 'separate' ? `заповеди_лекторски_отделни_${y}.docx` : `заповед_лекторски_${y}.docx`
  saveAs(blob, name)
}

// ═══ ЗАПОВЕД ЗА ИЗПЛАЩАНЕ НА ЛЕКТОРСКИ ЧАСОВЕ (ВПРЗ чл. 10, ал. 2, 3 и 8) ═══
export interface LecturerPaymentData {
  periodLabel: string          // напр. „октомври 2026 г.“
  yearName: string
  rateOver: number             // над норматив, €/час (lecturer_rates)
  rateSub: number              // заместване от бюджета, €/час
  rateNp: number               // заместване по НП „Без свободен час“, €/час
  rows: { name: string; position: string; overNorm: number; budgetSub: number; np: number }[]
}
// mode: 'combined' — една заповед с две точки (бюджет + НП);
//       'separate' — един файл с ДВЕ отделни заповеди (бюджет и НП), всяка на своя страница, със свой номер и подпис.
export async function generateLecturerPaymentOrder(d: LecturerPaymentData, mode: 'combined' | 'separate' = 'combined') {
  const budget = d.rows.filter(r => r.overNorm + r.budgetSub > 0)
  const np = d.rows.filter(r => r.np > 0)
  const sections = mode === 'separate'
    ? [budget.length ? paymentOrderChildren(d, budget, []) : null, np.length ? paymentOrderChildren(d, [], np) : null].filter(Boolean) as any[][]
    : [paymentOrderChildren(d, budget, np)]
  const doc = new Document({ sections: sections.map(children => ({ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children })) })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `заповед_изплащане_лекторски_${mode === 'separate' ? 'бюджет_и_НП_' : ''}${d.periodLabel.replace(/\s+/g, '_')}.docx`)
}

function paymentOrderChildren(d: LecturerPaymentData, budget: LecturerPaymentData['rows'], np: LecturerPaymentData['rows']) {
  const eur = (v: number) => v.toFixed(2).replace('.', ',')
  const children: any[] = []
  header().forEach(p => children.push(p))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('ЗАПОВЕД', 28)], spacing: { before: 120, after: 40 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal('№ ............ / ............ г.', 22)], spacing: { after: 160 } }))

  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [
    normal('На основание чл. 259, ал. 1 от Кодекса на труда, чл. 20, ал. 1, т. 1 от Наредба № 4 от 20.04.2017 г. за нормиране и заплащане на труда, чл. 10, ал. 2, ал. 3 и ал. 8 от Вътрешните правила за работната заплата в ЦСОП – Варна', 22),
    normal(np.length > 0 ? ', Национална програма „Без свободен час в училище“ – Модул 1' : '', 22),
    normal(' и подадените декларации за проведени лекторски часове за ', 22),
    bold(d.periodLabel, 22), normal(',', 22),
  ] }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('НАРЕЖДАМ:', 24)], spacing: { after: 120 } }))

  const B = { style: BorderStyle.SINGLE, size: 4, color: '595959' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const th = (t: string) => new TableCell({ borders: CELLS, shading: { type: ShadingType.CLEAR, fill: 'EDF2F7' }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(t, 19)] })] })
  const td = (t: string, a: 'l' | 'c' | 'r' = 'c', b = false) => new TableCell({ borders: CELLS, children: [new Paragraph({
    alignment: a === 'l' ? AlignmentType.LEFT : a === 'r' ? AlignmentType.RIGHT : AlignmentType.CENTER,
    children: [b ? bold(t, 20) : normal(t, 20)] })] })
  let pt = 1

  if (budget.length > 0) {
    const hasOver = budget.some(r => r.overNorm > 0), hasSub = budget.some(r => r.budgetSub > 0)
    const what = hasOver && hasSub ? 'лекторски часове (над норматива и по заместване)' : hasOver ? 'лекторски часове над норматива' : 'лекторски часове по заместване'
    const rate = hasOver && hasSub && d.rateOver !== d.rateSub
      ? `по ставки ${eur(d.rateOver)} € за час над норматива и ${eur(d.rateSub)} € за час заместване`
      : `по ставка ${eur(hasOver ? d.rateOver : d.rateSub)} € за час`
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: [
      normal(`${pt++}. Да се изплатят ${what} за ${d.periodLabel} ${rate}, както следва:`, 22),
    ] }))
    // двете колони (над норматив + заместване) — само когато в заповедта има и от двата вида
    const both = hasOver && hasSub
    const rows: TableRow[] = [new TableRow({ tableHeader: true, children: both
      ? [th('№'), th('Име и фамилия'), th('Длъжност'), th('Над норматив, ч.'), th('Заместване, ч.'), th('Общо, ч.'), th('Сума, €')]
      : [th('№'), th('Име и фамилия'), th('Длъжност'), th('Часове'), th('Сума, €')] })]
    let tH = 0, tS = 0
    budget.forEach((r, i) => {
      const h = r.overNorm + r.budgetSub, sum = r.overNorm * d.rateOver + r.budgetSub * d.rateSub
      tH += h; tS += sum
      rows.push(new TableRow({ children: both
        ? [td(String(i + 1)), td(r.name, 'l'), td(r.position, 'l'), td(String(r.overNorm || '–')), td(String(r.budgetSub || '–')), td(String(h)), td(eur(sum), 'r')]
        : [td(String(i + 1)), td(r.name, 'l'), td(r.position, 'l'), td(String(h)), td(eur(sum), 'r')] }))
    })
    rows.push(new TableRow({ children: both
      ? [td(''), td('Общо', 'l', true), td(''), td(''), td(''), td(String(tH), 'c', true), td(eur(tS), 'r', true)]
      : [td(''), td('Общо', 'l', true), td(''), td(String(tH), 'c', true), td(eur(tS), 'r', true)] }))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: both ? [500, 2600, 2200, 1100, 1100, 900, 1200] : [500, 3200, 2800, 1200, 1400], rows }))
    children.push(new Paragraph({ text: '', spacing: { after: 80 } }))
  }

  if (np.length > 0) {
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: [
      normal(`${pt++}. Да се изплатят часовете по заместване по НП „Без свободен час в училище“ – Модул 1 за ${d.periodLabel} по ставка ${eur(d.rateNp)} € за час, със средства по програмата, както следва:`, 22),
    ] }))
    const rows: TableRow[] = [new TableRow({ tableHeader: true, children: [
      th('№'), th('Име и фамилия'), th('Длъжност'), th('Часове'), th('Сума, €'),
    ] })]
    let tH = 0, tS = 0
    np.forEach((r, i) => {
      const sum = r.np * d.rateNp
      tH += r.np; tS += sum
      rows.push(new TableRow({ children: [td(String(i + 1)), td(r.name, 'l'), td(r.position, 'l'), td(String(r.np)), td(eur(sum), 'r')] }))
    })
    rows.push(new TableRow({ children: [td(''), td('Общо', 'l', true), td(''), td(String(tH), 'c', true), td(eur(tS), 'r', true)] }))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [500, 3200, 2800, 1200, 1400], rows }))
    children.push(new Paragraph({ text: '', spacing: { after: 80 } }))
  }

  const P = (t: string) => children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { before: 80, after: 60 }, children: [normal(t, 20)] }))
  P(`${pt++}. Сумите да се изплатят с работната заплата в срока по чл. 10, ал. 3 от Вътрешните правила за работната заплата, като се начислят дължимите осигурителни вноски.`)
  P(`${pt++}. Изпълнението на заповедта възлагам на Радка Георгиева – счетоводител.`)
  P(`${pt++}. Контрол по изпълнението на заповедта ще упражнявам лично.`)
  children.push(new Paragraph({ spacing: { before: 60, after: 240 }, children: [normal('Настоящата заповед да се доведе до знанието на заинтересованите лица за сведение и изпълнение.', 20)] }))

  children.push(new Paragraph({ children: [bold('ДИРЕКТОР ЦСОП: ', 22), normal('.............................', 22)] }))
  children.push(new Paragraph({ children: [normal('/ Светлана Иванова /', 20)], spacing: { after: 200 } }))
  children.push(new Paragraph({ children: [bold('Запознат: ', 20), normal('Радка Георгиева – счетоводител     ..............................', 20)] }))
  return children
}

// ═══ ЗАЯВЛЕНИЕ ЗА ОТПУСК — Приложение № 1 към НП „Без свободен час“ (Модул 1 и Модул 2) ═══
// Различно от общото заявление: „за ползване на отпуск по време на учебни занятия“. Не се качва в портала на НП,
// но се пази в деловодството — по него се издават заповедта за отпуск и заповедта за заместване.
export interface NpLeaveApplicationData {
  name: string
  position: string
  leaveKind: string      // „платен годишен“, „неплатен“ …
  days: number | null
  forYear: string        // „2026“
  dateFrom: string       // ISO
  dateTo: string         // ISO
  reason: string
  backOn: string         // ISO — „Ще бъда на работа на“
  inNumber?: string      // вх. № (ако е заведено)
  inDate?: string        // ISO
  signedOn?: string      // ISO — дата на заявлението
}
export async function generateNpLeaveApplication(d: NpLeaveApplicationData) {
  const dt = (iso?: string) => iso ? formatDate(iso) : ''
  const y = (iso: string) => iso ? iso.slice(0, 4) : '20….'
  const P = (runs: TextRun[], o: Record<string, unknown> = {}) => new Paragraph({ children: runs, ...o })
  const children: any[] = [
    P([normal('Приложение № 1', 20)], { alignment: AlignmentType.RIGHT }),
    P([normal('Заявление за отпуск и заповед за заместване по Модул 1 и Модул 2', 20)], { alignment: AlignmentType.RIGHT }),
    P([new TextRun({ text: 'Образец', italics: true, size: 20 })], { alignment: AlignmentType.RIGHT, spacing: { after: 360 } }),
    new Paragraph({ tabStops: [{ type: TabStopType.LEFT, position: 5200 }], children: [
      normal(`ВХ. № ${d.inNumber || '………'}`, 22), new TextRun({ children: [new Tab(), 'ДО ДИРЕКТОРА'], bold: true, size: 22 }),
    ] }),
    new Paragraph({ tabStops: [{ type: TabStopType.LEFT, position: 5200 }], spacing: { after: 480 }, children: [
      normal(`ДАТА ${d.inDate ? dt(d.inDate) : '………'}`, 22), new TextRun({ children: [new Tab(), 'НА ЦСОП – гр. Варна'], bold: true, size: 22 }),
    ] }),
    P([bold('ЗАЯВЛЕНИЕ', 28)], { alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
    P([bold('за ползване на отпуск по време на учебни занятия', 22)], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }),
    P([normal('от ', 22), bold(d.name || '…………………………………………', 22)], { spacing: { after: 80 } }),
    P([normal('на длъжност ', 22), bold(d.position || '…………………………', 22)], { spacing: { after: 360 } }),
    P([bold('УВАЖАЕМА ГОСПОЖО ДИРЕКТОР,', 22)], { spacing: { after: 240 } }),
    P([
      normal('Желая да ползвам ', 22), bold(d.leaveKind || '…………………………', 22),
      normal(' отпуск в размер на ', 22), bold(d.days ? String(d.days) : '……', 22),
      normal(` ${d.days === 1 ? 'ден' : 'дни'} за `, 22), bold(d.forYear || '……', 22), normal(' г., считано от ', 22),
      bold(d.dateFrom ? `${dt(d.dateFrom)} г.` : '………………… 20…. г.', 22), normal(' до ', 22),
      bold(d.dateTo ? `${dt(d.dateTo)} г.` : '………………… 20…. г.', 22), normal(' включително', 22),
    ], { alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 360 } }),
    P([normal('поради ', 22), bold(d.reason || '…………………………………………………', 22)], { spacing: { after: 160 } }),
    P([normal('Ще бъда на работа на ', 22), bold(d.backOn ? `${dt(d.backOn)} г.` : '………………… 20…. г.', 22)], { spacing: { after: 600 } }),
    new Paragraph({ tabStops: [{ type: TabStopType.LEFT, position: 5600 }], children: [
      normal(`гр. Варна, ${d.signedOn ? dt(d.signedOn) : '………………'} ${d.signedOn ? 'г.' : `${y(d.dateFrom)} г.`}`, 22),
      new TextRun({ children: [new Tab(), 'С уважение:'], size: 22 }),
    ] }),
    new Paragraph({ tabStops: [{ type: TabStopType.LEFT, position: 5600 }], spacing: { before: 360 }, children: [
      new TextRun({ children: [new Tab(), '………………………………'], size: 22 }),
    ] }),
    new Paragraph({ tabStops: [{ type: TabStopType.LEFT, position: 5600 }], children: [
      new TextRun({ children: [new Tab(), `/ ${d.name || ''} /`], size: 20 }),
    ] }),
  ]
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1417, right: 1134 } } }, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `заявление_отпуск_НП_${(d.name || 'служител').replace(/\s+/g, '_')}.docx`)
}
