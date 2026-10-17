// Заместванията на един колега — като основен заместник ИЛИ в разпределение по дни (няколко заместника).
// Ползва се в „Моите лекторски“ (/my-lecturer).

export interface MySubRow {
  id: string
  absentId: string | null
  absentName: string
  dateFrom: string
  dateTo: string
  reason: string
  bsch: boolean
  hasOrder: boolean
  overNorm: boolean
  myDays: string | null   // при няколко заместника — само моите дни
}

export async function loadMySubstitutions(supabase: any, meId: string): Promise<MySubRow[]> {
  const { data: myAs } = await supabase
    .from('substitution_assignments').select('substitution_id, date_from, date_to').eq('substitute_staff_id', meId)
  const myParts: Record<string, { from: string; to: string }[]> = {}
  ;(myAs || []).forEach((a: any) => { (myParts[a.substitution_id] = myParts[a.substitution_id] || []).push({ from: a.date_from, to: a.date_to }) })
  const asIds = Object.keys(myParts)

  let q = supabase
    .from('substitutions')
    .select(`id, absent_staff_id, date_from, date_to, reason, bsch_eligible, substitution_order_id, over_norm,
      absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name)`)
    .order('date_from', { ascending: false })
  q = asIds.length > 0 ? q.or(`substitute_staff_id.eq.${meId},id.in.(${asIds.join(',')})`) : q.eq('substitute_staff_id', meId)
  const { data } = await q

  // ако заместването е разделено между няколко души, основният заместник също е в разпределението —
  // тогава показваме само неговите дни
  const allIds = (data || []).map((r: any) => r.id)
  const splitIds = new Set<string>()
  if (allIds.length > 0) {
    const { data: anyAs } = await supabase.from('substitution_assignments').select('substitution_id').in('substitution_id', allIds)
    ;(anyAs || []).forEach((a: any) => splitIds.add(a.substitution_id))
  }

  const fmt = (d: string) => d.split('-').reverse().join('.')
  return (data || []).flatMap((r: any) => {
    const parts = splitIds.has(r.id) ? (myParts[r.id] || []).sort((a, b) => a.from.localeCompare(b.from)) : null
    if (parts && parts.length === 0) return []
    return [{
      id: r.id,
      absentId: r.absent_staff_id || null,
      absentName: r.absent ? `${r.absent.first_name} ${r.absent.last_name}` : '—',
      dateFrom: parts ? parts[0].from : r.date_from,
      dateTo: parts ? parts[parts.length - 1].to : r.date_to,
      reason: r.reason,
      bsch: r.bsch_eligible === true, hasOrder: !!r.substitution_order_id,
      overNorm: r.over_norm !== false,
      myDays: parts ? parts.map(p => p.from === p.to ? fmt(p.from) : `${fmt(p.from)}–${fmt(p.to)}`).join(', ') : null,
    }]
  })
}
