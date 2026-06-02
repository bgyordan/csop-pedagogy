import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Users, Search, ChevronRight } from 'lucide-react'
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
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ученици</h1>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} записани ученици · {currentYear?.name}</p>
        </div>
        
        {canWrite && (
          <Link href="/students/new" className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0f2240] text-white text-sm font-semibold hover:bg-[#1e3a68] transition-all shadow-sm shadow-blue-900/20">
            <Plus size={18} />
            Добави ученик
          </Link>
        )}
      </div>

      {/* FILTER SECTION */}
      <div className="mb-6">
        <StudentsFilter
          classes={visibleClasses}
          currentSearch={search}
          currentClass={params.class || ''}
        />
      </div>

      {/* TABLE/LIST SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="text-left px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Три имена</th>
                <th className="text-left px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Паралелка</th>
                <th className="text-left px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Дата на раждане</th>
                <th className="text-left px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Статус</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((enrollment) => (
                <tr key={enrollment.id} className="group hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">{getFullName(enrollment.student)}</td>
                  <td className="px-6 py-4 text-slate-600">{(enrollment.class as any)?.name || '—'}</td>
                  <td className="px-6 py-4 text-slate-500">{enrollment.student?.birth_date ? formatDate(enrollment.student.birth_date) : '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      enrollment.student?.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {enrollment.student?.status === 'active' ? 'Активен' : 'Архивиран'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/students/${enrollment.student?.id}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] uppercase tracking-widest">
                      Преглед <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filtered.length === 0 && (
          <div className="text-center py-20">
            <Users className="mx-auto mb-3 text-slate-300" size={40} />
            <p className="text-sm text-slate-500 font-medium">Няма намерени ученици</p>
          </div>
        )}
      </div>
    </div>
  )
}
