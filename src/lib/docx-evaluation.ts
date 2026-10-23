// Оценяване — документите като Word: картите (ДТВ във формата на ЦСОП; атестационна карта по прил. № 20),
// протоколи на комисията, заповеди (без номер — номерът се поставя при регистрирането), план за подкрепа
// и таблици (Excel) за счетоводството, анализа и регистъра.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
  TableLayoutType, VerticalAlign, ShadingType, Footer, PageNumber,
} from 'docx'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import {
  CENTER_NAME, CENTER_ADDRESS, GRP_LABEL, KIND_LABEL, EDU_LEVELS, PKS_LEVELS, dmy, isoOf, num, money, pname, groupSum, sumScores,
  scaleOf, finalGrade, attestResult,
  type Campaign, type EvalTemplate, type Member, type Participant, type Grp, type External, type Support, type Kind,
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
export type DocCtx = { campaign: Campaign; yearName?: string | null; members: Member[]; externals?: External[] }
const kindOf = (c: Campaign) => (c.kind || 'dtv') as Kind

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
  const self = !!ctx.campaign.self_assess
  const so = p.self_scores || {}
  const hasSelf = p.self_total != null
  const W = self ? [800, 5300, 1100, 1250, 1250] : [800, 6300, 1300, 1300]
  const extra = (v: string, o: any = {}) => (self ? [cell(W[3], v, o)] : [])
  const last = W[W.length - 1]
  const rows: TableRow[] = [new TableRow({ tableHeader: true, children: [
    cell(W[0], '№', { head: true, center: true }), cell(W[1], template?.col_label || 'Показатели и критерии', { head: true, center: true }),
    cell(W[2], 'Макс. брой точки', { head: true, center: true }), ...extra('Самооценка', { head: true, center: true }), cell(last, self ? 'Оценка на комисията' : 'Точки на лицето', { head: true, center: true }),
  ] })]
  crit.forEach(g => {
    rows.push(new TableRow({ children: [cell(W[0], g.n, { bold: true, center: true }), cell(W[1], g.g, { bold: true }), cell(W[2], num(g.max), { bold: true, center: true }), ...extra(hasSelf ? num(groupSum(g, so)) : '', { bold: true, center: true }), cell(last, has ? num(groupSum(g, s)) : '', { bold: true, center: true })] }))
    g.items.forEach(it => rows.push(new TableRow({ children: [cell(W[0], it.k, { center: true }), cell(W[1], it.t), cell(W[2], num(it.max), { center: true }), ...extra(hasSelf ? num(so[it.k]) : '', { center: true }), cell(last, has ? num(s[it.k]) : '', { center: true })] })))
  })
  rows.push(new TableRow({ children: [cell(W[0], ''), cell(W[1], 'ОБЩ БРОЙ ТОЧКИ', { bold: true }), cell(W[2], num(crit.reduce((a, g) => a + Number(g.max), 0)), { bold: true, center: true }), ...extra(hasSelf ? num(p.self_total) : '', { bold: true, center: true }), cell(last, has ? num(sumScores(crit, s)) : '', { bold: true, center: true })] }))
  out.push(table(W, rows))
  if (p.commission_comment) out.push(P([t('Коментар на комисията: ', { bold: true }), t(p.commission_comment)], { spacing: { before: 120 } }))
  out.push(P([t('')], { spacing: { after: 120 } }))
  // подписите: за директора — само директорът
  if (p.evaluator === 'director') {
    out.push(P([t('Оценил: Директор: ……………………………………  …………………')], { spacing: { before: 200 } }))
  } else {
    const chair = ctx.members.find(m => m.role === 'chair')
    out.push(P([t('Комисия:', { bold: true })], { spacing: { before: 200 } }))
    out.push(P([t(`Председател:   ${chair ? pname(chair.staff) : '……………………………………'}   …………………`)]))
    memberNames(ctx).forEach((n, i) => out.push(P([t(`${i === 0 ? 'Членове:' : '               '}       ${i + 1}. ${n}   …………………`)])))
  }
  out.push(P([t(`Дата: ${p.finalized_at ? dmy(isoOf(p.finalized_at)) : '…………………'} г.`)], { spacing: { before: 120 } }))
  out.push(P([t(`Запознат/а с оценката: …………………………… /подпис/   Дата: ${p.acked_at ? dmy(isoOf(p.acked_at)) : '………………'}`)], { spacing: { before: 240 } }))
  if (p.objection) {
    out.push(P([t('Възражение: ', { bold: true }), t(`${p.objection} (${dmy(isoOf(p.objection_at))})`)], { spacing: { before: 200 } }))
    if (p.decision) out.push(P([t('Решение по възражението: ', { bold: true }), t(`${p.decision} (${dmy(isoOf(p.decided_at))})${p.decision_changed ? ' — точките са променени.' : ''}`)]))
  }
  return out
}

