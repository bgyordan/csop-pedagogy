'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Моите лекторски слотове (спуснати от заповедта) — за текущия учител
export async function getMyLecturerSlots() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { slots: [] }
  const { data: me } = await supabase.from('staff_profiles').select('id').eq('user_id', user.id).single()
  if (!me) return { slots: [] }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  const { data } = await supabase
    .from('lecturer_slots')
    .select('id, day, period, holder_label, date_from, date_to, order_number, subject:subjects(name)')
    .eq('staff_id', me.id).eq('academic_year_id', cy?.id)
    .order('day').order('period')
  const slots = (data || []).map((r: any) => ({
    id: r.id, day: r.day, period: r.period, subject: r.subject?.name || '',
    holderLabel: r.holder_label || '', dateFrom: r.date_from, dateTo: r.date_to, orderNumber: r.order_number || '',
  }))
  return { slots }
}

// Всички дати в [from,to], които са в даден делничен ден (dow 1..5)
function datesForDow(from: string, to: string, dow: number): string[] {
  const out: string[] = []
  const d = new Date(from + 'T00:00'), end = new Date(to + 'T00:00')
  while (d <= end) {
    if (d.getDay() === dow) out.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return out
}

// Разгъва моите слотове по конкретни дати в избрания период на декларацията
export async function getMyLecturerDates(periodFrom: string, periodTo: string) {
  const { slots } = await getMyLecturerSlots()
  const rows = slots.map((s: any) => ({
    slotId: s.id, day: s.day, period: s.period, subject: s.subject, holderLabel: s.holderLabel,
    // само дати, които са И в срока на слота, И в периода на декларацията
    dates: datesForDow(
      periodFrom > s.dateFrom ? periodFrom : s.dateFrom,
      periodTo < s.dateTo ? periodTo : s.dateTo,
      s.day
    ),
  }))
  return { rows }
}

// Записва декларацията на учителя (отметнати дати по слот)
export async function submitLecturerDeclaration(
  periodFrom: string, periodTo: string,
  entries: { slotId: string; dates: string[] }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id').eq('user_id', user.id).single()
  if (!me) return { error: 'Няма профил' }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  const totalHours = entries.reduce((a, e) => a + e.dates.length, 0)
  const { error } = await supabase.from('lecturer_declarations').insert({
    staff_id: me.id, period_from: periodFrom, period_to: periodTo,
    entries, total_hours: totalHours, status: 'submitted', academic_year_id: cy?.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/my-lecturer')
  return { success: true, totalHours }
}
