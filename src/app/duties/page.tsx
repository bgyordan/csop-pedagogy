import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { ROLE_LABELS } from '@/types'
import { getFullName } from '@/lib/utils'
import DutyRosterClient from './DutyRosterClient'
export const dynamic = 'force-dynamic'

// Генерира седмиците (пон–пет) от 15.09 до 30.06 следващата година
function buildWeeks(startYear: number): { index: number; start: string; end: string; label: string }[] {
  const iso = (d: Date) => d.toISOString().split('T')[0]
  const start = new Date(startYear, 8, 15) // 15 септември (месец 8 = септември)
  const end = new Date(startYear + 1, 5, 30) // 30 юни
  const weeks: { index: number; start: string; end: string; label: string }[] = []
  let cur = new Date(start)
  let idx = 1
  while (cur <= end) {
    const dow = (cur.getDay() + 6) % 7 // 0=пон ... 6=нед
    if (dow > 4) { // събота/неделя → следващ понеделник
      cur.setDate(cur.getDate() + (7 - dow))
      continue
    }
    const weekEnd = new Date(cur)
    weekEnd.setDate(weekEnd.getDate() + (4 - dow)) // до петък
    const realEnd = weekEnd > end ? end : weekEnd
    const s = new Date(cur), e = new Date(realEnd)
    const label = `${String(s.getDate()).padStart(2, '0')}.${String(s.getMonth() + 1).padStart(2, '0')} – ${String(e.getDate()).padStart(2, '0')}.${String(e.getMonth() + 1).padStart(2, '0')}.${e.getFullYear()}`
    weeks.push({ index: idx++, start: iso(s), end: iso(realEnd), label })
    cur = new Date(realEnd)
    cur.setDate(cur.getDate() + (7 - ((realEnd.getDay() + 6) % 7))) // следващ понеделник
  }
  return weeks
}

export default async function DutyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles').select('role').eq('user_id', user.id).single()
  const canManage = ['admin', 'zdud', 'secretary'].includes(profile?.role || '')
  if (!['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')) redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('academic_years').select('id, name').eq('is_current', true).single()

  // Начална година за седмиците — от името "2026/2027" вземаме 2026
  let startYear = new Date().getFullYear()
  if (currentYear?.name) {
    const parsed = parseInt(currentYear.name.split('/')[0])
    if (!isNaN(parsed)) startYear = parsed
  }
  const weeks = buildWeeks(startYear)

  // Служители (активни)
  const { data: staffRaw } = await supabase
    .from('staff_profiles')
    .select('id, first_name, middle_name, last_name, role, position')
    .eq('is_active', true)
    .order('first_name')

  // Класни ръководители (паралелка)
  const { data: assignments } = await supabase
    .from('class_teacher_assignments')
    .select('staff_id, class:classes(name)')
    .eq('academic_year_id', currentYear?.id)
  const classByStaff: Record<string, string> = {}
  ;(assignments || []).forEach((a: any) => {
    if (a.class?.name) classByStaff[a.staff_id] = a.class.name
  })

  // Изключваме роли без дежурство (деловодство/админ по избор — включваме всички без secretary/admin/director? -> питане)
  const EXCLUDE_ROLES = ['secretary']
  const staff = (staffRaw || [])
    .filter((s: any) => !EXCLUDE_ROLES.includes(s.role))
    .map((s: any) => ({
      id: s.id,
      name: getFullName(s),
      role: s.role,
      roleLabel: s.position || ROLE_LABELS[s.role as keyof typeof ROLE_LABELS] || s.role,
      className: classByStaff[s.id] || null,
    }))

  // Дежурства за годината
  const { data: duties } = await supabase
    .from('duty_slots')
    .select('id, staff_id, start_date, end_date')
    .eq('academic_year_id', currentYear?.id)

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}>
          <CalendarDays size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Дежурства</h1>
          <p className="text-slate-500 text-sm mt-0.5">{currentYear?.name} · {weeks.length} седмици</p>
        </div>
      </div>
      <DutyRosterClient
        staff={staff}
        duties={duties || []}
        weeks={weeks}
        canManage={canManage}
        academicYearId={currentYear?.id || ''}
        yearName={currentYear?.name}
      />
    </div>
  )
}
