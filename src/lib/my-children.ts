// Децата, с които работи даден служител през текущата година:
//  • класен на паралелката;  • има часове в паралелката (седмично разписание);  • ИФО часове;
//  • възпитател на ЦОУД група;  • терапевт на детето;  • член на ЕПЛР екипа.
// Връща множество от student_id (само активни деца). Ползва се там, където колегата трябва да вижда „само своите“.

export async function myChildrenIds(supabase: any, staffId: string, yearId: string | null | undefined): Promise<Set<string>> {
  const ids = new Set<string>()
  if (!staffId || !yearId) return ids

  const [{ data: ct }, { data: scheds }, { data: ifo }, { data: cg }, { data: th }, { data: et }] = await Promise.all([
    supabase.from('class_teacher_assignments').select('class_id').eq('staff_id', staffId).eq('academic_year_id', yearId),
    supabase.from('class_schedules').select('id, class_id').eq('academic_year_id', yearId),
    supabase.from('teacher_ifo_slots').select('student_id').eq('teacher_id', staffId).eq('academic_year_id', yearId),
    supabase.from('coud_groups').select('id').eq('teacher_id', staffId).eq('academic_year_id', yearId),
    supabase.from('students').select('id')
      .or(`therapist_psychologist_id.eq.${staffId},therapist_speech_id.eq.${staffId},therapist_rehab_id.eq.${staffId},therapist_rehab2_id.eq.${staffId}`),
    supabase.from('eplr_teams').select('student_id').eq('academic_year_id', yearId)
      .or(`psychologist_id.eq.${staffId},speech_therapist_id.eq.${staffId},rehabilitator_id.eq.${staffId},class_teacher_id.eq.${staffId}`),
  ])

  // паралелки: класен + часове в разписанието
  const classIds = new Set<string>((ct || []).map((r: any) => r.class_id).filter(Boolean))
  const schedClass: Record<string, string> = {}
  ;(scheds || []).forEach((s: any) => { schedClass[s.id] = s.class_id })
  const sids = Object.keys(schedClass)
  if (sids.length) {
    const { data: sl } = await supabase.from('schedule_slots').select('schedule_id').in('schedule_id', sids).eq('staff_id', staffId)
    ;(sl || []).forEach((r: any) => { if (schedClass[r.schedule_id]) classIds.add(schedClass[r.schedule_id]) })
  }
  if (classIds.size) {
    const { data: en } = await supabase.from('student_enrollments').select('student_id')
      .in('class_id', Array.from(classIds)).eq('academic_year_id', yearId)
    ;(en || []).forEach((e: any) => ids.add(e.student_id))
  }
  // ЦОУД групи
  const coudIds = (cg || []).map((r: any) => r.id)
  if (coudIds.length) {
    const { data: ce } = await supabase.from('coud_enrollments').select('student_id').in('coud_group_id', coudIds).eq('academic_year_id', yearId)
    ;(ce || []).forEach((e: any) => ids.add(e.student_id))
  }
  ;(ifo || []).forEach((r: any) => ids.add(r.student_id))
  ;(th || []).forEach((r: any) => ids.add(r.id))
  ;(et || []).forEach((r: any) => ids.add(r.student_id))
  return ids
}
