// Дневникът на случаите като Word — за печат/архив вместо хартиената книга (хоризонтално, таблица).
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, PageOrientation, TableLayoutType, VerticalAlign } from 'docx'
import { saveAs } from 'file-saver'
import { KINDS, STATUS, LEVELS, ROLE_LABEL, fmtDate } from './incidents'
import type { Case, Participant } from './incidents'

const F = 'Times New Roman'
const t = (text: string, o: any = {}) => new TextRun({ text, font: F, size: 18, ...o })

export async function generateIncidentRegister(d: { yearName: string; periodLabel: string; cases: Case[]; parts: Participant[]; students: Record<string, string>; staff: Record<string, string> }) {
  const B = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const COLS = [600, 1300, 1400, 2600, 1700, 4200, 2200, 1400]   // сума 15400 (A4 хоризонтално, полета 720)
  const cell = (i: number, lines: string[], bold = false) => new TableCell({
    borders: CELLS, width: { size: COLS[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: lines.map(l => new Paragraph({ children: [t(l, bold ? { bold: true } : {})] })),
  })
  const head = new TableRow({ tableHeader: true, children: ['№', 'Дата, час', 'Място', 'Деца (роля)', 'Вид, форма, ниво', 'Какво се случи', 'Предприети действия', 'Статус'].map((h, i) => cell(i, [h], true)) })
  const rows = d.cases.slice().sort((a, b) => a.number - b.number).map(c => {
    const ps = d.parts.filter(p => p.case_id === c.id)
    const lvl = LEVELS[c.kind].find(l => l.n === c.level)?.label || ''
    return new TableRow({ cantSplit: true, children: [
      cell(0, [String(c.number)]),
      cell(1, [fmtDate(c.occurred_on), c.occurred_time ? c.occurred_time.slice(0, 5) : '']),
      cell(2, [c.place || '']),
      cell(3, ps.map(p => `${p.student_id ? d.students[p.student_id] || '—' : p.name} (${ROLE_LABEL[p.role]})`)),
      cell(4, [KINDS[c.kind].short, c.forms.join(', '), lvl].filter(Boolean)),
      cell(5, [c.description, ...(c.antecedents.length ? [`Преди: ${c.antecedents.join(', ')}`] : []), ...(c.consequences.length ? [`След: ${c.consequences.join(', ')}`] : [])]),
      cell(6, [c.actions.join(', '), c.reported_by ? `Констатирал: ${d.staff[c.reported_by] || ''}` : ''].filter(Boolean)),
      cell(7, [STATUS[c.status].label, ...(c.closed_on ? [fmtDate(c.closed_on)] : [])]),
    ] })
  })
  const doc = new Document({ sections: [{
    properties: { page: { size: { orientation: PageOrientation.LANDSCAPE, width: 16838, height: 11906 }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [t('Център за специална образователна подкрепа – гр. Варна', { size: 22 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [t('ДНЕВНИК НА СЛУЧАИТЕ НА ТОРМОЗ И ИНЦИДЕНТИ С ПОВЕДЕНИЕ', { bold: true, size: 24 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [t(`Учебна ${d.yearName} г.${d.periodLabel ? ` · ${d.periodLabel}` : ''} · ${d.cases.length} случая`, { size: 20 })] }),
      new Table({ width: { size: COLS.reduce((a, x) => a + x, 0), type: WidthType.DXA }, columnWidths: COLS, layout: TableLayoutType.FIXED, rows: [head, ...rows] }),
    ],
  }] })
  saveAs(await Packer.toBlob(doc), `Дневник_случаи_${d.yearName.replace('/', '-')}.docx`)
}
