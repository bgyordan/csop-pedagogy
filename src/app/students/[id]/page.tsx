import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import OutreachBadge from '@/components/OutreachBadge'
import Link from 'next/link'
import { ArrowLeft, FileText, Users, ArrowRightLeft, Archive, UserCog, Pencil, School, Paperclip, History, Heart, CalendarClock, ClipboardList, Sparkles, FolderOpen, LayoutGrid, AlertTriangle, Phone, ChevronDown, ChevronRight, Bus, Utensils, Sprout, Mail, IdCard, MonitorSmartphone, MessagesSquare, Calculator, Target } from 'lucide-react'
import { formatDate, getFullName } from '@/lib/utils'
import { DOCUMENT_TYPE_LABELS, DocumentType, STATUS_LABELS, DocumentStatus } from '@/types'
import { AttachmentsSection } from './AttachmentsSection'
import StudentWorkDocs from './StudentWorkDocs'
import GuardiansSection from './GuardiansSection'
import StudentPersonalCard from './StudentPersonalCard'
import StudentStatusSection from './StudentStatusSection'
import { GraduationCap, Home, Wifi } from 'lucide-react'
import { EplrDocumentsSection } from './EplrDocumentsSection'
import MarkProcessedButton from './MarkProcessedButton'
import IntakeCard from './IntakeCard'
import TherapistHistory from './TherapistHistory'
import StudentDocuments from './StudentDocuments'
import MoreMenu from './MoreMenu'
import DeleteStudentButton from './DeleteStudentButton'
import DevelopmentTab from './development/DevelopmentTab'
import PassportTab from './passport/PassportTab'
import OnlineRoomTab from './room/OnlineRoomTab'
import PecsTab from './pecs/PecsTab'
import RemelkaTab from './remelka/RemelkaTab'
import AbaTab from './aba/AbaTab'
import StudentNav, { type NavKid } from './StudentNav'
import StudentIncidents from './StudentIncidents'
import StudentAbsencesCard from './StudentAbsencesCard'
import FillEplrButton from './FillEplrButton'
import { isOresActive, todaySofia, ORES_ACTIVE_COLS } from '@/lib/ores'

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

