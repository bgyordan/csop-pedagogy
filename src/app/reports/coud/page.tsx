import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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

  // Плосък списък редове: група, възпитател, ученик
  type Row = { groupName: string; teacher: string; studentName: string; isFirstInGroup: boolean; groupSize: number }
  const rows: Row[] = []

  ;(groups || []).forEach(g => {
    const teacher = (g.teacher as any) ? `${(g.teacher as any).first_name} ${(g.teacher as any).last_name}` : '—'
    const groupStudents = (enrollments || [])
      .filter((e: any) => e.coud_group_id === g.id)
      .map((e: any) => getFullName(e.student))
      .sort((a: string, b: string) => a.localeCompare(b, 'bg'))

    if (groupStudents.length === 0) {
      rows.push({ groupName: g.name, teacher, studentName: '—', isFirstInGroup: true, groupSize: 1 })
    } else {
      groupStudents.forEach((name, idx) => {
        rows.push({ groupName: g.name, teacher, studentName: name, isFirstInGroup: idx === 0, groupSize: groupStudents.length })
      })
    }
  })

  const totalStudents = (enrollments || []).length

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
        <ArrowLeft size={15} /> Назад към справки
      </Link>

      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">ЦОУД групи</h1>
        <p className="text-slate-500 text-sm mt-1">
          {currentYear?.name} · {(groups || []).length} групи · {totalStudents} ученика
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 text-center shadow-sm">
          <p className="text-slate-400 text-sm">Няма създадени ЦОУД групи</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Група</th>
                  <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Възпитател</th>
                  <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ученик</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors ${row.isFirstInGroup && idx > 0 ? 'border-t-2 border-t-slate-200' : ''}`}>
                    <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap align-top">
                      {row.isFirstInGroup ? row.groupName : ''}
                    </td>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap align-top">
                      {row.isFirstInGroup ? row.teacher : ''}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{row.studentName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
