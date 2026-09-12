'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Работни дни (пон-пет) между две дати, като { date: ISO, dow: 1..5 }
async function workdays(supabase: any, from: string, to: string): Promise<{ iso: string; dow: number }[]> {
  const { data } = await supabase
    .from('academic_calendar_days')
    .select('date, day_of_week')
    .gte('date', from).lte('date', to).eq('is_school_day', true)
    .order('date')
  return (data || []).map((c: any) => ({ iso: c.date, dow: c.day_of_week }))
}
// Генерира заповед за заместване: вади часовете на отсъстващия, създава РД-08 в orders,
// връща данните за Word генератора.
export async function generateSubstitution(substitutionId: string, overNorm: boolean = true, register: boolean = true) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id').eq('user_id', user.id).single()

  // 1. Заместването
  const { data: sub } = await supabase
    .from('substitutions')
    .select(`id, absent_staff_id, substitute_staff_id, date_from, date_to, reason, leave_order_number, leave_order_date, bsch_eligible,
       absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name, position),
      sub:staff_profiles!substitutions_substitute_staff_id_fkey(first_name, last_name, position)`)
    .eq('id', substitutionId).single()
  if (!sub) return { error: 'Заместването не е намерено' }
  if (!sub.substitute_staff_id) return { error: 'Няма избран заместник' }

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  // 2. Часовете на отсъстващия — schedule_slots (staff_id) + teacher_ifo_slots (teacher_id), I срок
  const { data: mySched } = await supabase
    .from('class_schedules').select('id, class_id, class:classes(name)')
    .eq('academic_year_id', cy?.id).eq('term', 1)
  const schedInfo: Record<string, string> = {}
  ;(mySched || []).forEach((s: any) => { schedInfo[s.id] = s.class?.name || '' })
  const schedIds = (mySched || []).map((s: any) => s.id)

  const bySlot: { day: number; period: number; subject: string; cls: string }[] = []
  if (schedIds.length > 0) {
    const { data: slots } = await supabase
      .from('schedule_slots').select('schedule_id, day, period, subject:subjects(name)')
      .in('schedule_id', schedIds).eq('staff_id', sub.absent_staff_id)
    ;(slots || []).forEach((sl: any) => {
      bySlot.push({ day: sl.day, period: sl.period, subject: sl.subject?.name || '', cls: schedInfo[sl.schedule_id] || '' })
    })
  }
  const { data: ifo } = await supabase
    .from('teacher_ifo_slots')
    .select('day, period, subject:subjects(name), student:students(first_name, middle_name, last_name)')
    .eq('teacher_id', sub.absent_staff_id).eq('academic_year_id', cy?.id).eq('term', 1)
  ;(ifo || []).forEach((sl: any) => {
    const nm = sl.student ? `ИФО ${sl.student.first_name} ${sl.student.last_name}` : 'ИФО'
    bySlot.push({ day: sl.day, period: sl.period, subject: sl.subject?.name || '', cls: nm })
  })

  // 3. Разгъваме по работни дни в периода
  const wds = await workdays(supabase, sub.date_from, sub.date_to)
  const days = wds.map(wd => ({
    date: wd.iso.split('-').reverse().join('.'),
    items: bySlot.filter(s => s.day === wd.dow).map(s => ({ period: s.period, subject: s.subject, cls: s.cls })),
  }))

  // 4. Номер от общия брояч (max seq +1 за деловодната година)
  const { data: maxRow } = await supabase
    .from('orders').select('seq').order('seq', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
  const nextSeq = ((maxRow?.seq as number) || 0) + 1
  const orderDate = new Date().toISOString().split('T')[0]
  const orderNumber = `${String(nextSeq).padStart(3, '0')}/${orderDate.split('-').reverse().join('.')}г.`

  const absentName = sub.absent ? `${(sub.absent as any).first_name} ${(sub.absent as any).last_name}` : ''
  const subName = sub.sub ? `${(sub.sub as any).first_name} ${(sub.sub as any).last_name}` : ''

    // 5. Създаваме заповедта в orders (РД-08) — само ако е избрано „Регистрирай"
  if (register) {
    const { data: order, error: oErr } = await supabase.from('orders').insert({
      number: orderNumber, date: orderDate,
      title: `Заповед за заместване на ${absentName}`,
      nomenclature_item: 'РД-08',
      description: `Заместник: ${subName}, период ${sub.date_from.split('-').reverse().join('.')}–${sub.date_to.split('-').reverse().join('.')}`,
      created_by: me?.id || null, seq: nextSeq,
    }).select('id').single()
    if (oErr) return { error: 'Грешка при създаване на заповедта: ' + oErr.message }
    // 6. Връзваме заповедта към заместването
    await supabase.from('substitutions').update({ substitution_order_id: order.id }).eq('id', substitutionId)
  }

    // Няколко заместника (ако има разпределение)
  const { data: assigns } = await supabase
    .from('substitution_assignments')
    .select('date_from, date_to, over_norm, sub:staff_profiles!substitution_assignments_substitute_staff_id_fkey(first_name, last_name, position)')
    .eq('substitution_id', substitutionId).order('date_from')
  const substitutes = (assigns || []).map((a: any) => ({
    name: a.sub ? `${a.sub.first_name} ${a.sub.last_name}` : '',
    position: a.sub?.position || 'учител',
    from: a.date_from, to: a.date_to, overNorm: a.over_norm !== false,
  }))
  // ЗДУД за контрол
  const { data: zdud } = await supabase.from('staff_profiles').select('first_name, last_name').eq('role', 'zdud').eq('is_active', true).limit(1).maybeSingle()

  revalidatePath('/substitutions')

  // Данни за Word генератора (клиентът вика saveAs)
  return {
    success: true,
    data: {
      orderNumber, orderDate,
      absentName, substituteName: subName,
            substitutePosition: (sub.sub as any)?.position || 'учител',
      absentPosition: (sub.absent as any)?.position || 'учител',
      className: bySlot.length ? Array.from(new Set(bySlot.map(s => s.cls).filter(Boolean))).join(', ') : '—',
      holderType: bySlot.some(s => (s.cls || '').startsWith('ИФО')) && !bySlot.some(s => !(s.cls || '').startsWith('ИФО')) ? 'ifo' : 'class',
      reason: sub.reason || 'vacation',
      overNorm,
      leaveRef: sub.leave_order_number ? `Заповед за отпуск № ${sub.leave_order_number}` : (sub.reason === 'sick' ? 'Болничен лист' : 'заявление'),
      dateFrom: sub.date_from, dateTo: sub.date_to,
      zdudName: zdud ? `${zdud.first_name} ${zdud.last_name}` : '',
            yearName: cy?.name || '',
      isBsch: sub.bsch_eligible === true,
      days,
      substitutes,
    },
  }
}
// ── Данни за ДЕКЛАРАЦИЯ на заместника (НП Приложение 2 или вътрешна) ──
export async function getDeclarationData(substitutionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id').eq('user_id', user.id).single()

  const { data: sub } = await supabase
    .from('substitutions')
    .select(`id, absent_staff_id, substitute_staff_id, date_from, date_to, bsch_eligible, substitution_order_id,
      absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name),
      sub:staff_profiles!substitutions_substitute_staff_id_fkey(first_name, last_name, position)`)
    .eq('id', substitutionId).single()
  if (!sub) return { error: 'Не е намерено' }

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  // заповедта за заместване (ако е издадена) — за orderRef
  let orderRef = 'Заповед № …'
  if (sub.substitution_order_id) {
    const { data: o } = await supabase.from('orders').select('number').eq('id', sub.substitution_order_id).single()
    if (o?.number) orderRef = `Заповед № ${o.number}`
  }

  // часовете на отсъстващия
  const { data: mySched } = await supabase
    .from('class_schedules').select('id, class:classes(name)')
    .eq('academic_year_id', cy?.id).eq('term', 1)
  const schedName: Record<string, string> = {}
  ;(mySched || []).forEach((s: any) => { schedName[s.id] = s.class?.name || '' })
  const schedIds = (mySched || []).map((s: any) => s.id)
  const bySlot: { day: number; period: number; subject: string; cls: string }[] = []
  if (schedIds.length > 0) {
    const { data: slots } = await supabase
      .from('schedule_slots').select('schedule_id, day, period, subject:subjects(name)')
      .in('schedule_id', schedIds).eq('staff_id', sub.absent_staff_id)
    ;(slots || []).forEach((sl: any) => bySlot.push({ day: sl.day, period: sl.period, subject: sl.subject?.name || '', cls: schedName[sl.schedule_id] || '' }))
  }
  const { data: ifo } = await supabase
    .from('teacher_ifo_slots').select('day, period, subject:subjects(name), student:students(first_name, last_name)')
    .eq('teacher_id', sub.absent_staff_id).eq('academic_year_id', cy?.id).eq('term', 1)
  ;(ifo || []).forEach((sl: any) => bySlot.push({ day: sl.day, period: sl.period, subject: sl.subject?.name || '', cls: sl.student ? `ИФО ${sl.student.first_name} ${sl.student.last_name}` : 'ИФО' }))

  // разгъваме по работни дни
  const out: { date: string; cls: string; subject: string; hours: number }[] = []
   const wds = await workdays(supabase, sub.date_from, sub.date_to)
  for (const w of wds) {
    const wd = w.dow
    const dayItems = bySlot.filter(s => s.day === wd)
    const dateStr = w.iso.split('-').reverse().join('.')
    if (dayItems.length > 0) {
      const byCls: Record<string, { subjects: string[]; hours: number }> = {}
      dayItems.forEach(it => {
        if (!byCls[it.cls]) byCls[it.cls] = { subjects: [], hours: 0 }
        if (it.subject && !byCls[it.cls].subjects.includes(it.subject)) byCls[it.cls].subjects.push(it.subject)
        byCls[it.cls].hours++
      })
      Object.entries(byCls).forEach(([cls, v]) => out.push({ date: dateStr, cls, subject: v.subjects.join('; '), hours: v.hours }))
    }
  }
  const totalHours = out.reduce((a, r) => a + r.hours, 0)

  const MONTHS = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември']
  const monthName = MONTHS[new Date(sub.date_from + 'T00:00').getMonth()]

  return {
    success: true,
    isBsch: sub.bsch_eligible === true,
    data: {
      substituteName: sub.sub ? `${(sub.sub as any).first_name} ${(sub.sub as any).last_name}` : '',
      substitutePosition: (sub.sub as any)?.position || 'учител',
      absentName: sub.absent ? `${(sub.absent as any).first_name} ${(sub.absent as any).last_name}` : '',
      orderRef, monthName,
      periodFrom: sub.date_from, periodTo: sub.date_to,
      yearName: cy?.name || '',
      rows: out, totalHours,
    },
  }
}
// ── Няколко заместника (под-периоди) ──
export async function getAssignments(substitutionId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('substitution_assignments')
    .select('id, substitute_staff_id, date_from, date_to, over_norm')
    .eq('substitution_id', substitutionId).order('date_from')
  return { data: data || [] }
}

