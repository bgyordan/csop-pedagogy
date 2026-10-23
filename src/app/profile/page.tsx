// „Моят профил“ — едно място за всичко лично в ЕИС (по модела на Workday / BambooHR / Personio / Arbor):
// горе — карта с най-важното „с един поглед“, под нея — табове. Обзор: какво чака от мен, показатели, бърз достъп.
// Данни: служебни данни, образование, ПКС, стаж, НЕИСПУО. Класове и ученици. Оценяване: ДТВ, атестиране,
// контролна дейност, решения за изпълнение. Проф. портфолио и Моите документи остават на адресите си, с същите табове.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  BookOpen, Users, HeartPulse, CalendarDays, CalendarClock, GraduationCap, Award, ClipboardCheck, Landmark,
  BookUser, Images, FolderOpen, Pencil, AlertTriangle, CheckCircle2, Clock, Briefcase, School, Building2,
  ListTodo, Star, Shield, Sparkles, ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS, type UserRole } from '@/types'
import { getFullName } from '@/lib/utils'
import { loadStaffStudents, uniqueStudentCount } from '@/lib/staff-students'
import { qualificationTotals, yearsSince, fmtNum, INTERNAL_MIN_YEAR, PP_ROLES, type PPItem, type PPProfile } from '@/lib/pro-portfolio'
import { dmy, isoOf, addYears, ATTEST_YEARS } from '@/lib/evaluation'
import { loadCurriculum, scheduleHoursByClass, TEACHER_NORM } from '@/lib/curriculum'
import CurriculumPlan from '@/components/curriculum/CurriculumPlan'
import ProfileNav, { type ProfileTab } from '@/components/profile/ProfileNav'
import StaffEvalSection from '@/app/staff/[id]/StaffEvalSection'
import StaffControlSection from '@/app/staff/[id]/StaffControlSection'
import StaffPortfolioSection from '@/app/staff/[id]/StaffPortfolioSection'
import ProfileSecurity from './ProfileSecurity'
import { Hero, Card, Stat, Row, StudentList, Tile } from './parts'
export const dynamic = 'force-dynamic'

const TEACH = ['class_teacher', 'teacher', 'educator']
const THER = ['psychologist', 'speech_therapist', 'rehabilitator']
const MGMT = ['admin', 'zdud', 'director']
const TABS: ProfileTab[] = ['overview', 'data', 'work', 'growth', 'security']

