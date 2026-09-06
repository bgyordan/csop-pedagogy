import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, ImageRun,
} from 'docx'
import { CSOP_LOGO_B64 } from './docx-generator'
import { saveAs } from 'file-saver'
import { formatDate } from './utils'

function bold(text: string, size = 22): TextRun { return new TextRun({ text, bold: true, size }) }
function normal(text: string, size = 22): TextRun { return new TextRun({ text, size }) }
// ═══ ХЕДЪР (лого вляво + текст) ═══
function header(): any[] {
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
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ул. „Петко Стайнов" №7, гр. Варна', size: 18, italics: true })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'e-mail: info-400052@edu.mon.bg · тел. 052 619 456, 0878 521 823', size: 18, italics: true })] }),
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
  substitutes?: { name: string; position: string; from: string; to: string; overNorm: boolean }[]
}

// Матрица на седмичното разписание: дни (Пн-Пт) колони, часове редове.
// Преизползваем блок — при няколко заместника се вика за всеки.
// Таблица с часовете. Кратко (≤4 работни дни) → колони = конкретните дати.
// Дълго (≥5) → пълна седмична матрица Пон-Пет + "часа седмично".
// И двата с ред "Общо за деня". Преизползваем блок (за всеки заместник).
function scheduleMatrix(days: { date: string; items: { period: number; subject: string; cls: string }[] }[]): any[] {
  const B = { style: BorderStyle.SINGLE, size: 4, color: '999999' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const th = (t: string) => new TableCell({ borders: CELLS, shading: { type: ShadingType.CLEAR, fill: 'EEEEEE' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(t, 16)] })] })
  const td = (t: string, center = true, bold_ = false) => new TableCell({ borders: CELLS, children: [new Paragraph({ alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [bold_ ? bold(t, 16) : normal(t, 16)] })] })
  const DOW_SHORT = ['', 'Пон', 'Вт', 'Ср', 'Чет', 'Пет']
  const DOW_FULL = ['', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък']
  const dowOf = (dstr: string) => { const [dd, mm, yy] = dstr.split('.').map(Number); return new Date(yy, mm - 1, dd).getDay() }
  const workdays = days.filter(d => { const w = dowOf(d.date); return w >= 1 && w <= 5 })

  let maxPeriod = 6
  workdays.forEach(d => d.items.forEach(it => { if (it.period > maxPeriod) maxPeriod = it.period }))
  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1)

  const out: any[] = []
  const SHORT = workdays.length <= 4

  if (SHORT) {
    // колони = конкретните дати
    const cols = workdays
    const head = [th('Уч. час'), ...cols.map(c => th(`${DOW_FULL[dowOf(c.date)]}\n(${c.date.slice(0, 5)})`))]
    const rows: TableRow[] = [new TableRow({ children: head })]
    const usedPeriods = periods.filter(p => cols.some(c => c.items.some(it => it.period === p)))
    usedPeriods.forEach(p => {
      const cells = [td(`${p}.`, true, true)]
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
      const cells = [td(`${p}.`, true, true)]
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
export async function generateSubstitutionOrder(d: SubstOrderData) {
  const children: any[] = []
  header().forEach(p => children.push(p))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('ЗАПОВЕД', 28)], spacing: { before: 120, after: 60 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal(`№ ${d.orderNumber}`, 22)], spacing: { after: 160 } }))

  const df = formatDate(d.dateFrom), dt = formatDate(d.dateTo)
  const reasonWord = d.reason === 'sick' ? 'отсъствие поради болничен отпуск' : 'отсъствие поради отпуск'

  const baseText = d.overNorm
    ? 'На основание чл. 258, ал. 1 от Закона за предучилищното и училищното образование, във връзка с чл. 110 от Кодекса на труда и чл. 5, ал. 2 от Наредбата за финансиране на институциите в системата на предучилищното и училищното образование, във връзка със '
    : 'На основание чл. 258, ал. 1 от Закона за предучилищното и училищното образование, във връзка с чл. 259, ал. 1 от Кодекса на труда и чл. 5 от Наредбата за финансиране на институциите в системата на предучилищното и училищното образование, във връзка със '
  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [
    normal(baseText, 22), bold(d.leaveRef, 22),
    normal(` за ${reasonWord} на титуляра `, 22),
    bold(`${d.absentName}${d.absentPosition ? ' – ' + d.absentPosition : ''}`, 22),
    normal(',', 22),
  ] }))

  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('ВЪЗЛАГАМ:', 24)], spacing: { after: 120 } }))

  const isEducator = /възпитател/i.test(d.absentPosition || '')
  const holderWord = d.holderType === 'coud' || isEducator ? 'група ЦОУД' : 'паралелка'
  const normPhraseFor = (on: boolean) => on ? 'извън времето на задължителната норма преподавателска заетост' : 'в рамките на задължителната норма преподавателска заетост'
  const holderTail = d.holderType === 'ifo'
    ? `да замества отсъстващия титуляр в часовете с ${d.className || '…………'} по утвърдено седмично разписание`
    : `да замества отсъстващия титуляр в ${holderWord} № ${d.className || '…………'}`

  const multi = d.substitutes && d.substitutes.length > 0
  if (multi) {
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 40 }, children: [
      normal(`1. Заместването на отсъстващия титуляр, ${holderTail}, се възлага, както следва:`, 22),
    ] }))
    d.substitutes!.forEach((sb, i) => {
      children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 40 }, indent: { left: 400 }, children: [
        normal(`${i + 1}) за периода ${formatDate(sb.from)} – ${formatDate(sb.to)}: `, 22),
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

  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: [
    normal('2. Заместването да се извърши за периода от ', 22),
    bold(df, 22), normal(' до ', 22), bold(dt, 22),
    normal(' включително, съгласно утвърденото седмично разписание на отсъстващия титуляр:', 22),
  ] }))

  // Матрица (при няколко заместника — по една на всеки с неговия под-период)
  if (multi) {
    d.substitutes!.forEach(sb => {
      const sbDays = d.days.filter(day => {
        const [dd, mm, yy] = day.date.split('.').map(Number)
        const t = new Date(yy, mm - 1, dd).getTime()
        return t >= new Date(sb.from).getTime() && t <= new Date(sb.to).getTime()
      })
      children.push(new Paragraph({ spacing: { before: 80, after: 40 }, children: [bold(`${sb.name} (${formatDate(sb.from)} – ${formatDate(sb.to)}):`, 20)] }))
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
    P('3. Проведените часове по заместването да се изплатят на заместващия педагогически специалист. като лекторски часове.')
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: [
      normal('4. Източник на финансиране: ', 22),
      bold(d.isBsch ? 'Национална програма „Без свободен час", Модул 1.' : 'бюджет на ЦСОП (собствени средства).', 22),
    ] }))
    P('5. Отчитането да се извърши в края на месеца въз основа на данните в електронния дневник и представена справка-декларация. Възнаграждението да се изплати съгласно ВПРЗ на Центъра.')
    n = 5
  } else {
    P('3. Заместването се извършва в рамките на установеното работно време на заместващия педагогически специалист., без допълнително заплащане.')
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
    d.substitutes!.forEach((sb, i) => children.push(new Paragraph({ spacing: { after: 60 }, children: [normal(`${i + 1}. ${sb.name} – заместник     ..............................`, 22)] })))
    const k = d.substitutes!.length + 1
    children.push(new Paragraph({ children: [normal(`${k}. ${d.zdudName || '…………………'} – заместник-директор     ..............................`, 22)] }))
  } else {
    children.push(new Paragraph({ spacing: { after: 60 }, children: [normal(`1. ${d.substituteName} – заместник     ..............................`, 22)] }))
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
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '( детска градина/училище/ЦСОП/ЦПЛР)', italics: true, size: 18 })], spacing: { after: 120 } }))
  children.push(new Paragraph({ children: [normal('ПК 9000, гр. Варна, община Варна, област Варна', 22)], spacing: { after: 40 } }))
  children.push(new Paragraph({ children: [normal('ул. „Петко Стайнов" № 7, тел.: 052 619 456, e-mail: info-400052@edu.mon.bg', 22)], spacing: { after: 240 } }))

  // Заглавие с разредка
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'С П Р А В К А   –   Д Е К Л А Р А Ц И Я', bold: true, size: 26 })], spacing: { after: 40 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal('за възнаграждение на учител за реално взетите учебни/астрономически часове', 20)], spacing: { after: 20 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal('по Националната програма „Без свободен час" за 2026 г.,', 20)], spacing: { after: 20 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal('модул „Без свободен час в ........................ "', 20)], spacing: { after: 240 } }))

  // Долуподписаният / длъжност / институция — три реда с курсив-пояснения
  children.push(new Paragraph({ children: [normal('Долуподписаният (ата) ', 22), bold(d.substituteName, 22), normal(' ' + dots(30), 22)], spacing: { after: 20 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(име, презиме, фамилия)', italics: true, size: 18 })], spacing: { after: 80 } }))
  children.push(new Paragraph({ children: [normal('заемащ (а) длъжността ', 22), bold(d.substitutePosition || 'учител', 22), normal(' ' + dots(25), 22)], spacing: { after: 20 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(наименование на длъжността)', italics: true, size: 18 })], spacing: { after: 80 } }))
  children.push(new Paragraph({ children: [normal('в Център за специална образователна подкрепа – гр. Варна', 22)], spacing: { after: 20 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(училище/ЦСОП/ДГ/ЦПЛР)', italics: true, size: 18 })], spacing: { after: 200 } }))

  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Д Е К Л А Р И Р А М ,', bold: true, size: 24 })], spacing: { after: 160 } }))

  const pf = formatDate(d.periodFrom), pt = formatDate(d.periodTo)
  children.push(new Paragraph({ children: [
    normal(`че за периода от ${pf} до ${pt} действително съм провел/а следните учебни/астрономически часове като заместващ/а на отсъстващ учител `, 22),
    bold(d.absentName, 22), normal(':', 22),
  ], spacing: { after: 160 } }))

  const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const th = (t: string) => new TableCell({ borders: CELLS, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(t, 18)] })] })
  const td = (t: string, c = false) => new TableCell({ borders: CELLS, children: [new Paragraph({ alignment: c ? AlignmentType.CENTER : AlignmentType.LEFT, children: [normal(t, 18)] })] })
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
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(цифром, словом)', italics: true, size: 18 })], spacing: { after: 200 } }))

  children.push(new Paragraph({ children: [normal('Темите на преподаденото учебно/образователно съдържание са вписани в дневника на класа/групата.', 20)], spacing: { after: 80 } }))
  children.push(new Paragraph({ children: [normal('Известно ми е, че при деклариране на неверни данни в настоящата декларация, нося отговорност съгласно законите на Република България.', 20)], spacing: { after: 300 } }))

  children.push(new Paragraph({ children: [normal('Декларатор: ' + dots(50), 22)], spacing: { after: 10 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(личен подпис)                    (дата)', italics: true, size: 18 })], spacing: { after: 200 } }))
  children.push(new Paragraph({ children: [normal('Директор: ' + dots(50), 22)], spacing: { after: 10 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(име, фамилия, подпис, кръгъл печат)          (дата)', italics: true, size: 18 })] }))

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1100, right: 1100 } } }, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `справка_декларация_НП_${d.substituteName.replace(/\s+/g, '_')}.docx`)
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

  const B = { style: BorderStyle.SINGLE, size: 4, color: '999999' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const th = (t: string) => new TableCell({ borders: CELLS, shading: { type: ShadingType.CLEAR, fill: 'EEEEEE' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(t, 18)] })] })
  const td = (t: string, c = false) => new TableCell({ borders: CELLS, children: [new Paragraph({ alignment: c ? AlignmentType.CENTER : AlignmentType.LEFT, children: [normal(t, 18)] })] })
  const rows: TableRow[] = [ new TableRow({ children: [th('№'), th('Дата'), th('Паралелка – клас'), th('Предмет'), th('Брой часове')] }) ]
  d.rows.forEach((r, i) => {
    rows.push(new TableRow({ children: [
      td(String(i + 1), true), td(r.date, true), td(r.cls, true), td(r.subject), td(String(r.hours), true),
    ] }))
  })
  rows.push(new TableRow({ children: [
    new TableCell({ borders: CELLS, columnSpan: 4, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [bold('Всичко:', 18)] })] }),
    td(String(d.totalHours), true),
  ] }))
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [700, 1400, 2400, 3400, 1100], rows }))
  children.push(new Paragraph({ text: '', spacing: { after: 120 } }))

  children.push(new Paragraph({ children: [normal('Общ брой учебни часове: ', 22), bold(String(d.totalHours), 22)], spacing: { after: 80 } }))
  children.push(new Paragraph({ children: [normal('………… часа по 6,29 евро на час — …………………… евро;', 22)] }))
  children.push(new Paragraph({ children: [normal('………… часа по 5,16 евро на час — …………………… евро;', 22)] }))
  children.push(new Paragraph({ children: [normal('………… часа по 4,62 евро на час — …………………… евро;', 22)] }))
  children.push(new Paragraph({ children: [normal('/ попълва се от декларатор / учител /', 16)], spacing: { after: 120 } }))

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
  rows: { date: string; group: string; subject: string; hours: number }[]
  totalHours: number
}

export async function generateLecturerDeclaration(d: LecturerDeclData) {
  const children: any[] = []
  const dots = (n: number) => '.'.repeat(n)

  children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'По Образец 3', bold: true, size: 20 })], spacing: { after: 120 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Д Е К Л А Р А Ц И Я', bold: true, size: 26 })], spacing: { after: 160 } }))

  children.push(new Paragraph({ children: [normal('Долуподписаният/та ', 22), bold(d.teacherName, 22), normal(' ' + dots(20), 22)], spacing: { after: 10 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(име, презиме, фамилия)', italics: true, size: 16 })], spacing: { after: 60 } }))
  children.push(new Paragraph({ children: [normal(`${d.position || 'Учител/старши учител на ДУИ'}, образование ${dots(20)}`, 22)], spacing: { after: 120 } }))

  children.push(new Paragraph({ children: [
    bold('ДЕКЛАРИРАМ, че ', 22),
    normal(`за периода ${d.periodLabel} 2026 година, съм взел/а следните часове над минималната норма задължителна преподавателска работа, съгласно ${d.orderRef}`, 22),
  ], spacing: { after: 160 } }))

  const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const th = (t: string) => new TableCell({ borders: CELLS, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(t, 18)] })] })
  const td = (t: string, c = false) => new TableCell({ borders: CELLS, children: [new Paragraph({ alignment: c ? AlignmentType.CENTER : AlignmentType.LEFT, children: [normal(t, 18)] })] })
  const rows: TableRow[] = [ new TableRow({ children: [th('№ по ред'), th('Дата'), th('Група'), th('Предмет'), th('Брой часове')] }) ]
  d.rows.forEach((r, i) => {
    rows.push(new TableRow({ children: [
      td(String(i + 1), true), td(r.date, true), td(r.group, true), td(r.subject), td(String(r.hours), true),
    ] }))
  })
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [700, 1600, 1400, 3600, 1000], rows }))
  children.push(new Paragraph({ text: '', spacing: { after: 60 } }))

  children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [normal('Общ брой учебни часове: ', 22), bold(String(d.totalHours), 22)], spacing: { after: 160 } }))
  children.push(new Paragraph({ children: [normal('………… часа по 6,29 евро на час - …………………… евро;', 22)] }))
  children.push(new Paragraph({ children: [normal('………… часа по 5,16 евро на час - …………………… евро;', 22)] }))
  children.push(new Paragraph({ children: [normal('………… часа по 4,62 евро на час - …………………… евро;', 22)], spacing: { after: 200 } }))

  children.push(new Paragraph({ children: [normal('Известно ми е, че при деклариране на неверни данни в настоящата декларация, нося наказателна отговорност съгласно законите на Република България.', 20)], spacing: { after: 200 } }))

  children.push(new Paragraph({ children: [normal(`Дата: ${dots(18)} 2026 г.                    `, 22), bold('ДЕКЛАРАТОР: ', 22), normal(dots(20), 22)], spacing: { after: 10 } }))
  children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: '/подпис/', italics: true, size: 18 })], spacing: { after: 160 } }))

  children.push(new Paragraph({ children: [normal('Посочените часове са действително проведени и са вписани в дневника на класа.', 20)], spacing: { after: 80 } }))
  children.push(new Paragraph({ children: [normal(`Дата: ${dots(18)} 2026 г.                    `, 22), bold('Проверил: ', 22), normal(dots(20), 22)], spacing: { after: 10 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(ЗДУД)', italics: true, size: 18 })], spacing: { after: 200 } }))

  children.push(new Paragraph({ children: [normal(`Сумата е проверена, начислена и изплатена по ведомост за месец ${dots(15)} 2026 г.`, 20)], spacing: { after: 80 } }))
  children.push(new Paragraph({ children: [bold('Счетоводител: ', 22), normal(dots(20), 22)] }))

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `декларация_лекторски_${d.teacherName.replace(/\\s+/g, '_')}.docx`)
}
