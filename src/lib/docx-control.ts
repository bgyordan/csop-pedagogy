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
import { MONTH_LABEL, PERIOD_LABEL, monthOrder, monthYear, type Analysis, type ControlPlan, type PlanItem, type Period } from './control-plan'

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
/** Сваля файла или връща blob (за „Към ПС“). */
async function out(doc: Document, file: string, asBlob?: boolean) {
  const blob = await Packer.toBlob(doc)
  if (!asBlob) saveAs(blob, file)
  return { blob, file }
}
const footer = (size = 16) => ({ default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ font: F, size, children: ['стр. ', PageNumber.CURRENT, ' от ', PageNumber.TOTAL_PAGES] })] })] }) })
const PORTRAIT = { page: { margin: { top: 1000, bottom: 1000, left: 1134, right: 1134 } } }
const dots = '..................................................................................................................'

export type ProtocolDoc = {
  check: ControlCheck; staff: CheckStaff[]; recs: Recommendation[]
  inspectorName: string; responsibleNames?: Record<string, string>
  origin?: { book_no: number | null; signed_at?: string | null } | null
}

export async function generateControlProtocol(d: ProtocolDoc) {
  const c = d.check
  const doc = new Document({ sections: [{ properties: PORTRAIT, footers: footer(), children: protocolChildren(d) }] })
  const file = c.book_no ? `Протокол_${c.book_no}_${c.check_date}.docx` : `Протокол_чернова_${c.check_date}.docx`
  return out(doc, file)
}

function protocolChildren(d: ProtocolDoc) {
  const c = d.check
  const draft = c.status === 'draft'
  const children: (Paragraph | Table)[] = []
  children.push(P([t(CENTER_NAME, { bold: true })], { alignment: AlignmentType.CENTER }))
  if (draft) children.push(P([t('ЧЕРНОВА — без номер, не е вписана в Книгата', { color: 'B91C1C', size: 18 })], { alignment: AlignmentType.CENTER }))
  children.push(P([t('КОНСТАТИВЕН ПРОТОКОЛ', { bold: true, size: 28 })], { alignment: AlignmentType.CENTER, spacing: { before: 240, after: 40 } }))
  children.push(P([t(c.book_no ? `№ ${c.book_no} / ${dmy(c.signed_at)} г.` : '№ ....... / ............ г.')], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))

  const what = c.subject ? c.subject : '..............................'
  children.push(P([
    t(`На ${dmy(c.check_date)} г. на основание ${c.basis || '..............................'} е извършен${c.subject ? genderEnd(c.subject) : c.form === 'observation' || c.form === 'study' ? 'о' : 'а'} `),
    t(what, { bold: true }), t('.'),
  ], { alignment: AlignmentType.JUSTIFIED }))
  children.push(P([t('Вид контрол: ', { bold: true }), t(`${KIND_LABEL[c.kind]}, ${FOCUS_LABEL[c.focus].toLowerCase()}; форма: ${FORM_LABEL[c.form].toLowerCase()}; ${c.planned ? 'по плана за контролната дейност' : 'извън плана'}; ${c.announced ? 'предварително оповестена' : 'без предварително уведомяване'}.`)]))
  if (d.origin && !c.subject.includes(`№ ${d.origin.book_no}`)) children.push(P([t('Последващ контрол ', { bold: true }), t(`по изпълнението на препоръките от констативен протокол № ${d.origin.book_no ?? '…'} / ${dmy(d.origin.signed_at)} г.`)]))
  if (c.purpose) children.push(P([t('Цел: ', { bold: true }), t(c.purpose)]))
  const checked = d.staff.map(s => `${name(s.staff)}${s.staff?.position ? ` — ${s.staff.position}` : ''}`).join('; ')
  children.push(P([t('Проверен/и: ', { bold: true }), t(checked || '..............................')]))
  DETAIL_FIELDS.forEach(f => { const v = c.details?.[f.k]; if (v) children.push(P([t(`${f.l}: `, { bold: true }), t(v)])) })
  if (c.method) children.push(P([t('Проверката е осъществена чрез: ', { bold: true }), t(c.method)]))

  const ev = c.evidence?.people?.filter(x => x.lines.length) || []
  if (ev.length) {
    children.push(P([t(`Справка от системата към ${dmy(c.evidence!.taken_at)} г.:`, { bold: true })], { spacing: { before: 120, after: 40 } }))
    ev.forEach(x => {
      if (ev.length > 1) children.push(P([t(x.name, { italics: true })], { spacing: { after: 20 } }))
      x.lines.forEach(l => children.push(P([t('– ' + l, { size: 20 })], { spacing: { after: 20 }, indent: { left: 280 } })))
    })
  }

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
  return children
}

