import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Users, Download, ArrowRightLeft, Archive, UserCog, Pencil, School, Paperclip, History } from 'lucide-react'
import { formatDate, getFullName } from '@/lib/utils'
import { DOCUMENT_TYPE_LABELS, DocumentType, STATUS_LABELS } from '@/types'
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

  // История — всички учебни години на ученика
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
    <div className="p-4 md:p-8 max-w-5xl">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад към учениците
      </Link>

      {/* ── ХЕДЪР 2.0 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 mb-6">
        <div className="flex items-start gap-4 md:gap-5">
          {/* Монограм */}
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-bold flex-shrink-0"
            style={{ backgroundColor: '#0f2240' }}>
            {getInitials(student.first_name, student.last_name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-xl md:text-2xl font-semibold text-slate-800">{getFullName(student)}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className={student.status === 'active' ? 'badge-completed' : 'badge-empty'}>
                    {student.status === 'active' ? 'Активен' : 'Архивиран'}
                  </span>
                  {age && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{age}</span>}
                </div>
              </div>
            </div>

            {/* Детайли */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
              <div>
                <div className="text-xs text-slate-400 mb-0.5">Паралелка</div>
                <div className="text-sm font-medium text-slate-700">
                  {(enrollment?.class as any)?.name || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-0.5">Дата на раждане</div>
                <div className="text-sm font-medium text-slate-700">
                  {student.birth_date ? formatDate(student.birth_date) : '—'}
                </div>
              </div>
              {sendingSchool && (
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">Изпращащо училище</div>
                  <div className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <School size={12} className="text-slate-400 flex-shrink-0" />
                    {sendingSchool.name}
                    <span className="text-slate-400 font-normal">— {sendingSchool.city}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Статистика документи */}
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-xs text-slate-600">{completedDocs} завършени</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-xs text-slate-600">{inProgressDocs} в процес</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                <span className="text-xs text-slate-600">{ALL_DOC_TYPES.length - completedDocs - inProgressDocs} непопълнени</span>
              </div>
            </div>
          </div>
        </div>

        {/* Бутони за управление */}
        {canManage && student.status === 'active' && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
            <Link href={`/students/${id}/edit`} className="btn-secondary flex items-center gap-1.5 text-xs">
              <Pencil size={14} />
              Редактирай
            </Link>
            <Link href={`/students/${id}/eplr`} className="btn-secondary flex items-center gap-1.5 text-xs">
              <UserCog size={14} />
              ЕПЛР екип
            </Link>
            <Link href={`/students/${id}/transfer`} className="btn-secondary flex items-center gap-1.5 text-xs">
              <ArrowRightLeft size={14} />
              Прехвърли
            </Link>
            <Link href={`/students/${id}/archive`} className="btn-danger flex items-center gap-1.5 text-xs">
              <Archive size={14} />
              Архивирай
            </Link>
          </div>
        )}
      </div>

      {/* Банер архивиран */}
      {student.status === 'archived' && student.archive_reason && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600">
          <span className="font-medium">Причина за напускане:</span> {student.archive_reason}
          {student.archived_at && <span className="ml-3 text-slate-400">({formatDate(student.archived_at)})</span>}
        </div>
      )}

      {/* ── ОСНОВНО СЪДЪРЖАНИЕ ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6">
        {/* ЕПЛР екип */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Users size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">ЕПЛР екип</h2>
          </div>
          <EplrTeam eplr={eplr} id={id} canManage={canManage} />
        </div>

        {/* Документи */}
        <div className="card md:col-span-2">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <FileText size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">Документи — {currentYear?.name}</h2>
          </div>
          <DocumentsList docMap={docMap} studentId={student.id} />
        </div>
      </div>

      {/* ── ИСТОРИЯ ── */}
      {allEnrollments && allEnrollments.length > 1 && (
        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <History size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">История на обучението</h2>
          </div>
          <div className="space-y-2">
            {allEnrollments.map(e => {
              const yr = e.academic_year as any
              const cls = e.class as any
              const isCurrent = yr?.id === currentYear?.id
              return (
                <div key={e.id} className={`flex items-center justify-between p-3 rounded-lg ${isCurrent ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isCurrent ? 'bg-blue-500' : 'bg-slate-300'}`} />
                    <span className="text-sm font-medium text-slate-700">{yr?.name || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Паралелка {cls?.name || '—'}</span>
                    {isCurrent && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Текуща</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ДОСИЕ ── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <Paperclip size={16} className="text-slate-400" />
          <h2 className="font-medium text-slate-700 text-sm">Досие — външни документи</h2>
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
        <Link href={`/students/${id}/eplr`} className="text-xs font-medium" style={{ color: '#0f2240' }}>
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
          <dt className="text-xs text-slate-400">{label}</dt>
          <dd className="text-sm font-medium text-slate-700 mt-0.5">
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
            className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`flex-shrink-0 ${
                status === 'completed' ? 'badge-completed' :
                status === 'in_progress' ? 'badge-in-progress' :
                'badge-empty'
              }`}>
                {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
              </span>
              <span className="text-sm text-slate-700 truncate">{DOCUMENT_TYPE_LABELS[docType]}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Link
                href={`/documents/${studentId}/${docType}`}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap"
              >
                {doc ? 'Редактирай' : 'Попълни'}
              </Link>
              {doc && status === 'completed' && (
                <button className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1">
                  <Download size={12} />
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
