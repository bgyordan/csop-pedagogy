export const runtime = 'nodejs'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getFullName, getMonthName } from '@/lib/utils'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ month: string; year: string }> }
) {
  const { month, year } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  const [{ data: classes }, { data: absences }, { data: assignments }, { data: allStudents }] = await Promise.all([
    supabase.from('classes').select('*').eq('academic_year_id', currentYear?.id).order('name'),
    supabase.from('monthly_absences').select('*, entries:absence_entries(*)').eq('month', parseInt(month)).eq('year', parseInt(year)),
    supabase.from('class_teacher_assignments').select('class_id, staff:staff_profiles(first_name, last_name)').eq('academic_year_id', currentYear?.id),
    supabase.from('students').select('*'),
  ])

  const teachersByClass = new Map<string, string>()
  assignments?.forEach((a: any) => {
    if (a.staff) {
      const existing = teachersByClass.get(a.class_id)
      const name = getFullName(a.staff)
      teachersByClass.set(a.class_id, existing ? `${existing}, ${name}` : name)
    }
  })

  const studentsMap = new Map<string, any>()
  allStudents?.forEach(s => studentsMap.set(s.id, s))

  const absenceByClass = new Map<string, any>()
  absences?.forEach(a => absenceByClass.set(a.class_id, a))

  const rows: any[] = []
  for (const cls of classes || []) {
    const absence = absenceByClass.get(cls.id)
    const teacher = teachersByClass.get(cls.id) || '—'
    if (absence?.entries?.length) {
      for (const entry of absence.entries) {
        const student = studentsMap.get(entry.student_id)
        rows.push({
          'Паралелка/Група в ЦСОП-Варна': cls.name,
          'Класен ръководител': teacher,
          'Три имена': student ? getFullName(student) : '—',
          'Планирани учебни часове': entry.planned_hours,
          'Реализирани учебни часове': entry.realized_hours,
          'Причини за нереализираните часове': entry.reason || '',
          'Компенсиране на нереализираните часове': entry.compensation || '',
        })
      }
    }
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 24 }, { wch: 25 }, { wch: 30 },
    { wch: 20 }, { wch: 22 }, { wch: 35 }, { wch: 38 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, `ИУП ${getMonthName(parseInt(month))}`)
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const buffer = Buffer.from(buf)
  const fileName = `IUP_${getMonthName(parseInt(month))}_${year}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}
