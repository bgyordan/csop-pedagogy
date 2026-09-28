'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isPedagogical } from '@/lib/pedagogues'
import { coudPeriod, periodsOverlap, PERIOD_LABEL, PERIOD_TIMES } from '@/lib/periods'

// Днешна дата по българско време (сървърът е в UTC — след полунощ даваше вчерашна дата)
function sofiaToday() {
  const n = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Sofia' }))
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

// Работни дни (пон-пет) между две дати, като { date: ISO, dow: 1..5, term: 1|2 }
async function workdays(supabase: any, from: string, to: string): Promise<{ iso: string; dow: number; term: number }[]> {
  const { data } = await supabase
    .from('academic_calendar_days')
    .select('date, day_of_week, term')
    .gte('date', from).lte('date', to).eq('is_school_day', true)
    .order('date')
  return (data || []).map((c: any) => ({ iso: c.date, dow: c.day_of_week, term: c.term === 2 ? 2 : 1 }))
}

// ЦОУД етикет за възпитател (по coud_groups.teacher_id)
// НП при болничен (чл. 162): финансират се само първите 2 работни дни от болничния
// (тези, които плаща работодателят). Връща множеството НП дни или null = всички дни са НП.
async function npDays(supabase: any, sub: { date_from: string; date_to: string; kt_article?: string | null; bsch_eligible?: boolean | null }): Promise<Set<string> | null> {
  if (sub.bsch_eligible !== true) return new Set()
  if (sub.kt_article !== '162') return null
  const all = await workdays(supabase, sub.date_from, sub.date_to)
  return new Set(all.slice(0, 2).map(w => w.iso))
}
// Разпределение „няколко заместника“: substitution_id -> [{ staffId, from, to }]
async function assignmentsBySub(supabase: any, subIds: string[]): Promise<Record<string, { staffId: string; from: string; to: string }[]>> {
  const out: Record<string, { staffId: string; from: string; to: string }[]> = {}
  if (subIds.length === 0) return out
  const { data } = await supabase.from('substitution_assignments')
    .select('substitution_id, substitute_staff_id, date_from, date_to').in('substitution_id', subIds)
  ;(data || []).forEach((a: any) => {
    if (!out[a.substitution_id]) out[a.substitution_id] = []
    out[a.substitution_id].push({ staffId: a.substitute_staff_id, from: a.date_from, to: a.date_to })
  })
  return out
}
// Кой заместник кои дни покрива в едно заместване: при разпределение — по периодите му,
// иначе основният заместник покрива целия период
function coverageOf(sub: { substitute_staff_id: string | null; date_from: string; date_to: string }, assigns?: { staffId: string; from: string; to: string }[]) {
  const m: Record<string, { from: string; to: string }[]> = {}
  if (assigns && assigns.length > 0) {
    assigns.forEach(a => { (m[a.staffId] = m[a.staffId] || []).push({ from: a.from, to: a.to }) })
  } else if (sub.substitute_staff_id) {
    m[sub.substitute_staff_id] = [{ from: sub.date_from, to: sub.date_to }]
  }
  return m
}
const inRanges = (iso: string, rs: { from: string; to: string }[]) => rs.some(r => iso >= r.from && iso <= r.to)

async function coudLabel(supabase: any, staffId: string): Promise<string> {
  const { data } = await supabase.from('coud_groups').select('name').eq('teacher_id', staffId).limit(1).maybeSingle()
  if (!data?.name) return 'ЦОУД група'
  // името вече може да съдържа „ЦОУД“ (напр. „ЦОУД №1“) — не го повтаряме
  return /ЦОУД/i.test(data.name) ? `група ${data.name}` : `група ЦОУД ${data.name}`
}
type Slot = { day: number; period: number; subject: string; cls: string }
// Всички часове на служител ПО СРОКОВЕ: паралелки (schedule_slots) + ИФО (teacher_ifo_slots)
// + ЦОУД (educator_slots). Ако за II срок още няма въведено разписание — ползва I срок.
async function slotsByTerm(supabase: any, staffId: string, yearId: string | undefined): Promise<Record<number, Slot[]>> {
  const out: Record<number, Slot[]> = { 1: [], 2: [] }
  const { data: scheds } = await supabase
    .from('class_schedules').select('id, term, class:classes(name)').eq('academic_year_id', yearId)
  const info: Record<string, { term: number; name: string }> = {}
  ;(scheds || []).forEach((s: any) => { info[s.id] = { term: s.term === 2 ? 2 : 1, name: s.class?.name || '' } })
  const ids = Object.keys(info)
  if (ids.length > 0) {
    const { data: slots } = await supabase
      .from('schedule_slots').select('schedule_id, day, period, subject:subjects(name)')
      .in('schedule_id', ids).eq('staff_id', staffId)
    ;(slots || []).forEach((sl: any) => {
      const i = info[sl.schedule_id]
      if (i) out[i.term].push({ day: sl.day, period: sl.period, subject: sl.subject?.name || '', cls: i.name })
    })
  }
  const { data: ifo } = await supabase
    .from('teacher_ifo_slots').select('day, period, term, subject:subjects(name), student:students(first_name, last_name)')
    .eq('teacher_id', staffId).eq('academic_year_id', yearId)
  ;(ifo || []).forEach((sl: any) => out[sl.term === 2 ? 2 : 1].push({
    day: sl.day, period: sl.period, subject: sl.subject?.name || '',
    cls: sl.student ? `ИФО ${sl.student.first_name} ${sl.student.last_name}` : 'ИФО',
  }))
  const { data: edu } = await supabase.from('educator_slots')
    .select('day, period, activity, term').eq('educator_id', staffId).eq('academic_year_id', yearId)
  if (edu && edu.length) {
    const label = await coudLabel(supabase, staffId)
    edu.forEach((sl: any) => out[sl.term === 2 ? 2 : 1].push({ day: sl.day, period: coudPeriod(sl.period), subject: sl.activity, cls: label }))
  }
  if (out[2].length === 0) out[2] = out[1]
  return out
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
    .select(`id, absent_staff_id, substitute_staff_id, date_from, date_to, reason, leave_order_number, leave_order_date, bsch_eligible, kt_article, substitution_order_id,
       absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name, position),
      sub:staff_profiles!substitutions_substitute_staff_id_fkey(first_name, last_name, position)`)
    .eq('id', substitutionId).single()
  if (!sub) return { error: 'Заместването не е намерено' }
  if (!sub.substitute_staff_id) return { error: 'Няма избран заместник' }

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  // 2. Часовете на отсъстващия — по срокове (денят в периода решава кое разписание важи)
  const byTerm = await slotsByTerm(supabase, sub.absent_staff_id, cy?.id)

  // Пазим избора лекторски/вътрешно — от него зависи дали часовете влизат в декларацията
  await supabase.from('substitutions').update({ over_norm: sub.bsch_eligible === true ? true : overNorm }).eq('id', substitutionId)

  // 3. Разгъваме по работни дни в периода
  const wds = await workdays(supabase, sub.date_from, sub.date_to)
  const days = wds.map(wd => ({
    date: wd.iso.split('-').reverse().join('.'),
    items: byTerm[wd.term].filter(s => s.day === wd.dow).map(s => ({ period: s.period, subject: s.subject, cls: s.cls })),
  }))
  // часовете, които реално попадат в периода (за паралелките в текста на заповедта)
  const usedTerms = Array.from(new Set(wds.map(w => w.term)))
  const bySlot: Slot[] = (usedTerms.length ? usedTerms : [1]).flatMap(t => byTerm[t])
  // НП при болничен (чл. 162): НП само за първите 2 работни дни, останалите — бюджет
  const npSplit = (sub.bsch_eligible === true && (sub as any).kt_article === '162' && wds.length > 2)
    ? { npFrom: wds[0].iso, npTo: wds[1].iso, budgetFrom: wds[2].iso, budgetTo: sub.date_to }
    : null

  const absentName = sub.absent ? `${(sub.absent as any).first_name} ${(sub.absent as any).last_name}` : ''
  const subName = sub.sub ? `${(sub.sub as any).first_name} ${(sub.sub as any).last_name}` : ''
  const totalHours = days.reduce((a, x) => a + x.items.length, 0)

  let orderNumber = '', orderDate = ''
  if (sub.substitution_order_id) {
    // Заповедта вече е издадена → само я изтегляме пак, със СЪЩИЯ номер и дата (нов номер не се взима)
    const { data: o } = await supabase.from('orders').select('number, date').eq('id', sub.substitution_order_id).single()
    orderNumber = o?.number || '…………'
    orderDate = o?.date || sofiaToday()
  } else {
    // Без часове заповедта излиза празна — най-често отсъстващият няма въведено разписание
    if (totalHours === 0) return { error: `${absentName || 'Отсъстващият'} няма часове в разписанието за тези дни. Първо се въвежда разписанието, иначе заповедта излиза без часове.` }

    // 4. Номер от общия брояч — max seq +1 САМО в текущата деловодна година (15.09–14.09)
    orderDate = sofiaToday()
    const _p = orderDate.split('-').map(Number)
    const _startYear = (_p[1] > 9 || (_p[1] === 9 && _p[2] >= 15)) ? _p[0] : _p[0] - 1
    const dStart = `${_startYear}-09-15`, dEnd = `${_startYear + 1}-09-14`
    const { data: maxRow } = await supabase
      .from('orders').select('seq').gte('date', dStart).lte('date', dEnd)
      .order('seq', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
    const nextSeq = ((maxRow?.seq as number) || 0) + 1
    orderNumber = `${String(nextSeq).padStart(3, '0')}/${orderDate.split('-').reverse().join('.')}г.`

    // 5. Създаваме заповедта в orders (РД-08)
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
  }

    // Няколко заместника (ако има разпределение)
  const { data: assigns } = await supabase
    .from('substitution_assignments')
    .select('date_from, date_to, over_norm, sub:staff_profiles!substitution_assignments_substitute_staff_id_fkey(first_name, last_name, position)')
    .eq('substitution_id', substitutionId).order('date_from')
  const substitutes = (assigns || []).map((a: any) => ({
    name: a.sub ? `${a.sub.first_name} ${a.sub.last_name}` : '',
    position: a.sub?.position || 'учител',
    // лекторски/вътрешно е избор за ЦЯЛОТО заместване (иначе т.1 и т.3 си противоречат)
    from: a.date_from, to: a.date_to, overNorm: sub.bsch_eligible === true ? true : overNorm,
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
      overNorm: sub.bsch_eligible === true ? true : overNorm,
      leaveRef: sub.leave_order_number ? `Заповед за отпуск № ${sub.leave_order_number}` : (sub.reason === 'sick' ? 'Болничен лист' : 'заявление'),
      dateFrom: sub.date_from, dateTo: sub.date_to,
      zdudName: zdud ? `${zdud.first_name} ${zdud.last_name}` : '',
            yearName: cy?.name || '',
      isBsch: sub.bsch_eligible === true,
      npSplit,
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

  // часовете на отсъстващия — по срокове
  const byTerm = await slotsByTerm(supabase, sub.absent_staff_id, cy?.id)

  // разгъваме по работни дни
  const out: { date: string; cls: string; subject: string; hours: number }[] = []
   const wds = await workdays(supabase, sub.date_from, sub.date_to)
  for (const w of wds) {
    const wd = w.dow
    const dayItems = byTerm[w.term].filter(s => s.day === wd)
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
  const { data: me } = await supabase.from('staff_profiles').select('id, first_name, middle_name, last_name, position').eq('user_id', user.id).single()
  if (!me) return { error: 'Профил не е намерен' }

    // first/last идват като параметри (период от–до)

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  // всички мои замествания, застъпващи месеца — като основен заместник ИЛИ в разпределение по дни
  const { data: myAs } = await supabase.from('substitution_assignments').select('substitution_id').eq('substitute_staff_id', me.id)
  const asIds = Array.from(new Set((myAs || []).map((a: any) => a.substitution_id)))
  let q = supabase
    .from('substitutions')
    .select(`id, absent_staff_id, substitute_staff_id, date_from, date_to, bsch_eligible, kt_article, over_norm, substitution_order_id, manual_order_number,
      absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name)`)
    .lte('date_from', last).gte('date_to', first)
  q = asIds.length > 0 ? q.or(`substitute_staff_id.eq.${me.id},id.in.(${asIds.join(',')})`) : q.eq('substitute_staff_id', me.id)
  const { data: subs } = await q
  if (!subs || subs.length === 0) return { error: 'Няма замествания за този месец' }
  const assignMap = await assignmentsBySub(supabase, subs.map((x: any) => x.id))


  const rows: { date: string; orderRef: string; cls: string; subject: string; hours: number; bsch: boolean; kt: string; absentName: string }[] = []

  for (const sub of subs) {
    // само моите дни в това заместване
    const myRanges = coverageOf(sub as any, assignMap[sub.id])[me.id] || []
    if (myRanges.length === 0) continue
    // orderRef
    let orderRef = '—'
    if (sub.substitution_order_id) {
      const { data: o } = await supabase.from('orders').select('number').eq('id', sub.substitution_order_id).single()
      if (o?.number) orderRef = o.number
    } else if (sub.manual_order_number) {
      orderRef = sub.manual_order_number
    }
    // часовете на отсъстващия — по срокове
    const byTerm = await slotsByTerm(supabase, sub.absent_staff_id, cy?.id)

    // само учебните дни в ПРЕСЕЧЕНИЕТО на заместването и месеца
    const lo = sub.date_from > first ? sub.date_from : first
    const hi = sub.date_to < last ? sub.date_to : last
    const wds = await workdays(supabase, lo, hi)
    const npSet = await npDays(supabase, sub)
    for (const w of wds) {
      if (!inRanges(w.iso, myRanges)) continue
      const isNp = npSet === null ? true : npSet.has(w.iso)
      // вътрешно заместване (в рамките на нормата) не се плаща → не влиза в бюджетната декларация
      if (!isNp && (sub as any).over_norm === false) continue
      const dayItems = byTerm[w.term].filter(s => s.day === w.dow)
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
               bsch: isNp, kt: sub.kt_article || '',
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
      substituteName: [me.first_name, (me as any).middle_name, me.last_name].filter(Boolean).join(' '),
      substitutePosition: me.position || 'учител',
      periodFrom: first, periodTo: last,
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
      sub:staff_profiles!substitutions_substitute_staff_id_fkey(first_name, last_name, position, role)`)
    .eq('bsch_eligible', true)
    .lte('date_from', last).gte('date_to', first)
  if (!subs || subs.length === 0) return { error: 'Няма НП замествания за този период' }

  // разпределения по дни + имената/длъжностите на всички заместници в тях
  const assignMap = await assignmentsBySub(supabase, subs.map((x: any) => x.id))
  const extraIds = Array.from(new Set(Object.values(assignMap).flat().map(a => a.staffId)))
  const people: Record<string, { name: string; position: string; role: string }> = {}
  ;(subs as any[]).forEach(x => { if (x.substitute_staff_id && x.sub) people[x.substitute_staff_id] = { name: `${x.sub.first_name} ${x.sub.last_name}`, position: x.sub.position || '', role: x.sub.role || '' } })
  if (extraIds.length > 0) {
    const { data: ppl } = await supabase.from('staff_profiles').select('id, first_name, last_name, position, role').in('id', extraIds)
    ;(ppl || []).forEach((p: any) => { people[p.id] = { name: `${p.first_name} ${p.last_name}`, position: p.position || '', role: p.role || '' } })
  }


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
    // часовете на отсъстващия по срок и ден
    const byTerm = await slotsByTerm(supabase, sub.absent_staff_id, cy?.id)
    const perDay = (term: number, dow: number) => byTerm[term].filter(x => x.day === dow).length
    // учебни дни в пресечението
    const lo = sub.date_from > first ? sub.date_from : first
    const hi = sub.date_to < last ? sub.date_to : last
    const wds = await workdays(supabase, lo, hi)
    const npSet = await npDays(supabase, sub)   // при чл. 162 — само първите 2 работни дни
    // по един ред за всеки заместник — само неговите дни
    const cov = coverageOf(sub as any, assignMap[sub.id])
    for (const [staffId, ranges] of Object.entries(cov)) {
      let hours = 0
      wds.forEach(w => { if ((npSet === null || npSet.has(w.iso)) && inRanges(w.iso, ranges)) hours += perDay(w.term, w.dow) })
      if (hours === 0) continue
      const person = people[staffId] || { name: '', position: '', role: '' }
      // непедагогически = не е педагогически специалист по ЗПУО (по роля)
      const isNonSpec = !isPedagogical(person.role)
      rows.push({
        name: person.name,
        // в портала номерът и датата са отделни полета → само номера („014“), без „/23.09.2026г.“
        docType: 'Заповед', docNumber: String(orderNumber).split('/')[0].trim(), docDate: orderDate,
        hoursTaken: hours, nonSpecHoursTaken: isNonSpec ? hours : 0,
        kt: sub.kt_article || '155', amount: +(hours * rate).toFixed(2),
      })
    }
  }
  if (rows.length === 0) return { error: 'Няма часове за отчет в този период' }
  return { success: true, data: { rows, yearName: cy?.name || '', first, last } }
}

// ── ЧАСОВЕ ПО ЗАМЕСТВАНЕ по служител за период (за месечния преглед) ──
// np = часове по НП; budget = платени от бюджета (без вътрешните „в рамките на нормата“)
export async function getSubstitutionHoursByStaff(first: string, last: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  const { data: subs } = await supabase
    .from('substitutions')
    .select('id, absent_staff_id, substitute_staff_id, date_from, date_to, bsch_eligible, kt_article, over_norm')
    .lte('date_from', last).gte('date_to', first)
  const out: Record<string, { np: number; budget: number }> = {}
  if (!subs || subs.length === 0) return { data: out }

  const assignMap = await assignmentsBySub(supabase, subs.map((x: any) => x.id))
  const slotCache: Record<string, Record<number, Slot[]>> = {}
  for (const sub of subs as any[]) {
    if (!slotCache[sub.absent_staff_id]) slotCache[sub.absent_staff_id] = await slotsByTerm(supabase, sub.absent_staff_id, cy?.id)
    const byTerm = slotCache[sub.absent_staff_id]
    const lo = sub.date_from > first ? sub.date_from : first
    const hi = sub.date_to < last ? sub.date_to : last
    const wds = await workdays(supabase, lo, hi)
    const npSet = await npDays(supabase, sub)
    const cov = coverageOf(sub, assignMap[sub.id])
    for (const [staffId, ranges] of Object.entries(cov)) {
      for (const w of wds) {
        if (!inRanges(w.iso, ranges)) continue
        const h = byTerm[w.term].filter(x => x.day === w.dow).length
        if (h === 0) continue
        const isNp = npSet === null ? true : npSet.has(w.iso)
        if (!isNp && sub.over_norm === false) continue   // вътрешно — не се плаща
        const o = (out[staffId] = out[staffId] || { np: 0, budget: 0 })
        if (isNp) o.np += h; else o.budget += h
      }
    }
  }
  return { data: out }
}

// ── ПРЕДУПРЕЖДЕНИЕ: заместникът има ли свой час, който се застъпва ПО ВРЕМЕ с часовете на отсъстващия ──
// parts = кой заместник кои дни покрива. Връща по един ред на конфликтен ден (първите 8).
export async function checkSubstituteOverlap(absentId: string, parts: { staffId: string; from: string; to: string }[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !absentId || parts.length === 0) return { conflicts: [] as string[], total: 0 }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
  const absent = await slotsByTerm(supabase, absentId, cy?.id)
  const cache: Record<string, Record<number, Slot[]>> = {}
  const { data: ppl } = await supabase.from('staff_profiles').select('id, first_name, last_name').in('id', parts.map(p => p.staffId))
  const nameOf: Record<string, string> = {}
  ;(ppl || []).forEach((p: any) => { nameOf[p.id] = `${p.first_name} ${p.last_name}` })
  const DOW = ['', 'пон', 'вт', 'ср', 'чет', 'пет']
  const out: string[] = []
  let total = 0
  for (const part of parts) {
    if (!cache[part.staffId]) cache[part.staffId] = await slotsByTerm(supabase, part.staffId, cy?.id)
    const own = cache[part.staffId]
    const wds = await workdays(supabase, part.from, part.to)
    for (const w of wds) {
      const a = absent[w.term].filter(s => s.day === w.dow)
      const b = own[w.term].filter(s => s.day === w.dow)
      const hit = a.flatMap(x => b.filter(y => periodsOverlap(x.period, y.period)).map(y => ({ x, y })))[0]
      if (!hit) continue
      total++
      if (out.length < 8) out.push(`${nameOf[part.staffId] || ''}, ${DOW[w.dow]} ${w.iso.split('-').reverse().slice(0, 2).join('.')}: неговият ${PERIOD_LABEL[hit.y.period]}${hit.y.period <= 7 ? '. час' : ''} (${PERIOD_TIMES[hit.y.period]}) ↔ ${PERIOD_LABEL[hit.x.period]}${hit.x.period <= 7 ? '. час' : ''} на отсъстващия (${PERIOD_TIMES[hit.x.period]})`)
    }
  }
  return { conflicts: out, total }
}
