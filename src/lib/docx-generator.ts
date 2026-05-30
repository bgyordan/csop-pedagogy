import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  HeadingLevel,
  AlignmentType,
  PageOrientation,
} from 'docx'
import { saveAs } from 'file-saver'
import { DocumentType, StaffProfile, Student } from '@/types'
import { formatDate, getFullName } from './utils'

function makeHeader(title: string, subtitle: string, year: string) {
  return [
    new Paragraph({
      text: 'ЦСОП — гр. Варна',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: subtitle,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: `Учебна година ${year}`,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '' }),
  ]
}

function labeledField(label: string, value: string = '') {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value || '________________________________' }),
    ],
    spacing: { after: 120 },
  })
}

function sectionTitle(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
  })
}

// ---- ПРОТОКОЛ 1 ----
export function generateProtocol1(
  student: Student,
  team: { psychologist?: StaffProfile; speech_therapist?: StaffProfile; rehabilitator?: StaffProfile; class_teacher?: StaffProfile },
  data: Record<string, string>,
  yearName: string
) {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        ...makeHeader('ПРОТОКОЛ № ___', 'от заседание на ЕПЛР — начало на учебната година', yearName),
        labeledField('Ученик', getFullName(student)),
        labeledField('Дата на раждане', formatDate(student.birth_date)),
        labeledField('Дата на заседание', data.session_date),
        new Paragraph({ text: '' }),
        sectionTitle('Членове на ЕПЛР:'),
        labeledField('Психолог', team.psychologist ? getFullName(team.psychologist) : ''),
        labeledField('Логопед', team.speech_therapist ? getFullName(team.speech_therapist) : ''),
        labeledField('Рехабилитатор', team.rehabilitator ? getFullName(team.rehabilitator) : ''),
        labeledField('Класен ръководител', team.class_teacher ? getFullName(team.class_teacher) : ''),
        new Paragraph({ text: '' }),
        sectionTitle('Актуално ниво на развитие:'),
        new Paragraph({ text: data.current_level || '________________________________' }),
        new Paragraph({ text: '' }),
        sectionTitle('Цели за учебната година:'),
        new Paragraph({ text: data.goals || '________________________________' }),
        new Paragraph({ text: '' }),
        sectionTitle('Препоръки:'),
        new Paragraph({ text: data.recommendations || '________________________________' }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),
        sectionTitle('Подписи:'),
        labeledField('Психолог'),
        labeledField('Логопед'),
        labeledField('Рехабилитатор'),
        labeledField('Класен ръководител'),
      ],
    }],
  })
  return doc
}

// ---- ИУП ----
export function generateIUP(
  student: Student,
  team: { class_teacher?: StaffProfile },
  data: Record<string, string>,
  yearName: string
) {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        ...makeHeader('ИНДИВИДУАЛЕН УЧЕБЕН ПЛАН (ИУП)', '', yearName),
        labeledField('Ученик', getFullName(student)),
        labeledField('Дата на раждане', formatDate(student.birth_date)),
        labeledField('Класен ръководител', team.class_teacher ? getFullName(team.class_teacher) : ''),
        new Paragraph({ text: '' }),
        sectionTitle('Учебни предмети и часове:'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Предмет', alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: 'Часове седмично', alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: 'Забележки', alignment: AlignmentType.CENTER })] }),
              ],
            }),
            ...Array(8).fill(null).map(() =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: '' })] }),
                  new TableCell({ children: [new Paragraph({ text: '' })] }),
                  new TableCell({ children: [new Paragraph({ text: '' })] }),
                ],
              })
            ),
          ],
        }),
        new Paragraph({ text: '' }),
        sectionTitle('Допълнителна подкрепа:'),
        new Paragraph({ text: data.additional_support || '________________________________' }),
        new Paragraph({ text: '' }),
        labeledField('Дата на утвърждаване', data.approved_date),
        labeledField('Директор'),
      ],
    }],
  })
  return doc
}

// ---- ПЛАН ЗА ДОПЪЛНИТЕЛНА ПОДКРЕПА ----
export function generateSupportPlan(
  student: Student,
  data: Record<string, string>,
  yearName: string
) {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        ...makeHeader('ПЛАН ЗА ДОПЪЛНИТЕЛНА ПОДКРЕПА', '', yearName),
        labeledField('Ученик', getFullName(student)),
        labeledField('Период', data.period || yearName),
        new Paragraph({ text: '' }),
        sectionTitle('Цели:'),
        new Paragraph({ text: data.goals || '________________________________' }),
        new Paragraph({ text: '' }),
        sectionTitle('Дейности:'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Дейност' })] }),
                new TableCell({ children: [new Paragraph({ text: 'Отговорник' })] }),
                new TableCell({ children: [new Paragraph({ text: 'Срок' })] }),
                new TableCell({ children: [new Paragraph({ text: 'Резултат' })] }),
              ],
            }),
            ...Array(6).fill(null).map(() =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: '' })] }),
                  new TableCell({ children: [new Paragraph({ text: '' })] }),
                  new TableCell({ children: [new Paragraph({ text: '' })] }),
                  new TableCell({ children: [new Paragraph({ text: '' })] }),
                ],
              })
            ),
          ],
        }),
        new Paragraph({ text: '' }),
        sectionTitle('Оценка на резултатите:'),
        new Paragraph({ text: data.evaluation || '________________________________' }),
      ],
    }],
  })
  return doc
}

// ---- MAIN EXPORT FUNCTION ----
export async function generateAndDownloadDocument(
  docType: DocumentType,
  student: Student,
  team: {
    psychologist?: StaffProfile
    speech_therapist?: StaffProfile
    rehabilitator?: StaffProfile
    class_teacher?: StaffProfile
  },
  data: Record<string, string>,
  yearName: string
) {
  let doc: Document

  switch (docType) {
    case 'protocol_1':
    case 'protocol_2':
    case 'protocol_3':
      doc = generateProtocol1(student, team, data, yearName)
      break
    case 'iup':
      doc = generateIUP(student, team, data, yearName)
      break
    case 'support_plan':
      doc = generateSupportPlan(student, data, yearName)
      break
    default:
      doc = generateProtocol1(student, team, data, yearName)
  }

  const blob = await Packer.toBlob(doc)
  const fileName = `${docType}_${getFullName(student).replace(/ /g, '_')}_${yearName}.docx`
  saveAs(blob, fileName)
}
