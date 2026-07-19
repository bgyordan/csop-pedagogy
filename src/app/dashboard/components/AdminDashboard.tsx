import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, BookOpen, Calendar, Bell, ArrowRight, GraduationCap, Home, Wifi, Coffee, ShieldX, ShieldAlert, ClipboardList, Clock, AlertTriangle } from 'lucide-react'
import { formatDate, getDaysUntil, getMonthName } from '@/lib/utils'

export default async function AdminDashboard({ profile, currentYearId }: any) {
  const supabase = await createClient()

  const now = new Date()
  const currentDay = now.getDate()
  const currentMonth = now.getMonth() + 1
  const currentYearNum = now.getFullYear()
  const todayStr = now.toISOString().split('T')[0]
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, BookOpen, Calendar, Bell, ArrowRight, GraduationCap, Home, Wifi, Coffee, ShieldX, ShieldAlert, ClipboardList, Clock, AlertTriangle, UserSearch } from 'lucide-react'
import { formatDate, getDaysUntil, getMonthName } from '@/lib/utils'

export default async function AdminDashboard({ profile, currentYearId }: any) {
  const supabase = await createClient()

  const now = new Date()
  const currentDay = now.getDate()
  const currentMonth = now.getMonth() + 1
  const currentYearNum = now.getFullYear()
  const todayStr = now.toISOString().split('T')[0]

  // ИУП период — само през учебните месеци (не юли/август)
  const isSummer = currentMonth === 7 || currentMonth === 8
  const isActivePeriod = !isSummer && (currentDay >= 28 || currentDay <= 8)
  const reportMonth = currentDay >= 28 ? currentMonth : (currentMonth === 1 ? 12 : currentMonth - 1)
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1

  const { data: currentYear } = await supabase
    .from('academic_years').select('name').eq('id', currentYearId).single()
  const currentYearName = currentYear?.name || ''

  const [
    { count: totalStudents },
    { count: totalClasses },
    { data: deadlines },
    { data: announcements },
    { data: formStats },
    { data: oresActive },
    { data: attachments },
    { count: coudCount },
    { data: dataCheck },
  ] = await Promise.all([
    supabase.from('student_enrollments').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
    supabase.from('classes').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
    supabase.from('calendar_deadlines').select('*').eq('academic_year_id', currentYearId).gte('deadline_date', todayStr).order('deadline_date').limit(5),
    supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('student_enrollments').select('education_form').eq('academic_year_id', currentYearId),
    supabase.from('student_ores').select('student_id, from_date, to_date').lte('from_date', todayStr),
    supabase.from('student_attachments').select('student_id, valid_until_year'),
    supabase.from('student_enrollments')
      .select('student:students(id, status, external_class, sending_school_id, sending_school_other)')
      .eq('academic_year_id', currentYearId),
    supabase.from('coud_enrollments').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
  ])

  const dailyCount = formStats?.filter(e => (e.education_form || 'daily') === 'daily').length || 0
  const ifoCount = formStats?.filter(e => e.education_form === 'ifo').length || 0
  const oresCount = (oresActive || []).filter(o => !o.to_date || o.to_date >= todayStr).length

  // Документи — изтекли / изтичащи
  const baseYear = currentYearName ? parseInt(currentYearName.split('/')[0]) : currentYearNum
  const expiredStudents = new Set<string>()
  const expiringStudents = new Set<string>()
  ;(attachments || []).forEach(a => {
    if (!a.valid_until_year) return
    const y = parseInt(a.valid_until_year.split('/')[0])
    if (y < baseYear) expiredStudents.add(a.student_id)
    else if (y === baseYear) expiringStudents.add(a.student_id)
  })
  const expiredCount = expiredStudents.size
  const expiringCount = expiringStudents.size

  // Ученици с непълни данни (за писмото до РУО и справките)
  const incompleteStudents = (dataCheck || [])
    .map((e: any) => e.student)
    .filter((s: any) => s && s.status === 'active')
    .filter((s: any) => !s.external_class?.trim() || (!s.sending_school_id && !s.sending_school_other?.trim()))
  const incompleteCount = incompleteStudents.length

  // Събиране на всички аларми
  const alerts: { type: 'error' | 'warning' | 'info'; icon: any; text: string; href: string; badge?: string }[] = []

  if (expiredCount > 0) {
    alerts.push({ type: 'error', icon: <ShieldX size={16} />, text: `Изтекли документи`, href: '/students/documents', badge: `${expiredCount} ${expiredCount === 1 ? 'ученик' : 'ученика'}` })
  }
  if (expiringCount > 0) {
    alerts.push({ type: 'warning', icon: <ShieldAlert size={16} />, text: `Изтичащи документи тази година`, href: '/students/documents', badge: `${expiringCount} ${expiringCount === 1 ? 'ученик' : 'ученика'}` })
  }
  if (incompleteCount > 0) {
    alerts.push({
      type: 'info',
      icon: <UserSearch size={16} />,
      text: 'Ученици без клас или изпращащо училище',
      href: '/students?incomplete=1',
      badge: `${incompleteCount} ${incompleteCount === 1 ? 'ученик' : 'ученика'}`,
    })
  }
  if (isActivePeriod) {
    alerts.push({ type: 'warning', icon: <ClipboardList size={16} />, text: `Въвеждане на реализация на ИУП — ${getMonthName(reportMonth)}`, href: '/absences', badge: 'До 8-ми' })
  }
  ;(deadlines || []).forEach(d => {
    const days = getDaysUntil(d.deadline_date)
    if (days <= 14) {
      alerts.push({ type: days <= 3 ? 'error' : 'info', icon: <Calendar size={16} />, text: d.title, href: '/admin', badge: days === 0 ? 'Днес' : `${days} дни` })
    }
  })

  return (
    <div className="animate-in fade-in duration-500">
      {/* ── КЛЮЧОВИ ЧИСЛА ── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Link href="/students" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all group col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <Users size={15} className="text-blue-500" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ученици</div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{totalStudents || 0}</div>
        </Link>

        <Link href="/classes" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={15} className="text-purple-500" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Паралелки</div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{totalClasses || 0}</div>
        </Link>

        <Link href="/students?form=daily" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap size={15} className="text-slate-400" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Дневна</div>
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

        <Link href="/admin/coud" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Coffee size={15} className="text-slate-400" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ЦОУД</div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{coudCount || 0}</div>
        </Link>

        <Link href="/students?ores=1" className={`bg-white p-4 rounded-2xl border shadow-sm hover:border-slate-300 transition-all ${oresCount > 0 ? 'border-amber-200' : 'border-slate-200/70'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Wifi size={15} className={oresCount > 0 ? 'text-amber-500' : 'text-slate-400'} />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ОРЕС</div>
          </div>
          <div className={`text-2xl font-bold ${oresCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{oresCount}</div>
        </Link>
      </div>

      {/* ── АЛАРМИ / ИЗИСКВА ВНИМАНИЕ ── */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <AlertTriangle size={16} className="text-slate-500" />
          <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Изисква внимание</h2>
          {alerts.length > 0 && (
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{alerts.length}</span>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-slate-400">
              <ShieldAlert size={16} className="text-emerald-400" />
              Всичко е наред — няма спешни задачи
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {alerts.map((a, i) => (
              <Link key={i} href={a.href}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group">
                <span className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${
                  a.type === 'error' ? 'bg-red-50 text-red-500' :
                  a.type === 'warning' ? 'bg-amber-50 text-amber-500' :
                  'bg-blue-50 text-blue-500'
                }`}>
                  {a.icon}
                </span>
                <span className="text-sm text-slate-700 flex-1 font-medium">{a.text}</span>
                {a.badge && (
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                    a.type === 'error' ? 'bg-red-50 text-red-600' :
                    a.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {a.badge}
                  </span>
                )}
                <ArrowRight size={15} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── СРОКОВЕ & СЪОБЩЕНИЯ ── */}
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
  // ИУП период — само през учебните месеци (не юли/август)
  const isSummer = currentMonth === 7 || currentMonth === 8
  const isActivePeriod = !isSummer && (currentDay >= 28 || currentDay <= 8)
  const reportMonth = currentDay >= 28 ? currentMonth : (currentMonth === 1 ? 12 : currentMonth - 1)
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1

  const { data: currentYear } = await supabase
    .from('academic_years').select('name').eq('id', currentYearId).single()
  const currentYearName = currentYear?.name || ''

  const [
    { count: totalStudents },
    { count: totalClasses },
    { data: deadlines },
    { data: announcements },
    { data: formStats },
    { data: oresActive },
    { data: attachments },
    { count: coudCount },
  ] = await Promise.all([
    supabase.from('student_enrollments').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
    supabase.from('classes').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
    supabase.from('calendar_deadlines').select('*').eq('academic_year_id', currentYearId).gte('deadline_date', todayStr).order('deadline_date').limit(5),
    supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('student_enrollments').select('education_form').eq('academic_year_id', currentYearId),
    supabase.from('student_ores').select('student_id, from_date, to_date').lte('from_date', todayStr),
    supabase.from('student_attachments').select('student_id, valid_until_year'),
    supabase.from('coud_enrollments').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
  ])

  const dailyCount = formStats?.filter(e => (e.education_form || 'daily') === 'daily').length || 0
  const ifoCount = formStats?.filter(e => e.education_form === 'ifo').length || 0
  const oresCount = (oresActive || []).filter(o => !o.to_date || o.to_date >= todayStr).length

  // Документи — изтекли / изтичащи
  const baseYear = currentYearName ? parseInt(currentYearName.split('/')[0]) : currentYearNum
  const expiredStudents = new Set<string>()
  const expiringStudents = new Set<string>()
  ;(attachments || []).forEach(a => {
    if (!a.valid_until_year) return
    const y = parseInt(a.valid_until_year.split('/')[0])
    if (y < baseYear) expiredStudents.add(a.student_id)
    else if (y === baseYear) expiringStudents.add(a.student_id)
  })
  const expiredCount = expiredStudents.size
  const expiringCount = expiringStudents.size

  // Събиране на всички аларми
  const alerts: { type: 'error' | 'warning' | 'info'; icon: any; text: string; href: string; badge?: string }[] = []

  if (expiredCount > 0) {
    alerts.push({ type: 'error', icon: <ShieldX size={16} />, text: `Изтекли документи`, href: '/students/documents', badge: `${expiredCount} ${expiredCount === 1 ? 'ученик' : 'ученика'}` })
  }
  if (expiringCount > 0) {
    alerts.push({ type: 'warning', icon: <ShieldAlert size={16} />, text: `Изтичащи документи тази година`, href: '/students/documents', badge: `${expiringCount} ${expiringCount === 1 ? 'ученик' : 'ученика'}` })
  }
  if (isActivePeriod) {
    alerts.push({ type: 'warning', icon: <ClipboardList size={16} />, text: `Въвеждане на реализация на ИУП — ${getMonthName(reportMonth)}`, href: '/absences', badge: 'До 8-ми' })
  }
  ;(deadlines || []).forEach(d => {
    const days = getDaysUntil(d.deadline_date)
    if (days <= 14) {
      alerts.push({ type: days <= 3 ? 'error' : 'info', icon: <Calendar size={16} />, text: d.title, href: '/admin', badge: days === 0 ? 'Днес' : `${days} дни` })
    }
  })

  return (
    <div className="animate-in fade-in duration-500">
      {/* ── КЛЮЧОВИ ЧИСЛА ── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Link href="/students" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all group col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <Users size={15} className="text-blue-500" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ученици</div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{totalStudents || 0}</div>
        </Link>

        <Link href="/classes" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={15} className="text-purple-500" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Паралелки</div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{totalClasses || 0}</div>
        </Link>

        <Link href="/students?form=daily" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap size={15} className="text-slate-400" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Дневна</div>
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

        <Link href="/admin/coud" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Coffee size={15} className="text-slate-400" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ЦОУД</div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{coudCount || 0}</div>
        </Link>

        <Link href="/students?ores=1" className={`bg-white p-4 rounded-2xl border shadow-sm hover:border-slate-300 transition-all ${oresCount > 0 ? 'border-amber-200' : 'border-slate-200/70'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Wifi size={15} className={oresCount > 0 ? 'text-amber-500' : 'text-slate-400'} />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ОРЕС</div>
          </div>
          <div className={`text-2xl font-bold ${oresCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{oresCount}</div>
        </Link>
      </div>

      {/* ── АЛАРМИ / ИЗИСКВА ВНИМАНИЕ ── */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <AlertTriangle size={16} className="text-slate-500" />
          <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Изисква внимание</h2>
          {alerts.length > 0 && (
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{alerts.length}</span>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-slate-400">
              <ShieldAlert size={16} className="text-emerald-400" />
              Всичко е наред — няма спешни задачи
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {alerts.map((a, i) => (
              <Link key={i} href={a.href}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group">
                <span className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${
                  a.type === 'error' ? 'bg-red-50 text-red-500' :
                  a.type === 'warning' ? 'bg-amber-50 text-amber-500' :
                  'bg-blue-50 text-blue-500'
                }`}>
                  {a.icon}
                </span>
                <span className="text-sm text-slate-700 flex-1 font-medium">{a.text}</span>
                {a.badge && (
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                    a.type === 'error' ? 'bg-red-50 text-red-600' :
                    a.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {a.badge}
                  </span>
                )}
                <ArrowRight size={15} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── СРОКОВЕ & СЪОБЩЕНИЯ ── */}
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
