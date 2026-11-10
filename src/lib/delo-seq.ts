// Деловодна поредност: деловодната година е 15.09–14.09, номерът = най-големият seq за периода + 1.
// (Същата логика като в „Нова заповед“ / „Нов входящ“ — тук е обща, за да няма разминаване.)

export function deloYearBounds(ref: Date): { start: string; end: string } {
  const y = ref.getFullYear(), m = ref.getMonth() + 1, d = ref.getDate()
  const startYear = (m > 9 || (m === 9 && d >= 15)) ? y : y - 1
  const iso = (yy: number, mm: number, dd: number) => `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  return { start: iso(startYear, 9, 15), end: iso(startYear + 1, 9, 14) }
}

export async function nextOrderSeq(supabase: any, dateIso: string): Promise<number> {
  const { start, end } = deloYearBounds(new Date(dateIso))
  const { data } = await supabase.from('orders')
    .select('seq').gte('date', start).lte('date', end)
    .order('seq', { ascending: false, nullsFirst: false }).limit(1)
  const maxSeq = data && data[0] && typeof data[0].seq === 'number' ? data[0].seq : 0
  return maxSeq + 1
}

// Договори: „ДГ-NNN/ГГГГ“ — най-големият NNN за годината + 1 (не „брой + 1“, който се повтаря след изтриване)
export async function nextContractNumber(supabase: any, year: number): Promise<string> {
  const { data } = await supabase.from('contracts').select('number').like('number', `%/${year}`)
  let max = 0
  for (const r of data || []) {
    const m = String(r.number || '').match(/(\d+)\s*\/\s*\d{4}$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `ДГ-${String(max + 1).padStart(3, '0')}/${year}`
}

export const orderNumberText = (seq: number, dateIso: string) =>
  `${String(seq).padStart(3, '0')}/${dateIso.split('-').reverse().join('.')}г.`

// Записва заповед с пореден номер и пази от ДВОЕН номер: ако двама души издадат заповед в един и същи миг,
// и двамата биха взели „най-големия + 1“. След записа се проверява дали номерът е само наш; ако не е —
// единият (с по-голямото id — и двете страни стигат до един и същ извод) взима следващия номер.
export async function insertNumberedOrder(
  supabase: any, dateIso: string, row: Record<string, unknown>,
): Promise<{ id: string; seq: number; number: string } | { error: string }> {
  const { start, end } = deloYearBounds(new Date(dateIso))
  let seq = await nextOrderSeq(supabase, dateIso)
  const { data: created, error } = await supabase.from('orders')
    .insert({ ...row, date: dateIso, seq, number: orderNumberText(seq, dateIso) }).select('id').single()
  if (error || !created) return { error: error?.message || 'Заповедта не беше записана' }
  for (let i = 0; i < 5; i++) {
    const { data: same } = await supabase.from('orders').select('id')
      .eq('seq', seq).gte('date', start).lte('date', end).order('id').limit(2)
    if (!same || same.length < 2 || same[0].id === created.id) break
    seq = await nextOrderSeq(supabase, dateIso)
    const { error: uErr } = await supabase.from('orders').update({ seq, number: orderNumberText(seq, dateIso) }).eq('id', created.id)
    if (uErr) return { error: uErr.message }
  }
  return { id: created.id, seq, number: orderNumberText(seq, dateIso) }
}
