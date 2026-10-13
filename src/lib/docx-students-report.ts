// Word справка „Ученици по изпращащи училища“ — генерира точно това, което е на екрана
// (групиране, подреждане, филтри, колони). Данните идват готови от StudentsReportData.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, ImageRun, PageOrientation,
} from 'docx'
import { saveAs } from 'file-saver'
import { CSOP_LOGO_B64 } from './docx-generator'
import type { StudentsReportData } from './pdf-generator'

const NAVY = '0f2240'
const B = { style: BorderStyle.SINGLE, size: 4, color: '8C96A3' }
const CELLS = { top: B, bottom: B, left: B, right: B }
const NONE = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}
const MARGIN = 850 // ~1,5 см

function logoBytes(): Uint8Array {
  return Uint8Array.from(atob(CSOP_LOGO_B64), c => c.charCodeAt(0))
}

function header(width: number): (Table | Paragraph)[] {
  const left = Math.round(width * 0.12)
  return [
    new Table({
      width: { size: width, type: WidthType.DXA },
      columnWidths: [left, width - left],
      rows: [new TableRow({ children: [
        new TableCell({
          width: { size: left, type: WidthType.DXA }, borders: NONE,
          children: [new Paragraph({ children: [new ImageRun({ data: logoBytes(), transformation: { width: 56, height: 56 }, type: 'jpg' })] })],
        }),
        new TableCell({
          width: { size: width - left, type: WidthType.DXA }, borders: NONE, verticalAlign: 'center' as any,
          children: [
            new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Център за специална образователна подкрепа – гр. Варна', bold: true, size: 22 })] }),
            new Paragraph({ children: [new TextRun({ text: 'ул. „Петко Стайнов" №7  |  info-400052@edu.mon.bg  |  тел. 052 619 456', size: 19, italics: true, color: '262626' })] }),
          ],
        }),
      ]})],
    }),
    new Paragraph({ spacing: { before: 60, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY } }, children: [] }),
  ]
}

function cell(text: string, w: number, opts: { bold?: boolean; fill?: string; center?: boolean; span?: number; keepNext?: boolean; color?: string } = {}) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    columnSpan: opts.span,
    borders: CELLS,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
    margins: { top: 40, bottom: 40, left: 90, right: 90 },
    children: [new Paragraph({
      keepNext: opts.keepNext,
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text, bold: opts.bold, size: 20, color: opts.color })],
    })],
  })
}

export async function generateStudentsReportDocx(d: StudentsReportData) {
  const pageW = d.landscape ? 16838 : 11906
  const width = pageW - 2 * MARGIN

  // ширини: № = 6% от реда, останалото пропорционално
  const numW = Math.round(width * 0.06)
  const sum = d.widths.reduce((a, b) => a + b, 0) || 1
  const colW = d.widths.map(w => Math.floor((w / sum) * (width - numW)))
  colW[colW.length - 1] += (width - numW) - colW.reduce((a, b) => a + b, 0)
  const allW = [numW, ...colW]
  const span = allW.length

  const children: (Table | Paragraph)[] = [...header(width)]
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: d.title.toUpperCase(), bold: true, size: 26, color: NAVY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: d.subtitle, size: 20, color: '404040' })] }),
  )

  const headRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: ['№', ...d.headers].map((h, i) => cell(h, allW[i], { bold: true, fill: 'E8EEF5', center: i === 0, keepNext: true })),
  })

  const rows: TableRow[] = [headRow]
  d.groups.forEach(g => {
    if (g.title) {
      rows.push(new TableRow({ cantSplit: true, children: [new TableCell({
        width: { size: width, type: WidthType.DXA }, columnSpan: span, borders: CELLS,
        shading: { type: ShadingType.CLEAR, fill: 'F3F6FA', color: 'auto' },
        margins: { top: 60, bottom: 60, left: 90, right: 90 },
        children: [new Paragraph({ keepNext: true, children: [
          new TextRun({ text: g.title, bold: true, size: 21, color: NAVY }),
          ...(g.meta ? [new TextRun({ text: `   ·   ${g.meta}`, size: 19, color: '404040' })] : []),
        ] })],
      })] }))
    }
    g.cells.forEach((c, i) => {
      const keep = i < g.cells.length - 1 && g.cells.length <= 12 // малките групи не се късат
      rows.push(new TableRow({ cantSplit: true, children: [
        cell(String(i + 1), allW[0], { center: true, keepNext: keep }),
        ...c.map((v, j) => cell(v || '—', allW[j + 1], { keepNext: keep })),
      ] }))
    })
  })

  children.push(new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: allW, rows }))
  children.push(
    new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: `Общо: ${d.total} ученици`, bold: true, size: 22, color: NAVY })] }),
  )

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 22 } } } },
    sections: [{
      properties: {
        page: {
          // docx сам обръща A4 при LANDSCAPE
          size: { orientation: d.landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      children,
    }],
  })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${d.fileName}.docx`)
}
