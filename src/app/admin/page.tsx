import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Settings, Bell, School, Users, Star, BookOpen, Coffee, CalendarPlus, LayoutGrid, HeartPulse, GraduationCap } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('role, is_coordinator')
    .eq('user_id', user.id)
    .single()
  if (!['admin', 'zdud'].includes(profile?.role || '') && !profile?.is_coordinator) redirect('/dashboard')

  const { data: years } = await supabase
    .from('academic_years').select('*').order('start_date', { ascending: false })
  const { data: deadlines } = await supabase
    .from('calendar_deadlines').select('*').order('deadline_date').limit(10)
  const { count: schoolsCount } = await supabase
    .from('sending_schools').select('*', { count: 'exact', head: true }).eq('is_active', true)
  const { data: currentYear } = await supabase
    .from('academic_years').select('id').eq('is_current', true).single()
  const { count: teamCount } = await supabase
    .from('coordinating_team').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYear?.id || '')

  const groups = [
    {
      title: 'Структура',
      items: [
        { href: '/admin/years', label: 'Паралелки', desc: 'Паралелки и учебна година', icon: LayoutGrid, color: 'blue' },
        { href: '/admin/subjects', label: 'Предмети', desc: 'Предмети и вземане от терапевт', icon: GraduationCap, color: 'cyan' },
        { href: '/admin/schools', label: 'Училища', desc: `${schoolsCount || 0} активни изпращащи`, icon: School, color: 'green' },
        { href: '/admin/coud', label: 'ЦОУД групи', desc: 'Целодневна организация', icon: Coffee, color: 'orange' },
      ],
    },
    {
      title: 'Хора',
      items: [
        { href: '/admin/staff', label: 'Служители', desc: 'Потребители и достъп', icon: Settings, color: 'purple' },
        { href: '/admin/coordinating-team', label: 'Координиращ екип', desc: `${teamCount || 0} члена`, icon: Star, color: 'indigo' },
      ],
    },
    {
      title: 'ЕПЛР и терапия',
      items: [
        { href: '/admin/eplr-assignment', label: 'ЕПЛР разпределение', desc: 'Специалисти по ученици', icon: Users, color: 'red' },
        { href: '/admin/therapists', label: 'Терапевти', desc: 'Седмична терапевтична работа', icon: HeartPulse, color: 'teal' },
      ],
    },
    {
      title: 'Система',
      items: [
        { href: '/admin/announcements', label: 'Съобщения', desc: 'Обяви и съобщения', icon: Bell, color: 'amber' },
        { href: '/admin/rollover', label: 'Нова учебна година', desc: 'Прехвърляне ученици/паралелки', icon: CalendarPlus, color: 'amber' },
        { href: '/admin/nomenclature', label: 'Номенклатури', desc: 'Дела за кореспонденция', icon: BookOpen, color: 'slate' },
      ],
    },
  ]

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    red: 'bg-red-50 text-red-600',
    teal: 'bg-teal-50 text-teal-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Администрация</h1>
        <p className="text-slate-500 text-sm mt-1">Управление на системата</p>
      </div>

      {/* Групи с компактни карти */}
      <div className="space-y-5 mb-8">
        {groups.map(group => (
          <div key={group.title}>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{group.title}</h2>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {group.items.map(item => {
                const Icon = item.icon
                return (
                  <a key={item.href} href={item.href}
                    className="group flex items-center gap-3 p-3 rounded-xl border border-slate-200/70 bg-white transition-all duration-300 hover:border-blue-200/70 hover:shadow-[0_8px_24px_rgba(15,34,64,0.10)] hover:-translate-y-1">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${colorMap[item.color]}`}>
                      <Icon size={17} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-700 truncate group-hover:text-blue-700 transition-colors">{item.label}</div>
                      <div className="text-[11px] text-slate-400 truncate">{item.desc}</div>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Учебни години + Срокове */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="card">
          <h2 className="font-medium text-slate-700 text-sm mb-4 pb-3 border-b border-slate-100">Учебни години</h2>
          <div className="space-y-2">
            {years?.map(year => (
              <div key={year.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-700">{year.name}</div>
                  <div className="text-xs text-slate-400">{formatDate(year.start_date)} — {formatDate(year.end_date)}</div>
                </div>
                {year.is_current && <span className="badge-completed flex-shrink-0">Текуща</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h2 className="font-medium text-slate-700 text-sm">Срокове в календара</h2>
            <a href="/admin/deadlines" className="text-xs text-slate-400 hover:text-slate-700">+ Добави</a>
          </div>
          <div className="space-y-2">
            {deadlines?.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 gap-2">
                <div className="text-sm text-slate-700 min-w-0 truncate">{d.title}</div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                  d.color === 'red' ? 'bg-red-100 text-red-700' :
                  d.color === 'yellow' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {formatDate(d.deadline_date)}
                </span>
              </div>
            ))}
            {!deadlines?.length && <p className="text-sm text-slate-400">Няма добавени срокове</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
