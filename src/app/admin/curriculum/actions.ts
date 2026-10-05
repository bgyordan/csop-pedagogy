'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ImportLine = {
  holder: string; subject: string; weeksT1: number; hoursT1: number; weeksT2: number; hoursT2: number
  total: number; students: number | null; teacher: string; individual: boolean; norm: number; mode?: string
  classId: string | null; coudId: string | null; staffId: string | null
}

/**
 * Заменя учебния план за текущата година с новия внос.
 * Пипа САМО curriculum_lines (и запомнените ръчни свързвания) — нищо друго в EIS.
 */
export async function importCurriculum(lines: ImportLine[], manual: { kind: 'staff' | 'class' | 'coud'; source: string; id: string }[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director'].includes(me?.role || '')) return { error: 'Нямате права' }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
  if (!cy) return { error: 'Няма текуща учебна година' }

  if (manual.length) {
    const { error } = await supabase.from('curriculum_name_map').upsert(
      manual.map(m => ({ kind: m.kind, source_name: m.source, target_id: m.id })), { onConflict: 'kind,source_name' })
    if (error) return { error: hint(error.message) }
  }

  const { error: delErr } = await supabase.from('curriculum_lines').delete().eq('academic_year_id', cy.id)
  if (delErr) return { error: hint(delErr.message) }
  const now = new Date().toISOString()
  const rows = lines.map(l => ({
    academic_year_id: cy.id, holder_label: l.holder, class_id: l.classId, coud_group_id: l.coudId,
    subject: l.subject, hours_t1: l.hoursT1, weeks_t1: l.weeksT1, hours_t2: l.hoursT2, weeks_t2: l.weeksT2,
    total_hours: l.total, students: l.students, individual: l.individual, subject_norm: l.norm, study_mode: l.mode || null, teacher_name: l.teacher || null, staff_id: l.staffId,
    imported_at: now, imported_by: me!.id,
  }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('curriculum_lines').insert(rows.slice(i, i + 500))
    if (error) return { error: hint(error.message) }
  }
  revalidatePath('/admin/curriculum')
  return { success: true, count: rows.length }
}

const hint = (m: string) => m.includes('study_mode') ? 'Пуснете SQL файла 2026-10-05_curriculum_study_mode.sql'
  : m.includes('subject_norm') ? 'Пуснете SQL файла 2026-10-04_curriculum_norm.sql'
  : m.includes('individual') ? 'Пуснете SQL файла 2026-10-04_curriculum_ich.sql'
  : m.includes('curriculum_') && (m.includes('does not exist') || m.includes('schema cache')) ? 'Пуснете SQL файла 2026-10-04_curriculum.sql' : m
