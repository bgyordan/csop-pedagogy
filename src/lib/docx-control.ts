// Контролна дейност — констативен протокол и Книга за контролната дейност като Word.
// Протоколът се разпечатва и подписва от проверяващия и проверения (Наредба № 8, Приложение № 2);
// Книгата — с номерирани страници, за класьора и за приключване в НЕИСПУО.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
  PageOrientation, TableLayoutType, VerticalAlign, ShadingType, Footer, PageNumber,
} from 'docx'
import { saveAs } from 'file-saver'
import {
  CENTER_NAME, DETAIL_FIELDS, FORM_LABEL, KIND_LABEL, FOCUS_LABEL, scoreLabel, dmy,
  type ControlCheck, type CheckStaff, type Recommendation,
} from './control'

const F = 'Times New Roman'
const t = (text: string, o: any = {}) => new TextRun({ text, font: F, size: 22, ...o })
const P = (children: TextRun[], o: any = {}) => new Paragraph({ spacing: { after: 80 }, ...o, children })
const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const CELLS = { top: B, bottom: B, left: B, right: B }
const name = (p?: { first_name: string; last_name: string } | null) => (p ? `${p.first_name} ${p.last_name}` : '')

function cell(width: number, text: string, o: { head?: boolean; center?: boolean; bold?: boolean; span?: number } = {}) {
  return new TableCell({
    borders: CELLS, width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    columnSpan: o.span, margins: { top: 50, bottom: 50, left: 80, right: 80 },
    ...(o.head ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EEF1F6' } } : {}),
    children: String(text || '').split('\n').map(line => new Paragraph({
      alignment: o.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [t(line, { size: 20, bold: o.head || o.bold })],
    })),
  })
}
function table(cols: number[], rows: TableRow[]) {
  return new Table({ width: { size: cols.reduce((a, x) => a + x, 0), type: WidthType.DXA }, columnWidths: cols, layout: TableLayoutType.FIXED, rows })
}
const heading = (text: string) => P([t(text, { bold: true })], { spacing: { before: 200, after: 80 } })
const multiline = (s: string | null | undefined) => (s || '').split('\n').filter(x => x.trim()).map(x => P([t(x)]))
// „извършен/а/о“ според първата дума на предмета: проверка → а, наблюдение → о, контрол → —
const genderEnd = (s: string) => { const w = s.trim().split(/\s+/)[0]?.toLowerCase() || ''; return /а$|я$/.test(w) ? 'а' : /[еоию]$/.test(w) ? 'о' : '' }
const dots = '..................................................................................................................'

export async function generateControlProtocol(d: {
  check: ControlCheck; staff: CheckStaff[]; recs: Recommendation[]
  inspectorName: string; responsibleNames?: Record<string, string>
}) {
  const c = d.check
  const draft = c.status === 'draft'
  const children: (Paragraph | Table)[] = []
  children.push(P([t(CENTER_NAME, { bold: true })], { alignment: AlignmentType.CENTER }))
  if (draft) children.push(P([t('ЧЕРНОВА — без номер, не е вписана в Книгата', { color: 'B91C1C', size: 18 })], { alignment: AlignmentType.CENTER }))
  children.push(P([t('КОНСТАТИВЕН ПРОТОКОЛ', { bold: true, size: 28 })], { alignment: AlignmentType.CENTER, spacing: { before: 240, after: 40 } }))
  children.push(P([t(c.book_no ? `№ ${c.book_no} / ${dmy(c.signed_at)} г.` : '№ ....... / ............ г.')], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))

  const what = c.subject ? c.subject : '..............................'
  children.push(P([
    t(`На ${dmy(c.check_date)} г. на основание ${c.basis || '..............................'} е извършен${c.form === 'observation' || c.form === 'study' ? 'о' : 'а'} `),
    t(what, { bold: true }), t('.'),
  ], { alignment: AlignmentType.JUSTIFIED }))
  children.push(P([t('Вид контрол: ', { bold: true }), t(`${KIND_LABEL[c.kind]}, ${FOCUS_LABEL[c.focus].toLowerCase()}; форма: ${FORM_LABEL[c.form].toLowerCase()}; ${c.planned ? 'по плана за контролната дейност' : 'извън плана'}; ${c.announced ? 'предварително оповестена' : 'без предварително уведомяване'}.`)]))
  if (c.purpose) children.push(P([t('Цел: ', { bold: true }), t(c.purpose)]))
  const checked = d.staff.map(s => `${name(s.staff)}${s.staff?.position ? ` — ${s.staff.position}` : ''}`).join('; ')
  children.push(P([t('Проверен/и: ', { bold: true }), t(checked || '..............................')]))
  DETAIL_FIELDS.forEach(f => { const v = c.details?.[f.k]; if (v) children.push(P([t(`${f.l}: `, { bold: true }), t(v)])) })
  if (c.method) children.push(P([t('Проверката е осъществена чрез: ', { bold: true }), t(c.method)]))

  children.push(heading('I. Констатации'))
  const groups = (c.criteria || []).filter(g => g.items?.length)
  if (groups.length) {
    const COLS = [5000, 1500, 3138]
    const rows: TableRow[] = [new TableRow({ tableHeader: true, children: [cell(COLS[0], 'Критерий', { head: true }), cell(COLS[1], 'Степен', { head: true, center: true }), cell(COLS[2], 'Бележка', { head: true })] })]
    groups.forEach(g => {
      rows.push(new TableRow({ children: [cell(COLS[0] + COLS[1] + COLS[2], g.g, { bold: true, span: 3 })] }))
      g.items.forEach(it => {
        const f = c.findings?.[it.k] || {}
        rows.push(new TableRow({ cantSplit: true, children: [cell(COLS[0], it.t), cell(COLS[1], scoreLabel(f.s), { center: true }), cell(COLS[2], f.n || '')] }))
      })
    })
    children.push(table(COLS, rows))
    children.push(P([t('Степен: изпълнено / частично / не е изпълнено / неприложимо.', { size: 18, italics: true })], { spacing: { before: 60 } }))
  }
  if (c.findings_text) children.push(...multiline(c.findings_text))
  if (!groups.length && !c.findings_text) children.push(P([t(dots)]), P([t(dots)]))

  children.push(heading('II. Силни страни'))
  children.push(...(c.strengths ? multiline(c.strengths) : [P([t(dots)])]))
  children.push(heading('III. Изводи'))
  children.push(...(c.conclusions ? multiline(c.conclusions) : [P([t(dots)])]))

  children.push(heading('IV. Препоръки'))
  const recs = d.recs.filter(r => r.text.trim())
  if (recs.length) {
    const COLS = [600, 5838, 1600, 1600]
    children.push(table(COLS, [
      new TableRow({ tableHeader: true, children: [cell(COLS[0], '№', { head: true, center: true }), cell(COLS[1], 'Съдържание на препоръката', { head: true }), cell(COLS[2], 'Срок', { head: true, center: true }), cell(COLS[3], 'Отговорник', { head: true })] }),
      ...recs.map((r, i) => new TableRow({ cantSplit: true, children: [
        cell(COLS[0], String(i + 1), { center: true }), cell(COLS[1], r.text), cell(COLS[2], dmy(r.due_date), { center: true }),
        cell(COLS[3], (r.responsible_id && d.responsibleNames?.[r.responsible_id]) || ''),
      ] })),
    ]))
  } else children.push(P([t('Няма.')]))

  children.push(heading('V. Възражения'))
  const objections = d.staff.filter(s => s.objection)
  if (objections.length) objections.forEach(s => children.push(P([t(`${name(s.staff)} (${dmy(s.objection_at)}): `, { bold: true }), t(s.objection || '')])))
  else children.push(P([t(dots)]))

  children.push(P([t('Извършил проверката:', { bold: true })], { spacing: { before: 360 } }))
  children.push(P([t(`${c.inspector_title || ''}: ........................................   / ${d.inspectorName} /`)]))
  children.push(P([t('Запознат/и с констативния протокол:', { bold: true })], { spacing: { before: 280 } }))
  d.staff.forEach(s => children.push(P([t(`${name(s.staff)}: ........................................   дата: ................`)], { spacing: { before: 160 } })))

  const doc = new Document({ sections: [{
    properties: { page: { margin: { top: 1000, bottom: 1000, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ font: F, size: 16, children: ['стр. ', PageNumber.CURRENT, ' от ', PageNumber.TOTAL_PAGES] })] })] }) },
    children,
  }] })
  const file = c.book_no ? `Протокол_${c.book_no}_${c.check_date}.docx` : `Протокол_чернова_${c.check_date}.docx`
  saveAs(await Packer.toBlob(doc), file)
}

