import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getFullName } from '@/lib/utils'
import GymScheduleClient from './GymScheduleClient'
export const dynamic = 'force-dynamic'

interface Occupant { label: string; teacher: string; ifo?: boolean }

export default async function GymSchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  // Предмети с „ФВС" в името (ФВС, музика/ФВС и сродни)
  const { data: subs } = await supabase.from('subjects').select('id').ilike('name', '%ФВС%')
  const subjIds = (subs || []).map((s: any) => s.id)

  const cells: Record<string, Occupant[]> = {}
  const push = (day: number, period: number, occ: Occupant) => {
    const k = `${day}-${period}`
    const arr = cells[k] || (cells[k] = [])
    if (!arr.some(o => o.label === occ.label)) arr.push(occ) // без дубли на паралелка
  }

  if (subjIds.length > 0) {
    // Разписания за годината → име на паралелка
    const { data: scheds } = await supabase.from('class_schedules')
      .select('id, class:classes(name)').eq('academic_year_id', cy?.id)
    const nameBySched: Record<string, string> = {}
    ;(scheds || []).forEach((s: any) => { nameBySched[s.id] = s.class?.name || '?' })
    const schedIds = (scheds || []).map((s: any) => s.id)

    if (schedIds.length > 0) {
      const { data: slots } = await supabase.from('schedule_slots')
        .select('day, period, schedule_id, staff:staff_profiles(first_name, last_name)')
        .in('subject_id', subjIds).in('schedule_id', schedIds)
      ;(slots || []).forEach((s: any) => push(s.day, s.period, {
        label: nameBySched[s.schedule_id] || '?',
        teacher: s.staff ? `${s.staff.first_name} ${s.staff.last_name}` : '',
      }))
    }

    // ИФО ФВС часове
    const { data: ifo } = await supabase.from('teacher_ifo_slots')
      .select('day, period, teacher:staff_profiles(first_name, last_name), student:students(first_name, middle_name, last_name)')
      .in('subject_id', subjIds).eq('academic_year_id', cy?.id)
    ;(ifo || []).forEach((s: any) => push(s.day, s.period, {
      label: s.student ? getFullName(s.student) : 'ИФО',
      teacher: s.teacher ? `${s.teacher.first_name} ${s.teacher.last_name}` : '',
      ifo: true,
    }))
  }

  return <GymScheduleClient cells={cells} yearName={cy?.name || ''} capacity={2} />
}
