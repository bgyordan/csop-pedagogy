import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Users, ChevronRight, GraduationCap, Home, Coffee, Wifi, X } from 'lucide-react'
import { formatDate, getFullName } from '@/lib/utils'
import { StudentsFilter } from './StudentsFilter'

const FILTER_LABELS: Record<string, string> = {
  'form=daily': 'Дневна форма',
  'form=ifo': 'ИФО',
  'coud': 'Записани в ЦОУД',
  'ores': 'В ОРЕС в момента',
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string; form?: string; coud?: string; ores?: string }>
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
  if (params.form) query = query.eq('education_form', params.form)
  if (params.coud === '1') query = query.eq('coud_enrolled', true)

  const { data: enrollments } = await query

  // ОРЕС филтър — активни днес
  let oresStudentIds: Set<string> | null = null
  if (params.ores === '1') {
    const today = new Date().toISOString().split('T')[0]
    const { data: oresData } = await supabase
      .from('student_ores')
      .select('student_id, from_date, to_date')
      .lte('from_date', today)
    oresStudentIds = new Set(
      (oresData || [])
        .filter(o => !o.to_date || o.to_date >= today)
        .map(o => o.student_id)
    )
  }

  let filtered = (enrollments || []).filter(e => {
    if (search && !getFullName(e.student).toLowerCase().includes(search.toLowerCase())) return false
    if (oresStudentIds && !oresStudentIds.has(e.student?.id)) return false
    return true
  })

  // Активен специален филтър (за означение + печат)
  let activeFilter = ''
  if (params.form === 'daily') activeFilter = 'form=daily'
  else if (params.form === 'ifo') activeFilter = 'form=ifo'
  else if (params.coud === '1') activeFilter = 'coud'
  else if (params.ores === '1') activeFilter = 'ores'

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      {/* HEADER */}
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

      {/* Активен специален филтър */}
      {activeFilter && (
        <div className="mb-4 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            {activeFilter.startsWith('form=daily') && <GraduationCap size={15} className="text-slate-400" />}
            {activeFilter === 'form=ifo' && <Home size={15} className="text-slate-400" />}
            {activeFilter === 'coud' && <Coffee size={15} className="text-slate-400" />}
            {activeFilter === 'ores' && <Wifi size={15} className="text-amber-500" />}
            <span className="font-medium">{FILTER_LABELS[activeFilter]}</span>
            <span className="text-slate-400">· {filtered.length} ученика</span>
          </div>
          <Link href="/students" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors">
            <X size={13} /> Изчисти
          </Link>
        </div>
      )}

      {/* FILTER */}
      <div className="mb-6">
        <StudentsFilter
          classes={visibleClasses}
          currentSearch={search}
          currentClass={params.class || ''}
        />
      </div>

      {/* TABLE */}
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
