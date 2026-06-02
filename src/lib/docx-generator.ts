import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, HeadingLevel, AlignmentType, BorderStyle, ShadingType,
  convertInchesToTwip, PageOrientation,
} from 'docx'
import { saveAs } from 'file-saver'
import { DocumentType, StaffProfile, Student } from '@/types'
import { formatDate, getFullName } from './utils'

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

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Център за специална образователна подкрепа – гр. Варна', bold: true, size: 24 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'бул. „Петко Стайнов" №7, e-mail: info-400052@edu.mon.bg, тел. 0888 490 771', size: 18, italics: true })] }),
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
    psychologist: string
    speechTherapist: string
    rehabilitator: string
    classTeacher: string
  }[],
  yearName: string
) {
  const children: any[] = []

  // Хедър
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Център за специална образователна подкрепа – гр. Варна', bold: true, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'бул. „Петко Стайнов" №7, e-mail: info-400052@edu.mon.bg, тел. 0888 490 771', size: 18, italics: true })] }),
    new Paragraph({ text: '' }),
  )

  // До директора
  children.push(
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 40 }, children: [new TextRun({ text: `До директора на`, size: 22 })] }),
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
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `${schoolName} ${schoolCity}`, bold: true, size: 22 })] }),
    new Paragraph({ text: '' }),
  )

  // Списък с деца
  rows.forEach((row, idx) => {
    // Заглавие на дете
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 60 },
        children: [
          new TextRun({ text: `${idx + 1}. ${row.name}`, bold: true, size: 22 }),
          new TextRun({ text: ` – паралелка ${row.className}`, size: 22 }),
        ],
      }),
      new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Екип:', size: 22, bold: true })] }),
    )

    // Членове на екипа
    if (row.classTeacher && row.classTeacher !== '—') {
      children.push(new Paragraph({ indent: { left: 400 }, spacing: { after: 40 }, children: [new TextRun({ text: `• ${row.classTeacher} – председател/ръководител група`, size: 22 })] }))
    }
    if (row.psychologist && row.psychologist !== '—') {
      children.push(new Paragraph({ indent: { left: 400 }, spacing: { after: 40 }, children: [new TextRun({ text: `• ${row.psychologist} – психолог`, size: 22 })] }))
    }
    if (row.speechTherapist && row.speechTherapist !== '—') {
      children.push(new Paragraph({ indent: { left: 400 }, spacing: { after: 40 }, children: [new TextRun({ text: `• ${row.speechTherapist} – логопед`, size: 22 })] }))
    }
    if (row.rehabilitator && row.rehabilitator !== '—') {
      children.push(new Paragraph({ indent: { left: 400 }, spacing: { after: 40 }, children: [new TextRun({ text: `• ${row.rehabilitator} – рехабилитатор`, size: 22 })] }))
    }
  })

  // Подпис
  children.push(
    new Paragraph({ text: '' }),
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
