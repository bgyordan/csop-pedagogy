import { createClient } from '@/lib/supabase/server'
import OnlineNow from './OnlineNow'
import { iupPeriod } from '@/lib/iup-period'
import { upcomingTasks } from '@/lib/upcoming-tasks'
import ClassTeacherSide from './ClassTeacherSide'
import OpsPanel from './OpsPanel'
import Link from 'next/link'
import SharedFiles from './SharedFiles'
import ExpiringDocsCard from './ExpiringDocsCard'
import { Users, BookOpen, Calendar, Bell, ArrowRight, GraduationCap, Home, Wifi, Coffee, ShieldX, ShieldAlert, ClipboardList, Clock, AlertTriangle, UserSearch } from 'lucide-react'
import { formatDate, getDaysUntil, getMonthName } from '@/lib/utils'
export default async function AdminDashboard({ profile, currentYearId }: any) {
  const supabase = await createClient()
  const now = new Date()
  const currentDay = now.getDate()
  const currentMonth = now.getMonth() + 1
  const currentYearNum = now.getFullYear()
  const todayStr = now.toISOString().split('T')[0]
  // ИУП период — едно правило (lib/iup-period)
  const iup = iupPeriod()
  const isActivePeriod = iup.open
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
    { data: dataCheck },
    { count: coudCount },
  ] = await Promise.all([
    supabase.from('student_enrollments').select('student:students!inner(status)', { count: 'exact', head: true }).eq('academic_year_id', currentYearId).eq('student.status', 'active'),
    supabase.from('classes').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
    upcomingTasks(supabase, 6).then(data => ({ data })),   // от „График срокове“
    supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('student_enrollments').select('education_form, student:students!inner(status)').eq('academic_year_id', currentYearId).eq('student.status', 'active'),
    supabase.from('student_ores').select('student_id, from_date, to_date').lte('from_date', todayStr),
    supabase.from('student_attachments').select('student_id, valid_until_year, doc_type'),
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
    if (['enrollment_application', 'coud_application'].includes(a.doc_type)) return
    const y = parseInt(a.valid_until_year.split('/')[0])
    if (y < baseYear) expiredStudents.add(a.student_id)
    else if (y === baseYear) expiringStudents.add(a.student_id)
  })
  const expiredCount = expiredStudents.size
  // „изтичащи тази година“ има смисъл едва към края на годината (май–август), не от септември
  const nowMonth = new Date().getMonth() + 1
  const expiringCount = nowMonth >= 5 && nowMonth <= 8 ? expiringStudents.size : 0
  // имената на децата — за да се покажат в самото предупреждение (без да се отваря целият списък)
  const flagged = Array.from(new Set([...Array.from(expiredStudents), ...(expiringCount ? Array.from(expiringStudents) : [])]))
  const { data: flaggedKids } = flagged.length
    ? await supabase.from('students').select('id, first_name, last_name').in('id', flagged)
    : { data: [] as any[] }
  const kidName: Record<string, string> = {}
  ;(flaggedKids || []).forEach((k: any) => { kidName[k.id] = `${k.first_name} ${k.last_name}` })
  const peopleOf = (ids: Set<string>) => Array.from(ids).map(id => ({ id, name: kidName[id] || '—' })).sort((a, b) => a.name.localeCompare(b.name, 'bg'))
  // Ученици с непълни данни (за писмото до РУО и справките)
  const incompleteStudents = (dataCheck || [])
    .map((e: any) => e.student)
    .filter((s: any) => s && s.status === 'active')
    .filter((s: any) => !s.external_class?.trim() || (!s.sending_school_id && !s.sending_school_other?.trim()))
  const incompleteCount = incompleteStudents.length
  // Събиране на всички аларми
  const alerts: { type: 'error' | 'warning' | 'info'; icon: any; text: string; href: string; badge?: string; people?: { id: string; name: string }[] }[] = []
  if (expiredCount > 0) {
    alerts.push({ type: 'error', icon: <ShieldX size={16} />, text: `Изтекли документи`, href: '/students/documents', badge: `${expiredCount} ${expiredCount === 1 ? 'ученик' : 'ученика'}`, people: peopleOf(expiredStudents) })
  }
  if (expiringCount > 0) {
    alerts.push({ type: 'warning', icon: <ShieldAlert size={16} />, text: `Изтичащи документи тази година`, href: '/students/documents', badge: `${expiringCount} ${expiringCount === 1 ? 'ученик' : 'ученика'}`, people: peopleOf(expiringStudents) })
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
    alerts.push({ type: 'warning', icon: <ClipboardList size={16} />, text: `Въвеждане на реализация на ИУП — ${iup.label}`, href: '/absences', badge: `до ${iup.window.split('– ')[1]}` })
  }
  // сроковете от „График срокове“: просрочени и наближаващи (според „напомни N дни преди“)
  ;(deadlines || []).forEach(d => {
    if (d.state === 'upcoming') return
    alerts.push({
      type: d.state === 'overdue' ? 'error' : 'warning', icon: <Calendar size={16} />, text: d.title, href: '/admin/tasks',
      badge: d.days < 0 ? `просрочено ${-d.days} дни` : d.days === 0 ? 'Днес' : `след ${d.days} дни`,
    })
  })
  return (
    <div className="animate-in fade-in duration-500">
      {/* ── КЛЮЧОВИ ЧИСЛА ── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Link href="/students" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all group col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <Users size={15} className="text-blue-500" />
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Ученици</div>
          </div>
          <div className="text-2xl font-semibold text-slate-800">{totalStudents || 0}</div>
        </Link>
        <Link href="/classes" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={15} className="text-purple-500" />
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Паралелки</div>
          </div>
          <div className="text-2xl font-semibold text-slate-800">{totalClasses || 0}</div>
        </Link>
        <Link href="/students?form=daily" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap size={15} className="text-slate-400" />
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Дневна</div>
          </div>
          <div className="text-2xl font-semibold text-slate-800">{dailyCount}</div>
        </Link>
        <Link href="/students?form=ifo" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Home size={15} className="text-slate-400" />
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ИФО</div>
          </div>
          <div className="text-2xl font-semibold text-slate-800">{ifoCount}</div>
        </Link>
        <Link href="/classes?tab=coud" className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Coffee size={15} className="text-slate-400" />
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ЦОУД</div>
          </div>
          <div className="text-2xl font-semibold text-slate-800">{coudCount || 0}</div>
        </Link>
        <Link href="/students?ores=1" className={`bg-white p-4 rounded-2xl border shadow-sm hover:border-slate-300 transition-all ${oresCount > 0 ? 'border-amber-200' : 'border-slate-200/70'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Wifi size={15} className={oresCount > 0 ? 'text-amber-500' : 'text-slate-400'} />
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ОРЕС</div>
          </div>
          <div className={`text-2xl font-semibold ${oresCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{oresCount}</div>
        </Link>
      </div>
      {/* ── На линия сега ── */}
      <OnlineNow />
      {/* ── ОПЕРАТИВНО: днес · реализация на ИУП · ЕПЛР ── */}
      <OpsPanel currentYearId={currentYearId} />
      {/* ── ИЗИСКВА ВНИМАНИЕ + Срокове/Съобщения/Файлове (една карта с табове) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <AlertTriangle size={16} className="text-slate-500" />
          <h2 className="font-semibold text-slate-700 text-sm">Изисква внимание</h2>
          {alerts.length > 0 && (
            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{alerts.length}</span>
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
            {alerts.map((a, i) => {
              const iconBox = <span className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${
                a.type === 'error' ? 'bg-red-50 text-red-500' : a.type === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
              }`}>{a.icon}</span>
              const badge = a.badge && <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                a.type === 'error' ? 'bg-red-50 text-red-600' : a.type === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
              }`}>{a.badge}</span>
              // с деца → разгъва се на място (имената водят към досието), без да отваря целия списък
              if (a.people?.length) return (
                <details key={i} className="group">
                  <summary className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer list-none">
                    {iconBox}
                    <span className="text-sm text-slate-700 flex-1 font-medium">{a.text}</span>
                    {badge}
                    <ArrowRight size={15} className="text-slate-300 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="flex flex-wrap gap-1.5 px-5 pb-3 pl-16">
                    {a.people.map(p => (
                      <Link key={p.id} href={`/students/${p.id}`} className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[12px] text-slate-600 hover:border-sky-200 hover:text-[#0f2240]">{p.name}</Link>
                    ))}
                  </div>
                </details>
              )
              return (
                <Link key={i} href={a.href}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group">
                  {iconBox}
                  <span className="text-sm text-slate-700 flex-1 font-medium">{a.text}</span>
                  {badge}
                  <ArrowRight size={15} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
      <div>
        <ClassTeacherSide
          deadlines={(deadlines || []) as any}
          announcements={(announcements || []) as any}
          deadlinesHref="/admin/tasks"
          newsHref="/admin/announcements"
          files={<SharedFiles bare />}
        />
      </div>
      </div>
      {/* Изтичащи документи */}
      <div className="mb-6">
        <ExpiringDocsCard />
      </div>
    </div>
  )
}
