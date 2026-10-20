import Link from 'next/link'
import { CalendarCheck, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PERIOD_LABEL, PERIOD_TIMES } from '@/lib/periods'

// „Посещение на час“ — за учителите, които участват в отворена проверка: „избери ден“ или „твоето посещение“.
const WD = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const dm = (s: string) => s.split('-').reverse().slice(0, 2).join('.')

export default async function VisitStrip({ profile }: { profile: any }) {
  if (!['class_teacher', 'teacher', 'educator'].includes(profile.role)) return null
  const supabase = await createClient()
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
  const { data: camps, error } = await supabase.from('visit_campaigns').select('*')
    .gte('date_to', today).order('date_from')
  if (error) return null
  const c = (camps || []).find((x: any) => (x.roles || []).includes(profile.role) && !(x.excluded_staff || []).includes(profile.id))
  if (!c) return null
  const { data: mine } = await supabase.from('visit_bookings').select('date, period, subject, class_name').eq('campaign_id', c.id).eq('staff_id', profile.id).maybeSingle()
  if (!mine && !c.is_open) return null
  const per = mine ? (Number(PERIOD_LABEL[mine.period]) ? `${PERIOD_LABEL[mine.period]}. час` : PERIOD_LABEL[mine.period] || `${mine.period}. час`) : ''

  return (
    <Link href={`/visits?c=${c.id}`}
      className={`flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${mine ? 'bg-white border-slate-200/70' : 'bg-indigo-50/70 border-indigo-200'}`}>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${mine ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-600 text-white'}`}><CalendarCheck size={17} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-slate-800">{c.title}</span>
        <span className="block text-[12.5px] text-slate-500 truncate">
          {mine
            ? `${WD[new Date(mine.date + 'T00:00').getDay()]}, ${dm(mine.date)} · ${per}${PERIOD_TIMES[mine.period] ? ` (${PERIOD_TIMES[mine.period]})` : ''}${mine.subject ? ` · ${mine.subject}` : ''}`
            : `Изберете ден и час до ${dm(c.date_to)}${c.focus_subject ? ` · ${c.focus_subject}` : ''}`}
        </span>
      </span>
      <ArrowRight size={15} className="text-slate-400 shrink-0" />
    </Link>
  )
}