// Досие: Документи (Drive — по подразбиране, ползват го най-много) · Обзор · Паспорт · Данни (вкл. външните документи) · Екип · Развитие
// (старите адреси ?tab=eplr/therapy/files водят към новите)
const TABS = ['docs', 'overview', 'room', 'passport', 'pecs', 'remelka', 'aba', 'data', 'team', 'dev'] as const
type Tab = typeof TABS[number]
const LEGACY_TAB: Record<string, Tab> = { eplr: 'team', therapy: 'team', files: 'docs' }

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; view?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab || '') ? (sp.tab as Tab) : (LEGACY_TAB[sp.tab || ''] || 'docs')
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
    .order('created_at', { ascending: false })

  const { data: eplr } = await supabase
    .from('eplr_teams').select(`*,
      psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(*),
      speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(*),
      rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(*),
      class_teacher:staff_profiles!eplr_teams_class_teacher_id_fkey(*)
    `).eq('student_id', id).eq('academic_year_id', currentYear?.id).single()

  const { data: attachments } = await supabase
    .from('student_attachments').select('*').eq('student_id', id).order('created_at', { ascending: false })

  const { data: allEnrollments } = await supabase
    .from('student_enrollments').select('*, class:classes(*), academic_year:academic_years(*)')
    .eq('student_id', id).order('enrolled_at', { ascending: false })

  const { data: guardians } = await supabase
    .from('student_guardians').select('*').eq('student_id', id).order('relation')

  const { data: oresRecords } = await supabase
    .from('student_ores').select('*').eq('student_id', id).order('from_date', { ascending: false })

  const activeOres = (oresRecords || []).find(o => isOresActive(o as any))
  
  // Класният ръководител на паралелката на детето (за текущата година)
  let isMyClass = false
  if (profile?.id && enrollment?.class_id) {
    const { data: myClasses } = await supabase
      .from('class_teacher_assignments').select('class_id')
      .eq('staff_id', profile.id).eq('academic_year_id', currentYear?.id)
    isMyClass = (myClasses || []).some(c => c.class_id === enrollment.class_id)
  }
  // Данни, родители, срокове, файлове: управата, деловодството и класният на паралелката
  const canEditDossier = canManage || profile?.role === 'secretary' || isMyClass
  // ЕПЛР екип: управата (и директорът), координаторът и класният на паралелката
  const canEditTeam = canManage || profile?.role === 'director' || isCoordinator || isMyClass
  // Терапевтите (кой реално работи с детето) — от „Терапевти“ (управата и координаторът)
  const canEditTherapists = canManage || profile?.role === 'director' || isCoordinator

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

  // ── Бърз преход между децата: „моят“ списък според ролята ──
  //   терапевт → децата ми (ЕПЛР екип + терапия) · възпитател → ЦОУД групите ми · останалите → паралелката на детето
  const role = profile?.role || ''
  const isTherapist = ['psychologist', 'speech_therapist', 'rehabilitator'].includes(role) && !isCoordinator
  const isEducator = role === 'educator' && !isCoordinator
  let navIds: string[] = []
  let navLabel = ''
  if (profile?.id && isTherapist) {
    const roleField = role === 'psychologist' ? 'psychologist_id' : role === 'speech_therapist' ? 'speech_therapist_id' : 'rehabilitator_id'
    const me = profile.id
    const [{ data: et }, { data: tk }] = await Promise.all([
      supabase.from('eplr_teams').select('student_id').eq(roleField, me).eq('academic_year_id', currentYear?.id),
      supabase.from('students').select('id').or(`therapist_psychologist_id.eq.${me},therapist_speech_id.eq.${me},therapist_rehab_id.eq.${me},therapist_rehab2_id.eq.${me}`),
    ])
    navIds = Array.from(new Set([...(et || []).map((r: any) => r.student_id), ...(tk || []).map((r: any) => r.id)]))
    navLabel = 'Моите деца'
  } else if (profile?.id && isEducator) {
    const { data: gs } = await supabase.from('coud_groups').select('id').eq('teacher_id', profile.id).eq('academic_year_id', currentYear?.id)
    const gIds = (gs || []).map((g: any) => g.id)
    const { data: ce } = gIds.length
      ? await supabase.from('coud_enrollments').select('student_id').in('coud_group_id', gIds).eq('academic_year_id', currentYear?.id)
      : { data: [] as any[] }
    navIds = (ce || []).map((r: any) => r.student_id)
    navLabel = 'ЦОУД'
  } else if (enrollment?.class_id) {
    const { data: mates } = await supabase.from('student_enrollments').select('student_id')
      .eq('class_id', enrollment.class_id).eq('academic_year_id', currentYear?.id)
    navIds = (mates || []).map((r: any) => r.student_id)
    navLabel = `Паралелка ${className}`
  }
  let navKids: NavKid[] = []
  if (navIds.length > 1) {
    const { data: ks } = await supabase.from('students').select('id, first_name, middle_name, last_name, status').in('id', navIds)
    navKids = (ks || []).filter((k: any) => k.status === 'active' || k.id === id)
      .map((k: any) => ({ id: k.id, name: getFullName(k) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
  }
  // Назад: терапевтът и възпитателят — към своя списък; останалите — към паралелката на детето
  const backHref = !isTherapist && !isEducator && enrollment?.class_id ? `/classes/${enrollment.class_id}` : '/students'
  const backLabel = !isTherapist && !isEducator && enrollment?.class_id && className ? `Паралелка ${className}` : (isTherapist ? 'Моите деца' : 'Ученици')
  
  // Документи със срок (РЦПППО, ТЕЛК/ЛКК, алергии) — за „Внимание“ и обзора
  const { data: sDocs } = await supabase
    .from('student_documents').select('*').eq('student_id', id)
  const sDoc = Object.fromEntries((sDocs || []).map((d: any) => [d.doc_type, d])) as Record<string, any>
  const daysTo = (d?: string | null) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 864e5) : null
  type Alert = { level: 'red' | 'amber' | 'info'; text: string; tab: Tab; icon: any }
  const alerts: Alert[] = []
  // алергии: известие само при „Има“ (или стар запис с текст); „Няма“ не тревожи
  {
    const a = sDoc.allergy
    const has = a && (a.allergy_status === 'has' || (!a.allergy_status && (a.note || '').trim()))
    if (has) {
      const what = [...(a.allergens || []), ...(!(a.allergens || []).length && a.note ? [a.note] : [])].join(', ')
      alerts.push({ level: 'red', icon: Utensils, tab: 'data', text: `Алергия / специално хранене${what ? `: ${what}` : ''}${a.emergency_med ? ' · има лекарство за спешна помощ' : ''}` })
    }
  }
  for (const [k, lbl] of [['rcpppo', 'Заповед РЦПППО'], ['telk', 'ТЕЛК/ЛКК']] as const) {
    const d = daysTo(sDoc[k]?.valid_until)
    if (d !== null && d < 0) alerts.push({ level: 'red', icon: AlertTriangle, tab: 'data', text: `${lbl} — изтекла на ${formatDate(sDoc[k].valid_until)}` })
    else if (d !== null && d <= 30) alerts.push({ level: 'amber', icon: CalendarClock, tab: 'data', text: `${lbl} — изтича след ${d} дни` })
  }
  if (student.status === 'active' && !eplr) alerts.push({ level: 'amber', icon: Users, tab: 'team', text: 'Няма назначен ЕПЛР екип' })
  // отсъства сега / до 7 дни (отразено от класния)
  {
    const t = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
    const h = new Date(Date.now() + 7 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
    const { data: abs } = await supabase.from('student_absences').select('date_from, date_to, reason').eq('student_id', id).gte('date_to', t).lte('date_from', h).order('date_from').limit(1)
    const a: any = abs?.[0]
    if (a) {
      const dm = (x: string) => x.split('-').reverse().slice(0, 2).join('.')
      const why = a.reason === 'medical' ? 'медицинска бележка' : a.reason === 'family' ? 'семейни причини' : 'друго'
      alerts.push({ level: 'info', icon: CalendarClock, tab: 'overview', text: a.date_from <= t ? `Отсъства до ${dm(a.date_to)} · ${why}` : `Ще отсъства ${dm(a.date_from)} – ${dm(a.date_to)} · ${why}` })
    }
  }
  if (activeOres) alerts.push({ level: 'info', icon: Sparkles, tab: !['secretary', 'support'].includes(profile?.role || '') ? 'room' : 'data', text: `ОРЕС от ${formatDate(activeOres.from_date)}${activeOres.to_date ? ` до ${formatDate(activeOres.to_date)}` : ''}` })

  const tabHref = (t: Tab) => t === 'docs' ? `/students/${id}` : `/students/${id}?tab=${t}`

  const cardCls = "bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm h-full"
  const cardHead = "flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100"

  // „Развитие“ — за педагогическите роли (не за деловодител и помощен персонал)
  const showDev = !['secretary', 'support'].includes(profile?.role || '')
  // „Паспорт“ — попълват го управата, координаторът, класният, ЕПЛР екипът и терапевтите на детето (същото пази и базата)
  const meId = profile?.id || ''
  const canEditPassport = canManage || profile?.role === 'director' || isCoordinator || isMyClass || (!!meId && (
    [eplr?.psychologist?.id, eplr?.speech_therapist?.id, eplr?.rehabilitator?.id, eplr?.class_teacher?.id].includes(meId)
    || [(student as any).therapist_psychologist?.id, (student as any).therapist_speech?.id, (student as any).therapist_rehab?.id, (student as any).therapist_rehab2?.id].includes(meId)))
  // „Онлайн стая“ — винаги за педагогическите роли: оттук се започва ОРЕС и се виждат минали периоди
  const showRoom = showDev
  const TAB_DEFS: { key: Tab; label: string; icon: any }[] = [
    { key: 'docs', label: 'Документи', icon: FolderOpen },
    { key: 'overview', label: 'Обзор', icon: LayoutGrid },
    ...(showRoom ? [{ key: 'room' as Tab, label: activeOres ? 'Онлайн стая ●' : 'Онлайн стая', icon: MonitorSmartphone }] : []),
    ...(showDev ? [{ key: 'passport' as Tab, label: 'Паспорт', icon: IdCard }] : []),
    ...(showDev ? [{ key: 'pecs' as Tab, label: 'PECS', icon: MessagesSquare }] : []),
    ...(showDev ? [{ key: 'remelka' as Tab, label: 'РЕМЕЛКА', icon: Calculator }] : []),
    ...(showDev ? [{ key: 'aba' as Tab, label: 'АБА', icon: Target }] : []),
    { key: 'data', label: 'Данни', icon: ClipboardList },
    { key: 'team', label: 'Екип', icon: Users },
    ...(showDev ? [{ key: 'dev' as Tab, label: 'Развитие', icon: Sprout }] : []),
  ]
  const alertCls = { red: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100', amber: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100', info: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' }
  const menuItem = 'flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-50'
  const metaSep = <span className="text-slate-300">·</span>
  // Екип: терапевтите (кой реално работи с детето) и ЕПЛР екипът за годината — по специалност, едно до друго
  const st = student as any
  const nm = (m: any) => m ? getFullName(m) : ''
  const teamRows: { label: string; ther: any[]; eplr: any }[] = [
    { label: 'Психолог', ther: [st.therapist_psychologist].filter(Boolean), eplr: eplr?.psychologist },
    { label: 'Логопед', ther: [st.therapist_speech].filter(Boolean), eplr: eplr?.speech_therapist },
    { label: 'Рехабилитатор', ther: [st.therapist_rehab, st.therapist_rehab2].filter(Boolean), eplr: eplr?.rehabilitator },
  ]
  // разминаване: има терапевт, а в ЕПЛР екипа го няма (празно или друг човек)
  const differs = (r: typeof teamRows[number]) => r.ther.length > 0 && !r.ther.some((t: any) => t.id === r.eplr?.id)
  const teamDiffers = teamRows.some(differs)
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
      <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-4 flex-wrap">
        <Link href={backHref} className="inline-flex items-center gap-1.5 hover:text-slate-800 transition-colors">
          <ArrowLeft size={15} /> {backLabel}
        </Link>
        {backHref !== '/students' && <>
          <span className="text-slate-300">·</span>
          <Link href="/students" className="hover:text-slate-800 transition-colors">Всички ученици</Link>
        </>}
      </div>

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
              {/* Връзка с родителите — винаги пред очите */}
              {(guardians || []).some((g: any) => g.phone || g.email) && (
                <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[13px] mt-1.5">
                  {(guardians || []).filter((g: any) => g.phone || g.email).map((g: any) => (
                    <span key={g.id} className="inline-flex items-center gap-1.5">
                      <span className="text-slate-500">{g.relation ? g.relation.charAt(0).toUpperCase() + g.relation.slice(1) : 'Родител'}:</span>
                      {g.phone && <a href={`tel:${String(g.phone).replace(/\s/g, '')}`} className="inline-flex items-center gap-1 text-[#0f2240] font-medium tabular-nums hover:underline"><Phone size={12} />{g.phone}</a>}
                      {g.email && <a href={`mailto:${g.email}`} title={g.email} className="inline-flex items-center gap-1 text-sky-700 hover:underline"><Mail size={12} /><span className="hidden md:inline">{g.email}</span></a>}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Действия: Редактирай + Още ▾ */}
            {(canManage || canEditDossier || canEditTeam) && student.status === 'active' && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {canEditDossier && (
                  <Link href={tabHref('data')} scroll={false} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0f2240] border border-slate-300 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <Pencil size={13} /> <span className="hidden sm:inline">Данни</span>
                  </Link>
                )}
                {(canManage || canEditTeam || educationForm === 'ifo' || (student as any).is_new || hasSurvey) && <MoreMenu>
                    {canEditTeam && <Link href={`/students/${id}/eplr`} className={menuItem}><UserCog size={14} /> ЕПЛР екип</Link>}
                    {educationForm === 'ifo' && <Link href={`/students/${id}/schedule`} className={menuItem}><CalendarClock size={14} /> Седмично разписание</Link>}
                    {((student as any).is_new || hasSurvey) && <Link href={`/students/${id}/survey`} className={menuItem}><ClipboardList size={14} /> Анкета</Link>}
                    {(student as any).is_new && canMarkProcessed && <div className="px-1.5 py-1"><MarkProcessedButton studentId={id} /></div>}
                    {canManage && <Link href={`/students/${id}/transfer`} className={menuItem}><ArrowRightLeft size={14} /> Прехвърли</Link>}
                    {canManage && <div className="my-1 border-t border-slate-100" />}
                    {canManage && <Link href={`/students/${id}/archive`} className={`${menuItem} !text-rose-700 hover:!bg-rose-50`}><Archive size={14} /> Архивирай</Link>}
                    {profile?.role === 'admin' && <DeleteStudentButton studentId={id} fullName={getFullName(student)} lastName={(student as any).last_name || ''} />}
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

        {/* ТАБОВЕ — помнят се в адреса; вдясно — бърз преход към друго дете */}
        <div className="flex items-start justify-between gap-2 mt-3">
        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {TAB_DEFS.map(t => (
            <Link key={t.key} href={tabHref(t.key)} scroll={false}
              className={`px-3.5 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
                tab === t.key ? 'bg-white text-[#0f2240] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <t.icon size={15} /> {t.label}
            </Link>
          ))}
        </div>
        <StudentNav kids={navKids} currentId={id} label={navLabel} tab={tab !== 'docs' ? tab : undefined} />
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
                      <span className="flex flex-col items-end">
                        {g.phone ? <a href={`tel:${String(g.phone).replace(/\s/g, '')}`} className="text-sm text-[#0f2240] tabular-nums whitespace-nowrap hover:underline">{g.phone}</a> : <span className="text-xs text-slate-300">—</span>}
                        {g.email && <a href={`mailto:${g.email}`} className="text-xs text-sky-700 hover:underline truncate max-w-[200px]">{g.email}</a>}
                      </span>
                    </div>
                  ))}</div>)}

              {overviewCard('Срокове', CalendarClock, 'data', <div>
                {[['rcpppo', 'Заповед РЦПППО'], ['telk', 'ТЕЛК/ЛКК'], ['allergy', 'Алергии / хранене']].map(([k, lbl]) => {
                  const d = sDoc[k]; const left = daysTo(d?.valid_until)
                  return <div key={k}>{row(lbl, !d ? <span className="text-slate-300">няма</span>
                    : k === 'allergy' ? (d.allergy_status === 'none' ? <span className="text-emerald-700">няма</span>
                      : <span className="text-rose-700">{(d.allergens || []).join(', ') || d.note || 'има'}</span>)
                    : d.indefinite ? 'безсрочен'
                    : !d.valid_until ? <span className="text-slate-400">без въведен срок</span>
                    : <span className={left! < 0 ? 'text-rose-700' : left! <= 30 ? 'text-amber-700' : 'text-slate-800'}>до {formatDate(d.valid_until)}</span>)}</div>
                })}
              </div>)}

              {overviewCard('Екип', Users, 'team', <div>
                {teamRows.map(r => <div key={r.label}>{row(r.label, r.eplr || r.ther.length
                  ? <span className={differs(r) ? 'text-amber-700' : ''} title={differs(r) ? `Терапия: ${r.ther.map(nm).join(', ')}` : undefined}>{r.eplr ? nm(r.eplr) : <span className="text-slate-400">— (терапия: {r.ther.map(nm).join(', ')})</span>}</span>
                  : <span className="text-slate-300">—</span>)}</div>)}
                {row('Класен р-л', eplr?.class_teacher ? nm(eplr.class_teacher) : classTeachers.length ? classTeachers.map((t: any) => `${t.first_name} ${t.last_name}`).join(', ') : '—')}
                {!eplr && <p className="text-xs text-amber-700 pt-1.5">Няма ЕПЛР екип за {currentYearName}.</p>}
              </div>)}

            </div>
            {/* отсъствия по период (семейни / медицинска бележка) — отразява класният */}
            {showDev && <StudentAbsencesCard studentId={id} />}
            {/* случаи от „Дневник на случаите“ — само за съвета, ръководството и класния */}
            {showDev && <StudentIncidents studentId={id} />}
          </div>
        )}

        {/* ДОКУМЕНТИ — работните (Google Drive), ЕПЛР документите за годината и външните документи в досието */}
        {tab === 'docs' && (
          <div className="animate-in fade-in duration-300 space-y-4">
            <StudentWorkDocs studentId={id} />
            {/* Старите качени ЕПЛР документи — само за преглед; новите (и сканираните подписани) се качват в Drive горе */}
            {(eplrDocs || []).length > 0 && (
              <details className={`${cardCls} !h-auto`}>
                <summary className="cursor-pointer text-sm text-slate-600 select-none flex items-center gap-2">
                  <FileText size={15} className="text-slate-400" /> Стари качени ЕПЛР документи ({(eplrDocs || []).length})
                  <span className="text-[11px] text-slate-400">— само за преглед; новите се качват в документите горе</span>
                </summary>
                <div className="mt-3">
                  <EplrDocumentsSection studentId={student.id} academicYearId={currentYear?.id || ''} documents={eplrDocs || []}
                    canManage={false} staffId={profile?.id || ''} />
                </div>
              </details>
            )}
          </div>
        )}

        {/* ДАННИ */}
        {tab === 'data' && (
          <div className="animate-in fade-in duration-300">

          {/* Лични данни и родители — показват се и се редактират ТУК (бутон „Редактирай“ на всяка карта) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start mb-4">
            <div className={cardCls}>
              <StudentPersonalCard studentId={id}
                firstName={(student as any).first_name || ''} middleName={(student as any).middle_name || null} lastName={(student as any).last_name || ''}
                birthDate={student.birth_date || null}
                school={student.sending_school_id && sendingSchool ? { id: student.sending_school_id, name: sendingSchool.name, city: sendingSchool.city || null } : null}
                externalClass={student.external_class || null} externalClassLetter={(student as any).external_class_letter || null}
                isTraveling={!!student.is_traveling} canEdit={canEditDossier && student.status === 'active'} />
            </div>
            <div className={cardCls}>
              <div className={cardHead}>
                <Heart size={16} className="text-rose-400" />
                <h2 className="font-semibold text-slate-800 text-sm">Родители / Настойници</h2>
              </div>
              <GuardiansSection studentId={id} guardians={guardians || []} canManage={canEditDossier} />
            </div>
          </div>

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
            <StudentDocuments studentId={id} canManage={canEditDossier} externalClass={student.external_class} />
          </div>

          <div className={`${cardCls} !h-auto mb-4`}>
            <div className={cardHead}>
              <Paperclip size={16} className="text-amber-500" />
              <h2 className="font-semibold text-slate-800 text-sm">Досие — външни документи</h2>
              <span className="ml-auto text-[11px] text-slate-400">заявления, заповеди и оценки от РЦПППО, медицински…</span>
            </div>
            <AttachmentsSection studentId={id} attachments={attachments || []} canManage={canEditDossier} staffId={profile?.id || ''}
              typeLabels={ATTACHMENT_TYPE_LABELS} currentYearName={currentYearName} yearOptions={yearOptions} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
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

        {/* ЕКИП — терапевтите и ЕПЛР екипът едно до друго */}
        {tab === 'team' && (
          <div className="animate-in fade-in duration-300 space-y-4">
            <div className={`${cardCls} !h-auto`}>
              <div className={cardHead}>
                <Users size={16} className="text-blue-500" />
                <h2 className="font-semibold text-slate-800 text-sm">Екип на детето</h2>
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                  {canEditTeam && teamDiffers && <FillEplrButton studentId={id} />}
                  {canEditTeam && <Link href={`/students/${id}/eplr`} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-[#0f2240] hover:bg-slate-50"><UserCog size={13} /> ЕПЛР екип</Link>}
                  {canEditTherapists && <Link href="/admin/therapists" className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-[#0f2240] hover:bg-slate-50"><Heart size={13} /> Терапевти</Link>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-3 font-medium">Специалист</th>
                    <th className="py-2 pr-3 font-medium">Терапия <span className="normal-case tracking-normal font-normal text-slate-400">— работи с детето</span></th>
                    <th className="py-2 pr-3 font-medium">ЕПЛР екип {currentYearName} <span className="normal-case tracking-normal font-normal text-slate-400">— протоколи и подписи</span></th>
                  </tr></thead>
                  <tbody>
                    {teamRows.map(r => (
                      <tr key={r.label} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 text-slate-500">{r.label}</td>
                        <td className="py-2 pr-3 text-slate-800">{r.ther.length ? r.ther.map(nm).join(', ') : <span className="text-slate-400">не е зачислен</span>}</td>
                        <td className={`py-2 pr-3 ${differs(r) ? 'text-amber-700' : 'text-slate-800'}`}>
                          {r.eplr ? nm(r.eplr) : <span className={differs(r) ? '' : 'text-slate-400'}>—</span>}
                          {differs(r) && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200">различно от терапията</span>}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 text-slate-500">Класен р-л</td>
                      <td className="py-2 pr-3 text-slate-400">—</td>
                      <td className="py-2 pr-3 text-slate-800">{eplr?.class_teacher ? nm(eplr.class_teacher) : classTeachers.length ? classTeachers.map((t: any) => `${t.first_name} ${t.last_name}`).join(', ') : '—'}
                        <span className="ml-2 text-[11px] text-slate-400">следва паралелката</span></td>
                    </tr>
                    {(externalMembers || []).length > 0 && (
                      <tr><td className="py-2 pr-3 text-slate-500">От изпращащото училище</td><td className="py-2 pr-3 text-slate-400">—</td>
                        <td className="py-2 pr-3 text-slate-800">{(externalMembers || []).map((e: any) => e.full_name).join(', ')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {!eplr && <p className="mt-3 text-sm text-amber-700">Няма ЕПЛР екип за {currentYearName}.{canEditTeam ? ' Определете го с „ЕПЛР екип“ или го попълнете от терапевтите.' : ''}</p>}
              <p className="mt-3 text-[11.5px] text-slate-500 leading-relaxed">
                <b>Терапия</b> — кой реално работи с детето; зачислява се от „Терапевти“ (управата, координаторът) или от самия терапевт в „Списък за терапия“.
                {' '}<b>ЕПЛР екип</b> — официалният екип за учебната година (протоколи, подписи); определят го управата, координаторът и класният ръководител.
                {' '}Двете не се наливат автоматично едно в друго — при разлика ползвайте „Попълни ЕПЛР екипа от терапевтите“.
              </p>
            </div>
            <div className="max-w-xl"><TherapistHistory studentId={id} /></div>
          </div>
        )}

        {/* ОНЛАЙН СТАЯ — материали и указания за родителя по време на ОРЕС */}
        {tab === 'room' && showRoom && (
          <div className="animate-in fade-in duration-300">
            <OnlineRoomTab studentId={id} studentName={getFullName(student as any)} oresList={(oresRecords || []) as any}
              meId={meId} isManager={canManage || profile?.role === 'director'} canStart={canManage || profile?.role === 'director'} isAdmin={profile?.role === 'admin'} />
          </div>
        )}

        {/* ПАСПОРТ — една страница за заместници, ЦОУД и нови колеги */}
        {tab === 'passport' && showDev && (
          <div className="animate-in fade-in duration-300">
            <PassportTab studentId={id} meId={meId} canEdit={canEditPassport} />
          </div>
        )}

        {/* PECS — общуване чрез размяна на картинки */}
        {tab === 'pecs' && showDev && (
          <div className="animate-in fade-in duration-300">
            <PecsTab studentId={id} childName={getFullName(student as any)} firstName={(student as any).first_name || ''} meId={meId}
              isManager={canManage || profile?.role === 'director'} />
          </div>
        )}

        {/* РЕМЕЛКА — смятане и социални умения: диагностика → програма → занимания */}
        {tab === 'remelka' && showDev && (
          <div className="animate-in fade-in duration-300">
            <RemelkaTab studentId={id} firstName={(student as any).first_name || ''} meId={meId} isManager={canManage || profile?.role === 'director'} />
          </div>
        )}

        {/* АБА — ABC картон (поведение) и дискретни опити (умения) */}
        {tab === 'aba' && showDev && (
          <div className="animate-in fade-in duration-300">
            <AbaTab studentId={id} firstName={(student as any).first_name || ''} meId={meId} isManager={canManage || profile?.role === 'director'} />
          </div>
        )}

        {/* РАЗВИТИЕ */}
        {tab === 'dev' && showDev && (
          <div className="animate-in fade-in duration-300">
            <DevelopmentTab studentId={id} studentName={getFullName(student as any)} className={(enrollment as any)?.class?.name || ''}
              academicYearId={currentYear?.id || null} meId={profile?.id || ''} role={profile?.role || ''} isCoordinator={isCoordinator} initialView={sp.view} />
          </div>
        )}

      </div>
    </div>
  )
}
