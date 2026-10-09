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

  type Decl = { id: string; status: string; from: string; to: string; hours: number }
  type R = { planned: number; declared: number; hasDecl: boolean; np: number; budget: number; by: Record<string, { np: number; budget: number }>; decls: Decl[] }
  const rows: Record<string, R> = {}
  const row = (id: string) => (rows[id] = rows[id] || { planned: 0, declared: 0, hasDecl: false, np: 0, budget: 0, by: {}, decls: [] })

  // над норматив — по заповед (маркираните слотове × учебните дни, без отсъствията)
  const { data: slots } = await supabase.from('lecturer_slots')
    .select('staff_id, day, date_from, date_to').eq('academic_year_id', cy?.id)
  ;(slots || []).forEach((s: any) => {
    const n = days.filter(c => c.day_of_week === s.day && c.date >= s.date_from && c.date <= s.date_to && !isAbsent(s.staff_id, c.date)).length
    if (n > 0) row(s.staff_id).planned += n
  })

  // над норматив — декларирани от учителя (датите в периода)
  const { data: decls } = await supabase.from('lecturer_declarations')
    .select('id, staff_id, entries, status, period_from, period_to').lte('period_from', last).gte('period_to', first)
  ;(decls || []).forEach((d: any) => {
    const n = ((d.entries as any[]) || []).reduce((a, e) => a + (e.dates || []).filter((x: string) => x >= first && x <= last).length, 0)
    const r = row(d.staff_id); r.declared += n; r.hasDecl = true
    r.decls.push({ id: d.id, status: d.status, from: d.period_from, to: d.period_to, hours: n })
  })

  // заместване
  const sh: any = await getSubstitutionHoursByStaff(first, last)
  Object.entries((sh.data || {}) as Record<string, { np: number; budget: number; by?: Record<string, { np: number; budget: number }> }>).forEach(([id, v]) => {
    const r = row(id); r.np += v.np; r.budget += v.budget
    Object.entries(v.by || {}).forEach(([aid, h]) => {
      const b = (r.by[aid] = r.by[aid] || { np: 0, budget: 0 }); b.np += h.np; b.budget += h.budget
    })
  })

  const ids = Object.keys(rows)
  if (ids.length === 0) return { data: [] }
  const absentIds = Array.from(new Set(ids.flatMap(id => Object.keys(rows[id].by))))
  const { data: ppl } = await supabase.from('staff_profiles').select('id, first_name, last_name, position').in('id', Array.from(new Set([...ids, ...absentIds])))
  const names: Record<string, { name: string; position: string }> = {}
  ;(ppl || []).forEach((p: any) => { names[p.id] = { name: `${p.first_name} ${p.last_name}`, position: p.position || '' } })

  const data = ids.map(id => {
    const { by, ...rest } = rows[id]
    // кого е замествал: име + часове (НП / бюджет), по брой часове надолу
    const substituted = Object.entries(by)
      .map(([aid, h]) => ({ name: names[aid]?.name || '—', np: h.np, budget: h.budget }))
      .filter(x => x.np + x.budget > 0)
      .sort((a, b) => (b.np + b.budget) - (a.np + a.budget))
    return { staffId: id, ...(names[id] || { name: '—', position: '' }), ...rest, substituted }
  })
    .filter(r => r.planned + r.declared + r.np + r.budget > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
  return { data }
}

