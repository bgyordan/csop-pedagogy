import * as XLSX from 'xlsx'
import { MonthlyAbsence, Student } from '@/types'
import { getFullName, getMonthName } from './utils'

// ── Съществуваща функция за отсъствия ────────────────────────────────
export function generateAbsencesExcel(
  absences: MonthlyAbsence[],
  students: Student[],
  className: string,
  month: number,
  year: number
) {
  const wb = XLSX.utils.book_new()
  const headers = [
    'Ученик', 'Предмет / Терапия', 'Планирани часове',
    'Реализирани часове', 'Разлика', 'Причина', 'Компенсиране',
  ]
  const rows: (string | number)[][] = [headers]
  for (const absence of absences) {
    const entries = absence.entries || []
    for (const entry of entries) {
      const student = students.find(s => s.id === entry.student_id)
      rows.push([
        student ? getFullName(student) : entry.student_id,
        entry.subject,
        entry.planned_hours,
        entry.realized_hours,
        entry.planned_hours - entry.realized_hours,
        entry.reason || '',
        entry.compensation || '',
      ])
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 30 }, { wch: 25 }, { wch: 16 },
    { wch: 16 }, { wch: 10 }, { wch: 30 }, { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, `${getMonthName(month)} ${year}`)
  XLSX.writeFile(wb, `отсъствия_${className}_${getMonthName(month)}_${year}.xlsx`)
}

// ── Справка по училище ────────────────────────────────────────────────
export function generateSchoolReportExcel(
  schoolName: string,
  rows: {
    name: string
    className: string
    psychologist: string
    speechTherapist: string
    rehabilitator: string
    classTeacher: string
    docsCompleted: number
    docsTotal: number
  }[]
) {
  const wb = XLSX.utils.book_new()
  const headers = [
    'Три имена', 'Паралелка', 'Класен ръководител',
    'Психолог', 'Логопед', 'Рехабилитатор',
    'Завършени документи', 'Общо документи'
  ]
  const data: (string | number)[][] = [headers]
  rows.forEach(r => data.push([
    r.name, r.className, r.classTeacher,
    r.psychologist, r.speechTherapist, r.rehabilitator,
    r.docsCompleted, r.docsTotal
  ]))
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [
    { wch: 30 }, { wch: 12 }, { wch: 25 },
    { wch: 22 }, { wch: 22 }, { wch: 22 },
    { wch: 18 }, { wch: 14 }
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Справка')
  XLSX.writeFile(wb, `справка_${schoolName}.xlsx`)
}

// ── Справка по специалист ─────────────────────────────────────────────
export function generateSpecialistReportExcel(
  specialistName: string,
  rows: {
    name: string
    className: string
    p1: string, p2: string, p3: string
    iup: string, iuProgram: string, supportPlan: string, parentProgram: string
  }[]
) {
  const wb = XLSX.utils.book_new()
  const headers = [
    'Три имена', 'Паралелка',
    'Прот.1', 'Прот.2', 'Прот.3',
    'ИУП', 'ИУПрогр.', 'ПДП', 'Прогр.род.'
  ]
  const data: (string | number)[][] = [headers]
  rows.forEach(r => data.push([
    r.name, r.className,
    r.p1, r.p2, r.p3,
    r.iup, r.iuProgram, r.supportPlan, r.parentProgram
  ]))
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [
    { wch: 30 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }
  ]
  XLSX.utils.book_append_sheet(wb, ws, specialistName)
  XLSX.writeFile(wb, `справка_специалист_${specialistName}.xlsx`)
}

// ── Справка натовареност ──────────────────────────────────────────────
export function generateWorkloadReportExcel(
  rows: {
    name: string
    role: string
    studentCount: number
    completedDocs: number
    totalDocs: number
  }[]
) {
  const wb = XLSX.utils.book_new()
  const headers = [
    'Специалист', 'Роля', 'Брой ученици',
    'Завършени документи', 'Общо документи', '% завършени'
  ]
  const data: (string | number)[][] = [headers]
  rows.forEach(r => data.push([
    r.name, r.role, r.studentCount,
    r.completedDocs, r.totalDocs,
    r.totalDocs > 0 ? Math.round(r.completedDocs / r.totalDocs * 100) + '%' : '—'
  ]))
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [
    { wch: 28 }, { wch: 20 }, { wch: 14 },
    { wch: 20 }, { wch: 16 }, { wch: 14 }
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Натовареност')
  XLSX.writeFile(wb, 'справка_натовареност.xlsx')
}

// ── Справка без екип ──────────────────────────────────────────────────
export function generateNoTeamReportExcel(
  rows: {
    name: string
    className: string
    missingPsychologist: boolean
    missingSpeechTherapist: boolean
    missingRehabilitator: boolean
  }[]
) {
  const wb = XLSX.utils.book_new()
  const headers = [
    'Три имена', 'Паралелка',
    'Липсва психолог', 'Липсва логопед', 'Липсва рехабилитатор'
  ]
  const data: (string | number)[][] = [headers]
  rows.forEach(r => data.push([
    r.name, r.className,
    r.missingPsychologist ? 'ДА' : '',
    r.missingSpeechTherapist ? 'ДА' : '',
    r.missingRehabilitator ? 'ДА' : '',
  ]))
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [
    { wch: 30 }, { wch: 12 },
    { wch: 18 }, { wch: 16 }, { wch: 20 }
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Без екип')
  XLSX.writeFile(wb, 'справка_без_екип.xlsx')
}

// ── Мониторинг на забавени документи ─────────────────────────────────
export function generateDelayedDocsExcel(
  rows: {
    docType: string
    studentName: string
    className: string
    specialist: string
    deadlineDate: string
    daysOverdue: number
  }[]
) {
  const wb = XLSX.utils.book_new()
  const headers = [
    'Документ', 'Ученик', 'Паралелка',
    'Отговорен специалист', 'Краен срок', 'Закъснение (дни)'
  ]
  const data: (string | number)[][] = [headers]
  rows.forEach(r => data.push([
    r.docType, r.studentName, r.className,
    r.specialist, r.deadlineDate, r.daysOverdue
  ]))
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [
    { wch: 25 }, { wch: 30 }, { wch: 12 },
    { wch: 25 }, { wch: 14 }, { wch: 18 }
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Забавени документи')
  XLSX.writeFile(wb, 'мониторинг_забавени_документи.xlsx')
}

// ── Обобщена годишна справка ──────────────────────────────────────────
export function generateAnnualReportExcel(
  yearName: string,
  rows: {
    name: string
    className: string
    psychologist: string
    speechTherapist: string
    rehabilitator: string
    p1: string, p2: string, p3: string
    iup: string, iuProgram: string, supportPlan: string, parentProgram: string
  }[]
) {
  const wb = XLSX.utils.book_new()
  const headers = [
    'Три имена', 'Паралелка', 'Психолог', 'Логопед', 'Рехабилитатор',
    'Прот.1', 'Прот.2', 'Прот.3', 'ИУП', 'ИУПрогр.', 'ПДП', 'Прогр.род.'
  ]
  const data: (string | number)[][] = [headers]
  rows.forEach(r => data.push([
    r.name, r.className, r.psychologist, r.speechTherapist, r.rehabilitator,
    r.p1, r.p2, r.p3, r.iup, r.iuProgram, r.supportPlan, r.parentProgram
  ]))
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [
    { wch: 30 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }
  ]
  XLSX.utils.book_append_sheet(wb, ws, yearName)
  XLSX.writeFile(wb, `годишна_справка_${yearName}.xlsx`)
}
// ═══ МОН ОТЧЕТ НП „Без свободен час" — импорт xlsx (лист „Справка") ═══
export function generateMonImport(rows: {
  name: string; docType: string; docNumber: string; docDate: string;
  hoursTaken: number; nonSpecHoursTaken: number; kt: string; amount: number;
}[]) {
  const HEADERS = ['name','docType','docNumber','docDate','hoursTaken','nonSpecHoursTaken',
    'art155_176_2026EUR','art155_2026EUR','art157_2026EUR','art159_2026EUR','art161_2026EUR',
    'art162_2026EUR','art168_2026EUR','art169_2026EUR','art170_2026EUR','insurance_2026EUR']
  // коя колона за кой член
  const KT_COL: Record<string, string> = {
    '155': 'art155_2026EUR', '157': 'art157_2026EUR', '159': 'art159_2026EUR',
    '161': 'art161_2026EUR', '162': 'art162_2026EUR', '168': 'art168_2026EUR',
    '169': 'art169_2026EUR', '170': 'art170_2026EUR', '176': 'art155_176_2026EUR',
  }
  const data = rows.map(r => {
    const o: Record<string, any> = {}
    HEADERS.forEach(h => { o[h] = '' })
    o.name = r.name
    o.docType = r.docType
    o.docNumber = r.docNumber
    o.docDate = r.docDate
    o.hoursTaken = r.hoursTaken
    o.nonSpecHoursTaken = r.nonSpecHoursTaken
    const col = KT_COL[r.kt] || 'art155_2026EUR'
    o[col] = r.amount
    o.insurance_2026EUR = ''
    return o
  })
  const ws = XLSX.utils.json_to_sheet(data, { header: HEADERS })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Справка')
  XLSX.writeFile(wb, `МОН_НП_импорт.xlsx`)
}