export async function saveAssignments(substitutionId: string, rows: { substitute_staff_id: string; date_from: string; date_to: string; over_norm: boolean }[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  // трием старите и вписваме новите
  await supabase.from('substitution_assignments').delete().eq('substitution_id', substitutionId)
  if (rows.length > 0) {
    const { error } = await supabase.from('substitution_assignments').insert(
      rows.map(r => ({ substitution_id: substitutionId, ...r }))
    )
    if (error) return { error: error.message }
  }
  revalidatePath('/substitutions')
  return { success: true }
}
// ── МЕСЕЧНА обобщена декларация за ЗАМЕСТВАНЕ (всички замествания на заместника за месеца) ──
export async function getMonthlyDeclaration(first: string, last: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, first_name, last_name, position').eq('user_id', user.id).single()
  if (!me) return { error: 'Профил не е намерен' }

    // first/last идват като параметри (период от–до)

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  // всички мои замествания, застъпващи месеца
  const { data: subs } = await supabase
    .from('substitutions')
    .select(`id, absent_staff_id, date_from, date_to, bsch_eligible, kt_article, substitution_order_id, manual_order_number,
      absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name)`)
    .eq('substitute_staff_id', me.id)
    .lte('date_from', last).gte('date_to', first)
  if (!subs || subs.length === 0) return { error: 'Няма замествания за този месец' }

  // разписания за учебната година (за часовете)
  const { data: mySched } = await supabase
    .from('class_schedules').select('id, class:classes(name)')
    .eq('academic_year_id', cy?.id).eq('term', 1)
  const schedName: Record<string, string> = {}
  ;(mySched || []).forEach((s: any) => { schedName[s.id] = s.class?.name || '' })
  const schedIds = (mySched || []).map((s: any) => s.id)

  const rows: { date: string; orderRef: string; cls: string; subject: string; hours: number; bsch: boolean; kt: string; absentName: string }[] = []

  for (const sub of subs) {
    // orderRef
    let orderRef = '—'
    if (sub.substitution_order_id) {
      const { data: o } = await supabase.from('orders').select('number').eq('id', sub.substitution_order_id).single()
      if (o?.number) orderRef = o.number
    } else if (sub.manual_order_number) {
      orderRef = sub.manual_order_number
    }
    // часовете на отсъстващия
    const bySlot: { day: number; period: number; subject: string; cls: string }[] = []
    if (schedIds.length > 0) {
      const { data: slots } = await supabase
        .from('schedule_slots').select('schedule_id, day, period, subject:subjects(name)')
        .in('schedule_id', schedIds).eq('staff_id', sub.absent_staff_id)
      ;(slots || []).forEach((sl: any) => bySlot.push({ day: sl.day, period: sl.period, subject: sl.subject?.name || '', cls: schedName[sl.schedule_id] || '' }))
    }
    const { data: ifo } = await supabase
      .from('teacher_ifo_slots').select('day, period, subject:subjects(name), student:students(first_name, last_name)')
      .eq('teacher_id', sub.absent_staff_id).eq('academic_year_id', cy?.id).eq('term', 1)
    ;(ifo || []).forEach((sl: any) => bySlot.push({ day: sl.day, period: sl.period, subject: sl.subject?.name || '', cls: sl.student ? `ИФО ${sl.student.first_name} ${sl.student.last_name}` : 'ИФО' }))

    // само учебните дни в ПРЕСЕЧЕНИЕТО на заместването и месеца
    const lo = sub.date_from > first ? sub.date_from : first
    const hi = sub.date_to < last ? sub.date_to : last
    const wds = await workdays(supabase, lo, hi)
    for (const w of wds) {
      const dayItems = bySlot.filter(s => s.day === w.dow)
      if (dayItems.length === 0) continue
      const dateStr = w.iso.split('-').reverse().join('.')
      const byCls: Record<string, { subjects: string[]; hours: number }> = {}
      dayItems.forEach(it => {
        if (!byCls[it.cls]) byCls[it.cls] = { subjects: [], hours: 0 }
        if (it.subject && !byCls[it.cls].subjects.includes(it.subject)) byCls[it.cls].subjects.push(it.subject)
        byCls[it.cls].hours++
      })
      Object.entries(byCls).forEach(([cls, v]) => rows.push({
        date: dateStr, orderRef, cls, subject: v.subjects.join('; '), hours: v.hours,
               bsch: sub.bsch_eligible === true, kt: sub.kt_article || '',
        absentName: sub.absent ? `${(sub.absent as any).first_name} ${(sub.absent as any).last_name}` : '',
      }))
    }
  }

  rows.sort((a, b) => {
    const [da, ma] = a.date.split('.'), [db, mb] = b.date.split('.')
    return (ma + da).localeCompare(mb + db)
  })
  const totalHours = rows.reduce((a, r) => a + r.hours, 0)
  const npHours = rows.filter(r => r.bsch).reduce((a, r) => a + r.hours, 0)
  const budgetHours = totalHours - npHours

  const MONTHS = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември']
  return {
    success: true,
    data: {
      substituteName: `${me.first_name} ${me.last_name}`,
      substitutePosition: me.position || 'учител',
      monthName: `периода ${first.split('-').reverse().join('.')} – ${last.split('-').reverse().join('.')}`, year: new Date(first).getFullYear(), yearName: cy?.name || '',
      rows, totalHours, npHours, budgetHours,
    },
  }
}
// ── МОН ОТЧЕТ (НП „Без свободен час") — всички НП замествания за период, редове за импорт ──
export async function getMonExport(first: string, last: string, rate: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  // всички НП замествания, застъпващи периода
  const { data: subs } = await supabase
    .from('substitutions')
    .select(`id, absent_staff_id, substitute_staff_id, date_from, date_to, kt_article, substitution_order_id, manual_order_number, manual_order_date, bsch_eligible,
      sub:staff_profiles!substitutions_substitute_staff_id_fkey(first_name, last_name, position)`)
    .eq('bsch_eligible', true)
    .lte('date_from', last).gte('date_to', first)
  if (!subs || subs.length === 0) return { error: 'Няма НП замествания за този период' }

  // разписания (за часовете)
  const { data: mySched } = await supabase
    .from('class_schedules').select('id').eq('academic_year_id', cy?.id).eq('term', 1)
  const schedIds = (mySched || []).map((s: any) => s.id)

  // за всяко заместване — брой учебни часове в пресечението с периода
  const rows: any[] = []
  for (const sub of subs) {
    let orderNumber = '', orderDate = ''
    if (sub.substitution_order_id) {
      const { data: o } = await supabase.from('orders').select('number, date').eq('id', sub.substitution_order_id).single()
      if (o) { orderNumber = o.number || ''; orderDate = o.date || '' }
    } else if (sub.manual_order_number) {
      orderNumber = sub.manual_order_number; orderDate = sub.manual_order_date || ''
    }
    // часовете на отсъстващия по ден
    const bySlotDow: Record<number, number> = {}
    if (schedIds.length > 0) {
      const { data: slots } = await supabase.from('schedule_slots').select('day').in('schedule_id', schedIds).eq('staff_id', sub.absent_staff_id)
      ;(slots || []).forEach((sl: any) => { bySlotDow[sl.day] = (bySlotDow[sl.day] || 0) + 1 })
    }
    const { data: ifo } = await supabase.from('teacher_ifo_slots').select('day').eq('teacher_id', sub.absent_staff_id).eq('academic_year_id', cy?.id).eq('term', 1)
    ;(ifo || []).forEach((sl: any) => { bySlotDow[sl.day] = (bySlotDow[sl.day] || 0) + 1 })
    // учебни дни в пресечението
    const lo = sub.date_from > first ? sub.date_from : first
    const hi = sub.date_to < last ? sub.date_to : last
    const wds = await workdays(supabase, lo, hi)
    let hours = 0
    wds.forEach(w => { hours += (bySlotDow[w.dow] || 0) })
    if (hours === 0) continue
    const isNonSpec = /възпитател|помощник|психолог|логопед|рехабилитатор/i.test((sub.sub as any)?.position || '')
    rows.push({
      name: sub.sub ? `${(sub.sub as any).first_name} ${(sub.sub as any).last_name}` : '',
      docType: 'Заповед', docNumber: orderNumber, docDate: orderDate,
      hoursTaken: hours, nonSpecHoursTaken: isNonSpec ? hours : 0,
      kt: sub.kt_article || '155', amount: +(hours * rate).toFixed(2),
    })
  }
  if (rows.length === 0) return { error: 'Няма часове за отчет в този период' }
  return { success: true, data: { rows, yearName: cy?.name || '', first, last } }
}
