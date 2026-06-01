'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, FileText, BookOpen,
  Calendar, Shield, UserCircle, LogOut, ChevronRight,
  Building2, Menu, X, GitBranch, BarChart3
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { UserRole, ROLE_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { AutoLogout } from '@/components/AutoLogout'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles?: UserRole[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Начало', icon: <LayoutDashboard size={18} /> },
  { href: '/students', label: 'Ученици', icon: <Users size={18} /> },
  { href: '/classes', label: 'Паралелки', icon: <BookOpen size={18} />, roles: ['admin', 'director', 'zdud', 'psychologist', 'speech_therapist', 'rehabilitator'] },
  { href: '/documents', label: 'Документи', icon: <FileText size={18} /> },
  { href: '/absences', label: 'Реализация на ИУП', icon: <Calendar size={18} />, roles: ['admin', 'director', 'zdud', 'class_teacher'] },
  { href: '/committees', label: 'Комисии', icon: <Building2 size={18} /> },
  { href: '/staff', label: 'Служители', icon: <UserCircle size={18} />, roles: ['admin', 'director', 'zdud'] },
  { href: '/reports', label: 'Справки', icon: <BarChart3 size={18} />, roles: ['admin', 'director', 'zdud'] },
  { href: '/admin/eplr-assignment', label: 'ЕПЛР Разпределение', icon: <GitBranch size={18} />, roles: ['admin', 'zdud'] },
  { href: '/admin', label: 'Администрация', icon: <Shield size={18} />, roles: ['admin', 'zdud'] },
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
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const visibleItems = navItems.filter(
    item => !item.roles || item.roles.includes(userRole)
  )

  const sidebarContent = (
    <aside className="w-56 h-full flex flex-col bg-navy" style={{ backgroundColor: '#0f2240' }}>
      <AutoLogout />
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
            <img src="/csop-varna-logo.jpg" alt="ЦСОП Варна" className="w-9 h-9 rounded-lg object-cover" />
          </Link>
          <div>
            <div className="text-white text-sm font-semibold">ЦСОП Варна</div>
            <div className="text-white/40 text-xs">ЕПЛР</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
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

  return (
    <>
      <div className="hidden md:flex w-56 h-screen sticky top-0 overflow-y-auto flex-shrink-0">
        {sidebarContent}
      </div>

      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14"
           style={{ backgroundColor: '#0f2240' }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <img src="/csop-varna-logo.jpg" alt="ЦСОП Варна" className="w-8 h-8 rounded-lg object-cover" />
          </Link>
          <div>
            <div className="text-white text-sm font-semibold">ЦСОП Варна</div>
            <div className="text-white/40 text-xs">ЕПЛР</div>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(prev => !prev)}
          className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Меню"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className={cn(
        'md:hidden fixed top-14 left-0 bottom-0 z-40 w-56 transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {sidebarContent}
      </div>

      <div className="md:hidden h-14 w-full" />
    </>
  )
}
