import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, FileText, CheckCircle2, Clock } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import { DocumentType, DOCUMENT_TYPE_LABELS, ROLE_LABELS } from '@/types'

const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

export default async function SpecialistDashboard({ profile, currentYearId }: any) {
  const supabase = await createClient()

  const roleMap: Record<string, string> = {
    psychologist: 'psychologist_id',
    speech_therapist: 'speech_therapist_id',
    rehabilitator: 'rehabilitator_id',
    class_teacher: 'class_teacher_id',
  }
  const roleField = roleMap[profile.role] || 'psychologist_id'

  const [{ data: eplrTeams }, { data: announcements }] = await Promise.all([
    supabase.from('eplr_teams')
      .select(`student_id, student:students(*)`)
      .eq(roleField, profile.id)
      .eq('academic_year_id', currentYearId),
    supabase.from('announcements')
      .select('*').eq('is_active', true)
      .order('created_at', { ascending: false }).limit(3)
  ])

  const studentIds = eplrTeams?.map(e => e.student_id) || []

  const { data: documents } = studentIds.length > 0
    ? await supabase.from('documents').select('*')
        .eq('academic_year_id', currentYearId)
        .in('student_id', studentIds)
    : { data: [] }

  const docMap = new Map(documents?.map(d => [`${d.student_id}_${d.doc_type}`, d]) || [])

  const completed = documents?.filter(d => d.status === 'completed').length || 0
  const total = documents?.length || 0

  return (
    <>
      {/* Stats — 1 колона на мобилен, 3 на десктоп */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="card">
          <div className="flex items-center gap-3 mb-2 md:mb-3">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Users size={16} className="text-blue-600" />
            </div>
            <span className="text-xs md:text-sm text-slate-500">Моите ученици</span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold text-slate-800">{studentIds.length}</div>
          <div className="text-xs text-slate-400 mt-1">от ЕПЛР</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2 md:mb-3">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={16} className="text-green-600" />
            </div>
            <span className="text-xs md:text-sm text-slate-500">Завършени</span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold text-slate-800">
            {completed} <span className="text-lg text-slate-400">/ {total}</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">документа</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2 md:mb-3">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Clock size={16} className="text-amber-600" />
            </div>
            <span className="text-xs md:text-sm text-slate-500">Незавършени</span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold text-slate-800">{total - completed}</div>
          <div className="text-xs text-slate-400 mt-1">документа</div>
        </div>
      </div>

      {/* Ученици + Съобщения — 1 колона на мобилен, 2 на десктоп */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Users size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">Моите ученици</h2>
          </div>
          {!eplrTeams?.length ? (
            <p className="text-sm text-slate-400">Няма разпределени ученици</p>
          ) : (
            <div className="space-y-2">
              {eplrTeams.map(e => {
                const student = e.student as any
                const myDocs = ALL_DOC_TYPES.map(dt => docMap.get(`${e.student_id}_${dt}`))
                const doneCount = myDocs.filter(d => d?.status === 'completed').length
                return (
                  <Link
                    key={e.student_id}
                    href={`/students/${e.student_id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors gap-2"
                  >
                    <span className="text-sm font-medium text-slate-800 truncate">{getFullName(student)}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                      doneCount === ALL_DOC_TYPES.length ? 'bg-green-100 text-green-700' :
                      doneCount > 0 ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {doneCount}/{ALL_DOC_TYPES.length}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <FileText size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">Съобщения</h2>
          </div>
          {!announcements?.length ? (
            <p className="text-sm text-slate-400">Няма активни съобщения</p>
          ) : (
            <div className="space-y-3">
              {announcements.map(ann => (
                <div key={ann.id} className="p-3 rounded-lg border border-slate-100">
                  <div className="text-sm font-medium text-slate-700">{ann.title}</div>
                  <div className="text-xs text-slate-500 mt-1 line-clamp-2">{ann.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
