import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, Users, GraduationCap, Bus, FileText, ArrowRight, Coffee, Phone, School } from 'lucide-react'
export const dynamic = 'force-dynamic'

interface ReportCard {
  href: string
  title: string
  desc: string
  icon: React.ReactNode
  roles: string[]
  coordinatorOnly?: boolean
}

const REPORTS: ReportCard[] = [
  { href: '/reports', title: 'Натовареност', desc: 'Разпределение и интензивност на терапиите', icon: <BarChart3 size={20} />, roles: ['admin', 'zdud', 'director'], coordinatorOnly: true },
  { href: '/reports/enrollments', title: 'Заявления за прием и ЦОУД', desc: 'Подадени заявления с подателите', icon: <FileText size={20} />, roles: ['admin', 'zdud', 'director', 'secretary'] },
  { href: '/reports/by-class', title: 'Ученици по клас', desc: 'Групиране по клас за планиране на паралелки', icon: <GraduationCap size={20} />, roles: ['admin', 'zdud', 'director', 'secretary'] },
  { href: '/reports/traveling', title: 'Пътуващи ученици', desc: 'Деца, които пътуват от друго населено място', icon: <Bus size={20} />, roles: ['admin', 'zdud', 'director', 'secretary'] },
  { href: '/classes?tab=coud', title: 'ЦОУД групи', desc: 'Групи, възпитатели и записани ученици', icon: <Coffee size={20} />, roles: ['admin', 'zdud', 'director', 'secretary'] },
    { href: '/reports/by-school', title: 'Ученици по училища', desc: 'Групирани по изпращащо училище и клас — за печат', icon: <School size={20} />, roles: ['admin', 'zdud', 'director', 'secretary'] },
    { href: '/reports/guardians', title: 'Родители и контакти', desc: 'Ученик, паралелка, родител и телефон — за печат', icon: <Phone size={20} />, roles: ['admin', 'zdud', 'director', 'secretary'] },
]

export default async function ReportsHubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles').select('role, is_coordinator').eq('user_id', user.id).single()
  const role = profile?.role || ''
  const isCoordinator = profile?.is_coordinator === true

    const visible = REPORTS.filter(r => {
    const roleOk = r.roles.includes(role) || isCoordinator
    if (!roleOk) return false
    if (r.coordinatorOnly && !isCoordinator && !['admin', 'zdud'].includes(role)) return false
    return true
  })

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Справки</h1>
        <p className="text-slate-500 text-sm mt-0.5">Изберете справка</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visible.map(r => (
          <Link key={r.href} href={r.href}
            className="group flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-[#0f2240]/30 hover:shadow transition-all">
            <div className="p-2.5 rounded-xl flex-shrink-0" style={{ backgroundColor: '#0f2240' }}>
              <span className="text-white">{r.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">{r.title}</span>
                <ArrowRight size={15} className="text-slate-300 group-hover:text-[#0f2240] transition-colors flex-shrink-0" />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
