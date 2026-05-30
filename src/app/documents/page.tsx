import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import { DOCUMENT_TYPE_LABELS, DocumentType, DocumentStatus } from '@/types'

const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: currentYear } = await supabase
    .from('academic_years')
    .select('*')
    .eq('is_current', true)
    .single()

  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('*, student:students(*), class:classes(*)')
    .eq('academic_year_id', currentYear?.id)

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('academic_year_id', currentYear?.id)

  const docMap = new Map(
    documents?.map(d => [`${d.student_id}_${d.doc_type}`, d]) || []
  )

  const students = enrollments?.map(e => e.student).filter(Boolean) || []
  const completed = documents?.filter(d => d.status === 'completed').length || 0
  const inProgress = documents?.filter(d => d.status === 'in_progress').length || 0
  const total = (students.length * ALL_DOC_TYPES.length)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Документи</h1>
        <p className="text-slate-500 text-sm mt-1">
          {currentYear?.name} · {completed} завършени · {inProgress} в процес · {total - completed - inProgress} непопълнени
        </p>
      </div>

      <div className="space-y-4">
        {enrollments?.map(enrollment => {
          const student = enrollment.student
          if (!student) return null
          return (
            <div key={student.id} className="card">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="font-medium text-slate-800">{getFullName(student)}</h2>
                  <span className="text-xs text-slate-400">Паралелка {(enrollment.class as any)?.name || '—'}</span>
                </div>
                <Link href={`/students/${student.id}`} className="text-xs text-slate-400 hover:text-slate-700">
                  Профил →
                </Link>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {ALL_DOC_TYPES.map(docType => {
                  const doc = docMap.get(`${student.id}_${docType}`)
                  const status: DocumentStatus = doc?.status || 'empty'
                  return (
                    <Link
                      key={docType}
                      href={`/documents/${student.id}/${docType}`}
                      className="flex flex-col items-center p-2 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors text-center"
                    >
                      <span className={`text-xs px-1.5 py-0.5 rounded-full mb-1 font-medium ${
                        status === 'completed' ? 'bg-green-100 text-green-700' :
                        status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {status === 'completed' ? '✓' : status === 'in_progress' ? '…' : '—'}
                      </span>
                      <span className="text-xs text-slate-500 leading-tight">
                        {DOCUMENT_TYPE_LABELS[docType].split('—')[0].trim()}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
        {!enrollments?.length && (
          <div className="text-center py-16 text-slate-400">
            <FileText className="mx-auto mb-2 opacity-30" size={32} />
            <p className="text-sm">Няма ученици за тази учебна година</p>
          </div>
        )}
      </div>
    </div>
  )
}
