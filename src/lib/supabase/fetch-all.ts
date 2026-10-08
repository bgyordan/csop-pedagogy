// Supabase (PostgREST) връща най-много 1000 реда на заявка (max-rows), без грешка — по-големите
// списъци (часовете на цялото училище, учебния план) се изрязват тихо. fetchAll чете на страници.
// make() трябва да връща НОВА заявка всеки път, с подредба по уникална колона (напр. .order('id')).
export async function fetchAll<T = any>(make: () => any, page = 1000): Promise<{ data: T[]; error: any }> {
  const out: T[] = []
  for (let from = 0; ; from += page) {
    const { data, error } = await make().range(from, from + page - 1)
    if (error) return { data: out, error }
    out.push(...((data || []) as T[]))
    if (!data || data.length < page) return { data: out, error: null }
  }
}
