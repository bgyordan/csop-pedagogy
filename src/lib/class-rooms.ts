// Стая на паралелката — общи правила (активна ли е, чии паралелки са „мои“).
// Без сървърни импорти: клиентът на Supabase се подава отвън, за да се ползва и от страници, и от табло.

import type { SupabaseClient } from '@supabase/supabase-js'
import { todaySofia } from './ores'

export type ClassRoomDates = { from_date: string; to_date: string; closed_at?: string | null }

// Активна = не е затворена ръчно, започнала е и още не е свършила (по софийско време)
export function isClassRoomActive(r: ClassRoomDates, today: string = todaySofia()) {
  return !r.closed_at && r.from_date <= today && r.to_date >= today
}

// Началото на днешния ден в София като ISO (за заявки „от днес“) — лятно/зимно часово време се отчита
export function sofiaDayStartISO(day: string = todaySofia()) {
  const probe = new Date(`${day}T12:00:00Z`)
  const hh = Number(probe.toLocaleString('en-GB', { timeZone: 'Europe/Sofia', hour: '2-digit', hour12: false }))
  return new Date(Date.parse(`${day}T00:00:00Z`) - (hh - 12) * 3600 * 1000).toISOString()
}

export const MANAGER_ROLES = ['admin', 'zdud', 'director']
export const isManagerRole = (role: string | null | undefined) => MANAGER_ROLES.includes(role || '')

// Етикетите на бързите отговори на родителя (същите като в личната стая)
export const MSG_LABEL: Record<string, string> = {
  ok: 'Разбрахме',
  unclear: 'Не разбирам — моля, обяснете',
  resend: 'Моля, изпратете материала отново',
  text: '',
}

// Паралелките, с които колегата работи: класен, часове по разписание, ИФО/терапия/ЕПЛР/ЦОУД на дете от паралелката.
// Управата вижда всички — за нея функцията не се вика.
export async function myClassIds(supabase: SupabaseClient, me: string, yearId: string): Promise<Set<string>> {
  const out = new Set<string>()
  const [{ data: ct }, { data: scheds }, { data: ifo }, { data: eplr }, { data: coud }, { data: ther }] = await Promise.all([
    supabase.from('class_teacher_assignments').select('class_id').eq('staff_id', me).eq('academic_year_id', yearId),
    supabase.from('class_schedules').select('id, class_id').eq('academic_year_id', yearId),
    supabase.from('teacher_ifo_slots').select('student_id').eq('teacher_id', me).eq('academic_year_id', yearId),
    supabase.from('eplr_teams').select('student_id').eq('academic_year_id', yearId)
      .or(`psychologist_id.eq.${me},speech_therapist_id.eq.${me},rehabilitator_id.eq.${me},class_teacher_id.eq.${me}`),
    supabase.from('coud_enrollments').select('student_id, coud_group:coud_groups(teacher_id)').eq('academic_year_id', yearId),
    supabase.from('students').select('id').eq('status', 'active')
      .or(`therapist_psychologist_id.eq.${me},therapist_speech_id.eq.${me},therapist_rehab_id.eq.${me},therapist_rehab2_id.eq.${me}`),
  ])
  ;(ct || []).forEach((r: any) => out.add(r.class_id))
  const schedClass: Record<string, string> = {}
  ;(scheds || []).forEach((s: any) => { schedClass[s.id] = s.class_id })
  const sids = Object.keys(schedClass)
  if (sids.length) {
    const { data: sl } = await supabase.from('schedule_slots').select('schedule_id').in('schedule_id', sids).eq('staff_id', me)
    ;(sl || []).forEach((r: any) => { if (schedClass[r.schedule_id]) out.add(schedClass[r.schedule_id]) })
  }
  const kids = new Set<string>([
    ...(ifo || []).map((r: any) => r.student_id),
    ...(eplr || []).map((r: any) => r.student_id),
    ...(coud || []).filter((r: any) => r.coud_group?.teacher_id === me).map((r: any) => r.student_id),
    ...(ther || []).map((r: any) => r.id),
  ])
  if (kids.size) {
    const { data: enr } = await supabase.from('student_enrollments').select('class_id')
      .eq('academic_year_id', yearId).in('student_id', Array.from(kids))
    ;(enr || []).forEach((e: any) => { if (e.class_id) out.add(e.class_id) })
  }
  return out
}

// Броене на родителите, видели публикацията: първото отваряне на линка СЛЕД публикуването
export function seenBy(postAt: string, targetMemberIds: string[], visitsByMember: Record<string, string[]>) {
  const t = Date.parse(postAt)
  return targetMemberIds.filter(m => (visitsByMember[m] || []).some(v => Date.parse(v) >= t))
}
