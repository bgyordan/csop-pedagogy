import { createClient } from '@/lib/supabase/server'

// „На линия сега“ — кой е бил активен в JORDAN през последните 10 минути (само за управата)
export default async function OnlineNow() {
  const supabase = await createClient()
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data, error } = await supabase.from('staff_profiles')
    .select('id, first_name, last_name, last_seen_at').gte('last_seen_at', since).order('last_seen_at', { ascending: false })
  if (error) return null   // колоната още не е добавена
  const people = data || []
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6 px-5 py-3 rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <span className="inline-flex items-center gap-2 text-sm text-slate-700 mr-1">
        <span className="relative flex w-2.5 h-2.5">
          <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500" />
        </span>
        На линия сега <span className="text-slate-400">({people.length})</span>
      </span>
      {people.length === 0
        ? <span className="text-xs text-slate-400 font-light">никой друг в последните 10 минути</span>
        : people.map(p => (
          <span key={p.id} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs">{p.first_name} {p.last_name}</span>
        ))}
    </div>
  )
}
