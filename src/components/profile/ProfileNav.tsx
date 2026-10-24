import Link from 'next/link'
import { LayoutGrid, IdCard, Users, Award, BookUser, FolderOpen, KeyRound } from 'lucide-react'
import { PP_ROLES } from '@/lib/pro-portfolio'

// Табовете на „Моят профил“ — едно място за всичко лично: данни, класове, оценяване, портфолио, документи, вход.
// Стоят и над /pro-portfolio и /my-files, за да изглеждат като част от профила (адресите им не се сменят).
export type ProfileTab = 'overview' | 'data' | 'work' | 'growth' | 'portfolio' | 'files' | 'security'

// staffId — профил на колега (/staff/[id]): същите раздели без личните (Моите документи, Вход и парола)
export function profileTabs(role: string, staffId?: string) {
  if (staffId) {
    const b = `/staff/${staffId}`
    return [
      { k: 'overview' as const, href: b, label: 'Обзор', Icon: LayoutGrid },
      { k: 'data' as const, href: `${b}?tab=data`, label: 'Данни', Icon: IdCard },
      { k: 'work' as const, href: `${b}?tab=work`, label: 'Класове и ученици', Icon: Users, hide: ['secretary', 'support'].includes(role) },
      { k: 'growth' as const, href: `${b}?tab=growth`, label: 'Оценяване', Icon: Award },
      { k: 'portfolio' as const, href: `/pro-portfolio?staff=${staffId}`, label: 'Проф. портфолио', Icon: BookUser, hide: !PP_ROLES.includes(role) },
    ].filter(t => !t.hide)
  }
  return [
    { k: 'overview' as const, href: '/profile', label: 'Обзор', Icon: LayoutGrid },
    { k: 'data' as const, href: '/profile?tab=data', label: 'Данни', Icon: IdCard },
    { k: 'work' as const, href: '/profile?tab=work', label: 'Класове и ученици', Icon: Users, hide: ['secretary', 'support'].includes(role) },
    { k: 'growth' as const, href: '/profile?tab=growth', label: 'Оценяване', Icon: Award },
    { k: 'portfolio' as const, href: '/pro-portfolio', label: 'Проф. портфолио', Icon: BookUser, hide: !PP_ROLES.includes(role) },
    { k: 'files' as const, href: '/my-files', label: 'Моите документи', Icon: FolderOpen },
    { k: 'security' as const, href: '/profile?tab=security', label: 'Вход и парола', Icon: KeyRound },
  ].filter(t => !t.hide)
}

export default function ProfileNav({ active, role, className = '', staffId }: { active: ProfileTab; role: string; className?: string; staffId?: string }) {
  return (
    <nav aria-label={staffId ? 'Профил на служител' : 'Моят профил'} className={`flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm ${className}`}>
      {profileTabs(role, staffId).map(({ k, href, label, Icon }) => {
        const on = k === active
        return (
          <Link key={k} href={href} aria-current={on ? 'page' : undefined}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] transition-colors ${on ? 'bg-sky-50 text-[#0f2240] ring-1 ring-sky-200 font-medium' : 'text-slate-600 hover:bg-slate-100 hover:text-[#0f2240]'}`}>
            <Icon size={14} /> {label}
          </Link>
        )
      })}
    </nav>
  )
}
