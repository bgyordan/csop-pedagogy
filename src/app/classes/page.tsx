import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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

export default async function ClassesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  const { data: classes } = await supabase
    .from('classes').select('*').eq('academic_year_id', currentYear?.id).order('name')

  const { data: enrollments } = await supabase
    .from('student_enrollments').select('class_id')
    .eq('academic_year_id', currentYear?.id)

  const { data: documents } = await supabase
    .from('documents').select('student_id, doc_type, status')
    .eq('academic_year_id', currentYear?.id)

  const { data: assignments } = await supabase
    .from('class_teacher_assignments')
    .select('class_id, staff:staff_profiles(first_name, last_name)')
    .eq('academic_year_id', currentYear?.id)

  const docMap = new Map<string, string>()
  documents?.forEach(d => docMap.set(`${d.student_id}_${d.doc_type}`, d.status))

  const studentsByClass = new Map<string, string[]>()
  enrollments?.forEach(e => {
    if (!studentsByClass.has(e.class_id)) studentsByClass.set(e.class_id, [])
    studentsByClass.get(e.class_id)!.push(e.class_id)
  })

  // Count students per class
  const countByClass = new Map<string, number>()
  enrollments?.forEach(e => countByClass.set(e.class_id, (countByClass.get(e.class_id) || 0) + 1))

  // Teachers per class (can be multiple)
  const teachersByClass = new Map<string, string[]>()
  assignments?.forEach((a: any) => {
    if (!teachersByClass.has(a.class_id)) teachersByClass.set(a.class_id, [])
    if (a.staff) teachersByClass.get(a.class_id)!.push(getFullName(a.staff))
  })

  return (
    <div className="p-8">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Паралелки</h1>
        <p className="text-slate-500 text-sm mt-1">{classes?.length || 0} паралелки · {currentYear?.name}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Паралелка</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Класен</th>
              <th className="text-center px-2 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Уч.</th>
              {ALL_DOC_TYPES.map(dt => (
                <th key={dt} className="text-center px-2 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide" title={DOCUMENT_TYPE_LABELS[dt]}>
                  {DOC_SHORT[dt]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes?.map((cls, idx) => {
              const count = countByClass.get(cls.id) || 0
              const teachers = teachersByClass.get(cls.id) || []
              return (
                <tr key={cls.id} className={`border-b border-slate-100 hover:bg-blue-50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                  <td className="px-4 py-2">
                    <Link href={`/classes/${cls.id}`} className="font-semibold text-slate-800 hover:underline">
                      {cls.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600 text-xs">{teachers.join(', ') || '—'}</td>
                  <td className="text-center px-2 py-2 text-slate-600 text-xs">{count}</td>
                  {ALL_DOC_TYPES.map(dt => {
                    const completed = 0
                    const total = count
                    return (
                      <td key={dt} className="text-center px-2 py-2">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                          total === 0 ? 'bg-slate-100 text-slate-400' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {completed}/{total}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        {!classes?.length && <div className="text-center py-12 text-slate-400 text-sm">Няма паралелки</div>}
      </div>
    </div>
  )
}
