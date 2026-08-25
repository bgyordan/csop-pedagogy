import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Users, ChevronRight, GraduationCap, Home, Coffee, Wifi, X, LayoutGrid, Sparkles, HelpCircle, Archive } from 'lucide-react'
import { formatDate, getFullName } from '@/lib/utils'
import { StudentsFilter } from './StudentsFilter'

const FILTER_LABELS: Record<string, string> = {
  'incomplete': 'Непълни данни',
  'form=daily': 'Дневна форма',
  'form=ifo': 'ИФО',
  'coud': 'Записани в ЦОУД',
  'ores': 'В ОРЕС в момента',
  'new': 'Нови ученици',
  'unassigned': 'Неразпределени',
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string; form?: string; coud?: string; ores?: string; incomplete?: string; new?: string; unassigned?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const params = await searchParams
  const search = params.q || ''
  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()
  const { data: profileData } = await supabase
    .from('staff_profiles').select('id, role, is_coordinator').eq('user_id', user.id).single()
  const role = profileData?.role || ''
  const isCoordinator = profileData?.is_coordinator === true
  const isClassTeacher = role === 'class_teacher'
  const isSpecialist = ['psychologist', 'speech_therapist', 'rehabilitator'].includes(role)
  const canWrite = ['admin', 'zdud'].includes(role)
  // Кой вижда неразпределените — админ, ЗДУД, координатор
  const canSeeUnassigned = canWrite || isCoordinator

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
  } else if (isSpecialist && !isCoordinator) {
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

  // ── НЕРАЗПРЕДЕЛЕНИ: активни ученици без записване за текущата година ──
  // Виждат се от админ/ЗДУД/координатор
  type Row = { key: string; student: any; className: string | null; unassigned: boolean }
  let unassignedRows: Row[] = []
  if (canSeeUnassigned) {
    // ВСИЧКИ записани за годината (без филтъра по паралелка) — иначе филтърът лъже кой е "неразпределен"
    const { data: allEnrolledForYear } = await supabase
      .from('student_enrollments').select('student_id')
      .eq('academic_year_id', currentYear?.id)
    const enrolledIds = new Set((allEnrolledForYear || []).map(e => e.student_id))
    const { data: allActive } = await supabase
      .from('students').select('*').eq('status', 'active')
    unassignedRows = (allActive || [])
      .filter(s => !enrolledIds.has(s.id))
      .map(s => ({ key: `u-${s.id}`, student: s, className: null, unassigned: true }))
  }

  // ОРЕС филтър — активни днес
  let oresStudentIds: Set<string> | null = null
  if (params.ores === '1') {
    const today = new Date().toISOString().split('T')[0]
    const { data: oresData } = await supabase
      .from('student_ores').select('student_id, from_date, to_date').lte('from_date', today)
    oresStudentIds = new Set(
      (oresData || []).filter(o => !o.to_date || o.to_date >= today).map(o => o.student_id)
    )
  }

  // Записаните -> редове
  let enrolledRows: Row[] = (enrollments || [])
    .filter(e => e.student?.status === 'active')
    .map(e => ({
      key: e.id,
      student: e.student,
      className: (e.class as any)?.name || null,
      unassigned: false,
    }))

  // Обединяваме. Ако е избрана конкретна паралелка от падащото меню — неразпределените нямат паралелка, скриваме ги.
  let allRows: Row[] = params.class
    ? [...enrolledRows]
    : [...enrolledRows, ...unassignedRows]

  // Филтри
  allRows = allRows.filter(r => {
    if (search && !getFullName(r.student).toLowerCase().includes(search.toLowerCase())) return false
    if (oresStudentIds && !oresStudentIds.has(r.student?.id)) return false
    if (params.new === '1' && !r.student?.is_new) return false
    if (params.unassigned === '1' && !r.unassigned) return false
    if (params.incomplete === '1') {
      const st = r.student
      const noClass = !st?.external_class?.trim()
      const noSchool = !st?.sending_school_id && !st?.sending_school_other?.trim()
      if (!noClass && !noSchool) return false
    }
    return true
  })

  // Подредба: неразпределените отгоре, после по име
  allRows.sort((a, b) => {
    if (a.unassigned !== b.unassigned) return a.unassigned ? -1 : 1
    return getFullName(a.student).localeCompare(getFullName(b.student), 'bg')
  })

  const newCount = allRows.filter(r => r.student?.is_new).length
  const unassignedCount = [...enrolledRows, ...unassignedRows].filter(r => r.unassigned).length

  let activeFilter = ''
  if (params.incomplete === '1') activeFilter = 'incomplete'
  else if (params.new === '1') activeFilter = 'new'
  else if (params.unassigned === '1') activeFilter = 'unassigned'
  else if (params.form === 'daily') activeFilter = 'form=daily'
  else if (params.form === 'ifo') activeFilter = 'form=ifo'
  else if (params.coud === '1') activeFilter = 'coud'
  else if (params.ores === '1') activeFilter = 'ores'

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ученици</h1>
          <p className="text-slate-500 text-sm mt-1">{allRows.length} ученици · {currentYear?.name}</p>
        </div>
                <div className="flex items-center gap-2">
          {['admin', 'zdud', 'director', 'secretary'].includes(role) && (
            <Link href="/students/archived" className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 text-sm font-semibold hover:bg-slate-50 transition-all">
              <Archive size={17} /> Архивирани
            </Link>
          )}
          {['admin', 'zdud', 'director'].includes(role) && (
            <Link href="/students/documents" className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all">
              <LayoutGrid size={17} /> Досиета
            </Link>
          )}
          {canWrite && (
            <Link href="/students/new" className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0f2240] text-white text-sm font-semibold hover:bg-[#1e3a68] transition-all shadow-sm shadow-blue-900/20">
              <Plus size={18} /> Добави ученик
            </Link>
          )}
        </div>
      </div>

      {/* Бързи филтри */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {newCount > 0 && (
          <Link href={params.new === '1' ? '/students' : '/students?new=1'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              params.new === '1' ? 'bg-violet-600 text-white border-violet-600' : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
            }`}>
            <Sparkles size={13} /> Нови ученици
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${params.new === '1' ? 'bg-white/20' : 'bg-violet-200/60'}`}>{newCount}</span>
          </Link>
        )}
        {canSeeUnassigned && unassignedCount > 0 && (
          <Link href={params.unassigned === '1' ? '/students' : '/students?unassigned=1'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              params.unassigned === '1' ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}>
            <HelpCircle size={13} /> Неразпределени
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${params.unassigned === '1' ? 'bg-white/20' : 'bg-amber-200/60'}`}>{unassignedCount}</span>
          </Link>
        )}
      </div>

      {/* Индикатор за избрана паралелка */}
      {params.class && (
        <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <span className="font-medium">Паралелка {allRows[0]?.className || ''}</span>
            <span className="text-slate-400">· {allRows.length} ученика</span>
          </div>
          <Link href="/students" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors">
            <X size={13} /> Изчисти
          </Link>
        </div>
      )}

      {/* Активен специален филтър */}
      {activeFilter && (
        <div className="mb-4 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            {activeFilter.startsWith('form=daily') && <GraduationCap size={15} className="text-slate-400" />}
            {activeFilter === 'form=ifo' && <Home size={15} className="text-slate-400" />}
            {activeFilter === 'coud' && <Coffee size={15} className="text-slate-400" />}
            {activeFilter === 'ores' && <Wifi size={15} className="text-amber-500" />}
            {activeFilter === 'new' && <Sparkles size={15} className="text-violet-500" />}
            {activeFilter === 'unassigned' && <HelpCircle size={15} className="text-amber-500" />}
            <span className="font-medium">{FILTER_LABELS[activeFilter]}</span>
            <span className="text-slate-400">· {allRows.length} ученика</span>
          </div>
          <Link href="/students" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors">
            <X size={13} /> Изчисти
          </Link>
        </div>
      )}

      {/* FILTER */}
      <div className="mb-6">
        <StudentsFilter classes={visibleClasses} currentSearch={search} currentClass={params.class || ''} />
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Три имена</th>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Паралелка</th>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Дата на раждане</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allRows.map((r, i) => (
                <tr key={r.key} className={`group transition-colors hover:bg-blue-50/40 ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                  <td className="px-6 py-1.5 font-semibold text-slate-800">
                    <span className="inline-flex items-center gap-2">
                      {getFullName(r.student)}
                      {r.student?.is_new && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 uppercase tracking-wide">
                          <Sparkles size={9} /> Нов
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-1.5">
                    {r.className ? (
                      <span className="text-slate-600">{r.className}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        без паралелка
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-1.5 text-slate-500">{r.student?.birth_date ? formatDate(r.student.birth_date) : '—'}</td>
                  <td className="px-6 py-1.5 text-right">
                    <Link href={`/students/${r.student?.id}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] uppercase tracking-widest">
                      Преглед <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {allRows.length === 0 && (
          <div className="text-center py-20">
            <Users className="mx-auto mb-3 text-slate-300" size={40} />
            <p className="text-sm text-slate-500 font-medium">Няма намерени ученици</p>
          </div>
        )}
      </div>
    </div>
  )
}
