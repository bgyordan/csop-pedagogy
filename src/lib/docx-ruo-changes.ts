import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ImageRun, TabStopType,
} from 'docx'
import { saveAs } from 'file-saver'
import { CSOP_LOGO_B64, classNumber, classesLabel, toRoman } from './docx-generator'
import type { ClassChange, ChangeDetail, RuoStudent } from './ruo-changes'
import { detailKey } from './ruo-changes'

// Доклад до РУО за промени в паралелките — по бланката, по която се подават (изх. № 43/23.10.2026).
// Всяка променена паралелка е отделна точка (I, II, …) + таблица със състава след промяната.
// Липсващите номера излизат в жълто, за попълване на ръка.

const FONT = 'Times New Roman'
const SZ = 24
const ROMAN_POINTS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV',
  'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV']
const ORD = ['', 'първи', 'втори', 'трети', 'четвърти', 'пети', 'шести', 'седми', 'осми', 'девети', 'десети', 'единадесети', 'дванадесети']
const ROMAN_NUM: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 }
const DOTS = '…………'

const t = (text: string, o: { b?: boolean; i?: boolean; u?: boolean } = {}) =>
  new TextRun({ text, bold: o.b, italics: o.i, underline: o.u ? {} : undefined, font: FONT, size: SZ })
const val = (v: string | undefined | null) =>
  v && v.trim() ? t(v.trim()) : new TextRun({ text: DOTS, font: FONT, size: SZ, highlight: 'yellow' })

function gradeNum(ext: string): number | null {
  const n = classNumber(ext)
  if (n !== null) return n
  const m = (ext || '').trim().match(/^([IVX]+)/)
  return m && ROMAN_NUM[m[1]] ? ROMAN_NUM[m[1]] : null
}
const isPg = (ext: string) => /ПГ|подготв/i.test(ext || '')
function gradeCell(ext: string) {
  const n = gradeNum(ext)
  return n !== null ? toRoman(n) : (ext || '')
}
// „ученик от десети клас на СУ … — Варна“ / „дете от подготвителна група (ПГ) на ДГ …“
function whoIs(s: RuoStudent) {
  const school = s.school || DOTS
  if (isPg(s.externalClass) && gradeNum(s.externalClass) === null) return `дете от подготвителна група (ПГ) на ${school}`
  const n = gradeNum(s.externalClass)
  return n !== null && ORD[n] ? `ученик от ${ORD[n]} клас на ${school}` : `ученик на ${school}`
}
const classNo = (name: string) => name.trim().replace(/^0+(?=\d)/, '')
function classLabel(c: ClassChange) {
  const grades = classesLabel(c.studentsAfter.map(s => s.externalClass))
  return `№ ${classNo(c.className)}${grades ? `, ${grades}` : ''}`
}

const para = (children: TextRun[], o: { indent?: boolean; before?: number; after?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; keepNext?: boolean } = {}) =>
  new Paragraph({
    alignment: o.align ?? AlignmentType.JUSTIFIED,
    indent: o.indent === false ? undefined : { firstLine: 709 },
    spacing: { before: o.before ?? 0, after: o.after ?? 120 },
    keepNext: o.keepNext,
    children,
  })

function studentsTable(students: RuoStudent[], boldIds: Set<string>) {
  const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const borders = { top: B, bottom: B, left: B, right: B }
  const W = [624, 3515, 1300, 3627]
  const cell = (text: string, w: number, o: { b?: boolean; center?: boolean; keep?: boolean } = {}) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ keepNext: o.keep, alignment: o.center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [t(text, { b: o.b })] })],
  })
  const rows = [new TableRow({ tableHeader: true, cantSplit: true, children: [
    cell('№', W[0], { b: true, center: true, keep: true }), cell('Име, презиме, фамилия', W[1], { b: true, center: true, keep: true }),
    cell('Клас в училище', W[2], { b: true, center: true, keep: true }), cell('Записан в:', W[3], { b: true, center: true, keep: true }),
  ] })]
  students.forEach((s, i) => {
    const keep = i < students.length - 1
    rows.push(new TableRow({ cantSplit: true, children: [
      cell(`${i + 1}.`, W[0], { center: true, keep }), cell(s.name, W[1], { b: boldIds.has(s.id), keep }),
      cell(gradeCell(s.externalClass), W[2], { center: true, keep }), cell(s.school || '—', W[3], { keep }),
    ] }))
  })
  return new Table({ width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: W, rows })
}