export async function generateControlBook(d: {
  yearName: string
  rows: { no: number; signed: string; date: string; inspector: string; kind: string; subject: string; checked: string; summary: string; acked: string; voided: string | null }[]
  /** При приключване на годината — всички протоколи като приложения след книгата */
  protocols?: ProtocolDoc[]
  closedAt?: string | null
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
  const appendix = (d.protocols || []).map((pr, i) => ({
    properties: PORTRAIT, footers: footer(),
    children: [P([t(`Приложение № ${i + 1} към Книгата за контролната дейност`, { italics: true, size: 18 })], { alignment: AlignmentType.RIGHT }), ...protocolChildren(pr)],
  }))
  const doc = new Document({ sections: [{
    properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
    footers: footer(18),
    children: [
      P([t(CENTER_NAME, { bold: true })], { alignment: AlignmentType.CENTER }),
      P([t('КНИГА ЗА КОНТРОЛНАТА ДЕЙНОСТ НА ДИРЕКТОРА (ЗАМЕСТНИК-ДИРЕКТОРА)', { bold: true, size: 26 })], { alignment: AlignmentType.CENTER, spacing: { before: 160 } }),
      P([t(`Учебна ${d.yearName.replace('-', '/')} година`)], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }),
      table(COLS, rows),
      P([t(`Книгата съдържа ${d.rows.length} записа. ${d.protocols?.length ? `Констативните протоколи са приложени след книгата (${d.protocols.length} бр.).` : 'Констативните протоколи се съхраняват в класьора към книгата.'}`, { size: 20 })], { spacing: { before: 240 } }),
      ...(d.closedAt ? [P([t(`Книгата е приключена на ${dmy(d.closedAt)} г.`, { size: 20 })])] : []),
      P([t('Директор: ........................................', {})], { spacing: { before: 360 } }),
    ],
  }, ...appendix] })
  return out(doc, d.protocols?.length ? `Книга_с_протоколите_${d.yearName}.docx` : `Книга_контролна_дейност_${d.yearName}.docx`)
}

