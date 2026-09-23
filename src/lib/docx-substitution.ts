import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, ImageRun,
  Tab, TabStopType, LeaderType, VerticalAlign, TableLayoutType, LineRuleType,
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
    ? 'На основание чл. 258, ал. 1 от Закона за предучилищното и училищното образование, във връзка с чл. 110 от Кодекса на труда и чл. 5, ал. 2 от Наредбата за финансиране на институциите в системата на предучилищното и училищното образование, във връзка '
    : 'На основание чл. 258, ал. 1 от Закона за предучилищното и училищното образование, във връзка с чл. 259, ал. 1 от Кодекса на труда и чл. 5 от Наредбата за финансиране на институциите в системата на предучилищното и училищното образование, във връзка '
  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [
    normal(baseText, 22), normal(/^[сСзЗ]/.test(d.leaveRef) ? 'с ' : 'със ', 22), bold(d.leaveRef, 22),
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
    P('3. Проведените часове по заместването да се изплатят на заместващия педагогически специалист като лекторски часове.')
    children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: [
      normal('4. Източник на финансиране: ', 22),
      bold(d.isBsch ? 'Национална програма „Без свободен час", Модул 1.' : 'бюджет на ЦСОП (собствени средства).', 22),
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
    d.substitutes!.forEach((sb, i) => children.push(new Paragraph({ spacing: { after: 60 }, children: [normal(`${i + 1}. ${sb.name} – заместващ     ..............................`, 22)] })))
    const k = d.substitutes!.length + 1
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
// ═══ МЕСЕЧНА справка-декларация за ЗАМЕСТВАНЕ ═══
export interface MonthlyDeclData {
  substituteName: string
  substitutePosition: string
  monthName: string
  year: number
  yearName: string
  rows: { date: string; orderRef: string; cls: string; subject: string; hours: number; bsch: boolean; kt: string; absentName: string }[]
  totalHours: number
  periodFrom?: string
  periodTo?: string
}

// НП вариант (само НП редове) — точно по бланката Приложение № 2 (Times New Roman 12, полета и таблица като образеца)
export async function generateMonthlyNPDeclaration(d: MonthlyDeclData) {
  const rows = d.rows.filter(r => r.bsch)
  const total = rows.reduce((a, r) => a + r.hours, 0)
  const F = 'Times New Roman'
  const TEXT_W = 9214                        // ширина на текста между полетата (като образеца)
  const t = (text: string, o: any = {}) => new TextRun({ text, font: F, size: 24, ...o })
  const it = (text: string, size = 24) => new TextRun({ text, font: F, size, italics: true })
  const dotTab = () => new TextRun({ font: F, size: 24, children: [new Tab()] })
  const DOTS = [{ type: TabStopType.RIGHT, position: TEXT_W, leader: LeaderType.DOT }]
  const P = (children: any[], o: any = {}) => new Paragraph({ children, spacing: { after: 0, line: 276 }, ...o })
  const hint = (text: string) => P([it(text)], { alignment: AlignmentType.CENTER })

  const period = d.periodFrom && d.periodTo
    ? `${formatDate(d.periodFrom)} – ${formatDate(d.periodTo)}`
    : d.monthName.replace(/^периода\s*/, '')

  const children: any[] = []
  // горе вдясно
  children.push(P([it('Приложение № 2')], { alignment: AlignmentType.RIGHT }))
  children.push(P([it('Справка - декларация по Модул 1 и Модул 2')], { alignment: AlignmentType.RIGHT, spacing: { after: 240 } }))

  // институция
  children.push(P([t('Център за специална образователна подкрепа – гр. Варна', { bold: true })], { alignment: AlignmentType.CENTER }))
  children.push(hint('( детска градина/училище/ЦСОП/ЦПЛР)'))
  children.push(P([t('ПК 9000, гр. Варна, община Варна, област Варна')], { spacing: { before: 120, after: 0 } }))
  children.push(P([t('ул. „Петко Стайнов“ № 7, тел.: 052 619 456, e-mail: info-400052@edu.mon.bg')], { spacing: { before: 120, after: 480 } }))

  // заглавие
  children.push(P([t('С П Р А В К А   –   Д Е К Л А Р А Ц И Я', { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 120 } }))
  children.push(P([t('за възнаграждение на учител за реално взетите учебни/астрономически часове')], { alignment: AlignmentType.CENTER, spacing: { after: 60 } }))
  children.push(P([t('по Националната програма „Без свободен час“ за 2026 г.,')], { alignment: AlignmentType.CENTER, spacing: { after: 60 } }))
  children.push(P([t('модул „Без свободен час в ЦСОП“')], { alignment: AlignmentType.CENTER, spacing: { after: 480 } }))

  // долуподписаният — редове с точки до края + пояснения
  children.push(P([t('Долуподписаният (ата) '), t(d.substituteName, { bold: true }), t(' '), dotTab()], { tabStops: DOTS }))
  children.push(hint('(име, презиме, фамилия)'))
  children.push(P([t('заемащ (а) длъжността '), t(d.substitutePosition || 'учител', { bold: true }), t(' '), dotTab()], { tabStops: DOTS }))
  children.push(hint('(наименование на длъжността)'))
  children.push(P([t('в '), t('ЦСОП – гр. Варна', { bold: true }), t(' '), dotTab()], { tabStops: DOTS }))
  children.push(hint('(училище/ЦСОП/ДГ/ЦПЛР)'))

  children.push(P([t('Д Е К Л А Р И Р А М ,', { bold: true })], { alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 } }))
  children.push(P([t('че за периода '), t(period, { bold: true }), t(' действително съм провел следните учебни/астрономически часове като заместващ на отсъстващ учител:')],
    { spacing: { after: 120, line: 360, lineRule: LineRuleType.AUTO } }))

  // таблица — колоните от образеца
  const COLS = [1300, 1750, 1250, 1750, 900, 2264]
  const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const cell = (i: number, lines: string[], bold = false, center = true) => new TableCell({
    borders: CELLS, width: { size: COLS[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: lines.map(l => new Paragraph({ alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 0, line: 252 }, children: [t(l, { size: 22, ...(bold ? { bold: true } : {}) })] })),
  })
  const head = new TableRow({ tableHeader: true, children: [
    cell(0, ['Дата'], true), cell(1, ['Заповед №… от…', 'Договор №… от…'], true), cell(2, ['Клас'], true),
    cell(3, ['Тема от учебното', '/образователното', 'съдържание'], true), cell(4, ['Брой', 'часове'], true), cell(5, ['Име на отсъстващия', 'учител'], true),
  ] })
  const body = rows.map(r => new TableRow({ children: [
    cell(0, [r.date]), cell(1, [r.orderRef]), cell(2, [r.cls]), cell(3, ['']), cell(4, [String(r.hours)]), cell(5, [r.absentName], false, false),
  ] }))
  children.push(new Table({ width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: COLS, layout: TableLayoutType.FIXED, rows: [head, ...body] }))

  // общо + цифром/словом
  children.push(P([t('Общ брой учебни/астрономически часове: '), t(String(total), { bold: true }), t(' х ………… EUR = ……………… EUR')], { spacing: { before: 240, after: 0 } }))
  children.push(P([dotTab()], { tabStops: DOTS, spacing: { before: 120, after: 0 } }))
  children.push(P([it('(цифром, словом)')], { alignment: AlignmentType.RIGHT, spacing: { after: 240 } }))

  children.push(P([t('Темите на преподаденото учебно /образователно съдържание са вписани в дневника на класа/групата.')], { alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 360, lineRule: LineRuleType.AUTO } }))
  children.push(P([t('Известно ми е, че при деклариране на неверни данни в настоящата декларация, нося отговорност съгласно законите на Република България.')], { alignment: AlignmentType.JUSTIFIED, spacing: { after: 480, line: 360, lineRule: LineRuleType.AUTO } }))

  // подписи
  children.push(P([t('Декларатор: '), dotTab()], { tabStops: DOTS }))
  const TABS2 = [{ type: TabStopType.CENTER, position: 4200 }, { type: TabStopType.CENTER, position: 8000 }]
  const tab = () => new TextRun({ font: F, size: 24, children: [new Tab()] })
  children.push(P([tab(), it('(личен подпис)'), tab(), it('(дата)')], { tabStops: TABS2, spacing: { after: 480 } }))
  children.push(P([t('Директор: '), dotTab()], { tabStops: DOTS }))
  children.push(P([tab(), it('(име, фамилия, подпис, кръгъл печат)'), tab(), it('(дата)')], { tabStops: TABS2 }))

  const doc = new Document({
    styles: { default: { document: { run: { font: F, size: 24 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 709, right: 1134, bottom: 567, left: 1701 } } }, children }],
  })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `декларация_НП_${period.replace(/\s+/g, '').replace(/[–.]/g, '-')}_${d.substituteName.replace(/\s+/g, '_')}.docx`)
}

