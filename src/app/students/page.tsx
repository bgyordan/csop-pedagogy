import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, Users } from 'lucide-react'
import { formatDate, getFullName } from '@/lib/utils'

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
    .from('academic_years')
    .select('*')
    .eq('is_current', true)
    .single()

  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .eq('academic_year_id', currentYear?.id)
    .order('name')

  let query = supabase
    .from('student_enrollments')
    .select(`*, student:students(*), class:classes(*)`)
    .eq('academic_year_id', currentYear?.id)

  if (params.class) {
    query = query.eq('class_id', params.class)
  }

  const { data: enrollments } = await query

  const filtered = enrollments?.filter(e => {
    if (!search) return true
    const name = getFullName(e.student).toLowerCase()
    return name.includes(search.toLowerCase())
  })

  const profile = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const canWrite = ['admin', 'zdud'].includes(profile.data?.role || '')

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Ученици</h1>
          <p className="text-slate-500 text-sm mt-1">
            {filtered?.length || 0} ученика · {currentYear?.name}
          </p>
        </div>
        {canWrite && (
          <Link
            href="/students/new"
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#0f2240' }}
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Нов ученик</span>
            <span className="sm:hidden">Нов</span>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-4 md:mb-6">
        <form className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Търси по три имена..."
              className="input pl-9 w-full"
            />
          </div>
          <select
            name="class"
            className="input sm:w-48"
            defaultValue={params.class || ''}
          >
            <option value="">Всички паралелки</option>
            {classes?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </form>
      </div>

      {/* ДЕСКТОП: таблица */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Три имена</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Паралелка</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Дата на раждане</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Статус</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered?.map(enrollment => (
              <tr key={enrollment.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-slate-800">
                  {getFullName(enrollment.student)}
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {enrollment.class?.name || '—'}
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {enrollment.student?.birth_date ? formatDate(enrollment.student.birth_date) : '—'}
                </td>
                <td className="px-5 py-3.5">
                  <span className={enrollment.student?.status === 'active' ? 'badge-completed' : 'badge-empty'}>
                    {enrollment.student?.status === 'active' ? 'Активен' : 'Архивиран'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <Link
                    href={`/students/${enrollment.student?.id}`}
                    className="text-xs font-medium hover:underline"
                    style={{ color: '#0f2240' }}
                  >
                    Преглед →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!filtered || filtered.length === 0) && (
          <div className="text-center py-16 text-slate-400">
            <Users className="mx-auto mb-2 opacity-30" size={32} />
            <p className="text-sm">Няма намерени ученици</p>
          </div>
        )}
      </div>

      {/* МОБИЛЕН: карти */}
      <div className="md:hidden space-y-2">
        {(!filtered || filtered.length === 0) && (
          <div className="text-center py-16 text-slate-400">
            <Users className="mx-auto mb-2 opacity-30" size={32} />
            <p className="text-sm">Няма намерени ученици</p>
          </div>
        )}
        {filtered?.map(enrollment => (
          <Link
            key={enrollment.id}
            href={`/students/${enrollment.student?.id}`}
            className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 hover:shadow-sm transition-shadow gap-3"
          >
            <div className="min-w-0">
              <div className="font-medium text-slate-800 text-sm truncate">
                {getFullName(enrollment.student)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Пар. {enrollment.class?.name || '—'}
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
