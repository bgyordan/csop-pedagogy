// Ставки за лекторски час (€) — от таблицата lecturer_rates (въвеждат се в „Проверка лекторски“).
// unified: заместването от бюджета е със ставката за над норматив.
// Заместването по НП „Без свободен час“ се плаща на заместника със ставката за заместване (6,29 €);
// np (rate_np) е МАКСИМУМЪТ на час за МОН заедно с осигуровките от работодателя (7,38 €) — само за отчета;
// employerPct — осигуровките за сметка на работодателя (учител: 23,32% с УчПФ и ТЗПБ 0,5%).

export type LecturerRates = { unified: boolean; npSame: boolean; over: number; sub: number; np: number; employerPct: number; updatedAt?: string | null; updatedBy?: string }
export const DEFAULT_RATES: LecturerRates = { unified: true, npSame: false, over: 6.29, sub: 6.29, np: 7.38, employerPct: 23.32 }

/** Ставките, които реално важат: np — плащане на заместника по НП (= заместване), npCap — таван за МОН с осигуровките,
 *  npMon — ставката на час във файла за МОН: такава, че с осигуровките да не надвишава тавана (7,38 / 1,2332 → 5,98) */
export const effectiveRates = (r: LecturerRates) => {
  const sub = r.unified ? r.over : r.sub
  const npMon = Math.min(sub, Math.floor(r.np / (1 + r.employerPct / 100) * 100 + 1e-9) / 100)
  return { over: r.over, sub, np: sub, npCap: r.np, npMon, employerPct: r.employerPct }
}

export const eurStr = (v: number) => v.toFixed(2).replace('.', ',')

/** Чете ставките; без миграцията — по подразбиране (6,29 / 7,38) */
export async function loadLecturerRates(supabase: any): Promise<LecturerRates> {
  const { data, error } = await supabase.from('lecturer_rates')
    .select('unified, np_same, rate_over, rate_sub, rate_np, updated_at, staff:staff_profiles(first_name, last_name)').eq('id', 1).maybeSingle()
  if (error || !data) return DEFAULT_RATES
  // отделно — без миграцията 2026-10-09 колоната я няма, а другите ставки трябва да се прочетат
  const { data: pct } = await supabase.from('lecturer_rates').select('employer_pct').eq('id', 1).maybeSingle()
  return {
    employerPct: Number(pct?.employer_pct) || DEFAULT_RATES.employerPct,
    unified: data.unified !== false,
    npSame: data.np_same === true,
    over: Number(data.rate_over) || DEFAULT_RATES.over,
    sub: Number(data.rate_sub) || DEFAULT_RATES.sub,
    // старата отметка „НП със същата ставка“ пазеше 6,29 в rate_np → таванът е по подразбиране
    np: data.np_same === true ? DEFAULT_RATES.np : (Number(data.rate_np) || DEFAULT_RATES.np),
    updatedAt: data.updated_at,
    updatedBy: data.staff ? `${data.staff.first_name} ${data.staff.last_name}` : '',
  }
}
