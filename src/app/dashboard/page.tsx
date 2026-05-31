import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboard from './components/AdminDashboard'
import SpecialistDashboard from './components/SpecialistDashboard'
import ClassTeacherDashboard from './components/ClassTeacherDashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: currentYear }] = await Promise.all([
    supabase.from('staff_profiles').select('*').eq('user_id', user.id).single(),
    supabase.from('academic_years').select('*').eq('is_current', true).single()
  ])

  if (!profile || !currentYear) redirect('/auth/login')

  const isAdmin = ['admin', 'director', 'zdud'].includes(profile.role)
  const isSpecialist = ['psychologist', 'speech_therapist', 'rehabilitator'].includes(profile.role)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">Добре дошли, {profile.first_name}!</h1>
        <p className="text-slate-500 text-sm mt-1">Учебна година {currentYear.name} · {new Date().toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {isAdmin && <AdminDashboard profile={profile} currentYearId={currentYear.id} />}
      {isSpecialist && <SpecialistDashboard profile={profile} currentYearId={currentYear.id} />}
      {profile.role === 'class_teacher' && <ClassTeacherDashboard profile={profile} currentYearId={currentYear.id} />}
    </div>
  )
}
