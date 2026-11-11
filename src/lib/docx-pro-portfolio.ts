// Професионално портфолио като Word документ: заглавна страница с логото, съдържание, общи данни, професионален път,
// работа в ЦСОП по години, представяне и самоанализ, квалификация (ПКС, с кредити, вътрешни, други — както в EPO.bg),
// материали по раздели, цели за развитие и данни от ЕИС за периода. Номерацията на разделите е според съдържанието.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
  TableLayoutType, VerticalAlign, ShadingType, Footer, PageNumber, HeadingLevel, PageBreak, ImageRun,
} from 'docx'
import { CSOP_LOGO_B64 } from './docx-generator'
import { saveAs } from 'file-saver'
import { CENTER_NAME, CENTER_ADDRESS, dmy, todayIso } from './evaluation'
import {
  SECTIONS, GOAL_STATUS, qKindLabel, levelLabel, qualificationTotals, yearsSince, fmtNum, dateRange, ymRange,
  type PPProfile, type PPItem, type PPGoal, type PPEvidence, type WorkYear,
} from './pro-portfolio'

const F = 'Times New Roman'
const t = (text: string, o: any = {}) => new TextRun({ text, font: F, size: 22, ...o })
const P = (children: TextRun[], o: any = {}) => new Paragraph({ spacing: { after: 80 }, ...o, children })
const H = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 280, after: 120 }, children: [t(text, { bold: true, size: 26, color: '0F2240' })] })
const H3 = (text: string) => new Paragraph({ keepNext: true, spacing: { before: 160, after: 60 }, children: [t(text, { bold: true })] })
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

