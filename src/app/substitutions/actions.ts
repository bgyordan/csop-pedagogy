'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Работни дни (пон-пет) между две дати, като { date: ISO, dow: 1..5 }
function workdays(from: string, to: string): { iso: string; dow: number }[] {
  const out: { iso: string; dow: number }[] = []
  const d = new Date(from + 'T00:00'), end = new Date(to + 'T00:00')
  while (d <= end) {
    const wd = d.getDay() // 0=нед..6=съб
    if (wd >= 1 && wd <= 5) out.push({ iso: d.toISOString().split('T')[0], dow: wd })
    d.setDate(d.getDate() + 1)
  }
  return out
}

// Генерира заповед за заместване: вади часовете на отсъстващия, създава РД-08 в orders,
// връща данните за Word генератора.
export async function generateSubstitution(substitutionId: string, overNorm: boolean = true) {
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
  const wds = workdays(sub.date_from, sub.date_to)
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

  // 5. Създаваме заповедта в orders (РД-08)
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
  const d = new Date(sub.date_from + 'T00:00'), end = new Date(sub.date_to + 'T00:00')
  while (d <= end) {
    const wd = d.getDay()
    if (wd >= 1 && wd <= 5) {
      const dayItems = bySlot.filter(s => s.day === wd)
      const dateStr = d.toISOString().split('T')[0].split('-').reverse().join('.')
      if (dayItems.length === 0) {
        // ден без часове — пропускаме в декларацията
      } else {
        // за декларацията групираме по паралелка: един ред на паралелка/ден с брой часове
                const byCls: Record<string, { subjects: string[]; hours: number }> = {}
        dayItems.forEach(it => {
          if (!byCls[it.cls]) byCls[it.cls] = { subjects: [], hours: 0 }
          if (it.subject && !byCls[it.cls].subjects.includes(it.subject)) byCls[it.cls].subjects.push(it.subject)
          byCls[it.cls].hours++
        })
        Object.entries(byCls).forEach(([cls, v]) => out.push({ date: dateStr, cls, subject: v.subjects.join('; '), hours: v.hours }))
      }
    }
    d.setDate(d.getDate() + 1)
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
