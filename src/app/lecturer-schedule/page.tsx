import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { CalendarRange } from 'lucide-react'
import { yearSchoolDays, getClassEnds } from '../lecturer/actions'
import { slotHours, dowOf } from '../lecturer/distribute'
import { loadOwnClasses, groupFields, byStaffGroup } from '@/lib/staff-order'
import ScheduleClient from './ScheduleClient'
import type { SchedPerson } from './ScheduleClient'
export const dynamic = 'force-dynamic'

// График на лекторските над норматива за всички — за печат и проверка на месечните декларации.
// Достъп: админ, директор, ЗДУД и деловодството (секретар / ЗАС).

const MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]

export default async function LecturerSchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director', 'secretary'].includes(me?.role || '')) redirect('/dashboard')

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()
  const [{ data: slots }, cal, { ends }, own] = await Promise.all([
    supabase.from('lecturer_slots')
      .select(`staff_id, day, period, holder_label, date_from, date_to, subject:subjects(name),
        staff:staff_profiles!lecturer_slots_staff_id_fkey(id, first_name, last_name, position, role)`)
      .eq('academic_year_id', cy?.id).range(0, 4999),
    yearSchoolDays(),
    getClassEnds(cy?.id),
    loadOwnClasses(supabase, cy?.id),
  ])
  const dates = cal.map(d => d.date)

  const byStaff: Record<string, SchedPerson> = {}
  ;(slots || []).forEach((s: any) => {
    if (!s.staff) return
    const p = (byStaff[s.staff_id] ||= {
      id: s.staff_id, name: `${s.staff.first_name} ${s.staff.last_name}`, position: s.staff.position || '',
      ...groupFields({ id: s.staff_id, role: s.staff.role, position: s.staff.position }, own),
      rows: [], total: 0, months: MONTHS.map(() => 0),
    })
    // реалните учебни дни в деня на часа, по месеци
    const months = MONTHS.map(() => 0)
    dates.forEach(d => {
      if (d < s.date_from || d > s.date_to || dowOf(d) !== s.day) return
      const mi = MONTHS.indexOf(Number(d.slice(5, 7)))
      if (mi >= 0) months[mi] += 1
    })
    const total = slotHours(dates, s.day, s.date_from, s.date_to, ends)
    p.rows.push({
      day: s.day, period: s.period, subject: s.subject?.name || 'Терапевтична дейност', cls: s.holder_label || '—',
      from: s.date_from, to: s.date_to, months, total,
    })
    p.total += total
    months.forEach((v, i) => { p.months[i] += v })
  })
  const people = Object.values(byStaff)
  people.forEach(p => p.rows.sort((a, b) => a.day - b.day || a.period - b.period))
  people.sort(byStaffGroup)

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="print:hidden"><BackButton /></div>
      <header className="flex items-center gap-4 mt-2 mb-6 pb-5 border-b border-slate-100 print:hidden">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
          <CalendarRange size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">График на лекторските часове</h1>
          <p className="text-sm text-slate-500 mt-0.5">{cy?.name} · над норматива, за всички · по месеци — за проверка на декларациите</p>
        </div>
      </header>
      <ScheduleClient people={people} yearName={cy?.name || ''} />
    </div>
  )
}
