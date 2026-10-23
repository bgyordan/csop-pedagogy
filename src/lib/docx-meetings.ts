// Протокол от заседание на ПС / ОС и Книга за решенията и протоколите — като Word.
// Съдържание по Наредба № 8/2016, Приложение № 2: пореден №, дневен ред, отсъстващи и причините,
// разисквания, решения; в Книгата — поименен списък на членовете в началото на учебната година.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle,
  TableLayoutType, VerticalAlign, ShadingType, Footer, PageNumber, PageBreak,
} from 'docx'
import { saveAs } from 'file-saver'
import { CENTER_NAME } from './control'
import {
  BODY_LABEL, BODY_OF, BODY_DECIDES, OUTCOME_LABEL, ATT_LABEL, QUORUM_LABEL, quorum, decisionNumbers, voteLine,
  dmy, hm, attName, fullName,
  type Meeting, type Item, type Decision, type Attendance, type Person,
} from './meetings'

const F = 'Times New Roman'
const t = (text: string, o: any = {}) => new TextRun({ text, font: F, size: 24, ...o })
const P = (children: TextRun[], o: any = {}) => new Paragraph({ spacing: { after: 100, line: 300 }, ...o, children })
const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const CELLS = { top: B, bottom: B, left: B, right: B }
const PORTRAIT = { page: { margin: { top: 1000, bottom: 1000, left: 1300, right: 1000 } } }
const footer = () => ({ default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ font: F, size: 18, children: ['стр. ', PageNumber.CURRENT, ' от ', PageNumber.TOTAL_PAGES] })] })] }) })

function cell(width: number, text: string, o: { head?: boolean; center?: boolean } = {}) {
  return new TableCell({
    borders: CELLS, width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    ...(o.head ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EEF1F6' } } : {}),
    children: String(text || '').split('\n').map(line => new Paragraph({ alignment: o.center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [t(line, { size: 21, bold: o.head })] })),
  })
}
const table = (cols: number[], rows: TableRow[]) => new Table({ width: { size: cols.reduce((a, x) => a + x, 0), type: WidthType.DXA }, columnWidths: cols, layout: TableLayoutType.FIXED, rows })
const multiline = (s: string | null | undefined, o: any = {}) => (s || '').split('\n').filter(x => x.trim()).map(x => P([t(x)], { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 567 }, ...o }))

export type ProtocolData = {
  m: Meeting; items: Item[]; decisions: Decision[]; attendance: Attendance[]; people: Record<string, Person>; yearName?: string | null
}

