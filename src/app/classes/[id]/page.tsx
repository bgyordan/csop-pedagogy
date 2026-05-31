import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/BackButton'
import { DocumentType, DOCUMENT_TYPE_LABELS } from '@/types'
import { getFullName } from '@/lib/utils'

const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

const DOC_SHORT: Record<DocumentType, string> = {
  protocol_1: 'П1', protocol_2: 'П2', protocol_3: 'П3',
  iup: 'ИУП', iu_program: 'ИУПр', support_plan: 'ПДП', parent_program: 'ПР',
}

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  const { data: cls } = await supabase
    .from('classes').select('*').eq('id', id).single()

  if (!cls) notFound()

  const [{ data: enrollments }, { data: assignments }] = await Promise.all([
    supabase.from('student_enrollments').select('*, student:students(*)').eq('class_id', id).eq('academic_year_id', currentYear?.id),
    supabase.from('class_teacher_assignments').select('staff:staff_profiles(first_name, last_name)').eq('class_id', id).eq('academic_year_id', currentYear?.id)
  ])

  const students = enrollments?.map(e => e.student).filter(Boolean) || []
  const teachers = assignments?.map((a: any) => a.staff ? getFullName(a.staff) : null).filter(Boolean) || []

  const { data: documents } = students.length > 0
    ? await supabase.from('documents').select('*').eq('academic_year_id', currentYear?.id).in('student_id', students.map((s: any) => s.id))
    : { data: [] }

  const docMap = new Map<string, string>()
  documents?.forEach(d => docMap.set(`${d.student_id}_${d.doc_type}`, d.status))

  return (
    <div className="p-8">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Паралелка {cls.name}</h1>
        <div className="flex items-center gap-4 mt-1">
          <p className="text-slate-500 text-sm">{students.length} ученика · {currentYear?.name}</p>
          {teachers.length > 0 && (
            <p className="text-slate-500 text-sm">Класен: <strong className="text-slate-700">{teachers.join(', ')}</strong></p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Ученик</th>
              {ALL_DOC_TYPES.map(dt => (
                <th key={dt} className="text-center px-2 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide" title={DOCUMENT_TYPE_LABELS[dt]}>
                  {DOC_SHORT[dt]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student: any, idx: number) => (
              <tr key={student.id} className={`border-b border-slate-100 hover:bg-blue-50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                <td className="px-4 py-2">
                  <Link href={`/students/${student.id}`} className="font-medium text-slate-800 hover:underline">
                    {getFullName(student)}
                  </Link>
                </td>
                {ALL_DOC_TYPES.map(dt => {
                  const status = docMap.get(`${student.id}_${dt}`) || 'empty'
                  return (
                    <td key={dt} className="text-center px-2 py-2">
                      <Link href={`/documents/${student.id}/${dt}`}>
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                          status === 'completed' ? 'bg-green-100 text-green-700' :
                          status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                          {status === 'completed' ? '✓' : status === 'in_progress' ? '…' : '—'}
                        </span>
                      </Link>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!students.length && <div className="text-center py-12 text-slate-400 text-sm">Няма ученици</div>}
      </div>
    </div>
  )
}
