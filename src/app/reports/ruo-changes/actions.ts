'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { loadCurrentState } from './state'
import type { ChangeDetail } from '@/lib/ruo-changes'

const MANAGERS = ['admin', 'zdud', 'director']

async function manager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, me: null, error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!MANAGERS.includes(me?.role || '')) return { supabase, me: null, error: 'Нямате права' }
  return { supabase, me, error: '' }
}

// „Подаден“ — запазва ТЕКУЩИЯ състав като основа за следващия доклад.
// Съставът се чете тук, от базата, а не от браузъра.
export async function saveSnapshot(outNumber: string, outDate: string | null, note: string) {
  const { supabase, me, error } = await manager()
  if (error || !me) return { error }
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
  if (!cy) return { error: 'Няма текуща учебна година' }
  const data = await loadCurrentState(supabase, cy.id)
  const { error: e } = await supabase.from('ruo_snapshots').insert({
    academic_year_id: cy.id,
    out_number: outNumber.trim() || null,
    out_date: outDate || null,
    note: note.trim() || null,
    data,
    created_by: me.id,
  })
  if (e) return { error: e.message }
  revalidatePath('/reports/ruo-changes')
  return { ok: true }
}

// Номерата на документите — пазят се спрямо базовата снимка; празните редове се трият.
export async function saveDetails(snapshotId: string, rows: ChangeDetail[]) {
  const { supabase, error } = await manager()
  if (error) return { error }
  const clean = (v: string) => (v || '').trim() || null
  const filled = rows.filter(r => [r.parentName, r.applicationNo, r.opinionNo, r.opinionInNo, r.orderNo].some(v => (v || '').trim()))
  const empty = rows.filter(r => !filled.includes(r))
  if (filled.length) {
    const { error: e } = await supabase.from('ruo_change_details').upsert(filled.map(r => ({
      snapshot_id: snapshotId,
      student_id: r.studentId,
      kind: r.kind,
      parent_name: clean(r.parentName),
      application_no: clean(r.applicationNo),
      opinion_no: clean(r.opinionNo),
      opinion_in_no: clean(r.opinionInNo),
      order_no: clean(r.orderNo),
      updated_at: new Date().toISOString(),
    })), { onConflict: 'snapshot_id,student_id,kind' })
    if (e) return { error: e.message }
  }
  for (const r of empty) {
    await supabase.from('ruo_change_details').delete()
      .eq('snapshot_id', snapshotId).eq('student_id', r.studentId).eq('kind', r.kind)
  }
  revalidatePath('/reports/ruo-changes')
  return { ok: true }
}

// Изтриване на снимка (напр. запазена по грешка) — само последната има смисъл да се трие.
export async function deleteSnapshot(id: string) {
  const { supabase, error } = await manager()
  if (error) return { error }
  const { error: e } = await supabase.from('ruo_snapshots').delete().eq('id', id)
  if (e) return { error: e.message }
  revalidatePath('/reports/ruo-changes')
  return { ok: true }
}
