// Заповедите за лекторски от регистъра — по една на служител за учебната година и вид:
// 'over' — над норматив, 'ifo' — ИФО часовете. Зареждат се веднъж в „Лекторски часове“.

export type LecturerOrderKind = 'over' | 'ifo'
export type LecturerOrderRef = { id: string; number: string; title: string }
export type StaffLecturerOrders = Partial<Record<LecturerOrderKind, LecturerOrderRef>>

export const LECTURER_ORDER_LABEL: Record<LecturerOrderKind, string> = { over: 'над норматив', ifo: 'ИФО' }

/** „Заповед № 80/10.10.2025г.“ — номерът в регистъра вече съдържа датата */
export const orderText = (o?: LecturerOrderRef | null) => o?.number ? `Заповед № ${o.number}` : 'Заповед № …………………'

/** Всички вързани заповеди за годината: staffId → { over, ifo }. Без SQL файла — празно. */
export async function loadLecturerOrders(supabase: any, yearId: string | undefined, staffId?: string): Promise<Record<string, StaffLecturerOrders>> {
  if (!yearId) return {}
  let q = supabase.from('lecturer_orders').select('staff_id, kind, order:orders(id, number, title)').eq('academic_year_id', yearId)
  if (staffId) q = q.eq('staff_id', staffId)
  const { data, error } = await q
  if (error) return {}
  const out: Record<string, StaffLecturerOrders> = {}
  ;(data || []).forEach((r: any) => {
    if (!r.order) return
    ;(out[r.staff_id] ||= {})[r.kind as LecturerOrderKind] = { id: r.order.id, number: r.order.number || '', title: r.order.title || '' }
  })
  return out
}
