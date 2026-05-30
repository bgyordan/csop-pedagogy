import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlertCircle, Clock, CheckCircle2, FileText, Users, Calendar } from 'lucide-react'
import { formatDate, getDaysUntil, getFullName } from '@/lib/utils'
import { DocumentStatus, DOCUMENT_TYPE_LABELS } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  // Fetch current year
  const { data: currentYear } = await supabase
    .from('academic_years')
    .select('*')
    .eq('is_current', true)
    .single()

  // Fetch deadlines
  const { data: deadlines } = await supabase
    .from('calendar_deadlines')
    .select('*')
    .eq('academic_year_id', currentYear?.id)
    .gte('deadline_date', new Date().toISOString().split('T')[0])
    .order('deadline_date')
    .limit(5)

  // Fetch announcements
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(5)

  // Fetch document stats
  const { data: docStats } = await supabase
    .from('documents')
    .select('status')
    .eq('academic_year_id', currentYear?.id)

  const stats = {
    total: docStats?.length || 0,
    completed: docStats?.filter(d => d.status === 'completed').length || 0,
    inProgress: docStats?.filter(d => d.status === 'in_progress').length || 0,
    empty: docStats?.filter(d => d.status === 'empty').length || 0,
  }

  // Fetch student count
  const { count: studentCount } = await supabase
    .from('student_enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('academic_year_id', currentYear?.id)

  const firstName = profile.first_name

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">
          Добре дошли, {firstName}!
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Учебна година {currentYear?.name} · {formatDate(new Date().toISOString())}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users size={18} className="text-blue-600" />
            </div>
            <span className="text-sm text-slate-500">Ученици</span>
          </div>
          <div className="text-3xl font-semibold text-slate-800">{studentCount || 0}</div>
          <div className="text-xs text-slate-400 mt-1">активни</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center">
              <FileText size={18} className="text-slate-500" />
            </div>
            <span className="text-sm text-slate-500">Непопълнени</span>
          </div>
          <div className="text-3xl font-semibold text-slate-800">{stats.empty}</div>
          <div className="text-xs text-slate-400 mt-1">документа</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock size={18} className="text-amber-600" />
            </div>
            <span className="text-sm text-slate-500">В процес</span>
          </div>
          <div className="text-3xl font-semibold text-slate-800">{stats.inProgress}</div>
          <div className="text-xs text-slate-400 mt-1">документа</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={18} className="text-green-600" />
            </div>
            <span className="text-sm text-slate-500">Завършени</span>
          </div>
          <div className="text-3xl font-semibold text-slate-800">{stats.completed}</div>
          <div className="text-xs text-slate-400 mt-1">документа</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Deadlines */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Calendar size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">Предстоящи срокове</h2>
          </div>
          {!deadlines?.length ? (
            <p className="text-sm text-slate-400">Няма предстоящи срокове</p>
          ) : (
            <div className="space-y-2">
              {deadlines.map(deadline => {
                const days = getDaysUntil(deadline.deadline_date)
                const isRed = days <= 7
                const isYellow = days <= 30 && days > 7
                return (
                  <div key={deadline.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                    <div>
                      <div className="text-sm font-medium text-slate-700">{deadline.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatDate(deadline.deadline_date)}</div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      isRed ? 'bg-red-100 text-red-700' :
                      isYellow ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {days === 0 ? 'Днес' : days === 1 ? '1 ден' : `${days} дни`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Announcements */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <AlertCircle size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">Съобщения</h2>
          </div>
          {!announcements?.length ? (
            <p className="text-sm text-slate-400">Няма активни съобщения</p>
          ) : (
            <div className="space-y-3">
              {announcements.map(ann => (
                <div key={ann.id} className="p-3 rounded-lg border border-slate-100">
                  <div className="text-sm font-medium text-slate-700">{ann.title}</div>
                  <div className="text-xs text-slate-500 mt-1 line-clamp-2">{ann.body}</div>
                  <div className="text-xs text-slate-400 mt-2">{formatDate(ann.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
