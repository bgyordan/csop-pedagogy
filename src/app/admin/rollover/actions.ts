'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Вдига класа с 1: "4 а" -> "5 а", "12 а" -> "13 а"
function bumpClass(external: string | null): string | null {
  if (!external) return null
  const match = external.trim().match(/^(\d+)\s*(.*)$/)
  if (!match) return external
  const num = parseInt(match[1])
  const rest = match[2] || ''
  return `${num + 1}${rest ? ' ' + rest : ''}`
}

export async function runRollover(newYearName: string, startDate: string, endDate: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли в системата' }

  const { data: profile } = await supabase
    .from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud'].includes(profile?.role || '')) {
    return { error: 'Нямате права за тази операция' }
  }

  // Текуща година
  const { data: oldYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()
  if (!oldYear) return { error: 'Няма текуща учебна година' }

  // Проверка дали новата вече съществува
  let { data: newYear } = await supabase
    .from('academic_years').select('*').eq('name', newYearName).maybeSingle()

  if (newYear) {
    // Има ли вече записи в нея?
    const { count } = await supabase
      .from('student_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('academic_year_id', newYear.id)
    if ((count || 0) > 0) {
      return { error: `Учебна година ${newYearName} вече съдържа ${count} записа. Прехвърлянето е спряно, за да не се дублират данни.` }
    }
  } else {
    const { data: created, error: yearErr } = await supabase
      .from('academic_years')
      .insert({ name: newYearName, start_date: startDate, end_date: endDate, is_current: false })
      .select().single()
    if (yearErr) return { error: `Грешка при създаване на година: ${yearErr.message}` }
    newYear = created
  }

  const stats = { classes: 0, students: 0, teachers: 0, eplr: 0, coudGroups: 0, coudStudents: 0 }

  // ── 1. ПАРАЛЕЛКИ ──
  const { data: oldClasses } = await supabase
    .from('classes').select('*').eq('academic_year_id', oldYear.id)

  const classMap = new Map<string, string>() // стар id -> нов id
  for (const c of oldClasses || []) {
    const { data: nc } = await supabase
      .from('classes')
      .insert({ name: c.name, academic_year_id: newYear.id })
      .select().single()
    if (nc) { classMap.set(c.id, nc.id); stats.classes++ }
  }

  // ── 2. УЧЕНИЦИ (само активни) ──
  const { data: oldEnrollments } = await supabase
    .from('student_enrollments')
    .select('*, student:students(id, status, external_class)')
    .eq('academic_year_id', oldYear.id)

  for (const e of oldEnrollments || []) {
    const st = e.student as any
    if (!st || st.status !== 'active') continue
    const newClassId = classMap.get(e.class_id)
    if (!newClassId) continue

    const { error: enrErr } = await supabase.from('student_enrollments').insert({
      student_id: e.student_id,
      class_id: newClassId,
      academic_year_id: newYear.id,
      education_form: e.education_form || 'daily',
      confirmed: false,
    })
    if (!enrErr) {
      stats.students++
      // Вдигаме класа в изпращащото училище с 1
      const bumped = bumpClass(st.external_class)
      if (bumped && bumped !== st.external_class) {
        await supabase.from('students').update({ external_class: bumped }).eq('id', st.id)
      }
    }
  }

  // ── 3. КЛАСНИ РЪКОВОДИТЕЛИ ──
  const { data: oldAssignments } = await supabase
    .from('class_teacher_assignments').select('*').eq('academic_year_id', oldYear.id)

  for (const a of oldAssignments || []) {
    const newClassId = classMap.get(a.class_id)
    if (!newClassId) continue
    const { error } = await supabase.from('class_teacher_assignments').insert({
      staff_id: a.staff_id,
      class_id: newClassId,
      academic_year_id: newYear.id,
    })
    if (!error) stats.teachers++
  }

  // ── 4. ЕПЛР ЕКИПИ ──
  const { data: oldTeams } = await supabase
    .from('eplr_teams').select('*').eq('academic_year_id', oldYear.id)

  for (const t of oldTeams || []) {
    const { error } = await supabase.from('eplr_teams').insert({
      student_id: t.student_id,
      academic_year_id: newYear.id,
      psychologist_id: t.psychologist_id,
      speech_therapist_id: t.speech_therapist_id,
      rehabilitator_id: t.rehabilitator_id,
      class_teacher_id: t.class_teacher_id,
    })
    if (!error) stats.eplr++
  }

  // ── 5. ЦОУД ГРУПИ + СЪСТАВ ──
  const { data: oldCoudGroups } = await supabase
    .from('coud_groups').select('*').eq('academic_year_id', oldYear.id)

  const coudMap = new Map<string, string>()
  for (const g of oldCoudGroups || []) {
    const { data: ng } = await supabase.from('coud_groups').insert({
      name: g.name,
      teacher_id: g.teacher_id,
      academic_year_id: newYear.id,
    }).select().single()
    if (ng) { coudMap.set(g.id, ng.id); stats.coudGroups++ }
  }

  const { data: oldCoudEnroll } = await supabase
    .from('coud_enrollments')
    .select('*, student:students(status)')
    .eq('academic_year_id', oldYear.id)

  for (const ce of oldCoudEnroll || []) {
    const st = ce.student as any
    if (!st || st.status !== 'active') continue
    const newGroupId = coudMap.get(ce.coud_group_id)
    if (!newGroupId) continue
    const { error } = await supabase.from('coud_enrollments').insert({
      student_id: ce.student_id,
      coud_group_id: newGroupId,
      academic_year_id: newYear.id,
      confirmed: false,
    })
    if (!error) stats.coudStudents++
  }

  // ── 6. НОВАТА ГОДИНА СТАВА ТЕКУЩА ──
  await supabase.from('academic_years').update({ is_current: false }).eq('id', oldYear.id)
  await supabase.from('academic_years').update({ is_current: true }).eq('id', newYear.id)

  revalidatePath('/admin')
  revalidatePath('/dashboard')

  return { success: true, stats, newYearName }
}

export async function confirmEnrollment(enrollmentId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('student_enrollments').update({ confirmed: true }).eq('id', enrollmentId)
  if (error) return { error: error.message }
  revalidatePath('/admin/rollover')
  return { success: true }
}

export async function confirmAllEnrollments(yearId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('student_enrollments').update({ confirmed: true })
    .eq('academic_year_id', yearId).eq('confirmed', false)
  if (error) return { error: error.message }
  revalidatePath('/admin/rollover')
  return { success: true }
}

export async function archiveStudent(studentId: string, reason: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('students').update({
    status: 'archived',
    archive_reason: reason,
    archived_at: new Date().toISOString(),
  }).eq('id', studentId)
  if (error) return { error: error.message }
  revalidatePath('/admin/rollover')
  return { success: true }
}

export async function updateExternalClass(studentId: string, externalClass: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('students')
    .update({ external_class: externalClass }).eq('id', studentId)
  if (error) return { error: error.message }
  revalidatePath('/admin/rollover')
  return { success: true }
}
