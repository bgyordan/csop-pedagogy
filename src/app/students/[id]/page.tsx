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
import StudentDeclarations from './StudentDeclarations'

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
  
  // ДОСИЕ UI СТИЛОВЕ
  const cardCls = "bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden h-full"
  const cardHead = "flex items-center gap-3 px-5 py-4 bg-slate-50/60 border-b border-slate-100/80"
  const cardIconWrapper = "p-1.5 bg-white rounded-lg shadow-sm border border-slate-200/50 text-slate-500"
  const cardBody = "p-5 flex-1"

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 mb-6 transition-colors">
        <ArrowLeft size={16} /> Назад към учениците
      </Link>

      {/* ОСНОВЕН ХЕДЪР НА ДОСИЕТО */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mb-6">
        <div className="p-6 md:p-8">
          <div className="flex items-start gap-5 md:gap-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-white text-2xl md:text-3xl font-bold flex-shrink-0 shadow-md shadow-blue-900/10"
              style={{ backgroundColor: '#0f2240' }}>
              {getInitials(student.first_name, student.last_name)}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{getFullName(student)}</h1>
              
              {/* Баджове със статус */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  student.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {student.status === 'active' ? 'Активен' : 'Архивиран'}
                </span>
                {age && <span className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">{age}</span>}
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
                  {educationForm === 'ifo' ? <><Home size={12} /> ИФО</> : <><GraduationCap size={12} /> Дневна</>}
                </span>
                {coudEnrolled && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600">{coudGroupName || 'ЦОУД'}</span>
                )}
                {activeOres && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    <Wifi size={12} /> ОРЕС
                  </span>
                )}
                {(student as any).is_new && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 shadow-sm">
                    <Sparkles size={12} /> НОВ УЧЕНИК
                  </span>
                )}
              </div>

              {/* Информационна мрежа */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 pt-5 border-t border-slate-100">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Паралелка ЦСОП</div>
                  <div className="text-sm font-semibold text-slate-800">{className || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Дата на раждане</div>
                  <div className="text-sm font-semibold text-slate-800">{student.birth_date ? formatDate(student.birth_date) : '—'}</div>
                </div>
                {sendingSchool && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Изпращащо училище</div>
                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                      <School size={14} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">{sendingSchool.name}</span>
                    </div>
                  </div>
                )}
                {student.external_class && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Клас в изпр. училище</div>
                    <div className="text-sm font-semibold text-slate-800">{student.external_class}</div>
                  </div>
                )}
                {student.is_traveling && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Транспорт</div>
                    <div className="text-sm font-semibold text-slate-800">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200">
                        Пътуващ ученик
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Инструменти (Toolbar) */}
        {(canManage || canEditDossier || isCoordinator) && student.status === 'active' && (
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex flex-wrap items-center gap-2.5">
            {canManage && (
              <Link href={`/students/${id}/edit`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 shadow-sm px-3.5 py-2 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all">
                <Pencil size={14} /> Редактирай
              </Link>
            )}
            {canManage && (
              <Link href={`/students/${id}/eplr`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 shadow-sm px-3.5 py-2 rounded-lg hover:bg-blue-100 transition-all">
                <UserCog size={14} /> ЕПЛР екип
              </Link>
            )}
            {educationForm === 'ifo' && (
              <Link href={`/students/${id}/schedule`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 shadow-sm px-3.5 py-2 rounded-lg hover:bg-teal-100 transition-all">
                <CalendarClock size={14} /> Седмично разписание
              </Link>
            )}
            {(student as any).is_new && (
              <Link href={`/students/${id}/survey`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 shadow-sm px-3.5 py-2 rounded-lg hover:bg-violet-100 transition-all">
                <ClipboardList size={14} /> Анкета
              </Link>
            )}
            {(student as any).is_new && canMarkProcessed && (
              <MarkProcessedButton studentId={id} />
            )}
            {canManage && (
              <Link href={`/students/${id}/transfer`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 shadow-sm px-3.5 py-2 rounded-lg hover:bg-slate-50 transition-all">
                <ArrowRightLeft size={14} /> Прехвърли
              </Link>
            )}
            <div className="flex-1"></div>
            {canManage && (
              <Link href={`/students/${id}/archive`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 shadow-sm px-3.5 py-2 rounded-lg hover:bg-rose-100 transition-all">
                <Archive size={14} /> Архивирай
              </Link>
            )}
          </div>
        )}
      </div>

      {student.status === 'archived' && student.archive_reason && (
        <div className="mb-6 p-4 bg-amber-50/60 border border-amber-200 rounded-xl text-sm text-slate-700 shadow-sm flex items-start gap-3">
          <Archive className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
          <div>
            <span className="font-bold text-amber-800">Причина за архивиране:</span> {student.archive_reason}
            {student.archived_at && <span className="ml-2 text-slate-500 font-medium">({formatDate(student.archived_at)})</span>}
          </div>
        </div>
      )}

      {/* 
        СЕКЦИЯ С ТАБОВЕ (Модерен Segmented Control)
        Използваме flex-wrap контейнер. Всички инпути и лебъли са на едно ниво (siblings),
        а панелите са с order-last, за да паднат под навигацията.
      */}
      <div className="flex flex-wrap relative bg-transparent">
        
        {/* Инпутите трябва да са преди лейбълите и панелите */}
        <input type="radio" name="dossier-tabs" id="tab-data" className="peer/data hidden" defaultChecked />
        <input type="radio" name="dossier-tabs" id="tab-eplr" className="peer/eplr hidden" />
        <input type="radio" name="dossier-tabs" id="tab-therapy" className="peer/therapy hidden" />
        <input type="radio" name="dossier-tabs" id="tab-files" className="peer/files hidden" />

        {/* НАВИГАЦИЯ НА ТАБОВЕТЕ */}
        <div className="flex w-full bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60 shadow-inner mb-6 gap-1 overflow-x-auto hide-scrollbar">
          <label htmlFor="tab-data" className="flex-1 min-w-[120px] cursor-pointer text-center px-4 py-2.5 text-sm font-semibold rounded-lg text-slate-500 transition-all hover:text-slate-800 peer-checked/data:bg-white peer-checked/data:text-blue-700 peer-checked/data:shadow peer-checked/data:ring-1 peer-checked/data:ring-slate-900/5 flex items-center justify-center gap-2 select-none">
            <ClipboardList size={16} /> Данни
          </label>
          <label htmlFor="tab-eplr" className="flex-1 min-w-[120px] cursor-pointer text-center px-4 py-2.5 text-sm font-semibold rounded-lg text-slate-500 transition-all hover:text-slate-800 peer-checked/eplr:bg-white peer-checked/eplr:text-blue-700 peer-checked/eplr:shadow peer-checked/eplr:ring-1 peer-checked/eplr:ring-slate-900/5 flex items-center justify-center gap-2 select-none">
            <Users size={16} /> ЕПЛР
          </label>
          <label htmlFor="tab-therapy" className="flex-1 min-w-[120px] cursor-pointer text-center px-4 py-2.5 text-sm font-semibold rounded-lg text-slate-500 transition-all hover:text-slate-800 peer-checked/therapy:bg-white peer-checked/therapy:text-blue-700 peer-checked/therapy:shadow peer-checked/therapy:ring-1 peer-checked/therapy:ring-slate-900/5 flex items-center justify-center gap-2 select-none">
            <Heart size={16} /> Терапия
          </label>
          <label htmlFor="tab-files" className="flex-1 min-w-[120px] cursor-pointer text-center px-4 py-2.5 text-sm font-semibold rounded-lg text-slate-500 transition-all hover:text-slate-800 peer-checked/files:bg-white peer-checked/files:text-blue-700 peer-checked/files:shadow peer-checked/files:ring-1 peer-checked/files:ring-slate-900/5 flex items-center justify-center gap-2 select-none">
            <Paperclip size={16} /> Файлове
          </label>
        </div>


        {/* =========================================
            ПАНЕЛ 1: ДАННИ
            ========================================= */}
        <div className="hidden peer-checked/data:block order-last w-full animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
          
          {/* Ред 1: Обучение (Широка карта) */}
          <div className={`${cardCls} !h-auto`}>
            <div className={cardHead}>
              <div className={cardIconWrapper}>
                <GraduationCap size={18} className="text-blue-600" />
              </div>
              <h2 className="font-bold text-slate-800 text-sm md:text-base">Параметри на обучението</h2>
            </div>
            <div className={cardBody}>
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
          </div>

          {/* Ред 2: Родители & История (Балансирани 50/50 мрежа) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className={cardCls}>
              <div className={cardHead}>
                <div className={cardIconWrapper}>
                  <Heart size={18} className="text-rose-500" />
                </div>
                <h2 className="font-bold text-slate-800 text-sm md:text-base">Родители / Настойници</h2>
              </div>
              <div className={cardBody}>
                <GuardiansSection studentId={id} guardians={guardians || []} canManage={canEditDossier} />
              </div>
            </div>
            
            <div className={cardCls}>
              <div className={cardHead}>
                <div className={cardIconWrapper}>
                  <History size={18} className="text-indigo-500" />
                </div>
                <h2 className="font-bold text-slate-800 text-sm md:text-base">История на обучението</h2>
              </div>
              <div className={cardBody}>
                {allEnrollments && allEnrollments.length > 1 ? (
                  <div className="flex flex-col gap-2">
                    {allEnrollments.map(e => {
                      const yr = e.academic_year as any
                      const cls = e.class as any
                      const isCurrent = yr?.id === currentYear?.id
                      return (
                        <div key={e.id} className={`flex items-center justify-between p-3 rounded-xl border ${isCurrent ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold ${isCurrent ? 'text-blue-800' : 'text-slate-700'}`}>{yr?.name || '—'}</span>
                            <span className="text-xs font-medium text-slate-500">Паралелка {cls?.name || '—'}</span>
                          </div>
                          {isCurrent && (
                            <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-md tracking-wider">Текуща</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 h-full">
                    <History className="text-slate-300 mb-2" size={24} />
                    <p className="text-sm text-slate-500 font-medium">Само текущата година</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Ред 3: Декларации */}
          <div>
            <StudentDeclarations studentId={id} canManage={canEditDossier} />
          </div>
        </div>


        {/* =========================================
            ПАНЕЛ 2: ЕПЛР
            ========================================= */}
        <div className="hidden peer-checked/eplr:block order-last w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            
            {/* Екип */}
            <div className={cardCls}>
              <div className={cardHead}>
                <div className={cardIconWrapper}>
                  <Users size={18} className="text-blue-500" />
                </div>
                <h2 className="font-bold text-slate-800 text-sm md:text-base">ЕПЛР екип</h2>
              </div>
              <div className={cardBody}>
                <EplrTeam 
                  externals={externalMembers || []} 
                  eplr={eplr} 
                  id={id} 
                  canManage={canManage}
                  realPsy={(student as any).therapist_psychologist_id}
                  realSpe={(student as any).therapist_speech_id}
                  realReh={(student as any).therapist_rehab_id} 
                />
              </div>
            </div>

            {/* Документи */}
            <div className={`${cardCls} lg:col-span-2`}>
              <div className={cardHead}>
                <div className={cardIconWrapper}>
                  <FileText size={18} className="text-emerald-500" />
                </div>
                <h2 className="font-bold text-slate-800 text-sm md:text-base">Документи ЕПЛР — {currentYear?.name}</h2>
              </div>
              <div className={cardBody}>
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
        </div>


        {/* =========================================
            ПАНЕЛ 3: ТЕРАПИЯ
            ========================================= */}
        <div className="hidden peer-checked/therapy:block order-last w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className={`${cardCls} !h-auto`}>
            <div className={cardHead}>
              <div className={cardIconWrapper}>
                <Heart size={18} className="text-teal-500" />
              </div>
              <h2 className="font-bold text-slate-800 text-sm md:text-base">Терапевтичен екип</h2>
            </div>
            <div className={`${cardBody} bg-slate-50/30`}>
              {/* Вместо малък списък, правим го на широка мрежа от карти */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Психолог', member: (student as any).therapist_psychologist, icon: Users },
                  { label: 'Логопед', member: (student as any).therapist_speech, icon: Users },
                  { label: 'Рехабилитатор', member: (student as any).therapist_rehab, icon: Users },
                ].map(({ label, member, icon: Icon }) => (
                  <div key={label} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center transition-all hover:border-slate-300">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3">
                      <Icon size={20} />
                    </div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
                    <div className="text-sm md:text-base font-bold text-slate-800">
                      {member ? getFullName(member) : <span className="text-slate-400 font-normal italic">Не е зачислен</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>


        {/* =========================================
            ПАНЕЛ 4: ФАЙЛОВЕ
            ========================================= */}
        <div className="hidden peer-checked/files:block order-last w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className={`${cardCls} !h-auto`}>
            <div className={cardHead}>
              <div className={cardIconWrapper}>
                <Paperclip size={18} className="text-amber-500" />
              </div>
              <h2 className="font-bold text-slate-800 text-sm md:text-base">Досие — външни документи</h2>
            </div>
            <div className={cardBody}>
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
        </div>

      </div>
    </div>
  )
}

function EplrTeam({ eplr, id, canManage, externals = [], realPsy, realSpe, realReh }: { eplr: any, id: string, canManage: boolean, externals?: any[], realPsy?: string, realSpe?: string, realReh?: string }) {
  if (!eplr) return (
    <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 h-full">
      <Users className="text-slate-300 mb-2" size={24} />
      <p className="text-sm font-medium text-slate-500 mb-3">Няма назначен екип</p>
      {canManage && (
        <Link href={`/students/${id}/eplr`} className="inline-flex items-center justify-center text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors">
          + Назначи екип
        </Link>
      )}
    </div>
  )
  
  return (
    <div className="flex flex-col gap-3">
      {[
        { label: 'Психолог', member: eplr.psychologist, isReal: eplr.psychologist && realPsy === eplr.psychologist.id },
        { label: 'Логопед', member: eplr.speech_therapist, isReal: eplr.speech_therapist && realSpe === eplr.speech_therapist.id },
        { label: 'Рехабилитатор', member: eplr.rehabilitator, isReal: eplr.rehabilitator && realReh === eplr.rehabilitator.id },
        { label: 'Класен р-л', member: eplr.class_teacher, isReal: false },
      ].map(({ label, member, isReal }, idx) => (
        <div key={label} className={`flex flex-col pb-3 ${idx !== 3 ? 'border-b border-slate-100' : ''}`}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
          <span className={`text-sm mt-0.5 ${member ? (isReal ? 'font-bold text-slate-800' : 'font-medium text-slate-600') : ''}`}>
            {member ? (
              <span className="inline-flex items-center gap-1.5">
                {getFullName(member as any)}
               </span>
            ) : <span className="text-slate-400 italic font-normal">— няма —</span>}
          </span>
        </div>
      ))}
      
      {externals.length > 0 && (
        <div className="pt-3 border-t-2 border-dashed border-slate-200 mt-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">От изпращащото училище</span>
          {externals.map((ext: any) => (
            <div key={ext.id} className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2 before:content-[''] before:w-1.5 before:h-1.5 before:bg-slate-300 before:rounded-full">
              {ext.full_name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
