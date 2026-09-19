'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const REST = 'Организиран отдих и физическа активност'
const SELF = 'Самоподготовка'
const INTEREST = 'Занимания по интереси'

// Следобеден ЦОУД блок по дневника (period -> дейност), еднакъв за всички възпитатели:
// 1) 12:25–13:00 отдих · 2) 13:20–13:55 самоподг. · 3) 14:15–14:50 самоподг.
// 4) 15:05–15:40 занимания · 5) 15:55–16:30 занимания · 6) 16:45–17:20 отдих
const TEMPLATE: Record<number, string> = {
  1: REST, 2: SELF, 3: SELF, 4: INTEREST, 5: INTEREST, 6: REST,
}
const TERMS = [1, 2]

async function requireAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Няма сесия' as const }
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me || !['admin', 'zdud', 'director'].includes(me.role)) return { error: 'Нямаш права' as const }
  return { me }
}

// Налива стандартния блок за един или няколко възпитатели (идемпотентно — upsert).
export async function applyStandardEducatorSchedule(educatorIds: string[], academicYearId: string) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return { error: auth.error }
  if (!educatorIds.length) return { error: 'Няма избрани възпитатели' }
  if (!academicYearId) return { error: 'Липсва учебна година' }

  const rows: any[] = []
  for (const educatorId of educatorIds) {
    for (const term of TERMS) {
      for (let day = 1; day <= 5; day++) {
        for (const [period, activity] of Object.entries(TEMPLATE)) {
          rows.push({
            educator_id: educatorId, academic_year_id: academicYearId, term,
            day, period: parseInt(period), activity, created_by: auth.me.id,
          })
        }
      }
    }
  }
  const { error } = await supabase
    .from('educator_slots')
    .upsert(rows, { onConflict: 'educator_id,academic_year_id,term,day,period' })
  if (error) return { error: error.message }
  revalidatePath('/admin/coud')
  return { ok: true, count: rows.length }
}

// Изчиства блока на един възпитател (за текущата година).
export async function clearEducatorSchedule(educatorId: string, academicYearId: string) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return { error: auth.error }
  const { error } = await supabase.from('educator_slots').delete()
    .eq('educator_id', educatorId).eq('academic_year_id', academicYearId)
  if (error) return { error: error.message }
  revalidatePath('/admin/coud')
  return { ok: true }
}
