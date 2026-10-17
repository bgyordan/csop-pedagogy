// Броят документи в Drive — от браузъра през /api/doc-counts (виж там защо не е server action)
export async function fetchDocCounts(ids: string[], classId?: string): Promise<Record<string, number>> {
  if (!ids.length) return {}
  try {
    const r = await fetch('/api/doc-counts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, classId }) })
    return r.ok ? await r.json() : {}
  } catch { return {} }
}
