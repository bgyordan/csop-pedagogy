import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import Link from 'next/link'
import { FileSpreadsheet } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EnrollmentsReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('role').eq('user_id', user.id).single()

  const canAccess = ['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')
  if (!canAccess) redirect('/dashboard')

  // Текуща учебна година
  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  // Всички ученици с паралелки
  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select(`
      student:students(id, first_name, last_name, sending_school:sending_schools(name, city)),
      class:classes(name)
    `)
    .eq('academic_year_id', currentYear?.id)
    .order('class_id')

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

  const enrollSet = new Set((corrEnroll || []).map(c => c.student_id))
  const coudSet = new Set((corrCoud || []).map(c => c.student_id))

  // Сортираме по паралелка после по фамилия
  const rows = (enrollments || [])
    .map((e: any) => ({
      studentId: e.student?.id,
      name: `${e.student?.last_name} ${e.student?.first_name}`,
      school: e.student?.sending_school ? `${e.student.sending_school.name}` : '—',
      className: e.class?.name || '—',
      hasEnroll: enrollSet.has(e.student?.id),
      hasCoud: coudSet.has(e.student?.id),
    }))
    .sort((a, b) => {
      const cls = a.className.localeCompare(b.className)
      if (cls !== 0) return cls
      return a.name.localeCompare(b.name)
    })

  const totalEnroll = rows.filter(r => r.hasEnroll).length
  const totalCoud = rows.filter(r => r.hasCoud).length

  return (
    <div className="p-4 md:p-8">
      <BackButton />
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Справка — Заявления</h1>
          <p className="text-slate-500 text-sm mt-1">{currentYear?.name} · {rows.length} ученика</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-400">Записване</div>
            <div className="text-2xl font-bold text-green-600">{totalEnroll}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">ЦОУД</div>
            <div className="text-2xl font-bold text-indigo-600">{totalCoud}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#f0f7ff] border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">#</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ученик</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Изпращащо училище</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Пар. ЦСОП</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Записване</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ЦОУД</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Няма данни</td></tr>
              ) : rows.map((row, idx) => (
                <tr key={idx} className={`border-b border-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                  <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-2 font-semibold text-slate-800">{row.name}</td>
                  <td className="px-4 py-2 text-slate-600 max-w-[200px] truncate">{row.school}</td>
                  <td className="px-4 py-2">
                    <span className="font-mono font-bold text-[#0f2240]">{row.className}</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {row.hasEnroll
                      ? <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 rounded-full font-bold text-sm">✓</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {row.hasCoud
                      ? <span className="inline-flex items-center justify-center w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full font-bold text-sm">✓</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
