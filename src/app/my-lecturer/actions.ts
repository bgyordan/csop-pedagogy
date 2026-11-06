'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { checkDeclarablePeriod } from '@/lib/declaration-periods'

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
    .select('id, day, period, holder_type, holder_label, date_from, date_to, order_number, subject:subjects(name)')
    .eq('staff_id', me.id).eq('academic_year_id', cy?.id)
    .order('day').order('period')
  const slots = (data || []).map((r: any) => ({
    id: r.id, day: r.day, period: r.period, subject: r.subject?.name || '',
    holderType: r.holder_type || '', holderLabel: r.holder_label || '', dateFrom: r.date_from, dateTo: r.date_to, orderNumber: r.order_number || '',
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

// Разгъва моите слотове по конкретни дати в избрания период — САМО учебни дни (без ваканции, от календара)
export async function getMyLecturerDates(periodFrom: string, periodTo: string) {
  const supabase = await createClient()
  const { slots } = await getMyLecturerSlots()
  // учебните дни в периода от календара
  const { data: cal } = await supabase
    .from('academic_calendar_days')
    .select('date, day_of_week')
    .gte('date', periodFrom).lte('date', periodTo).eq('is_school_day', true)
  const schoolDates = (cal || [])
  // неучебните дни (ваканции, празници) — само за прегледа „Какво ще влезе“, задраскани с причината
  const { data: offCal } = await supabase
    .from('academic_calendar_days')
    .select('date, day_of_week, notes')
    .gte('date', periodFrom).lte('date', periodTo).eq('is_school_day', false)

  // дните, в които самият учител отсъства (отпуск/болничен в „Замествания“) — не е провел часа
  const absent = new Set<string>()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = user ? await supabase.from('staff_profiles').select('id').eq('user_id', user.id).single() : { data: null }
  if (me) {
    const { data: abs } = await supabase.from('substitutions').select('date_from, date_to')
      .eq('absent_staff_id', me.id).lte('date_from', periodTo).gte('date_to', periodFrom)
    ;(abs || []).forEach((a: any) => schoolDates.forEach((c: any) => { if (c.date >= a.date_from && c.date <= a.date_to) absent.add(c.date) }))
  }

  const rows = slots.map((s: any) => {
    const lo = periodFrom > s.dateFrom ? periodFrom : s.dateFrom
    const hi = periodTo < s.dateTo ? periodTo : s.dateTo
    const dates = schoolDates
      .filter((c: any) => c.day_of_week === s.day && c.date >= lo && c.date <= hi)
      .map((c: any) => c.date)
    const off = (offCal || [])
      .filter((c: any) => c.day_of_week === s.day && c.date >= lo && c.date <= hi)
      .map((c: any) => ({ date: c.date as string, note: (c.notes as string) || 'неучебен ден' }))
    return { slotId: s.id, day: s.day, period: s.period, subject: s.subject, holderType: s.holderType, holderLabel: s.holderLabel, validFrom: s.dateFrom, validTo: s.dateTo, dates, absent: dates.filter((d: string) => absent.has(d)), off }
  })
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
  // седмицата за генериране: 5-то – 11-то число след периода (сеп.–окт. заедно, после по месеци)
  const pc = checkDeclarablePeriod(periodFrom, periodTo, 'over')
  if (!pc.ok) return { error: pc.error }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  // подаване наново за същия период → старата (неприключена) се заменя; проверена/изплатена не се пипа
  const { data: existing } = await supabase.from('lecturer_declarations')
    .select('id, status, period_from, period_to').eq('staff_id', me.id)
  const overlap = (existing || []).filter((e: any) => periodFrom <= e.period_to && periodTo >= e.period_from)
  if (overlap.some((e: any) => e.status !== 'submitted')) return { error: 'За част от този период декларацията вече е проверена — обърнете се към ЗДУД' }
  if (overlap.length > 0) await supabase.from('lecturer_declarations').delete().in('id', overlap.map((e: any) => e.id))

  // ПРОВЕРКА: всяка дата трябва да е от системата — учебен ден, в неговия час над норматив и в периода му.
  // Дните, в които системата води учителя в отпуск/болничен, могат да се върнат („Редакция“) — декларацията е негова,
  // ЗАС сверява на хартия с личния състав; неучебен ден или час извън графика — не.
  const allowed: any = await getMyLecturerDates(periodFrom, periodTo)
  const ok: Record<string, Set<string>> = {}
  ;(allowed.rows || []).forEach((r: any) => { ok[r.slotId] = new Set(r.dates || []) })
  for (const e of entries) {
    const set = ok[e.slotId]
    if (!set) return { error: 'Декларацията съдържа час, който не е определен като ваш над норматив' }
    const bad = e.dates.filter(d => !set.has(d))
    if (bad.length > 0) return { error: `Недопустими дати (неучебен ден или извън графика): ${bad.map(d => d.split('-').reverse().join('.')).join(', ')}` }
    if (new Set(e.dates).size !== e.dates.length) return { error: 'Повторена дата в декларацията' }
  }

  const totalHours = entries.reduce((a, e) => a + e.dates.length, 0)
  const { data: ins, error } = await supabase.from('lecturer_declarations').insert({
    staff_id: me.id, period_from: periodFrom, period_to: periodTo,
    entries, total_hours: totalHours, status: 'submitted', academic_year_id: cy?.id,
  }).select('id').single()
  if (error) return { error: error.message }
  revalidatePath('/my-lecturer')
  return { success: true, totalHours, id: ins?.id }
}

// Изтрива подадена (непроверена) декларация на текущия учител
export async function deleteMyDeclaration(declId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id').eq('user_id', user.id).single()
  if (!me) return { error: 'Няма профил' }
  // само своя и само ако е още 'submitted'
  const { data: decl } = await supabase.from('lecturer_declarations').select('id, staff_id, status').eq('id', declId).single()
  if (!decl || decl.staff_id !== me.id) return { error: 'Не е ваша декларация' }
  if (decl.status !== 'submitted') return { error: 'Проверена декларация не може да се трие' }
  await supabase.from('lecturer_declarations').delete().eq('id', declId)
  revalidatePath('/my-lecturer')
  return { success: true }
}

// Данните на колегата за декларациите (име, длъжност, заповеди, ставка) — за бутона „Моите декларации“
export async function getMyDeclContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, first_name, last_name, position, role, therapy_role').eq('user_id', user.id).single()
  if (!me) return { error: 'Няма профил' }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
  const { loadLecturerOrders, orderText } = await import('@/lib/lecturer-orders')
  const { loadLecturerRates, effectiveRates } = await import('@/lib/lecturer-rates')
  const orders = (await loadLecturerOrders(supabase, cy?.id, me.id))[me.id] || {}
  const { count } = await supabase.from('lecturer_slots').select('id', { count: 'exact', head: true }).eq('staff_id', me.id).eq('academic_year_id', cy?.id)
  return {
    teacherName: `${me.first_name} ${me.last_name}`,
    position: me.position || 'Учител/старши учител на ДУИ',
    orderOver: orderText(orders.over), orderIfo: orderText(orders.ifo),
    rate: effectiveRates(await loadLecturerRates(supabase)).over,
    isSpeech: me.role === 'speech_therapist' || (me as any).therapy_role === 'speech_therapist',
    hasSlots: (count || 0) > 0,
  }
}

// ── Корекциите по декларациите („Редакция“) — пазят се за периода, за да не се губят при ново влизане ──
export type DeclEdits = {
  removed?: string[]                  // над норматив: „slotId|дата“ — махнати (не са взети)
  restored?: string[]                 // над норматив: „slotId|дата“ — върнати (системата ги води в отпуск)
  subHours?: Record<string, number>   // заместване: „subId|дата|паралелка“ → часове (0 = махнат)
  manual?: { id: string; iso: string; absentName: string; cls: string; subject: string; hours: number }[]
}
const EDITS_SQL_HINT = 'Корекциите не се запазиха — пуснете SQL файла 2026-11-06_declaration_edits.sql'

async function myStaffId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, id: null as string | null }
  const { data: me } = await supabase.from('staff_profiles').select('id').eq('user_id', user.id).single()
  return { supabase, id: (me?.id as string) || null }
}

export async function getMyDeclEdits(periodFrom: string, periodTo: string): Promise<{ data: DeclEdits | null }> {
  const { supabase, id } = await myStaffId()
  if (!id) return { data: null }
  const { data, error } = await supabase.from('declaration_edits').select('data')
    .eq('staff_id', id).eq('period_from', periodFrom).eq('period_to', periodTo).maybeSingle()
  if (error) return { data: null }   // преди SQL файла — без запазени корекции
  return { data: (data?.data as DeclEdits) || null }
}

export async function saveMyDeclEdits(periodFrom: string, periodTo: string, edits: DeclEdits) {
  const { supabase, id } = await myStaffId()
  if (!id) return { error: 'Не сте влезли' }
  const empty = !(edits.removed?.length || edits.restored?.length || Object.keys(edits.subHours || {}).length || edits.manual?.length)
  const q = empty
    ? supabase.from('declaration_edits').delete().eq('staff_id', id).eq('period_from', periodFrom).eq('period_to', periodTo)
    : supabase.from('declaration_edits').upsert({ staff_id: id, period_from: periodFrom, period_to: periodTo, data: edits, updated_at: new Date().toISOString() })
  const { error } = await q
  if (error) return { error: EDITS_SQL_HINT }
  return { success: true }
}
