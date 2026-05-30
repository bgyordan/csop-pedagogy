import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getFullName } from '@/lib/utils'
import { DocumentType, DOCUMENT_TYPE_LABELS } from '@/types'

const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

const DOC_SHORT: Record<DocumentType, string> = {
  protocol_1: 'П1', protocol_2: 'П2', protocol_3: 'П3',
  iup: 'ИУП', iu_program: 'ИУПр', support_plan: 'ПДП', parent_program: 'ПР',
}

export default async function ClassesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  const { data: classes } = await supabase
    .from('classes').select('*').eq('academic_year_id', currentYear?.id).order('name')

  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('*, student:students(*)')
    .eq('academic_year_id', currentYear?.id)

  const { data: documents } = await supabase
    .from('documents').select('*').eq('academic_year_id', currentYear?.id)

  // Build doc map
  const docMap = new Map<string, string>()
  documents?.forEach(d => docMap.set(`${d.student_id}_${d.doc_type}`, d.status))

  // Group students by class
  const studentsByClass = new Map<string, any[]>()
  enrollments?.forEach(e => {
    if (!studentsByClass.has(e.class_id)) studentsByClass.set(e.class_id, [])
    studentsByClass.get(e.class_id)!.push(e.student)
  })

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Паралелки</h1>
        <p className="text-slate-500 text-sm mt-1">{classes?.length || 0} паралелки · {currentYear?.name}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Паралелка</th>
              <th className="text-center px-3 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Ученици</th>
              {ALL_DOC_TYPES.map(dt => (
                <th key={dt} className="text-center px-3 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide" title={DOCUMENT_TYPE_LABELS[dt]}>
                  {DOC_SHORT[dt]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes?.map(cls => {
              const students = studentsByClass.get(cls.id) || []
              const docCounts = ALL_DOC_TYPES.map(dt => ({
                dt,
                completed: students.filter(s => docMap.get(`${s.id}_${dt}`) === 'completed').length,
                total: students.length,
              }))

              return (
                <tr key={cls.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <Link href={`/classes/${cls.id}`} className="font-medium text-slate-800 hover:underline">
                      Паралелка {cls.name}
                    </Link>
                  </td>
                  <td className="text-center px-3 py-3.5 text-slate-600">{students.length}</td>
                  {docCounts.map(({ dt, completed, total }) => (
                    <td key={dt} className="text-center px-3 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        completed === total && total > 0 ? 'bg-green-100 text-green-700' :
                        completed > 0 ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {completed}/{total}
                      </span>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        {!classes?.length && (
          <div className="text-center py-16 text-slate-400 text-sm">Няма паралелки</div>
        )}
      </div>
    </div>
  )
}
