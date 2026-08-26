import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, BookOpen, UserCircle, Star, BarChart3, CalendarDays, Inbox, ClipboardList, ArrowRight, GraduationCap, Calendar, AlertTriangle } from 'lucide-react'
import { formatDate, getDaysUntil } from '@/lib/utils'

export default async function DirectorDashboard({ profile, currentYearId }: any) {
  const supabase = await createClient()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const { data: currentYear } = await supabase
    .from('academic_years').select('name').eq('id', currentYearId).single()
  const currentYearName = currentYear?.name || ''

  const [
    { count: studentsCount },
    { count: classesCount },
    { count: staffCount },
    { count: eplrCount },
    { data: deadlines },
  ] = await Promise.all([
    supabase.from('student_enrollments')
      .select('student:students!inner(status)', { count: 'exact', head: true })
      .eq('academic_year_id', currentYearId).eq('student.status', 'active'),
    supabase.from('classes').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
    supabase.from('staff_profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('eplr_teams').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
    supabase.from('calendar_deadlines').select('*').eq('academic_year_id', currentYearId)
      .gte('deadline_date', todayStr).order('deadline_date').limit(4),
  ])

  const stats = [
    { label: 'Ученици', value: studentsCount || 0, icon: <Users size={18} />, href: '/students' },
    { label: 'Паралелки', value: classesCount || 0, icon: <BookOpen size={18} />, href: '/classes' },
    { label: 'Служители', value: staffCount || 0, icon: <UserCircle size={18} />, href: '/staff' },
    { label: 'ЕПЛР екипи', value: eplrCount || 0, icon: <Star size={18} />, href: '/admin/eplr-assignment' },
  ]

  const cards = [
    { title: 'Справки', desc: 'Заявления, по клас, пътуващи, натовареност', icon: <BarChart3 size={20} />, href: '/reports/hub' },
    { title: 'Натовареност', desc: 'Разпределение и интензивност на терапиите', icon: <GraduationCap size={20} />, href: '/reports' },
    { title: 'Дежурства', desc: 'График на дежурствата по седмици', icon: <CalendarDays size={20} />, href: '/duties' },
    { title: 'Координиращ екип', desc: 'Заседания, разпределение и график ЕПЛР', icon: <Star size={20} />, href: '/admin/coordinating-team' },
    { title: 'Регистър', desc: 'Входяща и изходяща кореспонденция', icon: <Inbox size={20} />, href: '/correspondence' },
    { title: 'Заповеди', desc: 'Регистър на заповедите', icon: <ClipboardList size={20} />, href: '/orders' },
  ]

  return (
    <div className="space-y-6">
       {/* Ключови числа */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <Link key={s.label} href={s.href}
            className="group bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-[#0f2240]/30 hover:shadow transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl text-white" style={{ backgroundColor: '#0f2240' }}>{s.icon}</div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-[#0f2240] transition-colors" />
            </div>
            <div className="text-3xl font-medium text-slate-800 tracking-tight">{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Предстоящи срокове */}
      {deadlines && deadlines.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Предстоящи срокове</h3>
          </div>
          <div className="space-y-2">
            {deadlines.map((d: any) => {
              const days = getDaysUntil(d.deadline_date)
              const urgent = days <= 7
              return (
                <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {urgent && <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />}
                    <span className="text-sm text-slate-700 truncate">{d.title}</span>
                  </div>
                  <div className="text-xs text-slate-400 flex-shrink-0 ml-3">
                    {formatDate(d.deadline_date)}
                    <span className={`ml-1.5 font-medium ${urgent ? 'text-amber-600' : 'text-slate-400'}`}>
                      {days === 0 ? 'днес' : days === 1 ? 'утре' : `след ${days} дни`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Карти-линкове */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Бърз достъп</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map(c => (
            <Link key={c.href} href={c.href}
              className="group flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-[#0f2240]/30 hover:shadow transition-all">
              <div className="p-2.5 rounded-xl flex-shrink-0 text-white" style={{ backgroundColor: '#0f2240' }}>{c.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">{c.title}</span>
                  <ArrowRight size={15} className="text-slate-300 group-hover:text-[#0f2240] transition-colors flex-shrink-0" />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{c.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
