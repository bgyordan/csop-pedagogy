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
import IfoTodayCard from './components/IfoTodayCard'
import { heroCookie, heroTheme } from './hero-themes'
import DashboardCustomize from './DashboardCustomize'
import { dashCookie, hiddenWidgets, orderCookie, widgetOrder, widgetsFor } from '@/lib/dashboard-prefs'
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
  // ред на картите (стрелките ↑↓ в „Подреди таблото“) — CSS order в общата решетка
  const orderKey = orderCookie(profile.id)
  const order = widgetOrder(cookieStore.get(orderKey)?.value ? decodeURIComponent(cookieStore.get(orderKey)!.value) : null)
  const ord = (k: string) => ({ order: order.indexOf(k) })
  // цвят на хедъра — по избор на човека (по подразбиране синьо-зеленият преливащ)
  const heroKey = heroCookie(profile.id)
  const hero = heroTheme(cookieStore.get(heroKey)?.value)
  const d = hero.dark

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-700 space-y-4">
      {viewing && <ViewAsPicker people={[]} viewing={viewing} />}

      {/* Помощници (телефон, на крак): тънка лента вместо големия хедър */}
      {profile.role === 'support' && !viewing ? (
        <div className={`${hero.bg} ${d ? 'text-white' : 'text-slate-800'} px-4 py-2.5 rounded-2xl shadow-sm flex items-center gap-3`}>
          <div className="min-w-0">
            <div className={`text-[15px] truncate ${d ? '' : 'text-[#0f2240]'}`}>{profile.first_name} {profile.last_name}</div>
            <div className={`text-xs ${d ? 'text-white/80' : 'text-slate-500'}`}>
              {new Date().toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Sofia' })}
            </div>
          </div>
          <div className="ml-auto shrink-0">
            <DashboardCustomize heroCookieName={heroKey} heroKey={hero.key} onDark={d} cookieName={dashKey} orderCookieName={orderKey} order={order} widgets={widgetsFor(profile.role)} hidden={Array.from(hidden)} />
          </div>
        </div>
      ) : (
      /* Хедър — преливащ цвят по избор (по подразбиране синьо-зелен) */
      <div className={`${hero.bg} ${d ? 'text-white' : 'text-slate-800'} p-6 md:p-8 rounded-3xl shadow-sm relative`}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className={`text-xl md:text-2xl font-semibold tracking-tight ${d ? '' : 'text-[#0f2240]'}`}>
              Добре дошли в Информационната система на ЦСОП-Варна!
            </h1>
            <p className={`text-sm mt-1.5 ${d ? 'text-white/90' : 'text-slate-600'}`}>
              Влязохте като <span className="font-semibold">{profile.first_name} {profile.last_name}</span>{' '}
              ({roleLabel}{isCoordinator ? ' & Координатор' : ''}).
            </p>
            {!viewing && prevLogin && (
              <p className={`text-xs mt-1 font-light ${d ? 'text-white/75' : 'text-slate-400'}`}>Предишно влизане: {loginTime(prevLogin)}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {real?.role === 'admin' && !viewing && <ViewAsPicker people={people} onDark={d} />}
              {!viewing && <DashboardCustomize heroCookieName={heroKey} heroKey={hero.key} onDark={d} cookieName={dashKey} orderCookieName={orderKey} order={order} widgets={widgetsFor(profile.role)} hidden={Array.from(hidden)} />}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${d ? 'text-white/80' : 'text-teal-700/70'}`}>
              {isSecretary ? 'Деловодство' : 'Учебна година'}
            </div>
            <div className={`text-base font-semibold px-4 py-1.5 rounded-xl border ${d ? 'text-white bg-white/15 border-white/20' : 'text-teal-800 bg-white border-teal-200'}`}>
              {isSecretary ? 'ЦСОП Варна' : currentYear.name}
            </div>
            <div className={`text-sm mt-1.5 ${d ? 'text-white/90' : 'text-slate-500'}`}>
              {new Date().toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>
        {/* декорацията се реже тук, а не целият хедър — иначе падащото „Виж като…“ се скрива */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          <div className={`absolute right-0 top-0 bottom-0 ${d ? 'opacity-10' : 'opacity-[0.07] text-teal-700'} flex items-center pr-8`}>
            <Megaphone className="h-40 w-40 rotate-12" />
          </div>
        </div>
      </div>
      )}

      {/* Картите на таблото — в реда, избран от човека в „Подреди таблото“ (стрелки ↑↓).
          Кратките ленти са по две на ред, широките (неучебен ден, ИФО, календар) — на цял ред.
          Празна карта (компонентът не връща нищо) не заема място — empty:hidden. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 grid-flow-row-dense gap-4 empty:hidden">
        {/* Спонтанен неучебен ден — днес или в следващите дни */}
        {show('nonschool') && <div style={ord('nonschool')} className="lg:col-span-2 empty:hidden"><NonSchoolDayStrip /></div>}

        {/* ИФО децата днес: какво имат, при кого, кой замества.
            Помощници — търсене сред всички деца + ИФО децата; управа — всички ИФО; останалите — само своите, иначе нищо. */}
        {!isSecretary && show('ifoToday') && (
          <div style={ord('ifoToday')} className="lg:col-span-2 empty:hidden">
            {profile.role === 'support'
              ? <IfoTodayCard currentYearId={currentYear.id} search />
              : ['admin', 'zdud', 'director'].includes(profile.role)
                ? <IfoTodayCard currentYearId={currentYear.id} />
                : <IfoTodayCard currentYearId={currentYear.id} staffId={profile.id} />}
          </div>
        )}

        {/* Посещение на час — избор на ден (учителите в отворена проверка) */}
        {!viewing && show('visit') && <div style={ord('visit')} className="dash-strips empty:hidden"><VisitStrip profile={profile} /></div>}

        {/* Контролна дейност — протокол за запознаване / черновите изтичат */}
        {!viewing && show('control') && <div style={ord('control')} className="dash-strips empty:hidden"><ControlStrip profile={profile} /></div>}

        {/* Дежурни тази седмица */}
        {!viewing && show('duty') && <div style={ord('duty')} className="dash-strips empty:hidden"><DutyStrip staffId={profile.id} /></div>}

        {/* За съгласуване — материали за предстоящ съвет, с които още не съм се запознал */}
        {!viewing && show('council') && <div style={ord('council')} className="dash-strips empty:hidden"><CouncilStrip staffId={profile.id} /></div>}

        {/* Материална база — нови сигнали (управа/деловодство) или отговори по моите сигнали */}
        {!viewing && show('facilities') && <div style={ord('facilities')} className="dash-strips empty:hidden"><FacilitiesStrip profile={profile} /></div>}

        {/* Онлайн стаи — децата на ОРЕС, с които работя */}
        {show('ores') && <div style={ord('ores')} className="dash-strips empty:hidden"><OnlineRoomStrip profile={profile} currentYearId={currentYear.id} /></div>}

        {/* Онлайн стаи на паралелките (грипна ваканция) — отворените стаи и въпросите от родители */}
        {show('classroom') && <div style={ord('classroom')} className="dash-strips empty:hidden"><ClassRoomStrip profile={profile} currentYearId={currentYear.id} /></div>}

        {/* Отсъстващи деца — класният отразява, терапевтите и учителите на детето виждат */}
        {!isSecretary && profile.role !== 'support' && show('absent') && <div style={ord('absent')} className="dash-strips empty:hidden"><StudentAbsentStrip profile={profile} currentYearId={currentYear.id} /></div>}

        {/* Днес отсъстват — за всички колеги (управата го има в оперативния панел) */}
        {!isAdmin && !isDirector && show('todayAbsent') && <div style={ord('todayAbsent')} className="dash-strips empty:hidden"><TodayAbsentStrip /></div>}

        {/* Календар — моята седмица (по-компактен); до него за класните — учебните планове от училищата */}
        {((!viewing && show('calendar')) || schoolGroups) && (
          <div style={ord('calendar')} className={`lg:col-span-2 ${!viewing && show('calendar') && schoolGroups ? 'grid grid-cols-1 lg:grid-cols-3 gap-4' : ''}`}>
            {!viewing && show('calendar') && (
              <div className={schoolGroups ? 'lg:col-span-2 min-w-0' : ''}>
                <CalendarWidget me={{ id: profile.id, role: profile.role, isCoordinator: profile.is_coordinator === true }} />
              </div>
            )}
            {schoolGroups && <SchoolFilesCardClient groups={schoolGroups} />}
          </div>
        )}
      </div>

      {/* Dashboard по роля */}
      <div className="transition-all duration-500">
        {isAdmin && <AdminDashboard profile={profile} currentYearId={currentYear.id} />}
        {isDirector && <DirectorDashboard profile={profile} currentYearId={currentYear.id} />}
        {isSpecialist && <SpecialistDashboard profile={profile} currentYearId={currentYear.id} />}
        {(profile.role === 'class_teacher' || profile.role === 'teacher') && <ClassTeacherDashboard profile={profile} currentYearId={currentYear.id} />}
        {profile.role === 'educator' && <EducatorDashboard profile={profile} currentYearId={currentYear.id} />}
        {isSecretary && <SecretaryDashboard profile={profile} showShared={show('shared')} />}
        {therapyRole && (
          <div className="mt-4">
            <div className="dash-title mb-3">Като {String(ROLE_LABELS[therapyRole as keyof typeof ROLE_LABELS] || therapyRole).toLowerCase()}</div>
            <SpecialistDashboard profile={{ ...profile, role: therapyRole }} currentYearId={currentYear.id} />
          </div>
        )}
      </div>
    </div>
  )
}
