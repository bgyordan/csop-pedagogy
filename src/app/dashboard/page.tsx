import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboard from './components/AdminDashboard'
import SpecialistDashboard from './components/SpecialistDashboard'
import ClassTeacherDashboard from './components/ClassTeacherDashboard'
import SecretaryDashboard from './components/SecretaryDashboard'
import { SessionTimerBadge } from '@/components/SessionTimerBadge'
import { Megaphone } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  director: 'Директор',
  zdud: 'ЗДУД',
  secretary: 'Деловодител',
  psychologist: 'Психолог',
  speech_therapist: 'Логопед',
  rehabilitator: 'Рехабилитатор',
  class_teacher: 'Класен ръководител',
}

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
  const roleLabel = ROLE_LABELS[profile.role] || profile.role
  const isCoordinator = profile.is_coordinator

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-700 space-y-6">

      {/* Тъмносин хедър */}
      <div className="bg-[#0f2240] text-white p-6 md:p-8 rounded-3xl shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Добре дошли в Обединената система на ЦСОП гр. Варна!
            </h1>
            <p className="text-sm text-sky-100/80 mt-1.5">
              Влязохте като <strong>{profile.first_name} {profile.last_name}</strong>{' '}
              ({roleLabel}{isCoordinator ? ' & Координатор' : ''}).
            </p>
            <div className="mt-3">
              <SessionTimerBadge />
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-sky-200/60 mb-1">
              {isSecretary ? 'Деловодство' : 'Учебна година'}
            </div>
            <div className="text-base font-bold text-white bg-white/10 px-4 py-1.5 rounded-xl border border-white/10">
              {isSecretary ? 'ЦСОП Варна' : currentYear.name}
            </div>
            <div className="text-[10px] text-sky-100/50 mt-1.5 font-mono">
              {new Date().toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-8 pointer-events-none">
          <Megaphone className="h-40 w-40 rotate-12" />
        </div>
      </div>

      {/* Dashboard по роля */}
      <div className="transition-all duration-500">
        {isAdmin && <AdminDashboard profile={profile} currentYearId={currentYear.id} />}
        {isSpecialist && <SpecialistDashboard profile={profile} currentYearId={currentYear.id} />}
        {profile.role === 'class_teacher' && <ClassTeacherDashboard profile={profile} currentYearId={currentYear.id} />}
        {isSecretary && <SecretaryDashboard profile={profile} />}
      </div>
    </div>
  )
}
