import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Users, Download, ArrowRightLeft, Archive, UserCog, Pencil, School, Paperclip, History, Check } from 'lucide-react'
import { formatDate, getFullName } from '@/lib/utils'
import { DOCUMENT_TYPE_LABELS, DocumentType, STATUS_LABELS, DocumentStatus } from '@/types'
import { AttachmentsSection } from './AttachmentsSection'

const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  referral_order: 'Заповед за насочване',
  rcpppo_assessment: 'Оценка от РЦПППО',
  medical_expertise: 'Медицинска експертиза',
  other: 'Друг документ',
}

function calculateAge(birthDate: string): string {
  const birth = new Date(birthDate)
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) {
    years--
    months += 12
  }
  if (months < 0) months += 12
  if (years === 0) return `${months} м.`
  if (months === 0) return `${years} г.`
  return `${years} г. ${months} м.`
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`
}

const getModernBadge = (status: DocumentStatus) => {
  if (status === 'completed') return <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-500 flex-shrink-0"><Check size={12} strokeWidth={3} /></span>
  if (status === 'in_progress') return <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 border border-amber-100 text-amber-500 flex-shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span></span>
  return <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-50 border border-slate-200 flex-shrink-0"><span className="w-1 h-1 rounded-full bg-slate-300"></span></span>
}

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: student } = await supabase
    .from('students')
    .select('*, sending_school:sending_schools(name, city)')
    .eq('id', id).single()
  if (!student) notFound()

  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  const canManage = ['admin', 'zdud'].includes(profile?.role || '')

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  const { data: enrollment } = await supabase
    .from('student_enrollments').select('*, class:classes(*)')
    .eq('student_id', id).eq('academic_year_id', currentYear?.id).single()

  const { data: eplr } = await supabase
    .from('eplr_teams').select(`
      *,
      psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(*),
      speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(*),
      rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(*),
      class_teacher:staff_profiles!eplr_teams_class_teacher_id_fkey(*)
    `).eq('student_id', id).eq('academic_year_id', currentYear?.id).single()

  const { data: documents } = await supabase
    .from('documents').select('*').eq('student_id', id).eq('academic_year_id', currentYear?.id)

  const { data: attachments } = await supabase
    .from('student_attachments').select('*').eq('student_id', id)
    .order('created_at', { ascending: false })

  const { data: allEnrollments } = await supabase
    .from('student_enrollments')
    .select('*, class:classes(*), academic_year:academic_years(*)')
    .eq('student_id', id)
    .order('enrolled_at', { ascending: false })

  const docMap = new Map(documents?.map(d => [d.doc_type, d]) || [])
  const sendingSchool = student.sending_school as any

  const completedDocs = documents?.filter(d => d.status === 'completed').length || 0
  const inProgressDocs = documents?.filter(d => d.status === 'in_progress').length || 0
  const age = student.birth_date ? calculateAge(student.birth_date) : null

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
        <ArrowLeft size={15} />
        Назад към учениците
      </Link>

      {/* ── ХЕДЪР УЧЕНИК ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4 md:gap-5">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-bold flex-shrink-0 shadow-md shadow-blue-900/10"
              style={{ backgroundColor: '#0f2240' }}>
              {getInitials(student.first_name, student.last_name)}
            </div>

            <div className="flex-1 min-w-0">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">{getFullName(student)}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    student.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {student.status === 'active' ? 'Активен' : 'Архивиран'}
                  </span>
                  {age && <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">{age}</span>}
                </div>
              </div>

              {/* Всички оригинални полета с детайли */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Паралелка ЦСОП</div>
                  <div className="text-sm font-semibold text-slate-700 mt-0.5">
                    {(enrollment?.class as any)?.name || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Дата на раждане</div>
                  <div className="text-sm font-semibold text-slate-700 mt-0.5">
                    {student.birth_date ? formatDate(student.birth_date) : '—'}
                  </div>
                </div>
                {sendingSchool && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Изпращащо училище</div>
                    <div className="text-sm font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                      <School size={14} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">{sendingSchool.name}</span>
                      <span className="text-slate-400 font-normal text-xs flex-shrink-0">— {sendingSchool.city}</span>
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

              {/* Статистика на документите */}
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {completedDocs} завършени
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  {inProgressDocs} в процес
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                  {ALL_DOC_TYPES.length - completedDocs - inProgressDocs} непопълнени
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Бутони за управление */}
        {canManage && student.status === 'active' && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
            <Link href={`/students/${id}/edit`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors">
              <Pencil size={13} /> Редактирай
            </Link>
            <Link href={`/students/${id}/eplr`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors">
              <UserCog size={13} /> ЕПЛР екип
            </Link>
            <Link href={`/students/${id}/transfer`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors">
              <ArrowRightLeft size={13} /> Прехвърли
            </Link>
            <Link href={`/students/${id}/archive`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50/50 border border-rose-100 px-3 py-2 rounded-xl hover:bg-rose-100/70 transition-colors">
              <Archive size={13} /> Архивирай
            </Link>
          </div>
        )}
      </div>

      {/* Банер ако е архивиран */}
      {student.status === 'archived' && student.archive_reason && (
        <div className="mb-6 p-4 bg-amber-50/40 border border-amber-200/60 rounded-2xl text-sm text-slate-700 shadow-sm">
          <span className="font-bold text-amber-800">Причина за напускане:</span> {student.archive_reason}
          {student.archived_at && <span className="ml-3 text-slate-400 font-medium">({formatDate(student.archived_at)})</span>}
        </div>
      )}

      {/* ── ОСНОВНО СЪДЪРЖАНИЕ (ГРИД) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* КАРТА ЕКИП */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Users size={16} className="text-blue-500" />
            <h2 className="font-bold text-slate-800 text-sm">ЕПЛР екип</h2>
          </div>
          <EplrTeam eplr={eplr} id={id} canManage={canManage} />
        </div>

        {/* КАРТА ДОКУМЕНТИ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm md:col-span-2">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <FileText size={16} className="text-emerald-500" />
            <h2 className="font-bold text-slate-800 text-sm">Документи — {currentYear?.name}</h2>
          </div>
          <DocumentsList docMap={docMap} studentId={student.id} />
        </div>
      </div>

      {/* ── ИСТОРИЯ НА ОБУЧЕНИЕТО ── */}
      {allEnrollments && allEnrollments.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <History size={16} className="text-indigo-500" />
            <h2 className="font-bold text-slate-800 text-sm">История на обучението</h2>
          </div>
          <div className="space-y-2">
            {allEnrollments.map(e => {
              const yr = e.academic_year as any
              const cls = e.class as any
              const isCurrent = yr?.id === currentYear?.id
              return (
                <div key={e.id} className={`flex items-center justify-between p-3 rounded-xl ${isCurrent ? 'bg-blue-50/50 border border-blue-100' : 'bg-slate-50/50 border border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isCurrent ? 'bg-blue-500 shadow shadow-blue-500/50' : 'bg-slate-300'}`} />
                    <span className="text-sm font-semibold text-slate-700">{yr?.name || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-500">Паралелка {cls?.name || '—'}</span>
                    {isCurrent && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase tracking-wider">Текуща</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ВЪНШНИ ДОКУМЕНТИ (ДОСИЕ) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <Paperclip size={16} className="text-amber-500" />
          <h2 className="font-bold text-slate-800 text-sm">Досие — външни документи</h2>
        </div>
        <AttachmentsSection
          studentId={id}
          attachments={attachments || []}
          canManage={canManage}
          staffId={profile?.id || ''}
          typeLabels={ATTACHMENT_TYPE_LABELS}
        />
      </div>
    </div>
  )
}

function EplrTeam({ eplr, id, canManage }: { eplr: any, id: string, canManage: boolean }) {
  if (!eplr) return (
    <div>
      <p className="text-sm text-slate-400 mb-3">Няма назначен екип</p>
      {canManage && (
        <Link href={`/students/${id}/eplr`} className="text-xs font-bold text-blue-600 hover:underline">
          + Назначи екип
        </Link>
      )}
    </div>
  )

  return (
    <dl className="space-y-3">
      {[
        { label: 'Психолог', member: eplr.psychologist },
        { label: 'Логопед', member: eplr.speech_therapist },
        { label: 'Рехабилитатор', member: eplr.rehabilitator },
        { label: 'Класен р-л', member: eplr.class_teacher },
      ].map(({ label, member }) => (
        <div key={label}>
          <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</dt>
          <dd className="text-sm font-semibold text-slate-700 mt-0.5">
            {member ? getFullName(member as any) : <span className="text-slate-400 font-normal">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function DocumentsList({ docMap, studentId }: { docMap: Map<string, any>, studentId: string }) {
  return (
    <div className="space-y-2">
      {ALL_DOC_TYPES.map(docType => {
        const doc = docMap.get(docType)
        const status = doc?.status || 'empty'
        return (
          <div key={docType}
            className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition-colors gap-2">
            <div className="flex items-center gap-3 min-w-0">
              {getModernBadge(status as DocumentStatus)}
              <span className="text-sm font-medium text-slate-700 truncate">{DOCUMENT_TYPE_LABELS[docType]}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href={`/documents/${studentId}/${docType}`}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors whitespace-nowrap"
              >
                {doc ? 'Редактирай' : 'Попълни'}
              </Link>
              {doc && status === 'completed' && (
                <button className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center gap-1 text-slate-600">
                  <Download size={13} />
                  <span className="hidden sm:inline">Word</span>
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
