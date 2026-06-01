import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, BookOpen, Clock, CheckCircle2, Calendar, AlertCircle } from 'lucide-react'
import { formatDate, getDaysUntil, getMonthName } from '@/lib/utils'

export default async function AdminDashboard({ profile, currentYearId }: any) {
  const supabase = await createClient()

  const now = new Date()
  const currentDay = now.getDate()
  const currentMonth = now.getMonth() + 1
  const currentYearNum = now.getFullYear()
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1

  const isActivePeriod = currentDay >= 28 || currentDay <= 8
  const reportMonth = currentDay >= 28 ? currentMonth : (currentMonth === 1 ? 12 : currentMonth - 1)
  const reportYear = currentDay >= 28 ? currentYearNum : (currentMonth === 1 ? currentYearNum - 1 : currentYearNum)

  const [
    { count: totalStudents },
    { count: totalClasses },
    { data: docStats },
    { data: deadlines },
    { data: announcements },
    { data: classes },
    { data: submitted },
  ] = await Promise.all([
    supabase.from('student_enrollments').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
    supabase.from('classes').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
    supabase.from('documents').select('status').eq('academic_year_id', currentYearId),
    supabase.from('calendar_deadlines').select('*').eq('academic_year_id', currentYearId).gte('deadline_date', now.toISOString().split('T')[0]).order('deadline_date').limit(5),
    supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('classes').select('id').eq('academic_year_id', currentYearId),
    supabase.from('monthly_absences').select('class_id').eq('month', reportMonth).eq('year', reportYear),
  ])

  const completed = docStats?.filter(d => d.status === 'completed').length || 0
  const inProgress = docStats?.filter(d => d.status === 'in_progress').length || 0
  const submittedIds = new Set(submitted?.map(s => s.class_id) || [])
  const submittedCount = submittedIds.size
  const totalClassCount = classes?.length || 0

  return (
    <>
      {/* Stats — 2 колони на мобилен, 4 на десктоп */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Link href="/students" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Users size={16} className="text-blue-600" />
            </div>
            <span className="text-xs md:text-sm text-slate-500">Ученици</span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold text-slate-800">{totalStudents || 0}</div>
          <div className="text-xs text-slate-400 mt-1">активни</div>
        </Link>

        <Link href="/classes" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <BookOpen size={16} className="text-purple-600" />
            </div>
            <span className="text-xs md:text-sm text-slate-500">Паралелки</span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold text-slate-800">{totalClasses || 0}</div>
          <div className="text-xs text-slate-400 mt-1">за годината</div>
        </Link>

        <div className="card">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Clock size={16} className="text-amber-600" />
            </div>
            <span className="text-xs md:text-sm text-slate-500">В процес</span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold text-slate-800">{inProgress}</div>
          <div className="text-xs text-slate-400 mt-1">документа</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={16} className="text-green-600" />
            </div>
            <span className="text-xs md:text-sm text-slate-500">Завършени</span>
          </div>
          <div className="text-2xl md:text-3xl font-semibold text-slate-800">{completed}</div>
          <div className="text-xs text-slate-400 mt-1">документа</div>
        </div>
      </div>

      {/* IUP Banner */}
      {isActivePeriod ? (
        <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <div className="font-medium text-sm text-amber-800">
                Протича въвеждане на реализация на ИУП за {getMonthName(reportMonth)}
              </div>
              <div className="text-xs text-amber-600 mt-0.5">
                {submittedCount} от {totalClassCount} паралелки въведени · Срок до 8 {getMonthName(nextMonth)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/absences" className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 text-amber-700">
                Виж →
              </Link>
              <Link href={`/absences/export/${reportMonth}/${reportYear}`} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">
                Генерирай Excel
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="text-sm text-slate-600">
            Предстои въвеждане на реализация на ИУП за <strong>{getMonthName(currentMonth)}</strong>
            <span className="text-slate-400 ml-1 block md:inline">· от 28 {getMonthName(currentMonth)} до 8 {getMonthName(nextMonth)}</span>
          </div>
        </div>
      )}

      {/* Deadlines + Announcements — 1 колона на мобилен, 2 на десктоп */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Calendar size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">Предстоящи срокове</h2>
          </div>
          {!deadlines?.length ? (
            <p className="text-sm text-slate-400">Няма предстоящи срокове</p>
          ) : (
            <div className="space-y-2">
              {deadlines.map(d => {
                const days = getDaysUntil(d.deadline_date)
                return (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">{d.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatDate(d.deadline_date)}</div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                      days <= 7 ? 'bg-red-100 text-red-700' :
                      days <= 30 ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {days === 0 ? 'Днес' : `${days} дни`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-slate-400" />
              <h2 className="font-medium text-slate-700 text-sm">Съобщения</h2>
            </div>
            <Link href="/admin/announcements" className="text-xs text-slate-400 hover:text-slate-700">+ Ново</Link>
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
    </>
  )
}
