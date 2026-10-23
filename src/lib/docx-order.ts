// Генератор на заповеди — Word файлът. Същото оформление като прегледа на екрана:
// бланка с логото → ЗАПОВЕД № … → основание → разпоредителна дума → точки → подпис → запознати.
import { Document, Packer, Paragraph, TextRun, AlignmentType, TabStopType, LeaderType } from 'docx'
import { saveAs } from 'file-saver'
import { header } from './docx-substitution'
import { CENTER_CITY, runs, dmy, type OrderBody, type StaffLite } from './order-generator'

const F = 'Times New Roman'
const SZ = 24
const tr = (text: string, o: any = {}) => new TextRun({ text, font: F, size: SZ, ...o })

function richRuns(s: string, o: any = {}) {
  return runs(s).map(r => r.missing ? tr('…………………', o) : tr(r.text, { ...o, bold: r.bold || o.bold }))
}

export type OrderDocData = {
  body: OrderBody
  number?: string | null        // „045/23.10.2026г.“; празно = чернова
  date: string                  // ISO
  director: string
  people: StaffLite[]           // запознати
}

export function orderChildren(d: OrderDocData) {
  const out: Paragraph[] = []
  header().forEach((p: any) => out.push(p))
  out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 40 }, children: [tr('ЗАПОВЕД', { bold: true, size: 32, characterSpacing: 80 })] }))
  out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [tr(d.number ? `№ ${d.number}` : `№ ........../${dmy(d.date) || '..........'} г.`)] }))
  out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 280 }, children: [tr(CENTER_CITY)] }))

  out.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 567 }, spacing: { after: 200, line: 300 }, children: [tr('На основание '), ...richRuns(d.body.basis)] }))
  out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200 }, children: [tr(`${d.body.verb}:`, { bold: true, characterSpacing: 60 })] }))

  const all = [...d.body.points, ...d.body.closing].filter(x => x.trim())
  all.forEach((pt, i) => {
    const [first, ...rest] = pt.split('\n')
    out.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 567 }, spacing: { after: rest.length ? 40 : 120, line: 300 }, children: [tr(`${i + 1}. `), ...richRuns(first)] }))
    rest.forEach((ln, j) => out.push(new Paragraph({
      alignment: AlignmentType.LEFT, indent: { left: 1134 }, spacing: { after: j === rest.length - 1 ? 120 : 20, line: 280 }, children: richRuns(ln),
    })))
  })

  out.push(new Paragraph({ spacing: { before: 480 }, tabStops: [{ type: TabStopType.LEFT, position: 5200 }], children: [tr('ДИРЕКТОР:', { bold: true }), tr('\t.................................')] }))
  out.push(new Paragraph({ tabStops: [{ type: TabStopType.LEFT, position: 5200 }], children: [tr(`\t/ ${d.director || '…………………'} /`, { size: 22 })] }))

  if (d.people.length) {
    out.push(new Paragraph({ spacing: { before: 400, after: 100 }, children: [tr('Запознати със заповедта:', { bold: true, size: 22 })] }))
    d.people.forEach((p, i) => out.push(new Paragraph({
      spacing: { after: 80 },
      tabStops: [{ type: TabStopType.RIGHT, position: 9600, leader: LeaderType.DOT }],
      children: [tr(`${i + 1}. ${p.name}${p.position ? ` – ${p.position}` : ''}`, { size: 22 }), tr('\t', { size: 22 })],
    })))
  }
  return out
}

export async function generateOrderDocx(d: OrderDocData) {
  const doc = new Document({
    styles: { default: { document: { run: { font: F, size: SZ } } } },
    sections: [{ properties: { page: { margin: { top: 850, bottom: 850, left: 1418, right: 850 } } }, children: orderChildren(d) }],
  })
  const blob = await Packer.toBlob(doc)
  const safe = (d.number || `чернова_${dmy(d.date)}`).replace(/[^0-9A-Za-zА-Яа-я_.-]+/g, '_')
  saveAs(blob, `Заповед_${safe}.docx`)
}
