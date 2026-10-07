import { canBeSubstituted } from '@/lib/pedagogues'
import { teachingStaffIds } from '@/lib/teaching-staff'

// Кой отсъства ДНЕС и кой го замества — общо за картата на управата (OpsPanel)
// и за лентата „Днес отсъстват“ при всички останали колеги.
// Източник: регистърът „Замествания“ (substitutions + substitution_assignments).
// Специалистите (логопед, психолог, рехабилитатор) и др. не се заместват —
// те пак се показват, за да знаят колегите, че не са на работа.

export type TodayAbsence = {
  id: string
  absent: string          // „Мария Иванова“
  position: string        // длъжност (за неподлежащите на заместване)
  substitutable: boolean  // учител / възпитател или с часове (разписание / ИЧ / учебен план)
  by: string              // заместник(ци) за днес, „“ ако няма
  np: boolean
  to: string              // ISO — до кога отсъства
}

const full = (p: any) => (p ? `${p.first_name} ${p.last_name}` : '')

export function sofiaToday() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Sofia' }))
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export async function getTodayAbsences(supabase: any): Promise<TodayAbsence[]> {
  const today = sofiaToday()
  const [{ data: subs }, { data: assigns }, teaching] = await Promise.all([
    supabase.from('substitutions')
      .select('id, date_to, bsch_eligible, absent_staff_id, absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name, role, position), sub:staff_profiles!substitutions_substitute_staff_id_fkey(first_name, last_name)')
      .lte('date_from', today).gte('date_to', today),
    supabase.from('substitution_assignments')
      .select('substitution_id, sub:staff_profiles!substitution_assignments_substitute_staff_id_fkey(first_name, last_name)')
      .lte('date_from', today).gte('date_to', today),
    teachingStaffIds(supabase),
  ])
  const extra: Record<string, string[]> = {}
  ;(assigns || []).forEach((a: any) => { (extra[a.substitution_id] ||= []).push(full(a.sub)) })
  return (subs || [])
    .filter((s: any) => s.absent)
    .map((s: any) => ({
      id: s.id,
      absent: full(s.absent),
      position: s.absent?.position || '',
      substitutable: canBeSubstituted({ role: s.absent?.role, teaching: teaching.has(s.absent_staff_id) }),
      by: extra[s.id]?.length ? extra[s.id].join(', ') : full(s.sub),
      np: !!s.bsch_eligible,
      to: s.date_to,
    }))
    .sort((a: TodayAbsence, b: TodayAbsence) => a.absent.localeCompare(b.absent, 'bg'))
}

// „Чакат заместник“ — само учители/възпитатели без заместник (специалистите не се заместват)
export async function countWaiting(supabase: any): Promise<number> {
  const [{ data }, teaching] = await Promise.all([
    supabase.from('substitutions')
      .select('id, absent_staff_id, absent:staff_profiles!substitutions_absent_staff_id_fkey(role)')
      .is('substitute_staff_id', null).gte('date_to', sofiaToday()),
    teachingStaffIds(supabase),
  ])
  return (data || []).filter((s: any) => canBeSubstituted({ role: s.absent?.role, teaching: teaching.has(s.absent_staff_id) })).length
}

// В дълъг отпуск, с дата на завръщане до 7 дни напред (или вече минала) → напомняне да се активира.
// Ако миграцията 2026-09-29_staff_status.sql още не е пусната — връща празно.
export async function getReturningSoon(supabase: any): Promise<{ id: string; name: string; until: string; overdue: boolean }[]> {
  const today = sofiaToday()
  const d = new Date(today + 'T00:00'); d.setDate(d.getDate() + 7)
  const week = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const { data, error } = await supabase.from('staff_profiles')
    .select('id, first_name, last_name, inactive_until')
    .eq('is_active', false).eq('inactive_reason', 'long_leave').lte('inactive_until', week)
    .order('inactive_until')
  if (error) return []
  return (data || []).map((p: any) => ({ id: p.id, name: full(p), until: p.inactive_until, overdue: p.inactive_until < today }))
}
