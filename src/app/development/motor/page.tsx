import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MOTOR_ROLES } from '@/lib/motor'
import GroupMotorClient from './GroupMotorClient'
export const dynamic = 'force-dynamic'

// „Двигателна оценка — групова карта“: учителят по ФВС (и терапевтите) оценява няколко деца наведнъж
// по едни и същи проби и условия. Записва се като отделна оценка на всяко дете (вижда се в досието → Развитие).
export default async function GroupMotorPage() {
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

  return <GroupMotorClient classes={list} meId={me.id} meName={`${me.first_name} ${me.last_name}`} yearId={year?.id || null} yearName={year?.name || ''} />
}
