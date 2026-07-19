import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, HeadingLevel, AlignmentType, BorderStyle, ShadingType,
  convertInchesToTwip, PageOrientation, ImageRun,
} from 'docx'
import { saveAs } from 'file-saver'
import { DocumentType, StaffProfile, Student } from '@/types'
import { formatDate, getFullName } from './utils'


// Лого на ЦСОП Варна
const CSOP_LOGO_B64 = "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"

const BORDER_NONE = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}

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

function bold(text: string, size = 22): TextRun {
  return new TextRun({ text, bold: true, size })
}

function normal(text: string, size = 22): TextRun {
  return new TextRun({ text, size })
}

function line(label: string, value = ''): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22 }),
      new TextRun({ text: value || '................................................................', size: 22 }),
    ],
  })
}

function dotLine(label: string): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({ text: `${label}`, bold: true, size: 22 }),
      new TextRun({ text: '  .....................................................', size: 22 }),
    ],
  })
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22 })],
  })
}

function textBlock(text: string, minLines = 3): Paragraph[] {
  const lines = text ? [new Paragraph({ children: [new TextRun({ text, size: 22 })] })] : []
  const dots = Array.from({ length: Math.max(0, minLines - (text ? 1 : 0)) }, () =>
    new Paragraph({ children: [new TextRun({ text: '...........................................................................................................................................', size: 22 })] })
  )
  return [...lines, ...dots]
}

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
        new Paragraph({ spacing: { after: 80 }, children: [normal('1. Екипът запозна родителя с направената функционална оценка на ученика')] }),
        new Paragraph({ spacing: { after: 80 }, children: [normal('2. Разгледаха се вида и формата на обучение на ученика, индивидуалния учебен план и индивидуалните учебни програми')] }),
        new Paragraph({ spacing: { after: 80 }, children: [normal('3. Обсъди се вид, форма и честота на допълнителната подкрепа, предложени в плана за подкрепа')] }),
        new Paragraph({ spacing: { after: 80 }, children: [normal('4. '), normal(data.other_topics || 'Други')] }),
        new Paragraph({ text: '' }),
        sectionTitle('II. Приети решения:'),
        ...textBlock(data.decisions || '', 4),
        new Paragraph({ text: '' }),
        sectionTitle('Екип за подкрепа на личностното развитие:'),
        dotLine(`- ${team?.class_teacher ? getFullName(team.class_teacher) : '................................................'} /председател, ръководител група в ЦСОП/`),
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

function generateProtocol2(student: Student, team: any, data: Record<string, string>, yearName: string): Document {
  const studentName = getFullName(student)
  const sessionDate = data.session_date ? formatDate(data.session_date) : '..................'
  const subjects: { name: string; result: string }[] = data.subjects_json ? JSON.parse(data.subjects_json) : [
    { name: 'Български език и литература', result: '' }, { name: 'Математика', result: '' },
    { name: 'Компютърно моделиране', result: '' }, { name: 'История и цивилизации', result: '' },
    { name: 'География и икономика', result: '' }, { name: 'Човекът и природата', result: '' },
    { name: 'Музика', result: '' }, { name: 'Изобразително изкуство', result: '' },
    { name: 'Технологии и предприемачество', result: '' }, { name: 'Физическо възпитание и спорт', result: '' },
  ]
  return new Document({
    sections: [{
      properties: {},
      children: [
        ...header(yearName),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [bold(`Протокол № ___ / ${sessionDate} г.`, 24)] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: `От проведено заседание на Екип за подкрепа за личностно развитие, за извършване на преглед на напредъка в развитието и резултатите от обучението по индивидуалните учебни програми и постигнатото равнище на компетентност за I учебен срок на ${yearName} учебна година`, size: 20, italics: true })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `на ученика: ${studentName}`, size: 22, bold: true, italics: true })] }),
        new Paragraph({ spacing: { after: 200 }, children: [normal(`Днес ${sessionDate} г., се проведе заседание на Екип за подкрепа на личностното развитие.`)] }),
        sectionTitle('Обсъждани теми:'),
        new Paragraph({ spacing: { after: 80 }, children: [normal('1. Обсъден бе напредъкът в развитието и постигнатите резултати от обучението на ученика')] }),
        new Paragraph({ spacing: { after: 80 }, children: [normal('2. Обсъдени бяха резултатите от предоставената допълнителна подкрепа за личностно развитие')] }),
        new Paragraph({ spacing: { after: 80 }, children: [normal('3. Обсъдена бе необходимостта от промяна в индивидуалните учебни програми')] }),
        new Paragraph({ text: '' }),
        new Paragraph({ spacing: { after: 100 }, children: [bold('Резултати от обучението по индивидуалните учебни програми:')] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: [
              new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [bold('Учебни предмети:')] })] }),
              new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [bold('Постигнато равнище на компетентности:')] })] }),
            ]}),
            ...subjects.map(s => new TableRow({ children: [
              new TableCell({ children: [new Paragraph({ children: [normal(s.name)] })] }),
              new TableCell({ children: [new Paragraph({ children: [normal(s.result)] })] }),
            ]})),
          ],
        }),
        new Paragraph({ text: '' }),
        sectionTitle('Взети решения:'),
        ...textBlock(data.decisions || '', 3),
        new Paragraph({ text: '' }),
        sectionTitle('ЕПЛР:'),
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