export async function generateControlBook(d: {
  yearName: string
  rows: { no: number; signed: string; date: string; inspector: string; kind: string; subject: string; checked: string; summary: string; acked: string; voided: string | null }[]
}) {
  const COLS = [600, 1200, 1400, 2000, 1700, 2800, 2200, 2400, 1100]   // A4 хоризонтално, сума 15400
  const head = ['№', 'Дата на КП', 'Дата на проверката', 'Проверяващ', 'Вид / форма', 'Предмет на проверката', 'Проверени', 'Кратки констатации / препоръки', 'Запознат']
  const rows = [
    new TableRow({ tableHeader: true, children: head.map((h, i) => cell(COLS[i], h, { head: true, center: true })) }),
    ...d.rows.map(r => new TableRow({ cantSplit: true, children: [
      cell(COLS[0], String(r.no), { center: true }), cell(COLS[1], r.signed, { center: true }), cell(COLS[2], r.date, { center: true }),
      cell(COLS[3], r.inspector), cell(COLS[4], r.kind), cell(COLS[5], r.voided ? `${r.subject}\nАНУЛИРАН: ${r.voided}` : r.subject),
      cell(COLS[6], r.checked), cell(COLS[7], r.summary), cell(COLS[8], r.acked, { center: true }),
    ] })),
  ]
  const doc = new Document({ sections: [{
    properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ font: F, size: 18, children: ['стр. ', PageNumber.CURRENT, ' от ', PageNumber.TOTAL_PAGES] })] })] }) },
    children: [
      P([t(CENTER_NAME, { bold: true })], { alignment: AlignmentType.CENTER }),
      P([t('КНИГА ЗА КОНТРОЛНАТА ДЕЙНОСТ НА ДИРЕКТОРА (ЗАМЕСТНИК-ДИРЕКТОРА)', { bold: true, size: 26 })], { alignment: AlignmentType.CENTER, spacing: { before: 160 } }),
      P([t(`Учебна ${d.yearName.replace('-', '/')} година`)], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }),
      table(COLS, rows),
      P([t(`Книгата съдържа ${d.rows.length} записа. Констативните протоколи се съхраняват в класьора към книгата.`, { size: 20 })], { spacing: { before: 240 } }),
      P([t('Директор: ........................................', {})], { spacing: { before: 360 } }),
    ],
  }] })
  saveAs(await Packer.toBlob(doc), `Книга_контролна_дейност_${d.yearName}.docx`)
}
