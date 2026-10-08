// Ставки за лекторски час (€) — от таблицата lecturer_rates (въвеждат се в „Проверка лекторски“).
// unified: заместването от бюджета е със ставката за над норматив; npSame: и заместването по НП. Иначе — отделни.

export type LecturerRates = { unified: boolean; npSame: boolean; over: number; sub: number; np: number; updatedAt?: string | null; updatedBy?: string }
export const DEFAULT_RATES: LecturerRates = { unified: true, npSame: false, over: 6.29, sub: 6.29, np: 7.38 }

/** Ставките, които реално важат (с отметките „същата ставка“) */
export const effectiveRates = (r: LecturerRates) => ({ over: r.over, sub: r.unified ? r.over : r.sub, np: r.npSame ? r.over : r.np })

export const eurStr = (v: number) => v.toFixed(2).replace('.', ',')

/** Чете ставките; без миграцията — по подразбиране (6,29 / 7,38) */
export async function loadLecturerRates(supabase: any): Promise<LecturerRates> {
  const { data, error } = await supabase.from('lecturer_rates')
    .select('unified, np_same, rate_over, rate_sub, rate_np, updated_at, staff:staff_profiles(first_name, last_name)').eq('id', 1).maybeSingle()
  if (error || !data) return DEFAULT_RATES
  return {
    unified: data.unified !== false,
    npSame: data.np_same === true,
    over: Number(data.rate_over) || DEFAULT_RATES.over,
    sub: Number(data.rate_sub) || DEFAULT_RATES.sub,
    np: Number(data.rate_np) || DEFAULT_RATES.np,
    updatedAt: data.updated_at,
    updatedBy: data.staff ? `${data.staff.first_name} ${data.staff.last_name}` : '',
  }
}