function generateProtocol3(student: Student, team: any, data: Record<string, string>, yearName: string): Document {
  const studentName = getFullName(student)
  const sessionDate = data.session_date ? formatDate(data.session_date) : '..................'
  const subjects: { name: string; result: string }[] = data.subjects_json ? JSON.parse(data.subjects_json) : [
    { name: 'Български език и литература', result: 'Среща затруднения' }, { name: 'Математика', result: 'Среща затруднения' },
    { name: 'Компютърно моделиране', result: 'Среща затруднения' }, { name: 'История и цивилизации', result: 'Среща затруднения' },
    { name: 'География и икономика', result: 'Среща затруднения' }, { name: 'Човекът и природата', result: 'Среща затруднения' },
    { name: 'Музика', result: 'Среща затруднения' }, { name: 'Изобразително изкуство', result: 'Среща затруднения' },
    { name: 'Технологии и предприемачество', result: 'Среща затруднения' }, { name: 'Физическо възпитание и спорт', result: 'Среща затруднения' },
  ]
  return new Document({
    sections: [{
      properties: {},
      children: [
        ...header(yearName),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [bold(`Протокол № ___ / ${sessionDate} г.`, 24)] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `От проведено заседание на Екип за подкрепа за личностно развитие, за извършване на цялостен преглед на резултатите от обучението по индивидуалните учебни програми и постигнатото равнище на компетентност на ученика: ${studentName}`, size: 20, italics: true })] }),
        new Paragraph({ spacing: { after: 80 }, children: [bold('Ученикът се оценява с оценки с качествен показател:', 20), new TextRun({ text: ' „постига изискванията", „справя се", „среща затруднения"', size: 20, italics: true })] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: [
              new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [bold('Учебни предмети:')] })] }),
              new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [bold('Постигнато равнище на компетентности:')] })] }),
            ]}),
            ...subjects.map(s => new TableRow({ children: [
              new TableCell({ children: [new Paragraph({ children: [normal(s.name)] })] }),
              new TableCell({ children: [new Paragraph({ children: [normal(s.result)] })] }),
            ]})),
          ],
        }),
        new Paragraph({ text: '' }),
        sectionTitle('ЕПЛР:'),
        dotLine(`- ${team?.class_teacher ? getFullName(team.class_teacher) : '................................................'} /председател, класен ръководител в ЦСОП/`),
        dotLine(`- ${team?.psychologist ? getFullName(team.psychologist) : '................................................'} /психолог/`),
        dotLine(`- ${team?.speech_therapist ? getFullName(team.speech_therapist) : '................................................'} /логопед/`),
        dotLine(`- ${team?.rehabilitator ? getFullName(team.rehabilitator) : '................................................'} /рехабилитатор/`),
        new Paragraph({ text: '' }),
        line('Ime и фамилия на родителя', data.parent_name),
        new Paragraph({ spacing: { after: 80 }, children: [bold('Мнение на родителя:')] }),
        ...textBlock(data.parent_opinion || '', 3),
        new Paragraph({ spacing: { before: 200 }, children: [bold('Подпис: '), normal('................................')] }),
      ],
    }],
  })
}

function generateIUP(student: Student, team: any, data: Record<string, string>, yearName: string): Document {
  const studentName = getFullName(student)
  const subjects = [
    { name: 'Български език и литература', weekly1: '', weekly2: '', annual: '' },
    { name: 'Математика', weekly1: '', weekly2: '', annual: '' },
    { name: 'Компютърно моделиране', weekly1: '', weekly2: '', annual: '' },
    { name: 'История и цивилизации', weekly1: '', weekly2: '', annual: '' },
    { name: 'География и икономика', weekly1: '', weekly2: '', annual: '' },
    { name: 'Човекът и природата', weekly1: '', weekly2: '', annual: '' },
    { name: 'Музика', weekly1: '', weekly2: '', annual: '' },
    { name: 'Изобразително изкуство', weekly1: '', weekly2: '', annual: '' },
    { name: 'Технологии и предприемачество', weekly1: '', weekly2: '', annual: '' },
    { name: 'Физическо възпитание и спорт', weekly1: '', weekly2: '', annual: '' },
  ]
  return new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [bold('УТВЪРДИЛ:')] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [normal('ДИРЕКТОР НА ЦСОП - Варна')] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [normal('...............................')] }),
        new Paragraph({ text: '' }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('ИНДИВИДУАЛЕН УЧЕБЕН ПЛАН', 28)] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [normal(`за обучение на ${studentName}`)] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [normal(`${data.class_name || '___ клас'}`)] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(`Учебна година: ${yearName}`)] }),
        new Paragraph({ text: '' }),
        line('Форма на обучение', data.study_form || 'Дневна'),
        line('Организация на учебния ден', data.day_org || 'Целодневна'),
        new Paragraph({ text: '' }),
        sectionTitle('УЧЕБНИ ПРЕДМЕТИ, СЕДМИЧЕН И ГОДИШЕН БРОЙ НА УЧЕБНИТЕ ЧАСОВЕ'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: [
              new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [bold('№')] })] }),
              new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [bold('Учебни предмети')] })] }),
              new TableCell({ width: { size: 17, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [bold('Седм. ч. I срок')] })] }),
              new TableCell({ width: { size: 17, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [bold('Седм. ч. II срок')] })] }),
              new TableCell({ width: { size: 16, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [bold('Годишно')] })] }),
            ]}),
            ...subjects.map((s, i) => new TableRow({ children: [
              new TableCell({ children: [new Paragraph({ children: [normal(String(i + 1))] })] }),
              new TableCell({ children: [new Paragraph({ children: [normal(s.name)] })] }),
              new TableCell({ children: [new Paragraph({ children: [normal(s.weekly1)] })] }),
              new TableCell({ children: [new Paragraph({ children: [normal(s.weekly2)] })] }),
              new TableCell({ children: [new Paragraph({ children: [normal(s.annual)] })] }),
            ]})),
          ],
        }),
        new Paragraph({ text: '' }),
        sectionTitle('ПОЯСНИТЕЛНИ БЕЛЕЖКИ'),
        line('Място на провеждане', data.location || 'На територията на ЦСОП–Варна'),
        new Paragraph({ text: '' }),
        line('Специфични методи', data.methods || ''),
        new Paragraph({ text: '' }),
        sectionTitle('Форми и методи на проверка и оценка:'),
        new Paragraph({ children: [normal(data.assessment || 'А) текущи изпитвания\nБ) оценяването е с качествени показатели: „Постига изискванията", „Справя се", „Среща затруднения"')] }),
        new Paragraph({ text: '' }),
        new Paragraph({ spacing: { before: 300 }, children: [bold('Класен ръководител: '), normal(team?.class_teacher ? getFullName(team.class_teacher) : '...............................')] }),
        new Paragraph({ spacing: { before: 100 }, children: [bold('Директор на ЦСОП: '), normal('...............................')] }),
      ],
    }],
  })
}

