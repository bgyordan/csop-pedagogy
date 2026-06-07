import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'

export const dynamic = 'force-dynamic'

export default async function EnrollmentsReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('role').eq('user_id', user.id).single()

  const canAccess = ['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')
  if (!canAccess) redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  // Следваща учебна година
  const now = new Date()
  const nextYearStart = now.getFullYear() + (now.getMonth() >= 8 ? 1 : 0)
  const nextYearLabel = `${nextYearStart}/${nextYearStart + 1}`

  // Заявления за записване (УВД-09)
  const { data: corrEnroll } = await supabase
    .from('correspondence')
    .select('student_id, date, number')
    .like('number', 'УВД-09-%')
    .not('student_id', 'is', null)

  // Заявления за ЦОУД (УВД-12)
  const { data: corrCoud } = await supabase
    .from('correspondence')
    .select('student_id, date, number')
    .like('number', 'УВД-12-%')
    .not('student_id', 'is', null)

  // Само ученици с поне едно заявление
  const allStudentIds = [...new Set([
    ...(corrEnroll || []).map(c => c.student_id),
    ...(corrCoud || []).map(c => c.student_id),
  ])]

  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select(`
      student:students(id, first_name, last_name, external_class, sending_school:sending_schools(name, city)),
      class:classes(name)
    `)
    .eq('academic_year_id', currentYear?.id)
    .in('student_id', allStudentIds.length > 0 ? allStudentIds : ['00000000-0000-0000-0000-000000000000'])

  const enrollMap = new Map((corrEnroll || []).map(c => [c.student_id, c.date]))
  const coudMap = new Map((corrCoud || []).map(c => [c.student_id, c.date]))

  const rows = (enrollments || [])
    .map((e: any) => ({
      studentId: e.student?.id,
      lastName: e.student?.last_name || '',
      firstName: e.student?.first_name || '',
      externalClass: e.student?.external_class || '—',
      school: e.student?.sending_school?.name || '—',
      schoolCity: e.student?.sending_school?.city || '',
      csopClass: e.class?.name || '—',
      enrollDate: enrollMap.get(e.student?.id) || null,
      coudDate: coudMap.get(e.student?.id) || null,
    }))
    .sort((a, b) => {
      const s = a.school.localeCompare(b.school, 'bg')
      if (s !== 0) return s
      return a.lastName.localeCompare(b.lastName, 'bg')
    })

  const totalEnroll = rows.filter(r => r.enrollDate).length
  const totalCoud = rows.filter(r => r.coudDate).length

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <BackButton />

      {/* Хедър */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">
            Заявления за учебна година {nextYearLabel}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {rows.length === 0 ? 'Няма подадени заявления' : `${rows.length} ученика с подадено заявление`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-green-50 border border-green-100 rounded-2xl px-5 py-3 text-center">
            <div className="text-2xl font-bold text-green-600">{totalEnroll}</div>
            <div className="text-[10px] font-bold text-green-500 uppercase tracking-wider mt-0.5">Записване</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3 text-center">
            <div className="text-2xl font-bold text-indigo-600">{totalCoud}</div>
            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mt-0.5">ЦОУД</div>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-slate-400 text-sm">Няма подадени заявления за {nextYearLabel}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#f0f7ff] border-b border-blue-100">
                <tr>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-10">#</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ученик</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Клас</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Изпращащо училище</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Пар. ЦСОП</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-green-600 uppercase tracking-widest">Записване</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-indigo-600 uppercase tracking-widest">ЦОУД</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.studentId || idx}
                    className={`border-b border-slate-100 transition-colors hover:bg-blue-50/30 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    }`}>
                    <td className="px-4 py-2.5 text-slate-300 font-mono">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-slate-800">{row.lastName} {row.firstName}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{row.externalClass}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-slate-700">{row.school}</span>
                      {row.schoolCity && <span className="text-slate-400 ml-1 text-[10px]">— {row.schoolCity}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-bold text-[#0f2240] bg-blue-50 px-2 py-0.5 rounded-md">{row.csopClass}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {row.enrollDate ? (
                        <div className="flex flex-col items-center">
                          <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 text-green-700 rounded-full text-xs font-bold">✓</span>
                          <span className="text-[9px] text-slate-400 mt-0.5">{new Date(row.enrollDate).toLocaleDateString('bg-BG')}</span>
                        </div>
                      ) : <span className="text-slate-200 text-base">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {row.coudDate ? (
                        <div className="flex flex-col items-center">
                          <span className="inline-flex items-center justify-center w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">✓</span>
                          <span className="text-[9px] text-slate-400 mt-0.5">{new Date(row.coudDate).toLocaleDateString('bg-BG')}</span>
                        </div>
                      ) : <span className="text-slate-200 text-base">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-xs font-bold text-slate-500">Общо: {rows.length} ученика</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-bold text-green-600">{totalEnroll}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-bold text-indigo-600">{totalCoud}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