// ── Годишен план ──────────────────────────────────────────────────────────────
export async function generateControlPlan(d: {
  plan: ControlPlan; items: PlanItem[]; yearName: string; ownerName: string; templates?: { id: string; name: string }[]; asBlob?: boolean
}) {
  const pl = d.plan
  const y = d.yearName.replace('-', '/')
  const children: (Paragraph | Table)[] = []
  children.push(P([t(CENTER_NAME, { bold: true })], { alignment: AlignmentType.CENTER }))
  children.push(P([t('УТВЪРЖДАВАМ:', { bold: true })], { alignment: AlignmentType.RIGHT, spacing: { before: 240, after: 0 } }))
  children.push(P([t('Директор: ........................')], { alignment: AlignmentType.RIGHT, spacing: { after: 0 } }))
  children.push(P([t(pl.order_ref ? pl.order_ref : 'Заповед № ............ / ............ г.')], { alignment: AlignmentType.RIGHT, spacing: { after: 240 } }))
  children.push(P([t('ПЛАН', { bold: true, size: 28 })], { alignment: AlignmentType.CENTER, spacing: { after: 20 } }))
  children.push(P([t(`ЗА КОНТРОЛНАТА ДЕЙНОСТ НА ${(pl.owner_title || 'проверяващия').toUpperCase()}`, { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 20 } }))
  children.push(P([t(`през учебната ${y} година`)], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))

  const part = (n: string, title: string, body: string | null) => {
    children.push(heading(`${n}. ${title}`))
    children.push(...(body?.trim() ? multiline(body) : [P([t(dots)])]))
  }
  part('I', 'Анализ на контролната дейност през предходната учебна година', pl.analysis)
  part('II', 'Цел и задачи', pl.goals)
  part('III', 'Обект и предмет на контрола', pl.objects)
  part('IV', 'Видове, форми и методи на контрол', pl.methods)

  children.push(heading('V. График на контролната дейност'))
  const COLS = [1300, 3900, 2200, 2238]
  const rows: TableRow[] = [new TableRow({ tableHeader: true, children: ['Срок', 'Обект и предмет', 'Вид / форма', 'Обхват'].map((h, i) => cell(COLS[i], h, { head: true, center: true })) })]
  const sorted = [...d.items].sort((a, b) => monthOrder(a.month) - monthOrder(b.month) || a.sort - b.sort)
  sorted.forEach(i => rows.push(new TableRow({ cantSplit: true, children: [
    cell(COLS[0], `${MONTH_LABEL[i.month]} ${monthYear(d.yearName, i.month)}`, { center: true }),
    cell(COLS[1], i.subject + (i.target > 1 ? ` (${i.target} проверки)` : '')),
    cell(COLS[2], `${KIND_LABEL[i.kind]}, ${FOCUS_LABEL[i.focus].toLowerCase()}\n${FORM_LABEL[i.form].toLowerCase()}`),
    cell(COLS[3], i.scope || ''),
  ] })))
  if (!sorted.length) rows.push(new TableRow({ children: [cell(COLS[0] + COLS[1] + COLS[2] + COLS[3], '—', { span: 4, center: true })] }))
  children.push(table(COLS, rows))

  part('VI', 'Отчитане на резултатите', pl.reporting)
  children.push(P([t(`Изготвил: ${pl.owner_title || ''} ........................  / ${d.ownerName} /`)], { spacing: { before: 400 } }))

  const doc = new Document({ sections: [{
    properties: PORTRAIT, footers: footer(),
    children,
  }] })
  return out(doc, `План_контролна_дейност_${d.yearName}_${d.ownerName.replace(/\s+/g, '_')}.docx`, d.asBlob)
}

// ── Анализ / доклад за ПС ──────────────────────────────────────────────────────
export async function generateControlAnalysis(d: {
  yearName: string; period: Period; who: string; analysis: Analysis; text: string; author: string; authorTitle?: string; asBlob?: boolean
}) {
  const a = d.analysis
  const y = d.yearName.replace('-', '/')
  const children: (Paragraph | Table)[] = []
  children.push(P([t(CENTER_NAME, { bold: true })], { alignment: AlignmentType.CENTER }))
  children.push(P([t('АНАЛИЗ', { bold: true, size: 28 })], { alignment: AlignmentType.CENTER, spacing: { before: 240, after: 20 } }))
  children.push(P([t(`НА КОНТРОЛНАТА ДЕЙНОСТ${d.who ? ` — ${d.who.toUpperCase()}` : ''}`, { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 20 } }))
  children.push(P([t(`за ${PERIOD_LABEL[d.period]} ${y} г.`)], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))

  children.push(heading('1. Обобщение'))
  children.push(...multiline(d.text))

  children.push(heading('2. Проверки в цифри'))
  const COLS = [6000, 3638]
  const kv = (rows: (readonly [string, number | string])[]) => table(COLS, rows.map(([k, v]) => new TableRow({ children: [cell(COLS[0], k), cell(COLS[1], String(v), { center: true })] })))
  children.push(kv([
    ['Подписани констативни протоколи', a.total], ['— по плана', a.planned], ['— извън плана', a.total - a.planned],
    ['Проверени служители', a.staff], ['Последващи проверки', a.followUps], ['Протоколи с възражение', a.objections],
    ...(a.plan.total ? [['Дейности от графика с изтекъл срок — изпълнени изцяло', `${a.plan.done} от ${a.plan.due}`] as const] : []),
    ...a.byKind.map(([l, n]) => [`Вид: ${l.toLowerCase()}`, n] as const),
    ...a.byForm.map(([l, n]) => [`Форма: ${l.toLowerCase()}`, n] as const),
  ]))

  if (a.weak.length || a.strong.length) {
    children.push(heading('3. Критерии'))
    const C = [6600, 3038]
    const rows: TableRow[] = [new TableRow({ tableHeader: true, children: [cell(C[0], 'Критерий', { head: true }), cell(C[1], 'Оценки', { head: true, center: true })] })]
    if (a.strong.length) {
      rows.push(new TableRow({ children: [cell(C[0] + C[1], 'Силни страни (изпълнено)', { bold: true, span: 2 })] }))
      a.strong.forEach(x => rows.push(new TableRow({ children: [cell(C[0], x.t), cell(C[1], `${x.high} от ${x.n}`, { center: true })] })))
    }
    if (a.weak.length) {
      rows.push(new TableRow({ children: [cell(C[0] + C[1], 'Области за подобрение (частично / не е изпълнено)', { bold: true, span: 2 })] }))
      a.weak.forEach(x => rows.push(new TableRow({ children: [cell(C[0], x.t), cell(C[1], `${x.low} от ${x.n}`, { center: true })] })))
    }
    children.push(table(C, rows))
  }

  if (a.rec.total) {
    children.push(heading(`${a.weak.length || a.strong.length ? '4' : '3'}. Препоръки`))
    children.push(kv([
      ['Дадени препоръки', a.rec.total], ['Изпълнени', a.rec.done], ['Отчетени, очакват потвърждение', a.rec.reported],
      ['Неизпълнени', a.rec.notDone], ['Отворени', a.rec.open], ['С изтекъл срок', a.rec.overdue],
    ]))
  }

  children.push(P([t(`Изготвил: ${d.authorTitle || ''} ........................  / ${d.author} /`)], { spacing: { before: 400 } }))
  const doc = new Document({ sections: [{
    properties: PORTRAIT, footers: footer(),
    children,
  }] })
  return out(doc, `Анализ_контролна_дейност_${d.yearName}_${d.period}.docx`, d.asBlob)
}

// ── Заповеди (без номер — номерът се взема от „Заповеди“ при завеждането) ─────
function orderHead(title: string) {
  return [
    P([t(CENTER_NAME, { bold: true })], { alignment: AlignmentType.CENTER }),
    P([t('З А П О В Е Д', { bold: true, size: 28 })], { alignment: AlignmentType.CENTER, spacing: { before: 360, after: 40 } }),
    P([t('№ РД-......... / ............... г.')], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }),
    ...(title ? [P([t(title, { italics: true })], { alignment: AlignmentType.CENTER, spacing: { after: 200 } })] : []),
  ]
}
function orderTail(o: { control: string; acquaint: string; director?: string }) {
  return [
    P([t(o.control)], { alignment: AlignmentType.JUSTIFIED, spacing: { before: 160 } }),
    P([t(o.acquaint)], { alignment: AlignmentType.JUSTIFIED }),
    P([t('ДИРЕКТОР: ........................................', { bold: true })], { spacing: { before: 480 } }),
    ...(o.director ? [P([t(`/ ${o.director} /`)], { indent: { left: 2400 } })] : []),
  ]
}

export async function generatePlanOrder(d: { yearName: string; ownerTitle: string; ownerName: string; director?: string }) {
  const y = d.yearName.replace('-', '/')
  const children = [
    ...orderHead('за утвърждаване на план за контролната дейност'),
    P([t(`На основание чл. 259, ал. 1 от Закона за предучилищното и училищното образование, чл. 31, ал. 1, т. 3 от Наредба № 15 от 22.07.2019 г. за статута и професионалното развитие на учителите, директорите и другите педагогически специалисти и във връзка с организацията на контролната дейност през учебната ${y} година`)], { alignment: AlignmentType.JUSTIFIED }),
    P([t('У Т В Ъ Р Ж Д А В А М:', { bold: true })], { alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 } }),
    P([t(`План за контролната дейност на ${d.ownerTitle.toLowerCase()} ${d.ownerName} за учебната ${y} година, неразделна част от настоящата заповед.`)], { alignment: AlignmentType.JUSTIFIED }),
    ...orderTail({
      control: 'Контролът по изпълнението на заповедта оставям за себе си.',
      acquaint: `Заповедта да се доведе до знанието на ${d.ownerName} и на педагогическите специалисти за сведение и изпълнение.`,
      director: d.director,
    }),
  ]
  const doc = new Document({ sections: [{ properties: PORTRAIT, children }] })
  return out(doc, `Заповед_утвърждаване_план_КД_${d.yearName}.docx`)
}

