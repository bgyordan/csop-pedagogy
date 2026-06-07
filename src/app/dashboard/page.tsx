import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboard from './components/AdminDashboard'
import SpecialistDashboard from './components/SpecialistDashboard'
import ClassTeacherDashboard from './components/ClassTeacherDashboard'
import SecretaryDashboard from './components/SecretaryDashboard'

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
  const isSecretary = profile.role === 'secretary'

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-700">
      <div className="mb-8 md:mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
              Добре дошли, {profile.first_name}!
            </h1>
            <p className="text-slate-500 text-sm mt-2 font-medium bg-slate-100/50 inline-block px-3 py-1 rounded-full border border-slate-200">
              {new Date().toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {isSecretary ? 'Деловодство' : 'Учебна година'}
            </span>
            <div className="text-lg font-semibold text-slate-700">
              {isSecretary ? 'ЦСОП Варна' : currentYear.name}
            </div>
          </div>
        </div>
      </div>

      <div className="transition-all duration-500">
        {isAdmin && <AdminDashboard profile={profile} currentYearId={currentYear.id} />}
        {isSpecialist && <SpecialistDashboard profile={profile} currentYearId={currentYear.id} />}
        {profile.role === 'class_teacher' && <ClassTeacherDashboard profile={profile} currentYearId={currentYear.id} />}
        {isSecretary && <SecretaryDashboard profile={profile} />}
      </div>
    </div>
  )
}
