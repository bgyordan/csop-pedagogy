import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getFullName } from '@/lib/utils'
import SurveyForm from './SurveyForm'

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: student } = await supabase
    .from('students').select('id, first_name, middle_name, last_name').eq('id', id).single()
  if (!student) notFound()

  const { data: profile } = await supabase
    .from('staff_profiles').select('role, is_coordinator').eq('user_id', user.id).single()
  const canEdit = ['admin', 'zdud'].includes(profile?.role || '')
    || profile?.is_coordinator === true
    || ['psychologist', 'speech_therapist', 'rehabilitator'].includes(profile?.role || '')

  const { data: survey } = await supabase
    .from('student_surveys').select('data').eq('student_id', id).maybeSingle()

  return (
    <SurveyForm
      studentId={id}
      studentName={getFullName(student)}
      initialData={survey?.data || {}}
      canEdit={canEdit}
    />
  )
}
