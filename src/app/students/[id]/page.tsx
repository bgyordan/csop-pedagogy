import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Users, Download, ArrowRightLeft, Archive, UserCog, Pencil, School, Paperclip } from 'lucide-react'
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

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: student } = await supabase.from('students').select('*, sending_school:sending_schools(name, city)').eq('id', id).single()
  if (!student) notFound()

  const { data: profile } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  const canManage = ['admin', 'zdud'].includes(profile?.role || '')

  const { data: currentYear } = await supabase.from('academic_years').select('*').eq('is_current', true).single()

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
    .from('student_attachments').select('*').eq('student_id', id).order('created_at', { ascending: false })

  const docMap = new Map(documents?.map(d => [d.doc_type, d]) || [])
  const sendingSchool = student.sending_school as any

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад към учениците
      </Link>

      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-800">{getFullName(student)}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
              <span>Пар.: <strong className="text-slate-700">{(enrollment?.class as any)?.name || '—'}</strong></span>
              <span>Роден: <strong className="text-slate-700">{formatDate(student.birth_date)}</strong></span>
              {sendingSchool && (
                <span className="flex items-center gap-1">
                  <School size={13} className="text-slate-400" />
                  <strong className="text-slate-700">{sendingSchool.name} — {sendingSchool.city}</strong>
                </span>
              )}
              <span className={student.status === 'active' ? 'badge-completed' : 'badge-empty'}>
                {student.status === 'active' ? 'Активен' : 'Архивиран'}
              </span>
            </div>
          </div>
        </div>

        {canManage && student.status === 'active' && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
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

      {student.status === 'archived' && student.archive_reason && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600">
          <span className="font-medium">Причина за напускане:</span> {student.archive_reason}
          {student.archived_at && <span className="ml-3 text-slate-400">({formatDate(student.archived_at)})</span>}
        </div>
      )}

      {/* ДЕСКТОП: 3 колони */}
      <div className="hidden md:grid grid-cols-3 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Users size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">ЕПЛР екип</h2>
          </div>
          <EplrTeam eplr={eplr} id={id} canManage={canManage} />
        </div>

        <div className="card col-span-2">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <FileText size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">Документи — {currentYear?.name}</h2>
          </div>
          <DocumentsList docMap={docMap} studentId={student.id} />
        </div>
      </div>

      {/* МОБИЛЕН: 1 колона */}
      <div className="md:hidden space-y-4 mb-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Users size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">ЕПЛР екип</h2>
          </div>
          <EplrTeam eplr={eplr} id={id} canManage={canManage} />
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <FileText size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">Документи — {currentYear?.name}</h2>
          </div>
          <DocumentsList docMap={docMap} studentId={student.id} />
        </div>
      </div>

      {/* Досие — прикачени файлове */}
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
