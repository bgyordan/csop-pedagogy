'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, FileText, BookOpen,
  Calendar, Shield, UserCircle, LogOut, ChevronRight,
  Building2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { UserRole, ROLE_LABELS } from '@/types'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles?: UserRole[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Начало', icon: <LayoutDashboard size={18} /> },
  { href: '/students', label: 'Ученици', icon: <Users size={18} /> },
  { href: '/documents', label: 'Документи', icon: <FileText size={18} /> },
  { href: '/absences', label: 'Отсъствия', icon: <Calendar size={18} /> },
  { href: '/committees', label: 'Комисии', icon: <Building2 size={18} /> },
  { href: '/staff', label: 'Служители', icon: <UserCircle size={18} />, roles: ['admin', 'director', 'zdud'] },
  { href: '/admin', label: 'Администрация', icon: <Shield size={18} />, roles: ['admin'] },
]

interface SidebarProps {
  userRole: UserRole
  userName: string
  userEmail: string
}

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const visibleItems = navItems.filter(
    item => !item.roles || item.roles.includes(userRole)
  )

  return (
    <aside className="w-56 min-h-screen bg-navy flex flex-col"
           style={{ backgroundColor: '#0f2240' }}>
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-navy font-bold text-lg"
               style={{ backgroundColor: '#c9a84c', color: '#0f2240' }}>
            Ц
          </div>
          <div>
            <div className="text-white text-sm font-semibold">ЦСОП Варна</div>
            <div className="text-white/40 text-xs">Педагогическа система</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {visibleItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight size={14} className="opacity-50" />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-medium">
            {userName.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="text-white text-xs font-medium truncate">{userName}</div>
            <div className="text-white/40 text-xs">{ROLE_LABELS[userRole]}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/50
                     hover:text-white hover:bg-white/5 transition-colors text-xs"
        >
          <LogOut size={14} />
          Изход
        </button>
      </div>
    </aside>
  )
}
