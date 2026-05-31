import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, FileText, Calendar } from 'lucide-react'
import { getFullName, getMonthName } from '@/lib/utils'
import { DocumentType, DOCUMENT_TYPE_LABELS } from '@/types'

const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

const DOC_SHORT: Record<DocumentType, string> = {
  protocol_1: 'П1', protocol_2: 'П2', protocol_3: 'П3',
  iup: 'ИУП', iu_program: 'ИУПр', support_plan: 'ПДП', parent_program: 'ПР',
}

export default async function ClassTeacherDashboard({ profile, currentYearId }: any) {
  const supabase = await createClient()

  const now = new Date()
  const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const deadlinePassed = now.getDate() > 8

  // Get classes from class_teacher_assignments
  const { data: assignments } = await supabase
    .from('class_teacher_assignments')
    .select('class:classes(*)')
    .eq('staff_id', profile.id)
    .eq('academic_year_id', currentYearId)

  const myClasses = assignments?.map((a: any) => a.class).filter(Boolean) || []

  if (myClasses.length === 0) {
    return (
      <div className="card text-center py-12 text-slate-400">
        <p>Нямате назначена паралелка. Свържете се с администратора.</p>
      </div>
    )
  }

  const classIds = myClasses.map((c: any) => c.id)

  const [{ data: allEnrollments }, { data: iupSubmissions }, { data: announcements }] = await Promise.all([
    supabase.from('student_enrollments').select('*, student:students(*), class_id').in('class_id', classIds).eq('academic_year_id', currentYearId),
    supabase.from('monthly_absences').select('class_id').in('class_id', classIds).eq('month', reportMonth).eq('year', reportYear),
    supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3)
  ])

  const submittedIds = new Set(iupSubmissions?.map(s => s.class_id) || [])
  const allStudents = allEnrollments?.map(e => e.student as any).filter(Boolean) || []

  const { data: documents } = allStudents.length > 0
    ? await supabase.from('documents').select('*').eq('academic_year_id', currentYearId).in('student_id', allStudents.map(s => s.id))
    : { data: [] }

  const docMap = new Map(documents?.map(d => [`${d.student_id}_${d.doc_type}`, d]) || [])

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users size={18} className="text-blue-600" />
            </div>
            <span className="text-sm text-slate-500">
              {myClasses.length === 1 ? `Паралелка ${myClasses[0].name}` : `${myClasses.length} паралелки`}
            </span>
          </div>
          <div className="text-3xl font-semibold text-slate-800">{allStudents.length}</div>
          <div className="text-xs text-slate-400 mt-1">ученика</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Calendar size={18} className="text-amber-600" />
            </div>
            <span className="text-sm text-slate-500">ИУП — {getMonthName(reportMonth)}</span>
          </div>
          <div className="space-y-1 mt-1">
            {myClasses.map((cls: any) => {
              const submitted = submittedIds.has(cls.id)
              return (
                <Link key={cls.id} href={`/absences/${cls.id}/${reportMonth}`} className="flex items-center justify-between hover:underline">
                  <span className="text-xs text-slate-500">Гр. {cls.name}</span>
                  <span className={`text-xs font-medium ${submitted ? 'text-green-600' : deadlinePassed ? 'text-red-600' : 'text-amber-600'}`}>
                    {submitted ? '✓ Въведено' : '— Невъведено'}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <FileText size={18} className="text-green-600" />
            </div>
            <span className="text-sm text-slate-500">Завършени документи</span>
          </div>
          <div className="text-3xl font-semibold text-slate-800">
            {documents?.filter(d => d.status === 'completed').length || 0}
            <span className="text-lg text-slate-400"> / {allStudents.length * ALL_DOC_TYPES.length}</span>
          </div>
        </div>
      </div>

      {/* Per class tables */}
      {myClasses.map((cls: any) => {
        const classStudents = allEnrollments?.filter(e => e.class_id === cls.id).map(e => e.student as any).filter(Boolean) || []
        return (
          <div key={cls.id} className="card mb-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="font-medium text-slate-700 text-sm">Паралелка {cls.name} — документи</h2>
              <Link href={`/classes/${cls.id}`} className="text-xs text-slate-400 hover:text-slate-700">Виж пълния изглед →</Link>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Ученик</th>
                  {ALL_DOC_TYPES.map(dt => (
                    <th key={dt} className="text-center px-2 py-2 text-xs font-medium text-slate-500" title={DOCUMENT_TYPE_LABELS[dt]}>
                      {DOC_SHORT[dt]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classStudents.map((student, idx) => (
                  <tr key={student.id} className={`border-t border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-3 py-2">
                      <Link href={`/students/${student.id}`} className="font-medium text-slate-800 hover:underline">
                        {getFullName(student)}
                      </Link>
                    </td>
                    {ALL_DOC_TYPES.map(dt => {
                      const doc = docMap.get(`${student.id}_${dt}`)
                      const status = doc?.status || 'empty'
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
          </div>
        )
      })}

      {announcements && announcements.length > 0 && (
        <div className="card mt-2">
          <h2 className="font-medium text-slate-700 text-sm mb-4 pb-3 border-b border-slate-100">Съобщения</h2>
          <div className="space-y-3">
            {announcements.map(ann => (
              <div key={ann.id} className="p-3 rounded-lg border border-slate-100">
                <div className="text-sm font-medium text-slate-700">{ann.title}</div>
                <div className="text-xs text-slate-500 mt-1 line-clamp-2">{ann.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
