// Стаята на една паралелка (за учителите). Публикациите, въпросите и посещенията се зареждат в клиента;
// тук: стаята, децата с личните им линкове и родителите (име, телефон), предметите от разписанието (подсказки)
// и правата — кой може да пише (всички педагогически), кой управлява линковете (класният и ръководството).

import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BackButton } from '@/components/ui/BackButton'
import { isClassRoomActive, isManagerRole, myClassIds } from '@/lib/class-rooms'
import { todaySofia } from '@/lib/ores'
import ClassRoomClient from './ClassRoomClient'
export const dynamic = 'force-dynamic'

export default async function ClassRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!profile || ['secretary', 'support'].includes(profile.role)) redirect('/dashboard')

  const { data: room } = await supabase.from('class_rooms')
    .select('id, class_id, academic_year_id, from_date, to_date, reason, closed_at, to_date_before_close, class:classes(name)').eq('id', id).maybeSingle()
  if (!room) notFound()
  const isManager = isManagerRole(profile.role)
  const yearId = (room as any).academic_year_id || ''
  if (!isManager) {
    const mine = await myClassIds(supabase, profile.id, yearId)
    if (!mine.has(room.class_id)) redirect('/rooms')
  }
  const { data: ct } = await supabase.from('class_teacher_assignments').select('staff_id').eq('class_id', room.class_id).eq('staff_id', profile.id).limit(1)
  const canManage = isManager || (ct || []).length > 0

  const { data: mem } = await supabase.from('class_room_members')
    .select('id, student_id, token, revoked_at, student:students(first_name, last_name, status)').eq('room_id', id)
  const studentIds = (mem || []).map((m: any) => m.student_id)
  const { data: guardians } = studentIds.length
    ? await supabase.from('student_guardians').select('student_id, full_name, relation, phone').in('student_id', studentIds)
    : { data: [] as any[] }
  const gBy: Record<string, any[]> = {}
  ;(guardians || []).forEach((g: any) => { (gBy[g.student_id] = gBy[g.student_id] || []).push({ name: g.full_name, relation: g.relation, phone: g.phone }) })
  const members = (mem || []).map((m: any) => ({
    id: m.id as string, studentId: m.student_id as string, token: m.token as string, revokedAt: m.revoked_at as string | null,
    firstName: m.student?.first_name || '', name: `${m.student?.first_name || ''} ${m.student?.last_name || ''}`.trim(),
    active: m.student?.status === 'active', guardians: gBy[m.student_id] || [],
  })).sort((a, b) => a.name.localeCompare(b.name, 'bg'))

  // деца, записани в паралелката след отварянето (за бутона „Добави новите деца“)
  let missing = 0
  if (canManage) {
    let q = supabase.from('student_enrollments').select('student_id, student:students(status)').eq('class_id', room.class_id)
    if (yearId) q = q.eq('academic_year_id', yearId)
    const { data: enr } = await q
    const have = new Set(studentIds)
    missing = (enr || []).filter((e: any) => e.student?.status === 'active' && !have.has(e.student_id)).length
  }

  // предметите от разписанието на паралелката — подсказки за полето „Предмет/дейност“
  const { data: scheds } = await supabase.from('class_schedules').select('id').eq('class_id', room.class_id).eq('academic_year_id', yearId)
  const subjects = new Set<string>()
  if ((scheds || []).length) {
    const { data: sl } = await supabase.from('schedule_slots').select('subject:subjects(name)').in('schedule_id', (scheds || []).map((s: any) => s.id))
    ;(sl || []).forEach((r: any) => { if (r.subject?.name) subjects.add(r.subject.name) })
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <BackButton />
      <ClassRoomClient
        room={{
          id: room.id, className: (room as any).class?.name || '—', from: room.from_date, to: room.to_date,
          reason: room.reason, closedAt: room.closed_at, toBeforeClose: (room as any).to_date_before_close || null,
        }}
        live={isClassRoomActive(room as any, todaySofia())}
        upcoming={!room.closed_at && room.from_date > todaySofia()}
        meId={profile.id} isManager={isManager} canManage={canManage}
        members={members} missing={missing}
        subjects={Array.from(subjects).sort((a, b) => a.localeCompare(b, 'bg'))}
      />
    </div>
  )
}
