import { CalendarOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { sofiaToday } from '@/lib/today-absences'

// Спонтанен неучебен ден (заповед на кмета и др.) — днес или до 3 дни напред, за всички колеги.
// Маркира се от „Учебен календар“. Ако SQL-ът още не е пуснат — нищо.
const fmt = (iso: string) => iso.split('-').reverse().slice(0, 2).join('.')
const DOW = ['неделя', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота']

export default async function NonSchoolDayStrip() {
  const supabase = await createClient()
  const today = sofiaToday()
  const d = new Date(today + 'T00:00'); d.setDate(d.getDate() + 3)
  const until = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const { data, error } = await supabase.from('academic_calendar_days')
    .select('date, notes').eq('spontaneous', true).gte('date', today).lte('date', until).order('date')
  if (error || !data || data.length === 0) return null
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-3.5 space-y-1">
      {data.map((x: any) => (
        <div key={x.date} className="flex items-center gap-2 text-sm text-amber-900">
          <CalendarOff size={15} className="text-amber-600 shrink-0" />
          <span>
            {x.date === today ? 'Днес' : `${DOW[new Date(x.date + 'T00:00').getDay()][0].toUpperCase()}${DOW[new Date(x.date + 'T00:00').getDay()].slice(1)}, ${fmt(x.date)}`} е неучебен ден
            {x.notes && <span className="text-amber-800/80 font-light"> — {x.notes}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
