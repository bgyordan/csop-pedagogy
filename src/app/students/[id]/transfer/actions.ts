'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { findStudentFolder, ensureStudentFolder, shareWriter, unshareEmails, accountEmails } from '@/lib/google-drive'

// Преместване на ученик в друга паралелка — всичко наведнъж:
// 1) записването за годината; 2) класният в ЕПЛР екипа; 3) история (кога/откъде/накъде/кой);
// 4) Drive: папката на детето в новата паралелка, достъп за новия класен, махане на стария.
// Стъпки 3–4 не спират преместването, ако нещо не мине — връщат предупреждение.
export async function transferStudent(studentId: string, toClassId: string, movedOn: string, note: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me || !['admin', 'zdud'].includes(me.role)) return { error: 'Само админ/ЗДУД може да мести ученици' }
  if (!toClassId) return { error: 'Избери паралелка' }

  const { data: year } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()
  if (!year) return { error: 'Няма текуща учебна година' }
  const { data: student } = await supabase.from('students').select('first_name, last_name').eq('id', studentId).single()
  if (!student) return { error: 'Няма такъв ученик' }

  const { data: enr } = await supabase.from('student_enrollments')
    .select('class_id').eq('student_id', studentId).eq('academic_year_id', year.id).maybeSingle()
  const fromClassId: string | null = enr?.class_id || null
  if (fromClassId === toClassId) return { error: 'Ученикът вече е в тази паралелка' }

  // 1) записване
  const { error: eErr } = fromClassId
    ? await supabase.from('student_enrollments').update({ class_id: toClassId }).eq('student_id', studentId).eq('academic_year_id', year.id)
    : await supabase.from('student_enrollments').insert({ student_id: studentId, class_id: toClassId, academic_year_id: year.id })
  if (eErr) return { error: 'Грешка при записване: ' + eErr.message }

  const warnings: string[] = []
  const done: string[] = [fromClassId ? 'паралелката е сменена' : 'записан в паралелка']

  // класните на старата и новата паралелка
  const ids = [fromClassId, toClassId].filter(Boolean) as string[]
  const { data: cta } = await supabase.from('class_teacher_assignments')
    .select('class_id, staff:staff_profiles(id, email, first_name, last_name)').eq('academic_year_id', year.id).in('class_id', ids)
  const teacherOf = (cid: string | null) => (cta || []).find((a: any) => a.class_id === cid)?.staff as any || null
  const oldT = teacherOf(fromClassId), newT = teacherOf(toClassId)
  const { data: toClass } = await supabase.from('classes').select('name').eq('id', toClassId).single()

  // 2) ЕПЛР екип: класният следва паралелката (както при назначаване на класен)
  const { data: team } = await supabase.from('eplr_teams')
    .select('id, class_teacher_id, psychologist_id, speech_therapist_id, rehabilitator_id')
    .eq('student_id', studentId).eq('academic_year_id', year.id).maybeSingle()
  if (team && team.class_teacher_id !== (newT?.id || null)) {
    const { error } = await supabase.from('eplr_teams').update({ class_teacher_id: newT?.id || null }).eq('id', team.id)
    if (error) warnings.push('ЕПЛР екипът не е обновен: ' + error.message)
    else done.push(newT ? `класен в ЕПЛР екипа: ${newT.first_name} ${newT.last_name}` : 'ЕПЛР екип: новата паралелка няма класен')
  }

  // 3) история
  const { error: hErr } = await supabase.from('student_class_moves').insert({
    student_id: studentId, academic_year_id: year.id, from_class_id: fromClassId, to_class_id: toClassId,
    moved_on: movedOn || new Date().toISOString().slice(0, 10), note: note?.trim() || null, moved_by: me.id,
  })
  if (hErr) warnings.push('Историята не е записана (таблицата student_class_moves още не е създадена).')
  else done.push('записано в историята')

  // 4) Drive — само ако детето вече има папка за годината
  try {
    const existing = await findStudentFolder(studentId, year.name)
    if (existing) {
      const folderId = await ensureStudentFolder(studentId, `${student.first_name} ${student.last_name}`, year.name, toClass?.name || '')
      if (newT?.email) for (const e of accountEmails(newT.email)) { try { await shareWriter(folderId, e) } catch { /* няма такъв акаунт */ } }
      // старият класен губи достъп, освен ако е и в екипа по друга линия
      const stillInTeam = !!oldT && !!team && [team.psychologist_id, team.speech_therapist_id, team.rehabilitator_id].includes(oldT.id)
      if (oldT?.email && oldT.id !== newT?.id && !stillInTeam) await unshareEmails(folderId, accountEmails(oldT.email))
      done.push('Drive папката е преместена')
    }
  } catch (e: any) {
    warnings.push('Drive: ' + (e?.message || 'грешка') + ' — папката ще се премести при следващото отваряне на документите.')
  }

  revalidatePath(`/students/${studentId}`)
  return { success: true, done, warnings }
}

// Историята на преместванията на ученика (празно, ако таблицата още я няма)
export async function getClassMoves(studentId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('student_class_moves')
    .select('id, moved_on, note, from:classes!student_class_moves_from_class_id_fkey(name), to:classes!student_class_moves_to_class_id_fkey(name), by:staff_profiles(first_name, last_name)')
    .eq('student_id', studentId).order('moved_on', { ascending: false })
  if (error) return []
  return (data || []).map((m: any) => ({
    id: m.id, on: m.moved_on as string, note: m.note as string | null,
    from: m.from?.name || '—', to: m.to?.name || '—',
    by: m.by ? `${m.by.first_name} ${m.by.last_name}` : '',
  }))
}
