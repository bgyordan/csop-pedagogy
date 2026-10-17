// Хронология на стаята на паралелката — доказателство, че обучението от разстояние е проведено:
// по дни кой учител какво е публикувал (за цялата паралелка или за едно дете), колко родители са го видели,
// въпросите и отговорите; накрая — таблица с отварянията на линка по деца.

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } from 'docx'
import { saveAs } from 'file-saver'
import { header } from './docx-substitution'

export interface ClassRoomChronologyData {
  className: string
  from: string
  to: string
  reason: string | null
  posts: {
    at: string; author: string; subject: string; target: string
    body: string; link: string; file: string; hidden: string
    seen: number; of: number; seenNames: string[]
    thread: { at: string; who: string; text: string }[]
  }[]
  parents: { name: string; visits: number; first: string | null; last: string | null; stopped: boolean }[]
}

const fmtD = (d: string) => d.split('-').reverse().join('.')
const sofia = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', ...o })
const fmtT = (d: string) => sofia(d, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const hm = (d: string) => sofia(d, { hour: '2-digit', minute: '2-digit' })
const dayKey = (d: string) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
const dayTitle = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const t = (text: string, o: { bold?: boolean; size?: number; italics?: boolean; color?: string } = {}) => new TextRun({ text, size: o.size || 20, bold: o.bold, italics: o.italics, color: o.color })

export async function generateClassRoomChronology(d: ClassRoomChronologyData) {
  const B = { style: BorderStyle.SINGLE, size: 4, color: '8C8C8C' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const th = (s: string) => new TableCell({ borders: CELLS, shading: { type: ShadingType.CLEAR, fill: 'EDF2F7', color: 'auto' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [t(s, { bold: true, size: 18 })] })] })
  const td = (paras: Paragraph[]) => new TableCell({ borders: CELLS, children: paras })
  const P = (runs: TextRun[], after = 40) => new Paragraph({ spacing: { after }, children: runs })

  const children: any[] = [
    ...header(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, children: [t('ХРОНОЛОГИЯ НА ОБУЧЕНИЕТО ОТ РАЗСТОЯНИЕ', { bold: true, size: 26 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [t('онлайн стая на паралелката в ЕИС — материали и указания за родителите', { italics: true })] }),
    P([t('Паралелка: ', { bold: true, size: 22 }), t(d.className, { size: 22 })]),
    P([t('Период: ', { bold: true, size: 22 }), t(`от ${fmtD(d.from)} до ${fmtD(d.to)}`, { size: 22 })]),
    ...(d.reason ? [P([t('Повод: ', { bold: true, size: 22 }), t(d.reason, { size: 22 })])] : []),
    P([
      t('Публикации: ', { bold: true, size: 22 }), t(`${d.posts.length}`, { size: 22 }),
      t('   ·   Деца/родители: ', { bold: true, size: 22 }), t(`${d.parents.length}`, { size: 22 }),
      t('   ·   Отворили стаята поне веднъж: ', { bold: true, size: 22 }), t(`${d.parents.filter(p => p.visits > 0).length}`, { size: 22 }),
    ], 200),
  ]

  // по дни
  const days: Record<string, ClassRoomChronologyData['posts']> = {}
  d.posts.forEach(p => { (days[dayKey(p.at)] = days[dayKey(p.at)] || []).push(p) })
  const keys = Object.keys(days).sort()
  if (!keys.length) children.push(P([t('Няма публикации за периода.', { italics: true })]))
  keys.forEach(k => {
    children.push(new Paragraph({ spacing: { before: 200, after: 80 }, children: [t(dayTitle(k), { bold: true, size: 22 })] }))
    const rows: TableRow[] = [new TableRow({ tableHeader: true, children: [th('Час'), th('Учител'), th('Предмет'), th('За кого'), th('Материал / указания'), th('Видели')] })]
    days[k].forEach(p => {
      const content: Paragraph[] = []
      if (p.body) p.body.split('\n').forEach(line => content.push(P([t(line, { size: 19 })], 20)))
      if (p.link) content.push(P([t('Линк: ', { bold: true, size: 19 }), t(p.link, { size: 19 })]))
      if (p.file) content.push(P([t('Файл: ', { bold: true, size: 19 }), t(p.file, { size: 19 })]))
      if (p.hidden) content.push(P([t(p.hidden, { italics: true, color: '7A7A7A', size: 18 })]))
      p.thread.forEach(m => content.push(P([t(`${m.who}, ${fmtT(m.at)}: `, { bold: true, size: 17 }), t(m.text, { size: 17 })], 20)))
      if (!content.length) content.push(P([t('—')]))
      const seenParas = [P([t(p.of === 1 ? (p.seen ? 'видяно' : 'не е видяно') : `${p.seen} от ${p.of}`, { size: 19 })])]
      if (p.of > 1 && p.seenNames.length) seenParas.push(P([t(p.seenNames.join(', '), { size: 16, color: '555555' })]))
      rows.push(new TableRow({ children: [
        td([P([t(hm(p.at), { size: 19 })])]),
        td([P([t(p.author, { size: 19 })])]),
        td([P([t(p.subject || '—', { size: 19 })])]),
        td([P([t(p.target, { size: 19 })])]),
        td(content),
        td(seenParas),
      ] }))
    })
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [700, 1500, 1300, 1300, 3400, 1300], rows }))
  })

  // отваряния по деца
  children.push(new Paragraph({ spacing: { before: 320, after: 80 }, children: [t('Отваряния на личния линк от родителите', { bold: true, size: 22 })] }))
  const prow: TableRow[] = [new TableRow({ tableHeader: true, children: [th('№'), th('Дете'), th('Отваряния'), th('Първо'), th('Последно')] })]
  d.parents.forEach((p, i) => prow.push(new TableRow({ children: [
    td([P([t(String(i + 1), { size: 19 })])]),
    td([P([t(p.name + (p.stopped ? ' (линкът е спрян)' : ''), { size: 19 })])]),
    td([P([t(String(p.visits), { size: 19 })])]),
    td([P([t(p.first ? fmtT(p.first) : '—', { size: 19 })])]),
    td([P([t(p.last ? fmtT(p.last) : '—', { size: 19 })])]),
  ] })))
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [500, 3800, 1300, 1900, 1900], rows: prow }))
  children.push(new Paragraph({ spacing: { before: 240 }, children: [t(`Справката е генерирана от ЕИС на ${fmtT(new Date().toISOString())}.`, { italics: true, size: 18, color: '7A7A7A' })] }))

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `хронология_стая_паралелка_${d.className}_${d.from}.docx`)
}
