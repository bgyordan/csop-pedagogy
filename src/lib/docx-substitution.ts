import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType,
} from 'docx'
import { saveAs } from 'file-saver'
import { formatDate } from './utils'

function bold(text: string, size = 22): TextRun { return new TextRun({ text, bold: true, size }) }
function normal(text: string, size = 22): TextRun { return new TextRun({ text, size }) }
function header(): Paragraph[] {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Център за специална образователна подкрепа - гр. Варна', bold: true, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ул. „Петко Стайнов" №7, e-mail: info-400052@edu.mon.bg, тел. 052 619 456', size: 18, italics: true })] }),
    new Paragraph({ text: '' }),
  ]
}

export interface SubstOrderData {
  orderNumber: string
  orderDate: string
  absentName: string
  substituteName: string
  substitutePosition: string
  className: string
  leaveRef: string
  dateFrom: string
  dateTo: string
  zdudName: string
  yearName: string
  days: { date: string; items: { period: number; subject: string; cls: string }[] }[]
}

export async function generateSubstitutionOrder(d: SubstOrderData) {
  const children: any[] = []
  header().forEach(p => children.push(p))

  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('ЗАПОВЕД', 28)], spacing: { before: 120, after: 60 } }))
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [normal(`№ ${d.orderNumber}`, 22)], spacing: { after: 160 } }))

  const df = formatDate(d.dateFrom), dt = formatDate(d.dateTo)

  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [
    normal('На основание чл. 258, ал. 1 от Закона за предучилищното и училищното образование, във връзка с чл. 259 (или чл. 110) от Кодекса на труда, чл. 5 от Наредбата за финансиране на институциите в системата на предучилищното и училищното образование и поради отсъствие на титуляра ', 22),
    bold(d.absentName, 22),
    normal(` съгласно ${d.leaveRef},`, 22),
  ] }))

  children.push(new Paragraph({ children: [bold('ЗАПОВЯДВАМ:', 24)], spacing: { after: 120 } }))

  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: [
    normal('1. Възлагам на ', 22), bold(d.substituteName, 22),
    normal(`, на длъжност ${d.substitutePosition || 'учител'}, да извърши целодневно заместване в ${d.className}.`, 22),
  ] }))

  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: [
    normal('2. Заместването да се изрази в поемане на пълния дневен обем от часове съгласно утвърденото седмично разписание на отсъстващия титуляр, за периода от ', 22),
    bold(df, 22), normal(' до ', 22), bold(dt, 22), normal(', както следва:', 22),
  ] }))

  const B = { style: BorderStyle.SINGLE, size: 4, color: '999999' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const th = (t: string) => new TableCell({ borders: CELLS, shading: { type: ShadingType.CLEAR, fill: 'EEEEEE' }, children: [new Paragraph({ children: [bold(t, 18)] })] })
  const td = (t: string) => new TableCell({ borders: CELLS, children: [new Paragraph({ children: [normal(t, 18)] })] })
  const rows: TableRow[] = [ new TableRow({ children: [th('Дата'), th('Час'), th('Предмет'), th('Група/Паралелка')] }) ]
  d.days.forEach(day => {
    const items = [...day.items].sort((a, b) => a.period - b.period)
    if (items.length === 0) {
      rows.push(new TableRow({ children: [td(day.date), td('—'), td('няма часове'), td('—')] }))
      return
    }
    items.forEach((it, i) => {
      rows.push(new TableRow({ children: [
        td(i === 0 ? day.date : ''), td(`${it.period}.`), td(it.subject || '—'), td(it.cls || '—'),
      ] }))
    })
  })
  children.push(new Paragraph({ text: '', spacing: { after: 40 } }))
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [1800, 900, 4000, 2500], rows }))
  children.push(new Paragraph({ text: '', spacing: { after: 120 } }))

  const P = (t: string) => children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 }, children: [normal(t, 22)] }))
  P('3. Реално проведените часове по заместване, които са извън личната норма за задължителна заетост на заместващия учител, да се изплатят като лекторски часове.')
  P('4. Отчитането на часовете да се извърши в края на месеца въз основа на отразените данни в електронния дневник на ЦСОП и представена „Справка-декларация за действително взети лекторски часове при целодневно заместване".')
  P('5. Възнаграждението за един лекторски час да се изплати съгласно ВПРЗ на Центъра за съответната година.')
  children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 }, children: [
    normal('6. Контрол по изпълнението на заповедта възлагам на ', 22), bold(d.zdudName || '…………………', 22),
    normal(', заместник-директор.', 22),
  ] }))
  children.push(new Paragraph({ children: [normal('Настоящата заповед да се връчи на лицето и на счетоводството за изпълнение.', 22)], spacing: { after: 300 } }))
  children.push(new Paragraph({ children: [bold('ДИРЕКТОР ЦСОП: ', 22), normal('.................................', 22)] }))
  children.push(new Paragraph({ children: [normal('(подпис и печат)', 18)], spacing: { before: 40 } }))

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
