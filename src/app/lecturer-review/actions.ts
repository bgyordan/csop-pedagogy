'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getSubstitutionHoursByStaff } from '../substitutions/actions'

// Потвърждава декларация (submitted -> verified)
export async function verifyDeclaration(declId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director', 'secretary'].includes(me?.role || '')) return { error: 'Нямате права' }
  const { error } = await supabase.from('lecturer_declarations')
    .update({ status: 'verified', verified_by: me?.id, verified_at: new Date().toISOString() })
    .eq('id', declId)
  if (error) return { error: error.message }
  revalidatePath('/lecturer-review')
  return { success: true }
}

// Връща в "подадена" (ако е сгрешено потвърждаване)
export async function unverifyDeclaration(declId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director', 'secretary'].includes(me?.role || '')) return { error: 'Нямате права' }
  const { error } = await supabase.from('lecturer_declarations')
    .update({ status: 'submitted', verified_by: null, verified_at: null }).eq('id', declId)
  if (error) return { error: error.message }
  revalidatePath('/lecturer-review')
  return { success: true }
}

// Детайли на декларация (кои слотове/дати) — за преглед при проверка
export async function getDeclarationDetail(declId: string) {
  const supabase = await createClient()
  const { data: decl } = await supabase.from('lecturer_declarations')
    .select('id, staff_id, entries, staff:staff_profiles!lecturer_declarations_staff_id_fkey(first_name, last_name)').eq('id', declId).single()
  if (!decl) return { error: 'Не е намерено' }
  const entries: { slotId: string; dates: string[] }[] = (decl.entries as any) || []
  const slotIds = entries.map(e => e.slotId)
  const slotInfo: Record<string, { day: number; period: number; subject: string; holder: string }> = {}
  if (slotIds.length > 0) {
    const { data: sl } = await supabase.from('lecturer_slots')
      .select('id, day, period, holder_label, subject:subjects(name)').in('id', slotIds)
    ;(sl || []).forEach((r: any) => { slotInfo[r.id] = { day: r.day, period: r.period, subject: r.subject?.name || '', holder: r.holder_label || '' } })
  }
  const DAY = ['', 'пон', 'вт', 'ср', 'чет', 'пет']
  const rows = entries.map(e => ({
    label: slotInfo[e.slotId] ? `${DAY[slotInfo[e.slotId].day]} ${slotInfo[e.slotId].period}. ${slotInfo[e.slotId].subject} · ${slotInfo[e.slotId].holder}` : '—',
    dates: e.dates.map(d => d.split('-').reverse().join('.')),
    count: e.dates.length,
  }))
  return { rows }
}

// ── МЕСЕЧЕН ПРЕГЛЕД: по служител — над норматив (по заповед / декларирани) + заместване (НП / бюджет) ──
export async function getLecturerOverview(first: string, last: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director', 'secretary'].includes(me?.role || '')) return { error: 'Нямате права' }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  // учебните дни в периода
  const { data: cal } = await supabase.from('academic_calendar_days')
    .select('date, day_of_week').gte('date', first).lte('date', last).eq('is_school_day', true)
  const days = (cal || []) as { date: string; day_of_week: number }[]

  // отсъствията (отпуск/болничен) — в тези дни учителят не взима над норматив
  const { data: abs } = await supabase.from('substitutions').select('absent_staff_id, date_from, date_to')
    .lte('date_from', last).gte('date_to', first)
  const isAbsent = (staffId: string, d: string) => (abs || []).some((a: any) => a.absent_staff_id === staffId && d >= a.date_from && d <= a.date_to)

  type R = { planned: number; declared: number; hasDecl: boolean; np: number; budget: number }
  const rows: Record<string, R> = {}
  const row = (id: string) => (rows[id] = rows[id] || { planned: 0, declared: 0, hasDecl: false, np: 0, budget: 0 })

  // над норматив — по заповед (маркираните слотове × учебните дни, без отсъствията)
  const { data: slots } = await supabase.from('lecturer_slots')
    .select('staff_id, day, date_from, date_to').eq('academic_year_id', cy?.id)
  ;(slots || []).forEach((s: any) => {
    const n = days.filter(c => c.day_of_week === s.day && c.date >= s.date_from && c.date <= s.date_to && !isAbsent(s.staff_id, c.date)).length
    if (n > 0) row(s.staff_id).planned += n
  })

  // над норматив — декларирани от учителя (датите в периода)
  const { data: decls } = await supabase.from('lecturer_declarations')
    .select('staff_id, entries').lte('period_from', last).gte('period_to', first)
  ;(decls || []).forEach((d: any) => {
    const n = ((d.entries as any[]) || []).reduce((a, e) => a + (e.dates || []).filter((x: string) => x >= first && x <= last).length, 0)
    const r = row(d.staff_id); r.declared += n; r.hasDecl = true
  })

  // заместване
  const sh: any = await getSubstitutionHoursByStaff(first, last)
  Object.entries((sh.data || {}) as Record<string, { np: number; budget: number }>).forEach(([id, v]) => {
    const r = row(id); r.np += v.np; r.budget += v.budget
  })

  const ids = Object.keys(rows)
  if (ids.length === 0) return { data: [] }
  const { data: ppl } = await supabase.from('staff_profiles').select('id, first_name, last_name, position').in('id', ids)
  const names: Record<string, { name: string; position: string }> = {}
  ;(ppl || []).forEach((p: any) => { names[p.id] = { name: `${p.first_name} ${p.last_name}`, position: p.position || '' } })

  const data = ids.map(id => ({ staffId: id, ...(names[id] || { name: '—', position: '' }), ...rows[id] }))
    .filter(r => r.planned + r.declared + r.np + r.budget > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
  return { data }
}