/** Членовете без председателя — служителите и външните (с организацията) */
function memberNames(ctx: DocCtx) {
  const others = ctx.members.filter(m => m.role !== 'chair').sort((a, b) => a.sort - b.sort).map(m => pname(m.staff) + (m.org ? ` (${m.org})` : ''))
  const ext = (ctx.externals || []).slice().sort((a, b) => a.sort - b.sort).map(e => e.name + (e.org ? ` (${e.org})` : ''))
  return [...others, ...ext]
}
const short = (k: Kind) => (k === 'dtv' ? 'ДТВ' : k === 'attest' ? 'атестация' : 'оценка')

/** Една или много карти — всяка на нова страница, с отделна номерация. При атестиране — по прил. № 20. */
export async function generateCards(ctx: DocCtx, cards: CardInput[], file?: string) {
  const k = kindOf(ctx.campaign)
  const doc = new Document({ sections: cards.map(c => ({ properties: PAGE, footers: footer(), children: k === 'attest' ? attestChildren(ctx, c) : cardChildren(ctx, c) })) })
  const label = k === 'attest' ? 'Атестационна_карта' : k === 'dtv' ? 'Карта_ДТВ' : 'Карта_оценка'
  await save(doc, file || (cards.length === 1 ? `${label}_${safe(pname(cards[0].p.staff))}.docx` : `${label.replace('карта', 'карти').replace('Карта', 'Карти')}_${safe(yearLabel(ctx.yearName).replace('/', '-'))}.docx`))
}

