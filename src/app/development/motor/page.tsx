import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MOTOR_ROLES } from '@/lib/motor'
import MotorHubClient from './MotorHubClient'
import type { HubKid } from './MotorHubClient'
export const dynamic = 'force-dynamic'

// „Двигателна оценка“ — една входна точка за учителя по ФВС и терапевтите:
// „По деца“ (индивидуална оценка на едно дете, без да се отваря досието) и „Групова карта“ (няколко деца наведнъж).
export default async function MotorHubPage({ searchParams }: { searchParams: Promise<{ mode?: string; c?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, first_name, last_name').eq('user_id', user.id).single()
  if (!me || !MOTOR_ROLES.includes(me.role)) redirect('/dashboard')

  const { data: year } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()
  const { data: enr } = await supabase.from('student_enrollments')
    .select('student:students(id, first_name, last_name, status), class:classes(id, name)')
    .eq('academic_year_id', year?.id)
  const classes: Record<string, { id: string; name: string; kids: { id: string; name: string }[] }> = {}
  ;(enr || []).forEach((e: any) => {
    if (!e.student || e.student.status !== 'active' || !e.class) return
    const c = (classes[e.class.id] ||= { id: e.class.id, name: e.class.name, kids: [] })
    c.kids.push({ id: e.student.id, name: `${e.student.first_name} ${e.student.last_name}` })
  })
  const list = Object.values(classes).sort((a, b) => a.name.localeCompare(b.name, 'bg', { numeric: true }))
  list.forEach(c => c.kids.sort((a, b) => a.name.localeCompare(b.name, 'bg')))

  // Състояние на двигателната оценка по деца + GMFCS от профила (за пробите в стоеж)
  const ids = list.flatMap(c => c.kids.map(k => k.id))
  const chunk = <T,>(a: T[], n = 300) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))
  const sess: any[] = [], prof: any[] = []
  let ready = true
  for (const part of chunk(ids)) {
    const [s, p] = await Promise.all([
      supabase.from('motor_sessions').select('student_id, academic_year_id, assessed_on, stage, created_at').in('student_id', part),
      supabase.from('dev_profiles').select('student_id, gmfcs').in('student_id', part),
    ])
    if (s.error) { ready = false; break }
    sess.push(...(s.data || [])); prof.push(...(p.data || []))
  }
  const gm = Object.fromEntries(prof.map(p => [p.student_id, p.gmfcs]))
  const kids: HubKid[] = list.flatMap(c => c.kids.map(k => {
    const mine = sess.filter(s => s.student_id === k.id).sort((a, b) => a.assessed_on.localeCompare(b.assessed_on) || a.created_at.localeCompare(b.created_at))
    const inYear = mine.filter(s => s.academic_year_id === year?.id)
    const last = mine[mine.length - 1]
    return {
      id: k.id, name: k.name, classId: c.id, className: c.name, gmfcs: gm[k.id] ?? null,
      last: last?.assessed_on || null, lastStage: last?.stage || null, count: inYear.length,
      stages: Array.from(new Set(inYear.map(s => s.stage))) as string[],
    }
  }))

  return <MotorHubClient classes={list} kids={kids} ready={ready} meId={me.id} meName={`${me.first_name} ${me.last_name}`} role={me.role}
    yearId={year?.id || null} yearName={year?.name || ''} initialMode={sp.mode === 'group' ? 'group' : 'kids'} initialClass={sp.c || ''} />
}
