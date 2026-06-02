'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, FileText, BookOpen,
  Calendar, Shield, UserCircle, LogOut, ChevronRight,
  Building2, Menu, X, GitBranch, BarChart3, Mail
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { UserRole, ROLE_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { AutoLogout } from '@/components/AutoLogout'

const SIDEBAR_BG = '#e0f2fe'
const SIDEBAR_ACTIVE = 'rgba(15,34,64,0.10)'
const SIDEBAR_HOVER = 'rgba(15,34,64,0.05)'
const TEXT_PRIMARY = '#0f2240'
const TEXT_SECONDARY = '#3b6fa0'
const TEXT_MUTED = '#64a0c8'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles?: UserRole[]
  coordinatorOnly?: boolean
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Начало', icon: <LayoutDashboard size={18} /> },
  { href: '/students', label: 'Ученици', icon: <Users size={18} /> },
  { href: '/classes', label: 'Паралелки', icon: <BookOpen size={18} />, roles: ['admin', 'director', 'zdud'] },
  { href: '/documents', label: 'Документи', icon: <FileText size={18} /> },
  { href: '/absences', label: 'Реализация на ИУП', icon: <Calendar size={18} />, roles: ['admin', 'director', 'zdud', 'class_teacher'] },
  { href: '/committees', label: 'Комисии', icon: <Building2 size={18} /> },
  { href: '/staff', label: 'Служители', icon: <UserCircle size={18} />, roles: ['admin', 'director', 'zdud'] },
  { href: '/reports', label: 'Справки', icon: <BarChart3 size={18} />, roles: ['admin', 'director', 'zdud'], coordinatorOnly: true },
  { href: '/correspondence', label: 'Кореспонденция', icon: <Mail size={18} />, roles: ['admin', 'director', 'zdud'], coordinatorOnly: true },
  { href: '/admin/eplr-assignment', label: 'ЕПЛР Разпределение', icon: <GitBranch size={18} />, roles: ['admin', 'zdud'], coordinatorOnly: true },
  { href: '/admin', label: 'Администрация', icon: <Shield size={18} />, roles: ['admin', 'zdud'] },
]

interface SidebarProps {
  userRole: UserRole
  userName: string
  userEmail: string
  isCoordinator?: boolean
}

export function Sidebar({ userRole, userName, userEmail, isCoordinator = false }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [pathname])

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

  const visibleItems = navItems.filter(item => {
    if (item.coordinatorOnly && isCoordinator) return true
    if (!item.roles) return true
    return item.roles.includes(userRole)
  })

  const sidebarContent = (
    <aside className="w-56 h-full flex flex-col" style={{ backgroundColor: SIDEBAR_BG }}>
      <AutoLogout />
      <div className="p-5" style={{ borderBottom: '1px solid rgba(15,34,64,0.12)' }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
            <img src="/csop-varna-logo.jpg" alt="ЦСОП Варна" className="w-9 h-9 rounded-lg object-cover" />
          </Link>
          <div>
            <div className="text-sm font-semibold" style={{ color: TEXT_PRIMARY }}>ЦСОП Варна</div>
            <div className="text-xs" style={{ color: TEXT_MUTED }}>ЕПЛР</div>
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
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: active ? SIDEBAR_ACTIVE : 'transparent',
                color: active ? TEXT_PRIMARY : TEXT_SECONDARY,
                fontWeight: active ? 600 : 400,
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight size={14} style={{ color: TEXT_PRIMARY, opacity: 0.4 }} />}
            </Link>
          )
        })}
      </nav>

      <div className="p-4" style={{ borderTop: '1px solid rgba(15,34,64,0.12)' }}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ backgroundColor: 'rgba(15,34,64,0.12)', color: TEXT_PRIMARY }}>
            {userName.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-semibold truncate" style={{ color: TEXT_PRIMARY }}>{userName}</div>
            <div className="text-xs" style={{ color: TEXT_MUTED }}>
              {ROLE_LABELS[userRole]}
              {isCoordinator && <span className="ml-1" style={{ color: '#2563a8' }}>· Координатор</span>}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-xs"
          style={{ color: TEXT_MUTED }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER
            ;(e.currentTarget as HTMLElement).style.color = TEXT_PRIMARY
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = TEXT_MUTED
          }}
        >
          <LogOut size={14} />
          Изход
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* ДЕСКТОП */}
      <div className="hidden md:flex w-56 h-screen sticky top-0 overflow-y-auto flex-shrink-0">
        {sidebarContent}
      </div>

      {/* МОБИЛЕН: топ лента */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14"
           style={{ backgroundColor: SIDEBAR_BG, borderBottom: '1px solid rgba(15,34,64,0.12)' }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <img src="/csop-varna-logo.jpg" alt="ЦСОП Варна" className="w-8 h-8 rounded-lg object-cover" />
          </Link>
          <div>
            <div className="text-sm font-semibold" style={{ color: TEXT_PRIMARY }}>ЦСОП Варна</div>
            <div className="text-xs" style={{ color: TEXT_MUTED }}>ЕПЛР</div>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(prev => !prev)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: TEXT_SECONDARY }}
          aria-label="Меню"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* МОБИЛЕН: overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      {/* МОБИЛЕН: drawer */}
      <div className={cn(
        'md:hidden fixed top-14 left-0 bottom-0 z-40 w-56 transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {sidebarContent}
      </div>

      {/* МОБИЛЕН: spacer */}
      <div className="md:hidden h-14 flex-shrink-0" />
    </>
  )
}
