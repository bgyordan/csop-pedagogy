import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getFullName } from '@/lib/utils'
import SurveyForm from './SurveyForm'

function calcAge(birthDate?: string): string {
  if (!birthDate) return ''
  const birth = new Date(birthDate)
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--
  return years > 0 ? `${years} г.` : ''
}

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: student } = await supabase
    .from('students').select('id, first_name, middle_name, last_name, birth_date').eq('id', id).single()
  if (!student) notFound()

  const { data: profile } = await supabase
    .from('staff_profiles').select('role, is_coordinator').eq('user_id', user.id).single()
  const canEdit = ['admin', 'zdud'].includes(profile?.role || '')
    || profile?.is_coordinator === true
    || ['psychologist', 'speech_therapist', 'rehabilitator'].includes(profile?.role || '')

  const { data: currentYear } = await supabase
    .from('academic_years').select('id').eq('is_current', true).single()
  const { data: enrollment } = await supabase
    .from('student_enrollments').select('class:classes(name)')
    .eq('student_id', id).eq('academic_year_id', currentYear?.id).maybeSingle()
  const { data: guardians } = await supabase
    .from('student_guardians').select('*').eq('student_id', id).order('relation')

  const { data: survey } = await supabase
    .from('student_surveys').select('data, status').eq('student_id', id).maybeSingle()

  // Автопопълване на "Данни за детето" от досието (само ако анкетата още е празна за тях)
  const g = (guardians || [])[0] as any
  const prefill = {
    full_name: getFullName(student),
    age: calcAge((student as any).birth_date),
    group: (enrollment?.class as any)?.name || '',
    parent_name: g ? [g.first_name, g.last_name].filter(Boolean).join(' ') : '',
    phone: g?.phone || '',
    email: g?.email || '',
  }

  const existing = survey?.data || {}
  const mergedData = {
    ...existing,
    child_data: { ...prefill, ...(existing.child_data || {}) },  // въведеното има превес над авто
  }

  return (
    <SurveyForm
      studentId={id}
      studentName={getFullName(student)}
      initialData={mergedData}
      canEdit={canEdit}
    />
  )
}