// Бюджетен вариант (само бюджетните редове) — точно по бланката „По заместване / ДЕКЛАРАЦИЯ“
export async function generateMonthlyBudgetDeclaration(d: MonthlyDeclData) {
  const rows = d.rows.filter(r => !r.bsch)
  const total = rows.reduce((a, r) => a + r.hours, 0)
  const F = 'Times New Roman'
  const TEXT_W = 11906 - 1417 - 707          // 9782 — полетата от бланката
  const t = (text: string, o: any = {}) => new TextRun({ text, font: F, size: 20, ...o })
  const small = (text: string, o: any = {}) => new TextRun({ text, font: F, size: 16, ...o })
  const tab = () => new TextRun({ font: F, size: 20, children: [new Tab()] })
  const DOTS = [{ type: TabStopType.RIGHT, position: TEXT_W, leader: LeaderType.DOT }]
  const P = (children: any[], o: any = {}) => new Paragraph({ children, spacing: { after: 0, line: 276 }, ...o })
  const RULE = { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } }
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))]

  // месец: един месец → „септември“; повече → „септември – октомври“
  const MONTHS = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември']
  let monthLabel = d.monthName.replace(/^периода\s*/, '')
  if (d.periodFrom && d.periodTo) {
    const m1 = MONTHS[new Date(d.periodFrom + 'T00:00').getMonth()], m2 = MONTHS[new Date(d.periodTo + 'T00:00').getMonth()]
    monthLabel = m1 === m2 ? m1 : `${m1} – ${m2}`
  }
  const orders = uniq(rows.map(r => r.orderRef)).join(', ')
  const absent = uniq(rows.map(r => r.absentName)).join(', ')

  const children: any[] = []
  children.push(P([t('По заместване', { bold: true, underline: {} })], { alignment: AlignmentType.RIGHT, spacing: { after: 360 } }))
  children.push(P([new TextRun({ text: 'Д Е К Л А Р А Ц И Я', font: F, size: 24, bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))

  children.push(P([t('Долуподписаният/та '), t(d.substituteName, { bold: true }), t(' '), tab()], { tabStops: DOTS }))
  children.push(P([small('(име, презиме, фамилия)')], { alignment: AlignmentType.CENTER }))
  children.push(P([t('учител по …………………………………………………, образование ……………………………')], { spacing: { after: 60 } }))
  children.push(P([t('ДЕКЛАРИРАМ', { bold: true }), t(', '), t('че', { bold: true })], { spacing: { after: 60 } }))
  children.push(P([
    t('за месец '), t(monthLabel, { bold: true }), t(' 2026 година, съм взел/а следните часове над минималната норма задължителна преподавателска работа, съгласно Заповед № '),
    t(orders || '…………………', { bold: true }), t(' за заместване на отсъстващ учител '), t(absent || '…………………', { bold: true }), t('.'),
  ], { alignment: AlignmentType.JUSTIFIED, spacing: { after: 160 } }))

  // таблица — колоните от бланката
  const COLS = [554, 1850, 2000, 3064, 2314]
  const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const cell = (i: number, lines: string[], o: { bold?: boolean; align?: any; span?: number } = {}) => new TableCell({
    borders: CELLS, columnSpan: o.span, verticalAlign: VerticalAlign.CENTER,
    width: { size: o.span ? COLS.slice(i, i + o.span).reduce((a, x) => a + x, 0) : COLS[i], type: WidthType.DXA },
    margins: { top: 30, bottom: 30, left: 60, right: 60 },
    children: lines.map(l => new Paragraph({ alignment: o.align ?? AlignmentType.CENTER, spacing: { after: 0 }, children: [t(l, { size: 18, bold: !!o.bold })] })),
  })
  const trows: TableRow[] = [new TableRow({ tableHeader: true, children: [
    cell(0, ['№', 'по', 'ред']), cell(1, ['Дата']), cell(2, ['Паралелка – клас']), cell(3, ['Предмет']), cell(4, ['Брой', 'часове']),
  ] })]
  rows.forEach((r, i) => trows.push(new TableRow({ children: [
    cell(0, [String(i + 1)]), cell(1, [r.date]), cell(2, [r.cls]), cell(3, [r.subject], { align: AlignmentType.LEFT }), cell(4, [String(r.hours)]),
  ] })))
  // празни редове до минимум 5 — като в бланката
  for (let i = rows.length; i < 5; i++) trows.push(new TableRow({ children: [0, 1, 2, 3, 4].map(k => cell(k, [''])) }))
  trows.push(new TableRow({ children: [
    cell(0, [''], { span: 3 }), cell(3, ['Всичко:'], { align: AlignmentType.RIGHT }), cell(4, [String(total)], { bold: true }),
  ] }))
  children.push(new Table({ width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: COLS, layout: TableLayoutType.FIXED, rows: trows }))

  children.push(P([t('Общ брой учебни часове: '), t(String(total), { bold: true })], { alignment: AlignmentType.RIGHT, spacing: { before: 240, after: 160 } }))
  ;['6,29', '5,16', '4,62'].forEach(r => children.push(P([t(`………… часа по ${r} евро на час - ………………………… евро;`)], { spacing: { after: 100 } })))
  children.push(P([small('/ попълва се от декларатор/учител /')], { indent: { left: 1000 }, spacing: { after: 160 } }))

  children.push(P([t('Известно ми е, че при деклариране на неверни данни в настоящата декларация, нося наказателна отговорност съгласно законите на Република България.')], { alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 } }))

  // подписи — ляво дата, дясно роля (като бланката)
  const RIGHT_COL = [{ type: TabStopType.LEFT, position: 5500 }]
  children.push(P([t('………………………… 2026 година'), tab(), t('ДЕКЛАРАТОР:', { bold: true }), t('……………………')], { tabStops: RIGHT_COL, spacing: { after: 60 } }))
  children.push(P([tab(), t('         /подпис/')], { tabStops: RIGHT_COL, border: RULE, spacing: { after: 160 } }))
  children.push(P([t('Посочените часове са действително проведени и са вписани в дневника на класа.')], { spacing: { after: 160 } }))
  children.push(P([t('Дата: …………………2026г.'), tab(), t('Проверил:', { bold: true }), t('……………………')], { tabStops: RIGHT_COL, spacing: { after: 60 } }))
  children.push(P([tab(), t('         ЗДУД')], { tabStops: RIGHT_COL, spacing: { after: 360 } }))
  children.push(P([t('Сумата е проверена, начислена и изплатена по ведомост за месец ……………………… 2026г.')], { spacing: { after: 160 } }))
  children.push(P([t('………………………… 2026 година')], { border: RULE, spacing: { after: 120 } }))
  children.push(P([tab(), t('Главен счетоводител: ', { italics: true }), t('……………………')], { tabStops: [{ type: TabStopType.LEFT, position: 4500 }] }))

  const doc = new Document({
    styles: { default: { document: { run: { font: F, size: 20 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 709, right: 707, bottom: 851, left: 1417 } } }, children }],
  })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `декларация_бюджет_${monthLabel.replace(/\s+/g, '')}_${d.substituteName.replace(/\s+/g, '_')}.docx`)
}
// ═══ ЗАПОВЕД ЗА ПОЛЗВАНЕ НА ОТПУСК (образец №1 на НП „Без свободен час") ═══
export interface NpLeaveOrderData {
  orderNumber: string
  absentName: string
  absentPosition: string
  ktArticle: string        // 155/157/159/161/162/168/169/170/176
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

  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [
    normal('На основание чл. 259, ал. 1 от Закона за предучилищното и училищното образование, ', 22),
    normal(`${ktText.replace(/^чл\. \d+[^–]*– /, 'чл. ' + d.ktArticle + ' ')} от Глава осма, раздел I от Кодекса на труда`, 22),
    normal(` и подадено `, 22), bold(d.leaveRef || 'заявление', 22),
    normal(', както и във връзка с осигуряване на заместване по Национална програма „Без свободен час", Модул 1,', 22),
  ] }))

  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('РАЗРЕШАВАМ:', 24)], spacing: { after: 120 } }))

  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 }, children: [
    normal('Ползване на отпуск на ', 22),
    bold(`${d.absentName}${d.absentPosition ? ' – ' + d.absentPosition : ''}`, 22),
    normal(`, на основание ${ktText},`, 22),
  ] }))
  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 }, children: [
    normal('за периода от ', 22), bold(df, 22), normal(' до ', 22), bold(dt, 22),
    normal(` включително${d.workDays ? ` (${d.workDays} работни дни)` : ''}.`, 22),
  ] }))

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
      normal('        / Светлана Иванова /', 18),
      new TextRun({ text: `\t/ ${d.absentName} /`, size: 18 }),
    ],
  }))

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `заповед_отпуск_НП_${d.orderNumber.replace(/[^0-9]/g, '_')}.docx`)
}
// ═══ ОБЩА ЗАПОВЕД за ЛЕКТОРСКИ над норматив ═══
export interface LecturerFrameworkData {
  teachers: {
    name: string; position: string; norm: number; from: string; to: string
    rows: { subject: string; cls: string; days: string; perWeek: number; weeks: number; total: number }[]
    totalHours: number
  }[]
  yearName: string
  orderNumber?: string
}
export async function generateLecturerFrameworkOrder(d: LecturerFrameworkData) {
  const children: any[] = []
  header().forEach(p => children.push(p))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('ЗАПОВЕД', 28)], spacing: { before: 120, after: 40 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal(`№ ${d.orderNumber || '............'} / ............ ${(d.yearName || '').split('/')[0] || ''} г.`, 22)], spacing: { after: 160 } }))

  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [
    normal('На основание чл. 259, ал. 1 от Кодекса на труда, във връзка с чл. 4, ал. 11, чл. 10, ал. 2 и чл. 20, ал. 1, т. 1 от Наредба № 4 от 20.04.2017 г. за нормиране и заплащане на труда, Приложение № 1 към чл. 4, ал. 11 от същата наредба, утвърденото разпределение на преподавателската работа за учебната ', 22),
    bold(`${d.yearName} година`, 22),
    normal(', утвърденото седмично разписание и с оглед обезпечаване на образователния и терапевтичния процес в ЦСОП – гр. Варна,', 22),
  ] }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('НАРЕЖДАМ:', 24)], spacing: { after: 120 } }))
  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [
    normal('1. Възлагам на изброените педагогически специалисти провеждането на учебни/терапевтични часове над определената им минимална норма преподавателска работа, които се възлагат като лекторски часове, както следва:', 22),
  ] }))

  const B = { style: BorderStyle.SINGLE, size: 4, color: '888888' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const th = (t: string) => new TableCell({ borders: CELLS, shading: { type: ShadingType.CLEAR, fill: 'EDF2F7' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(t, 15)] })] })
  const td = (t: string, c = false) => new TableCell({ borders: CELLS, children: [new Paragraph({ alignment: c ? AlignmentType.CENTER : AlignmentType.LEFT, children: [normal(t, 15)] })] })

  d.teachers.forEach((t, ti) => {
    children.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [
      bold(`${ti + 1}. ${t.name}`, 20), normal(` – ${t.position}, минимална норма ${t.norm} ч./седмично. Общо `, 18),
      bold(`${t.totalHours} лекторски часа`, 18),
      normal(` за периода ${formatDate(t.from)} – ${formatDate(t.to)}:`, 18),
    ] }))
    const rows: TableRow[] = [ new TableRow({ children: [
      th('Предмет / дейност'), th('Клас / група'), th('Дни'), th('Ч./седм.'), th('Седмици'), th('Общо'),
    ] }) ]
    t.rows.forEach(r => rows.push(new TableRow({ children: [
      td(r.subject), td(r.cls, true), td(r.days), td(String(r.perWeek), true), td(String(r.weeks), true), td(String(r.total), true),
    ] })))
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [3000, 1800, 2400, 900, 900, 800], rows }))
  })

  const P = (t: string) => children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { before: 100, after: 60 }, children: [normal(t, 20)] }))
  P('2. Лекторските часове се провеждат съобразно утвърденото седмично разписание и утвърдената учебна документация.')
  P('3. Часовете се отчитат като действително проведени въз основа на съответната задължителна документация и установения в ЦСОП ред за отчитане.')
  P('4. За действително проведените и отчетени часове над минималната норма да се изплаща допълнително трудово възнаграждение съгласно чл. 20, ал. 1, т. 1 от Наредба № 4 от 20.04.2017 г. и Вътрешните правила за организация на работната заплата в ЦСОП – Варна.')
  P('5. Контрол по изпълнението на заповедта възлагам на заместник-директора по учебната дейност.')
  children.push(new Paragraph({ spacing: { before: 60, after: 240 }, children: [normal('Настоящата заповед да се доведе до знанието на заинтересованите лица за сведение и изпълнение.', 20)] }))

  children.push(new Paragraph({ children: [bold('ДИРЕКТОР ЦСОП: ', 22), normal('.............................', 22)] }))
  children.push(new Paragraph({ children: [normal('/ Светлана Иванова /', 20)], spacing: { after: 200 } }))
  children.push(new Paragraph({ children: [bold('Запознати:', 20)], spacing: { after: 60 } }))
  d.teachers.forEach((t, i) => children.push(new Paragraph({ spacing: { after: 50 }, children: [normal(`${i + 1}. ${t.name}     ..............................`, 18)] })))

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `заповед_лекторски_${(d.yearName || '').replace('/', '_')}.docx`)
}
