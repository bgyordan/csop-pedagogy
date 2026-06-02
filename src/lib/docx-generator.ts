import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, ImageRun,
} from 'docx'
import { saveAs } from 'file-saver'
import { DocumentType, StaffProfile, Student } from '@/types'
import { formatDate, getFullName } from './utils'

const CSOP_LOGO_B64 = "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"

const BORDER_NONE = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}

// Помощни функции за типография
const bold = (text: string, size = 22) => new TextRun({ text, bold: true, size })
const normal = (text: string, size = 22) => new TextRun({ text, size })

function header(yearName: string): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Център за специална образователна подкрепа - гр. Варна', bold: true, size: 24 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'ул. „Петко Стайнов" №7, e-mail: info-400052@edu.mon.bg, тел. 052 619 456', size: 18, italics: true })],
    }),
    new Paragraph({ text: '' }),
  ]
}

function line(label: string, value = ''): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      bold(`${label}: `),
      new TextRun({ text: value || '................................................................', size: 22 }),
    ],
  })
}

function dotLine(label: string): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      bold(label),
      new TextRun({ text: '  .....................................................', size: 22 }),
    ],
  })
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [bold(text)],
  })
}

function textBlock(text: string, minLines = 3): Paragraph[] {
  const lines = text ? [new Paragraph({ children: [normal(text)] })] : []
  const dots = Array.from({ length: Math.max(0, minLines - (text ? 1 : 0)) }, () =>
    new Paragraph({ children: [new TextRun({ text: '...........................................................................................................................................', size: 22 })] })
  )
  return [...lines, ...dots]
}

// ── ПРОТОКОЛИ ────────────────────────────────────────────────────────────────

function generateProtocol1(student: Student, team: any, data: Record<string, string>, yearName: string): Document {
  const studentName = getFullName(student)
  const sessionDate = data.session_date ? formatDate(data.session_date) : '..................'
  
  return new Document({
    sections: [{
      properties: {},
      children: [
        ...header(yearName),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [bold(`Протокол № ___ / ${sessionDate} г.`, 26)] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'от заседание на Екипа за подкрепа на личностното развитие', bold: true, size: 22, italics: true })] }),
        new Paragraph({ spacing: { after: 120 }, children: [normal('Днес, '), bold(sessionDate), normal(` г. в ЦСОП–Варна се проведе заседание на Екипа за подкрепа на личностното развитие на `), bold(studentName), normal(', ученик от '), bold(data.class_name || '___ клас'), normal('.')] }),
        new Paragraph({ spacing: { after: 200 }, children: [normal('На заседанието присъства '), normal(data.parent_name || '................................................................'), normal(', родител на '), normal(studentName), normal('.')] }),
        sectionTitle('I. Обсъждани теми:'),
        ...[
          '1. Екипът запозна родителя с направената функционална оценка на ученика',
          '2. Разгледаха се вида и формата на обучение на ученика, индивидуалния учебен план и индивидуалните учебни програми',
          '3. Обсъди се вид, форма и честота на допълнителната подкрепа, предложени в плана за подкрепа',
          `4. ${data.other_topics || 'Други'}`
        ].map(t => new Paragraph({ spacing: { after: 80 }, children: [normal(t)] })),
        sectionTitle('II. Приети решения:'),
        ...textBlock(data.decisions || '', 4),
        sectionTitle('Екип за подкрепа на личностното развитие:'),
        dotLine(`- ${team?.class_teacher ? getFullName(team.class_teacher) : '................................................'} /председател/`),
        dotLine(`- ${team?.psychologist ? getFullName(team.psychologist) : '................................................'} /психолог/`),
        dotLine(`- ${team?.speech_therapist ? getFullName(team.speech_therapist) : '................................................'} /логопед/`),
        dotLine(`- ${team?.rehabilitator ? getFullName(team.rehabilitator) : '................................................'} /рехабилитатор/`),
        new Paragraph({ text: '' }),
        line('Име и фамилия на родителя', data.parent_name),
        new Paragraph({ spacing: { after: 80 }, children: [bold('Мнение на родителя:')] }),
        ...textBlock(data.parent_opinion || '', 3),
        new Paragraph({ spacing: { before: 200 }, children: [bold('Подпис: '), normal('................................')] }),
      ],
    }],
  })
}

// ... (останалите протоколи 2 и 3, и IAP/SupportPlan функциите остават по същата логика)

export async function generateAndDownloadDocument(
  docType: DocumentType,
  student: Student,
  team: any,
  data: Record<string, string>,
  yearName: string
) {
  let doc: Document
  switch (docType) {
    case 'protocol_1': doc = generateProtocol1(student, team, data, yearName); break
    // ... останалите кейсове
    default: doc = generateProtocol1(student, team, data, yearName)
  }
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${docType}_${getFullName(student).replace(/ /g, '_')}_${yearName}.docx`)
}
