import Link from 'next/link'
import { ChevronRight, Mail, Phone } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import type { StaffStudent } from '@/lib/staff-students'

// Общите парчета на „Моят профил“ (сървърни, без състояние).

export function Hero({ name, initials, photo, subtitle, badges, email, phone, aside, kicker = 'Моят профил', actions }: {
  name: string; initials: string; photo?: string | null; subtitle: string
  badges: { label: string; tone?: 'light' | 'accent' }[]; email?: string | null; phone?: string | null
  aside?: React.ReactNode; kicker?: string; actions?: React.ReactNode
}) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50/60 text-slate-800 shadow-sm p-5 md:p-6">
      {/* лек декор */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 w-72 h-72 rounded-full bg-sky-100/40" />
      <div aria-hidden className="pointer-events-none absolute right-24 -bottom-24 w-56 h-56 rounded-full bg-indigo-100/30" />
      <div className="relative flex flex-wrap items-center gap-5">
        {photo
          ? <img src={photo} alt="" className="w-20 h-20 rounded-3xl object-cover ring-4 ring-white shadow-sm shrink-0" />
          : <div className="w-20 h-20 rounded-3xl bg-sky-100 text-[#1a3660] ring-4 ring-white flex items-center justify-center text-2xl font-semibold tracking-wide shrink-0">{initials}</div>}
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] uppercase tracking-[0.12em] text-slate-400">{kicker}</div>
          <h1 className="text-2xl md:text-[26px] font-semibold leading-tight text-[#0f2240]">{name}</h1>
          <div className="text-sm text-slate-600 mt-0.5">{subtitle}</div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {badges.map(b => (
              <span key={b.label} className={`text-[12px] px-2.5 py-1 rounded-full ${b.tone === 'accent' ? 'bg-amber-100 text-amber-900 border border-amber-200 font-medium' : 'bg-white border border-slate-200 text-slate-600'}`}>{b.label}</span>
            ))}
          </div>
          {(email || phone) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12.5px] text-slate-500">
              {email && <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 hover:text-[#0f2240] hover:underline"><Mail size={13} />{email}</a>}
              {phone && <a href={`tel:${String(phone).replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 hover:text-[#0f2240] hover:underline"><Phone size={13} />{phone}</a>}
            </div>
          )}
          {actions && <div className="flex flex-wrap gap-2 mt-4">{actions}</div>}
        </div>
        {aside && <div className="w-full md:w-auto">{aside}</div>}
      </div>
    </header>
  )
}

export function Card({ title, icon, action, children, className = '', pad = true }: {
  title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean
}) {
  return (
    <section className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
        {icon && <span className="text-slate-400">{icon}</span>}
        <h2 className="text-[14px] font-semibold text-slate-800 flex-1">{title}</h2>
        {action}
      </div>
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint, tone = 'slate', progress, href }: {
  label: string; value: React.ReactNode; hint?: string; tone?: 'slate' | 'green' | 'amber' | 'rose'; progress?: number; href?: string
}) {
  const bar = { slate: 'bg-[#2b5a8f]', green: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' }[tone]
  const body = (
    <>
      <div className="text-[12px] text-slate-500">{label}</div>
      <div className="text-[22px] font-semibold text-slate-800 tabular-nums leading-tight mt-1">{value}</div>
      {progress != null && (
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(3, Math.min(100, progress))}%` }} />
        </div>
      )}
      {hint && <div className="text-[11.5px] text-slate-400 mt-1.5">{hint}</div>}
    </>
  )
  const cls = 'block bg-white rounded-2xl border border-slate-200 shadow-sm p-4'
  return href ? <Link href={href} className={`${cls} hover:border-slate-300 hover:shadow`}>{body}</Link> : <div className={cls}>{body}</div>
}

export function Row({ l, v }: { l: string; v: React.ReactNode }) {
  const empty = v == null || v === '' || (Array.isArray(v) && !v.length)
  return (
    <div className="py-2 grid grid-cols-[minmax(110px,40%)_1fr] gap-3 border-b border-slate-50 last:border-0">
      <dt className="text-[12.5px] text-slate-400">{l}</dt>
      <dd className={`text-[13.5px] ${empty ? 'text-slate-300' : 'text-slate-800'}`}>{empty ? '—' : v}</dd>
    </div>
  )
}

export function StudentList({ title, icon, students, meta, empty }: {
  title: string; icon: React.ReactNode; students: { s: StaffStudent; meta?: string }[]; meta?: string; empty?: string
}) {
  return (
    <Card title={title} icon={icon} pad={false} action={<span className="text-[12px] text-slate-400">{meta ?? `${students.length} ученика`}</span>}>
      {students.length === 0
        ? <p className="px-5 py-6 text-sm text-slate-400">{empty || 'Няма ученици'}</p>
        : (
          <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 divide-slate-50">
            {students.map(({ s, meta: m }) => (
              <Link key={s.id + (m || '')} href={`/students/${s.id}`} className="group flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 border-b border-slate-50">
                <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-[11px] font-medium flex items-center justify-center shrink-0">
                  {s.first_name?.charAt(0)}{s.last_name?.charAt(0)}
                </span>
                <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{getFullName(s)}</span>
                {m && <span className="text-[11.5px] text-slate-400">{m}</span>}
                <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500" />
              </Link>
            ))}
          </div>
        )}
    </Card>
  )
}

export function Tile({ href, label, hint, icon, tone }: { href: string; label: string; hint?: string; icon: React.ReactNode; tone: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 hover:border-slate-300 hover:shadow-sm transition">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-slate-800 truncate">{label}</span>
        {hint && <span className="block text-[11.5px] text-slate-400 truncate">{hint}</span>}
      </span>
      <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition" />
    </Link>
  )
}
