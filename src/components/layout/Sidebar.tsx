
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, FileText, Menu, X, LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Начало', icon: <LayoutDashboard size={18} /> },
  { href: '/students', label: 'Ученици', icon: <Users size={18} /> },
  { href: '/documents', label: 'Документи', icon: <FileText size={18} /> },
]

export function Sidebar({
  userName,
}: {
  userName: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const content = (
    <aside className="w-56 h-full bg-[#0f2240] text-white flex flex-col">

      {/* LOGO */}
      <div className="p-4 border-b border-white/10 font-semibold">
        ЦСОП
      </div>

      {/* NAV */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                active
                  ? 'bg-white/10'
                  : 'text-white/60 hover:bg-white/10'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* USER */}
      <div className="p-3 border-t border-white/10 text-xs">
        <div className="mb-2">{userName}</div>
        <button onClick={logout} className="flex gap-2 items-center">
          <LogOut size={14} />
          Изход
        </button>
      </div>

    </aside>
  )

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:flex w-56 h-screen sticky top-0">
        {content}
      </div>

      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0f2240] flex items-center justify-between px-4 text-white z-50">
        <span>ЦСОП</span>
        <button onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* OVERLAY */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* MOBILE MENU */}
      <div
        className={cn(
          'md:hidden fixed top-14 left-0 bottom-0 w-56 z-50 transition-transform',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {content}
      </div>
    </>
  )
}
