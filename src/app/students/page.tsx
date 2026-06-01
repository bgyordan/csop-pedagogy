import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { formatDate, getFullName } from '@/lib/utils'
import { StudentsFilter } from './StudentsFilter'

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const params = await searchParams
  const search = params.q || ''

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  const { data: profileData } = await supabase
    .from('staff_profiles').select('id, role').eq('user_id', user.id).single()

  const role = profileData?.role || ''
  const isClassTeacher = role === 'class_teacher'
  const isSpecialist = ['psychologist', 'speech_therapist', 'rehabilitator'].includes(role)
  const canWrite = ['admin', 'zdud'].includes(role)

  const { data: allClasses } = await supabase
    .from('classes').select('*').eq('academic_year_id', currentYear?.id).order('name')

  let query = supabase
    .from('student_enrollments')
    .select('*, student:students(*), class:classes(*)')
    .eq('academic_year_id', currentYear?.id)

  let visibleClasses = allClasses || []

  if (isClassTeacher) {
    const { data: assignments } = await supabase
      .from('class_teacher_assignments').select('class_id')
      .eq('staff_id', profileData!.id).eq('academic_year_id', currentYear?.id)
    const myClassIds = assignments?.map(a => a.class_id) || []
    query = query.in('class_id', myClassIds.length > 0 ? myClassIds : ['no-results'])
    visibleClasses = allClasses?.filter(c => myClassIds.includes(c.id)) || []
  } else if (isSpecialist) {
    const roleField = role === 'psychologist' ? 'psychologist_id'
      : role === 'speech_therapist' ? 'speech_therapist_id' : 'rehabilitator_id'
    const { data: eplrTeams } = await supabase
      .from('eplr_teams').select('student_id')
      .eq(roleField, profileData!.id).eq('academic_year_id', currentYear?.id)
    const studentIds = eplrTeams?.map(t => t.student_id) || []
    query = query.in('student_id', studentIds.length > 0 ? studentIds : ['no-results'])
  }

  if (params.class) query = query.eq('class_id', params.class)

  const { data: enrollments } = await query

  const filtered = (enrollments || []).filter(e => {
    if (!search) return true
    return getFullName(e.student).toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Ученици</h1>
          <p className="text-slate-500 text-sm mt-1">
            {filtered.length} ученика · {currentYear?.name}
          </p>
        </div>
        {canWrite && (
          <Link href="/students/new"
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#0f2240' }}>
            <Plus size={16} />
            <span className="hidden sm:inline">Нов ученик</span>
            <span className="sm:hidden">Нов</span>
          </Link>
        )}
      </div>

      <StudentsFilter
        classes={visibleClasses}
        currentSearch={search}
        currentClass={params.class || ''}
      />

      {/* ДЕСКТОП: таблица */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Три имена</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Паралелка</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Дата на раждане</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Статус</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((enrollment, idx) => (
              <tr key={enrollment.id}
                className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors ${idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                <td className="px-5 py-3.5 font-medium text-slate-800">{getFullName(enrollment.student)}</td>
                <td className="px-5 py-3.5 text-slate-600">{(enrollment.class as any)?.name || '—'}</td>
                <td className="px-5 py-3.5 text-slate-600">
                  {enrollment.student?.birth_date ? formatDate(enrollment.student.birth_date) : '—'}
                </td>
                <td className="px-5 py-3.5">
                  <span className={enrollment.student?.status === 'active' ? 'badge-completed' : 'badge-empty'}>
                    {enrollment.student?.status === 'active' ? 'Активен' : 'Архивиран'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <Link href={`/students/${enrollment.student?.id}`}
                    className="text-xs font-medium hover:underline" style={{ color: '#0f2240' }}>
                    Преглед →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Users className="mx-auto mb-2 opacity-30" size={32} />
            <p className="text-sm">Няма намерени ученици</p>
          </div>
        )}
      </div>

      {/* МОБИЛЕН: карти */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Users className="mx-auto mb-2 opacity-30" size={32} />
            <p className="text-sm">Няма намерени ученици</p>
          </div>
        )}
        {filtered.map(enrollment => (
          <Link key={enrollment.id} href={`/students/${enrollment.student?.id}`}
            className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 hover:shadow-sm transition-shadow gap-3">
            <div className="min-w-0">
              <div className="font-medium text-slate-800 text-sm truncate">{getFullName(enrollment.student)}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Пар. {(enrollment.class as any)?.name || '—'}
                {enrollment.student?.birth_date && (
                  <span className="ml-2 text-slate-400">{formatDate(enrollment.student.birth_date)}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={enrollment.student?.status === 'active' ? 'badge-completed' : 'badge-empty'}>
                {enrollment.student?.status === 'active' ? 'Активен' : 'Архивиран'}
              </span>
              <span className="text-slate-300 text-sm">›</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
