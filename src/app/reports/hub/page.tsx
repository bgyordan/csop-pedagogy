import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { canSeeLecturerReport } from '@/lib/curriculum'
import {
  BarChart3, GraduationCap, Bus, FileText, ArrowRight, Coffee, Phone, School, FileSpreadsheet,
  HeartPulse, Users, ClipboardList, Wallet, Mail, Activity, BookOpenCheck,
} from 'lucide-react'
export const dynamic = 'force-dynamic'

// ЕДИН вход за всички справки — групирани по тема, според ролята
interface ReportCard { href: string; title: string; desc: string; icon: React.ReactNode; roles: string[]; coordinator?: boolean; check?: (p: any) => boolean }
interface Group { title: string; icon: React.ReactNode; items: ReportCard[] }

const M = ['admin', 'zdud', 'director']
const MS = [...M, 'secretary']

const GROUPS: Group[] = [
  {
    title: 'Ученици', icon: <Users size={16} />,
    items: [
      { href: '/reports/full', title: 'Пълна справка', desc: 'Всички ученици с всички данни — Excel', icon: <FileSpreadsheet size={18} />, roles: M },
      { href: '/reports/by-class', title: 'Ученици по клас', desc: 'Групиране по клас за планиране на паралелки', icon: <GraduationCap size={18} />, roles: MS },
      { href: '/reports/by-school', title: 'Ученици по училища', desc: 'По изпращащо училище и клас — за печат', icon: <School size={18} />, roles: MS },
      { href: '/reports/guardians', title: 'Родители и контакти', desc: 'Ученик, паралелка, родител и телефон — за печат', icon: <Phone size={18} />, roles: MS },
      { href: '/reports/traveling', title: 'Пътуващи ученици', desc: 'Деца от друго населено място', icon: <Bus size={18} />, roles: MS },
      { href: '/reports/enrollments', title: 'Заявления за прием и ЦОУД', desc: 'Подадени заявления с подателите', icon: <FileText size={18} />, roles: MS },
      { href: '/reports/coud', title: 'ЦОУД групи', desc: 'Групи, възпитатели и записани ученици', icon: <Coffee size={18} />, roles: MS },
    ],
  },
  {
    title: 'Терапии', icon: <HeartPulse size={16} />,
    items: [
      { href: '/reports?tab=distribution', title: 'Разпределение', desc: 'Ученик × специалисти (ЕПЛР) — екран и PDF', icon: <Users size={18} />, roles: M, coordinator: true },
      { href: '/reports?tab=workload', title: 'Натовареност', desc: 'Колко деца и часове има всеки специалист', icon: <BarChart3 size={18} />, roles: M, coordinator: true },
      { href: '/reports?tab=intensity', title: 'Терапии по деца', desc: 'Колко терапии седмично получава всяко дете', icon: <Activity size={18} />, roles: M, coordinator: true },
    ],
  },
  {
    title: 'ИУП, лекторски и отчети', icon: <Wallet size={16} />,
    items: [
      { href: '/absences', title: 'Реализация на ИУП', desc: 'Месечен отчет по паралелки + Excel', icon: <ClipboardList size={18} />, roles: M },
      { href: '/reports/lecturer-plan', title: 'Лекторски по учебен план', desc: 'Над норматива по учител и паралелки — от учебния план, Excel', icon: <BookOpenCheck size={18} />, roles: [], check: canSeeLecturerReport },
      { href: '/lecturer-review', title: 'Лекторски часове', desc: 'Над норматив и заместване по служители, суми, заповед за изплащане', icon: <Wallet size={18} />, roles: MS },
      { href: '/mon-export', title: 'Отчет НП (МОН)', desc: '„Без свободен час“ — файл за платформата', icon: <FileSpreadsheet size={18} />, roles: M },
    ],
  },
  {
    title: 'Писма', icon: <Mail size={16} />,
    items: [
      { href: '/reports/letters', title: 'Официални писма — паралелки', desc: 'РУО, РЦПППО, изнесени групи — Word', icon: <FileText size={18} />, roles: M },
      { href: '/reports?tab=school', title: 'Писма до училищата', desc: 'ЕПЛР екип и график на срещите по училище — Word', icon: <School size={18} />, roles: M, coordinator: true },
    ],
  },
]

export default async function ReportsHubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles').select('role, is_coordinator, position').eq('user_id', user.id).single()
  const role = profile?.role || ''
  const isCoordinator = profile?.is_coordinator === true
  const can = (r: ReportCard) => r.roles.includes(role) || (isCoordinator && !!r.coordinator) || (!!r.check && r.check(profile))

  const groups = GROUPS.map(g => ({ ...g, items: g.items.filter(can) })).filter(g => g.items.length > 0)
  if (groups.length === 0) redirect('/dashboard')

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Справки</h1>
        <p className="text-slate-500 text-sm mt-0.5">Всички справки на едно място, по теми</p>
      </div>
      <div className="space-y-7">
        {groups.map(g => (
          <section key={g.title}>
            <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500 mb-2.5">
              <span className="text-slate-400">{g.icon}</span> {g.title}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {g.items.map(r => (
                <Link key={r.href} href={r.href}
                  className="group flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-[#0f2240]/30 hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="p-2 rounded-xl flex-shrink-0 bg-slate-50 border border-slate-200 text-[#0f2240]">{r.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800">{r.title}</span>
                      <ArrowRight size={14} className="text-slate-300 group-hover:text-[#0f2240] transition-colors flex-shrink-0" />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">{r.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
