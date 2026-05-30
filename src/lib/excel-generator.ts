import * as XLSX from 'xlsx'
import { MonthlyAbsence, AbsenceEntry, Student } from '@/types'
import { getFullName, getMonthName } from './utils'

export function generateAbsencesExcel(
  absences: MonthlyAbsence[],
  students: Student[],
  className: string,
  month: number,
  year: number
) {
  const wb = XLSX.utils.book_new()

  const headers = [
    'Ученик',
    'Предмет / Терапия',
    'Планирани часове',
    'Реализирани часове',
    'Разлика',
    'Причина',
    'Компенсиране',
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

  // Column widths
  ws['!cols'] = [
    { wch: 30 },
    { wch: 25 },
    { wch: 16 },
    { wch: 16 },
    { wch: 10 },
    { wch: 30 },
    { wch: 30 },
  ]

  XLSX.utils.book_append_sheet(
    wb,
    ws,
    `${getMonthName(month)} ${year}`
  )

  const fileName = `отсъствия_${className}_${getMonthName(month)}_${year}.xlsx`
  XLSX.writeFile(wb, fileName)
}
