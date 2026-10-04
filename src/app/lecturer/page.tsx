import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { GraduationCap } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import LecturerTabs from './LecturerTabs'
import { yearSchoolDays, getClassEnds } from './actions'
import { latestEnd } from './distribute'
import OrderButton from './OrderButton'
export const dynamic = 'force-dynamic'

export default async function LecturerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase
    .from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director'].includes(me?.role || '')) redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('academic_years').select('id, name').eq('is_current', true).single()

  // само учителите (класни + teacher) — възпитатели, терапевти и администрация имат лекторски по друга заповед
  const { data: staff } = await supabase
    .from('staff_profiles').select('id, first_name, last_name, position, role')
    .in('role', ['class_teacher', 'teacher']).eq('is_active', true)
  const teachers = (staff || []).map((s: any) => ({ id: s.id, name: getFullName(s), position: s.position || '', role: s.role as string }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'))

  // вече маркирани лекторски слотове (за списъка долу)
  const { data: existing } = await supabase
    .from('lecturer_slots')
    .select(`*, subject:subjects(name), staff:staff_profiles!lecturer_slots_staff_id_fkey(first_name, last_name)`)
    .eq('academic_year_id', currentYear?.id)
    .order('created_at', { ascending: false })
  const marked = (existing || []).map((r: any) => ({
    id: r.id, staffId: r.staff_id,
    staffName: r.staff ? `${r.staff.first_name} ${r.staff.last_name}` : '—',
    day: r.day, period: r.period, subject: r.subject?.name || '',
    holderLabel: r.holder_label || '', dateFrom: r.date_from, dateTo: r.date_to,
    orderNumber: r.order_number || '',
    term: r.term === 2 ? 2 : 1,
    manual: r.is_manual === true,
  }))

  // ── за бързата таблица: паралелките на всеки учител (от разписанието), числата и календара ──
  const [{ data: scheds }, { data: plans }, schoolDays, { ends, classEnd }] = await Promise.all([
    supabase.from('class_schedules').select('id, term, class:classes(name)').eq('academic_year_id', currentYear?.id),
    supabase.from('lecturer_plans').select('*').eq('academic_year_id', currentYear?.id),
    yearSchoolDays(),
    getClassEnds(currentYear?.id),
  ])
  const schedClass: Record<string, string> = {}, schedTerm: Record<string, number> = {}
  ;(scheds || []).forEach((x: any) => { schedClass[x.id] = x.class?.name || ''; schedTerm[x.id] = x.term === 2 ? 2 : 1 })
  // натоварване (I срок) — като брояча в „Моето разписание“: час = 1, с „вземане“ = 0,7, „Час на класа“ = 1;
  // една клетка ден·час се брои веднъж
  const weightOf = (sub: any) => (!sub?.allows_pullout ? 1 : String(sub?.name || '').toLowerCase().includes('час на класа') ? 1 : 0.7)
  const cells: Record<string, Record<string, number>> = {}
  const put = (staffId: string, day: number, period: number, sub: any) => {
    const k = `${day}-${period}`; (cells[staffId] ||= {})[k] = Math.max(cells[staffId][k] || 0, weightOf(sub))
  }
  const schedIds = Object.keys(schedClass)
  const classCells: Record<string, Set<string>> = {}   // разписание без ИФО, цели часове (за сравнение с УП)
  const classesOf: Record<string, Set<string>> = {}
  for (let i = 0; i < schedIds.length; i += 100) {
    const ids = schedIds.slice(i, i + 100)
    for (let from = 0; ; from += 1000) {
      const { data: sl } = await supabase.from('schedule_slots').select('staff_id, schedule_id, day, period, subject:subjects(name, allows_pullout)').in('schedule_id', ids).not('staff_id', 'is', null).range(from, from + 999)
      ;(sl || []).forEach((r: any) => {
        (classesOf[r.staff_id] ||= new Set()).add(schedClass[r.schedule_id])
        if (schedTerm[r.schedule_id] === 1) { put(r.staff_id, r.day, r.period, r.subject); (classCells[r.staff_id] ||= new Set()).add(`${r.day}-${r.period}`) }
      })
      if (!sl || sl.length < 1000) break
    }
  }
  const { data: ifo } = await supabase.from('teacher_ifo_slots').select('teacher_id, day, period, subject:subjects(name, allows_pullout)')
    .eq('academic_year_id', currentYear?.id).eq('term', 1)
  ;(ifo || []).forEach((r: any) => put(r.teacher_id, r.day, r.period, r.subject))
  const NORM: Record<string, number> = { class_teacher: 21, teacher: 21, educator: 30 }
  const r1 = (x: number) => Math.round(x * 10) / 10

  // ── учебен план (НЕИСПУО): УП, ИЧ, часове към норматива (терапии с норма 30 → 0,7) ──
  const { data: cur } = await supabase.from('curriculum_lines')
    .select('*').eq('academic_year_id', currentYear?.id).not('staff_id', 'is', null).range(0, 4999)
  type Up = { up1: number; up2: number; ich1: number; ich2: number; n1: number; n2: number; t1: number; t2: number; w1: number[]; w2: number[] }
  const upOf: Record<string, Up> = {}
  ;(cur || []).forEach((l: any) => {
    const u = (upOf[l.staff_id] ||= { up1: 0, up2: 0, ich1: 0, ich2: 0, n1: 0, n2: 0, t1: 0, t2: 0, w1: [], w2: [] })
    const h1 = Number(l.hours_t1 || 0), h2 = Number(l.hours_t2 || 0)
    if (l.individual) { u.ich1 += h1; u.ich2 += h2; return }   // ИЧ — по отделна заповед, не се смятат
    const k = 21 / (Number(l.subject_norm) || 21)
    u.up1 += h1; u.up2 += h2; u.n1 += h1 * k; u.n2 += h2 * k
    if (k < 1) { u.t1 += h1; u.t2 += h2 }   // часове по 0,7 (терапии)
    if (h1) u.w1.push(Number(l.weeks_t1 || 0)); if (h2) u.w2.push(Number(l.weeks_t2 || 0))
  })

  const planOf: Record<string, any> = {}
  ;(plans || []).forEach((p: any) => { planOf[p.staff_id] = p })
  const rows = teachers.map(t => {
    const cls = Array.from(classesOf[t.id] || []).filter(Boolean).sort((a, b) => a.localeCompare(b, 'bg', { numeric: true }))
    const p = planOf[t.id]
    const sched = r1(Object.values(cells[t.id] || {}).reduce((a, b) => a + b, 0))   // разписание, с 0,7
    // разписание без ИФО — редуцирано (0,7 за часовете с „вземане“) + колко са по 0,7
    const cc = Array.from(classCells[t.id] || []).map(k => cells[t.id]?.[k] ?? 1)
    const sr = r1(cc.reduce((a, b) => a + b, 0)), srT = cc.filter(x => x < 1).length
    const norm = NORM[t.role] || 21
    const u = upOf[t.id]
    // предложение: само от учебния план
    let suggest = 0, suggestTotal = 0, load = sched, source: 'plan' | 'schedule' = 'schedule'
    if (u) {
      source = 'plan'
      const o1 = Math.max(0, r1(u.n1 - norm)), o2 = Math.max(0, r1(u.n2 - norm))
      load = r1(u.n1)
      if (o1 === o2) suggest = o1
      else {
        // различно по срокове → годишен брой: I срок × седмиците му + II срок × седмиците му
        const W1 = u.w1.length ? Math.max(...u.w1) : 18, W2 = u.w2.length ? Math.max(...u.w2) : 18
        suggestTotal = Math.round(o1 * W1 + o2 * W2)
      }
    }   // без учебен план — няма предложение (учебният план е единственият източник)
    return {
      id: t.id, name: t.name, position: t.position,
      load, norm, suggest, suggestTotal, source,
      // и двете — редуцирани часове (терапиите по 0,7); в скоби — колко часа са по 0,7
      up1: u ? r1(u.n1) : null, up2: u ? r1(u.n2) : null, upT1: u ? r1(u.t1) : 0, upT2: u ? r1(u.t2) : 0,
      ich: u ? r1(u.ich1) : 0, sr, srT,
      load2: u ? r1(u.n2) : null,
      classes: cls.map(c => ({ name: c, end: classEnd[c] || '' })),
      total: p ? p.total_hours : null,
      perWeek: p?.per_week || null,
      distributedAt: p?.distributed_at || null,
    }
  })

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
          <GraduationCap size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Лекторски над норматива</h1>
          <p className="text-sm text-slate-500 mt-0.5">Определяне на часове над норматива и заповед</p>
        </div>
        <OrderButton />
      </header>
      <LecturerTabs
        academicYearId={currentYear?.id || ''}
        teachers={teachers.map(t => ({ id: t.id, name: t.name }))}
        marked={marked}
        schoolDates={schoolDays.map(d => d.date)}
        rows={rows}
        ends={ends}
        defaultEnd={latestEnd(ends)}
      />
    </div>
  )
}