export async function generatePortfolio(o: {
  staff: { name: string; position: string }; profile: PPProfile | null; items: PPItem[]; goals: PPGoal[]
  classes: string[]; periodLabel: string; evidence: PPEvidence | null; workYears?: WorkYear[]
}) {
  const { staff, profile: pr, items } = o
  const today = todayIso()
  const out: (Paragraph | Table)[] = []
  const toc: string[] = []
  const sec = (title: string) => { toc.push(title); return H(`${toc.length}. ${title}`) }
  const body: (Paragraph | Table)[] = []

  // ── Общи данни ──
  const edu = pr?.education || []
  const yt = yearsSince(pr?.work_since, today, Number(pr?.years_extra?.total || 0))
  const yy = yearsSince(pr?.teacher_since, today, Number(pr?.years_extra?.teacher || 0))
  const kvRows: [string, string][] = [
    ['Име', staff.name], ['Длъжност', staff.position], ['Институция', CENTER_NAME],
    ...(o.classes.length ? [['Групи / паралелки (тази година)', o.classes.join(', ')] as [string, string]] : []),
    ['Специалност по базовото висше образование', pr?.specialty || ''],
    ['Професионална квалификация „учител“', pr?.teacher_q == null ? '' : pr.teacher_q ? 'да' : 'не'],
    ...(pr?.other_q ? [['Допълнителна квалификация', pr.other_q] as [string, string]] : []),
    ['Професионално-квалификационна степен', [pr?.pks, pr?.pks_year ? `${pr.pks_year} г.` : null].filter(Boolean).join(', ')],
    ['Стаж — общ / учителски', yt != null || yy != null ? `${yt ?? '—'} / ${yy ?? '—'} години` : ''],
  ]
  body.push(sec('Общи данни'))
  const kc = [3600, 6000]
  body.push(table(kc, kvRows.filter(([, v]) => v).map(([l, v]) => new TableRow({ children: [cell(kc[0], l, { head: true }), cell(kc[1], v)] }))))
  if (edu.length) {
    body.push(H3('Образование'))
    const ec = [2000, 3000, 3200, 1400]
    body.push(table(ec, [
      new TableRow({ tableHeader: true, children: ['Степен', 'Специалност', 'Висше училище', 'Година'].map((h, k) => cell(ec[k], h, { head: true, center: true })) }),
      ...edu.map(e => new TableRow({ children: [cell(ec[0], e.level || ''), cell(ec[1], [e.specialty, e.qualification ? `ПК: ${e.qualification}` : null].filter(Boolean).join('\n')), cell(ec[2], e.school || ''), cell(ec[3], e.year ? String(e.year) : '', { center: true })] })),
    ]))
  }

  // ── Професионален път ──
  const career = pr?.career || [], memberships = pr?.memberships || []
  if (career.length || memberships.length) {
    body.push(sec('Професионален път'))
    if (career.length) {
      const cc = [2600, 3500, 3500]
      body.push(table(cc, [
        new TableRow({ tableHeader: true, children: ['Период', 'Институция', 'Длъжност'].map((h, k) => cell(cc[k], h, { head: true, center: true })) }),
        ...career.map(c => new TableRow({ children: [cell(cc[0], ymRange(c.from, c.to)), cell(cc[1], c.institution), cell(cc[2], c.position)] })),
      ]))
    }
    if (memberships.length) {
      body.push(H3('Членство в организации'))
      for (const m of memberships) body.push(P([t('• '), t(m.org, { bold: true }), t(`${m.role ? ` — ${m.role}` : ''} (${ymRange(m.from, m.to)})`, { size: 21 })]))
    }
  }

  // ── Работа в ЦСОП по години (от ЕИС) ──
  const wy = o.workYears || []
  if (wy.length) {
    body.push(sec('Работа в ЦСОП по години'))
    const wc = [2000, 5600, 2000]
    body.push(table(wc, [
      new TableRow({ tableHeader: true, children: ['Учебна година', 'Паралелки / групи', 'Деца в ЕПЛР екипи'].map((h, k) => cell(wc[k], h, { head: true, center: true })) }),
      ...wy.map(w => new TableRow({ children: [
        cell(wc[0], w.year, { center: true }),
        cell(wc[1], [...w.classes.map(c => `паралелка ${c}`), ...w.coud.map(c => `ЦОУД ${c}`)].join(', ') || '—'),
        cell(wc[2], w.eplr ? String(w.eplr) : '—', { center: true }),
      ] })),
    ]))
  }

  // ── Представяне и самоанализ ──
  if (pr?.philosophy || pr?.about || pr?.strengths || pr?.growth) {
    body.push(sec('Представяне и самоанализ'))
    if (pr.philosophy) { body.push(H3('Педагогическа философия')); body.push(...lines(pr.philosophy)) }
    if (pr.about) { body.push(H3('Професионално CV')); body.push(...lines(pr.about)) }
    if (pr.strengths) { body.push(H3('Силни страни')); body.push(...lines(pr.strengths)) }
    if (pr.growth) { body.push(H3('Области за развитие')); body.push(...lines(pr.growth)) }
  }

  // ── Квалификация — по видове ──
  body.push(sec('Квалификация и професионално израстване'))
  const q = items.filter(i => i.section === 'qualification').sort((a, b) => (a.date_from || '').localeCompare(b.date_from || ''))
  if (q.length) {
    const groups: { title: string; kinds: (string | null)[]; credits: boolean }[] = [
      { title: 'Професионално-квалификационни степени', kinds: ['pks'], credits: false },
      { title: 'Специализации, нова специалност, степени', kinds: ['degree'], credits: false },
      { title: 'Обучения от обучаващи организации (с кредити)', kinds: ['external'], credits: true },
      { title: 'Вътрешноинституционална квалификация', kinds: ['internal'], credits: false },
      { title: 'Други обучения, семинари, самообучение', kinds: ['self', null, ''], credits: false },
    ]
    for (const g of groups) {
      const list = q.filter(i => g.kinds.includes(i.kind ?? null))
      if (!list.length) continue
      body.push(H3(g.title))
      const qc = g.credits ? [1500, 3400, 2200, 700, 700, 1300] : [1500, 4100, 2400, 700, 1300]
      const head = g.credits ? ['Дата', 'Тема', 'Организация', 'Часа', 'Кред.', 'Документ'] : ['Дата', 'Тема', 'Организация / лектор', 'Часа', 'Документ']
      body.push(table(qc, [
        new TableRow({ tableHeader: true, children: head.map((h, k) => cell(qc[k], h, { head: true, center: true })) }),
        ...list.map(i => new TableRow({ children: g.credits
          ? [cell(qc[0], dateRange(i.date_from, i.date_to)), cell(qc[1], i.title), cell(qc[2], i.provider || ''), cell(qc[3], fmtNum(i.hours), { center: true }), cell(qc[4], fmtNum(i.credits), { center: true }), cell(qc[5], i.doc_no || '')]
          : [cell(qc[0], dateRange(i.date_from, i.date_to)), cell(qc[1], i.title), cell(qc[2], i.provider || ''), cell(qc[3], fmtNum(i.hours), { center: true }), cell(qc[4], i.doc_no || '')] })),
      ]))
    }
    const tt = qualificationTotals(items)
    body.push(P([t(`Общо: вътрешноинституционална — ${fmtNum(tt.internal)} акад. ч.; от обучаващи организации — ${fmtNum(tt.extHours)} акад. ч.; кредити — ${fmtNum(tt.credits)}.`, { size: 21 })], { spacing: { before: 120 } }))
  } else body.push(P([t('Няма записани обучения за периода.', { italics: true })]))

  // ── Материали по раздели (без квалификацията) ──
  const secs = SECTIONS.filter(x => x.key !== 'qualification').map(s2 => ({ s: s2, list: items.filter(i => i.section === s2.key).sort((a, b) => Number(b.featured) - Number(a.featured) || (b.date_from || '').localeCompare(a.date_from || '')) })).filter(x => x.list.length)
  if (secs.length) {
    body.push(sec('Материали и постижения'))
    const no = toc.length
    secs.forEach(({ s: s2, list }, k) => {
      body.push(H3(`${no}.${k + 1}. ${s2.label}`))
      for (const i of list) {
        const meta = [dateRange(i.date_from, i.date_to), levelLabel(i.level), i.part_role, i.provider].filter(Boolean).join(' · ')
        body.push(P([t('• ', { bold: true }), t(i.title, { bold: true }), ...(meta ? [t(` (${meta})`, { size: 20 })] : [])], { spacing: { before: 60, after: 40 } }))
        body.push(...lines(i.body, { size: 21 }))
        if (i.reflection) body.push(P([t('Рефлексия: ', { italics: true, bold: true, size: 21 }), t(i.reflection, { italics: true, size: 21 })]))
        const att = [...(i.files || []).map(f => f.name), i.url || ''].filter(Boolean)
        if (att.length) body.push(P([t(`Приложения: ${att.join('; ')}`, { size: 19, color: '555555' })]))
      }
    })
  }

  // ── Цели ──
  if (o.goals.length) {
    body.push(sec('Цели за професионално развитие'))
    for (const g of o.goals) {
      body.push(P([t('• ', { bold: true }), t(g.goal, { bold: true }), t(` — ${GOAL_STATUS[g.status].label.toLowerCase()}${g.due ? `, срок ${dmy(g.due)}` : ''}`, { size: 20 })], { spacing: { before: 60, after: 40 } }))
      if (g.actions) body.push(P([t(`Дейности: ${g.actions}`, { size: 21 })]))
      if (g.indicator) body.push(P([t(`Индикатор: ${g.indicator}`, { size: 21 })]))
      if (g.reflection) body.push(P([t(`Рефлексия: ${g.reflection}`, { italics: true, size: 21 })]))
    }
  }

  // ── Данни от ЕИС ──
  const ev = o.evidence
  if (ev && (ev.counts.some(k => k.n) || ev.checks.length || ev.evals.length)) {
    body.push(sec('Данни от ЕИС за периода'))
    const c = ev.counts.filter(k => k.n)
    if (c.length) body.push(P([t(c.map(k => `${k.l}: ${k.n}`).join('; ') + '.', { size: 21 })]))
    if (ev.checks.length) {
      body.push(H3('Контролна дейност — силни страни и изводи'))
      for (const k of ev.checks) {
        body.push(P([t(`${dmy(k.date)} · ${k.subject}`, { bold: true, size: 21 }), t(k.inspector ? ` (${k.inspector})` : '', { size: 20 })]))
        if (k.strengths) body.push(P([t(`Силни страни: ${k.strengths}`, { size: 21 })]))
        if (k.conclusions) body.push(P([t(`Изводи: ${k.conclusions}`, { size: 21 })]))
      }
    }
    if (ev.evals.length) {
      body.push(H3('Оценки'))
      for (const e of ev.evals) body.push(P([t(`${e.name}: ${e.kind === 'attest' ? `${fmtNum(e.result)} — ${e.grade || ''}` : `${fmtNum(e.total)} т.`}`, { size: 21 })]))
    }
  }
  body.push(P([t('')], { spacing: { before: 600 } }))
  body.push(P([t(`Дата: ${dmy(today)} г.`), t('\t\t\t\tПодпис: ……………………')]))

  // ── Заглавна страница и съдържание ──
  out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new ImageRun({ data: Uint8Array.from(atob(CSOP_LOGO_B64), ch => ch.charCodeAt(0)), transformation: { width: 90, height: 90 }, type: 'jpg' })] }))
  out.push(P([t(CENTER_NAME, { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } }))
  out.push(P([t(CENTER_ADDRESS, { size: 18 })], { alignment: AlignmentType.CENTER, spacing: { after: 1800 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0F2240', space: 4 } } }))
  out.push(P([t('ПРОФЕСИОНАЛНО ПОРТФОЛИО', { bold: true, size: 44, color: '0F2240' })], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }))
  out.push(P([t(staff.name, { bold: true, size: 32 })], { alignment: AlignmentType.CENTER, spacing: { after: 80 } }))
  out.push(P([t(staff.position, { size: 26 })], { alignment: AlignmentType.CENTER, spacing: { after: 480 } }))
  if (pr?.motto) out.push(P([t(`„${pr.motto.replace(/^[„"]|[“"]$/g, '')}“`, { italics: true, size: 24, color: '444444' })], { alignment: AlignmentType.CENTER, spacing: { after: 480 } }))
  out.push(P([t(o.periodLabel, { size: 24 })], { alignment: AlignmentType.CENTER }))
  out.push(P([t(`Изготвено на ${dmy(today)} г.`, { size: 20, color: '555555' })], { alignment: AlignmentType.CENTER }))
  out.push(new Paragraph({ children: [new PageBreak()] }))
  out.push(H('Съдържание'))
  toc.forEach((x, k) => out.push(P([t(`${k + 1}. ${x}`)], { spacing: { after: 60 } })))
  out.push(new Paragraph({ children: [new PageBreak()] }))
  out.push(...body)

  const doc = new Document({
    styles: { default: { document: { run: { font: F, size: 22 } } } },
    sections: [{
      properties: { page: { margin: { top: 900, bottom: 900, left: 1134, right: 1000 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ font: F, size: 18, children: [`Професионално портфолио — ${staff.name} · стр. `, PageNumber.CURRENT] })] })] }) },
      children: out,
    }],
  })
  saveAs(await Packer.toBlob(doc), `Професионално_портфолио_${staff.name.replace(/\s+/g, '_')}_${today}.docx`)
}
