import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { IMP_COOKIE } from '@/lib/impersonate'
import AdminDashboard from './components/AdminDashboard'
import SpecialistDashboard from './components/SpecialistDashboard'
import StudentAbsentStrip from './components/StudentAbsentStrip'
import ClassTeacherDashboard from './components/ClassTeacherDashboard'
import EducatorDashboard from './components/EducatorDashboard'
import SecretaryDashboard from './components/SecretaryDashboard'
import DirectorDashboard from './components/DirectorDashboard'
import { SessionTimerBadge } from '@/components/SessionTimerBadge'
import { Megaphone } from 'lucide-react'
import { viewProfile } from '@/lib/view-as'
import { getFullName } from '@/lib/utils'
import ViewAsPicker from './view-as/ViewAsPicker'
import { createAdminClient } from '@/lib/supabase/admin'
import { loginTime } from '@/lib/login-time'
import TodayAbsentStrip from './components/TodayAbsentStrip'
import VisitStrip from './components/VisitStrip'
import ControlStrip from './components/ControlStrip'
import CouncilStrip from './components/CouncilStrip'
import NonSchoolDayStrip from './components/NonSchoolDayStrip'
import DutyStrip from './components/DutyStrip'
import CalendarWidget from './components/CalendarWidget'
import { loadSchoolFileGroups } from './components/SchoolFilesCard'
import SchoolFilesCardClient from './components/SchoolFilesCardClient'
import FacilitiesStrip from './components/FacilitiesStrip'
import OnlineRoomStrip from './components/OnlineRoomStrip'
import ClassRoomStrip from './components/ClassRoomStrip'
import DashboardCustomize from './DashboardCustomize'
import { dashCookie, hiddenWidgets, widgetsFor } from '@/lib/dashboard-prefs'
export const dynamic = 'force-dynamic'

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

  const [{ profile, real, viewingAs }, { data: currentYear }] = await Promise.all([
    viewProfile(supabase, user.id),
    supabase.from('academic_years').select('*').eq('is_current', true).single()
  ])
  if (!profile || !currentYear) redirect('/auth/login')

  // Предишно влизане: при ново влизане (Supabase Auth last_sign_in_at се е сменил)
  // старото „последно“ става „предишно“. Записва се за ИСТИНСКИЯ потребител, не при „Виж като…“.
  // При „Влез като…“ не пипаме датите на колегата.
  const impersonating = !!(await cookies()).get(IMP_COOKIE)
  let prevLogin: string | null = impersonating ? null : (real?.prev_login_at ?? null)
  if (!impersonating && real && user.last_sign_in_at && 'last_login_at' in real && real.last_login_at !== user.last_sign_in_at) {
    prevLogin = real.last_login_at ?? null
    try {
      await createAdminClient().from('staff_profiles')
        .update({ prev_login_at: real.last_login_at ?? null, last_login_at: user.last_sign_in_at })
        .eq('id', real.id)
    } catch { /* колоните още не са добавени — нищо */ }
  }

  // „Виж като…“ — само за админ: списък на служителите (без помощния персонал)
  const labelOf = (p: any) => p.position || ROLE_LABELS[p.role] || p.role
  const { data: staffList } = real?.role === 'admin'
    ? await supabase.from('staff_profiles').select('id, first_name, middle_name, last_name, role, position')
        .not('user_id', 'is', null).neq('id', real.id).order('first_name')
    : { data: null }
  const people = (staffList || []).map((p: any) => ({ id: p.id, name: getFullName(p), label: labelOf(p), role: p.role }))
  // учебните планове от училищата на децата — за класните (до календара)
  const schoolGroups = (profile.role === 'class_teacher' || profile.role === 'teacher')
    ? await loadSchoolFileGroups(profile.id, currentYear.id) : null
  const viewing = viewingAs ? { id: profile.id, name: getFullName(profile), label: labelOf(profile) } : null

  const isAdmin = ['admin', 'zdud'].includes(profile.role)
  const isDirector = profile.role === 'director'
  const isSpecialist = ['psychologist', 'speech_therapist', 'rehabilitator'].includes(profile.role)
  const isSecretary = profile.role === 'secretary'
  // втора, терапевтична роля (напр. ЗДУД + логопед) — показва се и таблото на специалиста
  const therapyRole = !isSpecialist && ['psychologist', 'speech_therapist', 'rehabilitator'].includes(profile.therapy_role || '') ? profile.therapy_role as string : null
  const roleLabel = profile.position || ROLE_LABELS[profile.role] || profile.role
  const isCoordinator = profile.is_coordinator
  // „Подреди таблото“ — кои карти е скрил човекът (или по подразбиране за ролята)
  const dashKey = dashCookie(profile.id)
  const cookieStore = await cookies()
  const hidden = hiddenWidgets(profile.role, cookieStore.get(dashKey)?.value != null ? decodeURIComponent(cookieStore.get(dashKey)!.value) : null)
  const show = (k: string) => !hidden.has(k)

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-700 space-y-6">
      {viewing && <ViewAsPicker people={[]} viewing={viewing} />}

      {/* Хедър — светъл, със синкаво-зелен оттенък */}
      <div className="bg-gradient-to-br from-teal-50 via-white to-cyan-50/70 border border-teal-100 text-slate-800 p-5 md:p-6 rounded-3xl shadow-sm relative">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-[#0f2240]">
              Добре дошли в Информационната система на ЦСОП-Варна!
            </h1>
            <p className="text-sm text-slate-600 mt-1.5">
              Влязохте като <span className="font-semibold">{profile.first_name} {profile.last_name}</span>{' '}
              ({roleLabel}{isCoordinator ? ' & Координатор' : ''}).
            </p>
            {!viewing && prevLogin && (
              <p className="text-xs text-slate-400 mt-1 font-light">Предишно влизане: {loginTime(prevLogin)}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SessionTimerBadge />
              {real?.role === 'admin' && !viewing && <ViewAsPicker people={people} />}
              {!viewing && <DashboardCustomize cookieName={dashKey} widgets={widgetsFor(profile.role)} hidden={Array.from(hidden)} />}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-teal-700/70 mb-1">
              {isSecretary ? 'Деловодство' : 'Учебна година'}
            </div>
            <div className="text-base font-semibold text-teal-800 bg-white px-4 py-1.5 rounded-xl border border-teal-200">
              {isSecretary ? 'ЦСОП Варна' : currentYear.name}
            </div>
            <div className="text-sm text-slate-500 mt-1.5">
              {new Date().toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>
        {/* декорацията се реже тук, а не целият хедър — иначе падащото „Виж като…“ се скрива */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          <div className="absolute right-0 top-0 bottom-0 opacity-[0.07] text-teal-700 flex items-center pr-8">
            <Megaphone className="h-40 w-40 rotate-12" />
          </div>
        </div>
      </div>

      {/* Спонтанен неучебен ден — днес или в следващите дни */}
      {show('nonschool') && <NonSchoolDayStrip />}


      {/* Кратките ленти — по две на ред, за да не са дълги през целия екран */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 empty:hidden">
        {/* Посещение на час — избор на ден (учителите в отворена проверка) */}
        {!viewing && show('visit') && <VisitStrip profile={profile} />}

        {/* Контролна дейност — протокол за запознаване / черновите изтичат */}
        {!viewing && show('control') && <ControlStrip profile={profile} />}

        {/* Дежурни тази седмица */}
        {!viewing && show('duty') && <DutyStrip staffId={profile.id} />}

        {/* За съгласуване — материали за предстоящ съвет, с които още не съм се запознал */}
        {!viewing && show('council') && <CouncilStrip staffId={profile.id} />}

        {/* Материална база — нови сигнали (управа/деловодство) или отговори по моите сигнали */}
        {!viewing && show('facilities') && <FacilitiesStrip profile={profile} />}

        {/* Онлайн стаи — децата на ОРЕС, с които работя */}
        {show('ores') && <OnlineRoomStrip profile={profile} currentYearId={currentYear.id} />}

        {/* Онлайн стаи на паралелките (грипна ваканция) — отворените стаи и въпросите от родители */}
        {show('classroom') && <ClassRoomStrip profile={profile} currentYearId={currentYear.id} />}

        {/* Отсъстващи деца — класният отразява, терапевтите и учителите на детето виждат */}
        {!isSecretary && profile.role !== 'support' && show('absent') && <StudentAbsentStrip profile={profile} currentYearId={currentYear.id} />}

        {/* Днес отсъстват — за всички колеги (управата го има в оперативния панел) */}
        {!isAdmin && !isDirector && show('todayAbsent') && <TodayAbsentStrip />}

      </div>

      {/* Календар — моята седмица (по-компактен); до него за класните — учебните планове от училищата */}
      {((!viewing && show('calendar')) || schoolGroups) && (
        <div className={!viewing && show('calendar') && schoolGroups ? 'grid grid-cols-1 lg:grid-cols-3 gap-4 items-start' : ''}>
          {!viewing && show('calendar') && (
            <div className={schoolGroups ? 'lg:col-span-2 min-w-0' : ''}>
              <CalendarWidget me={{ id: profile.id, role: profile.role, isCoordinator: profile.is_coordinator === true }} />
            </div>
          )}
          {schoolGroups && <SchoolFilesCardClient groups={schoolGroups} />}
        </div>
      )}

      {/* Dashboard по роля */}
      <div className="transition-all duration-500">
        {isAdmin && <AdminDashboard profile={profile} currentYearId={currentYear.id} />}
        {isDirector && <DirectorDashboard profile={profile} currentYearId={currentYear.id} />}
        {isSpecialist && <SpecialistDashboard profile={profile} currentYearId={currentYear.id} />}
        {(profile.role === 'class_teacher' || profile.role === 'teacher') && <ClassTeacherDashboard profile={profile} currentYearId={currentYear.id} />}
        {profile.role === 'educator' && <EducatorDashboard profile={profile} currentYearId={currentYear.id} />}
        {isSecretary && <SecretaryDashboard profile={profile} showShared={show('shared')} />}
        {therapyRole && (
          <div className="mt-6">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Като {String(ROLE_LABELS[therapyRole as keyof typeof ROLE_LABELS] || therapyRole).toLowerCase()}</div>
            <SpecialistDashboard profile={{ ...profile, role: therapyRole }} currentYearId={currentYear.id} />
          </div>
        )}
      </div>
    </div>
  )
}
