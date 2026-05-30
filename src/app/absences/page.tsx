import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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
    .from('academic_years')
    .select('*')
    .eq('is_current', true)
    .single()

  // Класният вижда само своята паралелка
  let classQuery = supabase
    .from('classes')
    .select('*')
    .eq('academic_year_id', currentYear?.id)
    .order('name')

  if (profile?.role === 'class_teacher' && profile?.class_id) {
    classQuery = classQuery.eq('id', profile.class_id)
  }

  const { data: classes } = await classQuery

  const MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
  const currentMonth = new Date().getMonth() + 1

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Месечни отсъствия</h1>
        <p className="text-slate-500 text-sm mt-1">
          Класните въвеждат данните до 10-то число · {currentYear?.name}
        </p>
      </div>

      <div className="grid gap-4">
        {classes?.map(cls => (
          <div key={cls.id} className="card">
            <h2 className="font-medium text-slate-700 mb-4">Паралелка {cls.name}</h2>
            <div className="grid grid-cols-5 gap-2">
              {MONTHS.map(month => {
                const isCurrent = month === currentMonth
                return (
                  
                    key={month}
                    href={`/absences/${cls.id}/${month}`}
                    className={`flex flex-col items-center p-3 rounded-lg border text-sm transition-colors
                      ${isCurrent
                        ? 'border-blue-200 bg-blue-50 text-blue-700 font-medium'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                  >
                    <span>{getMonthName(month)}</span>
                    {isCurrent && <span className="text-xs mt-0.5 opacity-70">текущ</span>}
                  </a>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