/** Съдържанието на един протокол (за самостоятелен файл и за Книгата). */
function protocolChildren(d: ProtocolData, opts: { withSheet: boolean } = { withSheet: true }) {
  const { m, items, decisions, attendance, people } = d
  const out: (Paragraph | Table)[] = []
  const draft = m.status !== 'final'
  const q = quorum(attendance, m.quorum_rule)
  const nums = decisionNumbers(items, decisions)
  const members = attendance.filter(a => a.role === 'member')
  const absent = members.filter(a => a.status === 'absent')
  const late = members.filter(a => a.status === 'late' || a.status === 'left')
  const others = attendance.filter(a => a.role !== 'member' && a.status !== 'absent')
  const chair = m.chair_id ? fullName(people[m.chair_id]) : ''
  const secretary = m.secretary_id ? fullName(people[m.secretary_id]) : ''

  out.push(P([t(CENTER_NAME, { bold: true })], { alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } } }))
  if (draft) out.push(P([t('ПРОЕКТ — не е вписан в Книгата', { color: 'B91C1C', size: 18 })], { alignment: AlignmentType.CENTER }))
  out.push(P([t('ПРОТОКОЛ', { bold: true, size: 32 })], { alignment: AlignmentType.CENTER, spacing: { before: 300, after: 40 } }))
  out.push(P([t(m.meeting_no ? `№ ${m.meeting_no}` : '№ ......')], { alignment: AlignmentType.CENTER }))
  out.push(P([t(`от ${m.kind === 'extraordinary' ? 'извънредно ' : ''}заседание ${BODY_OF[m.body]}`, { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 300 } }))

  const when = `Днес, ${dmy(m.meeting_date)} г.${m.start_time ? `, от ${hm(m.start_time)} ч.` : ''}${m.place ? `, в ${m.place}` : ''}, се проведе ${m.kind === 'extraordinary' ? 'извънредно ' : ''}заседание ${BODY_OF[m.body]}${m.title ? ` — „${m.title}“` : ''}.`
  out.push(P([t(when)], { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 567 } }))
  out.push(P([t('Присъстват: ', { bold: true }), t(`${q.present} от общо ${q.total} членове. `), t(q.ok ? `Има необходимия кворум (${QUORUM_LABEL[m.quorum_rule]}) и заседанието е редовно.` : `Няма необходимия кворум (${QUORUM_LABEL[m.quorum_rule]}).`)], { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 567 } }))
  out.push(P([t('Отсъстват: ', { bold: true }), t(absent.length ? absent.map(a => `${attName(a, people)}${a.reason ? ` (${a.reason})` : ''}`).join('; ') + '.' : 'няма.')], { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 567 } }))
  if (late.length) out.push(P([t('Закъснели / напуснали по-рано: ', { bold: true }), t(late.map(a => `${attName(a, people)} (${ATT_LABEL[a.status]}${a.reason ? `, ${a.reason}` : ''})`).join('; ') + '.')], { indent: { firstLine: 567 } }))
  if (others.length) out.push(P([t('Присъстват още: ', { bold: true }), t(others.map(a => `${attName(a, people)}${a.guest_role ? ` — ${a.guest_role}` : ''}${a.role === 'advisory' ? ' (със съвещателен глас)' : ''}`).join('; ') + '.')], { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 567 } }))
  out.push(P([t('Председател: ', { bold: true }), t(chair || '..............................'), t('     Протоколчик: ', { bold: true }), t(secretary || '..............................')], { indent: { firstLine: 567 } }))
  out.push(...multiline(m.intro))

  out.push(P([t('ДНЕВЕН РЕД:', { bold: true })], { spacing: { before: 240, after: 100 } }))
  items.forEach((it, i) => {
    const rap = it.rapporteur_id ? fullName(people[it.rapporteur_id]) : it.rapporteur_text
    out.push(P([t(`${i + 1}. ${it.title}`), ...(rap ? [t(`  Докладва: ${rap}`, { italics: true, size: 22 })] : [])], { indent: { left: 567 } }))
  })
  out.push(P([t('Дневният ред беше приет единодушно.', { italics: true })], { indent: { firstLine: 567 }, spacing: { before: 100, after: 200 } }))

  items.forEach((it, i) => {
    out.push(P([t(`По т. ${i + 1}. ${it.title}`, { bold: true, underline: {} })], { spacing: { before: 240, after: 100 } }))
    const rap = it.rapporteur_id ? fullName(people[it.rapporteur_id]) : it.rapporteur_text
    if (rap) out.push(P([t(`Докладва: ${rap}.`)], { indent: { firstLine: 567 } }))
    out.push(...multiline(it.discussion))
    const ds = decisions.filter(x => x.item_id === it.id).sort((a, b) => a.sort - b.sort)
    ds.forEach(dd => out.push(...decisionBlock(dd, nums[dd.id], m, people)))
  })
  const loose = decisions.filter(x => !x.item_id || !items.some(i => i.id === x.item_id))
  loose.forEach(dd => out.push(...decisionBlock(dd, nums[dd.id], m, people)))

  out.push(P([t(`Поради изчерпване на дневния ред заседанието беше закрито${m.end_time ? ` в ${hm(m.end_time)} ч.` : '.'}`)], { indent: { firstLine: 567 }, spacing: { before: 300 } }))

  out.push(P([t('Протоколчик: ................................'), t(`  /${secretary || '..............................'}/`)], { spacing: { before: 500 } }))
  out.push(P([t(m.body === 'ps' ? 'Председател на ПС (директор): ................................' : 'Председател: ................................'), t(`  /${chair || '..............................'}/`)], { spacing: { before: 300 } }))
  if (m.body === 'ps') out.push(P([t('(печат)', { italics: true, size: 20 })], { indent: { left: 3400 } }))

  if (opts.withSheet && members.length) {
    out.push(new Paragraph({ children: [new PageBreak()] }))
    out.push(P([t(`Приложение към протокол № ${m.meeting_no ?? '......'} / ${dmy(m.meeting_date)} г.`, { italics: true, size: 20 })], { alignment: AlignmentType.RIGHT }))
    out.push(P([t('ПРИСЪСТВЕН СПИСЪК', { bold: true, size: 26 })], { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200 } }))
    const cols = [600, 4100, 2200, 2200]
    out.push(table(cols, [
      new TableRow({ tableHeader: true, children: [cell(cols[0], '№', { head: true, center: true }), cell(cols[1], 'Име и фамилия', { head: true }), cell(cols[2], 'Присъствие', { head: true, center: true }), cell(cols[3], 'Подпис', { head: true, center: true })] }),
      ...[...members, ...others].map((a, i) => new TableRow({ children: [
        cell(cols[0], String(i + 1), { center: true }),
        cell(cols[1], attName(a, people) + (a.role !== 'member' ? ` (${a.role === 'advisory' ? 'съвещ. глас' : 'гост'})` : '')),
        cell(cols[2], a.status === 'absent' ? `отсъства${a.reason ? `\n${a.reason}` : ''}` : ATT_LABEL[a.status], { center: true }),
        cell(cols[3], ''),
      ] })),
    ]))
  }
  return out
}