const box = (on: boolean) => (on ? '☒' : '☐')
/** Атестационна карта (Приложение № 20 към чл. 82, ал. 1, т. 1 от Наредба № 15/2019) */
function attestChildren(ctx: DocCtx, { p, template }: CardInput) {
  const c = ctx.campaign
  const crit = p.criteria || template?.criteria || []
  const s = p.final_scores || {}, so = p.self_scores || {}
  const has = p.final_total != null, hasSelf = p.self_total != null
  const a = p.section_a || {}
  const scale = scaleOf(c)
  const out: (Paragraph | Table)[] = []
  out.push(P([t(template?.adopted || 'Приложение № 20 към чл. 82, ал. 1, т. 1', { size: 18, italics: true })], { alignment: AlignmentType.RIGHT }))
  out.push(P([t(template?.title || 'АТЕСТАЦИОННА КАРТА НА УЧИТЕЛ', { bold: true, size: 26 })], { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200 } }))
  out.push(P([t('Пълното наименование на институцията: '), t(CENTER_NAME, { bold: true })]))
  out.push(P([t('Атестиран: '), t(pname(p.staff), { bold: true })]))
  out.push(P([t('Длъжност: '), t(p.position || p.staff?.position || '')]))
  out.push(P([t(`Период за атестиране от: ${c.period_from ? dmy(c.period_from) : '…………'} до ${c.period_to ? dmy(c.period_to) : '…………'}`)], { spacing: { after: 160 } }))
  // Раздел А
  out.push(P([t('А. Съответствие с изискванията на длъжността', { bold: true })], { spacing: { before: 120 } }))
  const WA = [5200, 4500]
  const yn = (v?: string) => `Да ${box(v === 'yes')}   Не ${box(v === 'no')}`
  const ra = (l: string, v: string) => new TableRow({ children: [cell(WA[0], l), cell(WA[1], v)] })
  out.push(table(WA, [
    ra('1. Образование, ОКС, образователна и научна степен, научна степен', ''),
    ra('1.1 Първоначална', a.edu1 || EDU_LEVELS.map(x => `${box(false)} ${x}`).join('  ')),
    ra('1.2 Друга след първоначалната', a.edu2 || '—'),
    ra('2.1 По базовата специалност от висшето образование', a.specialty || ''),
    ra('2.2 Професионална квалификация „учител“', yn(a.teacher_q)),
    ra('2.3 Друга (нова/допълнителна) квалификация', yn(a.other_q) + (a.other_q_text ? ` — ${a.other_q_text}` : '')),
    ra('3. Последна придобита ПКС', a.pks || PKS_LEVELS.slice(1).map(x => `${box(false)} ${x}`).join('  ')),
    ra('4. Професионален опит / учителски стаж — години', `общ трудов стаж: ${a.years_total ?? '……'}   учителски стаж: ${a.years_teacher ?? '……'}`),
    ra('5.1 Задължителна вътрешноинституционална квалификация', `${a.hours_internal ?? '……'} академични часа`),
    ra('5.2 Задължителни часове / квалификационни кредити', `${a.hours_mandatory ?? '……'} академични часа · ${a.credits ?? '……'} кредита`),
    ra('6. Изпълнение на препоръките от последното атестиране', a.prev_recs === 'na' ? 'не е атестиран/а досега' : yn(a.prev_recs)),
  ]))
  // Раздел Б
  out.push(P([t('Б. Области на компетентност и критерии по тях', { bold: true })], { spacing: { before: 200 } }))
  const W = [800, 6100, 900, 950, 1050]
  const rows: TableRow[] = [new TableRow({ tableHeader: true, children: [
    cell(W[0], '№', { head: true, center: true }), cell(W[1], 'Критерии', { head: true, center: true }), cell(W[2], 'Макс.', { head: true, center: true }),
    cell(W[3], 'Само-оценка', { head: true, center: true }), cell(W[4], 'Оценка на комисията', { head: true, center: true }),
  ] })]
  let lastH = ''
  crit.forEach(g => {
    if (g.h && g.h !== lastH) { lastH = g.h; rows.push(new TableRow({ children: [cell(W.reduce((x, y) => x + y, 0), g.h, { bold: true, span: 5, head: true })] })) }
    rows.push(new TableRow({ children: [cell(W[0], g.n, { bold: true, center: true }), cell(W[1], `${g.g} (максимален брой т. ${num(g.max)})`, { bold: true }), cell(W[2], num(g.max), { bold: true, center: true }), cell(W[3], hasSelf ? num(groupSum(g, so)) : '', { bold: true, center: true }), cell(W[4], has ? num(groupSum(g, s)) : '', { bold: true, center: true })] }))
    g.items.forEach(it => rows.push(new TableRow({ children: [cell(W[0], it.k, { center: true }), cell(W[1], it.t), cell(W[2], num(it.max), { center: true }), cell(W[3], hasSelf ? num(so[it.k]) : '', { center: true }), cell(W[4], has ? num(s[it.k]) : '', { center: true })] })))
  })
  rows.push(new TableRow({ children: [cell(W[0], ''), cell(W[1], 'ОБЩ БРОЙ ТОЧКИ', { bold: true }), cell(W[2], num(crit.reduce((x, g) => x + Number(g.max), 0)), { bold: true, center: true }), cell(W[3], hasSelf ? num(p.self_total) : '', { bold: true, center: true }), cell(W[4], has ? num(p.final_total) : '', { bold: true, center: true })] }))
  out.push(table(W, rows))
  // Раздел В
  const res = p.result ?? attestResult(p.self_total, p.final_total)
  out.push(P([t('В. Крайна оценка: ', { bold: true }), t((p.grade || '……………………………').toUpperCase(), { bold: true })], { spacing: { before: 200 } }))
  out.push(P([t(`Самооценка — общ брой точки по критериите: СО = ${hasSelf ? num(p.self_total) : '……'}`)]))
  out.push(P([t(`Оценка на атестационната комисия — общ брой точки по критериите: ОАК = ${has ? num(p.final_total) : '……'}`)]))
  out.push(P([t(`Окончателен резултат: ОР = 0,25.СО + 0,75.ОАК = ${hasSelf && has ? `${num(0.25 * Number(p.self_total), 3)} + ${num(0.75 * Number(p.final_total), 3)} = ${num(res)} точки` : '……'}`)]))
  out.push(P([t('Скала: ' + scale.map(x => `${x.l} — от ${num(x.min)}`).join('; ') + '.', { size: 18 })], { spacing: { after: 120 } }))
  out.push(P([t('Коментар на атестационната комисия: ', { bold: true }), t(p.commission_comment || '…………………………………………………………………………………………')], { spacing: { before: 120 } }))
  const chair = ctx.members.find(m => m.role === 'chair')
  out.push(P([t(`Председател: ${chair ? pname(chair.staff) : '……………………………'}   …………………`)], { spacing: { before: 120 } }))
  memberNames(ctx).forEach((n, i) => out.push(P([t(`${i === 0 ? 'Членове:' : '            '}    ${i + 1}. ${n}   …………………`)])))
  out.push(P([t(`Дата: ${p.finalized_at ? dmy(isoOf(p.finalized_at)) : '…………………'}`)]))
  out.push(P([t('Коментар на атестирания педагогически специалист: ', { bold: true }), t(p.objection || '…………………………………………………………………………')], { spacing: { before: 200 } }))
  out.push(P([t(`Дата: ${p.objection_at ? dmy(isoOf(p.objection_at)) : '…………………'}     Подпис: ………………     ${pname(p.staff)}`)]))
  out.push(P([t('Забележка: Полето се попълва задължително, ако оценяваният желае да подаде възражение!', { size: 18, italics: true })]))
  out.push(P([t('Коментар на работодателя: ', { bold: true })], { spacing: { before: 200 } }))
  out.push(P([t(`Крайна оценка: ${(p.employer_grade || '……………………………').toUpperCase()}`)]))
  out.push(P([t(`Мотиви: ${p.employer_note || '…………………………………………………………………………'}`)]))
  out.push(P([t(`Дата: ${p.employer_at ? dmy(isoOf(p.employer_at)) : '…………………'}     Име и фамилия на работодателя: ………………………     Подпис: ………………`)]))
  out.push(P([t('Забележка: Ако атестираният е възразил, работодателят вписва крайната оценка, като може да потвърди или да промени с една степен крайната оценка на атестационната комисия.', { size: 18, italics: true })]))
  out.push(P([t(`Запознат/а с крайната оценка от атестирането: ${pname(p.staff)}     Подпис: ………………     Дата: ${p.acked_at ? dmy(isoOf(p.acked_at)) : '…………'}`)], { spacing: { before: 240 } }))
  if (template?.guide) {
    out.push(P([t('Скала за определяне на достигнатата степен на изпълнение на критериите', { bold: true })], { pageBreakBefore: true, spacing: { after: 120 } }))
    template.guide.split('\n').filter(l => l.trim() && !/^Скала за определяне/.test(l)).forEach(l => out.push(P([t(l, { size: 19, bold: !/^\d,\d/.test(l) && l.length < 220 })], { alignment: AlignmentType.JUSTIFIED })))
  }
  return out
}