export async function generateRuoChangesReport(opts: {
  yearName: string
  changes: ClassChange[]
  details: Record<string, ChangeDetail>
  outNumber?: string
  addresseeName?: string      // „ИРЕНА РАДЕВА“
  directorFullName?: string   // „Светлана Божинова Иванова“
}) {
  const year = opts.yearName.replace('-', '/')
  const addressee = opts.addresseeName || 'ИРЕНА РАДЕВА'
  const director = opts.directorFullName || 'Светлана Божинова Иванова'
  const lastName = addressee.trim().split(/\s+/).pop() || addressee
  const NORM = ' Броят на учениците след увеличението е в съответствие с изискванията на т. 3 от раздел IV по приложение № 7 към чл. 53 от Наредбата за финансирането на институциите в системата на предучилищното и училищното образование.'

  const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE }
  const children: (Paragraph | Table)[] = []

  // Шапка: лого + наименование
  children.push(new Table({
    width: { size: 9066, type: WidthType.DXA }, columnWidths: [1600, 7466], borders: NO_BORDERS,
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 1600, type: WidthType.DXA }, borders: NO_BORDERS, children: [new Paragraph({ children: [
        new ImageRun({ data: Buffer.from(CSOP_LOGO_B64, 'base64'), transformation: { width: 75, height: 75 }, type: 'jpg' }),
      ] })] }),
      new TableCell({ width: { size: 7466, type: WidthType.DXA }, borders: NO_BORDERS, verticalAlign: 'center' as any, children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Център за специална образователна подкрепа – гр. Варна', bold: true, font: FONT, size: 26 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ул. „Петко Стайнов” №7, e-mail:info-400052@edu.mon.bg, тел. 052 619 456,  0888 490 771', font: FONT, size: 18, underline: {} })] }),
      ] }),
    ] })],
  }))
  children.push(new Paragraph({ text: '' }))

  // ДО … / Изх. №
  children.push(new Paragraph({
    tabStops: [{ type: TabStopType.LEFT, position: 6300 }],
    children: [t('ДО', { b: true }), new TextRun({ text: '\tИзх. № ', font: FONT, size: SZ }),
      opts.outNumber?.trim() ? t(opts.outNumber.trim()) : new TextRun({ text: `……/……${new Date().getFullYear()}г.`, font: FONT, size: SZ, highlight: 'yellow' })],
  }))
  children.push(
    para([t(`Г-ЖА ${addressee.toUpperCase()}`, { b: true })], { indent: false, after: 0, align: AlignmentType.LEFT }),
    para([t('НАЧАЛНИК', { b: true })], { indent: false, after: 0, align: AlignmentType.LEFT }),
    para([t('НА РЕГИОНАЛНО УПРАВЛЕНИЕ', { b: true })], { indent: false, after: 0, align: AlignmentType.LEFT }),
    para([t('НА ОБРАЗОВАНИЕТО ГР. ВАРНА', { b: true })], { indent: false, after: 480, align: AlignmentType.LEFT }),
    para([t('Д О К Л А Д', { b: true })], { indent: false, after: 240, align: AlignmentType.CENTER }),
    para([t(`От ${director} -`, { b: true })], { indent: false, after: 0, align: AlignmentType.CENTER }),
    para([t('директор на Център за специална образователна подкрепа - Варна', { b: true })], { indent: false, after: 240, align: AlignmentType.CENTER }),
    para([t('Относно', { b: true, u: true }), t(':  '), t(`Промяна в организацията на групи и паралелки на деца и ученици със специални образователни потребности в ЦСОП – гр. Варна за учебната ${year} г.`, { i: true })], { after: 240 }),
    para([t(`УВАЖАЕМА ГОСПОЖО ${lastName.toUpperCase()},`, { b: true })], { indent: false, after: 240, align: AlignmentType.CENTER }),
  )

  opts.changes.forEach((c, idx) => {
    const p = `${ROMAN_POINTS[idx] || String(idx + 1)}.`
    const label = classLabel(c)
    const pupils = (n: number) => `${n} ${n === 1 ? 'ученик' : 'ученици'}`

    // Основният текст според вида на промяната
    let head: TextRun[]
    if (c.before === 0) {
      head = [t(p, { b: true }), t(` Моля да ми бъде разрешено през учебната ${year} г. сформиране на нова `), t(`паралелка ${label}`, { b: true }), t(` с ${pupils(c.after)}.`)]
    } else if (c.after === 0) {
      head = [t(p, { b: true }), t(' Уведомявам Ви, че паралелка '), t(label, { b: true }), t(`, която се състоеше от ${pupils(c.before)}, се закрива.`)]
    } else if (c.after > c.before) {
      head = [t(p, { b: true }), t(` Моля да ми бъде разрешено през учебната ${year} г. увеличаване на броя на учениците в паралелка `), t(label, { b: true }), t(` от ${c.before} на ${c.after}.${NORM}`)]
    } else if (c.after < c.before) {
      head = [t(p, { b: true }), t(' Уведомявам Ви, че паралелка '), t(label, { b: true }), t(`, която се състоеше от ${pupils(c.before)}, остава с ${pupils(c.after)}.`)]
    } else {
      head = [t(p, { b: true }), t(` Моля да ми бъде разрешена през учебната ${year} г. промяна в състава на паралелка `), t(label, { b: true }), t(` при запазване на броя на учениците (${c.after}).`)]
    }
    children.push(para(head, { before: 240, keepNext: true }))

    if (c.ins.length) {
      children.push(para([t('Учениците, които постъпват в паралелката, са:')], { keepNext: true }))
      c.ins.forEach((s, i) => {
        const runs = [t(`${i + 1}. ${s.name}`, { b: true }), t(`, ${whoIs(s)}`)]
        if (s.fromClass) {
          runs.push(t(` — преместен(а) от паралелка № ${classNo(s.fromClass)};`))
        } else {
          const d = opts.details[detailKey(s.id, 'in')]
          runs.push(t(' (заявление за записване от родител '), val(d?.parentName), t(' с вх. № '), val(d?.applicationNo),
            t(' в ЦСОП-Варна и заповед за насочване № '), val(d?.opinionNo), t(' от РЦПППО, гр. Варна и вх. № '),
            val(d?.opinionInNo), t(' за ЦСОП-Варна);'))
        }
        children.push(para(runs))
      })
    }
    if (c.outs.length) {
      children.push(para([t('От паралелката излизат:')], { keepNext: true }))
      c.outs.forEach((s, i) => {
        if (s.toClass) {
          children.push(para([t(`${i + 1}. ${s.name}`, { b: true }), t(` — преместен(а) в паралелка № ${classNo(s.toClass)};`)]))
        } else {
          const d = opts.details[detailKey(s.id, 'out')]
          children.push(para([t(`${i + 1}. ${s.name}`, { b: true }), t(`, ${whoIs(s)} — отписан(а) (заявление за отписване от родител с вх. № `),
            val(d?.applicationNo), t(' в ЦСОП-Варна и заповед № '), val(d?.orderNo), t(' на директора на ЦСОП – Варна);')]))
        }
      })
    }
    if (c.after > 0) {
      children.push(para([t(`${c.before === 0 ? 'Списък на учениците в паралелка' : 'Списък на учениците след промяната — паралелка'} ${label}:`)], { indent: false, keepNext: true, before: 120 }))
      children.push(studentsTable(c.studentsAfter, new Set(c.ins.map(s => s.id))))
    }
  })

  children.push(
    para([t('Промените ще бъдат отразени в списък-образец № 3.')], { before: 360, after: 720 }),
    para([t('Директор на ЦСОП – Варна')], { indent: false, after: 0, align: AlignmentType.LEFT }),
  )

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: SZ } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1418, right: 1134 } } }, children }],
  })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `Доклад_промени_групи_${opts.yearName.replace(/[^0-9]/g, '_')}.docx`)
}
