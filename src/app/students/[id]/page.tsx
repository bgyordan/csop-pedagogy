import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import OutreachBadge from '@/components/OutreachBadge'
import Link from 'next/link'
import { ArrowLeft, FileText, Users, ArrowRightLeft, Archive, UserCog, Pencil, School, Paperclip, History, Heart, CalendarClock, ClipboardList, Sparkles, FolderOpen, LayoutGrid, AlertTriangle, Phone, ChevronDown, ChevronRight, Bus, Utensils, Sprout } from 'lucide-react'
import { formatDate, getFullName } from '@/lib/utils'
import { DOCUMENT_TYPE_LABELS, DocumentType, STATUS_LABELS, DocumentStatus } from '@/types'
import { AttachmentsSection } from './AttachmentsSection'
import StudentWorkDocs from './StudentWorkDocs'
import DocumentsList from './DocumentsList'
import GuardiansSection from './GuardiansSection'
import StudentStatusSection from './StudentStatusSection'
import { GraduationCap, Home, Wifi } from 'lucide-react'
import { EplrDocumentsSection } from './EplrDocumentsSection'
import MarkProcessedButton from './MarkProcessedButton'
import IntakeCard from './IntakeCard'
import TherapistHistory from './TherapistHistory'
import StudentDocuments from './StudentDocuments'
import MoreMenu from './MoreMenu'
import DevelopmentTab from './development/DevelopmentTab'
const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  enrollment_application: 'Заявление за прием',
  coud_application: 'Заявление за ЦОУД',
  referral_order: 'Заповед за насочване',
  eplr_order: 'Заповед ЕПЛР (от училището)',
  rcpppo_assessment: 'Оценка от РЦПППО',
  medical_expertise: 'Медицинска експертиза',
  other: 'Друг документ',
}

