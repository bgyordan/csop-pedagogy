import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import DocumentsMatrixClient from './DocumentsMatrixClient'

const ATTACHMENT_TYPES = [
  { key: 'referral_order', label: 'Заповед за насочване' },
  { key: 'rcpppo_assessment', label: 'Оценка от РЦПППО' },
  { key: 'medical_expertise', label: 'Медицинска експертиза' },
  { key: 'other', label: 'Друг документ' },
]

export default async function DocumentsMatrixPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role').eq('user_id', user.id).single()

  const role = profile?.role || ''
  const canAccess = ['admin', 'zdud', 'director', 'class_teacher'].includes(role)
  if (!canAccess) redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  const isClassTeacher = role === 'class_teacher'

  // Паралелки — всички или само на класния
  let classQuery = supabase
    .from('classes').select('*').eq('academic_year_id', currentYear?.id).order('name')

  let myClassIds: string[] = []
  if (isClassTeacher) {
    const { data: assignments } = await supabase
      .from('class_teacher_assignments').select('class_id')
      .eq('staff_id', profile!.id).eq('academic_year_id', currentYear?.id)
    myClassIds = assignments?.map(a => a.class_id) || []
    classQuery = classQuery.in('id', myClassIds.length > 0 ? myClassIds : ['none'])
  }

  const { data: classes } = await classQuery

  // Enrollments за видимите паралелки
  const classIds = (classes || []).map(c => c.id)
  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('student_id, class_id, student:students(id, first_name, middle_name, last_name, status)')
    .eq('academic_year_id', currentYear?.id)
    .in('class_id', classIds.length > 0 ? classIds : ['none'])

  // Всички прикачени документи за тези ученици
  const studentIds = (enrollments || []).map(e => e.student_id)
  const { data: attachments } = await supabase
    .from('student_attachments')
    .select('id, student_id, doc_type, valid_until_year, file_name, file_path')
    .in('student_id', studentIds.length > 0 ? studentIds : ['none'])

  // Групиране по паралелка → ученици
  const byClass = (classes || []).map(cls => {
    const classEnrollments = (enrollments || [])
      .filter(e => e.class_id === cls.id && (e.student as any)?.status === 'active')
      .map(e => {
        const student = e.student as any
        const studentDocs = (attachments || []).filter(a => a.student_id === student.id)
        const docMap: Record<string, any> = {}
        ATTACHMENT_TYPES.forEach(t => {
          const found = studentDocs.find(d => d.doc_type === t.key)
          docMap[t.key] = found ? {
            id: found.id,
            valid_until_year: found.valid_until_year,
            file_name: found.file_name,
            file_path: found.file_path,
          } : undefined
        })
        return {
          id: student.id,
          name: getFullName(student),
          docs: docMap,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
    return {
      classId: cls.id,
      className: cls.name,
      students: classEnrollments,
    }
  }).filter(c => c.students.length > 0)

  const currentYearName = currentYear?.name || ''
  const baseYear = currentYearName ? parseInt(currentYearName.split('/')[0]) : new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => `${baseYear + i}/${baseYear + i + 1}`)
  const canManage = ['admin', 'zdud', 'director', 'class_teacher'].includes(role)

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
        <ArrowLeft size={15} />
        Назад към учениците
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Матрица на документите</h1>
        <p className="text-slate-500 text-sm mt-1">Валидност на външните документи · {currentYear?.name}</p>
      </div>

      <DocumentsMatrixClient
        classes={byClass}
        docTypes={ATTACHMENT_TYPES}
        currentYearName={currentYearName}
        yearOptions={yearOptions}
        canManage={canManage}
        staffId={profile?.id || ''}
      />
    </div>
  )
}
