import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Inbox, ClipboardList, FileSignature, AlertTriangle, ArrowRight, Plus } from 'lucide-react'

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
  ] = await Promise.all([
    supabase.from('correspondence').select('number, date, subject, direction').order('created_at', { ascending: false }).limit(1),
    supabase.from('correspondence').select('*', { count: 'exact', head: true }).gte('date', `${currentYear}-01-01`),
    supabase.from('orders').select('number, date, title').order('created_at', { ascending: false }).limit(1),
    supabase.from('orders').select('*', { count: 'exact', head: true }).gte('date', `${currentYear}-01-01`),
    supabase.from('contracts').select('number, date, subject, counterparty').order('created_at', { ascending: false }).limit(1),
    supabase.from('contracts').select('*', { count: 'exact', head: true }),
    supabase.from('contracts').select('number, subject, counterparty, end_date').gte('end_date', today).lte('end_date', in30days).order('end_date'),
  ])

  const dirLabel: Record<string, string> = { incoming: 'Вх.', outgoing: 'Изх.', internal: 'Вътр.' }

  return (
    <div className="animate-in fade-in duration-500 space-y-6">

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-4">
        <Link href="/correspondence" className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-all group">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Inbox size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{corrCount || 0}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Кореспонденция {currentYear}</div>
        </Link>

        <Link href="/orders" className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-all group">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <ClipboardList size={18} className="text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{orderCount || 0}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Заповеди {currentYear}</div>
        </Link>

        <Link href="/contracts" className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-all group">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <FileSignature size={18} className="text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{contractCount || 0}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Договори общо</div>
        </Link>
      </div>

      {/* Последни записи */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Последна кореспонденция */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Inbox size={15} className="text-blue-500" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Последен документ</span>
            </div>
            <Link href="/correspondence" className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5 hover:underline">
              Всички <ArrowRight size={11} />
            </Link>
          </div>
          {lastCorr?.[0] ? (
            <div>
              <div className="font-mono font-bold text-[#0f2240] text-sm">{lastCorr[0].number}</div>
              <div className="text-xs text-slate-500 mt-1 truncate">{lastCorr[0].subject}</div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-slate-400">{lastCorr[0].date ? new Date(lastCorr[0].date).toLocaleDateString('bg-BG') : ''}</span>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                  {dirLabel[lastCorr[0].direction] || ''}
                </span>
              </div>
            </div>
          ) : <p className="text-xs text-slate-400">Няма записи</p>}
        </div>

        {/* Последна заповед */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ClipboardList size={15} className="text-orange-500" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Последна заповед</span>
            </div>
            <Link href="/orders" className="text-[10px] font-bold text-orange-600 flex items-center gap-0.5 hover:underline">
              Всички <ArrowRight size={11} />
            </Link>
          </div>
          {lastOrder?.[0] ? (
            <div>
              <div className="font-mono font-bold text-orange-700 text-sm">{lastOrder[0].number}</div>
              <div className="text-xs text-slate-500 mt-1 truncate">{lastOrder[0].title}</div>
              <div className="text-[10px] text-slate-400 mt-3">
                {lastOrder[0].date ? new Date(lastOrder[0].date).toLocaleDateString('bg-BG') : ''}
              </div>
            </div>
          ) : <p className="text-xs text-slate-400">Няма записи</p>}
        </div>

        {/* Последен договор */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileSignature size={15} className="text-purple-500" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Последен договор</span>
            </div>
            <Link href="/contracts" className="text-[10px] font-bold text-purple-600 flex items-center gap-0.5 hover:underline">
              Всички <ArrowRight size={11} />
            </Link>
          </div>
          {lastContract?.[0] ? (
            <div>
              <div className="font-mono font-bold text-purple-700 text-sm">{lastContract[0].number}</div>
              <div className="text-xs text-slate-500 mt-1 truncate">{lastContract[0].subject}</div>
              <div className="text-[10px] text-slate-400 mt-1 truncate">{lastContract[0].counterparty}</div>
            </div>
          ) : <p className="text-xs text-slate-400">Няма записи</p>}
        </div>
      </div>

      {/* Изтичащи договори */}
      {expiringContracts && expiringContracts.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-amber-100">
            <AlertTriangle size={15} className="text-amber-500" />
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Изтичащи договори в следващите 30 дни</span>
          </div>
          <div className="space-y-2">
            {expiringContracts.map((c, idx) => {
              const days = Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              return (
                <div key={idx} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-[#0f2240] text-xs">{c.number}</div>
                    <div className="text-xs text-slate-600 truncate mt-0.5">{c.counterparty} — {c.subject}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ml-3 ${
                    days <= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {days === 0 ? 'Днес!' : `${days} дни`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Бързи действия */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/correspondence" className="flex items-center justify-center gap-2 p-3 bg-[#0f2240] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity shadow-md">
          <Plus size={14} /> Нова кореспонденция
        </Link>
        <Link href="/orders" className="flex items-center justify-center gap-2 p-3 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors">
          <Plus size={14} /> Нова заповед
        </Link>
        <Link href="/contracts" className="flex items-center justify-center gap-2 p-3 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors">
          <Plus size={14} /> Нов договор
        </Link>
      </div>

    </div>
  )
}
