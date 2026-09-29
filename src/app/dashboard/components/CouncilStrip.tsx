import Link from 'next/link'
import { ClipboardCheck, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { sofiaToday } from '@/lib/today-absences'

// „За съгласуване“ на таблото на всички: активните комплекти (педагогически съвет и др.),
// с които служителят още НЕ се е запознал (или има нови файлове след това). Ако няма — нищо.
export default async function CouncilStrip({ staffId }: { staffId: string }) {
  const supabase = await createClient()
  const today = sofiaToday()
  const load = (cols: string) => supabase.from('council_sets')
    .select(cols).eq('is_archived', false)
    .or(`event_date.is.null,event_date.gte.${today}`)
    .order('event_date', { ascending: true, nullsFirst: false })
  let res: any = await load('id, title, event_date, event_time')
  if (res.error) res = await load('id, title, event_date')   // колоната за час още я няма
  const sets: any[] = res.data || []
  if (sets.length === 0) return null
  const ids = sets.map((s: any) => s.id)
  const [{ data: files }, acksRes] = await Promise.all([
    supabase.from('council_files').select('set_id, created_at').in('set_id', ids),
    supabase.from('council_acks').select('set_id, acked_at').eq('staff_id', staffId).in('set_id', ids),
  ])
  const count: Record<string, number> = {}, last: Record<string, number> = {}
  ;(files || []).forEach((f: any) => {
    count[f.set_id] = (count[f.set_id] || 0) + 1
    last[f.set_id] = Math.max(last[f.set_id] || 0, Date.parse(f.created_at) || 0)
  })
  const acked: Record<string, number> = {}
  ;(acksRes.data || []).forEach((a: any) => { acked[a.set_id] = Date.parse(a.acked_at) || 0 })
  const ackOn = !acksRes.error

  const todo = sets.filter((s: any) => count[s.id] > 0 && (!ackOn || !(acked[s.id] >= last[s.id])))
  if (todo.length === 0) return null

  const fmt = (d: string) => d.split('-').reverse().slice(0, 2).join('.')
  const when = (d: string | null) => {
    if (!d) return ''
    const days = Math.round((new Date(d + 'T00:00').getTime() - new Date(today + 'T00:00').getTime()) / 86400000)
    return days === 0 ? 'днес' : days === 1 ? 'утре' : `след ${days} дни`
  }
  return (
    <Link href="/council" className="block bg-white rounded-2xl border border-blue-100 shadow-sm px-5 py-3.5 hover:border-blue-200 hover:shadow-md transition-all group">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 text-blue-600 shrink-0"><ClipboardCheck size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-800">За съгласуване</div>
          <div className="text-[13px] text-slate-500 mt-0.5 space-y-0.5">
            {todo.map((s: any) => (
              <div key={s.id} className="truncate">
                {s.title}{s.event_date ? ` · ${fmt(s.event_date)}` : ''}{s.event_time ? ` · ${String(s.event_time).slice(0, 5)} ч.` : ''} · {count[s.id]} {count[s.id] === 1 ? 'файл' : 'файла'}
                {s.event_date && <span className="text-amber-700"> · {when(s.event_date)}</span>}
                {ackOn && acked[s.id] ? <span className="text-amber-700"> · нови файлове</span> : null}
              </div>
            ))}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0f2240] shrink-0 group-hover:gap-1.5 transition-all">Прегледай <ArrowRight size={13} /></span>
      </div>
    </Link>
  )
}
