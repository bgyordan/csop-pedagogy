// „Посещение на час“ — графикът като Word (за папката на директора / заповедта за контролна дейност).
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, PageOrientation, TableLayoutType, VerticalAlign, ShadingType } from 'docx'
import { saveAs } from 'file-saver'

const F = 'Times New Roman'
const t = (text: string, o: any = {}) => new TextRun({ text, font: F, size: 22, ...o })
const dm = (s: string) => s.split('-').reverse().join('.')

export async function generateVisitSchedule(d: {
  title: string; focus: string | null; from: string; to: string
  rows: { date: string; period: string; teacher: string; cls: string; subject: string; topic: string }[]
}) {
  const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const COLS = [600, 1800, 2200, 3000, 2000, 2200, 3600]   // A4 хоризонтално, сума 15400
  const cell = (i: number, text: string, head = false) => new TableCell({
    borders: CELLS, width: { size: COLS[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    ...(head ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EEF1F6' } } : {}),
    children: [new Paragraph({ alignment: i === 0 ? AlignmentType.CENTER : AlignmentType.LEFT, children: [t(text, head ? { bold: true, size: 20 } : { size: 20 })] })],
  })
  const head = new TableRow({ tableHeader: true, children: ['№', 'Дата', 'Час', 'Учител', 'Паралелка', 'Предмет', 'Тема'].map((h, i) => cell(i, h, true)) })
  const rows = d.rows.map((r, n) => new TableRow({ cantSplit: true, children: [
    cell(0, String(n + 1)), cell(1, r.date), cell(2, r.period), cell(3, r.teacher), cell(4, r.cls), cell(5, r.subject), cell(6, r.topic),
  ] }))
  const doc = new Document({ sections: [{
    properties: { page: { size: { orientation: PageOrientation.LANDSCAPE, width: 16838, height: 11906 }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [t('Център за специална образователна подкрепа – гр. Варна')] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160 }, children: [t(`ГРАФИК — ${d.title.toUpperCase()}`, { bold: true, size: 26 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [t(`${dm(d.from)} – ${dm(d.to)}${d.focus ? ` · основна тема: ${d.focus}` : ''}`)] }),
      new Table({ width: { size: COLS.reduce((a, x) => a + x, 0), type: WidthType.DXA }, columnWidths: COLS, layout: TableLayoutType.FIXED, rows: [head, ...rows] }),
      new Paragraph({ spacing: { before: 480 }, children: [t('Директор: ....................................')] }),
      new Paragraph({ children: [t('/ Светлана Иванова /', { size: 20 })] }),
    ],
  }] })
  saveAs(await Packer.toBlob(doc), `Посещения_${d.from}.docx`)
}
