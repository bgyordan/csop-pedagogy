import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings2 } from 'lucide-react'
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

  const { data: classes } = await supabase
    .from('classes').select('*').eq('academic_year_id', currentYear?.id).order('name')

  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('class_id, student_id, student:students(id, first_name, middle_name, last_name, external_class, status, sending_school_other, sending_school:sending_schools(name, city))')
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

      <Link href={tab === 'coud' ? '/admin/coud' : '/admin/years'}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-sm transition-all">
        <Settings2 size={13} className="text-slate-400" />
        {tab === 'coud' ? 'Редакция на ЦОУД групите' : 'Редакция на паралелките'}
      </Link>
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
        </>
      )}
    </div>
  )
}
