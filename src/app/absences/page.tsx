import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getMonthName } from '@/lib/utils'

export default async function AbsencesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('role, class_id')
    .eq('user_id', user.id)
    .single()

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  let classQuery = supabase
    .from('classes').select('*').eq('academic_year_id', currentYear?.id).order('name')

  if (profile?.role === 'class_teacher' && profile?.class_id) {
    classQuery = classQuery.eq('id', profile.class_id)
  }

  const { data: classes } = await classQuery

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentDay = now.getDate()
  const currentYearNum = now.getFullYear()
  const deadlinePassed = currentDay > 8

  // Get submitted absences for current month
  const { data: submitted } = await supabase
    .from('monthly_absences')
    .select('class_id')
    .eq('month', currentMonth)
    .eq('year', currentYearNum)

  const submittedClassIds = new Set(submitted?.map(s => s.class_id) || [])

  const isAdmin = ['admin', 'zdud', 'director'].includes(profile?.role || '')

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Реализация на ИУП</h1>
        <p className="text-slate-500 text-sm mt-1">
          {currentYear?.name} · Текущ месец: <strong>{getMonthName(currentMonth)}</strong> · Срок за въвеждане: <strong className={deadlinePassed ? 'text-red-600' : 'text-green-600'}>до 8-мо число</strong>
        </p>
      </div>

      {isAdmin ? (
        // Admin/ZDUD view — all classes with status
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Паралелка</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Статус — {getMonthName(currentMonth)}</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {classes?.map((cls, idx) => {
                const isSubmitted = submittedClassIds.has(cls.id)
                return (
                  <tr key={cls.id} className={`border-b border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{cls.name}</td>
                    <td className="px-4 py-2.5 text-center">
                      {isSubmitted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          ✓ Въведено
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                          deadlinePassed ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {deadlinePassed ? '⚠ Просрочено' : '— Невъведено'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/absences/${cls.id}/${currentMonth}`} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                        Преглед →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // Class teacher view — only their class, all months
        <div className="grid gap-4">
          {classes?.map(cls => (
            <div key={cls.id} className="card">
              <h2 className="font-medium text-slate-700 mb-4">Паралелка {cls.name}</h2>
              <div className="grid grid-cols-5 gap-2">
                {[9, 10, 11, 12, 1, 2, 3, 4, 5, 6].map(month => {
                  const isCurrent = month === currentMonth
                  const isSubmittedMonth = submittedClassIds.has(cls.id) && isCurrent
                  return (
                    <Link
                      key={month}
                      href={`/absences/${cls.id}/${month}`}
                      className={`flex flex-col items-center p-3 rounded-lg border text-sm transition-colors ${
                        isCurrent
                          ? 'border-blue-200 bg-blue-50 text-blue-700 font-medium'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span>{getMonthName(month)}</span>
                      {isCurrent && <span className="text-xs mt-0.5 opacity-70">текущ</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
