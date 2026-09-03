'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, FileText, BookOpen, ScrollText,
  Calendar, Shield, UserCircle, LogOut,
  Building2, Menu, X, GitBranch, BarChart3,
  Inbox, ClipboardList, FileSignature, Package, Star, CalendarClock, ChevronDown, HeartPulse, Settings, GraduationCap, CalendarDays, School, FolderOpen, UserX
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { UserRole, ROLE_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { AutoLogout } from '@/components/AutoLogout'
const SIDEBAR_BG = '#f0f7ff'
const SIDEBAR_HOVER = 'rgba(15,34,64,0.04)'
const TEXT_PRIMARY = '#0f2240'
const TEXT_SECONDARY = '#1e4070'
const TEXT_MUTED = '#4a7fa8'
interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles?: UserRole[]
  coordinatorOnly?: boolean
   hideFromCoordinator?: boolean
  requiresClass?: boolean
  section?: string
  children?: NavItem[]
}
const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Начало', icon: <LayoutDashboard size={16} /> },
  { href: '/students', label: 'Ученици', icon: <Users size={16} /> },
  { href: '/classes', label: 'Паралелки', icon: <BookOpen size={16} />, roles: ['admin', 'director', 'zdud'] },
   {
    href: '#documents',
    label: 'Документи',
    icon: <FileText size={16} />,
    children: [
      { href: '/templates', label: 'Образци', icon: <FileText size={14} /> },
      { href: '/normative-docs', label: 'Нормативна база', icon: <ScrollText size={14} /> },
    ],
  },
  { href: '/spravki', label: 'Справки', icon: <BarChart3 size={16} />, roles: ['psychologist', 'speech_therapist', 'rehabilitator'], hideFromCoordinator: true },
    { href: '/my-schedule/edit', label: 'Въвеждане на разписание', icon: <GraduationCap size={16} />, roles: ['class_teacher', 'teacher', 'educator'] },
  { href: '/my-schedule', label: 'Моето разписание', icon: <CalendarDays size={16} />, roles: ['class_teacher', 'teacher', 'educator'] },
    { href: '/my-substitutions', label: 'Моите замествания', icon: <UserX size={16} />, roles: ['class_teacher', 'teacher', 'educator'] },
      { href: '/my-lecturer', label: 'Лекторски — над норматив', icon: <GraduationCap size={16} />, roles: ['class_teacher', 'teacher', 'educator'] },
   { href: '/absences', label: 'Реализация на ИУП', icon: <Calendar size={16} />, roles: ['class_teacher'] },
  { href: '/my-activities', label: 'Списък за терапия', icon: <HeartPulse size={16} />, roles: ['psychologist', 'speech_therapist', 'rehabilitator'] },
    { href: '/generator', label: 'Генератор на документи', icon: <FileText size={16} />, roles: ['class_teacher', 'teacher', 'educator', 'psychologist', 'speech_therapist', 'rehabilitator'] },
  { href: '/reports', label: 'Натовареност', icon: <BarChart3 size={16} />, roles: ['psychologist', 'speech_therapist', 'rehabilitator'] },
  {
    href: '#process',
    label: 'Учебен процес',
        icon: <Calendar size={16} />,
    roles: ['admin', 'zdud', 'director'],
    children: [
      { href: '/absences', label: 'Реализация на ИУП', icon: <Calendar size={14} />, roles: ['admin', 'director', 'zdud'] },
      { href: '/schedules', label: 'Разписания', icon: < size={14} />, roles: ['admin', 'zdud', 'director'] },
      { href: '/duties', label: 'Дежурства', icon: <CalendarDays size={14} />, roles: ['admin', 'director', 'zdud'] },
    ],
  },
  {
    href: '#manage',
    label: 'Управление',
    icon: <Shield size={16} />,
    roles: ['admin', 'zdud', 'director'],
    children: [
      { href: '/staff', label: 'Служители', icon: <UserCircle size={14} />, roles: ['admin', 'director', 'zdud'] },
      { href: '/reports/hub', label: 'Справки', icon: <BarChart3 size={14} />, roles: ['admin', 'director', 'zdud'] },
      { href: '/admin', label: 'Администрация', icon: <Settings size={14} />, roles: ['admin', 'zdud'] },
            { href: '/lecturer', label: 'Лекторски часове', icon: <GraduationCap size={14} />, roles: ['admin', 'zdud', 'director'] },
      { href: '/lecturer-review', label: 'Проверка лекторски', icon: <ClipboardList size={14} />, roles: ['admin', 'zdud', 'director'] },
    ],
  },
  {
    href: '#coordinating',
    label: 'Координиращ екип',
    icon: <Star size={16} />,
    roles: ['admin', 'zdud', 'director'],
    coordinatorOnly: true,
    children: [
      { href: '/admin/coordinating-team', label: 'Заседания и документи', icon: <ClipboardList size={14} />, roles: ['admin', 'zdud', 'director'], coordinatorOnly: true },
      { href: '/admin/eplr-assignment', label: 'Разпределение ЕПЛР', icon: <GitBranch size={14} />, roles: ['admin', 'zdud'], coordinatorOnly: true },
      { href: '/reports/hub', label: 'Справки и писма', icon: <BarChart3 size={14} />, roles: ['admin', 'zdud', 'director'], coordinatorOnly: true },
     { href: '/admin/eplr-schedule', label: 'График ЕПЛР', icon: <CalendarClock size={14} />, roles: ['admin', 'zdud', 'director'], coordinatorOnly: true },
    ],
  },
  { href: '/correspondence', label: 'Регистър', icon: <Inbox size={16} />, roles: ['admin', 'director', 'zdud', 'secretary'], section: 'delo' },
  { href: '/orders', label: 'Заповеди', icon: <ClipboardList size={16} />, roles: ['admin', 'director', 'zdud', 'secretary'], section: 'delo' },
  { href: '/contracts', label: 'Договори', icon: <FileSignature size={16} />, roles: ['admin', 'director', 'zdud', 'secretary'], section: 'delo' },
  { href: '/procurements', label: 'Обществени поръчки', icon: <Package size={16} />, roles: ['admin', 'director', 'zdud', 'secretary'], section: 'delo' },
  { href: '/admin/schools', label: 'Училища', icon: <School size={16} />, roles: ['secretary'], section: 'settings' },
  { href: '/students', label: 'Ученици', icon: <Users size={16} />, roles: ['secretary'], section: 'settings' },
  { href: '/templates', label: 'Образци на документи', icon: <FileText size={16} />, roles: ['secretary'], section: 'settings' },
    { href: '/lecturer-review', label: 'Проверка лекторски', icon: <ClipboardList size={16} />, roles: ['secretary'], section: 'settings' },
  { href: '/duties', label: 'Дежурства', icon: <CalendarDays size={16} />, roles: ['secretary'], section: 'settings' },
  { href: '/reports/hub', label: 'Справки', icon: <BarChart3 size={16} />, roles: ['secretary'], section: 'settings' },
  { href: '/students/documents', label: 'Досиета', icon: <FileText size={16} />, roles: ['secretary'], section: 'settings' },
]
interface SidebarProps {
  userRole: UserRole
  userName: string
  userEmail: string
    isCoordinator?: boolean
  hasClass?: boolean
  userPosition?: string
}
export function Sidebar({ userRole, userName, userEmail, isCoordinator = false, userPosition = '', hasClass = true }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
   const [mobileOpen, setMobileOpen] = useState(false)
   const [settingsOpen, setSettingsOpen] = useState(false)
  const [deloOpen, setDeloOpen] = useState(false)
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
  const isSecretary = userRole === 'secretary'
  const effectiveRoles: UserRole[] = isCoordinator ? [userRole, 'zdud' as UserRole] : [userRole]
    function canSee(item: NavItem): boolean {
    if (item.href === '/dashboard') return true
    if (isSecretary) return item.section === 'delo' || item.section === 'settings'
     if (item.hideFromCoordinator && isCoordinator) return false
    if (item.requiresClass && !hasClass) return false
    if (item.coordinatorOnly && isCoordinator) return true
    if (!item.roles) return true
    return item.roles.some(r => effectiveRoles.includes(r))
  }
  const visibleItems = navItems
    .map(item => item.children
      ? { ...item, children: item.children.filter(canSee) }
      : item)
    .filter(item => item.children ? item.children.length > 0 : canSee(item))
  function NavGroup({ item }: { item: NavItem }) {
    const kids = item.children || []
    const hasActiveChild = kids.some(k => pathname === k.href || pathname.startsWith(k.href + '/'))
    const [open, setOpen] = useState(hasActiveChild)
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-full transition-colors"
          style={{
            color: hasActiveChild ? TEXT_PRIMARY : TEXT_SECONDARY,
            fontWeight: hasActiveChild ? 600 : 500,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
        >
          {item.icon}
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', opacity: 0.45 }} />
        </button>
        {open && (
          <div className="pl-4 pt-0.5 space-y-0.5">
            {kids.map(kid => {
              const active = pathname === kid.href || pathname.startsWith(kid.href + '/')
              return (
                <Link
                  key={kid.href}
                  href={kid.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-[13px] transition-all rounded-full"
                  style={{
                    backgroundColor: 'transparent',
                    color: active ? TEXT_PRIMARY : TEXT_MUTED,
                    fontWeight: active ? 600 : 400,
                    border: active ? '1.5px solid rgba(15,34,64,0.18)' : '1.5px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER
                      ;(e.currentTarget as HTMLElement).style.color = TEXT_SECONDARY
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                      ;(e.currentTarget as HTMLElement).style.color = TEXT_MUTED
                    }
                  }}
                >
                  {kid.icon}
                  <span className="flex-1">{kid.label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }
  const mainItems = visibleItems.filter(item => !item.section)
  const deloItems = visibleItems.filter(item => item.section === 'delo')
  const settingsItems = visibleItems.filter(item => item.section === 'settings')
  function NavLink({ item }: { item: NavItem }) {
    const active = pathname === item.href || pathname.startsWith(item.href + '/')
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-2.5 px-3 py-2 text-sm transition-all rounded-full"
        style={{
          backgroundColor: 'transparent',
          color: active ? TEXT_PRIMARY : TEXT_SECONDARY,
          fontWeight: active ? 600 : 400,
          border: active ? `1.5px solid rgba(15,34,64,0.22)` : '1.5px solid transparent',
        }}
        onMouseEnter={e => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER
            ;(e.currentTarget as HTMLElement).style.border = '1.5px solid rgba(15,34,64,0.10)'
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
            ;(e.currentTarget as HTMLElement).style.border = '1.5px solid transparent'
          }
        }}
      >
        {item.icon}
        <span className="flex-1">{item.label}</span>
      </Link>
    )
  }
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
            <div className="text-xs" style={{ color: TEXT_MUTED }}>{isSecretary ? 'Деловодство' : 'ЕПЛР'}</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-4 px-2 overflow-y-auto">
        <div className="space-y-0.5">
          {mainItems.map(item =>
            item.children
              ? <NavGroup key={item.href} item={item} />
              : <NavLink key={item.href} item={item} />
          )}
        </div>
                {deloItems.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(15,34,64,0.08)' }}>
            {isSecretary ? (
              <div className="px-3 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: TEXT_MUTED }}>
                  Деловодство
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDeloOpen(o => !o)}
                className="w-full flex items-center gap-1.5 px-3 mb-2"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest flex-1 text-left" style={{ color: TEXT_MUTED }}>
                  Деловодство
                </span>
                <ChevronDown size={13} style={{ color: TEXT_MUTED, transform: deloOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', opacity: 0.6 }} />
              </button>
            )}
            {(isSecretary || deloOpen) && (
              <div className="space-y-0.5">
                {deloItems.map(item => <NavLink key={item.href} item={item} />)}
              </div>
            )}
          </div>
        )}
                {settingsItems.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(15,34,64,0.08)' }}>
            <button
              type="button"
              onClick={() => setSettingsOpen(o => !o)}
              className="w-full flex items-center gap-1.5 px-3 mb-2 group"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest flex-1 text-left" style={{ color: TEXT_MUTED }}>
                Настройки
              </span>
              <ChevronDown size={13} style={{ color: TEXT_MUTED, transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', opacity: 0.6 }} />
            </button>
            {settingsOpen && (
              <div className="space-y-0.5">
                {settingsItems.map(item => <NavLink key={item.href} item={item} />)}
              </div>
                       )}
          </div>
        )}
      </nav>
      <div className="p-4" style={{ borderTop: '1px solid rgba(15,34,64,0.12)' }}>
        <Link href="/profile" onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2.5 mb-1.5 rounded-xl p-1.5 -m-1.5 transition-colors hover:bg-[rgba(15,34,64,0.04)]">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ backgroundColor: 'rgba(15,34,64,0.12)', color: TEXT_PRIMARY }}>
            {userName.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-semibold truncate" style={{ color: TEXT_PRIMARY }}>{userName}</div>
            <div className="text-xs" style={{ color: TEXT_MUTED }}>
              {userPosition || ROLE_LABELS[userRole]}
              {isCoordinator && <span className="ml-1" style={{ color: '#2563a8' }}>· Координатор</span>}
            </div>
          </div>
        </Link>
                <Link href="/my-files" onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2 px-3 py-1.5 mb-1 rounded-full transition-all text-[11px]"
          style={{ color: TEXT_MUTED }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER; (e.currentTarget as HTMLElement).style.color = TEXT_SECONDARY }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = TEXT_MUTED }}
        >
          <FolderOpen size={13} />
          Мои файлове
        </Link>
        <Link href="/profile" onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2 px-3 py-1.5 mb-1 rounded-full transition-all text-[11px]"
          style={{ color: TEXT_MUTED }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER; (e.currentTarget as HTMLElement).style.color = TEXT_SECONDARY }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = TEXT_MUTED }}
        >
          <Settings size={13} />
          Профил и парола
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-full transition-all text-xs"
          style={{ color: TEXT_MUTED, border: '1.5px solid transparent' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = SIDEBAR_HOVER
            ;(e.currentTarget as HTMLElement).style.border = '1.5px solid rgba(15,34,64,0.10)'
            ;(e.currentTarget as HTMLElement).style.color = TEXT_PRIMARY
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
            ;(e.currentTarget as HTMLElement).style.border = '1.5px solid transparent'
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
      <div className="hidden md:flex w-56 h-screen sticky top-0 overflow-y-auto flex-shrink-0">
        {sidebarContent}
      </div>
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14"
           style={{ backgroundColor: SIDEBAR_BG, borderBottom: '1px solid rgba(15,34,64,0.12)' }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <img src="/csop-varna-logo.jpg" alt="ЦСОП Варна" className="w-8 h-8 rounded-lg object-cover" />
          </Link>
          <div>
            <div className="text-sm font-semibold" style={{ color: TEXT_PRIMARY }}>ЦСОП Варна</div>
            <div className="text-xs" style={{ color: TEXT_MUTED }}>{isSecretary ? 'Деловодство' : 'ЕПЛР'}</div>
          </div>
        </div>
        <button onClick={() => setMobileOpen(prev => !prev)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: TEXT_SECONDARY }} aria-label="Меню">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}
      <div className={cn(
        'md:hidden fixed top-14 left-0 bottom-0 z-40 w-56 transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {sidebarContent}
      </div>
      <div className="md:hidden h-14 flex-shrink-0" />
    </>
  )
}