/** Протокол на комисията: резултатите по групи, възраженията и решенията. */
export async function generateProtocol(ctx: DocCtx, parts: Participant[]) {
  const c = ctx.campaign
  const chair = ctx.members.find(m => m.role === 'chair')
  const out: (Paragraph | Table)[] = [...letterhead()]
  out.push(P([t('ПРОТОКОЛ', { bold: true, size: 28 })], { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 } }))
  out.push(P([t(`№ ${c.protocol_no || '……'} / ${c.protocol_date ? dmy(c.protocol_date) : '…………'} г.`)], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))
  const k = kindOf(c)
  const names = memberNames(ctx)
  out.push(P([
    t(`Днес, ${c.protocol_date ? dmy(c.protocol_date) : '…………'} г., ${k === 'dtv' ? 'комисията за оценяване на постигнатите резултати от труда' : k === 'attest' ? 'атестационната комисия' : 'комисията за оценяване'}, определена ${c.basis || (k === 'dtv' ? 'с решение на педагогическия съвет (Протокол № …… от …………)' : 'със заповед на директора № …… от …………')}, в състав: председател ${chair ? pname(chair.staff) : '……………'}`),
    t(names.length ? ` и членове ${names.join(', ')},` : ','),
    t(k === 'dtv'
      ? ` на основание Наредба № 4 от 20.04.2017 г. за нормирането и заплащането на труда и Вътрешните правила за определяне на допълнителното трудово възнаграждение за постигнати резултати от труда в ЦСОП – Варна, извърши оценяване на резултатите от труда за учебната ${yearLabel(ctx.yearName)} година чрез попълване на карта за всяко лице.`
      : k === 'attest'
        ? ` на основание Наредба № 15 от 22.07.2019 г. за статута и професионалното развитие на учителите, директорите и другите педагогически специалисти, извърши атестиране на педагогическите специалисти за периода ${c.period_from ? dmy(c.period_from) : '…………'} – ${c.period_to ? dmy(c.period_to) : '…………'}. Всеки член на комисията оцени самостоятелно атестираните по критериите в атестационната карта; окончателният резултат е ОР = 0,25.СО + 0,75.ОАК.`
        : ` извърши оценяване „${c.name}“ чрез попълване на карта за всяко лице.`),
  ], { alignment: AlignmentType.JUSTIFIED }))
  if (c.aggregate === 'avg') out.push(P([t('Точките по всеки критерий са средноаритметични от оценките на членовете на комисията.')]))
  out.push(P([t('Резултати:', { bold: true })], { spacing: { before: 160 } }))
  const W = [600, 3600, 3400, 1300]
  if (k === 'attest') {
    const WA = [500, 2600, 2300, 800, 800, 900, 2000]
    const rows = [new TableRow({ tableHeader: true, children: ['№', 'Име и фамилия', 'Длъжност', 'СО', 'ОАК', 'ОР', 'Крайна оценка'].map((h, i) => cell(WA[i], h, { head: true, center: i !== 1 && i !== 2 })) })]
    parts.slice().sort((a, b) => pname(a.staff).localeCompare(pname(b.staff), 'bg')).forEach((p, i) => rows.push(new TableRow({ children: [
      cell(WA[0], String(i + 1), { center: true }), cell(WA[1], pname(p.staff)), cell(WA[2], p.position || p.staff?.position || ''),
      cell(WA[3], num(p.self_total), { center: true }), cell(WA[4], num(p.final_total), { center: true }), cell(WA[5], num(p.result), { center: true }), cell(WA[6], finalGrade(p) || ''),
    ] })))
    out.push(table(WA, rows))
    const low = parts.filter(p => scaleOf(c).find(s => s.l === finalGrade(p))?.support)
    if (low.length) out.push(P([t(`За ${low.map(p => pname(p.staff)).join(', ')} комисията предлага план за методическа и организационна подкрепа и определяне на наставник.`)], { spacing: { before: 120 }, alignment: AlignmentType.JUSTIFIED }))
  }
  ;(k === 'attest' ? [] : (['ped', 'nonped'] as Grp[])).forEach(g => {
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
  names.forEach((n, i) => out.push(P([t(`${i === 0 ? 'Членове:' : '             '}    ${i + 1}. ${n}   ……………………`)])))
  const doc = new Document({ sections: [{ properties: PAGE, footers: footer(), children: out }] })
  await save(doc, `Протокол_комисия_${short(k)}_${safe(yearLabel(ctx.yearName).replace('/', '-'))}.docx`)
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

/** Заповед за определяне на комисията и графика (без номер). */
export async function generateCommissionOrder(ctx: DocCtx, count: number, secretary?: string | null) {
  const c = ctx.campaign
  const k = kindOf(c)
  const chair = ctx.members.find(m => m.role === 'chair')
  const out: (Paragraph | Table)[] = [...letterhead()]
  out.push(P([t('ЗАПОВЕД', { bold: true, size: 28 })], { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 } }))
  out.push(P([t('№ ……… / …………… г.')], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))
  out.push(P([t(k === 'attest'
    ? 'На основание чл. 259, ал. 1 от Закона за предучилищното и училищното образование и Наредба № 15 от 22.07.2019 г. за статута и професионалното развитие на учителите, директорите и другите педагогически специалисти'
    : k === 'dtv'
      ? `На основание чл. 259, ал. 1 от Закона за предучилищното и училищното образование, Наредба № 4 от 20.04.2017 г. за нормирането и заплащането на труда, Вътрешните правила за ДТВ в ЦСОП – Варна${c.basis ? ` и ${c.basis}` : ''}`
      : 'На основание чл. 259, ал. 1 от Закона за предучилищното и училищното образование')], { alignment: AlignmentType.JUSTIFIED }))
  out.push(P([t('ОПРЕДЕЛЯМ:', { bold: true })], { alignment: AlignmentType.CENTER, spacing: { before: 200, after: 160 } }))
  out.push(P([t(`1. ${k === 'attest' ? 'Атестационна комисия' : 'Комисия'} за ${k === 'attest' ? `атестиране на педагогическите специалисти за периода ${c.period_from ? dmy(c.period_from) : '…………'} – ${c.period_to ? dmy(c.period_to) : '…………'}` : k === 'dtv' ? `оценяване на постигнатите резултати от труда през учебната ${yearLabel(ctx.yearName)} година` : `„${c.name}“`} в състав:`)], { alignment: AlignmentType.JUSTIFIED }))
  out.push(P([t(`Председател: ${chair ? pname(chair.staff) + (chair.staff?.position ? ` — ${chair.staff.position}` : '') : '……………………'}`)], { indent: { left: 500 } }))
  out.push(P([t('Членове:')], { indent: { left: 500 } }))
  memberNames(ctx).forEach((n, i) => out.push(P([t(`${i + 1}. ${n}`)], { indent: { left: 900 } })))
  let n = 2
  if (k === 'attest') {
    out.push(P([t(`${n++}. Технически секретар: ${secretary || '……………………'} — обработва картите, въвежда точките и предоставя достъп до електронните карти на членовете.`)], { alignment: AlignmentType.JUSTIFIED }))
    out.push(P([t(`${n++}. Атестираните (${count} лица) да попълнят самооценката в атестационната карта и да подадат професионалното си портфолио ${c.self_by ? `до ${dmy(c.self_by)} г.` : 'в срок до 10 работни дни'} — в ЕИС („Оценяване → Моите карти“) или на хартия на техническия секретар.`)], { alignment: AlignmentType.JUSTIFIED }))
    out.push(P([t(`${n++}. Всеки член на комисията оценява самостоятелно и независимо от останалите членове, като вписва точките по всеки критерий в атестационната карта. Окончателният резултат е ОР = 0,25.СО + 0,75.ОАК.`)], { alignment: AlignmentType.JUSTIFIED }))
    out.push(P([t(`${n++}. Атестираният може да подаде писмено възражение до работодателя в срок до ${c.objection_days} работни дни от запознаването с оценката. Работодателят се произнася в срок до ${c.decide_days ?? 5} работни дни, като може да потвърди или да промени с една степен крайната оценка.`)], { alignment: AlignmentType.JUSTIFIED }))
  } else {
    out.push(P([t(`${n++}. Комисията да извърши оценяването ${c.score_by ? `до ${dmy(c.score_by)} г.` : 'в определения срок'} чрез попълване на карта за всяко лице (${count} лица) и да изготви протокол.`)], { alignment: AlignmentType.JUSTIFIED }))
    out.push(P([t(`${n++}. Картата се предоставя на лицето в срок до ${c.card_days} дни; възражение — до ${c.objection_days} работни дни от запознаването, до председателя на комисията.`)], { alignment: AlignmentType.JUSTIFIED }))
  }
  out.push(P([t(`${n++}. Заповедта да се доведе до знанието на посочените лица за сведение и изпълнение.`)]))
  out.push(P([t(`${n}. Контрол по изпълнението на заповедта ще упражнявам лично.`)]))
  out.push(P([t('Директор: ……………………')], { spacing: { before: 400 } }))
  out.push(P([t('Запознати със заповедта:', { bold: true })], { spacing: { before: 300 } }))
  ;[chair ? pname(chair.staff) : '', ...memberNames(ctx)].filter(Boolean).forEach((x, i) => out.push(P([t(`${i + 1}. ${x}   ……………………   …………`)])))
  const doc = new Document({ sections: [{ properties: PAGE, footers: footer(), children: out }] })
  await save(doc, `Заповед_комисия_${short(k)}_${safe(yearLabel(ctx.yearName).replace('/', '-'))}.docx`)
}

/** План за методическа и организационна подкрепа (атестиране — при двете най-ниски оценки). */
export async function generateSupportPlan(ctx: DocCtx, p: Participant, s: Support, mentor: string | null) {
  const out: (Paragraph | Table)[] = [...letterhead()]
  out.push(P([t('ПЛАН', { bold: true, size: 28 })], { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 } }))
  out.push(P([t('за методическа и организационна подкрепа', { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))
  out.push(P([t('На: '), t(pname(p.staff), { bold: true }), t(` — ${p.position || p.staff?.position || ''}`)]))
  out.push(P([t(`Основание: атестиране за периода ${ctx.campaign.period_from ? dmy(ctx.campaign.period_from) : '…………'} – ${ctx.campaign.period_to ? dmy(ctx.campaign.period_to) : '…………'}, крайна оценка „${finalGrade(p) || '……'}“ (ОР ${num(p.result)} т.).`)], { alignment: AlignmentType.JUSTIFIED }))
  out.push(P([t(`Наставник: ${mentor || '……………………'}`)]))
  out.push(P([t(`Срок: от ${s.start_date ? dmy(s.start_date) : '…………'}${s.reattest_by ? `; повторно атестиране до ${dmy(s.reattest_by)}` : ''}`)], { spacing: { after: 160 } }))
  const sec = (h: string, v: string | null) => { out.push(P([t(h, { bold: true })], { spacing: { before: 160 } })); (v || '……………………………………………………').split('\n').forEach(l => out.push(P([t(l)], { alignment: AlignmentType.JUSTIFIED }))) }
  sec('1. Анализ на причините за получената оценка', s.causes)
  sec('2. Мерки за методическа и организационна подкрепа', s.measures)
  sec('3. Теми за квалификация (предложение към педагогическия съвет)', s.training)
  if (s.result) sec('4. Резултат', s.result)
  out.push(P([t('Директор: ……………………')], { spacing: { before: 400 } }))
  out.push(P([t(`Наставник: ${mentor || '……………………'}   ……………………`)]))
  out.push(P([t(`Запознат/а: ${pname(p.staff)}   ……………………   Дата: …………`)]))
  const doc = new Document({ sections: [{ properties: PAGE, footers: footer(), children: out }] })
  await save(doc, `План_подкрепа_${safe(pname(p.staff))}.docx`)
}

/** Анализ на кампанията: по лица и по показатели (средно, % от максимума). */
export function exportAnalysisExcel(ctx: DocCtx, parts: Participant[], byGroup: { n: string; g: string; max: number; avg: number; pct: number; people: number }[], members: { name: string; n: number; dev: number }[]) {
  const wb = XLSX.utils.book_new()
  const k = kindOf(ctx.campaign)
  const head = ['№', 'Име и фамилия', 'Длъжност', ...(k === 'attest' ? ['СО', 'ОАК', 'ОР', 'Крайна оценка'] : ['Точки']), 'Статус']
  const rows = parts.slice().sort((a, b) => Number(b.result ?? b.final_total ?? 0) - Number(a.result ?? a.final_total ?? 0)).map((p, i) => [
    i + 1, pname(p.staff), p.position || '', ...(k === 'attest' ? [p.self_total ?? '', p.final_total ?? '', p.result ?? '', finalGrade(p) || ''] : [p.final_total ?? '']), p.status,
  ])
  const ws1 = XLSX.utils.aoa_to_sheet([head, ...rows]); ws1['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 28 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 30 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'По лица')
  const ws2 = XLSX.utils.aoa_to_sheet([['№', 'Показател', 'Макс.', 'Средно', '% от макс.', 'Оценени'], ...byGroup.map(g => [g.n, g.g, g.max, Math.round(g.avg * 100) / 100, Math.round(g.pct), g.people])])
  ws2['!cols'] = [{ wch: 6 }, { wch: 60 }, { wch: 7 }, { wch: 8 }, { wch: 10 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'По показатели')
  if (members.length) {
    const ws3 = XLSX.utils.aoa_to_sheet([['Член на комисията', 'Оценени лица', 'Средно отклонение от средното (т.)'], ...members.map(m => [m.name, m.n, Math.round(m.dev * 100) / 100])])
    ws3['!cols'] = [{ wch: 32 }, { wch: 12 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws3, 'Комисия')
  }
  XLSX.writeFile(wb, `Анализ_${short(k)}_${safe(yearLabel(ctx.yearName).replace('/', '-'))}.xlsx`)
}

export type RegistryRow = { name: string; position: string; last: string | null; grade: string | null; result: number | null; next: string | null; support: string; source: string }
/** Регистър на атестирането (4-годишен цикъл). */
export function exportRegistryExcel(rows: RegistryRow[]) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([['№', 'Име и фамилия', 'Длъжност', 'Последно атестиране', 'Крайна оценка', 'ОР', 'Следващо атестиране', 'План за подкрепа', 'Източник'],
    ...rows.map((r, i) => [i + 1, r.name, r.position, r.last ? dmy(r.last) : '', r.grade || '', r.result ?? '', r.next ? dmy(r.next) : '', r.support, r.source])])
  ws['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 28 }, { wch: 12 }, { wch: 32 }, { wch: 7 }, { wch: 12 }, { wch: 24 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Атестиране')
  XLSX.writeFile(wb, `Регистър_атестиране.xlsx`)
}

export { KIND_LABEL }
