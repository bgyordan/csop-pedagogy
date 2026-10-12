import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { ROLE_LABELS } from '@/types'
import { getFullName } from '@/lib/utils'
import { buildDutyWeeks } from '@/lib/duty-weeks'
import DutyRosterClient, { type DutyStaff } from './DutyRosterClient'
export const dynamic = 'force-dynamic'

// В графика по подразбиране (без изричен избор в duty_pool)
const DEFAULT_ROLES = ['teacher', 'class_teacher', 'speech_therapist']

export default async function DutyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')) redirect('/dashboard')
  const canManage = ['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')

  const { data: currentYear } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()
  const yearId = currentYear?.id || ''

  // учебните дни → седмиците (ваканциите и празниците отпадат сами)
  const { data: cal } = await supabase.from('academic_calendar_days').select('date').eq('academic_year_id', yearId).eq('is_school_day', true).order('date')
  const weeks = buildDutyWeeks((cal || []).map((c: any) => c.date))

  const [{ data: staffRaw }, { data: assignments }, { data: duties }, poolRes] = await Promise.all([
    supabase.from('staff_profiles').select('id, first_name, middle_name, last_name, role, position').eq('is_active', true).order('first_name'),
    supabase.from('class_teacher_assignments').select('staff_id, class:classes(name)').eq('academic_year_id', yearId),
    supabase.from('duty_slots').select('id, staff_id, start_date, end_date').eq('academic_year_id', yearId),
    supabase.from('duty_pool').select('staff_id, included').eq('academic_year_id', yearId),
  ])
  const needSql = !!poolRes.error
  const pool: Record<string, boolean> = {}
  ;(poolRes.data || []).forEach((p: any) => { pool[p.staff_id] = !!p.included })
  const classByStaff: Record<string, string> = {}
  ;(assignments || []).forEach((a: any) => { if (a.class?.name) classByStaff[a.staff_id] = a.class.name })

  // отсъствия (отпуск/болничен) в годината — за „в отпуск“ при избора
  const first = weeks[0]?.start, last = weeks[weeks.length - 1]?.end
  const { data: abs } = first && last
    ? await supabase.from('substitutions').select('absent_staff_id, date_from, date_to').lte('date_from', last).gte('date_to', first)
    : { data: [] as any[] }
  const absences: Record<string, { from: string; to: string }[]> = {}
  ;(abs || []).forEach((a: any) => { if (a.absent_staff_id) (absences[a.absent_staff_id] ||= []).push({ from: a.date_from, to: a.date_to }) })

  const hasDuty = new Set((duties || []).map((d: any) => d.staff_id))
  const staff: DutyStaff[] = (staffRaw || [])
    .filter((s: any) => s.role !== 'support')
    .map((s: any) => ({
      id: s.id,
      name: getFullName(s),
      role: s.role,
      label: classByStaff[s.id] ? `класен на ${classByStaff[s.id]}` : (s.position || ROLE_LABELS[s.role as keyof typeof ROLE_LABELS] || s.role),
      // в графика: изричен избор → иначе по роля; с вече дадено дежурство — също (да не „изчезва“)
      inPool: s.id in pool ? pool[s.id] : (DEFAULT_ROLES.includes(s.role) || hasDuty.has(s.id)),
      absences: absences[s.id] || [],
    }))

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex items-center justify-center shrink-0 w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
          <CalendarDays size={20} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Дежурства</h1>
          <p className="text-slate-500 text-sm mt-0.5">{currentYear?.name} · {weeks.length} учебни седмици</p>
        </div>
      </div>
      {needSql && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800">
          Пуснете SQL файла 2026-10-12_duty_pool.sql — дотогава „В графика“ не се запазва.
        </div>
      )}
      <DutyRosterClient staff={staff} duties={duties || []} weeks={weeks} canManage={canManage} academicYearId={yearId} yearName={currentYear?.name} />
    </div>
  )
}
