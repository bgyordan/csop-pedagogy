// Хронология на онлайн стаята за един ОРЕС период — доказателство, че обучението от разстояние е проведено:
// какво е публикувано, от кого и кога, кога родителят го е видял, въпроси и отговори.

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } from 'docx'
import { saveAs } from 'file-saver'
import { header } from './docx-substitution'

export interface OresChronologyData {
  studentName: string
  from: string
  to: string | null
  reason: string | null
  visits: number
  posts: {
    at: string; author: string; body: string; link: string; file: string
    seen: string | null; hidden: string
    thread: { at: string; who: string; text: string }[]
  }[]
}

const fmtD = (d: string) => d.split('-').reverse().join('.')
const fmtT = (d: string) => new Date(d).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const t = (text: string, o: { bold?: boolean; size?: number; italics?: boolean; color?: string } = {}) => new TextRun({ text, size: o.size || 20, bold: o.bold, italics: o.italics, color: o.color })

export async function generateOresChronology(d: OresChronologyData) {
  const B = { style: BorderStyle.SINGLE, size: 4, color: '8C8C8C' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const th = (s: string) => new TableCell({ borders: CELLS, shading: { type: ShadingType.CLEAR, fill: 'EDF2F7', color: 'auto' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [t(s, { bold: true, size: 19 })] })] })
  const td = (paras: Paragraph[]) => new TableCell({ borders: CELLS, children: paras })
  const P = (runs: TextRun[], after = 40) => new Paragraph({ spacing: { after }, children: runs })

  const rows: TableRow[] = [new TableRow({ tableHeader: true, children: [th('№'), th('Дата и час'), th('Учител'), th('Материал / указания'), th('Видяно от родителя')] })]
  d.posts.forEach((p, i) => {
    const content: Paragraph[] = []
    if (p.body) p.body.split('\n').forEach(line => content.push(P([t(line)], 20)))
    if (p.link) content.push(P([t('Линк: ', { bold: true }), t(p.link)]))
    if (p.file) content.push(P([t('Файл: ', { bold: true }), t(p.file)]))
    if (p.hidden) content.push(P([t(p.hidden, { italics: true, color: '7A7A7A' })]))
    p.thread.forEach(m => content.push(P([t(`${m.who}, ${fmtT(m.at)}: `, { bold: true, size: 18 }), t(m.text, { size: 18 })], 20)))
    if (!content.length) content.push(P([t('—')]))
    rows.push(new TableRow({ children: [
      td([P([t(String(i + 1))])]),
      td([P([t(fmtT(p.at))])]),
      td([P([t(p.author)])]),
      td(content),
      td([P([t(p.seen ? fmtT(p.seen) : 'не е видяно')])]),
    ] }))
  })

  const children: any[] = [
    ...header(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, children: [t('ХРОНОЛОГИЯ НА ОБУЧЕНИЕТО ОТ РАЗСТОЯНИЕ', { bold: true, size: 26 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [t('онлайн стая в ЕИС — материали и указания за родителя', { italics: true })] }),
    P([t('Ученик: ', { bold: true, size: 22 }), t(d.studentName, { size: 22 })]),
    P([t('Период на ОРЕС: ', { bold: true, size: 22 }), t(`от ${fmtD(d.from)}${d.to ? ` до ${fmtD(d.to)}` : ''}`, { size: 22 })]),
    ...(d.reason ? [P([t('Основание: ', { bold: true, size: 22 }), t(d.reason, { size: 22 })])] : []),
    P([t('Публикации: ', { bold: true, size: 22 }), t(`${d.posts.length}`, { size: 22 }), t('   ·   Отваряния на линка от родителя: ', { bold: true, size: 22 }), t(`${d.visits}`, { size: 22 })], 200),
  ]
  if (d.posts.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [450, 1500, 1700, 4300, 1500], rows }))
  else children.push(P([t('Няма публикации за периода.', { italics: true })]))
  children.push(new Paragraph({ spacing: { before: 240 }, children: [t(`Справката е генерирана от ЕИС на ${fmtT(new Date().toISOString())}.`, { italics: true, size: 18, color: '7A7A7A' })] }))

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `хронология_ОРЕС_${d.studentName.replace(/\s+/g, '_')}_${d.from}.docx`)
}
