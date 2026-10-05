import Link from 'next/link'
import { Wrench, ArrowRight, AlertTriangle, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isFacilityHandler, catMeta } from '@/app/facilities/lib'

// Материална база на таблото:
//  • управата / деловодството — колко нови и спешни сигнала чакат;
//  • колегата — отговорите по неговите сигнали, които още не е видял („Поправено: брава — Кабинет 12“).
// Ако няма нищо (или таблицата още я няма) — нищо.
export default async function FacilitiesStrip({ profile }: { profile: { id: string; role: string; position?: string | null } }) {
  const supabase = await createClient()
  if (isFacilityHandler(profile)) {
    const { data, error } = await supabase.from('facility_issues').select('status, urgent').in('status', ['new', 'accepted'])
    if (error || !data?.length) return null
    const fresh = data.filter((i: any) => i.status === 'new').length
    const urgent = data.filter((i: any) => i.urgent).length
    return (
      <Link href="/facilities" className={`flex flex-wrap items-center gap-3 px-5 py-3 rounded-2xl border shadow-sm hover:shadow transition-shadow ${urgent ? 'bg-rose-50/70 border-rose-200' : 'bg-amber-50/60 border-amber-200'}`}>
        <Wrench size={17} className={urgent ? 'text-rose-600' : 'text-amber-700'} />
        <span className="text-sm text-slate-800">Материална база: <b>{data.length}</b> отворени{fresh ? <> · <b>{fresh}</b> нови</> : null}</span>
        {urgent > 0 && <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-rose-600 text-white"><AlertTriangle size={11} /> {urgent} спешни</span>}
        <span className="ml-auto inline-flex items-center gap-1 text-[13px] text-slate-600">Към сигналите <ArrowRight size={14} /></span>
      </Link>
    )
  }
  const { data, error } = await supabase.from('facility_issues')
    .select('id, room, category, status, reply, updated_at, reporter_seen_at')
    .eq('reporter_id', profile.id).neq('status', 'new')
  if (error) return null
  const news = (data || []).filter((i: any) => !i.reporter_seen_at || i.reporter_seen_at < i.updated_at)
  if (!news.length) return null
  const label: Record<string, string> = { accepted: 'Прието', done: 'Поправено', cannot: 'Не може засега' }
  return (
    <Link href="/facilities" className="block px-5 py-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-center gap-2 text-sm text-slate-800"><Wrench size={16} className="text-emerald-700" /> Отговор по твоите сигнали
        <span className="ml-auto inline-flex items-center gap-1 text-[13px] text-slate-600">Виж <ArrowRight size={14} /></span>
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {news.slice(0, 3).map((i: any) => (
          <li key={i.id} className="text-[13px] text-slate-700 flex items-center gap-1.5">
            {i.status === 'done' && <Check size={13} className="text-emerald-600" />}
            <b className="font-medium">{label[i.status] || i.status}:</b> {catMeta(i.category).label.toLowerCase()} — {i.room}{i.reply ? <span className="text-slate-500"> · „{i.reply.length > 60 ? i.reply.slice(0, 60) + '…' : i.reply}“</span> : null}
          </li>
        ))}
      </ul>
    </Link>
  )
}
