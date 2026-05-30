import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Users, Download, ArrowRightLeft, Archive, UserCog } from 'lucide-react'
import { formatDate, getFullName } from '@/lib/utils'
import { DOCUMENT_TYPE_LABELS, DocumentType, STATUS_LABELS } from '@/types'

const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single()

  if (!student) notFound()

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const canManage = ['admin', 'zdud'].includes(profile?.role || '')

  const { data: currentYear } = await supabase
    .from('academic_years')
    .select('*')
    .eq('is_current', true)
    .single()

  const { data: enrollment } = await supabase
    .from('student_enrollments')
    .select('*, class:classes(*)')
    .eq('student_id', id)
    .eq('academic_year_id', currentYear?.id)
    .single()

  const { data: eplr } = await supabase
    .from('eplr_teams')
    .select(`
      *,
      psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(*),
      speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(*),
      rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(*),
      class_teacher:staff_profiles!eplr_teams_class_teacher_id_fkey(*)
    `)
    .eq('student_id', id)
    .eq('academic_year_id', currentYear?.id)
    .single()

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('student_id', id)
    .eq('academic_year_id', currentYear?.id)

  const docMap = new Map(documents?.map(d => [d.doc_type, d]) || [])

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад към учениците
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">{getFullName(student)}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
            <span>Паралелка: <strong className="text-slate-700">{(enrollment?.class as any)?.name || '—'}</strong></span>
            <span>Роден: <strong className="text-slate-700">{formatDate(student.birth_date)}</strong></span>
            <span className={student.status === 'active' ? 'badge-completed' : 'badge-empty'}>
              {student.status === 'active' ? 'Активен' : 'Архивиран'}
            </span>
          </div>
        </div>

        {canManage && student.status === 'active' && (
          <div className="flex items-center gap-2">
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

      <div className="grid grid-cols-3 gap-6">
        {/* EPLR */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Users size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">ЕПЛР екип</h2>
          </div>
          {!eplr ? (
            <div>
              <p className="text-sm text-slate-400 mb-3">Няма назначен екип</p>
              {canManage && (
                <Link href={`/students/${id}/eplr`} className="text-xs font-medium" style={{ color: '#0f2240' }}>
                  + Назначи екип
                </Link>
              )}
            </div>
          ) : (
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
          )}
        </div>

        {/* Documents */}
        <div className="card col-span-2">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <FileText size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">Документи — {currentYear?.name}</h2>
          </div>
          <div className="space-y-2">
            {ALL_DOC_TYPES.map(docType => {
              const doc = docMap.get(docType)
              const status = doc?.status || 'empty'
              return (
                <div key={docType} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={
                      status === 'completed' ? 'badge-completed' :
                      status === 'in_progress' ? 'badge-in-progress' :
                      'badge-empty'
                    }>
                      {STATUS_LABELS[status]}
                    </span>
                    <span className="text-sm text-slate-700">{DOCUMENT_TYPE_LABELS[docType]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/documents/${student.id}/${docType}`}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                      {doc ? 'Редактирай' : 'Попълни'}
                    </Link>
                    {doc && status === 'completed' && (
                      <button className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1">
                        <Download size={12} />
                        Word
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
