import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight, AlertTriangle } from 'lucide-react'

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

  const dirLabel: Record<string, string> = { incoming: 'Вх.', outgoing: 'Изх.', internal: 'Вътр.' }

  return (
    <div className="animate-in fade-in duration-500 space-y-4 max-w-7xl">

      {/* Статистика — три компактни карти */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { href: '/correspondence', count: corrCount, label: 'Кореспонденция', sub: `${currentYear} г.`, last: lastCorr?.[0]?.number },
          { href: '/orders', count: orderCount, label: 'Заповеди', sub: `${currentYear} г.`, last: lastOrder?.[0]?.number },
          { href: '/contracts', count: contractCount, label: 'Договори', sub: 'общо', last: lastContract?.[0]?.number },
        ].map(({ href, count, label, sub, last }) => (
          <Link key={href} href={href}
            className="block bg-white px-5 py-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50/50 transition-colors"
          >
            <div className="flex justify-between items-baseline mb-1">
              <div className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{label}</div>
              <div className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{sub}</div>
            </div>
            <div className="text-3xl font-medium text-slate-800 tracking-tight my-2">{count || 0}</div>
            <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 mt-2">
              {last ? `Последен запис: ${last}` : 'Няма записи'}
            </div>
          </Link>
        ))}
      </div>

      {/* Последни записи */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Последен документ */}
        <div className="bg-white flex flex-col rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Документ</span>
            <Link href="/correspondence" className="text-[10px] font-medium text-slate-400 flex items-center gap-1 hover:text-slate-700 transition-colors">
              Към регистъра <ArrowRight size={10} />
            </Link>
          </div>
          {lastCorr?.[0] ? (
            <div className="flex-1 flex flex-col">
              <div className="font-mono font-medium text-slate-800 text-sm mb-1.5">{lastCorr[0].number}</div>
              <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{lastCorr[0].subject}</div>
              <div className="flex items-center justify-between mt-auto pt-3">
                <span className="text-[11px] text-slate-500">
                  {lastCorr[0].date ? new Date(lastCorr[0].date).toLocaleDateString('bg-BG') : ''}
                </span>
                <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {dirLabel[lastCorr[0].direction] || ''}
                </span>
              </div>
            </div>
          ) : <p className="text-xs text-slate-400 m-auto">Няма данни</p>}
        </div>

        {/* Последна заповед */}
        <div className="bg-white flex flex-col rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Заповед</span>
            <Link href="/orders" className="text-[10px] font-medium text-slate-400 flex items-center gap-1 hover:text-slate-700 transition-colors">
              Към регистъра <ArrowRight size={10} />
            </Link>
          </div>
          {lastOrder?.[0] ? (
            <div className="flex-1 flex flex-col">
              <div className="font-mono font-medium text-slate-800 text-sm mb-1.5">{lastOrder[0].number}</div>
              <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{lastOrder[0].title}</div>
              <div className="mt-auto pt-3 text-[11px] text-slate-500">
                {lastOrder[0].date ? new Date(lastOrder[0].date).toLocaleDateString('bg-BG') : ''}
              </div>
            </div>
          ) : <p className="text-xs text-slate-400 m-auto">Няма данни</p>}
        </div>

        {/* Последен договор */}
        <div className="bg-white flex flex-col rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Договор</span>
            <Link href="/contracts" className="text-[10px] font-medium text-slate-400 flex items-center gap-1 hover:text-slate-700 transition-colors">
              Към регистъра <ArrowRight size={10} />
            </Link>
          </div>
          {lastContract?.[0] ? (
            <div className="flex-1 flex flex-col">
              <div className="font-mono font-medium text-slate-800 text-sm mb-1.5">{lastContract[0].number}</div>
              <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{lastContract[0].subject}</div>
              <div className="mt-auto pt-3 text-[11px] font-medium text-slate-500 truncate">
                {lastContract[0].counterparty}
              </div>
            </div>
          ) : <p className="text-xs text-slate-400 m-auto">Няма данни</p>}
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Изтичащи договори */}
        {expiringContracts && expiringContracts.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
              <AlertTriangle size={14} className="text-slate-500" />
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Изтичащи договори (30 дни)</span>
            </div>
            <div className="p-2 flex-1">
              {expiringContracts.map((c, idx) => {
                const days = Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors border-b border-transparent hover:border-slate-100">
                    <div className="min-w-0 pr-3">
                      <div className="font-mono text-xs font-medium text-slate-700">{c.number}</div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">{c.counterparty}</div>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                      {days === 0 ? 'Днес' : days === 1 ? 'Утре' : `${days} дни`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Заявления (Компактен вид) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Заявления за прием ({currentYear})</span>
            <Link href="/reports/enrollments" className="text-[10px] font-medium text-slate-400 flex items-center gap-1 hover:text-slate-700 transition-colors">
              Справка <ArrowRight size={10} />
            </Link>
          </div>
          <div className="p-5 flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-2 gap-4 divide-x divide-slate-100">
              <div className="pr-4">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">За записване</div>
                <div className="text-3xl font-medium text-slate-800 tracking-tight">{enrollments?.length || 0}</div>
              </div>
              <div className="pl-4">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">За ЦОУД</div>
                <div className="text-3xl font-medium text-slate-800 tracking-tight">{couds?.length || 0}</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
