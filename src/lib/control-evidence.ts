// Справка от системата за констативния протокол: какво показват данните за проверения служител към деня на проверката.
// Взима се с бутон в черновата и се заключва с протокола (control_checks.evidence).
import type { Evidence } from './control'

const MONTHS = ['', 'януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']
const REPORT_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6]   // реализация на ИУП: отчет до 8-мо число на следващия месец

/** Отчетите за реализацията на ИУП, чийто срок (8-мо число) е изтекъл преди датата. */
export function iupDueMonths(yearName: string, date: string) {
  const start = parseInt(yearName, 10)
  if (!start) return []
  return REPORT_MONTHS.map(m => ({ month: m, year: m >= 9 ? start : start + 1 }))
    .filter(({ month, year }) => {
      const dm = month === 12 ? 1 : month + 1, dy = month === 12 ? year + 1 : year
      return `${dy}-${String(dm).padStart(2, '0')}-08` < date
    })
}

export async function buildEvidence(supabase: any, o: {
  staff: { id: string; name: string }[]; yearId: string; yearName: string; date: string; excludeCheck?: string
}): Promise<Evidence> {
  const ids = o.staff.map(s => s.id)
  const due = iupDueMonths(o.yearName, o.date)
  const [{ data: cta }, { data: visits }, { data: checks }, { data: recs }] = await Promise.all([
    supabase.from('class_teacher_assignments').select('staff_id, class_id, class:classes(name)').in('staff_id', ids).eq('academic_year_id', o.yearId),
    supabase.from('visit_bookings').select('staff_id, date').in('staff_id', ids).lte('date', o.date),
    supabase.from('control_check_staff').select('staff_id, check:control_checks!inner(id, status, academic_year_id)')
      .in('staff_id', ids).eq('check.status', 'signed').eq('check.academic_year_id', o.yearId),
    supabase.from('control_recommendations').select('responsible_id, status, due_date, check:control_checks!control_recommendations_check_id_fkey!inner(status)')
      .in('responsible_id', ids).eq('check.status', 'signed').in('status', ['open', 'reported', 'not_done']),
  ])
  const classIds = Array.from(new Set((cta || []).map((c: any) => c.class_id)))
  const [{ data: iup }, { data: enr }, { data: teams }] = classIds.length
    ? await Promise.all([
        supabase.from('monthly_absences').select('class_id, month, year').in('class_id', classIds),
        supabase.from('student_enrollments').select('class_id, student:students!inner(id, status)').in('class_id', classIds).eq('academic_year_id', o.yearId).eq('student.status', 'active'),
        supabase.from('eplr_teams').select('student_id').eq('academic_year_id', o.yearId),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]
  const withTeam = new Set((teams || []).map((t: any) => t.student_id))

  const people = o.staff.map(s => {
    const lines: string[] = []
    const mine = (cta || []).filter((c: any) => c.staff_id === s.id)
    mine.forEach((c: any) => {
      const name = c.class?.name || 'паралелка'
      const kids = (enr || []).filter((e: any) => e.class_id === c.class_id).map((e: any) => e.student.id)
      const noTeam = kids.filter((id: string) => !withTeam.has(id)).length
      const done = new Set((iup || []).filter((r: any) => r.class_id === c.class_id).map((r: any) => `${r.year}-${r.month}`))
      const missing = due.filter(d => !done.has(`${d.year}-${d.month}`)).map(d => MONTHS[d.month])
      lines.push(`Паралелка ${name} (класен ръководител): ${kids.length} ученици${noTeam ? `, ${noTeam} без определен ЕПЛР` : ''}.`)
      if (due.length) lines.push(`Реализация на ИУП — ${missing.length ? `неподадени отчети за: ${missing.join(', ')}` : `подадени всички ${due.length} изтекли отчета`}.`)
    })
    const v = (visits || []).filter((x: any) => x.staff_id === s.id && x.date >= `${parseInt(o.yearName, 10)}-09-01`).length
    lines.push(`Посещения на часове през учебната година: ${v}.`)
    const prev = (checks || []).filter((x: any) => x.staff_id === s.id && x.check?.id !== o.excludeCheck).length
    lines.push(`Подписани констативни протоколи през учебната година: ${prev}.`)
    const open = (recs || []).filter((r: any) => r.responsible_id === s.id)
    const late = open.filter((r: any) => r.status !== 'reported' && r.due_date && r.due_date < o.date).length
    if (open.length) lines.push(`Неприключени препоръки от предишни проверки: ${open.length}${late ? `, от тях ${late} с изтекъл срок` : ''}.`)
    return { staff_id: s.id, name: s.name, lines }
  })
  return { taken_at: new Date().toISOString(), people }
}