function generateSupportPlan(student: Student, data: Record<string, string>, yearName: string): Document {
  const studentName = getFullName(student)
  return new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [bold('УТВЪРДИЛ:')] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'ДИРЕКТОР:', italics: true, size: 22 })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('ПЛАН', 28)] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('ЗА ДОПЪЛНИТЕЛНА ПОДКРЕПА ЗА ЛИЧНОСТНО РАЗВИТИЕ', 24)] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [normal(`за ${yearName} учебна година`)] }),
        new Paragraph({ text: '' }),
        sectionTitle('I. Основна информация'),
        line('Трите имена на ученика', studentName),
        line('Възраст', data.age || ''),
        line('Група/клас', data.class_name || ''),
        line('Вид на допълнителната подкрепа', data.support_type || 'дългосрочна'),
        line('Форма на обучение', data.study_form || 'дневна'),
        new Paragraph({ text: '' }),
        sectionTitle('II. Когнитивно развитие на детето/ученика:'),
        ...textBlock(data.cognitive_development || '', 4),
        new Paragraph({ text: '' }),
        sectionTitle('III. Емоционално състояние и поведение:'),
        ...textBlock(data.emotional_state || '', 4),
        new Paragraph({ text: '' }),
        sectionTitle('IV. Описание на възможностите за обучение, силните страни и потенциала:'),
        ...textBlock(data.strengths || '', 4),
        new Paragraph({ text: '' }),
        sectionTitle('V. Цели и задачи на допълнителната подкрепа:'),
        ...textBlock(data.goals || '', 5),
        new Paragraph({ text: '' }),
        sectionTitle('VI. Специални методи и средства:'),
        ...textBlock(data.methods || '', 3),
        new Paragraph({ text: '' }),
        new Paragraph({ spacing: { before: 200 }, children: [bold('Учител на паралелка: '), normal('...............................')] }),
        new Paragraph({ spacing: { before: 100 }, children: [bold('Директор на ЦСОП: '), normal('...............................')] }),
      ],
    }],
  })
}

function generateParentProgram(student: Student, team: any, data: Record<string, string>, yearName: string): Document {
  const studentName = getFullName(student)
  return new Document({
    sections: [{
      properties: {},
      children: [
        ...header(yearName),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('ПРОГРАМА ЗА ПОДКРЕПА И ОБУЧЕНИЕ НА СЕМЕЙСТВОТО', 24)] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [bold(`на ${studentName}`)] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [normal(`ученик в ЦСОП – Варна през ${yearName} учебна година`)] }),
        new Paragraph({ text: '' }),
        new Paragraph({ spacing: { after: 120 }, children: [normal(data.intro || 'През учебната година ЦСОП – Варна ще продължи да развива партньорството със семействата чрез целенасочени дейности за подкрепа и обучение на родителите.')] }),
        new Paragraph({ text: '' }),
        line('Цел', data.goal || 'Подобряване качеството на живот на детето и семейството му'),
        new Paragraph({ text: '' }),
        sectionTitle('Програми за обучение и подкрепа на родителите:'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: [
              new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [bold('№')] })] }),
              new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [bold('Теми по месеци')] })] }),
              new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [bold('Форма')] })] }),
              new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [bold('Период')] })] }),
              new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [bold('Специалист')] })] }),
            ]}),
            ...Array.from({ length: 8 }, (_, i) => new TableRow({ children: [
              new TableCell({ children: [new Paragraph({ children: [normal(String(i + 1))] })] }),
              new TableCell({ children: [new Paragraph({ children: [normal('')] })] }),
              new TableCell({ children: [new Paragraph({ children: [normal('')] })] }),
              new TableCell({ children: [new Paragraph({ children: [normal('')] })] }),
              new TableCell({ children: [new Paragraph({ children: [normal('')] })] }),
            ]})),
          ],
        }),
        new Paragraph({ text: '' }),
        sectionTitle('Работа заедно със семействата:'),
        ...textBlock(data.family_work || '', 3),
        new Paragraph({ text: '' }),
        new Paragraph({ spacing: { before: 200 }, children: [bold('Учител на паралелка: '), normal(team?.class_teacher ? getFullName(team.class_teacher) : '...............................')] }),
        new Paragraph({ spacing: { before: 100 }, children: [bold('Координатор ЦСОП: '), normal('...............................')] }),
      ],
    }],
  })
}

// ── ПРОТОКОЛ ОТ ЗАСЕДАНИЕ НА КОМИСИЯ ─────────────────────────────────────────

export async function generateCommitteeProtocol(
  committee: { name: string },
  session: {
    session_date: string
    agenda?: string | null
    protocol?: string | null
    decisions?: string | null
    deadline?: string | null
  },
  members: { staff: { first_name: string; last_name: string; middle_name?: string }; role?: string | null }[],
  sessionNumber: number,
  yearName: string
) {
  const sessionDate = session.session_date ? formatDate(session.session_date) : '..................'
  const coordinator = members[0]
  const otherMembers = members.slice(1)

  const PROTOCOL_BORDER_NONE = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Хедър с лого — както в писмата до училищата
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 20, type: WidthType.PERCENTAGE },
                  borders: PROTOCOL_BORDER_NONE,
                  margins: { top: 0, bottom: 0, left: 0, right: 80 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.LEFT,
                      children: [
                        new ImageRun({
                          data: Buffer.from(CSOP_LOGO_B64, 'base64'),
                          transformation: { width: 60, height: 60 },
                          type: 'jpg',
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 80, type: WidthType.PERCENTAGE },
                  borders: PROTOCOL_BORDER_NONE,
                  verticalAlign: 'center' as any,
                  margins: { top: 0, bottom: 0, left: 80, right: 0 },
                  children: [
                    new Paragraph({
                      spacing: { after: 40 },
                      children: [new TextRun({ text: 'Център за специална образователна подкрепа – гр. Варна', bold: true, size: 22 })],
                    }),
                    new Paragraph({
                      spacing: { after: 0 },
                      children: [new TextRun({ text: 'бул. „Петко Стайнов" №7  |  info-400052@edu.mon.bg  |  тел. 0888 490 771', size: 17, italics: true, color: '555555' })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new Paragraph({
          spacing: { before: 80, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0f2240' } },
          children: [],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: `ПРОТОКОЛ № ${sessionNumber}/ ${sessionDate} г.`, bold: true, size: 26 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `от заседание на ${committee.name} към Център за специална образователна подкрепа – гр. Варна`, size: 22, italics: true })] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `Днес, ${sessionDate} г., в ЦСОП–Варна се проведе заседание на ${committee.name} към ЦСОП–Варна.`, size: 22 })] }),
        ...(coordinator ? [
          new Paragraph({ spacing: { after: 80 }, children: [
            new TextRun({ text: 'Координатор: ', bold: true, size: 22 }),
            new TextRun({ text: `${getFullName(coordinator.staff as any)}${coordinator.role ? ` – ${coordinator.role}` : ''}`, size: 22 }),
          ]}),
        ] : []),
        ...(otherMembers.length > 0 ? [
          new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Членове:', bold: true, size: 22 })] }),
          ...otherMembers.map((m, i) => new Paragraph({
            spacing: { after: 60 },
            indent: { left: 400 },
            children: [
              new TextRun({ text: `${i + 1}. ${getFullName(m.staff as any)}`, size: 22 }),
              ...(m.role ? [new TextRun({ text: ` – ${m.role}`, size: 22 })] : []),
            ],
          })),
        ] : []),
        new Paragraph({ text: '' }),
        new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: 'ДНЕВЕН РЕД:', bold: true, size: 22 })] }),
        ...(session.agenda
          ? session.agenda.split('\n').filter(Boolean).map((l, i) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${i + 1}. ${l}`, size: 22 })] }))
          : [new Paragraph({ children: [new TextRun({ text: '................................................................................', size: 22 })] })]
        ),
        ...(session.protocol ? [
          new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: 'ХОД НА ЗАСЕДАНИЕТО:', bold: true, size: 22 })] }),
          ...session.protocol.split('\n').filter(Boolean).map(l => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: l, size: 22 })] })),
        ] : []),
        new Paragraph({ text: '' }),
        new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: 'РЕШЕНИЯ:', bold: true, size: 22 })] }),
        ...(session.decisions
          ? session.decisions.split('\n').filter(Boolean).map((l, i) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${i + 1}. ${l}`, size: 22 })] }))
          : [new Paragraph({ children: [new TextRun({ text: '................................................................................', size: 22 })] }),
             new Paragraph({ children: [new TextRun({ text: '................................................................................', size: 22 })] })]
        ),
        ...(session.deadline ? [
          new Paragraph({ spacing: { before: 100, after: 200 }, children: [
            new TextRun({ text: 'Срок за изпълнение: ', bold: true, size: 22 }),
            new TextRun({ text: formatDate(session.deadline), size: 22 }),
          ]}),
        ] : [new Paragraph({ text: '' })]),
        new Paragraph({ text: '' }),
        ...(coordinator ? [
          new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: 'Ръководител:', bold: true, size: 22 })] }),
          new Paragraph({ spacing: { after: 200 }, children: [
            new TextRun({ text: 'подпис: ................  /', size: 22 }),
            new TextRun({ text: getFullName(coordinator.staff as any), size: 22 }),
            new TextRun({ text: '/', size: 22 }),
          ]}),
        ] : []),
        ...(otherMembers.length > 0 ? [
          new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: 'Членове:', bold: true, size: 22 })] }),
          ...otherMembers.map(m => new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: 'подпис: ................  /', size: 22 }),
              new TextRun({ text: getFullName(m.staff as any), size: 22 }),
              new TextRun({ text: '/', size: 22 }),
            ],
          })),
        ] : []),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `протокол_${sessionNumber}_${committee.name.replace(/ /g, '_')}_${sessionDate}.docx`)
}