// ── ПОДРОБНОСТИ за един служител в периода (за „Проверка лекторски“): ──
// над норматив — по часове от заповедта: дните по график, кои са декларирани, кои са в отпуск/болничен;
// заместване — по дни: кого, кои часове (паралелка, предмет), НП / бюджет.
export async function getReviewDetail(staffId: string, first: string, last: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director', 'secretary'].includes(me?.role || '')) return { error: 'Нямате права' }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  const { data: cal } = await supabase.from('academic_calendar_days')
    .select('date, day_of_week').gte('date', first).lte('date', last).eq('is_school_day', true).order('date')
  const days = (cal || []) as { date: string; day_of_week: number }[]
  const { data: abs } = await supabase.from('substitutions').select('date_from, date_to')
    .eq('absent_staff_id', staffId).lte('date_from', last).gte('date_to', first)
  const isAbsent = (d: string) => (abs || []).some((a: any) => d >= a.date_from && d <= a.date_to)

  // декларираните дати по час от заповедта
  const { data: decls } = await supabase.from('lecturer_declarations')
    .select('entries').eq('staff_id', staffId).lte('period_from', last).gte('period_to', first)
  const declared: Record<string, Set<string>> = {}
  ;(decls || []).forEach((d: any) => ((d.entries as any[]) || []).forEach(e => {
    const set = (declared[e.slotId] ||= new Set<string>())
    ;(e.dates || []).forEach((x: string) => { if (x >= first && x <= last) set.add(x) })
  }))

  const { data: slots } = await supabase.from('lecturer_slots')
    .select('id, day, period, holder_label, date_from, date_to, subject:subjects(name)')
    .eq('staff_id', staffId).eq('academic_year_id', cy?.id).order('day').order('period')
  const over = (slots || []).map((s: any) => {
    const inRange = days.filter(c => c.day_of_week === s.day && c.date >= s.date_from && c.date <= s.date_to)
    const dec = declared[s.id] || new Set<string>()
    return {
      slotId: s.id, day: s.day, period: s.period, subject: s.subject?.name || '', holder: s.holder_label || '',
      dates: inRange.map(c => ({ date: c.date, absent: isAbsent(c.date), declared: dec.has(c.date) })),
    }
  }).filter(x => x.dates.length > 0)

  // заместване по дни
  const sh: any = await getSubstitutionHoursByStaff(first, last, staffId)
  const subDays = ((sh.data || {})[staffId]?.days || []) as { iso: string; absentId: string; np: boolean; items: { period: number; cls: string; subject: string }[] }[]
  const absentIds = Array.from(new Set(subDays.map(d => d.absentId)))
  const names: Record<string, string> = {}
  if (absentIds.length) {
    const { data: ppl } = await supabase.from('staff_profiles').select('id, first_name, last_name').in('id', absentIds)
    ;(ppl || []).forEach((p: any) => { names[p.id] = `${p.first_name} ${p.last_name}` })
  }
  const subs = subDays.sort((a, b) => a.iso.localeCompare(b.iso)).map(d => ({
    date: d.iso, absent: names[d.absentId] || '—', np: d.np,
    items: d.items.sort((a, b) => a.period - b.period),
  }))
  return { over, subs }
}

// Ставки за лекторски час — управата и деловодството (lecturer_rates, един ред)
export async function saveLecturerRates(r: { unified: boolean; npSame: boolean; over: number; sub: number; np: number; employerPct: number }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director', 'secretary'].includes(me?.role || '')) return { error: 'Нямате права' }
  const ok = (v: number) => Number.isFinite(v) && v > 0 && v < 1000
  if (!ok(r.over) || (!r.unified && !ok(r.sub)) || !ok(r.np)) return { error: 'Въведете ставка в евро, напр. 6,29' }
  if (!Number.isFinite(r.employerPct) || r.employerPct < 0 || r.employerPct > 60) return { error: 'Въведете процента осигуровки, напр. 23,32' }
  const round = (v: number) => Math.round(v * 100) / 100
  const { error } = await supabase.from('lecturer_rates').upsert({
    id: 1, unified: r.unified, np_same: false,   // rate_np = таван за МОН с осигуровките
    rate_over: round(r.over), rate_sub: round(r.unified ? r.over : r.sub), rate_np: round(r.np), employer_pct: round(r.employerPct),
    updated_at: new Date().toISOString(), updated_by: me?.id || null,
  })
  if (error) return { error: /employer_pct/.test(error.message) ? 'Пуснете SQL файла 2026-10-09_lecturer_rates_pct.sql' : /lecturer_rates|np_same/.test(error.message) ? 'Пуснете SQL файла 2026-10-08_lecturer_rates.sql' : error.message }
  revalidatePath('/lecturer-review')
  return { success: true }
}
