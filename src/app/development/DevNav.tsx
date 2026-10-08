'use client'

// Табове на „Развитие“: общата картина (анализ) и двигателната оценка (групова карта)
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sprout, Activity } from 'lucide-react'

export default function DevNav() {
  const path = usePathname()
  const tabs = [
    { href: '/development', label: 'Обща оценка — анализ', icon: <Sprout size={15} />, on: path === '/development' },
    { href: '/development/motor', label: 'Двигателна оценка — групова карта', icon: <Activity size={15} />, on: path.startsWith('/development/motor') },
  ]
  return (
    <div className="px-4 md:px-8 pt-4 md:pt-6">
      <div className="flex flex-wrap gap-1 p-1 bg-white border border-slate-200 rounded-xl w-fit">
        {tabs.map(t => (
          <Link key={t.href} href={t.href}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium ${t.on ? 'bg-[#0f2240] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            {t.icon}{t.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
