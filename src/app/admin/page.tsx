import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Settings, Calendar, BookOpen, Bell } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: years } = await supabase
    .from('academic_years')
    .select('*')
    .order('start_date', { ascending: false })

  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: deadlines } = await supabase
    .from('calendar_deadlines')
    .select('*')
    .order('deadline_date')
    .limit(10)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Администрация</h1>
        <p className="text-slate-500 text-sm mt-1">Управление на системата</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <a href="/admin/years" className="card hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Calendar size={18} className="text-blue-600" />
            </div>
            <h2 className="font-medium text-slate-700">Учебни години</h2>
          </div>
          <p className="text-sm text-slate-500">Управление на учебни години и паралелки</p>
        </a>

        <a href="/admin/staff" className="card hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <Settings size={18} className="text-purple-600" />
            </div>
            <h2 className="font-medium text-slate-700">Служители</h2>
          </div>
          <p className="text-sm text-slate-500">Добавяне и управление на потребители</p>
        </a>

        <a href="/admin/announcements" className="card hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Bell size={18} className="text-amber-600" />
            </div>
            <h2 className="font-medium text-slate-700">Съобщения</h2>
          </div>
          <p className="text-sm text-slate-500">Публикуване на обяви и съобщения</p>
        </a>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Academic years */}
        <div className="card">
          <h2 className="font-medium text-slate-700 text-sm mb-4 pb-3 border-b border-slate-100">
            Учебни години
          </h2>
          <div className="space-y-2">
            {years?.map(year => (
              <div key={year.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-700">{year.name}</div>
                  <div className="text-xs text-slate-400">
                    {formatDate(year.start_date)} — {formatDate(year.end_date)}
                  </div>
                </div>
                {year.is_current && (
                  <span className="badge-completed">Текуща</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Deadlines */}
        <div className="card">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h2 className="font-medium text-slate-700 text-sm">Срокове в календара</h2>
            <a href="/admin/deadlines" className="text-xs text-slate-400 hover:text-slate-700">+ Добави</a>
          </div>
          <div className="space-y-2">
            {deadlines?.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="text-sm text-slate-700">{d.title}</div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  d.color === 'red' ? 'bg-red-100 text-red-700' :
                  d.color === 'yellow' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {formatDate(d.deadline_date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
