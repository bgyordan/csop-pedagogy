// Общо сортиране за регистрите (orders / correspondence) — ползва се в сървърните page.tsx.
// '' = по реда на въвеждане (най-новите отгоре); num_* = по пореден номер; date_* = по дата.
export const REGISTRY_SORTS = ['', 'num_asc', 'num_desc', 'date_asc', 'date_desc'] as const

export function applyRegistrySort(query: any, sort: string): any {
  switch (sort) {
    case 'num_asc':  return query.order('seq', { ascending: true,  nullsFirst: false }).order('created_at', { ascending: true })
    case 'num_desc': return query.order('seq', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
    case 'date_asc': return query.order('date', { ascending: true }).order('seq', { ascending: true, nullsFirst: false })
    case 'date_desc': return query.order('date', { ascending: false }).order('seq', { ascending: false, nullsFirst: false })
    default: return query.order('created_at', { ascending: false })
  }
}
