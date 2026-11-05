'use server'
// Бързо отразяване на отсъствия от таблото — без заповеди и заместници:
//  • деловодството (Ванина, Марина — болничните): „+ Отсъствие“ за всеки колега;
//  • ръководството: „Отсъствам“ — само за себе си; директорът посочва кой изпълнява функциите на директор.
// Записва се в „Замествания“ (substitutions) — оттам го чете листчето „Днес отсъстват“.
// Ред със заместник или заповед не се пипа оттук (освен „кой изпълнява функциите на директор“) — той е в „Замествания“.
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sofiaToday } from '@/lib/today-absences'

const ENTER = ['secretary', 'admin', 'zdud', 'director']
const SQL_HINT = 'Пуснете SQL файла 2026-11-05_substitutions_acting.sql'
export type AbsenceKind = 'sick' | 'vacation' | 'other'
const KT: Record<AbsenceKind, string | null> = { sick: '162', vacation: '155', other: null }

export type QuickAbsence = {
  id: string; staffId: string; name: string; role: string
  from: string; to: string; reason: string
  actingId: string | null; actingName: string
  editable: boolean        // без заместник и без заповед — датите и видът се пипат оттук
}

async function ctx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, me: null as null | { id: string; role: string } }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  return { supabase, me: me as null | { id: string; role: string } }
}

const COLS = (acting: boolean) => `id, absent_staff_id, substitute_staff_id, date_from, date_to, reason, substitution_order_id, manual_order_number${acting ? ', acting_staff_id, acting:staff_profiles!substitutions_acting_staff_id_fkey(first_name, last_name)' : ''},
  absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name, role)`

/** Текущите и предстоящите отсъствия (mine — само моите) */
export async function listQuickAbsences(opts: { mine?: boolean } = {}): Promise<{ rows: QuickAbsence[] }> {
  const { supabase, me } = await ctx()
  if (!me || !ENTER.includes(me.role)) return { rows: [] }
  const run = (acting: boolean) => {
    let q = supabase.from('substitutions').select(COLS(acting)).gte('date_to', sofiaToday()).order('date_from')
    if (opts.mine) q = q.eq('absent_staff_id', me.id)
    return q
  }
  let r: any = await run(true)
  if (r.error) r = await run(false)   // преди SQL файла — без „кой изпълнява функциите“
  const list = (r.data || []).filter((s: any) => s.absent)
  const ids = list.map((s: any) => s.id)
  const { data: asg } = ids.length ? await supabase.from('substitution_assignments').select('substitution_id').in('substitution_id', ids) : { data: [] as any[] }
  const withAsg = new Set((asg || []).map((a: any) => a.substitution_id))
  const rows: QuickAbsence[] = list.map((s: any) => ({
    id: s.id, staffId: s.absent_staff_id, name: `${s.absent.first_name} ${s.absent.last_name}`, role: s.absent.role || '',
    from: s.date_from, to: s.date_to, reason: s.reason || 'other',
    actingId: s.acting_staff_id || null, actingName: s.acting ? `${s.acting.first_name} ${s.acting.last_name}` : '',
    editable: !s.substitute_staff_id && !s.substitution_order_id && !s.manual_order_number && !withAsg.has(s.id),
  }))
  return { rows }
}

export async function saveQuickAbsence(input: { id?: string; staffId: string; from: string; to: string; kind: AbsenceKind; actingId?: string | null }) {
  const { supabase, me } = await ctx()
  if (!me || !ENTER.includes(me.role)) return { error: 'Нямате права' }
  if (!input.staffId) return { error: 'Изберете колега' }
  if (!input.from || !input.to) return { error: 'Попълнете от – до' }
  if (input.to < input.from) return { error: '„До“ е преди „от“' }
  const { data: who } = await supabase.from('staff_profiles').select('role').eq('id', input.staffId).single()
  const isDirector = who?.role === 'director'
  const acting = isDirector ? (input.actingId || null) : null
  if (acting && acting === input.staffId) return { error: 'Директорът не може да замества себе си' }

  // застъпване с друго отсъствие на същия колега
  let ov = supabase.from('substitutions').select('id, date_from, date_to').eq('absent_staff_id', input.staffId)
    .lte('date_from', input.to).gte('date_to', input.from)
  if (input.id) ov = ov.neq('id', input.id)
  const { data: overlap } = await ov
  if ((overlap || []).length) {
    const o = overlap![0], d = (x: string) => x.split('-').reverse().join('.')
    return { error: `Вече има отсъствие ${d(o.date_from)} – ${d(o.date_to)} — редактирайте него` }
  }

  if (input.id) {
    const { rows } = await listQuickAbsences()
    const row = rows.find(x => x.id === input.id)
    if (!row) return { error: 'Отсъствието не е намерено' }
    if (!row.editable) {
      // със заместник/заповед — оттук само „кой изпълнява функциите на директор“
      if (!isDirector) return { error: 'Има заместник или заповед — променя се в „Замествания“' }
      if (row.from !== input.from || row.to !== input.to) return { error: 'Има заместник или заповед — датите се променят в „Замествания“' }
      const { error } = await supabase.from('substitutions').update({ acting_staff_id: acting }).eq('id', input.id)
      if (error) return { error: /acting_staff_id/.test(error.message) ? SQL_HINT : error.message }
    } else {
      // причината/членът от КТ не се пипат при редакция (може да са сложени в „Замествания“)
      const upd: any = { date_from: input.from, date_to: input.to }
      if (isDirector) upd.acting_staff_id = acting
      const { error } = await supabase.from('substitutions').update(upd).eq('id', input.id)
      if (error) return { error: /acting_staff_id/.test(error.message) ? SQL_HINT : error.message }
    }
  } else {
    const ins: any = { absent_staff_id: input.staffId, date_from: input.from, date_to: input.to, reason: input.kind, kt_article: KT[input.kind] }
    if (isDirector && acting) ins.acting_staff_id = acting
    const { error } = await supabase.from('substitutions').insert(ins)
    if (error) return { error: /acting_staff_id/.test(error.message) ? SQL_HINT : error.message }
  }
  revalidatePath('/dashboard'); revalidatePath('/substitutions')
  return { success: true }
}

export async function deleteQuickAbsence(id: string) {
  const { supabase, me } = await ctx()
  if (!me || !ENTER.includes(me.role)) return { error: 'Нямате права' }
  const { rows } = await listQuickAbsences()
  const row = rows.find(x => x.id === id)
  if (!row) return { error: 'Отсъствието не е намерено' }
  if (!row.editable) return { error: 'Има заместник или заповед — изтрива се в „Замествания“' }
  const { error } = await supabase.from('substitutions').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard'); revalidatePath('/substitutions')
  return { success: true }
}