// ── ГРАФИК ЗА ЗАСЕДАНИЯ НА ЕПЛР ──────────────────────────────────────────────

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV']

function toRoman(n: number): string {
  return ROMAN[n] || String(n)
}

// "4 а" -> 4 ; "ПГ" -> null
function classNumber(external: string): number | null {
  if (!external) return null
  const m = external.trim().match(/^(\d+)/)
  return m ? parseInt(m[1]) : null
}

// Списък класове -> "V и IV клас" / "VII, VI и V клас"
function classesLabel(externals: string[]): string {
  const nums = [...new Set(externals.map(classNumber).filter((n): n is number => n !== null))]
    .sort((a, b) => b - a)
  if (nums.length === 0) return ''
  const romans = nums.map(toRoman)
  if (romans.length === 1) return `${romans[0]} клас`
  const last = romans[romans.length - 1]
  const rest = romans.slice(0, -1)
  return `${rest.join(', ')} и ${last} клас`
}

// "01" -> "I паралелка" ; "ПГ 3" -> оставя се както е
function classTitle(className: string, externals: string[]): string {
  const label = classesLabel(externals)
  const num = className.trim().match(/^0*(\d+)$/)
  const base = num ? `${toRoman(parseInt(num[1]))} паралелка` : className
  return label ? `${base} – ${label}` : base
}

export async function generateEplrSchedule(
  scheduleName: string,
  yearName: string,
  data: {
    className: string
    rows: { name: string; externalClass: string; date: string; time: string }[]
  }[],
) {
  const BORDER_CELL = { style: BorderStyle.SINGLE, size: 4, color: '999999' }
  const CELL_BORDERS = { top: BORDER_CELL, bottom: BORDER_CELL, left: BORDER_CELL, right: BORDER_CELL }
  const BORDER_NONE_CELL = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  }

  const fmtDate = (d: string) => {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return `${day}.${m}.${y}`
  }

  const children: any[] = []

  // Хедър с лого — както в писмата
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: BORDER_NONE_CELL,
              margins: { top: 0, bottom: 0, left: 0, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [
                    new ImageRun({
                      data: Buffer.from(CSOP_LOGO_B64, 'base64'),
                      transformation: { width: 60, height: 60 },
                      type: 'jpg',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 80, type: WidthType.PERCENTAGE },
              borders: BORDER_NONE_CELL,
              verticalAlign: 'center' as any,
              margins: { top: 0, bottom: 0, left: 80, right: 0 },
              children: [
                new Paragraph({
                  spacing: { after: 40 },
                  children: [new TextRun({ text: 'Център за специална образователна подкрепа – гр. Варна', bold: true, size: 22 })],
                }),
                new Paragraph({
                  spacing: { after: 0 },
                  children: [new TextRun({ text: 'ул. „Петко Стайнов" №7  |  info-400052@edu.mon.bg  |  тел. 052 619 456, 0888 490 771', size: 17, italics: true, color: '555555' })],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 80, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0f2240' } },
      children: [],
    }),
    new Paragraph({ text: '' }),

    // Утвърдил
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 20 },
      children: [new TextRun({ text: 'Утвърдил: ........................', size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 280 },
      children: [new TextRun({ text: 'Директор ЦСОП-Варна', size: 20 })],
    }),

    // Заглавие
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: 'ГРАФИК', bold: true, size: 30 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({
        text: `за провеждане на заседания на ЕПЛР, в изпълнение на чл. 128, ал. 5 и чл. 159, ал. 1 от Наредба за приобщаващото образование от 20.10.2017 г. за децата/учениците, обучаващи се в ЦСОП-Варна през ${yearName} учебна година`,
        size: 20,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [new TextRun({ text: scheduleName, size: 20, italics: true, color: '555555' })],
    }),
  )

  // Таблица за всяка паралелка
  data.forEach(cls => {
    const dates = [...new Set(cls.rows.map(r => r.date).filter(Boolean))]
    const singleDate = dates.length === 1
    const title = classTitle(cls.className, cls.rows.map(r => r.externalClass))

    const tableRows: TableRow[] = []

    // Заглавен ред
    tableRows.push(new TableRow({
      cantSplit: true,
      children: [new TableCell({
        columnSpan: 4,
        borders: CELL_BORDERS,
        shading: { type: ShadingType.CLEAR, fill: 'E8EEF5' },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({
          keepNext: true,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: title, bold: true, size: 20 })],
        })],
      })],
    }))

    // Хедър колони
    tableRows.push(new TableRow({
      cantSplit: true,
      children: [
        { t: ['№'], w: 8 },
        { t: ['Име, презиме, фамилия'], w: 52 },
        { t: ['Клас'], w: 14 },
        { t: singleDate ? ['Дата', fmtDate(dates[0])] : ['Дата / час'], w: 26 },
      ].map(c => new TableCell({
        width: { size: c.w, type: WidthType.PERCENTAGE },
        borders: CELL_BORDERS,
        shading: { type: ShadingType.CLEAR, fill: 'F5F7FA' },
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: c.t.map(line => new Paragraph({
          keepNext: true,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: line, bold: true, size: 18 })],
        })),
      })),
    }))

    // Редове
    cls.rows.forEach((row, i) => {
      const num = classNumber(row.externalClass)
      const timeCell = singleDate ? row.time : `${fmtDate(row.date)} ${row.time}`.trim()
      const notLastRow = i < cls.rows.length - 1

      tableRows.push(new TableRow({
        cantSplit: true,
        children: [
          { t: String(i + 1), align: AlignmentType.CENTER },
          { t: row.name, align: AlignmentType.LEFT },
          { t: num !== null ? toRoman(num) : (row.externalClass || ''), align: AlignmentType.CENTER },
          { t: timeCell, align: AlignmentType.CENTER },
        ].map(c => new TableCell({
          borders: CELL_BORDERS,
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          children: [new Paragraph({
            keepNext: notLastRow,
            alignment: c.align,
            children: [new TextRun({ text: c.t, size: 18 })],
          })],
        })),
      }))
    })

    children.push(
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }),
      new Paragraph({ text: '', spacing: { after: 200 } }),
    )
  })

  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `график_ЕПЛР_${scheduleName.replace(/[^а-яА-Яa-zA-Z0-9]/g, '_')}.docx`)
}


