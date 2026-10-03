'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, FileText, BookOpen, ScrollText,
  Calendar, Shield, UserCircle, LogOut,
  Building2, Menu, X, GitBranch, BarChart3, FileSpreadsheet,
  Inbox, ClipboardList, FileSignature, Package, Star, Globe, CalendarClock, ChevronDown, Lightbulb, HeartPulse, Settings, GraduationCap, CalendarDays, School, FolderOpen, UserX, ClipboardCheck, Dumbbell
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { UserRole, ROLE_LABELS } from '@/types'
import WhatsNewModal from './WhatsNewModal'
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
  councilOnly?: boolean
   hideFromCoordinator?: boolean
  requiresClass?: boolean
  section?: string
  children?: NavItem[]
  defaultOpen?: boolean   // групата е отворена по подразбиране
}
const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Начало', icon: <LayoutDashboard size={16} /> },
  { href: '/students', label: 'Ученици', icon: <Users size={16} />, roles: ['coordinator', 'psychologist', 'speech_therapist', 'rehabilitator', 'class_teacher', 'teacher', 'educator', 'support'] },
  // Управата: основните регистри в една група, отворена по подразбиране
  {
    href: '#school',
    label: 'Училище',
    icon: <School size={16} />,
    roles: ['admin', 'zdud', 'director'],
    defaultOpen: true,
    children: [
      { href: '/students', label: 'Ученици', icon: <Users size={14} />, roles: ['admin', 'zdud', 'director'] },
      { href: '/classes', label: 'Паралелки', icon: <BookOpen size={14} />, roles: ['admin', 'director', 'zdud'] },
      { href: '/staff', label: 'Служители', icon: <UserCircle size={14} />, roles: ['admin', 'director', 'zdud'] },
    ],
  },
  { href: '/projects', label: 'Проекти', icon: <Lightbulb size={16} />, roles: ['class_teacher', 'teacher', 'educator'] },
   {
    href: '#documents',
    label: 'Документи',
    icon: <FileText size={16} />,
    children: [
      { href: '/templates', label: 'Образци', icon: <FileText size={14} /> },
      { href: '/normative-docs', label: 'Документи в ЦСОП', icon: <ScrollText size={14} /> },
      { href: '/council', label: 'За съгласуване', icon: <ClipboardCheck size={14} /> },
    ],
  },
    { href: '/my-schedule', label: 'Разписание', icon: <CalendarDays size={16} />, roles: ['class_teacher', 'teacher', 'educator'] },
  { href: '/gym-schedule', label: 'Физк. салон', icon: <Dumbbell size={16} />, roles: ['coordinator', 'psychologist', 'speech_therapist', 'rehabilitator', 'class_teacher', 'teacher', 'educator', 'secretary', 'support'] },
       {
      href: '#lecturer',
      label: 'Лекторски',
      icon: <GraduationCap size={16} />,
      roles: ['class_teacher', 'teacher', 'educator'],
      children: [
        { href: '/my-substitutions', label: 'Заместване', icon: <UserX size={14} />, roles: ['class_teacher', 'teacher', 'educator'] },
        { href: '/my-lecturer', label: 'Над норматив', icon: <GraduationCap size={14} />, roles: ['class_teacher', 'teacher', 'educator'] },
      ],
    },
   { href: '/absences', label: 'Реализация на ИУП', icon: <Calendar size={16} />, roles: ['class_teacher'] },
  { href: '/my-activities', label: 'Списък за терапия', icon: <HeartPulse size={16} />, roles: ['psychologist', 'speech_therapist', 'rehabilitator'] },
    { href: '/surveys', label: 'Анкети на новите деца', icon: <ClipboardList size={16} />, roles: ['psychologist', 'speech_therapist', 'rehabilitator'] },
    // Старият генератор — временно обратно (колегите го търсят). Новото: досие → „Документи“ → „Нов документ“. Да се махне, щом всички минат на бланките.
  { href: '/generator', label: 'Генератор (стар)', icon: <FileText size={16} />, roles: ['class_teacher', 'teacher', 'educator', 'psychologist', 'speech_therapist', 'rehabilitator'] },
  { href: '/reports', label: 'Справки', icon: <BarChart3 size={16} />, roles: ['psychologist', 'speech_therapist', 'rehabilitator'] },
  {
    href: '#process',
    label: 'Учебен процес',
        icon: <Calendar size={16} />,
    roles: ['admin', 'zdud', 'director'],
    children: [
      { href: '/schedules', label: 'Разписания', icon: <CalendarClock size={14} />, roles: ['admin', 'zdud', 'director'] },
      { href: '/absences', label: 'Реализация на ИУП', icon: <Calendar size={14} />, roles: ['admin', 'director', 'zdud'] },
      { href: '/admin/tasks', label: 'График срокове', icon: <CalendarClock size={14} />, roles: ['admin', 'zdud', 'director'] },
      { href: '/duties', label: 'Дежурства', icon: <CalendarDays size={14} />, roles: ['admin', 'director', 'zdud'] },
      { href: '/gym-schedule', label: 'Физк. салон', icon: <Dumbbell size={14} />, roles: ['admin', 'zdud', 'director'] },
      { href: '/projects', label: 'Проекти', icon: <Lightbulb size={14} />, roles: ['admin', 'zdud', 'director'] },
    ],
  },
  { href: '/bullying-council', label: 'К. Съвет', icon: <Shield size={16} />, councilOnly: true },
  { href: '/reports/hub', label: 'Справки', icon: <BarChart3 size={16} />, roles: ['admin', 'zdud', 'director'] },
  {
    href: '#lecturer-mgmt',
    label: 'Лекторски',
    icon: <GraduationCap size={16} />,
    roles: ['admin', 'zdud', 'director'],
    children: [
      { href: '/lecturer', label: 'Лекторски часове', icon: <GraduationCap size={14} />, roles: ['admin', 'zdud', 'director'] },
      { href: '/substitutions', label: 'Замествания', icon: <UserX size={14} />, roles: ['admin', 'zdud', 'director'] },
      { href: '/lecturer-review', label: 'Проверка лекторски', icon: <ClipboardList size={14} />, roles: ['admin', 'zdud', 'director'] },
            { href: '/mon-export', label: 'Отчет НП (МОН)', icon: <FileSpreadsheet size={14} />, roles: ['admin', 'zdud', 'director'] },
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
      { href: '/admin/therapists', label: 'Терапевти', icon: <HeartPulse size={14} />, roles: ['admin', 'zdud', 'director'], coordinatorOnly: true },
      { href: '/admin/coud', label: 'ЦОУД групи', icon: <Users size={14} />, roles: ['admin', 'zdud', 'director'], coordinatorOnly: true },
      { href: '/reports/hub', label: 'Справки и писма', icon: <BarChart3 size={14} />, roles: [], coordinatorOnly: true },
            { href: '/surveys', label: 'Анкети на новите деца', icon: <ClipboardList size={14} />, roles: ['admin', 'zdud', 'director'], coordinatorOnly: true },
     { href: '/admin/eplr-schedule', label: 'График ЕПЛР', icon: <CalendarClock size={14} />, roles: ['admin', 'zdud', 'director'], coordinatorOnly: true },
    ],
  },
  // Администрация (рядко: структура, предмети, училища, съобщения, нова година…) — един ред най-долу
  { href: '/admin', label: 'Администрация', icon: <Settings size={16} />, roles: ['admin', 'zdud'] },
  { href: '/correspondence', label: 'Регистър', icon: <Inbox size={16} />, roles: ['admin', 'director', 'zdud', 'secretary'], section: 'delo' },
  { href: '/orders', label: 'Заповеди', icon: <ClipboardList size={16} />, roles: ['admin', 'director', 'zdud', 'secretary'], section: 'delo' },
  { href: '/contracts', label: 'Договори', icon: <FileSignature size={16} />, roles: ['admin', 'director', 'zdud', 'secretary'], section: 'delo' },
  { href: '/procurements', label: 'Обществени поръчки', icon: <Package size={16} />, roles: ['admin', 'director', 'zdud', 'secretary'], section: 'delo' },
  { href: '/site-docs', label: 'Сайт', icon: <Globe size={16} />, roles: ['admin', 'director', 'zdud', 'secretary'], section: 'delo' },
  // Секретар: „Още“ (под Деловодство, свито по подразбиране) — подредено по смисъл
  { href: '/students', label: 'Ученици', icon: <Users size={16} />, roles: ['secretary'], section: 'settings' },
  { href: '/students/documents', label: 'Досиета', icon: <FileText size={16} />, roles: ['secretary'], section: 'settings' },
  { href: '/admin/schools', label: 'Училища', icon: <School size={16} />, roles: ['secretary'], section: 'settings' },
  { href: '/substitutions', label: 'Замествания', icon: <UserX size={16} />, roles: ['secretary'], section: 'settings' },
  { href: '/lecturer-review', label: 'Проверка лекторски', icon: <ClipboardList size={16} />, roles: ['secretary'], section: 'settings' },
  { href: '/duties', label: 'Дежурства', icon: <CalendarDays size={16} />, roles: ['secretary'], section: 'settings' },
  { href: '/templates', label: 'Образци на документи', icon: <FileText size={16} />, roles: ['secretary'], section: 'settings' },
  { href: '/reports/hub', label: 'Справки', icon: <BarChart3 size={16} />, roles: ['secretary'], section: 'settings' },
  { href: '/admin/tasks', label: 'График срокове', icon: <CalendarClock size={16} />, roles: ['secretary'], section: 'settings' },
  { href: '/gym-schedule', label: 'Физк. салон', icon: <Dumbbell size={16} />, roles: ['secretary'], section: 'settings' },
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
  // Акордеон: отворена е само една група наведнъж
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  // Свит сайдбар (само иконки) — помни се в браузъра
  const [mini, setMini] = useState(false)
  useEffect(() => { try { setMini(localStorage.getItem('sb-mini') === '1') } catch {} }, [])
  // На телефон менюто винаги е пълно
  const isMini = mini && !mobileOpen
  function toggleMini() { setMini(m => { try { localStorage.setItem('sb-mini', m ? '0' : '1') } catch {}; return !m }) }
  function toggleKey(key: string) {
    setOpenKey(k => {
      const next = k === key ? null : key
      if (next) requestAnimationFrame(() => document.getElementById(`nav-${next}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
      return next
    })
  }
  const [isCouncil, setIsCouncil] = useState(false)
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('staff_profiles').select('id').eq('user_id', user.id).maybeSingle()
      if (!prof) return
      const { data } = await supabase.from('bullying_council_members').select('id').eq('staff_id', prof.id).limit(1)
      if (active) setIsCouncil((data || []).length > 0)
    })()
    return () => { active = false }
  }, [])
     
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
  // Координаторът вижда СВОЕТО меню (по основната си роля) + групата „Координиращ екип“.
  // По-рано тук се добавяше и ролята 'zdud' → координаторът виждаше цялото меню на ЗДУД.
  const effectiveRoles: UserRole[] = [userRole]
    function canSee(item: NavItem): boolean {
    if (item.href === '/dashboard') return true
    if (isSecretary) return item.section === 'delo' || item.section === 'settings'
     if (item.hideFromCoordinator && isCoordinator) return false
    if (item.requiresClass && !hasClass) return false
    if (item.coordinatorOnly && isCoordinator) return true
    // К. съвет: за админ/ЗДУД е в „Администрация“; в менюто остава за членовете на съвета и директора
    if (item.councilOnly) return (isCouncil || userRole === 'director') && !['admin', 'zdud'].includes(userRole)
    if (!item.roles) return true
    return item.roles.some(r => effectiveRoles.includes(r))
  }
  const visibleItems = navItems
    .map(item => item.children
      ? { ...item, children: item.children.filter(canSee) }
      : item)
    .filter(item => item.children ? item.children.length > 0 : canSee(item))
  // Общ вид на пункт: активният е с лек тъмносин фон и черта отляво; посочване — само лек фон
  const itemCls = (active: boolean, size: 'main' | 'sub' = 'main') => cn(
    'relative flex items-center gap-2.5 rounded-lg transition-colors',
    size === 'main' ? 'px-2.5 py-[7px] text-[13.5px]' : 'px-2.5 py-1.5 text-[13px]',
    isMini && size === 'main' && 'justify-center px-0',
    active
      ? 'bg-[rgba(15,34,64,0.08)] text-[#0f2240] font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-[#0f2240]'
      : 'text-[#33507a] hover:bg-[rgba(15,34,64,0.05)] hover:text-[#0f2240]'
  )
  const iconCls = (active: boolean) => cn('sb-ico flex-shrink-0', active ? 'text-[#0f2240]' : 'text-[#6b8db0]')

  function NavGroup({ item }: { item: NavItem }) {
    const kids = item.children || []
    const hasActiveChild = kids.some(k => pathname === k.href || pathname.startsWith(k.href + '/'))
    const open = openKey === item.href && !isMini
    return (
      <div id={`nav-${item.href}`}>
        <button
          type="button"
          title={isMini ? item.label : undefined}
          onClick={() => { if (isMini) { toggleMini(); setOpenKey(item.href) } else toggleKey(item.href) }}
          className={cn(itemCls(hasActiveChild && !open), 'w-full text-left')}
        >
          <span className={iconCls(hasActiveChild)}>{item.icon}</span>
          {!isMini && <span className="flex-1">{item.label}</span>}
          {!isMini && <ChevronDown size={14} className="text-[#6b8db0] transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />}
        </button>
        {open && (
          <div className="ml-[19px] pl-2 my-0.5 border-l border-[rgba(15,34,64,0.14)] space-y-0.5">
            {kids.map(kid => {
              const active = pathname === kid.href || pathname.startsWith(kid.href + '/')
              return (
                <Link key={kid.href} href={kid.href} onClick={() => setMobileOpen(false)} className={itemCls(active, 'sub')}>
                  <span className={iconCls(active)}>{kid.icon}</span>
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
  const settingsActive = settingsItems.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))
  const isActive = (h: string) => pathname === h || pathname.startsWith(h + '/')
  // При смяна на страницата — отвори групата/секцията, в която е тя (останалите се свиват)
  useEffect(() => {
    const grp = mainItems.find(i => i.children?.some(k => isActive(k.href)))
    if (grp) setOpenKey(grp.href)
    else if (deloItems.some(i => isActive(i.href)) || settingsActive) setOpenKey(null)
    else setOpenKey(k => k ?? (mainItems.find(i => i.defaultOpen && i.children)?.href ?? null))
    setUserMenuOpen(false)
  }, [pathname])
  function NavLink({ item }: { item: NavItem }) {
    const active = pathname === item.href || pathname.startsWith(item.href + '/')
    return (
      <Link href={item.href} onClick={() => setMobileOpen(false)} title={isMini ? item.label : undefined} className={itemCls(active)}>
        <span className={iconCls(active)}>{item.icon}</span>
        {!isMini && <span className="flex-1">{item.label}</span>}
      </Link>
    )
  }
  const divider = <div className="my-3 mx-2.5 border-t border-[rgba(15,34,64,0.10)]" />
  const sidebarContent = (
    <aside className={cn('h-full flex flex-col transition-[width] duration-200', isMini ? 'w-16' : 'w-56')} style={{ backgroundColor: SIDEBAR_BG }}>
      <AutoLogout />
      <div className={cn('flex items-center gap-2.5 py-4', isMini ? 'px-3 justify-center' : 'px-4')} style={{ borderBottom: '1px solid rgba(15,34,64,0.10)' }}>
        <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex-shrink-0">
          <img src="/csop-varna-logo.jpg" alt="ЦСОП Варна" className="w-8 h-8 rounded-lg object-cover" />
        </Link>
        {!isMini && (
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-medium leading-tight" style={{ color: TEXT_PRIMARY }}>ЦСОП Варна</div>
            <div className="text-[11px] leading-tight" style={{ color: '#6b8db0' }}>{isSecretary ? 'Деловодство' : 'ЕПЛР'}</div>
          </div>
        )}
      </div>
      <nav className={cn('flex-1 py-3 overflow-y-auto', isMini ? 'px-2' : 'px-2.5')}>
        <div className="space-y-0.5">
          {mainItems.map(item =>
            item.children
              ? <NavGroup key={item.href} item={item} />
              : <NavLink key={item.href} item={item} />
          )}
        </div>
        {/* Деловодство и „Още“ — без надписи, само тънка черта */}
        {deloItems.length > 0 && (<>
          {mainItems.length > 0 && divider}
          <div className="space-y-0.5">{deloItems.map(item => <NavLink key={item.href} item={item} />)}</div>
        </>)}
        {settingsItems.length > 0 && (<>
          {divider}
          <div className="space-y-0.5">{settingsItems.map(item => <NavLink key={item.href} item={item} />)}</div>
        </>)}
      </nav>
      {/* Свий / разгъни (само на компютър) */}
      <button type="button" onClick={toggleMini} title={isMini ? 'Разгъни менюто' : 'Свий менюто до иконки'}
        className={cn('hidden md:flex items-center gap-2 mx-2.5 mb-1 px-2.5 py-1.5 rounded-lg text-[12px] text-[#6b8db0] hover:bg-[rgba(15,34,64,0.05)] hover:text-[#0f2240] transition-colors', isMini && 'justify-center px-0')}>
        <ChevronDown size={14} className={isMini ? '-rotate-90' : 'rotate-90'} />
        {!isMini && 'Свий менюто'}
      </button>
      <div className="relative px-3 py-2.5" style={{ borderTop: '1px solid rgba(15,34,64,0.12)' }}>
        {/* Меню на профила — отваря се нагоре при клик */}
        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
            <div className="absolute left-2 bottom-full mb-1 z-20 w-52 rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,34,64,0.14)] p-1.5">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <div className="text-xs font-semibold truncate" style={{ color: TEXT_PRIMARY }}>{userName}</div>
                <div className="text-[11px] truncate" style={{ color: TEXT_MUTED }}>
                  {userPosition || ROLE_LABELS[userRole]}
                  {isCoordinator && <span style={{ color: '#2563a8' }}> · Координатор</span>}
                </div>
              </div>
              <Link href="/my-files" onClick={() => { setUserMenuOpen(false); setMobileOpen(false) }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-slate-50" style={{ color: TEXT_SECONDARY }}>
                <FolderOpen size={14} /> Моите документи
              </Link>
              <Link href="/profile" onClick={() => { setUserMenuOpen(false); setMobileOpen(false) }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-slate-50" style={{ color: TEXT_SECONDARY }}>
                <Settings size={14} /> Профил и парола
              </Link>
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-rose-50 hover:text-rose-700" style={{ color: TEXT_SECONDARY }}>
                <LogOut size={14} /> Изход
              </button>
            </div>
          </>
        )}
        <button type="button" onClick={() => setUserMenuOpen(o => !o)}
          className={cn('w-full flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-[rgba(15,34,64,0.05)]', isMini && 'justify-center')}
          title={isMini ? userName : 'Профил, документи, изход'}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
            style={{ backgroundColor: 'rgba(15,34,64,0.12)', color: TEXT_PRIMARY }}>
            {userName.charAt(0)}
          </div>
          {!isMini && <span className="flex-1 min-w-0 text-left text-xs font-medium truncate" style={{ color: TEXT_PRIMARY }}>{userName}</span>}
          {!isMini && <ChevronDown size={13} style={{ color: TEXT_MUTED, transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
        </button>
      </div>
    </aside>
  )
  return (
    <>
      <div className={cn('hidden md:flex h-screen sticky top-0 overflow-y-auto flex-shrink-0 transition-[width] duration-200', isMini ? 'w-16' : 'w-56')}>
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
      <WhatsNewModal />
    </>
  )
}
