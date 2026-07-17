import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, BookOpen, Clock, CheckCircle2, Calendar, AlertCircle, Bell, ArrowRight, GraduationCap, Home, Wifi, Coffee } from 'lucide-react'
import { formatDate, getDaysUntil, getMonthName } from '@/lib/utils'

export default async function AdminDashboard({ profile, currentYearId }: any) {
  const supabase = await createClient()

  const now = new Date()
  const currentDay = now.getDate()
  const currentMonth = now.getMonth() + 1
  const currentYearNum = now.getFullYear()

  const isActivePeriod = currentDay >= 28 || currentDay <= 8
  const reportMonth = currentDay >= 28 ? currentMonth : (currentMonth === 1 ? 12 : currentMonth - 1)
  const reportYear = currentDay >= 28 ? currentYearNum : (currentMonth === 1 ? currentYearNum - 1 : currentYearNum)
  const deadlineMonth = reportMonth === 12 ? 1 : reportMonth + 1
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1

  const [
    { count: totalStudents },
    { count: totalClasses },
    { data: docStats },
    { data: deadlines },
    { data: announcements },
    { data: classes },
    { data: submitted },
    { data: formStats },
    { data: oresActive },
  ] = await Promise.all([
    supabase.from('student_enrollments').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
    supabase.from('classes').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
    supabase.from('documents').select('status').eq('academic_year_id', currentYearId),
    supabase.from('calendar_deadlines').select('*').eq('academic_year_id', currentYearId).gte('deadline_date', now.toISOString().split('T')[0]).order('deadline_date').limit(5),
    supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('classes').select('id').eq('academic_year_id', currentYearId),
    supabase.from('monthly_absences').select('class_id').eq('month', reportMonth).eq('year', reportYear),
    supabase.from('student_enrollments').select('education_form, coud_enrolled').eq('academic_year_id', currentYearId),
    supabase.from('student_ores').select('student_id, from_date, to_date').lte('from_date', now.toISOString().split('T')[0]),
  ])

  const completed = docStats?.filter(d => d.status === 'completed').length || 0
  const inProgress = docStats?.filter(d => d.status === 'in_progress').length || 0
  const submittedIds = new Set(submitted?.map(s => s.class_id) || [])
  const submittedCount = submittedIds.size
  const totalClassCount = classes?.length || 0

  const dailyCount = formStats?.filter(e => (e.education_form || 'daily') === 'daily').length || 0
  const ifoCount = formStats?.filter(e => e.education_form === 'ifo').length || 0
  const coudCount = formStats?.filter(e => e.coud_enrolled).length || 0

  const todayStr = now.toISOString().split('T')[0]
  const oresCount = (oresActive || []).filter(o => !o.to_date || o.to_date >= todayStr).length

  return (
    <div className="animate-in fade-in duration-500">
      {/* ── СТАТИСТИКА ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Link href="/students" className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-all group">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Users size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{totalStudents || 0}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Активни ученици</div>
        </Link>

        <Link href="/classes" className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-all group">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <BookOpen size={18} className="text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{totalClasses || 0}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Паралелки</div>
        </Link>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
            <Clock size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{inProgress}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Документи в процес</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{completed}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Завършени</div>
        </div>
      </div>

      {/* ── ФОРМА НА ОБУЧЕНИЕ ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link href="/students?form=daily" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap size={15} className="text-slate-400" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Дневна форма</div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{dailyCount}</div>
        </Link>

        <Link href="/students?form=ifo" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Home size={15} className="text-slate-400" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ИФО</div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{ifoCount}</div>
        </Link>

        <Link href="/students?coud=1" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Coffee size={15} className="text-slate-400" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ЦОУД (занималня)</div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{coudCount}</div>
        </Link>

        <Link href="/students?ores=1" className={`bg-white p-4 rounded-2xl border shadow-sm hover:border-slate-300 transition-all ${oresCount > 0 ? 'border-amber-200' : 'border-slate-200/70'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Wifi size={15} className={oresCount > 0 ? 'text-amber-500' : 'text-slate-400'} />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">В ОРЕС сега</div>
          </div>
          <div className={`text-2xl font-bold ${oresCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{oresCount}</div>
        </Link>
      </div>

      {/* ── ИУП БАНЕР ── */}
      {isActivePeriod ? (
        <div className="mb-8 p-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white shadow-sm flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-amber-900 text-sm">Въвеждане на реализация на ИУП — {getMonthName(reportMonth)}</div>
            <div className="text-xs text-amber-700/80 mt-1 font-medium">
              {submittedCount} от {totalClassCount} паралелки готови · Срок: 8 {getMonthName(deadlineMonth)}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href="/absences" className="px-4 py-2 rounded-xl bg-white border border-amber-200 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors shadow-sm">
              Преглед
            </Link>
            <Link href={`/absences/export/${reportMonth}/${reportYear}`}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#0f2240' }}>
              Генерирай Excel
            </Link>
          </div>
        </div>
      ) : (
        <div className="mb-8 p-6 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <Clock size={16} className="text-slate-400" />
          </div>
          <div className="text-sm text-slate-600 font-medium">
            Предстои въвеждане на ИУП за <span className="text-slate-900">{getMonthName(currentMonth)}</span>
            <span className="text-slate-400 font-normal ml-2 text-xs">(28 {getMonthName(currentMonth)} - 8 {getMonthName(nextMonth)})</span>
          </div>
        </div>
      )}

      {/* ── DEADLINES & ANNOUNCEMENTS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <Calendar size={18} className="text-slate-400" />
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Предстоящи срокове</h2>
          </div>
          {!deadlines?.length ? (
            <p className="text-sm text-slate-400">Няма предстоящи срокове</p>
          ) : (
            <div className="space-y-4">
              {deadlines.map(d => {
                const days = getDaysUntil(d.deadline_date)
                return (
                  <div key={d.id} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-700 truncate">{d.title}</div>
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5">{formatDate(d.deadline_date)}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-md border ${
                      days === 0 ? 'bg-rose-50 text-rose-700 border-rose-100' :
                      days <= 7 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                      'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {days === 0 ? 'Днес' : `${days} дни`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-slate-400" />
              <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Съобщения</h2>
            </div>
            <Link href="/admin/announcements" className="text-[10px] font-bold text-blue-600 uppercase tracking-wider hover:text-blue-800 flex items-center gap-1">
              Управление <ArrowRight size={12} />
            </Link>
          </div>
          {!announcements?.length ? (
            <p className="text-sm text-slate-400">Няма активни съобщения</p>
          ) : (
            <div className="space-y-4">
              {announcements.map(ann => (
                <div key={ann.id} className="relative pl-4 border-l-2 border-indigo-100">
                  <div className="text-sm font-semibold text-slate-800">{ann.title}</div>
                  <div className="text-xs text-slate-500 mt-1.5 leading-relaxed">{ann.body}</div>
                  <div className="text-[10px] text-slate-300 mt-2 font-medium">{formatDate(ann.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
