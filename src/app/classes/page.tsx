import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings2, CalendarClock, Users } from 'lucide-react'
import { BackButton } from '@/components/ui/BackButton'
import { getFullName } from '@/lib/utils'
export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const tab = params.tab === 'coud' ? 'coud' : 'classes'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()
  const { data: myProfile } = await supabase
    .from('staff_profiles').select('id, role, is_coordinator').eq('user_id', user.id).single()
  const isManager = ['admin', 'zdud', 'director'].includes(myProfile?.role || '') || myProfile?.is_coordinator === true
  let myClassIds: string[] | null = null
  if (!isManager && myProfile?.id) {
    const { data: myCta } = await supabase
      .from('class_teacher_assignments').select('class_id')
      .eq('staff_id', myProfile.id).eq('academic_year_id', currentYear?.id)
    myClassIds = (myCta || []).map(a => a.class_id)
  }
  let classesQuery = supabase
    .from('classes').select('*').eq('academic_year_id', currentYear?.id).order('name')
  if (myClassIds !== null) {
    classesQuery = classesQuery.in('id', myClassIds.length > 0 ? myClassIds : ['no-results'])
  }
  const { data: classes } = await classesQuery
  const { data: allEnrollmentsRaw } = await supabase
    .from('student_enrollments')
    .select('class_id, student_id, student:students(id, status)')
    .eq('academic_year_id', currentYear?.id)
  const enrollments = (allEnrollmentsRaw || []).filter((e: any) => e.student?.status === 'active')
  const { data: assignments } = await supabase
    .from('class_teacher_assignments')
    .select('class_id, staff:staff_profiles(first_name, last_name, is_active)')
    .eq('academic_year_id', currentYear?.id)
  const countByClass = new Map<string, number>()
  enrollments?.forEach(e => countByClass.set(e.class_id, (countByClass.get(e.class_id) || 0) + 1))
  const teachersByClass = new Map<string, string[]>()
  assignments?.forEach((a: any) => {
    if (!teachersByClass.has(a.class_id)) teachersByClass.set(a.class_id, [])
    if (a.staff && a.staff.is_active !== false) teachersByClass.get(a.class_id)!.push(getFullName(a.staff))
  })
  // ── ЦОУД данни ──
  const { data: coudGroups } = await supabase
    .from('coud_groups')
    .select('*, teacher:staff_profiles(first_name, last_name)')
    .eq('academic_year_id', currentYear?.id)
    .order('name')
  const { data: coudEnrollments } = await supabase
    .from('coud_enrollments')
    .select('coud_group_id, student:students(id, first_name, middle_name, last_name)')
    .eq('academic_year_id', currentYear?.id)
  type CoudRow = { groupName: string; teacher: string; studentName: string; isFirst: boolean }
  const coudRows: CoudRow[] = []
  ;(coudGroups || []).forEach(g => {
    const teacher = (g.teacher as any) ? `${(g.teacher as any).first_name} ${(g.teacher as any).last_name}` : '—'
    const students = (coudEnrollments || [])
      .filter((e: any) => e.coud_group_id === g.id)
      .map((e: any) => getFullName(e.student))
      .sort((a: string, b: string) => a.localeCompare(b, 'bg'))
    if (students.length === 0) {
      coudRows.push({ groupName: g.name, teacher, studentName: '—', isFirst: true })
    } else {
      students.forEach((name, i) => {
        coudRows.push({ groupName: g.name, teacher, studentName: name, isFirst: i === 0 })
      })
    }
  })
  const coudStudentCount = (coudEnrollments || []).length
  return (
    <div className="p-4 md:p-8">
      <BackButton />
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">
          {tab === 'coud' ? 'ЦОУД групи' : 'Паралелки'}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {tab === 'coud'
            ? `${coudGroups?.length || 0} групи · ${coudStudentCount} ученика · ${currentYear?.name}`
            : `${classes?.length || 0} паралелки · ${currentYear?.name}`}
        </p>
      </div>
      {/* ТАБОВЕ */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-sm w-fit">
        <Link href="/classes"
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'classes' ? 'bg-[#0f2240] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}>
          Паралелки
        </Link>
        <Link href="/classes?tab=coud"
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'coud' ? 'bg-[#0f2240] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}>
          ЦОУД групи
        </Link>
      </div>
     {isManager && (
        <Link href={tab === 'coud' ? '/admin/coud' : '/admin/years'}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-sm transition-all">
          <Settings2 size={13} className="text-slate-400" />
          {tab === 'coud' ? 'Редакция на ЦОУД групите' : 'Редакция на паралелките'}
        </Link>
      )}
      </div>
      {tab === 'coud' ? (
        /* ── ЦОУД ТАБЛИЦА ── */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Група</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Възпитател</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Ученик</th>
                </tr>
              </thead>
              <tbody>
                {coudRows.map((r, idx) => (
                  <tr key={idx}
                    className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors ${
                      r.isFirst && idx > 0 ? 'border-t-2 border-t-slate-200' : ''
                    }`}>
                    <td className="px-4 py-2 font-semibold text-slate-800 whitespace-nowrap align-top">
                      {r.isFirst ? r.groupName : ''}
                    </td>
                    <td className="px-4 py-2 text-slate-600 text-xs whitespace-nowrap align-top">
                      {r.isFirst ? r.teacher : ''}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{r.studentName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {coudRows.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">Няма ЦОУД групи</div>
          )}
        </div>
      ) : (
        <>
          {/* ДЕСКТОП: таблица — чиста (Паралелка · Класен · Уч. · Разписание) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-50/70 border-b border-slate-200">
                  <tr className="[&>th]:border-r [&>th]:border-slate-100 [&>th:last-child]:border-r-0">
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Паралелка</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Класен ръководител</th>
                    <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ученици</th>
                    <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Разписание</th>
                  </tr>
                </thead>
                <tbody>
                  {classes?.map((cls, idx) => {
                    const count = countByClass.get(cls.id) || 0
                    const teachers = teachersByClass.get(cls.id) || []
                    return (
                      <tr key={cls.id}
                          className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors [&>td]:border-r [&>td]:border-slate-100 [&>td:last-child]:border-r-0 ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                        <td className="px-4 py-2.5">
                          <Link href={`/classes/${cls.id}`} className="font-semibold text-slate-800 hover:text-blue-700 hover:underline transition-colors">
                            {cls.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">{teachers.join(', ') || '—'}</td>
                        <td className="text-center px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                            <Users size={13} className="text-slate-400" />{count}
                          </span>
                        </td>
                        <td className="text-center px-4 py-2.5">
                          <Link href={`/classes/${cls.id}/schedule`} className="inline-flex items-center justify-center text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg p-1.5 transition-colors" title="Седмично разписание">
                            <CalendarClock size={16} />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!classes?.length && <div className="text-center py-12 text-slate-400 text-sm">Няма паралелки</div>}
          </div>
          {/* МОБИЛЕН: карти — чисти */}
          <div className="md:hidden space-y-3">
            {!classes?.length && <div className="text-center py-12 text-slate-400 text-sm">Няма паралелки</div>}
            {classes?.map((cls) => {
              const count = countByClass.get(cls.id) || 0
              const teachers = teachersByClass.get(cls.id) || []
              return (
                <div key={cls.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/classes/${cls.id}`} className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 text-base hover:text-blue-700 transition-colors">Паралелка {cls.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{teachers.join(', ') || 'Без класен'}</div>
                    </Link>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                        <Users size={14} className="text-slate-400" />{count}
                      </span>
                      <Link href={`/classes/${cls.id}/schedule`} className="text-teal-600 hover:text-teal-700 p-1" title="Разписание">
                        <CalendarClock size={18} />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