function decisionBlock(dd: Decision, no: number, m: Meeting, people: Record<string, Person>) {
  const out: Paragraph[] = []
  if (dd.kind !== 'noted') out.push(P([t(voteLine(dd), { italics: true })], { indent: { firstLine: 567 } }))
  const verb = dd.kind === 'noted' ? 'ПРИЕ ЗА СВЕДЕНИЕ' : dd.outcome === 'rejected' ? 'НЕ ПРИЕ' : 'РЕШИ'
  out.push(P([t(`${BODY_DECIDES[m.body]} ${verb}:`, { bold: true })], { indent: { firstLine: 567 }, spacing: { before: 80, after: 60 } }))
  out.push(P([t(`Решение № ${no}: `, { bold: true }), t(dd.text || '')], { alignment: AlignmentType.JUSTIFIED, indent: { left: 567 } }))
  const resp = dd.responsible_id ? fullName(people[dd.responsible_id]) : ''
  if (resp || dd.due_date) out.push(P([t([resp ? `Отговорник: ${resp}` : '', dd.due_date ? `Срок: ${dmy(dd.due_date)} г.` : ''].filter(Boolean).join('     '), { italics: true, size: 22 })], { indent: { left: 567 }, spacing: { after: 160 } }))
  return out
}

async function out(doc: Document, file: string) {
  const blob = await Packer.toBlob(doc)
  saveAs(blob, file)
  return { blob, file }
}

export async function generateMeetingProtocol(d: ProtocolData) {
  const doc = new Document({ sections: [{ properties: PORTRAIT, footers: footer(), children: protocolChildren(d) }] })
  const tag = d.m.body === 'ps' ? 'ПС' : 'ОС'
  return out(doc, d.m.meeting_no ? `Протокол_${tag}_${d.m.meeting_no}_${d.m.meeting_date}.docx` : `Протокол_${tag}_проект_${d.m.meeting_date}.docx`)
}

/** Покана с дневния ред (преди заседанието). */
export async function generateInvitation(d: ProtocolData) {
  const { m, items, people } = d
  const ch: Paragraph[] = []
  ch.push(P([t(CENTER_NAME, { bold: true })], { alignment: AlignmentType.CENTER, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } } }))
  ch.push(P([t('ПОКАНА', { bold: true, size: 32 })], { alignment: AlignmentType.CENTER, spacing: { before: 400, after: 300 } }))
  ch.push(P([t(`Уважаеми колеги, на ${dmy(m.meeting_date)} г.${m.start_time ? ` от ${hm(m.start_time)} ч.` : ''}${m.place ? ` в ${m.place}` : ''} ще се проведе ${m.kind === 'extraordinary' ? 'извънредно ' : ''}заседание ${BODY_OF[m.body]} при следния`)], { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 567 } }))
  ch.push(P([t('ДНЕВЕН РЕД:', { bold: true })], { spacing: { before: 200, after: 100 } }))
  items.forEach((it, i) => {
    const rap = it.rapporteur_id ? fullName(people[it.rapporteur_id]) : it.rapporteur_text
    ch.push(P([t(`${i + 1}. ${it.title}`), ...(rap ? [t(`  Докладва: ${rap}`, { italics: true, size: 22 })] : [])], { indent: { left: 567 } }))
  })
  if (m.council_set_id) ch.push(P([t('Материалите по дневния ред са на разположение в ЕИС → „За съгласуване“.', { italics: true })], { spacing: { before: 240 } }))
  const chair = m.chair_id ? fullName(people[m.chair_id]) : ''
  ch.push(P([t('Председател: ................................'), t(`  /${chair || '..............................'}/`)], { spacing: { before: 600 } }))
  const doc = new Document({ sections: [{ properties: PORTRAIT, children: ch }] })
  return out(doc, `Покана_${m.body === 'ps' ? 'ПС' : 'ОС'}_${m.meeting_date}.docx`)
}