type Task = { key: string; href: string; title: string; meta?: string; due?: string | null; tone: 'rose' | 'amber' | 'sky' | 'violet'; icon: React.ReactNode }

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams
  const tab = (TABS.includes(sp.tab as ProfileTab) ? sp.tab : 'overview') as ProfileTab
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('*').eq('user_id', user.id).maybeSingle()
  if (!me) redirect('/auth/login')

  const role = me.role as string
  const therapyRole = (me as any).therapy_role as string | null
  const isPed = PP_ROLES.includes(role)
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
  const { data: year } = await supabase.from('academic_years').select('id, name, start_date, end_date').eq('is_current', true).maybeSingle()

  // Общото за всички табове (картата горе): паралелки, портфолио, атестиране, участия
  const [students, { data: pp }, { data: ppItems }, { data: evalRows }, { data: attestHist }, { data: committees }, { data: council }] = await Promise.all([
    ['secretary', 'support'].includes(role) ? Promise.resolve(null) : loadStaffStudents(supabase, me.id, role, year?.id, therapyRole),
    supabase.from('pp_profile').select('*').eq('staff_id', me.id).maybeSingle(),
    supabase.from('pp_items').select('id, section, kind, hours, credits, date_from, date_to, created_at').eq('staff_id', me.id),
    supabase.from('eval_participants').select('id, status, grade, employer_at, acked_at, finalized_at, sent_at, campaign:eval_campaigns(id, name, kind, status)').eq('staff_id', me.id),
    supabase.from('eval_attest_history').select('attested_on').eq('staff_id', me.id),
    supabase.from('committee_members').select('role, committee:committees(id, name)').eq('staff_id', me.id),
    supabase.from('bullying_council_members').select('id').eq('staff_id', me.id).limit(1),
  ])
  const profile = (pp || null) as PPProfile | null
  const items = (ppItems || []) as PPItem[]
  const q = qualificationTotals(items, year?.start_date, year?.end_date)
  const evals = (evalRows || []) as any[]
  const lastAttest = [
    ...evals.filter(r => r.campaign?.kind === 'attest' && r.grade).map(r => isoOf(r.employer_at || r.acked_at || r.finalized_at)),
    ...((attestHist || []) as any[]).map(h => String(h.attested_on)),
  ].filter(Boolean).sort().reverse()[0] || null
  const nextAttest = lastAttest ? addYears(lastAttest, ATTEST_YEARS) : null
  const classNames = students?.classes.map(c => c.name) || []
  const studentCount = students ? uniqueStudentCount(students) : 0
  const yTotal = profile ? yearsSince(profile.work_since, today, Number(profile.years_extra?.total || 0)) : null
  const yTeacher = profile ? yearsSince(profile.teacher_since, today, Number(profile.years_extra?.teacher || 0)) : null
  const roleLabel = ROLE_LABELS[role as UserRole] || role
  const pks = profile?.pks && profile.pks !== 'няма' ? profile.pks : null

  const badges: { label: string; tone?: 'light' | 'accent' }[] = [{ label: roleLabel }]
  if (therapyRole && therapyRole !== role) badges.push({ label: ROLE_LABELS[therapyRole as UserRole] || therapyRole })
  if (me.is_coordinator) badges.push({ label: 'Координатор', tone: 'accent' })
  if (classNames.length) badges.push({ label: `Класен на ${classNames.join(', ')}` })
  if (students?.coudGroups.length) badges.push({ label: `ЦОУД ${students.coudGroups.map(g => g.name).join(', ')}` })
  if (pks) badges.push({ label: pks })

  const scheduleHref = THER.includes(role) ? '/my-activities/schedule' : '/my-schedule'
  const hasSchedule = !['secretary', 'support', 'director', 'admin'].includes(role)

  const heroAside = (
    <div className="grid grid-cols-3 md:grid-cols-1 gap-2 md:min-w-[170px]">
      {[
        { l: 'стаж', v: yTotal != null ? `${yTotal} г.` : '—' },
        { l: 'учителски стаж', v: yTeacher != null ? `${yTeacher} г.` : '—', hide: !isPed },
        { l: 'ученици', v: String(studentCount), hide: !students },
      ].filter(x => !x.hide).map(x => (
        <div key={x.l} className="rounded-2xl bg-white/10 border border-white/10 px-3.5 py-2">
          <div className="text-lg font-semibold tabular-nums leading-tight">{x.v}</div>
          <div className="text-[11px] text-white/60">{x.l}</div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      <Hero name={getFullName(me)} initials={`${me.first_name?.charAt(0) || ''}${me.last_name?.charAt(0) || ''}`}
        photo={(me as any).photo_url} subtitle={[me.position || roleLabel, year?.name ? `учебна ${year.name} г.` : null].filter(Boolean).join(' · ')}
        badges={badges} email={me.email} phone={(me as any).phone} aside={heroAside} />
      <ProfileNav active={tab} role={role} />

      {tab === 'overview' && await Overview()}
      {tab === 'data' && <DataTab />}
      {tab === 'work' && await WorkTab()}
      {tab === 'growth' && await GrowthTab()}
      {tab === 'security' && <ProfileSecurity loginEmail={user.email || ''} workEmail={me.email || null} />}
    </div>
  )

  // ── Обзор ────────────────────────────────────────────────────────────────
  async function Overview() {
    const tasks = await loadTasks()
    const qTone = q.internal >= INTERNAL_MIN_YEAR ? 'green' : q.internal >= INTERNAL_MIN_YEAR / 2 ? 'amber' : 'rose'
    const attestTone = nextAttest && nextAttest < addYears(today, 1) ? 'amber' : 'slate'
    const membership = [
      ...classNames.map(n => ({ href: '/profile?tab=work', label: `Класен ръководител — ${n}`, icon: <BookOpen size={14} /> })),
      ...(students?.coudGroups || []).map(g => ({ href: '/profile?tab=work', label: `Група ЦОУД — ${g.name}`, icon: <Users size={14} /> })),
      ...(me.is_coordinator ? [{ href: '/admin/coordinating-team', label: 'Координиращ екип', icon: <Star size={14} /> }] : []),
      ...((council || []).length ? [{ href: '/bullying-council', label: 'Координационен съвет (тормоз)', icon: <Shield size={14} /> }] : []),
      ...((committees || []) as any[]).filter(c => c.committee).map(c => ({ href: `/committees/${c.committee.id}`, label: c.committee.name + (c.role ? ` · ${c.role}` : ''), icon: <Landmark size={14} /> })),
    ]

    const tiles = [
      { show: hasSchedule, href: scheduleHref, label: THER.includes(role) ? 'График на терапиите' : 'Моето разписание', hint: 'седмицата ми', icon: <CalendarClock size={18} />, tone: 'bg-sky-50 text-sky-700' },
      { show: THER.includes(role) || THER.includes(therapyRole || ''), href: '/my-activities', label: 'Списък за терапия', hint: 'деца и сесии', icon: <HeartPulse size={18} />, tone: 'bg-rose-50 text-rose-700' },
      { show: TEACH.includes(role), href: '/my-lecturer', label: 'Моите лекторски', hint: 'замествания, над норматив', icon: <GraduationCap size={18} />, tone: 'bg-indigo-50 text-indigo-700' },
      { show: true, href: '/calendar', label: 'Календар', hint: 'срокове, заседания, събития', icon: <CalendarDays size={18} />, tone: 'bg-teal-50 text-teal-700' },
      { show: true, href: '/evaluation', label: 'Оценяване', hint: 'ДТВ, атестиране, комисии', icon: <Award size={18} />, tone: 'bg-amber-50 text-amber-700' },
      { show: true, href: '/control', label: 'Констативни протоколи', hint: 'проверки и препоръки', icon: <ClipboardCheck size={18} />, tone: 'bg-orange-50 text-orange-700' },
      { show: true, href: '/meetings', label: 'ПС и Общо събрание', hint: 'дневен ред, решения', icon: <Landmark size={18} />, tone: 'bg-slate-100 text-slate-700' },
      { show: isPed, href: '/pro-portfolio', label: 'Професионално портфолио', hint: `${items.length} записа`, icon: <BookUser size={18} />, tone: 'bg-violet-50 text-violet-700' },
      { show: role !== 'support', href: '/portfolio', label: 'Портфолио (стена)', hint: 'снимки и публикации', icon: <Images size={18} />, tone: 'bg-fuchsia-50 text-fuchsia-700' },
      { show: true, href: '/my-files', label: 'Моите документи', hint: 'личната ми папка', icon: <FolderOpen size={18} />, tone: 'bg-emerald-50 text-emerald-700' },
    ].filter(t => t.show)

    return (
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Какво чака от мен" icon={<ListTodo size={16} />} pad={false}
            action={tasks.length > 0 ? <span className="text-[12px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">{tasks.length}</span> : undefined}>
            {tasks.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-6">
                <span className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 size={20} /></span>
                <div>
                  <div className="text-sm font-medium text-slate-700">Нищо не чака</div>
                  <div className="text-[12.5px] text-slate-400">Няма протоколи и карти за запознаване, препоръки или решения със срок.</div>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {tasks.map(t => {
                  const late = t.due && t.due < today
                  const tone = { rose: 'bg-rose-50 text-rose-600', amber: 'bg-amber-50 text-amber-600', sky: 'bg-sky-50 text-sky-600', violet: 'bg-violet-50 text-violet-600' }[t.tone]
                  return (
                    <li key={t.key}>
                      <Link href={t.href} className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>{t.icon}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13.5px] text-slate-800 truncate">{t.title}</span>
                          {t.meta && <span className="block text-[12px] text-slate-400 truncate">{t.meta}</span>}
                        </span>
                        {t.due && <span className={`text-[11.5px] px-2 py-0.5 rounded-full shrink-0 ${late ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{late ? 'просрочено ' : 'до '}{dmy(t.due)}</span>}
                        <ArrowRight size={15} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <div>
            <h2 className="text-[12px] uppercase tracking-[0.1em] text-slate-400 mb-2 px-1">Бърз достъп</h2>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {tiles.map(t => <Tile key={t.href} {...t} />)}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            {isPed && (
              <Stat label="Вътрешна квалификация тази година" value={<>{fmtNum(q.internal)} <span className="text-sm font-normal text-slate-400">/ {INTERNAL_MIN_YEAR} ч.</span></>}
                tone={qTone} progress={(q.internal / INTERNAL_MIN_YEAR) * 100} href="/pro-portfolio?tab=qual"
                hint={q.internal >= INTERNAL_MIN_YEAR ? 'изпълнен минимум' : `остават ${fmtNum(INTERNAL_MIN_YEAR - q.internal)} ч.`} />
            )}
            {isPed && (
              <Stat label="Следващо атестиране" value={nextAttest ? dmy(nextAttest) : '—'} tone={attestTone} href="/profile?tab=growth"
                hint={lastAttest ? `последно ${dmy(lastAttest)}` : 'няма данни за предишно атестиране'} />
            )}
            {students && <Stat label="Моите ученици" value={studentCount} href="/profile?tab=work" hint={classNames.length ? `класен на ${classNames.join(', ')}` : students.eplrStudents.length ? 'по ЕПЛР' : undefined} />}
            {isPed && <Stat label="Записи в портфолиото" value={items.length} href="/pro-portfolio" hint={pks ? `ПКС: ${pks}` : 'без ПКС'} />}
          </div>

          <Card title="Екипи и роли" icon={<Briefcase size={16} />} pad={false}>
            {membership.length === 0
              ? <p className="px-5 py-5 text-[13px] text-slate-400">Не участвате в комисии и екипи за тази година.</p>
              : (
                <ul className="divide-y divide-slate-50">
                  {membership.map(m => (
                    <li key={m.label}>
                      <Link href={m.href} className="flex items-center gap-2.5 px-5 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50">
                        <span className="text-slate-400">{m.icon}</span><span className="flex-1">{m.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </Card>

          {isPed && !profile?.education?.length && (
            <Link href="/pro-portfolio" className="flex items-start gap-3 rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/60 p-4 hover:bg-indigo-50">
              <Sparkles size={18} className="text-indigo-600 shrink-0 mt-0.5" />
              <span className="text-[13px] text-indigo-900">
                <b className="font-medium">Допълнете данните си</b> — образование, ПКС и стаж. Те влизат в атестационната карта (раздел А) и в портфолиото.
              </span>
            </Link>
          )}
        </div>
      </div>
    )
  }

  // Какво чака от мен: протоколи и карти за запознаване, препоръки, оценяване в комисия, решения на ПС
  async function loadTasks(): Promise<Task[]> {
    const [{ data: unacked }, { data: recs }, { data: commission }, { data: decisions }] = await Promise.all([
      supabase.from('control_check_staff').select('check:control_checks!inner(id, book_no, subject, status, check_date)').eq('staff_id', me.id).is('acked_at', null).eq('check.status', 'signed'),
      supabase.from('control_recommendations').select('id, text, due_date, status, check:control_checks!control_recommendations_check_id_fkey!inner(id, book_no, status)').eq('responsible_id', me.id).eq('check.status', 'signed').in('status', ['open', 'not_done']),
      supabase.from('eval_commission').select('campaign:eval_campaigns!inner(id, name, status, score_by)').eq('staff_id', me.id).eq('campaign.status', 'scoring'),
      supabase.from('mtg_decisions').select('id, text, due_date, task_status, meeting_id').eq('responsible_id', me.id).eq('outcome', 'adopted').eq('task_status', 'open'),
    ])
    const out: Task[] = []
    ;((unacked || []) as any[]).forEach(r => out.push({
      key: 'c' + r.check.id, href: `/control/${r.check.id}`, tone: 'amber', icon: <ClipboardCheck size={15} />,
      title: `Запознайте се с констативен протокол № ${r.check.book_no}`, meta: [dmy(r.check.check_date), r.check.subject].filter(Boolean).join(' · '),
    }))
    evals.filter(r => r.status === 'sent').forEach(r => out.push({
      key: 'e' + r.id, href: '/evaluation', tone: 'violet', icon: <Award size={15} />,
      title: 'Запознайте се с оценъчната си карта', meta: r.campaign?.name,
    }))
    ;((commission || []) as any[]).forEach(r => out.push({
      key: 'k' + r.campaign.id, href: `/evaluation/${r.campaign.id}`, tone: 'sky', icon: <Users size={15} />,
      title: 'Оценяване в комисия', meta: r.campaign.name, due: r.campaign.score_by,
    }))
    ;((recs || []) as any[]).forEach(r => out.push({
      key: 'r' + r.id, href: `/control/${r.check.id}`, tone: 'rose', icon: <AlertTriangle size={15} />,
      title: r.text, meta: `Препоръка от протокол № ${r.check.book_no}`, due: r.due_date,
    }))
    ;((decisions || []) as any[]).forEach(r => out.push({
      key: 'd' + r.id, href: `/meetings/${r.meeting_id}`, tone: 'sky', icon: <Landmark size={15} />,
      title: r.text || 'Решение за изпълнение', meta: 'Решение на заседание — аз съм отговорник', due: r.due_date,
    }))
    // първо просрочените и с най-близък срок
    return out.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
  }

  // ── Данни ────────────────────────────────────────────────────────────────
  function DataTab() {
    const n = profile?.neispuo || null
    const edit = isPed
      ? <Link href="/pro-portfolio" className="inline-flex items-center gap-1 text-[12.5px] text-indigo-700 hover:underline"><Pencil size={12} /> Редактирай</Link>
      : undefined
    return (
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Служебни данни" icon={<Building2 size={16} />}>
          <dl>
            <Row l="Име" v={getFullName(me)} />
            <Row l="Длъжност" v={me.position || n?.position || roleLabel} />
            <Row l="Роля в ЕИС" v={[roleLabel, therapyRole && therapyRole !== role ? ROLE_LABELS[therapyRole as UserRole] : null].filter(Boolean).join(' + ')} />
            <Row l="Служебен имейл" v={me.email} />
            <Row l="Телефон" v={(me as any).phone} />
            <Row l="Номер в НЕИСПУО" v={(me as any).neispuo_id} />
          </dl>
        </Card>

        <Card title="Стаж" icon={<Clock size={16} />} action={edit}>
          <dl>
            <Row l="Общ трудов стаж" v={yTotal != null ? `${yTotal} г.` : null} />
            {isPed && <Row l="Учителски стаж" v={yTeacher != null ? `${yTeacher} г.` : null} />}
            {n?.years_specialty != null && <Row l="Стаж по специалността" v={`${fmtNum(n.years_specialty)} г. (НЕИСПУО)`} />}
            {n?.since_year && <Row l="В ЦСОП от" v={`${n.since_year} г.`} />}
          </dl>
        </Card>

        {isPed && (
          <Card title="Образование и квалификация" icon={<School size={16} />} action={edit} className="lg:col-span-2">
            {profile?.education?.length ? (
              <ol className="relative border-l border-slate-200 ml-2 mb-4 space-y-4">
                {profile.education.map((e, i) => (
                  <li key={i} className="ml-4">
                    <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-[#2b5a8f]" />
                    <div className="text-[13.5px] font-medium text-slate-800">{[e.level, e.specialty].filter(Boolean).join(' — ')}</div>
                    <div className="text-[12.5px] text-slate-500">{[e.school, e.qualification ? `ПК: ${e.qualification}` : null, e.year].filter(Boolean).join(' · ')}</div>
                  </li>
                ))}
              </ol>
            ) : <p className="text-[13px] text-slate-400 mb-3">Няма въведено образование.</p>}
            <dl className="grid md:grid-cols-2 md:gap-x-8">
              <Row l="Специалност" v={profile?.specialty} />
              <Row l="ПК „учител“" v={profile?.teacher_q == null ? null : profile.teacher_q ? 'да' : 'не'} />
              <Row l="Друга квалификация" v={profile?.other_q} />
              <Row l="ПКС" v={pks ? `${pks}${profile?.pks_year ? ` (${profile.pks_year} г.)` : ''}` : null} />
              <Row l="Квалификационни кредити (период)" v={q.credits ? fmtNum(q.credits) : n?.credits != null ? `${fmtNum(n.credits)} (НЕИСПУО)` : null} />
            </dl>
          </Card>
        )}

        {n && (
          <Card title="От НЕИСПУО" icon={<Briefcase size={16} />} className="lg:col-span-2"
            action={<span className="text-[12px] text-slate-400">към {dmy(n.as_of)}</span>}>
            <dl className="grid md:grid-cols-2 md:gap-x-8">
              <Row l="Длъжност" v={n.position} />
              <Row l="Категория" v={n.category} />
              <Row l="Договор" v={[n.contract, n.contract_basis].filter(Boolean).join(', ')} />
              <Row l="Титуляр" v={n.titular} />
              <Row l="ЗНПР (мин. / инд.)" v={n.znpr_min != null || n.znpr_ind != null ? `${fmtNum(n.znpr_min) || '—'} / ${fmtNum(n.znpr_ind) || '—'}` : null} />
              <Row l="Часове общо" v={n.hours_total != null ? fmtNum(n.hours_total) : null} />
            </dl>
            <p className="text-[12px] text-slate-400 mt-3">Тези данни идват от последния импорт от НЕИСПУО (Администрация → Импорт от НЕИСПУО). Ако нещо не е вярно, кажете на ЗДАСД.</p>
          </Card>
        )}
      </div>
    )
  }

  // ── Класове и ученици ────────────────────────────────────────────────────
  async function WorkTab() {
    if (!students) return <p className="text-sm text-slate-400">Няма ученици за тази длъжност.</p>
    const isTeacher = !!TEACHER_NORM[role]
    const plan = isTeacher ? await loadCurriculum(supabase, year?.id, { staffId: me.id }) : null
    const planSchedule = plan?.lines.length ? await scheduleHoursByClass(supabase, year?.id, me.id) : undefined
    const { data: lp } = plan?.lines.length
      ? await supabase.from('lecturer_plans').select('ich_lecturer').eq('staff_id', me.id).eq('academic_year_id', year?.id).maybeSingle()
      : { data: null }
    const nothing = !students.classStudents.length && !students.eplrStudents.length && !students.coudStudents.length
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {students.classes.map(c => (
            <Link key={c.classId} href={`/classes/${c.classId}`} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 hover:border-slate-300">
              <BookOpen size={14} className="text-slate-400" /> Класен на <b className="font-semibold">{c.name}</b>
            </Link>
          ))}
          {hasSchedule && (
            <Link href={scheduleHref} className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium text-white bg-[#0f2240] hover:opacity-90">
              <CalendarClock size={14} /> {THER.includes(role) ? 'График на терапиите' : 'Моето разписание'}
            </Link>
          )}
        </div>

        {students.classStudents.length > 0 && (
          <StudentList title="Класен ръководител" icon={<BookOpen size={16} />}
            students={students.classStudents.map(e => ({ s: e.student, meta: students.classes.length > 1 ? e.className : undefined }))} />
        )}
        {students.eplrStudents.length > 0 && (
          <StudentList title="Ученици по ЕПЛР" icon={<HeartPulse size={16} />} students={students.eplrStudents.map(s => ({ s }))} />
        )}
        {students.coudGroups.length > 0 && (
          <StudentList title={`ЦОУД ${students.coudGroups.map(g => g.name).join(', ')}`} icon={<Users size={16} />}
            students={students.coudStudents.map(e => ({ s: e.student, meta: students.coudGroups.length > 1 ? students.coudGroups.find(g => g.id === e.groupId)?.name : undefined }))} />
        )}
        {nothing && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-400">Няма назначени ученици за {year?.name || 'текущата година'}.</div>
        )}
        {plan && plan.lines.length > 0 && (
          <CurriculumPlan mode="teacher" lines={plan.lines} importedAt={plan.importedAt} norm={TEACHER_NORM[role]} schedule={planSchedule} ichLect={Number((lp as any)?.ich_lecturer || 0)} />
        )}
      </div>
    )
  }

  // ── Оценяване и развитие ─────────────────────────────────────────────────
  async function GrowthTab() {
    const { data: decisions } = await supabase.from('mtg_decisions')
      .select('id, text, due_date, task_status, meeting_id').eq('responsible_id', me.id).eq('outcome', 'adopted')
      .order('due_date', { ascending: false, nullsFirst: false }).limit(30)
    const dec = (decisions || []) as any[]
    const DEC_LABEL: Record<string, string> = { open: 'за изпълнение', reported: 'отчетено', done: 'изпълнено', not_done: 'неизпълнено' }
    const DEC_TONE: Record<string, string> = { open: 'bg-sky-100 text-sky-700', reported: 'bg-amber-100 text-amber-700', done: 'bg-emerald-100 text-emerald-700', not_done: 'bg-rose-100 text-rose-700' }
    return (
      <div className="space-y-5">
        {isPed && (
          <div className="grid sm:grid-cols-3 gap-3">
            <Stat label="Последно атестиране" value={lastAttest ? dmy(lastAttest) : '—'} hint={nextAttest ? `следващо до ${dmy(nextAttest)}` : 'атестира се на 4 години'} />
            <Stat label="Вътрешна квалификация (година)" value={`${fmtNum(q.internal)} ч.`} progress={(q.internal / INTERNAL_MIN_YEAR) * 100}
              tone={q.internal >= INTERNAL_MIN_YEAR ? 'green' : 'amber'} hint={`минимум ${INTERNAL_MIN_YEAR} ч. годишно`} href="/pro-portfolio?tab=qual" />
            <Stat label="Външна квалификация (година)" value={`${fmtNum(q.extHours)} ч.`} hint={q.credits ? `${fmtNum(q.credits)} кредита` : 'кредити: —'} href="/pro-portfolio?tab=qual" />
          </div>
        )}
        <StaffEvalSection supabase={supabase} staffId={me.id} />
        <StaffControlSection supabase={supabase} staffId={me.id} />
        {dec.length > 0 && (
          <Card title="Решения на ПС и Общо събрание с мен за отговорник" icon={<Landmark size={16} />} pad={false}>
            <ul className="divide-y divide-slate-50">
              {dec.map(d => (
                <li key={d.id}>
                  <Link href={`/meetings/${d.meeting_id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
                    <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{d.text}</span>
                    {d.due_date && <span className="text-[12px] text-slate-400 tabular-nums">{dmy(d.due_date)}</span>}
                    <span className={`text-[11.5px] px-2 py-0.5 rounded-full ${DEC_TONE[d.task_status] || 'bg-slate-100 text-slate-600'}`}>{DEC_LABEL[d.task_status] || d.task_status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {isPed && <StaffPortfolioSection supabase={supabase} staffId={me.id} year={year} />}
        <div className="flex flex-wrap gap-2">
          <Link href="/evaluation" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-[13px] text-slate-700 hover:border-slate-300"><Award size={14} /> Всички мои оценъчни карти</Link>
          <Link href="/control" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-[13px] text-slate-700 hover:border-slate-300"><ClipboardCheck size={14} /> Констативни протоколи</Link>
          <Link href="/meetings" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-[13px] text-slate-700 hover:border-slate-300"><Landmark size={14} /> ПС и Общо събрание</Link>
        </div>
      </div>
    )
  }
}
