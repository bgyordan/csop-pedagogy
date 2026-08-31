'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Разписанието на избран учител (за да маркираме слотове) — I срок
export async function getTeacherSchedule(staffId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { slots: [] }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  const { data: scheds } = await supabase
    .from('class_schedules').select('id, class:classes(name)')
    .eq('academic_year_id', cy?.id).eq('term', 1)
  const schedName: Record<string, string> = {}
  ;(scheds || []).forEach((s: any) => { schedName[s.id] = s.class?.name || '' })
  const schedIds = (scheds || []).map((s: any) => s.id)

  const out: { day: number; period: number; subjectId: string | null; subject: string; holderType: string; holderLabel: string }[] = []
  if (schedIds.length > 0) {
    const { data: slots } = await supabase
      .from('schedule_slots').select('schedule_id, day, period, subject_id, subject:subjects(name)')
      .in('schedule_id', schedIds).eq('staff_id', staffId)
    ;(slots || []).forEach((sl: any) => out.push({
      day: sl.day, period: sl.period, subjectId: sl.subject_id, subject: sl.subject?.name || '',
      holderType: 'class', holderLabel: schedName[sl.schedule_id] || '',
    }))
  }
  const { data: ifo } = await supabase
    .from('teacher_ifo_slots').select('day, period, subject_id, subject:subjects(name), student:students(first_name, last_name)')
    .eq('teacher_id', staffId).eq('academic_year_id', cy?.id).eq('term', 1)
  ;(ifo || []).forEach((sl: any) => out.push({
    day: sl.day, period: sl.period, subjectId: sl.subject_id, subject: sl.subject?.name || '',
    holderType: 'ifo', holderLabel: sl.student ? `ИФО ${sl.student.first_name} ${sl.student.last_name}` : 'ИФО',
  }))
  return { slots: out }
}

// Записва маркираните лекторски слотове за учител + период.
// Заменя предишните за същия учител/година (пренареждане).
export async function saveLecturerSlots(
  staffId: string, dateFrom: string, dateTo: string,
  slots: { day: number; period: number; subjectId: string | null; holderType: string; holderLabel: string }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director'].includes(me?.role || '')) return { error: 'Нямате права' }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  // трия старите за този учител/година, вписвам новите
  await supabase.from('lecturer_slots').delete().eq('staff_id', staffId).eq('academic_year_id', cy?.id)
  if (slots.length > 0) {
    const ins = slots.map(s => ({
      staff_id: staffId, day: s.day, period: s.period, subject_id: s.subjectId,
      holder_type: s.holderType, holder_label: s.holderLabel,
      date_from: dateFrom, date_to: dateTo,
      academic_year_id: cy?.id, created_by: me?.id,
    }))
    const { error } = await supabase.from('lecturer_slots').insert(ins)
    if (error) return { error: error.message }
  }
  revalidatePath('/lecturer')
  return { success: true }
}

// Изтрива всички лекторски слотове на учител
export async function clearLecturerSlots(staffId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
  await supabase.from('lecturer_slots').delete().eq('staff_id', staffId).eq('academic_year_id', cy?.id)
  revalidatePath('/lecturer')
  return { success: true }
}