function calculateAge(birthDate: string): string {
  const birth = new Date(birthDate)
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) { years--; months += 12 }
  if (months < 0) months += 12
  if (years === 0) return `${months} м.`
  if (months === 0) return `${years} г.`
  return `${years} г. ${months} м.`
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`
}

// Етикети на ЕПЛР документите (копие от EplrDocumentsSection — там е клиентски модул)
const EPLR_LABELS: Record<string, string> = {
  report_assessment: 'Доклад-оценка', protocol_1: 'Протокол №1', protocol_2: 'Протокол №2', protocol_3: 'Протокол №3',
  functional_map: 'Карта функционална оценка', support_plan: 'План за допълнителна подкрепа', iup_class: 'ИУП (клас)',
  iu_program_school: 'ИУ Програма (училище)', characteristic: 'Характеристика', other: 'Други',
}

const TABS = ['docs', 'overview', 'data', 'eplr', 'dev', 'therapy', 'files'] as const
type Tab = typeof TABS[number]

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab || '') ? (sp.tab as Tab) : 'docs'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: student } = await supabase
    .from('students')
    .select(`*,
      sending_school:sending_schools(name, city),
      therapist_psychologist:staff_profiles!students_therapist_psychologist_id_fkey(id, first_name, middle_name, last_name),
      therapist_speech:staff_profiles!students_therapist_speech_id_fkey(id, first_name, middle_name, last_name),
      therapist_rehab:staff_profiles!students_therapist_rehab_id_fkey(id, first_name, middle_name, last_name),
      therapist_rehab2:staff_profiles!students_therapist_rehab2_id_fkey(id, first_name, middle_name, last_name)
    `)
    .eq('id', id).single()

  if (!student) notFound()

  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role, is_coordinator').eq('user_id', user.id).single()
  const canManage = ['admin', 'zdud'].includes(profile?.role || '')
  const isCoordinator = profile?.is_coordinator === true

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  const { data: enrollment } = await supabase
    .from('student_enrollments').select('*, class:classes(*)')
    .eq('student_id', id).eq('academic_year_id', currentYear?.id).single()

  const { data: externalMembers } = await supabase
    .from('eplr_external_members').select('id, full_name')
    .eq('student_id', id).eq('academic_year_id', currentYear?.id).order('created_at')

  const { data: eplrDocs } = await supabase
    .from('eplr_attachments')
    .select('*')
    .eq('student_id', id)
    .eq('academic_year_id', currentYear?.id)
    .order('created_at', { ascending: false })

  const { data: eplr } = await supabase
    .from('eplr_teams').select(`*,
      psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(*),
      speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(*),
      rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(*),
      class_teacher:staff_profiles!eplr_teams_class_teacher_id_fkey(*)
    `).eq('student_id', id).eq('academic_year_id', currentYear?.id).single()

  const { data: documents } = await supabase
    .from('documents').select('*').eq('student_id', id).eq('academic_year_id', currentYear?.id)

  const { data: attachments } = await supabase
    .from('student_attachments').select('*').eq('student_id', id).order('created_at', { ascending: false })

  const { data: allEnrollments } = await supabase
    .from('student_enrollments').select('*, class:classes(*), academic_year:academic_years(*)')
    .eq('student_id', id).order('enrolled_at', { ascending: false })

  const { data: guardians } = await supabase
    .from('student_guardians').select('*').eq('student_id', id).order('relation')

  const { data: oresRecords } = await supabase
    .from('student_ores').select('*').eq('student_id', id).order('from_date', { ascending: false })

  const today = new Date().toISOString().split('T')[0]
  const activeOres = (oresRecords || []).find(o => o.from_date <= today && (!o.to_date || o.to_date >= today))
  
  let canEditDossier = canManage || profile?.role === 'secretary'
  if (!canManage && profile?.role === 'class_teacher' && enrollment?.class_id) {
    const { data: myClasses } = await supabase
      .from('class_teacher_assignments').select('class_id')
      .eq('staff_id', profile.id).eq('academic_year_id', currentYear?.id)
    canEditDossier = (myClasses || []).some(c => c.class_id === enrollment.class_id)
  }

  // Кой може да маха маркера "нов": админ, ЗДУД, координатор, класен (на своята паралелка)
  const canMarkProcessed = canManage || isCoordinator || canEditDossier
  const educationForm = (enrollment as any)?.education_form || 'daily'
  // анкетата остава достъпна и след „Вече не е нов“
  const { data: surveyRow } = await supabase.from('student_surveys').select('status').eq('student_id', id).limit(1).maybeSingle()
  const hasSurvey = !!surveyRow
  const { data: coudEnroll } = await supabase
    .from('coud_enrollments')
    .select('coud_group:coud_groups(name, teacher:staff_profiles(first_name, last_name))')
    .eq('student_id', id).eq('academic_year_id', currentYear?.id).maybeSingle()
  const coudGroup = (coudEnroll as any)?.coud_group || null
  const coudEnrolled = !!coudGroup
  const coudGroupName = coudGroup?.name || null
  const coudTeacher = coudGroup?.teacher ? `${coudGroup.teacher.first_name} ${coudGroup.teacher.last_name}` : null
  const currentYearName = currentYear?.name || ''
  const baseYear = currentYearName ? parseInt(currentYearName.split('/')[0]) : new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => `${baseYear + i}/${baseYear + i + 1}`)
  const docMap = Object.fromEntries(documents?.map(d => [d.doc_type, d]) || [])
  const sendingSchool = student.sending_school as any
  const className = (enrollment?.class as any)?.name || ''
  // Класният ръководител на паралелката (за хедъра)
  const { data: ctRows } = enrollment?.class_id
    ? await supabase.from('class_teacher_assignments')
        .select('staff:staff_profiles(id, first_name, last_name, is_active)')
        .eq('class_id', enrollment.class_id).eq('academic_year_id', currentYear?.id)
    : { data: [] as any[] }
  const classTeachers = (ctRows || []).map((r: any) => r.staff).filter((t: any) => t && t.is_active !== false)
  const age = student.birth_date ? calculateAge(student.birth_date) : null
  
  // Документи със срок (РЦПППО, ТЕЛК, алергии) — за „Внимание“ и обзора
  const { data: sDocs } = await supabase
    .from('student_documents').select('doc_type, valid_until, note, doc_number, issued_on, diagnosis').eq('student_id', id)
  const sDoc = Object.fromEntries((sDocs || []).map((d: any) => [d.doc_type, d])) as Record<string, any>
  const daysTo = (d?: string | null) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 864e5) : null
  type Alert = { level: 'red' | 'amber' | 'info'; text: string; tab: Tab; icon: any }
  const alerts: Alert[] = []
  if (sDoc.allergy) alerts.push({ level: 'red', icon: Utensils, tab: 'data', text: `Алергии / специално хранене${sDoc.allergy.note ? `: ${sDoc.allergy.note}` : ''}` })
  for (const [k, lbl] of [['rcpppo', 'Заповед РЦПППО'], ['telk', 'ТЕЛК']] as const) {
    const d = daysTo(sDoc[k]?.valid_until)
    if (d !== null && d < 0) alerts.push({ level: 'red', icon: AlertTriangle, tab: 'data', text: `${lbl} — изтекла на ${formatDate(sDoc[k].valid_until)}` })
    else if (d !== null && d <= 30) alerts.push({ level: 'amber', icon: CalendarClock, tab: 'data', text: `${lbl} — изтича след ${d} дни` })
  }
  if (student.status === 'active' && !eplr) alerts.push({ level: 'amber', icon: Users, tab: 'eplr', text: 'Няма назначен ЕПЛР екип' })
  if (activeOres) alerts.push({ level: 'info', icon: Sparkles, tab: 'data', text: `ОРЕС от ${formatDate(activeOres.from_date)}${activeOres.to_date ? ` до ${formatDate(activeOres.to_date)}` : ''}` })

  const tabHref = (t: Tab) => t === 'docs' ? `/students/${id}` : `/students/${id}?tab=${t}`

  const cardCls = "bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm h-full"
  const cardHead = "flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100"

  // „Развитие“ — за педагогическите роли (не за деловодител и помощен персонал)
  const showDev = !['secretary', 'support'].includes(profile?.role || '')
  const TAB_DEFS: { key: Tab; label: string; icon: any }[] = [
    { key: 'docs', label: 'Документи', icon: FolderOpen },
    { key: 'overview', label: 'Обзор', icon: LayoutGrid },
    { key: 'data', label: 'Данни', icon: ClipboardList },
    { key: 'eplr', label: 'ЕПЛР екип', icon: Users },
    ...(showDev ? [{ key: 'dev' as Tab, label: 'Развитие', icon: Sprout }] : []),
    { key: 'therapy', label: 'Терапия', icon: Heart },
    { key: 'files', label: 'Досие и файлове', icon: Paperclip },
  ]
  const alertCls = { red: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100', amber: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100', info: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' }
  const menuItem = 'flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-50'
  const metaSep = <span className="text-slate-300">·</span>
  const therapists = [
    { label: 'Психолог', m: (student as any).therapist_psychologist },
    { label: 'Логопед', m: (student as any).therapist_speech },
    { label: 'Рехабилитатор', m: (student as any).therapist_rehab },
    ...((student as any).therapist_rehab2 ? [{ label: 'Рехабилитатор (2)', m: (student as any).therapist_rehab2 }] : []),
  ]
  const overviewCard = (title: string, Icon: any, to: Tab | null, children: React.ReactNode) => (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} className="text-slate-400" />
        <h2 className="text-[11px] font-semibold text-[#0f2240] uppercase tracking-widest flex-1">{title}</h2>
        {to && <Link href={tabHref(to)} className="text-[11px] text-slate-500 hover:text-[#0f2240] inline-flex items-center gap-0.5">виж <ChevronRight size={12} /></Link>}
      </div>
      {children}
    </div>
  )
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm text-slate-800 text-right min-w-0 truncate">{value}</span>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors">
        <ArrowLeft size={15} /> Назад към учениците
      </Link>

      {/* ЛЕНТА С ДЕТЕТО — остава видима при скролване */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 pt-2 pb-3 bg-slate-50/95 backdrop-blur">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-4 md:px-5 py-3.5">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-medium flex-shrink-0"
              style={{ backgroundColor: '#0f2240' }}>
              {getInitials(student.first_name, student.last_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg md:text-xl font-normal text-[#0f2240] leading-tight">{getFullName(student)}</h1>
                {student.status !== 'active' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wider">Архивиран</span>}
                {(student as any).is_new && <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200"><Sparkles size={10} /> нов</span>}
                {(enrollment?.class as any)?.outreach_location && <OutreachBadge location={(enrollment?.class as any).outreach_location} />}
              </div>
              <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[13px] text-slate-600 mt-1">
                {age && <span>{age}</span>}
                {age && metaSep}
                <span>
                  {enrollment?.class_id && className
                    ? <Link href={`/classes/${enrollment.class_id}`} className="hover:text-[#0f2240] hover:underline">паралелка {className}</Link>
                    : (className ? `паралелка ${className}` : 'без паралелка')}
                  {classTeachers.length > 0 && <span className="text-slate-500"> (класен {classTeachers.map((t: any, i: number) => (
                    <span key={t.id}>{i > 0 && ', '}<Link href={`/staff/${t.id}`} className="hover:text-[#0f2240] hover:underline">{t.first_name} {t.last_name}</Link></span>
                  ))})</span>}
                </span>
                {metaSep}
                <span className="inline-flex items-center gap-1">{educationForm === 'ifo' ? <><Home size={12} /> ИФО</> : <><GraduationCap size={12} /> дневна</>}</span>
                {coudEnrolled && <>{metaSep}<span>{coudGroupName || 'ЦОУД'}</span></>}
                {sendingSchool && <>{metaSep}<span className="inline-flex items-center gap-1 min-w-0"><School size={12} className="flex-shrink-0 text-slate-400" /><span className="truncate max-w-[260px]">{sendingSchool.name}{student.external_class ? `, ${student.external_class}${(student as any).external_class_letter ? ` ${(student as any).external_class_letter}` : ''} клас` : ''}</span></span></>}
                {student.is_traveling && <>{metaSep}<span className="inline-flex items-center gap-1 text-amber-700"><Bus size={12} /> пътуващ</span></>}
              </div>
            </div>

            {/* Действия: Редактирай + Още ▾ */}
            {(canManage || canEditDossier || isCoordinator) && student.status === 'active' && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {canManage && (
                  <Link href={`/students/${id}/edit`} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0f2240] border border-slate-300 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <Pencil size={13} /> <span className="hidden sm:inline">Редактирай</span>
                  </Link>
                )}
                {(canManage || educationForm === 'ifo' || (student as any).is_new || hasSurvey) && <MoreMenu>
                    {canManage && <Link href={`/students/${id}/eplr`} className={menuItem}><UserCog size={14} /> ЕПЛР екип</Link>}
                    {educationForm === 'ifo' && <Link href={`/students/${id}/schedule`} className={menuItem}><CalendarClock size={14} /> Седмично разписание</Link>}
                    {((student as any).is_new || hasSurvey) && <Link href={`/students/${id}/survey`} className={menuItem}><ClipboardList size={14} /> Анкета</Link>}
                    {(student as any).is_new && canMarkProcessed && <div className="px-1.5 py-1"><MarkProcessedButton studentId={id} /></div>}
                    {canManage && <Link href={`/students/${id}/transfer`} className={menuItem}><ArrowRightLeft size={14} /> Прехвърли</Link>}
                    {canManage && <div className="my-1 border-t border-slate-100" />}
                    {canManage && <Link href={`/students/${id}/archive`} className={`${menuItem} !text-rose-700 hover:!bg-rose-50`}><Archive size={14} /> Архивирай</Link>}
                  </MoreMenu>}
              </div>
            )}
          </div>

          {/* ВНИМАНИЕ — важното отгоре, клик води до мястото */}
          {alerts.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t border-slate-100">
              {alerts.map((a, i) => (
                <Link key={i} href={tabHref(a.tab)}
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors max-w-full ${alertCls[a.level]}`}>
                  <a.icon size={13} className="flex-shrink-0" /> <span className="truncate">{a.text}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ТАБОВЕ — помнят се в адреса */}
        <div className="flex flex-wrap gap-1 p-1 mt-3 bg-slate-100 rounded-xl w-fit">
          {TAB_DEFS.map(t => (
            <Link key={t.key} href={tabHref(t.key)} scroll={false}
              className={`px-3.5 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
                tab === t.key ? 'bg-white text-[#0f2240] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <t.icon size={15} /> {t.label}
            </Link>
          ))}
        </div>
      </div>

      {student.status === 'archived' && student.archive_reason && (
        <div className="my-4 p-4 bg-amber-50/40 border border-amber-200/60 rounded-2xl text-sm text-slate-700 shadow-sm">
          <span className="font-medium text-amber-800">Причина за напускане:</span> {student.archive_reason}
          {student.archived_at && <span className="ml-3 text-slate-400">({formatDate(student.archived_at)})</span>}
        </div>
      )}

      <div className="mt-4">
        {/* Нов ученик — картата за прием стои над всеки таб, както преди */}
        {(student as any).is_new && student.status === 'active' && (
          <div className="mb-4">
            <IntakeCard student={student} enrollment={enrollment} guardiansCount={(guardians || []).length}
              eplr={eplr} coudEnrolled={coudEnrolled} canManage={canManage} />
          </div>
        )}

        {/* ОБЗОР — бърз поглед; всяка карта води към своя таб */}
        {tab === 'overview' && (
          <div className="animate-in fade-in duration-300 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              {overviewCard('Обучение', GraduationCap, 'data', <div>
                {row('Паралелка', className || '—')}
                {row('Форма', educationForm === 'ifo' ? 'Индивидуална (ИФО)' : 'Дневна')}
                {row('ЦОУД', coudEnrolled ? `${coudGroupName || 'да'}${coudTeacher ? ` · ${coudTeacher}` : ''}` : 'не')}
                {row('Училище', sendingSchool?.name || '—')}
                {row('Роден(а)', student.birth_date ? formatDate(student.birth_date) : '—')}
              </div>)}

              {overviewCard('Родители', Phone, 'data', (guardians || []).length === 0
                ? <p className="text-sm text-slate-400">Няма записани родители.</p>
                : <div>{(guardians || []).map((g: any) => (
                    <div key={g.id} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
                      <span className="text-sm text-slate-800 truncate">{g.full_name} <span className="text-xs text-slate-400">{g.relation}</span></span>
                      {g.phone ? <a href={`tel:${String(g.phone).replace(/\s/g, '')}`} className="text-sm text-[#0f2240] tabular-nums whitespace-nowrap hover:underline">{g.phone}</a> : <span className="text-xs text-slate-300">—</span>}
                    </div>
                  ))}</div>)}

              {overviewCard('Срокове', CalendarClock, 'data', <div>
                {[['rcpppo', 'Заповед РЦПППО'], ['telk', 'ТЕЛК'], ['allergy', 'Алергии / хранене']].map(([k, lbl]) => {
                  const d = sDoc[k]; const left = daysTo(d?.valid_until)
                  return <div key={k}>{row(lbl, !d ? <span className="text-slate-300">няма</span>
                    : k === 'allergy' ? <span className="text-rose-700">{d.note || 'да'}</span>
                    : !d.valid_until ? 'безсрочен'
                    : <span className={left! < 0 ? 'text-rose-700' : left! <= 30 ? 'text-amber-700' : 'text-slate-800'}>до {formatDate(d.valid_until)}</span>)}</div>
                })}
              </div>)}

              {overviewCard('ЕПЛР екип', Users, 'eplr', !eplr
                ? <p className="text-sm text-slate-400">Няма назначен екип.</p>
                : <div>
                    {row('Психолог', eplr.psychologist ? getFullName(eplr.psychologist) : '—')}
                    {row('Логопед', eplr.speech_therapist ? getFullName(eplr.speech_therapist) : '—')}
                    {row('Рехабилитатор', eplr.rehabilitator ? getFullName(eplr.rehabilitator) : '—')}
                    {row('Класен р-л', eplr.class_teacher ? getFullName(eplr.class_teacher) : '—')}
                  </div>)}

              {overviewCard('Терапевти', Heart, 'therapy', <div>
                {therapists.map(t => <div key={t.label}>{row(t.label, t.m ? getFullName(t.m) : <span className="text-slate-300">не е зачислен</span>)}</div>)}
              </div>)}

              {overviewCard('Документи ЕПЛР', FileText, 'eplr', (eplrDocs || []).length === 0
                ? <p className="text-sm text-slate-400">Няма качени за {currentYearName}.</p>
                : <div>{(eplrDocs || []).slice(0, 4).map((d: any) => (
                    <div key={d.id} className="py-1.5 border-b border-slate-100 last:border-0 text-sm text-slate-800 truncate">{EPLR_LABELS[d.doc_type] || d.file_name || d.doc_type}</div>
                  ))}{(eplrDocs || []).length > 4 && <p className="text-xs text-slate-400 pt-1.5">и още {(eplrDocs || []).length - 4}</p>}</div>)}
            </div>
          </div>
        )}

        {/* ДОКУМЕНТИ (Google Drive, като в Teams) */}
        {tab === 'docs' && (
          <div className="animate-in fade-in duration-300">
            <StudentWorkDocs studentId={id} />
          </div>
        )}

        {/* ДАННИ */}
        {tab === 'data' && (
          <div className="animate-in fade-in duration-300">

          <div className={`${cardCls} !h-auto mb-4`}>
            <div className={cardHead}>
              <GraduationCap size={16} className="text-blue-500" />
              <h2 className="font-semibold text-slate-800 text-sm">Обучение</h2>
            </div>
            <StudentStatusSection
              studentId={id}
              enrollmentId={enrollment?.id || null}
              educationForm={educationForm}
              coudEnrolled={coudEnrolled}
              coudGroupName={coudGroupName}
              coudTeacher={coudTeacher}
              externalClass={student.external_class}
              oresRecords={oresRecords || []}
              intensity={(student as any).intensity}
                           canManage={canManage}
            />
          </div>

          <div className={`${cardCls} !h-auto mb-4`}>
            <div className={cardHead}>
              <CalendarClock size={16} className="text-amber-500" />
              <h2 className="font-semibold text-slate-800 text-sm">Документи и срокове</h2>
            </div>
            <StudentDocuments studentId={id} canManage={canEditDossier} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className={cardCls}>
              <div className={cardHead}>
                <Heart size={16} className="text-rose-400" />
                <h2 className="font-semibold text-slate-800 text-sm">Родители / Настойници</h2>
              </div>
              <GuardiansSection studentId={id} guardians={guardians || []} canManage={canEditDossier} />
            </div>
            
            <div className={cardCls}>
              <div className={cardHead}>
                <History size={16} className="text-indigo-400" />
                <h2 className="font-semibold text-slate-800 text-sm">История на обучението</h2>
              </div>
              {allEnrollments && allEnrollments.length > 1 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {allEnrollments.map(e => {
                    const yr = e.academic_year as any
                    const cls = e.class as any
                    const isCurrent = yr?.id === currentYear?.id
                    return (
                      <span key={e.id} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg ${isCurrent ? 'bg-blue-50 text-blue-700 font-semibold' : 'bg-slate-50 text-slate-500'}`}>
                        {yr?.name || '—'} · Паралелка {cls?.name || '—'}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Само текущата година</p>
              )}
            </div>
          </div>
          </div>
        )}

        {/* ЕПЛР */}
        {tab === 'eplr' && (
          <div className="animate-in fade-in duration-300">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div className={cardCls}>
              <div className={cardHead}>
                <Users size={16} className="text-blue-500" />
                <h2 className="font-semibold text-slate-800 text-sm">ЕПЛР екип</h2>
              </div>
              <EplrTeam externals={externalMembers || []} eplr={eplr} id={id} canManage={canManage}
                realPsy={(student as any).therapist_psychologist_id}
                realSpe={(student as any).therapist_speech_id}
                realReh={(student as any).therapist_rehab_id}
                realReh2={(student as any).therapist_rehab2_id} />
            </div>
            <div className={`${cardCls} lg:col-span-2`}>
              <div className={cardHead}>
                <FileText size={16} className="text-emerald-500" />
                <h2 className="font-semibold text-slate-800 text-sm">Документи ЕПЛР — {currentYear?.name}</h2>
              </div>
              <EplrDocumentsSection
                studentId={student.id}
                academicYearId={currentYear?.id || ''}
                documents={eplrDocs || []}
                canManage={canManage || canEditDossier}
                staffId={profile?.id || ''}
              />
            </div>
          </div>
          </div>
        )}

        {/* РАЗВИТИЕ */}
        {tab === 'dev' && showDev && (
          <div className="animate-in fade-in duration-300">
            <DevelopmentTab studentId={id} studentName={getFullName(student as any)} className={(enrollment as any)?.class?.name || ''}
              academicYearId={currentYear?.id || null} meId={profile?.id || ''} role={profile?.role || ''} isCoordinator={isCoordinator} />
          </div>
        )}

        {/* ТЕРАПИЯ */}
        {tab === 'therapy' && (
          <div className="animate-in fade-in duration-300">

          <div className="max-w-md">
            <div className={cardCls}>
              <div className={cardHead}>
                <Heart size={16} className="text-teal-500" />
                <h2 className="font-semibold text-slate-800 text-sm">Терапевти</h2>
              </div>
              <dl className="space-y-2.5">
                {[
                  { label: 'Психолог', member: (student as any).therapist_psychologist },
                  { label: 'Логопед', member: (student as any).therapist_speech },
                  { label: 'Рехабилитатор', member: (student as any).therapist_rehab },
                  // второ място — показва се само ако е попълнено
                  ...((student as any).therapist_rehab2 ? [{ label: 'Рехабилитатор (2)', member: (student as any).therapist_rehab2 }] : []),
                ].map(({ label, member }) => (
                  <div key={label}>
                    <dt className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</dt>
                    <dd className="text-sm font-medium text-slate-700 mt-0.5">
                      {member ? getFullName(member) : <span className="text-slate-400 font-normal">не е зачислен</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <TherapistHistory studentId={id} />
          </div>
          </div>
        )}

        {/* ДОСИЕ И ФАЙЛОВЕ */}
        {tab === 'files' && (
          <div className="animate-in fade-in duration-300">

          <div className={`${cardCls} !h-auto`}>
            <div className={cardHead}>
              <Paperclip size={16} className="text-amber-500" />
              <h2 className="font-semibold text-slate-800 text-sm">Досие — външни документи</h2>
            </div>
            <AttachmentsSection
              studentId={id}
              attachments={attachments || []}
              canManage={canEditDossier}
              staffId={profile?.id || ''}
              typeLabels={ATTACHMENT_TYPE_LABELS}
              currentYearName={currentYearName}
              yearOptions={yearOptions}
            />
          </div>
          </div>
        )}
      </div>
    </div>
  )
}

function EplrTeam({ eplr, id, canManage, externals = [], realPsy, realSpe, realReh, realReh2 }: { eplr: any, id: string, canManage: boolean, externals?: any[], realPsy?: string, realSpe?: string, realReh?: string, realReh2?: string }) {
  if (!eplr) return (
    <div>
      <p className="text-sm text-slate-400 mb-3">Няма назначен екип</p>
      {canManage && (
        <Link href={`/students/${id}/eplr`} className="text-xs font-semibold text-blue-600 hover:underline">+ Назначи екип</Link>
      )}
    </div>
  )
  return (
    <dl className="space-y-2.5">
      {[
        { label: 'Психолог', member: eplr.psychologist, isReal: eplr.psychologist && realPsy === eplr.psychologist.id },
        { label: 'Логопед', member: eplr.speech_therapist, isReal: eplr.speech_therapist && realSpe === eplr.speech_therapist.id },
        { label: 'Рехабилитатор', member: eplr.rehabilitator, isReal: eplr.rehabilitator && (realReh === eplr.rehabilitator.id || realReh2 === eplr.rehabilitator.id) },
        { label: 'Класен р-л', member: eplr.class_teacher, isReal: false },
      ].map(({ label, member, isReal }) => (
        <div key={label}>
          <dt className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</dt>
          <dd className={`text-sm mt-0.5 ${member ? (isReal ? 'font-semibold text-slate-800' : 'font-normal text-slate-600') : ''}`}>
            {member ? (
              <span className="inline-flex items-center gap-1.5">
                {getFullName(member as any)}
               </span>
            ) : <span className="text-slate-400 font-normal">—</span>}
          </dd>
        </div>
      ))}
      {externals.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <dt className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">От изпращащото училище</dt>
          {externals.map((ext: any) => (
            <dd key={ext.id} className="text-sm font-medium text-slate-700 mt-0.5">{ext.full_name}</dd>
          ))}
        </div>
      )}
    </dl>
  )
}
