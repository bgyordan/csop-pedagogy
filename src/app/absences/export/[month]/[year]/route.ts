import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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

  const { data: classes } = await supabase
    .from('classes').select('*').eq('academic_year_id', currentYear?.id).order('name')

  const { data: absences } = await supabase
    .from('monthly_absences').select('*, entries:absence_entries(*)').eq('month', parseInt(month)).eq('year', parseInt(year))

  const { data: assignments } = await supabase
    .from('class_teacher_assignments')
    .select('class_id, staff:staff_profiles(first_name, last_name)')
    .eq('academic_year_id', currentYear?.id)

  const teachersByClass = new Map<string, string>()
  assignments?.forEach((a: any) => {
    if (a.staff) teachersByClass.set(a.class_id, getFullName(a.staff))
  })

  const absenceByClass = new Map<string, any>()
  absences?.forEach(a => absenceByClass.set(a.class_id, a))

  // Build Excel rows
  const rows: any[] = []
  
  for (const cls of classes || []) {
    const absence = absenceByClass.get(cls.id)
    const teacher = teachersByClass.get(cls.id) || '—'
    
    if (!absence) {
      rows.push({
        'Паралелка': cls.name,
        'Класен ръководител': teacher,
        'Статус': 'Невъведено',
        'Три имена': '',
        'Планирани часове': '',
        'Реализирани часове': '',
        'Причини': '',
        'Компенсиране': '',
      })
    } else {
      for (const entry of absence.entries || []) {
        const { data: student } = await supabase
          .from('students').select('*').eq('id', entry.student_id).single()
        
        rows.push({
          'Паралелка': cls.name,
          'Класен ръководител': teacher,
          'Статус': 'Въведено',
          'Три имена': student ? getFullName(student) : '—',
          'Планирани часове': entry.planned_hours,
          'Реализирани часове': entry.realized_hours,
          'Причини': entry.reason || '',
          'Компенсиране': entry.compensation || '',
        })
      }
    }
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  
  // Column widths
  ws['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 12 },
    { wch: 30 }, { wch: 16 }, { wch: 18 },
    { wch: 30 }, { wch: 35 },
  ]
  
  XLSX.utils.book_append_sheet(wb, ws, `ИУП ${getMonthName(parseInt(month))}`)
  
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="IUP_${getMonthName(parseInt(month))}_${year}.xlsx"`,
    },
  })
}
