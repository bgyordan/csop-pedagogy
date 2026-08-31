'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Потвърждава декларация (submitted -> verified)
export async function verifyDeclaration(declId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director', 'secretary'].includes(me?.role || '')) return { error: 'Нямате права' }
  const { error } = await supabase.from('lecturer_declarations')
    .update({ status: 'verified', verified_by: me?.id, verified_at: new Date().toISOString() })
    .eq('id', declId)
  if (error) return { error: error.message }
  revalidatePath('/lecturer-review')
  return { success: true }
}

// Връща в "подадена" (ако е сгрешено потвърждаване)
export async function unverifyDeclaration(declId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director', 'secretary'].includes(me?.role || '')) return { error: 'Нямате права' }
  const { error } = await supabase.from('lecturer_declarations')
    .update({ status: 'submitted', verified_by: null, verified_at: null }).eq('id', declId)
  if (error) return { error: error.message }
  revalidatePath('/lecturer-review')
  return { success: true }
}

// Детайли на декларация (кои слотове/дати) — за преглед при проверка
export async function getDeclarationDetail(declId: string) {
  const supabase = await createClient()
  const { data: decl } = await supabase.from('lecturer_declarations')
    .select('id, staff_id, entries, staff:staff_profiles!lecturer_declarations_staff_id_fkey(first_name, last_name)').eq('id', declId).single()
  if (!decl) return { error: 'Не е намерено' }
  const entries: { slotId: string; dates: string[] }[] = (decl.entries as any) || []
  const slotIds = entries.map(e => e.slotId)
  const slotInfo: Record<string, { day: number; period: number; subject: string; holder: string }> = {}
  if (slotIds.length > 0) {
    const { data: sl } = await supabase.from('lecturer_slots')
      .select('id, day, period, holder_label, subject:subjects(name)').in('id', slotIds)
    ;(sl || []).forEach((r: any) => { slotInfo[r.id] = { day: r.day, period: r.period, subject: r.subject?.name || '', holder: r.holder_label || '' } })
  }
  const DAY = ['', 'пон', 'вт', 'ср', 'чет', 'пет']
  const rows = entries.map(e => ({
    label: slotInfo[e.slotId] ? `${DAY[slotInfo[e.slotId].day]} ${slotInfo[e.slotId].period}. ${slotInfo[e.slotId].subject} · ${slotInfo[e.slotId].holder}` : '—',
    dates: e.dates.map(d => d.split('-').reverse().join('.')),
    count: e.dates.length,
  }))
  return { rows }
}
