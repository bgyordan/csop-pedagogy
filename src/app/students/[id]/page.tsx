import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Users, ArrowRightLeft, Archive, UserCog, Pencil, School, Paperclip, History, Check, Heart, CalendarClock, ClipboardList, Sparkles } from 'lucide-react'
import { formatDate, getFullName } from '@/lib/utils'
import { DOCUMENT_TYPE_LABELS, DocumentType, STATUS_LABELS, DocumentStatus } from '@/types'
import { AttachmentsSection } from './AttachmentsSection'
import DocumentsList from './DocumentsList'
import GuardiansSection from './GuardiansSection'
import StudentStatusSection from './StudentStatusSection'
import { GraduationCap, Home, Wifi } from 'lucide-react'
import { EplrDocumentsSection } from './EplrDocumentsSection'
import MarkProcessedButton from './MarkProcessedButton'
const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]
const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  enrollment_application: 'Заявление за прием',
  coud_application: 'Молба за ЦОУД',
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
export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: student } = await supabase
    .from('students')
    .select(`*,
      sending_school:sending_schools(name, city),
      therapist_psychologist:staff_profiles!students_therapist_psychologist_id_fkey(id, first_name, middle_name, last_name),
      therapist_speech:staff_profiles!students_therapist_speech_id_fkey(id, first_name, middle_name, last_name),
      therapist_rehab:staff_profiles!students_therapist_rehab_id_fkey(id, first_name, middle_name, last_name)
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
  const age = student.birth_date ? calculateAge(student.birth_date) : null
  const cardCls = "bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm"
  const cardHead = "flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100"
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Назад към учениците
      </Link>
      {/* ХЕДЪР */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6 mb-5">
        <div className="flex items-start gap-4 md:gap-5">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-bold flex-shrink-0 shadow-md shadow-blue-900/10"
            style={{ backgroundColor: '#0f2240' }}>
            {getInitials(student.first_name, student.last_name)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">{getFullName(student)}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                student.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
              }`}>
                {student.status === 'active' ? 'Активен' : 'Архивиран'}
              </span>
              {age && <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">{age}</span>}
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {educationForm === 'ifo' ? <><Home size={11} /> ИФО</> : <><GraduationCap size={11} /> Дневна</>}
              </span>
              {coudEnrolled && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{coudGroupName || 'ЦОУД'}</span>
              )}
              {activeOres && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <Wifi size={11} /> ОРЕС
                </span>
              )}
              {(student as any).is_new && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                  <Sparkles size={11} /> НОВ УЧЕНИК
                </span>
              )}
              
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Паралелка ЦСОП</div>
                <div className="text-sm font-semibold text-slate-700 mt-0.5">{className || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Дата на раждане</div>
                <div className="text-sm font-semibold text-slate-700 mt-0.5">{student.birth_date ? formatDate(student.birth_date) : '—'}</div>
              </div>
              {sendingSchool && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Изпращащо училище</div>
                  <div className="text-sm font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                    <School size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate">{sendingSchool.name}</span>
                  </div>
                </div>
              )}
              {student.external_class && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Клас в изпр. училище</div>
                  <div className="text-sm font-semibold text-slate-700 mt-0.5">{student.external_class}</div>
                </div>
              )}
            </div>
          </div>
        </div>
        {(canManage || canEditDossier || isCoordinator) && student.status === 'active' && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
            {canManage && (
              <Link href={`/students/${id}/edit`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors">
                <Pencil size={13} /> Редактирай
              </Link>
            )}
            {canManage && (
              <Link href={`/students/${id}/eplr`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors">
                <UserCog size={13} /> ЕПЛР екип
              </Link>
            )}
            {educationForm === 'ifo' && (
              <Link href={`/students/${id}/schedule`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl hover:bg-teal-100 transition-colors">
                <CalendarClock size={13} /> Седмично разписание
              </Link>
            )}
            {(student as any).is_new && (
              <Link href={`/students/${id}/survey`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-700 bg-violet-50 border border-violet-200 px-3 py-2 rounded-xl hover:bg-violet-100 transition-colors">
                <ClipboardList size={13} /> Анкета
              </Link>
            )}
            {(student as any).is_new && canMarkProcessed && (
              <MarkProcessedButton studentId={id} />
            )}
            {canManage && (
              <Link href={`/students/${id}/transfer`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors">
                <ArrowRightLeft size={13} /> Прехвърли
              </Link>
            )}
            {canManage && (
              <Link href={`/students/${id}/archive`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50/50 border border-rose-100 px-3 py-2 rounded-xl hover:bg-rose-100/70 transition-colors">
                <Archive size={13} /> Архивирай
              </Link>
            )}
          </div>
        )}
      </div>
      {student.status === 'archived' && student.archive_reason && (
        <div className="mb-5 p-4 bg-amber-50/40 border border-amber-200/60 rounded-2xl text-sm text-slate-700 shadow-sm">
          <span className="font-bold text-amber-800">Причина за напускане:</span> {student.archive_reason}
          {student.archived_at && <span className="ml-3 text-slate-400 font-medium">({formatDate(student.archived_at)})</span>}
        </div>
      )}

      {/* РЕД 1: ОБУЧЕНИЕ — цяла ширина, полетата хоризонтално вътре */}
      <div className={`${cardCls} mb-4`}>
        <div className={cardHead}>
          <GraduationCap size={16} className="text-blue-500" />
          <h2 className="font-bold text-slate-800 text-sm">Обучение</h2>
        </div>
        <StudentStatusSection
          studentId={id}
          enrollmentId={enrollment?.id || null}
          educationForm={educationForm}
          coudEnrolled={coudEnrolled}
          coudGroupName={coudGroupName}
          coudTeacher={coudTeacher}
          oresRecords={oresRecords || []}
          intensity={(student as any).intensity}
          canManage={canManage}
        />
      </div>

      {/* РЕД 2: ЕПЛР екип (тясна) + Документи ЕПЛР (широка) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 items-start">
        <div className={cardCls}>
          <div className={cardHead}>
            <Users size={16} className="text-blue-500" />
            <h2 className="font-bold text-slate-800 text-sm">ЕПЛР екип</h2>
          </div>
          <EplrTeam externals={externalMembers || []} eplr={eplr} id={id} canManage={canManage}
            realPsy={(student as any).therapist_psychologist_id}
            realSpe={(student as any).therapist_speech_id}
            realReh={(student as any).therapist_rehab_id} />
        </div>
        <div className={`${cardCls} lg:col-span-2`}>
          <div className={cardHead}>
            <FileText size={16} className="text-emerald-500" />
            <h2 className="font-bold text-slate-800 text-sm">Документи ЕПЛР — {currentYear?.name}</h2>
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

      {/* РЕД 3: Терапевти (тясна) + Досие външни документи (широка) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 items-start">
        <div className={cardCls}>
          <div className={cardHead}>
            <Heart size={16} className="text-teal-500" />
            <h2 className="font-bold text-slate-800 text-sm">Терапевти</h2>
          </div>
          <dl className="space-y-2.5">
            {[
              { label: 'Психолог', member: (student as any).therapist_psychologist },
              { label: 'Логопед', member: (student as any).therapist_speech },
              { label: 'Рехабилитатор', member: (student as any).therapist_rehab },
            ].map(({ label, member }) => (
              <div key={label}>
                <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</dt>
                <dd className="text-sm font-semibold text-slate-700 mt-0.5">
                  {member ? getFullName(member) : <span className="text-slate-400 font-normal">не е зачислен</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className={`${cardCls} lg:col-span-2`}>
          <div className={cardHead}>
            <Paperclip size={16} className="text-amber-500" />
            <h2 className="font-bold text-slate-800 text-sm">Досие — външни документи</h2>
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

      {/* РЕД 4: Родители (тясна) + История (широка, компактна) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className={cardCls}>
          <div className={cardHead}>
            <Heart size={16} className="text-rose-400" />
            <h2 className="font-bold text-slate-800 text-sm">Родители / Настойници</h2>
          </div>
          <GuardiansSection studentId={id} guardians={guardians || []} canManage={canEditDossier} />
        </div>
        <div className={`${cardCls} lg:col-span-2`}>
          <div className={cardHead}>
            <History size={16} className="text-indigo-400" />
            <h2 className="font-bold text-slate-800 text-sm">История на обучението</h2>
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
  )
}
function EplrTeam({ eplr, id, canManage, externals = [], realPsy, realSpe, realReh }: { eplr: any, id: string, canManage: boolean, externals?: any[], realPsy?: string, realSpe?: string, realReh?: string }) {
  if (!eplr) return (
    <div>
      <p className="text-sm text-slate-400 mb-3">Няма назначен екип</p>
      {canManage && (
        <Link href={`/students/${id}/eplr`} className="text-xs font-bold text-blue-600 hover:underline">+ Назначи екип</Link>
      )}
    </div>
  )
  return (
    <dl className="space-y-2.5">
      {[
        { label: 'Психолог', member: eplr.psychologist, isReal: eplr.psychologist && realPsy === eplr.psychologist.id },
        { label: 'Логопед', member: eplr.speech_therapist, isReal: eplr.speech_therapist && realSpe === eplr.speech_therapist.id },
        { label: 'Рехабилитатор', member: eplr.rehabilitator, isReal: eplr.rehabilitator && realReh === eplr.rehabilitator.id },
        { label: 'Класен р-л', member: eplr.class_teacher, isReal: false },
      ].map(({ label, member, isReal }) => (
        <div key={label}>
          <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</dt>
          <dd className={`text-sm mt-0.5 ${member ? (isReal ? 'font-bold text-slate-800' : 'font-normal text-slate-600') : ''}`}>
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
          <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">От изпращащото училище</dt>
          {externals.map((ext: any) => (
            <dd key={ext.id} className="text-sm font-semibold text-slate-700 mt-0.5">{ext.full_name}</dd>
          ))}
        </div>
      )}
    </dl>
  )
}
