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
    .select('role, id')
    .eq('user_id', user.id)
    .single()

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  const now = new Date()
  const currentDay = now.getDate()
  const currentMonth = now.getMonth() + 1
  const currentYearNum = now.getFullYear()

  const isActivePeriod = currentDay >= 28 || currentDay <= 8
  const reportMonth = currentDay >= 28 ? currentMonth : (currentMonth === 1 ? 12 : currentMonth - 1)
  const reportYear = currentDay >= 28 ? currentYearNum : (currentMonth === 1 ? currentYearNum - 1 : currentYearNum)
  const deadlinePassed = currentDay > 8 && currentDay < 28
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1

  const isAdmin = ['admin', 'zdud', 'director'].includes(profile?.role || '')

  let classes: any[] = []

  if (isAdmin) {
    const { data } = await supabase
      .from('classes').select('*').eq('academic_year_id', currentYear?.id).order('name')
    classes = data || []
  } else if (profile?.role === 'class_teacher') {
    const { data } = await supabase
      .from('class_teacher_assignments')
      .select('class:classes(*)')
      .eq('staff_id', profile.id)
      .eq('academic_year_id', currentYear?.id)
    classes = data?.map((d: any) => d.class).filter(Boolean) || []
  }

  const { data: submitted } = await supabase
    .from('monthly_absences')
    .select('class_id')
    .eq('month', reportMonth)
    .eq('year', reportYear)

  const submittedIds = new Set(submitted?.map(s => s.class_id) || [])

  // Извън активен период — само класен вижда това съобщение
  if (!isActivePeriod && !isAdmin) {
    return (
      <div className="p-4 md:p-8">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800 mb-2">Реализация на ИУП</h1>
        <p className="text-slate-500 text-sm mb-8">{currentYear?.name}</p>
        <div className="card text-center py-12">
          <p className="text-slate-500 text-sm">
            Периодът за въвеждане е от <strong>28-ми</strong> до <strong>8-ми на следващия месец</strong>.
          </p>
          <p className="text-slate-400 text-xs mt-2">
            Следващ период: от 28 {getMonthName(currentMonth)} до 8 {getMonthName(nextMonth)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Реализация на ИУП</h1>
        <p className="text-slate-500 text-sm mt-1 flex flex-wrap gap-x-2">
          <span>{currentYear?.name}</span>
          <span>· Месец: <strong>{getMonthName(reportMonth)}</strong></span>
          <span>· Срок: <strong className={deadlinePassed ? 'text-red-600' : 'text-green-600'}>
            до 8 {getMonthName(nextMonth)}
          </strong></span>
        </p>
      </div>

      {isAdmin ? (
        <>
          {/* ДЕСКТОП: таблица */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Паралелка</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Статус — {getMonthName(reportMonth)}
                  </th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls, idx) => {
                  const isSubmitted = submittedIds.has(cls.id)
                  return (
                    <tr key={cls.id}
                        className={`border-b border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
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
                        <Link href={`/absences/${cls.id}/${reportMonth}`}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
                          Преглед →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* МОБИЛЕН: карти */}
          <div className="md:hidden space-y-2">
            {classes.map(cls => {
              const isSubmitted = submittedIds.has(cls.id)
              return (
                <Link key={cls.id} href={`/absences/${cls.id}/${reportMonth}`}
                  className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 hover:shadow-sm transition-shadow gap-3">
                  <span className="font-medium text-slate-800 text-sm">Пар. {cls.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isSubmitted ? (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">✓ Въведено</span>
                    ) : (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        deadlinePassed ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {deadlinePassed ? '⚠ Просрочено' : '— Невъведено'}
                      </span>
                    )}
                    <span className="text-slate-300 text-sm">›</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      ) : (
        // Класен ръководител — вече е responsive (grid с карти)
        <div className="grid gap-4">
          {classes.map(cls => (
            <div key={cls.id} className="card">
              <h2 className="font-medium text-slate-700 mb-4">Паралелка {cls.name}</h2>
              <Link
                href={`/absences/${cls.id}/${reportMonth}`}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div>
                  <div className="font-medium text-slate-700">{getMonthName(reportMonth)} {reportYear}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Срок до 8 {getMonthName(nextMonth)}</div>
                </div>
                <span className={`text-xs font-medium px-3 py-1 rounded-full flex-shrink-0 ${
                  submittedIds.has(cls.id) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {submittedIds.has(cls.id) ? '✓ Въведено' : '— Невъведено'}
                </span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
