import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Inbox, ClipboardList, FileSignature, AlertTriangle, ArrowRight } from 'lucide-react'

export default async function SecretaryDashboard({ profile }: any) {
  const supabase = await createClient()
  const now = new Date()
  const currentYear = now.getFullYear()
  const today = now.toISOString().split('T')[0]
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    { data: lastCorr },
    { count: corrCount },
    { data: lastOrder },
    { count: orderCount },
    { data: lastContract },
    { count: contractCount },
    { data: expiringContracts },
    { data: enrollments },
    { data: couds },
  ] = await Promise.all([
    supabase.from('correspondence').select('number, date, subject, direction').order('created_at', { ascending: false }).limit(1),
    supabase.from('correspondence').select('*', { count: 'exact', head: true }).gte('date', `${currentYear}-01-01`),
    supabase.from('orders').select('number, date, title').order('created_at', { ascending: false }).limit(1),
    supabase.from('orders').select('*', { count: 'exact', head: true }).gte('date', `${currentYear}-01-01`),
    supabase.from('contracts').select('number, date, subject, counterparty').order('created_at', { ascending: false }).limit(1),
    supabase.from('contracts').select('*', { count: 'exact', head: true }),
    supabase.from('contracts').select('number, subject, counterparty, end_date').gte('end_date', today).lte('end_date', in30days).order('end_date'),
    supabase.from('correspondence').select('subject, student_id, date, students(first_name, last_name)').like('number', 'УВД-09-%').order('created_at', { ascending: false }),
    supabase.from('correspondence').select('subject, student_id, date, students(first_name, last_name)').like('number', 'УВД-12-%').order('created_at', { ascending: false }),
  ])

  const dirLabel: Record<string, string> = { incoming: 'Входящ', outgoing: 'Изходящ', internal: 'Вътрешен' }

  return (
    <div className="animate-in fade-in duration-500 space-y-4">

      {/* Статистика — три широки карти */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { href: '/correspondence', count: corrCount, label: 'Кореспонденция', sub: `${currentYear}`, last: lastCorr?.[0]?.number },
          { href: '/orders', count: orderCount, label: 'Заповеди', sub: `${currentYear}`, last: lastOrder?.[0]?.number },
          { href: '/contracts', count: contractCount, label: 'Договори', sub: 'общо', last: lastContract?.[0]?.number },
        ].map(({ href, count, label, sub, last }) => (
          <Link key={href} href={href}
            className="bg-white px-6 py-5 rounded-2xl border border-slate-200 shadow-[0_1px_6px_rgba(15,34,64,0.08)] hover:border-slate-400 hover:shadow-[0_2px_10px_rgba(15,34,64,0.12)] transition-all">
            <div className="text-4xl font-light text-slate-800 mb-2">{count || 0}</div>
            <div className="text-sm font-medium text-slate-700">{label}</div>
            <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
            {last && <div className="text-[10px] text-slate-400 mt-2 truncate">последен: {last}</div>}
          </Link>
        ))}
      </div>

      {/* Последни записи */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Последен документ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Последен документ</span>
            <Link href="/correspondence" className="text-[10px] text-slate-500 flex items-center gap-0.5 hover:text-slate-800">
              Всички <ArrowRight size={10} />
            </Link>
          </div>
          {lastCorr?.[0] ? (
            <div>
              <div className="font-medium text-slate-800 text-base">{lastCorr[0].number}</div>
              <div className="text-sm text-slate-600 mt-1 truncate">{lastCorr[0].subject}</div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-slate-400">
                  {lastCorr[0].date ? new Date(lastCorr[0].date).toLocaleDateString('bg-BG') : ''}
                </span>
                <span className="text-xs text-slate-500 border border-slate-200 px-2 py-0.5 rounded-lg bg-slate-50">
                  {dirLabel[lastCorr[0].direction] || ''}
                </span>
              </div>
            </div>
          ) : <p className="text-sm text-slate-400">Няма записи</p>}
        </div>

        {/* Последна заповед */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Последна заповед</span>
            <Link href="/orders" className="text-[10px] text-slate-500 flex items-center gap-0.5 hover:text-slate-800">
              Всички <ArrowRight size={10} />
            </Link>
          </div>
          {lastOrder?.[0] ? (
            <div>
              <div className="font-medium text-slate-800 text-base">{lastOrder[0].number}</div>
              <div className="text-sm text-slate-600 mt-1 truncate">{lastOrder[0].title}</div>
              <div className="text-xs text-slate-400 mt-3">
                {lastOrder[0].date ? new Date(lastOrder[0].date).toLocaleDateString('bg-BG') : ''}
              </div>
            </div>
          ) : <p className="text-sm text-slate-400">Няма записи</p>}
        </div>

        {/* Последен договор */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Последен договор</span>
            <Link href="/contracts" className="text-[10px] text-slate-500 flex items-center gap-0.5 hover:text-slate-800">
              Всички <ArrowRight size={10} />
            </Link>
          </div>
          {lastContract?.[0] ? (
            <div>
              <div className="font-medium text-slate-800 text-base">{lastContract[0].number}</div>
              <div className="text-sm text-slate-600 mt-1 truncate">{lastContract[0].subject}</div>
              <div className="text-xs text-slate-400 mt-1 truncate">{lastContract[0].counterparty}</div>
            </div>
          ) : <p className="text-sm text-slate-400">Няма записи</p>}
        </div>
      </div>

      {/* Изтичащи договори */}
      {expiringContracts && expiringContracts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <AlertTriangle size={14} className="text-slate-500" />
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Изтичащи договори в следващите 30 дни</span>
          </div>
          <div className="space-y-2">
            {expiringContracts.map((c, idx) => {
              const days = Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              return (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 text-sm">{c.number}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">{c.counterparty} — {c.subject}</div>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-xl flex-shrink-0 ml-3 border border-slate-200 text-slate-600 bg-white">
                    {days === 0 ? 'Днес' : days === 1 ? 'Утре' : `${days} дни`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Заявления */}
      <Link href="/reports/enrollments"
        className="block bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_1px_6px_rgba(15,34,64,0.08)] hover:border-slate-400 transition-all">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Справка — Заявления {currentYear}г.</span>
          <ArrowRight size={14} className="text-slate-400" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-3xl font-light text-slate-800">{enrollments?.length || 0}</div>
            <div className="text-xs text-slate-500 mt-1">За записване</div>
          </div>
          <div>
            <div className="text-3xl font-light text-slate-800">{couds?.length || 0}</div>
            <div className="text-xs text-slate-500 mt-1">За ЦОУД</div>
          </div>
        </div>
      </Link>

    </div>
  )
}
