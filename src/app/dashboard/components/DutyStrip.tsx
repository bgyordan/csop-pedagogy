import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { sofiaToday } from '@/lib/today-absences'
import { mondayOf, isoOf } from '@/lib/duty-weeks'

// Дежурните тази седмица (в събота/неделя — следващата), за всички колеги; дежурният го вижда отличено.
const short = (p: any) => p ? `${p.first_name} ${p.last_name}` : ''

export default async function DutyStrip({ staffId }: { staffId: string }) {
  const supabase = await createClient()
  const today = sofiaToday()
  const dow = new Date(today + 'T00:00').getDay()
  const mon = new Date(mondayOf(today) + 'T00:00')
  if (dow === 0 || dow === 6) mon.setDate(mon.getDate() + 7)
  const fri = new Date(mon); fri.setDate(fri.getDate() + 4)
  const { data, error } = await supabase.from('duty_slots')
    .select('staff_id, start_date, p:staff_profiles(first_name, last_name)')
    .gte('start_date', isoOf(mon)).lte('start_date', isoOf(fri))
  if (error || !data || data.length === 0) return null
  const mine = data.some((d: any) => d.staff_id === staffId)
  const label = dow === 0 || dow === 6 ? 'Следващата седмица дежурни' : 'Тази седмица дежурни'
  return (
    <div className={`rounded-2xl border px-5 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 ${mine ? 'border-sky-200 bg-sky-50/70' : 'border-slate-200/70 bg-white shadow-sm'}`}>
      <ShieldCheck size={15} className={mine ? 'text-sky-600' : 'text-slate-400'} />
      {mine && <span className="text-sm text-sky-900">{dow === 0 || dow === 6 ? 'Следващата седмица си дежурен.' : 'Тази седмица си дежурен.'}</span>}
      <span className="text-sm text-slate-600">{label}: <span className="text-slate-800">{data.map((d: any) => short(d.p)).filter(Boolean).join(', ')}</span></span>
    </div>
  )
}