export async function generateRemedyOrder(d: {
  check: ControlCheck; recs: Recommendation[]; responsibleNames: Record<string, string>; inspectorName: string; director?: string
}) {
  const c = d.check
  const recs = d.recs.filter(r => r.text.trim() && r.status !== 'done')
  const COLS = [600, 5000, 1500, 2538]
  const children: (Paragraph | Table)[] = [
    ...orderHead('за отстраняване на констатирани пропуски'),
    P([t(`На основание чл. 259, ал. 1 от Закона за предучилищното и училищното образование и във връзка с констатациите в констативен протокол № ${c.book_no} / ${dmy(c.signed_at)} г. от проверка на ${dmy(c.check_date)} г. (${c.subject})`)], { alignment: AlignmentType.JUSTIFIED }),
    P([t('Н А Р Е Ж Д А М:', { bold: true })], { alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 } }),
    P([t('Да се отстранят констатираните пропуски, както следва:')]),
    table(COLS, [
      new TableRow({ tableHeader: true, children: [cell(COLS[0], '№', { head: true, center: true }), cell(COLS[1], 'Мярка', { head: true }), cell(COLS[2], 'Срок', { head: true, center: true }), cell(COLS[3], 'Отговорник', { head: true })] }),
      ...recs.map((r, i) => new TableRow({ cantSplit: true, children: [
        cell(COLS[0], String(i + 1), { center: true }), cell(COLS[1], r.text), cell(COLS[2], dmy(r.due_date), { center: true }),
        cell(COLS[3], (r.responsible_id && d.responsibleNames[r.responsible_id]) || ''),
      ] })),
    ]),
    ...orderTail({
      control: `Контролът по изпълнението на заповедта възлагам на ${c.inspector_title ? c.inspector_title.toLowerCase() + ' ' : ''}${d.inspectorName}. След изтичане на сроковете да се извърши последващ контрол.`,
      acquaint: 'Заповедта да се доведе до знанието на отговорните лица срещу подпис.',
      director: d.director,
    }),
  ]
  const doc = new Document({ sections: [{ properties: PORTRAIT, children }] })
  return out(doc, `Заповед_отстраняване_пропуски_КП_${c.book_no}.docx`)
}
