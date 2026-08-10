'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { addSubject as _addSubject } from '../classes/[id]/schedule/actions'

export { _addSubject as addSubject }

// Запазва ИФО часовете на текущия учител за конкретно дете+срок.
// slots: списък { day, period, subjectId }. Заменя старите за това дете+учител+срок.
export async function saveTeacherIfoSlots(
  studentId: string,
  academicYearId: string,
  term: number,
  slots: { day: number; period: number; subjectId: string | null }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!profile) return { error: 'Няма профил' }

  const teacherId = profile.id

  // Изтриваме старите часове на ТОЗИ учител с ТОВА дете за срока, после вкарваме новите
  await supabase.from('teacher_ifo_slots').delete()
    .eq('teacher_id', teacherId)
    .eq('student_id', studentId)
    .eq('academic_year_id', academicYearId)
    .eq('term', term)

  const toInsert = slots
    .filter(s => s.subjectId)
    .map(s => ({
      teacher_id: teacherId,
      student_id: studentId,
      academic_year_id: academicYearId,
      term,
      day: s.day,
      period: s.period,
      subject_id: s.subjectId,
    }))

  if (toInsert.length > 0) {
    const { error } = await supabase.from('teacher_ifo_slots').insert(toInsert)
    if (error) return { error: error.message }
  }
  revalidatePath('/my-ifo')
  revalidatePath(`/students/${studentId}/schedule`)
  return { success: true }
}

// Копира ИФО часовете на учителя с дете от I срок към II
export async function copyTeacherIfoFromTerm1(studentId: string, academicYearId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: profile } = await supabase
    .from('staff_profiles').select('id').eq('user_id', user.id).single()
  if (!profile) return { error: 'Няма профил' }

  const { data: slots } = await supabase
    .from('teacher_ifo_slots').select('day, period, subject_id')
    .eq('teacher_id', profile.id)
    .eq('student_id', studentId)
    .eq('academic_year_id', academicYearId)
    .eq('term', 1)
  if (!slots || slots.length === 0) return { error: 'I срок е празен' }
  return { slots }
}
