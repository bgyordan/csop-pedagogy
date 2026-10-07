// Служителите с преподавателска заетост за текущата година — часове в разписанието (паралелки, ИЧ)
// или редове в учебния план от НЕИСПУО към паралелка. Те се заместват при отсъствие, независимо от ролята.
// Терапиите на специалистите (редове без паралелка) не се броят — техният график се отлага, не се замества.
export async function teachingStaffIds(supabase: any): Promise<Set<string>> {
  const out = new Set<string>()
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).maybeSingle()
  if (!cy) return out
  const [{ data: slots }, { data: ifo }, { data: plan }] = await Promise.all([
    supabase.from('schedule_slots').select('staff_id, schedule:class_schedules!inner(academic_year_id)')
      .eq('schedule.academic_year_id', cy.id).not('staff_id', 'is', null).range(0, 9999),
    supabase.from('teacher_ifo_slots').select('teacher_id').eq('academic_year_id', cy.id).range(0, 9999),
    supabase.from('curriculum_lines').select('staff_id').eq('academic_year_id', cy.id).not('staff_id', 'is', null).not('class_id', 'is', null).range(0, 4999),
  ])
  ;(slots || []).forEach((r: any) => out.add(r.staff_id))
  ;(ifo || []).forEach((r: any) => out.add(r.teacher_id))
  ;(plan || []).forEach((r: any) => out.add(r.staff_id))
  return out
}