// ── ГРАФИК ПО СПЕЦИАЛИСТИ ────────────────────────────────────────────────────

export async function generateScheduleBySpecialist(
  scheduleName: string,
  yearName: string,
  data: {
    specialistName: string
    role: string
    rows: { date: string; time: string; student: string; studentClass: string; className: string; colleagues: string }[]
  }[],
) {
  const B = { style: BorderStyle.SINGLE, size: 4, color: '999999' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const NONE = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  }
  const fmt = (d: string) => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd}.${m}.${y}` }

  const children: any[] = []

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: [
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE }, borders: NONE,
          margins: { top: 0, bottom: 0, left: 0, right: 80 },
          children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [
            new ImageRun({ data: Buffer.from(CSOP_LOGO_B64, 'base64'), transformation: { width: 60, height: 60 }, type: 'jpg' }),
          ]})],
        }),
        new TableCell({
          width: { size: 80, type: WidthType.PERCENTAGE }, borders: NONE,
          verticalAlign: 'center' as any, margins: { top: 0, bottom: 0, left: 80, right: 0 },
          children: [
            new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Център за специална образователна подкрепа – гр. Варна', bold: true, size: 22 })] }),
            new Paragraph({ children: [new TextRun({ text: 'ул. „Петко Стайнов" №7  |  info-400052@edu.mon.bg  |  тел. 052 619 456', size: 17, italics: true, color: '555555' })] }),
          ],
        }),
      ]})],
    }),
    new Paragraph({ spacing: { before: 80, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0f2240' } }, children: [] }),
    new Paragraph({ text: '' }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
      children: [new TextRun({ text: 'ГРАФИК ПО СПЕЦИАЛИСТИ', bold: true, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
      children: [new TextRun({ text: `Заседания на ЕПЛР · ${scheduleName} · ${yearName}`, size: 20, italics: true, color: '555555' })] }),
  )

  data.forEach(sp => {
    const rows: TableRow[] = []

    rows.push(new TableRow({ children: [new TableCell({
      columnSpan: 6, borders: CELLS,
      shading: { type: ShadingType.CLEAR, fill: 'E8EEF5' },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [
        new TextRun({ text: sp.specialistName, bold: true, size: 20 }),
        new TextRun({ text: `  —  ${sp.role}  ·  ${sp.rows.length} заседания`, size: 17, color: '555555' }),
      ]})],
    })]}))

    rows.push(new TableRow({ children: [
      { t: 'Дата', w: 15 }, { t: 'Час', w: 9 }, { t: 'Ученик', w: 30 },
      { t: 'Клас', w: 9 }, { t: 'Паралелка', w: 15 }, { t: 'Колеги в екипа', w: 22 },
    ].map(c => new TableCell({
      width: { size: c.w, type: WidthType.PERCENTAGE }, borders: CELLS,
      shading: { type: ShadingType.CLEAR, fill: 'F5F7FA' },
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.t, bold: true, size: 17 })] })],
    }))}))

    sp.rows.forEach(r => {
      rows.push(new TableRow({ children: [
        { t: fmt(r.date), a: AlignmentType.CENTER },
        { t: r.time, a: AlignmentType.CENTER },
        { t: r.student, a: AlignmentType.LEFT },
        { t: r.studentClass, a: AlignmentType.CENTER },
        { t: r.className, a: AlignmentType.CENTER },
        { t: r.colleagues, a: AlignmentType.LEFT },
      ].map(c => new TableCell({
        borders: CELLS, margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [new Paragraph({ alignment: c.a, children: [new TextRun({ text: c.t, size: 17 })] })],
      }))}))
    })

    children.push(
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
      new Paragraph({ text: '', spacing: { after: 200 } }),
    )
  })

  const doc = new Document({ sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } }, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `график_по_специалисти_${scheduleName.replace(/[^а-яА-Яa-zA-Z0-9]/g, '_')}.docx`)
}

// ── ГРАФИК ПО ДНИ ────────────────────────────────────────────────────────────

export async function generateScheduleByDay(
  scheduleName: string,
  yearName: string,
  data: {
    date: string
    weekday: string
    rows: { time: string; student: string; studentClass: string; className: string; classTeacher: string; psy: string; log: string; reh: string; conflict: boolean }[]
  }[],
) {
  const B = { style: BorderStyle.SINGLE, size: 4, color: '999999' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const NONE = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  }
  const fmt = (d: string) => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd}.${m}.${y}` }

  const children: any[] = []

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: [
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE }, borders: NONE,
          margins: { top: 0, bottom: 0, left: 0, right: 80 },
          children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [
            new ImageRun({ data: Buffer.from(CSOP_LOGO_B64, 'base64'), transformation: { width: 60, height: 60 }, type: 'jpg' }),
          ]})],
        }),
        new TableCell({
          width: { size: 80, type: WidthType.PERCENTAGE }, borders: NONE,
          verticalAlign: 'center' as any, margins: { top: 0, bottom: 0, left: 80, right: 0 },
          children: [
            new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Център за специална образователна подкрепа – гр. Варна', bold: true, size: 22 })] }),
            new Paragraph({ children: [new TextRun({ text: 'ул. „Петко Стайнов" №7  |  info-400052@edu.mon.bg  |  тел. 052 619 456', size: 17, italics: true, color: '555555' })] }),
          ],
        }),
      ]})],
    }),
    new Paragraph({ spacing: { before: 80, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0f2240' } }, children: [] }),
    new Paragraph({ text: '' }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
      children: [new TextRun({ text: 'ГРАФИК ПО ДНИ', bold: true, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
      children: [new TextRun({ text: `Заседания на ЕПЛР · ${scheduleName} · ${yearName}`, size: 20, italics: true, color: '555555' })] }),
  )

  data.forEach(day => {
    const rows: TableRow[] = []

    rows.push(new TableRow({ children: [new TableCell({
      columnSpan: 8, borders: CELLS,
      shading: { type: ShadingType.CLEAR, fill: 'E8EEF5' },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [
        new TextRun({ text: fmt(day.date), bold: true, size: 20 }),
        new TextRun({ text: `  ${day.weekday}  ·  ${day.rows.length} заседания`, size: 17, color: '555555' }),
      ]})],
    })]}))

    rows.push(new TableRow({ children: [
      { t: 'Час', w: 8 }, { t: 'Ученик', w: 24 }, { t: 'Клас', w: 7 }, { t: 'Паралелка', w: 12 },
      { t: 'Класен', w: 13 }, { t: 'Психолог', w: 12 }, { t: 'Логопед', w: 12 }, { t: 'Рехабил.', w: 12 },
    ].map(c => new TableCell({
      width: { size: c.w, type: WidthType.PERCENTAGE }, borders: CELLS,
      shading: { type: ShadingType.CLEAR, fill: 'F5F7FA' },
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.t, bold: true, size: 16 })] })],
    }))}))

    day.rows.forEach(r => {
      rows.push(new TableRow({ children: [
        { t: r.time, a: AlignmentType.CENTER },
        { t: r.student, a: AlignmentType.LEFT },
        { t: r.studentClass, a: AlignmentType.CENTER },
        { t: r.className, a: AlignmentType.CENTER },
        { t: r.classTeacher, a: AlignmentType.LEFT },
        { t: r.psy, a: AlignmentType.LEFT },
        { t: r.log, a: AlignmentType.LEFT },
        { t: r.reh, a: AlignmentType.LEFT },
      ].map(c => new TableCell({
        borders: CELLS, margins: { top: 40, bottom: 40, left: 60, right: 60 },
        ...(r.conflict ? { shading: { type: ShadingType.CLEAR, fill: 'FDECEC' } } : {}),
        children: [new Paragraph({ alignment: c.a, children: [new TextRun({ text: c.t, size: 16 })] })],
      }))}))
    })

    children.push(
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
      new Paragraph({ text: '', spacing: { after: 200 } }),
    )
  })

  const doc = new Document({ sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } }, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `график_по_дни_${scheduleName.replace(/[^а-яА-Яa-zA-Z0-9]/g, '_')}.docx`)
}