/** Книгата за учебната година: титулна страница, поименен списък, регистър на решенията, протоколите. */
export async function generateMeetingsBook(body: 'ps' | 'os', yearName: string, list: ProtocolData[], roster: Person[]) {
  const sorted = [...list].sort((a, b) => (a.m.meeting_no ?? 0) - (b.m.meeting_no ?? 0))
  const first = sorted[0]?.m.meeting_date, last = sorted[sorted.length - 1]?.m.meeting_date
  const ch: (Paragraph | Table)[] = []
  ch.push(P([t(CENTER_NAME, { bold: true })], { alignment: AlignmentType.CENTER }))
  ch.push(P([t('КНИГА', { bold: true, size: 44 })], { alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 200 } }))
  ch.push(P([t(body === 'ps' ? 'за решенията на педагогическия съвет и протоколи от заседанията' : 'с протоколите от заседанията на общото събрание на работниците и служителите', { size: 28 })], { alignment: AlignmentType.CENTER }))
  ch.push(P([t(`Учебна ${yearName} година`, { size: 26 })], { alignment: AlignmentType.CENTER, spacing: { before: 400 } }))
  ch.push(P([t(`Започната на: ${first ? dmy(first) + ' г.' : '........................'}`)], { alignment: AlignmentType.CENTER, spacing: { before: 2000 } }))
  ch.push(P([t(`Приключена на: ${last ? dmy(last) + ' г.' : '........................'}`)], { alignment: AlignmentType.CENTER }))
  if (body === 'ps') ch.push(P([t('Наредба № 8/2016, Приложение № 2 — срок за съхранение 20 г.', { italics: true, size: 18, color: '555555' })], { alignment: AlignmentType.CENTER, spacing: { before: 1200 } }))

  // поименен списък на членовете
  ch.push(new Paragraph({ children: [new PageBreak()] }))
  ch.push(P([t(`ПОИМЕНЕН СПИСЪК НА ЧЛЕНОВЕТЕ ${body === 'ps' ? 'НА ПЕДАГОГИЧЕСКИЯ СЪВЕТ' : 'НА ОБЩОТО СЪБРАНИЕ'}`, { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 60 } }))
  ch.push(P([t(`към началото на учебната ${yearName} година`)], { alignment: AlignmentType.CENTER, spacing: { after: 200 } }))
  const rc = [700, 4600, 3800]
  ch.push(table(rc, [
    new TableRow({ tableHeader: true, children: [cell(rc[0], '№', { head: true, center: true }), cell(rc[1], 'Име и фамилия', { head: true }), cell(rc[2], 'Длъжност', { head: true })] }),
    ...roster.map((p, i) => new TableRow({ children: [cell(rc[0], String(i + 1), { center: true }), cell(rc[1], fullName(p)), cell(rc[2], p.position || '')] })),
  ]))

  // регистър на решенията
  ch.push(new Paragraph({ children: [new PageBreak()] }))
  ch.push(P([t('РЕГИСТЪР НА ЗАСЕДАНИЯТА И РЕШЕНИЯТА', { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 200 } }))
  const dc = [900, 1300, 5300, 1600]
  const rows: TableRow[] = [new TableRow({ tableHeader: true, children: [cell(dc[0], 'Протокол №', { head: true, center: true }), cell(dc[1], 'Дата', { head: true, center: true }), cell(dc[2], 'Решение', { head: true }), cell(dc[3], 'Резултат', { head: true, center: true })] })]
  for (const d of sorted) {
    const nums = decisionNumbers(d.items, d.decisions)
    const ds = [...d.decisions].sort((a, b) => nums[a.id] - nums[b.id])
    if (!ds.length) rows.push(new TableRow({ children: [cell(dc[0], String(d.m.meeting_no ?? ''), { center: true }), cell(dc[1], dmy(d.m.meeting_date), { center: true }), cell(dc[2], '—'), cell(dc[3], '')] }))
    ds.forEach(x => rows.push(new TableRow({ children: [
      cell(dc[0], `${d.m.meeting_no ?? ''}.${nums[x.id]}`, { center: true }), cell(dc[1], dmy(d.m.meeting_date), { center: true }),
      cell(dc[2], x.text), cell(dc[3], x.kind === 'noted' ? 'за сведение' : `${OUTCOME_LABEL[x.outcome].toLowerCase()}\n${x.votes_for ?? 0}/${x.votes_against ?? 0}/${x.votes_abstain ?? 0}`, { center: true }),
    ] })))
  }
  ch.push(table(dc, rows))

  for (const d of sorted) {
    ch.push(new Paragraph({ children: [new PageBreak()] }))
    ch.push(...protocolChildren(d, { withSheet: false }))
  }

  ch.push(new Paragraph({ children: [new PageBreak()] }))
  ch.push(P([t(`Книгата съдържа ${sorted.length} протокола. Приключена на ${last ? dmy(last) + ' г.' : '................'}`)], { spacing: { before: 400 } }))
  ch.push(P([t('Изготвил: ................................')], { spacing: { before: 500 } }))
  ch.push(P([t('Директор: ................................')], { spacing: { before: 300 } }))
  ch.push(P([t('(печат)', { italics: true, size: 20 })], { indent: { left: 1600 } }))

  const doc = new Document({ sections: [{ properties: PORTRAIT, footers: footer(), children: ch }] })
  return out(doc, `Книга_${body === 'ps' ? 'ПС' : 'ОС'}_${yearName.replace(/\//g, '-')}.docx`)
}

export { BODY_LABEL }
