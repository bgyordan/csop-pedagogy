import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Coffee, User } from 'lucide-react'
import { getFullName } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function CoudReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('role, is_coordinator').eq('user_id', user.id).single()
  const canAccess = ['admin', 'zdud', 'director', 'class_teacher'].includes(profile?.role || '') || profile?.is_coordinator === true
  if (!canAccess) redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  const { data: groups } = await supabase
    .from('coud_groups')
    .select('*, teacher:staff_profiles(first_name, last_name)')
    .eq('academic_year_id', currentYear?.id)
    .order('name')

  const { data: enrollments } = await supabase
    .from('coud_enrollments')
    .select('coud_group_id, student:students(id, first_name, middle_name, last_name)')
    .eq('academic_year_id', currentYear?.id)

  const groupsWithStudents = (groups || []).map(g => {
    const students = (enrollments || [])
      .filter((e: any) => e.coud_group_id === g.id)
      .map((e: any) => getFullName(e.student))
      .sort((a: string, b: string) => a.localeCompare(b, 'bg'))
    return { ...g, students }
  })

  const totalStudents = (enrollments || []).length

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
        <ArrowLeft size={15} /> Назад към справки
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">ЦОУД групи</h1>
        <p className="text-slate-500 text-sm mt-1">
          {currentYear?.name} · {groupsWithStudents.length} групи · {totalStudents} ученика
        </p>
      </div>

      {groupsWithStudents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <Coffee size={28} className="mx-auto mb-2 text-slate-300" />
          <p className="text-slate-400 text-sm">Няма създадени ЦОУД групи</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupsWithStudents.map(g => (
            <div key={g.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                    <Coffee size={16} className="text-slate-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{g.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <User size={11} />
                      {g.teacher ? `${g.teacher.first_name} ${g.teacher.last_name}` : 'Без възпитател'}
                    </div>
                  </div>
                  <span className="ml-auto text-xs text-slate-400">{g.students.length} уч.</span>
                </div>
              </div>
              {g.students.length === 0 ? (
                <p className="text-sm text-slate-400 px-5 py-4">Няма ученици</p>
              ) : (
                <ol className="divide-y divide-slate-50">
                  {g.students.map((name, i) => (
                    <li key={i} className="flex items-center gap-3 px-5 py-2">
                      <span className="text-xs text-slate-400 w-6 flex-shrink-0 text-right">{i + 1}.</span>
                      <span className="text-sm text-slate-700">{name}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