// ── ПИСМО ДО РУО: организиране на паралелки ─────────────────────────────────

export async function generateRuoClassesLetter(
  yearName: string,
  classes: {
    className: string
    students: { name: string; school: string; externalClass: string }[]
  }[],
  opts?: { addressee?: string; position?: string; institution?: string; directorName?: string },
) {
  const B = { style: BorderStyle.SINGLE, size: 4, color: '999999' }
  const CELLS = { top: B, bottom: B, left: B, right: B }
  const NONE = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  }

  const addressee = opts?.addressee || 'ДО Г-ЖА РАДЕВА'
  const position = opts?.position || 'НАЧАЛНИК НА'
  const institution = opts?.institution || 'РУО ВАРНА'
  const directorName = opts?.directorName || 'Светлана Иванова'

  const BASIS = 'Във връзка с чл. 53, Приложение №7, раздел IV, т. 3 от Наредбата за финансиране на институциите в системата на предучилищното и училищно образование от 05.09.2017 г., предлагам да се сформира следната паралелка:'

  const children: any[] = []

  // Хедър с лого
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: [
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE }, borders: NONE,
          margins: { top: 0, bottom: 0, left: 0, right: 80 },
          children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [
            new ImageRun({ data: Buffer.from(CSOP_LOGO_B64, 'base64'), transformation: { width: 60, height: 60 }, type: 'jpg' }),
          ]})],
        }),
        new TableCell({
          width: { size: 80, type: WidthType.PERCENTAGE }, borders: NONE,
          verticalAlign: 'center' as any, margins: { top: 0, bottom: 0, left: 80, right: 0 },
          children: [
            new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Център за специална образователна подкрепа – гр. Варна', bold: true, size: 22 })] }),
            new Paragraph({ children: [new TextRun({ text: 'ул. „Петко Стайнов" №7  |  info-400052@edu.mon.bg  |  тел. 052 619 456, 0888 490 771', size: 17, italics: true, color: '555555' })] }),
          ],
        }),
      ]})],
    }),
    new Paragraph({ spacing: { before: 80, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0f2240' } }, children: [] }),
    new Paragraph({ text: '' }),

    // До кого
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 20 }, children: [new TextRun({ text: addressee, bold: true, size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 20 }, children: [new TextRun({ text: position, bold: true, size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 320 }, children: [new TextRun({ text: institution, bold: true, size: 22 })] }),

    // Относно
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED, spacing: { after: 280 },
      children: [
        new TextRun({ text: 'Относно: ', bold: true, size: 22 }),
        new TextRun({ text: `Организиране на групи на деца и ученици със специални образователни потребности от училищата от гр. Варна в ЦСОП–Варна за учебната ${yearName} г.`, size: 22 }),
      ],
    }),

    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `УВАЖАЕМА ГОСПОЖО ${addressee.replace(/^ДО\s+Г-ЖА\s+/i, '').toUpperCase()},`, bold: true, size: 22 })] }),

    new Paragraph({
      alignment: AlignmentType.JUSTIFIED, spacing: { after: 240 },
      children: [new TextRun({ text: `Съгласно и при спазването на условията на чл. 195, ал. 2, ал. 3, ал. 5 от ЗПУО децата и учениците в ЦСОП-Варна за учебната ${yearName} са както следва:`, size: 22 })],
    }),
  )

  // Всяка паралелка: основание + номер + таблица
  classes.forEach((cls, idx) => {
    const title = classTitle(cls.className, cls.students.map(s => s.externalClass))

    children.push(
      new Paragraph({
        keepNext: true,
        alignment: AlignmentType.JUSTIFIED, spacing: { before: 160, after: 100 },
        children: [new TextRun({ text: BASIS, size: 21 })],
      }),
      new Paragraph({ keepNext: true, spacing: { after: 80 }, children: [new TextRun({ text: `${idx + 1}.`, bold: true, size: 22 })] }),
    )

    const rows: TableRow[] = []

    rows.push(new TableRow({ cantSplit: true, children: [new TableCell({
      columnSpan: 4, borders: CELLS,
      shading: { type: ShadingType.CLEAR, fill: 'E8EEF5' },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ keepNext: true, alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, bold: true, size: 20 })] })],
    })]}))

    rows.push(new TableRow({ cantSplit: true, children: [
      { t: '№', w: 7 }, { t: 'Име, презиме, фамилия', w: 40 }, { t: 'Училище', w: 43 }, { t: 'Клас', w: 10 },
    ].map(c => new TableCell({
      width: { size: c.w, type: WidthType.PERCENTAGE }, borders: CELLS,
      shading: { type: ShadingType.CLEAR, fill: 'F5F7FA' },
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new Paragraph({ keepNext: true, alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.t, bold: true, size: 18 })] })],
    }))}))

    cls.students.forEach((st, i) => {
      const num = classNumber(st.externalClass)
      const notLast = i < cls.students.length - 1
      rows.push(new TableRow({ cantSplit: true, children: [
        { t: String(i + 1), a: AlignmentType.CENTER },
        { t: st.name, a: AlignmentType.LEFT },
        { t: st.school || '—', a: AlignmentType.LEFT },
        { t: num !== null ? toRoman(num) : (st.externalClass || ''), a: AlignmentType.CENTER },
      ].map(c => new TableCell({
        borders: CELLS, margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [new Paragraph({ keepNext: notLast, alignment: c.a, children: [new TextRun({ text: c.t, size: 18 })] })],
      }))}))
    })

    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
  })

  // Подпис
  children.push(
    new Paragraph({ text: '', spacing: { after: 400 } }),
    new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: directorName, bold: true, size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: 'Директор ЦСОП-Варна', size: 20 })] }),
  )

  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `паралелки_РУО_${yearName.replace(/[^0-9]/g, '_')}.docx`)
}

