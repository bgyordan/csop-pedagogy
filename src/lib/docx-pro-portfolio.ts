// Професионално портфолио като Word документ: заглавна страница, общи данни, представяне и самоанализ,
// материали по раздели, таблица на квалификацията, цели за развитие и данни от ЕИС за периода.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
  TableLayoutType, VerticalAlign, ShadingType, Footer, PageNumber, HeadingLevel, PageBreak,
} from 'docx'
import { saveAs } from 'file-saver'
import { CENTER_NAME, CENTER_ADDRESS, dmy, todayIso } from './evaluation'
import {
  SECTIONS, GOAL_STATUS, qKindLabel, levelLabel, qualificationTotals, yearsSince, fmtNum, dateRange,
  type PPProfile, type PPItem, type PPGoal, type PPEvidence,
} from './pro-portfolio'

const F = 'Times New Roman'
const t = (text: string, o: any = {}) => new TextRun({ text, font: F, size: 22, ...o })
const P = (children: TextRun[], o: any = {}) => new Paragraph({ spacing: { after: 80 }, ...o, children })
const H = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 }, children: [t(text, { bold: true, size: 26, color: '0F2240' })] })
const H3 = (text: string) => new Paragraph({ spacing: { before: 160, after: 60 }, children: [t(text, { bold: true })] })
const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const CELLS = { top: B, bottom: B, left: B, right: B }
function cell(width: number, text: string, o: { head?: boolean; center?: boolean } = {}) {
  return new TableCell({
    borders: CELLS, width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    ...(o.head ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EEF1F6' } } : {}),
    children: String(text ?? '').split('\n').map(line => new Paragraph({ alignment: o.center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [t(line, { size: 20, bold: o.head })] })),
  })
}
const table = (cols: number[], rows: TableRow[]) =>
  new Table({ width: { size: cols.reduce((a, x) => a + x, 0), type: WidthType.DXA }, columnWidths: cols, layout: TableLayoutType.FIXED, rows })
const lines = (s: string | null | undefined, o: any = {}) => (s || '').split('\n').filter(x => x.trim()).map(x => P([t(x, o)], { alignment: AlignmentType.JUSTIFIED }))
const kv = (l: string, v: string | null | undefined) => P([t(`${l}: `, { bold: true }), t(v || '—')])

export async function generatePortfolio(o: {
  staff: { name: string; position: string }; profile: PPProfile | null; items: PPItem[]; goals: PPGoal[]
  classes: string[]; periodLabel: string; evidence: PPEvidence | null
}) {
  const { staff, profile: pr, items } = o
  const today = todayIso()
  const out: (Paragraph | Table)[] = []

  // заглавна страница
  out.push(P([t(CENTER_NAME, { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } }))
  out.push(P([t(CENTER_ADDRESS, { size: 18 })], { alignment: AlignmentType.CENTER, spacing: { after: 2400 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } } }))
  out.push(P([t('ПРОФЕСИОНАЛНО ПОРТФОЛИО', { bold: true, size: 40 })], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))
  out.push(P([t(staff.name, { bold: true, size: 30 })], { alignment: AlignmentType.CENTER, spacing: { after: 80 } }))
  out.push(P([t(staff.position, { size: 26 })], { alignment: AlignmentType.CENTER, spacing: { after: 600 } }))
  out.push(P([t(o.periodLabel, { size: 24 })], { alignment: AlignmentType.CENTER }))
  out.push(P([t(`Изготвено на ${dmy(today)} г.`, { size: 20, color: '555555' })], { alignment: AlignmentType.CENTER }))
  out.push(new Paragraph({ children: [new PageBreak()] }))

  // 1. Общи данни
  out.push(H('1. Общи данни'))
  out.push(kv('Име', staff.name))
  out.push(kv('Длъжност', staff.position))
  out.push(kv('Институция', CENTER_NAME))
  if (o.classes.length) out.push(kv('Групи / паралелки', o.classes.join(', ')))
  const edu = pr?.education || []
  out.push(kv('Образование', edu.length ? edu.map(e => [e.level, e.specialty, e.school, e.year].filter(Boolean).join(', ')).join('; ') : ''))
  out.push(kv('Специалност по базовото висше образование', pr?.specialty))
  out.push(kv('Професионална квалификация „учител“', pr?.teacher_q == null ? '' : pr.teacher_q ? 'да' : 'не'))
  if (pr?.other_q) out.push(kv('Допълнителна квалификация', pr.other_q))
  out.push(kv('ПКС', [pr?.pks, pr?.pks_year].filter(Boolean).join(', ')))
  const yt = yearsSince(pr?.work_since, today, Number(pr?.years_extra?.total || 0))
  const yy = yearsSince(pr?.teacher_since, today, Number(pr?.years_extra?.teacher || 0))
  out.push(kv('Стаж — общ / учителски', yt != null || yy != null ? `${yt ?? '—'} / ${yy ?? '—'} години` : ''))

  // 2. Представяне
  if (pr?.philosophy || pr?.about || pr?.strengths || pr?.growth) {
    out.push(H('2. Представяне и самоанализ'))
    if (pr.philosophy) { out.push(H3('Педагогическа философия')); out.push(...lines(pr.philosophy)) }
    if (pr.about) { out.push(H3('Професионално CV')); out.push(...lines(pr.about)) }
    if (pr.strengths) { out.push(H3('Силни страни')); out.push(...lines(pr.strengths)) }
    if (pr.growth) { out.push(H3('Области за развитие')); out.push(...lines(pr.growth)) }
  }

  // 3. Материали по раздели (без квалификацията — тя е в таблица)
  out.push(H('3. Материали'))
  let n = 0
  for (const s of SECTIONS.filter(x => x.key !== 'qualification')) {
    const list = items.filter(i => i.section === s.key).sort((a, b) => Number(b.featured) - Number(a.featured) || (b.date_from || '').localeCompare(a.date_from || ''))
    if (!list.length) continue
    n++
    out.push(H3(`3.${n}. ${s.label}`))
    for (const i of list) {
      const meta = [dateRange(i.date_from, i.date_to), levelLabel(i.level), i.part_role, i.provider].filter(Boolean).join(' · ')
      out.push(P([t('• ', { bold: true }), t(i.title, { bold: true }), ...(meta ? [t(` (${meta})`, { size: 20 })] : [])], { spacing: { before: 60, after: 40 } }))
      out.push(...lines(i.body, { size: 21 }))
      if (i.reflection) out.push(P([t('Рефлексия: ', { italics: true, bold: true, size: 21 }), t(i.reflection, { italics: true, size: 21 })]))
      const att = [...(i.files || []).map(f => f.name), i.url || ''].filter(Boolean)
      if (att.length) out.push(P([t(`Приложения: ${att.join('; ')}`, { size: 19, color: '555555' })]))
    }
  }
  if (!n) out.push(P([t('Няма материали за периода.', { italics: true })]))

  // 4. Квалификация
  out.push(H('4. Квалификация и професионално израстване'))
  const q = items.filter(i => i.section === 'qualification').sort((a, b) => (a.date_from || '').localeCompare(b.date_from || ''))
  if (q.length) {
    const cols = [1300, 3200, 1900, 1800, 700, 700, 1000]
    out.push(table(cols, [
      new TableRow({ tableHeader: true, children: ['Дата', 'Тема', 'Вид', 'Организация', 'Часа', 'Кред.', 'Документ'].map((h, k) => cell(cols[k], h, { head: true, center: true })) }),
      ...q.map(i => new TableRow({ children: [
        cell(cols[0], dateRange(i.date_from, i.date_to)), cell(cols[1], i.title), cell(cols[2], qKindLabel(i.kind)), cell(cols[3], i.provider || ''),
        cell(cols[4], fmtNum(i.hours), { center: true }), cell(cols[5], fmtNum(i.credits), { center: true }), cell(cols[6], i.doc_no || ''),
      ] })),
    ]))
    const tt = qualificationTotals(items)
    out.push(P([t(`Общо: вътрешноинституционална — ${fmtNum(tt.internal)} акад. ч.; от обучаващи организации — ${fmtNum(tt.extHours)} акад. ч.; кредити — ${fmtNum(tt.credits)}.`, { size: 21 })], { spacing: { before: 120 } }))
  } else out.push(P([t('Няма записани обучения за периода.', { italics: true })]))

  // 5. Цели
  if (o.goals.length) {
    out.push(H('5. Цели за професионално развитие'))
    for (const g of o.goals) {
      out.push(P([t('• ', { bold: true }), t(g.goal, { bold: true }), t(` — ${GOAL_STATUS[g.status].label.toLowerCase()}${g.due ? `, срок ${dmy(g.due)}` : ''}`, { size: 20 })], { spacing: { before: 60, after: 40 } }))
      if (g.actions) out.push(P([t(`Дейности: ${g.actions}`, { size: 21 })]))
      if (g.indicator) out.push(P([t(`Индикатор: ${g.indicator}`, { size: 21 })]))
      if (g.reflection) out.push(P([t(`Рефлексия: ${g.reflection}`, { italics: true, size: 21 })]))
    }
  }

  // 6. Данни от ЕИС
  const ev = o.evidence
  if (ev) {
    out.push(H(`${o.goals.length ? 6 : 5}. Данни от ЕИС за периода`))
    const c = ev.counts.filter(k => k.n)
    if (c.length) out.push(P([t(c.map(k => `${k.l}: ${k.n}`).join('; ') + '.', { size: 21 })]))
    if (ev.checks.length) {
      out.push(H3('Контролна дейност — силни страни и изводи'))
      for (const k of ev.checks) {
        out.push(P([t(`${dmy(k.date)} · ${k.subject}`, { bold: true, size: 21 }), t(k.inspector ? ` (${k.inspector})` : '', { size: 20 })]))
        if (k.strengths) out.push(P([t(`Силни страни: ${k.strengths}`, { size: 21 })]))
        if (k.conclusions) out.push(P([t(`Изводи: ${k.conclusions}`, { size: 21 })]))
      }
    }
    if (ev.evals.length) {
      out.push(H3('Оценки'))
      for (const e of ev.evals) out.push(P([t(`${e.name}: ${e.kind === 'attest' ? `${fmtNum(e.result)} — ${e.grade || ''}` : `${fmtNum(e.total)} т.`}`, { size: 21 })]))
    }
  }

  out.push(P([t('')], { spacing: { before: 600 } }))
  out.push(P([t(`Дата: ${dmy(today)} г.`), t('\t\t\t\tПодпис: ……………………')]))

  const doc = new Document({
    styles: { default: { document: { run: { font: F, size: 22 } } } },
    sections: [{
      properties: { page: { margin: { top: 900, bottom: 900, left: 1134, right: 1000 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ font: F, size: 18, children: [`Портфолио — ${staff.name} · стр. `, PageNumber.CURRENT] })] })] }) },
      children: out,
    }],
  })
  saveAs(await Packer.toBlob(doc), `Портфолио_${staff.name.replace(/\s+/g, '_')}_${today}.docx`)
}
