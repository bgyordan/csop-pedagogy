import { createClient } from '@/lib/supabase/server'
import { countWaiting } from '@/lib/today-absences'
import Link from 'next/link'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, ClipboardList, FileSignature, Plus, Paperclip, CalendarClock, UserPlus, ArrowRight } from 'lucide-react'
import ReserveNumberCard from './ReserveNumberCard'
import SharedFiles from './SharedFiles'

// Таблото на деловодството (Ванина): бързи бутони · регистрите с „без файл“ · споделено от колеги · срокове
export default async function SecretaryDashboard({ profile }: any) {
  const supabase = await createClient()
  const now = new Date()
  const currentYear = now.getFullYear()
  const today = now.toISOString().split('T')[0]
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  // Деловодна година (15.09–14.09)
  const _m = now.getMonth() + 1, _d = now.getDate()
  const deloStartYear = (_m > 9 || (_m === 9 && _d >= 15)) ? currentYear : currentYear - 1
  const deloStart = `${deloStartYear}-09-15`, deloEnd = `${deloStartYear + 1}-09-14`
  const deloLabel = `${deloStartYear}/${String(deloStartYear + 1).slice(2)}`

  const corr = (dir: string) => supabase.from('correspondence').select('*', { count: 'exact', head: true }).eq('direction', dir).gte('date', deloStart).lte('date', deloEnd)
  const ord = () => supabase.from('orders').select('*', { count: 'exact', head: true }).gte('date', deloStart).lte('date', deloEnd)

  const [
    { data: lastIncoming },
    { count: incomingCount },
    { count: incomingNoFile },
    { data: lastOutgoing },
    { count: outgoingCount },
    { count: outgoingNoFile },
    { data: lastOrder },
    { count: orderCount },
    { count: orderNoFile },
    { data: lastContract },
    { count: contractCount },
    { count: contractNoFile },
    { data: expiringContracts },
    { data: enrollments },
    { data: couds },
    subsWaiting,
    { count: subsTotal },
  ] = await Promise.all([
    supabase.from('correspondence').select('number, date, subject').eq('direction', 'incoming').order('created_at', { ascending: false }).limit(1),
    corr('incoming'),
    corr('incoming').is('file_url', null).not('is_reserved', 'is', true),
    supabase.from('correspondence').select('number, date, subject').eq('direction', 'outgoing').order('created_at', { ascending: false }).limit(1),
    corr('outgoing'),
    corr('outgoing').is('file_url', null).not('is_reserved', 'is', true),
    supabase.from('orders').select('number, date, title').order('created_at', { ascending: false }).limit(1),
    ord(),
    ord().is('file_url', null).not('is_reserved', 'is', true),
    supabase.from('contracts').select('number, date, subject, counterparty').order('created_at', { ascending: false }).limit(1),
    supabase.from('contracts').select('*', { count: 'exact', head: true }),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).is('file_url', null),
    supabase.from('contracts').select('number, subject, counterparty, end_date').gte('end_date', today).lte('end_date', in30days).order('end_date'),
    supabase.from('student_attachments').select('student_id').eq('doc_type', 'enrollment_application'),
    supabase.from('student_attachments').select('student_id').eq('doc_type', 'coud_application'),
    countWaiting(supabase),
    supabase.from('substitutions').select('*', { count: 'exact', head: true }),
  ])

  const registers = [
    { label: 'Входящи', icon: ArrowDownLeft, count: incomingCount, year: deloLabel, last: lastIncoming?.[0]?.number, sub: lastIncoming?.[0]?.subject,
      href: '/correspondence?direction=incoming', noFile: incomingNoFile, noFileHref: '/correspondence?direction=incoming&f=nofile' },
    { label: 'Изходящи', icon: ArrowUpRight, count: outgoingCount, year: deloLabel, last: lastOutgoing?.[0]?.number, sub: lastOutgoing?.[0]?.subject,
      href: '/correspondence?direction=outgoing', noFile: outgoingNoFile, noFileHref: '/correspondence?direction=outgoing&f=nofile' },
    { label: 'Заповеди', icon: ClipboardList, count: orderCount, year: deloLabel, last: lastOrder?.[0]?.number, sub: lastOrder?.[0]?.title,
      href: '/orders', noFile: orderNoFile, noFileHref: '/orders?f=nofile' },
    { label: 'Договори', icon: FileSignature, count: contractCount, year: 'общо', last: lastContract?.[0]?.number, sub: lastContract?.[0]?.counterparty,
      href: '/contracts', noFile: contractNoFile, noFileHref: '/contracts' },
  ]

  const quick = [
    { label: 'Нов входящ', href: '/correspondence?direction=incoming&new=1', icon: ArrowDownLeft },
    { label: 'Нов изходящ', href: '/correspondence?direction=outgoing&new=1', icon: ArrowUpRight },
    { label: 'Нова заповед', href: '/orders?new=1', icon: ClipboardList },
  ]

  const enrollN = new Set((enrollments || []).map((e: any) => e.student_id)).size
  const coudN = new Set((couds || []).map((c: any) => c.student_id)).size

  return (
    <div className="animate-in fade-in duration-500 space-y-5">

      {/* Бързи бутони — най-честите действия с един клик */}
      <div className="flex items-center gap-2 flex-wrap">
        {quick.map(q => (
          <Link key={q.href} href={q.href}
            className="inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border-2 border-[#0f2240] text-[#0f2240] bg-white hover:bg-[#0f2240] hover:text-white transition-colors">
            <Plus size={15} /> {q.label}
          </Link>
        ))}
        <span className="text-xs text-slate-500 ml-1">деловодна година {deloLabel}</span>
      </div>

      {/* Регистрите: брой · последен номер · колко са без файл */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {registers.map(r => (
          <div key={r.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition flex flex-col">
            <Link href={r.href} className="block px-5 pt-4 pb-3 flex-1">
              <div className="flex justify-between items-center">
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-600"><r.icon size={14} /> {r.label}</span>
                <span className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">{r.year}</span>
              </div>
              <div className="text-4xl font-light text-[#0f2240] tracking-tight mt-2 tabular-nums">{r.count || 0}</div>
              <div className="text-xs text-slate-500 mt-2 truncate">
                {r.last ? <><span className="text-slate-700 tabular-nums">{r.last}</span>{r.sub ? ` · ${r.sub}` : ''}</> : 'Няма записи'}
              </div>
            </Link>
            <div className="px-5 py-2.5 border-t border-slate-100">
              {(r.noFile || 0) > 0 ? (
                <Link href={r.noFileHref} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors">
                  <Paperclip size={12} /> {r.noFile} без файл
                </Link>
              ) : (
                <span className="text-xs text-emerald-700">✓ всички с файл</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Споделено от колеги (голяма карта) · вдясно: замествания, заявления, резерв, изтичащи договори */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <SharedFiles limit={8} />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Link href="/substitutions"
              className="block bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-4 hover:shadow-md hover:-translate-y-0.5 transition">
              <div className="flex items-center gap-1.5 text-sm text-slate-600"><CalendarClock size={14} /> Замествания</div>
              <div className={`text-3xl font-light tracking-tight mt-2 tabular-nums ${subsWaiting ? 'text-amber-700' : 'text-[#0f2240]'}`}>{subsWaiting || 0}</div>
              <div className="text-xs text-slate-500 mt-1">{subsWaiting ? 'чакат заместник' : 'няма чакащи'} · общо {subsTotal || 0}</div>
            </Link>
            <Link href="/reports/enrollments"
              className="block bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-4 hover:shadow-md hover:-translate-y-0.5 transition">
              <div className="flex items-center gap-1.5 text-sm text-slate-600"><UserPlus size={14} /> Заявления</div>
              <div className="text-3xl font-light text-[#0f2240] tracking-tight mt-2 tabular-nums">{enrollN}</div>
              <div className="text-xs text-slate-500 mt-1">за прием · {coudN} за ЦОУД</div>
            </Link>
          </div>

          <ReserveNumberCard profileId={profile.id} />

          {expiringContracts && expiringContracts.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                <AlertTriangle size={14} className="text-amber-600" />
                <span className="text-[11px] font-semibold text-[#0f2240] uppercase tracking-widest flex-1">Изтичащи договори</span>
                <Link href="/contracts" className="text-xs text-slate-500 hover:text-[#0f2240] inline-flex items-center gap-1">Всички <ArrowRight size={13} /></Link>
              </div>
              <div className="p-2">
                {expiringContracts.map((c, idx) => {
                  const days = Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <div key={idx} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-slate-50">
                      <div className="min-w-0">
                        <div className="text-sm text-slate-900 truncate">{c.counterparty}</div>
                        <div className="text-xs text-slate-500 truncate tabular-nums">{c.number}</div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                        {days === 0 ? 'днес' : days === 1 ? 'утре' : `${days} дни`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
