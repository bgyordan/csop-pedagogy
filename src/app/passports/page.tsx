// Паспорти за печат — на едно дете (?student=), на паралелка (?class=), на ЦОУД група (?coud=)
// или на всички деца, с които работи даден колега (?staff=) — за заместника, който влиза вместо него.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { IdCard } from 'lucide-react'
import PassportSheet from '../students/[id]/passport/PassportSheet'
import { PASSPORT_COLS, isFilled } from '../students/[id]/passport/lib'
import type { Passport } from '../students/[id]/passport/lib'
import PrintButton from './PrintButton'
export const dynamic = 'force-dynamic'

type Kid = { id: string; name: string; group: string }

export default async function PassportsPage({ searchParams }: { searchParams: Promise<{ student?: string; class?: string; coud?: string; staff?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
  const yearId = cy?.id

  // 1. Кои деца и в каква група
  const groupOf: Record<string, string> = {}          // student_id → етикет на групата
  const add = (id: string, group: string) => { if (id && !groupOf[id]) groupOf[id] = group }
  let title = 'Паспорти на децата'

  const classIds = new Set<string>()
  const coudIds = new Set<string>()
  if (sp.student) add(sp.student, '')
  if (sp.class) classIds.add(sp.class)
  if (sp.coud) coudIds.add(sp.coud)
  if (sp.staff) {
    const { data: st } = await supabase.from('staff_profiles').select('first_name, last_name').eq('id', sp.staff).maybeSingle()
    if (st) title = `Децата на ${st.first_name} ${st.last_name}`
    // паралелки: класен + всяка паралелка, в която има часове
    const [{ data: ct }, { data: scheds }, { data: ifo }, { data: cg }] = await Promise.all([
      supabase.from('class_teacher_assignments').select('class_id').eq('staff_id', sp.staff).eq('academic_year_id', yearId),
      supabase.from('class_schedules').select('id, class_id').eq('academic_year_id', yearId),
      supabase.from('teacher_ifo_slots').select('student_id').eq('teacher_id', sp.staff).eq('academic_year_id', yearId),
      supabase.from('coud_groups').select('id').eq('teacher_id', sp.staff).eq('academic_year_id', yearId),
    ])
    ;(ct || []).forEach((r: any) => r.class_id && classIds.add(r.class_id))
    const schedClass: Record<string, string> = {}
    ;(scheds || []).forEach((s: any) => { schedClass[s.id] = s.class_id })
    const sids = Object.keys(schedClass)
    if (sids.length) {
      const { data: sl } = await supabase.from('schedule_slots').select('schedule_id').in('schedule_id', sids).eq('staff_id', sp.staff)
      ;(sl || []).forEach((r: any) => schedClass[r.schedule_id] && classIds.add(schedClass[r.schedule_id]))
    }
    ;(ifo || []).forEach((r: any) => add(r.student_id, 'ИФО'))
    ;(cg || []).forEach((r: any) => coudIds.add(r.id))
  }

  if (classIds.size) {
    const { data: en } = await supabase.from('student_enrollments')
      .select('student_id, class:classes(name), student:students(status)')
      .in('class_id', Array.from(classIds)).eq('academic_year_id', yearId)
    ;(en || []).filter((e: any) => e.student?.status === 'active')
      .forEach((e: any) => add(e.student_id, `Паралелка ${e.class?.name || ''}`.trim()))
    if (sp.class && !sp.staff) title = `Паспорти — ${(en as any)?.[0]?.class?.name ? `паралелка ${(en as any)[0].class.name}` : 'паралелка'}`
  }
  if (coudIds.size) {
    const { data: ce } = await supabase.from('coud_enrollments')
      .select('student_id, coud_group:coud_groups(name), student:students(status)')
      .in('coud_group_id', Array.from(coudIds)).eq('academic_year_id', yearId)
    ;(ce || []).filter((e: any) => e.student?.status === 'active')
      .forEach((e: any) => add(e.student_id, /ЦОУД/i.test(e.coud_group?.name || '') ? e.coud_group.name : `ЦОУД ${e.coud_group?.name || ''}`.trim()))
  }

  const ids = Object.keys(groupOf)

  // 2. Имената, паралелката (за подзаглавието) и паспортите
  const [{ data: studs }, { data: pp }, { data: enr }] = ids.length ? await Promise.all([
    supabase.from('students').select('id, first_name, middle_name, last_name').in('id', ids),
    supabase.from('student_passports').select(PASSPORT_COLS).in('student_id', ids),
    supabase.from('student_enrollments').select('student_id, class:classes(name)').in('student_id', ids).eq('academic_year_id', yearId),
  ]) : [{ data: [] }, { data: [] }, { data: [] }] as any
  const clsOf: Record<string, string> = {}
  ;(enr || []).forEach((e: any) => { clsOf[e.student_id] = e.class?.name || '' })
  const pass: Record<string, Passport> = {}
  ;(pp || []).forEach((p: any) => { pass[p.student_id] = p as Passport })

  const kids: Kid[] = (studs || []).map((s: any) => ({
    id: s.id, name: `${s.first_name} ${s.last_name}`, group: groupOf[s.id] || (clsOf[s.id] ? `Паралелка ${clsOf[s.id]}` : ''),
  })).sort((a: Kid, b: Kid) => a.group.localeCompare(b.group, 'bg', { numeric: true }) || a.name.localeCompare(b.name, 'bg'))
  if (sp.student && kids[0] && !sp.class && !sp.staff && !sp.coud) title = `Паспорт — ${kids[0].name}`

  const withP = kids.filter(k => isFilled(pass[k.id]))
  const without = kids.filter(k => !isFilled(pass[k.id]))

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto print:p-0 print:max-w-none">
      <div className="print:hidden"><BackButton /></div>
      <header className="flex items-center gap-4 mt-2 mb-6 pb-5 border-b border-slate-100 print:hidden">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
          <IdCard size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">{title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{withP.length} попълнени{without.length ? ` · ${without.length} без паспорт` : ''} · всяко дете на отделна страница</p>
        </div>
        {withP.length > 0 && <PrintButton />}
      </header>

      {kids.length === 0 && <p className="text-sm text-slate-400">Няма деца за показване.</p>}

      <div className="space-y-6 print:space-y-0">
        {withP.map((k, i) => (
          <section key={k.id} className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 print:border-0 print:shadow-none print:rounded-none print:p-0 ${i > 0 ? 'print:break-before-page' : ''}`}>
            <PassportSheet passport={pass[k.id]} name={k.name} subtitle={[k.group, k.group.startsWith('Паралелка') || !clsOf[k.id] ? '' : `паралелка ${clsOf[k.id]}`].filter(Boolean).join(' · ')} />
            <p className="mt-4 text-[11px] text-slate-400">Паспорт на детето · ЦСОП Варна · поверително — само за служебно ползване</p>
          </section>
        ))}
      </div>

      {without.length > 0 && (
        <div className="mt-6 text-[13px] text-slate-500 print:hidden">
          Без попълнен паспорт: {without.map((k, i) => <span key={k.id}>{i > 0 && ', '}{k.name}</span>)}
        </div>
      )}
    </div>
  )
}
