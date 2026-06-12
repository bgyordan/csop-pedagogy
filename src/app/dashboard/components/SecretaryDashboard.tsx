import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight, AlertTriangle, ArrowDownLeft, ArrowUpRight } from 'lucide-react'

export default async function SecretaryDashboard({ profile }: any) {
  const supabase = await createClient()
  const now = new Date()
  const currentYear = now.getFullYear()
  const today = now.toISOString().split('T')[0]
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    { data: lastIncoming },
    { count: incomingCount },
    { data: lastOutgoing },
    { count: outgoingCount },
    { data: lastOrder },
    { count: orderCount },
    { data: lastContract },
    { count: contractCount },
    { data: expiringContracts },
    { data: enrollments },
    { data: couds },
  ] = await Promise.all([
    supabase.from('correspondence').select('number, date, subject').eq('direction', 'incoming').order('created_at', { ascending: false }).limit(1),
    supabase.from('correspondence').select('*', { count: 'exact', head: true }).eq('direction', 'incoming').gte('date', `${currentYear}-01-01`),
    supabase.from('correspondence').select('number, date, subject').eq('direction', 'outgoing').order('created_at', { ascending: false }).limit(1),
    supabase.from('correspondence').select('*', { count: 'exact', head: true }).eq('direction', 'outgoing').gte('date', `${currentYear}-01-01`),
    supabase.from('orders').select('number, date, title').order('created_at', { ascending: false }).limit(1),
    supabase.from('orders').select('*', { count: 'exact', head: true }).gte('date', `${currentYear}-01-01`),
    supabase.from('contracts').select('number, date, subject, counterparty').order('created_at', { ascending: false }).limit(1),
    supabase.from('contracts').select('*', { count: 'exact', head: true }),
    supabase.from('contracts').select('number, subject, counterparty, end_date').gte('end_date', today).lte('end_date', in30days).order('end_date'),
    supabase.from('correspondence').select('subject, student_id, date').eq('nomenclature_item', 'УВД-09').order('created_at', { ascending: false }),
    supabase.from('correspondence').select('subject, student_id, date').eq('nomenclature_item', 'УВД-12').order('created_at', { ascending: false }),
  ])

  return (
    <div className="animate-in fade-in duration-500 space-y-4 max-w-7xl">

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/correspondence?direction=incoming"
          className="block bg-white px-5 py-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50/50 transition-colors">
          <div className="flex justify-between items-baseline mb-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <ArrowDownLeft size={13} /> Входящи
            </div>
            <div className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{currentYear}</div>
          </div>
          <div className="text-3xl font-medium text-slate-800 tracking-tight my-2">{incomingCount || 0}</div>
          <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 mt-2 truncate">
            {lastIncoming?.[0] ? `Последен: ${lastIncoming[0].number}` : 'Няма записи'}
          </div>
        </Link>

        <Link href="/correspondence?direction=outgoing"
          className="block bg-white px-5 py-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50/50 transition-colors">
          <div className="flex justify-between items-baseline mb-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <ArrowUpRight size={13} /> Изходящи
            </div>
            <div className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{currentYear}</div>
          </div>
          <div className="text-3xl font-medium text-slate-800 tracking-tight my-2">{outgoingCount || 0}</div>
          <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 mt-2 truncate">
            {lastOutgoing?.[0] ? `Последен: ${lastOutgoing[0].number}` : 'Няма записи'}
          </div>
        </Link>

        <Link href="/orders"
          className="block bg-white px-5 py-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50/50 transition-colors">
          <div className="flex justify-between items-baseline mb-1">
            <div className="text-xs font-medium text-slate-500">Заповеди</div>
            <div className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{currentYear}</div>
          </div>
          <div className="text-3xl font-medium text-slate-800 tracking-tight my-2">{orderCount || 0}</div>
          <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 mt-2 truncate">
            {lastOrder?.[0] ? `Последна: ${lastOrder[0].number}` : 'Няма записи'}
          </div>
        </Link>

        <Link href="/contracts"
          className="block bg-white px-5 py-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50/50 transition-colors">
          <div className="flex justify-between items-baseline mb-1">
            <div className="text-xs font-medium text-slate-500">Договори</div>
            <div className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">общо</div>
          </div>
          <div className="text-3xl font-medium text-slate-800 tracking-tight my-2">{contractCount || 0}</div>
          <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 mt-2 truncate">
            {lastContract?.[0] ? `Последен: ${lastContract[0].number}` : 'Няма записи'}
          </div>
        </Link>
      </div>

      {/* Последни записи */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

        <div className="bg-white flex flex-col rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <ArrowDownLeft size={12} /> Последен входящ
            </span>
            <Link href="/correspondence?direction=incoming" className="text-[10px] text-slate-400 flex items-center gap-1 hover:text-slate-700">
              <ArrowRight size={10} />
            </Link>
          </div>
          {lastIncoming?.[0] ? (
            <div className="flex-1 flex flex-col">
              <div className="font-medium text-slate-800 text-sm mb-1.5">{lastIncoming[0].number}</div>
              <div className="text-xs text-slate-600 line-clamp-2">{lastIncoming[0].subject}</div>
              <div className="mt-auto pt-3 text-[11px] text-slate-400">
                {lastIncoming[0].date ? new Date(lastIncoming[0].date).toLocaleDateString('bg-BG') : ''}
              </div>
            </div>
          ) : <p className="text-xs text-slate-400 m-auto">Няма данни</p>}
        </div>

        <div className="bg-white flex flex-col rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpRight size={12} /> Последен изходящ
            </span>
            <Link href="/correspondence?direction=outgoing" className="text-[10px] text-slate-400 flex items-center gap-1 hover:text-slate-700">
              <ArrowRight size={10} />
            </Link>
          </div>
          {lastOutgoing?.[0] ? (
            <div className="flex-1 flex flex-col">
              <div className="font-medium text-slate-800 text-sm mb-1.5">{lastOutgoing[0].number}</div>
              <div className="text-xs text-slate-600 line-clamp-2">{lastOutgoing[0].subject}</div>
              <div className="mt-auto pt-3 text-[11px] text-slate-400">
                {lastOutgoing[0].date ? new Date(lastOutgoing[0].date).toLocaleDateString('bg-BG') : ''}
              </div>
            </div>
          ) : <p className="text-xs text-slate-400 m-auto">Няма данни</p>}
        </div>

        <div className="bg-white flex flex-col rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Последна заповед</span>
            <Link href="/orders" className="text-[10px] text-slate-400 flex items-center gap-1 hover:text-slate-700">
              <ArrowRight size={10} />
            </Link>
          </div>
          {lastOrder?.[0] ? (
            <div className="flex-1 flex flex-col">
              <div className="font-medium text-slate-800 text-sm mb-1.5">{lastOrder[0].number}</div>
              <div className="text-xs text-slate-600 line-clamp-2">{lastOrder[0].title}</div>
              <div className="mt-auto pt-3 text-[11px] text-slate-400">
                {lastOrder[0].date ? new Date(lastOrder[0].date).toLocaleDateString('bg-BG') : ''}
              </div>
            </div>
          ) : <p className="text-xs text-slate-400 m-auto">Няма данни</p>}
        </div>

        <div className="bg-white flex flex-col rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Последен договор</span>
            <Link href="/contracts" className="text-[10px] text-slate-400 flex items-center gap-1 hover:text-slate-700">
              <ArrowRight size={10} />
            </Link>
          </div>
          {lastContract?.[0] ? (
            <div className="flex-1 flex flex-col">
              <div className="font-medium text-slate-800 text-sm mb-1.5">{lastContract[0].number}</div>
              <div className="text-xs text-slate-600 line-clamp-2">{lastContract[0].subject}</div>
              <div className="mt-auto pt-3 text-[11px] text-slate-400 truncate">{lastContract[0].counterparty}</div>
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
                  <div key={idx} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors">
                    <div className="min-w-0 pr-3">
                      <div className="text-xs font-medium text-slate-700">{c.number}</div>
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

        {/* Заявления */}
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
