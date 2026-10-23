// Оценяване (ДТВ) — документите като Word: картите (във формата на ЦСОП), протокол на комисията,
// заповед за размерите (без номер — номерът се поставя при регистрирането) и таблица за счетоводството (Excel).
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
  TableLayoutType, VerticalAlign, ShadingType, Footer, PageNumber,
} from 'docx'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import {
  CENTER_NAME, CENTER_ADDRESS, GRP_LABEL, dmy, isoOf, num, money, pname, groupSum, sumScores,
  type Campaign, type EvalTemplate, type Member, type Participant, type Grp,
} from './evaluation'

const F = 'Times New Roman'
const t = (text: string, o: any = {}) => new TextRun({ text, font: F, size: 22, ...o })
const P = (children: TextRun[], o: any = {}) => new Paragraph({ spacing: { after: 80 }, ...o, children })
const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const CELLS = { top: B, bottom: B, left: B, right: B }
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NOCELLS = { top: NONE, bottom: NONE, left: NONE, right: NONE }

function cell(width: number, text: string, o: { head?: boolean; center?: boolean; bold?: boolean; span?: number; size?: number; plain?: boolean } = {}) {
  return new TableCell({
    borders: o.plain ? NOCELLS : CELLS, width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    columnSpan: o.span, margins: { top: 40, bottom: 40, left: 80, right: 80 },
    ...(o.head ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EEF1F6' } } : {}),
    children: String(text ?? '').split('\n').map(line => new Paragraph({
      alignment: o.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [t(line, { size: o.size || 21, bold: o.head || o.bold })],
    })),
  })
}
const table = (cols: number[], rows: TableRow[]) =>
  new Table({ width: { size: cols.reduce((a, x) => a + x, 0), type: WidthType.DXA }, columnWidths: cols, layout: TableLayoutType.FIXED, rows })
const footer = () => ({ default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ font: F, size: 18, children: ['стр. ', PageNumber.CURRENT, ' от ', PageNumber.TOTAL_PAGES_IN_SECTION] })] })] }) })
const PAGE = { page: { margin: { top: 900, bottom: 900, left: 1134, right: 1000 }, pageNumbers: { start: 1 } } }
const letterhead = () => [
  P([t(CENTER_NAME, { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
  P([t(CENTER_ADDRESS, { size: 18 })], { alignment: AlignmentType.CENTER, spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } } }),
]
async function save(doc: Document, file: string) { saveAs(await Packer.toBlob(doc), file) }
const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_')

export type CardInput = { p: Participant; template?: EvalTemplate | null }
export type DocCtx = { campaign: Campaign; yearName?: string | null; members: Member[] }

const yearLabel = (y?: string | null) => (y ? y.replace('-', '/') : '……/……')

function cardChildren(ctx: DocCtx, { p, template }: CardInput) {
  const crit = p.criteria || template?.criteria || []
  const s = p.final_scores || {}
  const has = p.final_total != null
  const out: (Paragraph | Table)[] = [...letterhead()]
  if (template?.adopted) out.push(P([t(template.adopted, { size: 20 })], { alignment: AlignmentType.CENTER, spacing: { after: 200 } }))
  out.push(P([t('КАРТА', { bold: true, size: 26 })], { alignment: AlignmentType.CENTER, spacing: { after: 40 } }))
  out.push(P([t(`${template?.title || 'ЗА ОПРЕДЕЛЯНЕ НА ДОПЪЛНИТЕЛНО ТРУДОВО ВЪЗНАГРАЖДЕНИЕ ЗА ПОСТИГНАТИ РЕЗУЛТАТИ ОТ ТРУДА'} В ЦСОП – ВАРНА ЗА УЧЕБНАТА ${yearLabel(ctx.yearName)} ГОДИНА`, { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))
  out.push(P([t('Име: '), t(pname(p.staff), { bold: true })]))
  out.push(P([t('Длъжност: '), t(p.position || p.staff?.position || '')], { spacing: { after: 160 } }))
  const W = [800, 6300, 1300, 1300]
  const rows: TableRow[] = [new TableRow({ tableHeader: true, children: [
    cell(W[0], '№', { head: true, center: true }), cell(W[1], template?.col_label || 'Показатели и критерии', { head: true, center: true }),
    cell(W[2], 'Макс. брой точки', { head: true, center: true }), cell(W[3], 'Точки на лицето', { head: true, center: true }),
  ] })]
  crit.forEach(g => {
    rows.push(new TableRow({ children: [cell(W[0], g.n, { bold: true, center: true }), cell(W[1], g.g, { bold: true }), cell(W[2], num(g.max), { bold: true, center: true }), cell(W[3], has ? num(groupSum(g, s)) : '', { bold: true, center: true })] }))
    g.items.forEach(it => rows.push(new TableRow({ children: [cell(W[0], it.k, { center: true }), cell(W[1], it.t), cell(W[2], num(it.max), { center: true }), cell(W[3], has ? num(s[it.k]) : '', { center: true })] })))
  })
  rows.push(new TableRow({ children: [cell(W[0], ''), cell(W[1], 'ОБЩ БРОЙ ТОЧКИ', { bold: true }), cell(W[2], num(crit.reduce((a, g) => a + Number(g.max), 0)), { bold: true, center: true }), cell(W[3], has ? num(sumScores(crit, s)) : '', { bold: true, center: true })] }))
  out.push(table(W, rows))
  out.push(P([t('')], { spacing: { after: 120 } }))
  // подписите: за директора — само директорът
  if (p.evaluator === 'director') {
    out.push(P([t('Оценил: Директор: ……………………………………  …………………')], { spacing: { before: 200 } }))
  } else {
    const chair = ctx.members.find(m => m.role === 'chair')
    const others = ctx.members.filter(m => m.role !== 'chair').sort((a, b) => a.sort - b.sort)
    out.push(P([t('Комисия:', { bold: true })], { spacing: { before: 200 } }))
    out.push(P([t(`Председател:   ${chair ? pname(chair.staff) : '……………………………………'}   …………………`)]))
    others.forEach((m, i) => out.push(P([t(`${i === 0 ? 'Членове:' : '               '}       ${i + 1}. ${pname(m.staff)}   …………………`)])))
  }
  out.push(P([t(`Дата: ${p.finalized_at ? dmy(isoOf(p.finalized_at)) : '…………………'} г.`)], { spacing: { before: 120 } }))
  out.push(P([t(`Запознат/а с оценката: …………………………… /подпис/   Дата: ${p.acked_at ? dmy(isoOf(p.acked_at)) : '………………'}`)], { spacing: { before: 240 } }))
  if (p.objection) {
    out.push(P([t('Възражение: ', { bold: true }), t(`${p.objection} (${dmy(isoOf(p.objection_at))})`)], { spacing: { before: 200 } }))
    if (p.decision) out.push(P([t('Решение по възражението: ', { bold: true }), t(`${p.decision} (${dmy(isoOf(p.decided_at))})${p.decision_changed ? ' — точките са променени.' : ''}`)]))
  }
  return out
}

/** Една или много карти — всяка на нова страница, с отделна номерация. */
export async function generateCards(ctx: DocCtx, cards: CardInput[], file?: string) {
  const doc = new Document({ sections: cards.map(c => ({ properties: PAGE, footers: footer(), children: cardChildren(ctx, c) })) })
  await save(doc, file || (cards.length === 1 ? `Карта_ДТВ_${safe(pname(cards[0].p.staff))}.docx` : `Карти_ДТВ_${safe(yearLabel(ctx.yearName).replace('/', '-'))}.docx`))
}

/** Протокол на комисията: резултатите по групи, възраженията и решенията. */
export async function generateProtocol(ctx: DocCtx, parts: Participant[]) {
  const c = ctx.campaign
  const chair = ctx.members.find(m => m.role === 'chair')
  const others = ctx.members.filter(m => m.role !== 'chair').sort((a, b) => a.sort - b.sort)
  const out: (Paragraph | Table)[] = [...letterhead()]
  out.push(P([t('ПРОТОКОЛ', { bold: true, size: 28 })], { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 } }))
  out.push(P([t(`№ ${c.protocol_no || '……'} / ${c.protocol_date ? dmy(c.protocol_date) : '…………'} г.`)], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))
  out.push(P([
    t(`Днес, ${c.protocol_date ? dmy(c.protocol_date) : '…………'} г., комисията за оценяване на постигнатите резултати от труда, определена ${c.basis || 'с решение на педагогическия съвет (Протокол № …… от …………)'}, в състав: председател ${chair ? pname(chair.staff) : '……………'}`),
    t(others.length ? ` и членове ${others.map(m => pname(m.staff)).join(', ')},` : ','),
    t(` на основание Наредба № 4 от 20.04.2017 г. за нормирането и заплащането на труда и Вътрешните правила за определяне на допълнителното трудово възнаграждение за постигнати резултати от труда в ЦСОП – Варна, извърши оценяване на резултатите от труда за учебната ${yearLabel(ctx.yearName)} година чрез попълване на карта за всяко лице.`),
  ], { alignment: AlignmentType.JUSTIFIED }))
  if (c.aggregate === 'avg') out.push(P([t('Точките по всеки критерий са средноаритметични от оценките на членовете на комисията.')]))
  out.push(P([t('Резултати:', { bold: true })], { spacing: { before: 160 } }))
  const W = [600, 3600, 3400, 1300]
  ;(['ped', 'nonped'] as Grp[]).forEach(g => {
    const list = parts.filter(p => p.grp === g).sort((a, b) => pname(a.staff).localeCompare(pname(b.staff), 'bg'))
    if (!list.length) return
    out.push(P([t(GRP_LABEL[g], { bold: true })], { spacing: { before: 160 } }))
    const rows = [new TableRow({ tableHeader: true, children: [cell(W[0], '№', { head: true, center: true }), cell(W[1], 'Име и фамилия', { head: true }), cell(W[2], 'Длъжност', { head: true }), cell(W[3], 'Точки', { head: true, center: true })] })]
    list.forEach((p, i) => rows.push(new TableRow({ children: [
      cell(W[0], String(i + 1), { center: true }), cell(W[1], pname(p.staff) + (p.evaluator === 'director' ? ' *' : '')), cell(W[2], p.position || p.staff?.position || ''), cell(W[3], num(p.final_total), { center: true }),
    ] })))
    out.push(table(W, rows))
  })
  if (parts.some(p => p.evaluator === 'director')) out.push(P([t('* Оценен/а от директора (заместник-директор или член на комисията).', { size: 19 })], { spacing: { before: 80 } }))
  const obj = parts.filter(p => p.objection)
  out.push(P([t('Възражения: ', { bold: true }), t(obj.length ? '' : 'не са постъпили.')], { spacing: { before: 200 } }))
  obj.forEach((p, i) => out.push(P([t(`${i + 1}. ${pname(p.staff)} — ${p.objection}. Решение: ${p.decision || '…………'}${p.decision_changed ? ` (окончателно: ${num(p.final_total)} т.)` : ''}.`)])))
  out.push(P([t('Картите са подписани от комисията и предоставени на оценяваните лица. Картите, възраженията и решенията по тях се съхраняват в личните трудови досиета.')], { spacing: { before: 200 }, alignment: AlignmentType.JUSTIFIED }))
  out.push(P([t('Комисия:', { bold: true })], { spacing: { before: 300 } }))
  out.push(P([t(`Председател: ${chair ? pname(chair.staff) : '……………………'}   ……………………`)]))
  others.forEach((m, i) => out.push(P([t(`${i === 0 ? 'Членове:' : '             '}    ${i + 1}. ${pname(m.staff)}   ……………………`)])))
  const doc = new Document({ sections: [{ properties: PAGE, footers: footer(), children: out }] })
  await save(doc, `Протокол_комисия_ДТВ_${safe(yearLabel(ctx.yearName).replace('/', '-'))}.docx`)
}

export type PayRow = { p: Participant; eligible: boolean | null; why: string; amount: number | null; worked: number | null; sick: number | null }

/** Заповед за размерите на ДТВ (без номер) — с приложение по групи. */
export async function generateOrder(ctx: DocCtx & { director?: string }, rows: PayRow[]) {
  const c = ctx.campaign
  const out: (Paragraph | Table)[] = [...letterhead()]
  out.push(P([t('ЗАПОВЕД', { bold: true, size: 28 })], { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 } }))
  out.push(P([t('№ ……… / …………… г.')], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))
  out.push(P([t(`На основание чл. 259, ал. 1 от Закона за предучилищното и училищното образование, Наредба № 4 от 20.04.2017 г. за нормирането и заплащането на труда, Вътрешните правила за определяне на допълнителното трудово възнаграждение за постигнати резултати от труда на педагогическите специалисти и на непедагогическия персонал в ЦСОП – Варна и Протокол № ${c.protocol_no || '……'} / ${c.protocol_date ? dmy(c.protocol_date) : '…………'} г. на комисията за оценяване`)], { alignment: AlignmentType.JUSTIFIED }))
  out.push(P([t('НАРЕЖДАМ:', { bold: true })], { alignment: AlignmentType.CENTER, spacing: { before: 200, after: 160 } }))
  out.push(P([t(`1. Да се изплати допълнително трудово възнаграждение за постигнати резултати от труда през учебната ${yearLabel(ctx.yearName)} година на служителите в размерите съгласно приложението към настоящата заповед, определени пропорционално на получения брой точки в картата за оценка спрямо общия брой точки в съответната група.`)], { alignment: AlignmentType.JUSTIFIED }))
  out.push(P([t('2. Възнагражденията да се изплатят до един месец от издаването на настоящата заповед.')]))
  out.push(P([t('3. Заповедта да се доведе до знанието на счетоводителя за изпълнение.')]))
  out.push(P([t('4. Контрол по изпълнението на заповедта възлагам на ……………………………………………')]))
  out.push(P([t('Директор: ……………………'), t(ctx.director ? `   ${ctx.director}` : '')], { spacing: { before: 400 } }))
  out.push(P([t('Приложение към Заповед № ……… / …………… г.', { bold: true })], { pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { after: 160 } }))
  const W = [500, 3000, 2700, 900, 1300]
  ;(['ped', 'nonped'] as Grp[]).forEach(g => {
    const list = rows.filter(r => r.p.grp === g && r.eligible && r.amount != null).sort((a, b) => pname(a.p.staff).localeCompare(pname(b.p.staff), 'bg'))
    if (!list.length) return
    out.push(P([t(GRP_LABEL[g], { bold: true })], { spacing: { before: 160 } }))
    const tr = [new TableRow({ tableHeader: true, children: [cell(W[0], '№', { head: true, center: true }), cell(W[1], 'Име и фамилия', { head: true }), cell(W[2], 'Длъжност', { head: true }), cell(W[3], 'Точки', { head: true, center: true }), cell(W[4], 'Сума, лв.', { head: true, center: true })] })]
    list.forEach((r, i) => tr.push(new TableRow({ children: [cell(W[0], String(i + 1), { center: true }), cell(W[1], pname(r.p.staff)), cell(W[2], r.p.position || ''), cell(W[3], num(r.p.final_total), { center: true }), cell(W[4], money(r.amount), { center: true })] })))
    const sum = list.reduce((a, r) => a + Number(r.amount || 0), 0)
    tr.push(new TableRow({ children: [cell(W[0], ''), cell(W[1], 'Общо', { bold: true }), cell(W[2], ''), cell(W[3], num(list.reduce((a, r) => a + Number(r.p.final_total || 0), 0)), { bold: true, center: true }), cell(W[4], money(sum), { bold: true, center: true })] }))
    out.push(table(W, tr))
  })
  const doc = new Document({ sections: [{ properties: PAGE, footers: footer(), children: out }] })
  await save(doc, `Заповед_ДТВ_${safe(yearLabel(ctx.yearName).replace('/', '-'))}.docx`)
}

/** Таблица за счетоводството. */
export function exportPayExcel(ctx: DocCtx, rows: PayRow[]) {
  const wb = XLSX.utils.book_new()
  const head = ['№', 'Име и фамилия', 'Длъжност', 'Група', 'Отработени дни', 'Дни болничен (недостиг)', 'Право', 'Основание', 'Точки', 'Сума, лв.']
  const data = rows.slice().sort((a, b) => a.p.grp.localeCompare(b.p.grp) || pname(a.p.staff).localeCompare(pname(b.p.staff), 'bg'))
    .map((r, i) => [i + 1, pname(r.p.staff), r.p.position || '', GRP_LABEL[r.p.grp], r.worked ?? '', r.sick ?? '', r.eligible === true ? 'да' : r.eligible === false ? 'не' : '?', r.why, Number(r.p.final_total || 0), r.amount ?? 0])
  const ws = XLSX.utils.aoa_to_sheet([head, ...data])
  ws['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 28 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 6 }, { wch: 36 }, { wch: 8 }, { wch: 11 }]
  XLSX.utils.book_append_sheet(wb, ws, 'ДТВ')
  XLSX.writeFile(wb, `ДТВ_суми_${safe(yearLabel(ctx.yearName).replace('/', '-'))}.xlsx`)
}
