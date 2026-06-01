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
    .from('student_enrollments').select('class_id, student_id')
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

  const countByClass = new Map<string, number>()
  enrollments?.forEach(e => countByClass.set(e.class_id, (countByClass.get(e.class_id) || 0) + 1))

  const studentsByClass = new Map<string, string[]>()
  enrollments?.forEach(e => {
    if (!studentsByClass.has(e.class_id)) studentsByClass.set(e.class_id, [])
    studentsByClass.get(e.class_id)!.push(e.student_id)
  })

  const teachersByClass = new Map<string, string[]>()
  assignments?.forEach((a: any) => {
    if (!teachersByClass.has(a.class_id)) teachersByClass.set(a.class_id, [])
    if (a.staff) teachersByClass.get(a.class_id)!.push(getFullName(a.staff))
  })

  function getDocStats(classId: string, dt: DocumentType) {
    const studentIds = studentsByClass.get(classId) || []
    const completed = studentIds.filter(sid => docMap.get(`${sid}_${dt}`) === 'completed').length
    return { completed, total: studentIds.length }
  }

  return (
    <div className="p-4 md:p-8">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Паралелки</h1>
        <p className="text-slate-500 text-sm mt-1">{classes?.length || 0} паралелки · {currentYear?.name}</p>
      </div>

      {/* ДЕСКТОП: таблица */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Паралелка</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Класен</th>
                <th className="text-center px-2 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Уч.</th>
                {ALL_DOC_TYPES.map(dt => (
                  <th key={dt} className="text-center px-2 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide"
                      title={DOCUMENT_TYPE_LABELS[dt]}>
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
                  <tr key={cls.id}
                      className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors ${idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                    <td className="px-4 py-2">
                      <Link href={`/classes/${cls.id}`} className="font-semibold text-slate-800 hover:underline">
                        {cls.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600 text-xs">{teachers.join(', ') || '—'}</td>
                    <td className="text-center px-2 py-2 text-slate-600 text-xs">{count}</td>
                    {ALL_DOC_TYPES.map(dt => {
                      const { completed, total } = getDocStats(cls.id, dt)
                      return (
                        <td key={dt} className="text-center px-2 py-2">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                            total === 0 ? 'bg-slate-100 text-slate-400' :
                            completed === total ? 'bg-green-100 text-green-700' :
                            completed > 0 ? 'bg-amber-100 text-amber-700' :
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
        </div>
        {!classes?.length && <div className="text-center py-12 text-slate-400 text-sm">Няма паралелки</div>}
      </div>

      {/* МОБИЛЕН: карти */}
      <div className="md:hidden space-y-3">
        {!classes?.length && <div className="text-center py-12 text-slate-400 text-sm">Няма паралелки</div>}
        {classes?.map((cls) => {
          const count = countByClass.get(cls.id) || 0
          const teachers = teachersByClass.get(cls.id) || []
          const totalDocs = ALL_DOC_TYPES.length * count
          const completedDocs = ALL_DOC_TYPES.reduce((sum, dt) => {
            return sum + getDocStats(cls.id, dt).completed
          }, 0)

          return (
            <Link key={cls.id} href={`/classes/${cls.id}`}
              className="block bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-slate-800 text-base">Паралелка {cls.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{teachers.join(', ') || 'Без класен'}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-semibold text-slate-800">{count} уч.</div>
                  <div className={`text-xs font-medium mt-0.5 ${
                    completedDocs === totalDocs && totalDocs > 0 ? 'text-green-600' :
                    completedDocs > 0 ? 'text-amber-600' : 'text-slate-400'
                  }`}>
                    {completedDocs}/{totalDocs} док.
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {ALL_DOC_TYPES.map(dt => {
                  const { completed, total } = getDocStats(cls.id, dt)
                  return (
                    <span key={dt} title={DOCUMENT_TYPE_LABELS[dt]}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        total === 0 ? 'bg-slate-100 text-slate-400' :
                        completed === total ? 'bg-green-100 text-green-700' :
                        completed > 0 ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                      {DOC_SHORT[dt]} {completed}/{total}
                    </span>
                  )
                })}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
