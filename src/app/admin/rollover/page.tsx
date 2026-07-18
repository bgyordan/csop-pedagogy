import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { getFullName } from '@/lib/utils'
import RolloverClient from './RolloverClient'

export const dynamic = 'force-dynamic'

export default async function RolloverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud'].includes(profile?.role || '')) redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  // Непотвърдени записи в текущата година
  const { data: unconfirmed } = await supabase
    .from('student_enrollments')
    .select('id, confirmed, class:classes(name), student:students(id, first_name, middle_name, last_name, external_class, status)')
    .eq('academic_year_id', currentYear?.id)
    .eq('confirmed', false)

  const { count: totalEnrollments } = await supabase
    .from('student_enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('academic_year_id', currentYear?.id)

  const { count: confirmedCount } = await supabase
    .from('student_enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('academic_year_id', currentYear?.id)
    .eq('confirmed', true)

  // Статистика за преглед преди rollover
  const [
    { count: classCount },
    { count: activeStudents },
    { count: coudGroupCount },
  ] = await Promise.all([
    supabase.from('classes').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYear?.id),
    supabase.from('student_enrollments').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYear?.id),
    supabase.from('coud_groups').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYear?.id),
  ])

  const rows = (unconfirmed || []).map((e: any) => ({
    enrollmentId: e.id,
    studentId: e.student?.id,
    name: getFullName(e.student),
    className: e.class?.name || '—',
    externalClass: e.student?.external_class || '',
    status: e.student?.status,
  })).sort((a, b) => a.className.localeCompare(b.className, 'bg') || a.name.localeCompare(b.name, 'bg'))

  // Предложение за име на следваща година
  const currName = currentYear?.name || ''
  const startY = parseInt(currName.split(/[-/]/)[0]) || new Date().getFullYear()
  const suggestedName = `${startY + 1}-${startY + 2}`
  const suggestedStart = `${startY + 1}-09-15`
  const suggestedEnd = `${startY + 2}-06-30`

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Преминаване в нова учебна година</h1>
        <p className="text-slate-500 text-sm mt-1">Текуща година: {currentYear?.name}</p>
      </div>

      <RolloverClient
        currentYearId={currentYear?.id || ''}
        currentYearName={currentYear?.name || ''}
        suggestedName={suggestedName}
        suggestedStart={suggestedStart}
        suggestedEnd={suggestedEnd}
        rows={rows}
        totalEnrollments={totalEnrollments || 0}
        confirmedCount={confirmedCount || 0}
        preview={{
          classes: classCount || 0,
          students: activeStudents || 0,
          coudGroups: coudGroupCount || 0,
        }}
      />
    </div>
  )
}