// ── ЗАПОВЕД ЗА СФОРМИРАНЕ НА ЦОУД ГРУПИ ─────────────────────────────────────

const NUM_WORDS = ['', 'една', 'две', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет', 'десет', 'единадесет', 'дванадесет']

export async function generateCoudOrder(
  orderNumber: string,
  orderDate: string,
  yearName: string,
  groups: { name: string; teacher: string; students: string[] }[],
  directorName?: string,
) {
  const NONE = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  }

  const count = groups.length
  const countWord = NUM_WORDS[count] || String(count)

  const children: any[] = []

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: [
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE }, borders: NONE,
          margins: { top: 0, bottom: 0, left: 0, right: 80 },
          children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [
            new ImageRun({ data: Buffer.from(CSOP_LOGO_B64, 'base64'), transformation: { width: 60, height: 60 }, type: 'jpg' }),
          ]})],
        }),
        new TableCell({
          width: { size: 80, type: WidthType.PERCENTAGE }, borders: NONE,
          verticalAlign: 'center' as any, margins: { top: 0, bottom: 0, left: 80, right: 0 },
          children: [
            new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Център за специална образователна подкрепа – гр. Варна', bold: true, size: 22 })] }),
            new Paragraph({ children: [new TextRun({ text: 'ул. „Петко Стайнов" №7  |  info-400052@edu.mon.bg  |  тел. 052 619 456, 0878 521 823', size: 17, italics: true, color: '555555' })] }),
          ],
        }),
      ]})],
    }),
    new Paragraph({ spacing: { before: 80, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0f2240' } }, children: [] }),
    new Paragraph({ text: '' }),

    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'ЗАПОВЕД', bold: true, size: 30 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 280 }, children: [new TextRun({ text: `№ ${orderNumber} / ${orderDate} г.`, bold: true, size: 22 })] }),

    new Paragraph({
      alignment: AlignmentType.JUSTIFIED, spacing: { after: 240 },
      children: [new TextRun({
        text: 'На основание чл. 259, ал. 1 от ЗПУО и чл. 17, ал. 3 от Наредба №10 от 2016 г. за организация на дейностите в училищното образование, чл. 191а, ал. 1 и ал. 2 от Наредба за приобщаващото образование',
        size: 22,
      })],
    }),

    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'ОПРЕДЕЛЯМ:', bold: true, size: 24 })] }),

    new Paragraph({
      alignment: AlignmentType.JUSTIFIED, spacing: { after: 240 },
      children: [new TextRun({ text: `Да бъдат сформирани ${countWord} групи ЦОУД за учебна ${yearName} година със следния списъчен състав:`, size: 22 })],
    }),
  )

  groups.forEach(g => {
    children.push(
      new Paragraph({ spacing: { before: 160, after: 80 }, children: [new TextRun({ text: g.name, bold: true, size: 22 })] }),
      ...g.students.map((s, i) => new Paragraph({
        spacing: { after: 40 }, indent: { left: 300 },
        children: [new TextRun({ text: `${i + 1}. ${s}`, size: 21 })],
      })),
      new Paragraph({
        spacing: { before: 100, after: 60 },
        children: [new TextRun({ text: `Учител ${g.name} – ${g.teacher || '—'}`, size: 21, italics: true })],
      }),
    )
  })

  children.push(
    new Paragraph({ text: '', spacing: { after: 400 } }),
    new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: 'Директор на ЦСОП-Варна', size: 20 })] }),
    new Paragraph({ children: [new TextRun({ text: directorName || 'Светлана Иванова', bold: true, size: 22 })] }),
  )

  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `заповед_ЦОУД_${orderNumber.replace(/[^0-9]/g, '')}.docx`)
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export async function generateAndDownloadDocument(
  docType: DocumentType,
  student: Student,
  team: { psychologist?: StaffProfile; speech_therapist?: StaffProfile; rehabilitator?: StaffProfile; class_teacher?: StaffProfile },
  data: Record<string, string>,
  yearName: string
) {
  let doc: Document
  switch (docType) {
    case 'protocol_1': doc = generateProtocol1(student, team, data, yearName); break
    case 'protocol_2': doc = generateProtocol2(student, team, data, yearName); break
    case 'protocol_3': doc = generateProtocol3(student, team, data, yearName); break
    case 'iup': doc = generateIUP(student, team, data, yearName); break
    case 'support_plan': doc = generateSupportPlan(student, data, yearName); break
    case 'parent_program': doc = generateParentProgram(student, team, data, yearName); break
    default: doc = generateProtocol1(student, team, data, yearName)
  }
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${docType}_${getFullName(student).replace(/ /g, '_')}_${yearName}.docx`)
}

// ── ПИСМО ДО УЧИЛИЩЕ ─────────────────────────────────────────────────────────

export async function generateSchoolLetter(
  schoolName: string,
  schoolCity: string,
  rows: {
    name: string
    className: string
    externalClass?: string
    psychologist: string
    speechTherapist: string
    rehabilitator: string
    classTeacher: string
  }[],
  yearName: string
) {
  const BORDER_LIGHT = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }
  const BORDER_TOP = { style: BorderStyle.SINGLE, size: 8, color: '0f2240' }

  const children: any[] = []

  // Хедър — лого вдясно, текст вляво в един ред
  const logoBuffer = Buffer.from(CSOP_LOGO_B64, 'base64')
  const BORDER_NONE_CELL = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  }
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: BORDER_NONE_CELL,
              margins: { top: 0, bottom: 0, left: 0, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [
                    new ImageRun({
                      data: logoBuffer,
                      transformation: { width: 60, height: 60 },
                      type: 'jpg',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 80, type: WidthType.PERCENTAGE },
              borders: BORDER_NONE_CELL,
              verticalAlign: 'center' as any,
              margins: { top: 0, bottom: 0, left: 80, right: 0 },
              children: [
                new Paragraph({
                  spacing: { after: 40 },
                  children: [new TextRun({ text: 'Център за специална образователна подкрепа – гр. Варна', bold: true, size: 22 })],
                }),
                new Paragraph({
                  spacing: { after: 0 },
                  children: [new TextRun({ text: 'бул. „Петко Стайнов" №7  |  info-400052@edu.mon.bg  |  тел. 0888 490 771', size: 17, italics: true, color: '555555' })],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 80, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0f2240' } },
      children: [],
    }),
    new Paragraph({ text: '' }),
  )

  // До директора
  children.push(
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 40 }, children: [new TextRun({ text: 'До директора на', size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 40 }, children: [new TextRun({ text: schoolName, bold: true, size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 200 }, children: [new TextRun({ text: schoolCity, size: 22 })] }),
    new Paragraph({ text: '' }),
  )

  // Уводен текст
  children.push(
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Здравейте,', size: 22 })] }),
    new Paragraph({ text: '' }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({
        text: 'С цел по-добра координация, намаляване на административната тежест и оптимизиране на резултатите, както и въз основа на чл. 128 ал. 4 от Наредба за приобщаващо образование, отправяме предложение за включване на специалисти от ЦСОП – Варна в заповедите за ЕПЛР на децата и учениците записани във Вашето училище и обучаващи се в ЦСОП – Варна. Молим при готовност, да ни предоставите сканирано копие на заповедта за съответното дете/ученик.',
        size: 22,
      })],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: `${schoolName} — ${schoolCity}`, bold: true, size: 24 })] }),
  )

  // Всяко дете в таблица-рамка
  rows.forEach((row, idx) => {
    const teamRows: TableRow[] = []

    // Ред заглавие
    teamRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            shading: { fill: 'EEF2F7', type: ShadingType.CLEAR },
            borders: { top: BORDER_TOP, bottom: BORDER_LIGHT, left: BORDER_LIGHT, right: BORDER_LIGHT },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({
              children: [
                new TextRun({ text: `${idx + 1}.  ${row.name}`, bold: true, size: 22 }),
                new TextRun({ text: `   |   Паралелка ЦСОП: ${row.className}`, size: 20, color: '555555' }),
                ...(row.externalClass ? [new TextRun({ text: `   |   Клас: ${row.externalClass}`, size: 20, color: '555555' })] : []),
              ],
            })],
          }),
        ],
      })
    )

    // Редове за екип
    const members: { role: string; name: string }[] = []
    if (row.classTeacher && row.classTeacher !== '—') members.push({ role: 'Председател/ръководител група', name: row.classTeacher })
    if (row.psychologist && row.psychologist !== '—') members.push({ role: 'Психолог', name: row.psychologist })
    if (row.speechTherapist && row.speechTherapist !== '—') members.push({ role: 'Логопед', name: row.speechTherapist })
    if (row.rehabilitator && row.rehabilitator !== '—') members.push({ role: 'Рехабилитатор', name: row.rehabilitator })

    members.forEach((m, mi) => {
      const isLast = mi === members.length - 1
      teamRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                bottom: isLast ? BORDER_LIGHT : { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                left: BORDER_LIGHT,
                right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              },
              margins: { top: 60, bottom: 60, left: 200, right: 80 },
              children: [new Paragraph({ children: [new TextRun({ text: m.role, size: 20, color: '666666' })] })],
            }),
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                bottom: isLast ? BORDER_LIGHT : { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                right: BORDER_LIGHT,
              },
              margins: { top: 60, bottom: 60, left: 80, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: m.name, bold: true, size: 20 })] })],
            }),
          ],
        })
      )
    })

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: teamRows,
      }),
      new Paragraph({ text: '' }),
    )
  })

  // Подпис
  children.push(
    new Paragraph({ text: '' }),
    new Paragraph({ spacing: { before: 200, after: 40 }, children: [new TextRun({ text: 'С уважение,', size: 22 })] }),
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Директор на ЦСОП – Варна:', size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: '..............................', size: 22 })] }),
  )

  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)
  const safeName = `${schoolName} ${schoolCity}`.replace(/["„"\/\\:*?<>|]/g, '').replace(/\s+/g, '_')
  saveAs(blob, `Писмо_${safeName}_${yearName}.docx`)
}
