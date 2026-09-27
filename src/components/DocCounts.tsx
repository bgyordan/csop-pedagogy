'use client'
// Брой документи в Drive за деца — много клетки на една страница правят ЕДНА заявка (събират се за 30 ms)
import { useEffect, useState } from 'react'
import { studentDocCounts } from '@/app/dashboard/components/class-drive-actions'

let queue = new Set<string>()
let waiters: ((m: Record<string, number>) => void)[] = []
let timer: ReturnType<typeof setTimeout> | null = null

function load(ids: string[]): Promise<Record<string, number>> {
  ids.forEach(i => queue.add(i))
  return new Promise(resolve => {
    waiters.push(resolve)
    if (timer) return
    timer = setTimeout(async () => {
      const all = [...queue], w = waiters
      queue = new Set(); waiters = []; timer = null
      let m: Record<string, number> = {}
      try { m = await studentDocCounts(all) } catch { /* няма връзка с Drive */ }
      w.forEach(f => f(m))
    }, 30)
  })
}

function useCounts(ids: string[]) {
  const [m, setM] = useState<Record<string, number> | null>(null)
  const key = ids.join(',')
  useEffect(() => {
    if (!ids.length) { setM({}); return }
    let live = true
    load(ids).then(r => { if (live) setM(r) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return m
}

const pulse = <span className="inline-block w-10 h-4 rounded-full bg-slate-100 animate-pulse align-middle" />

// За паралелка: колко деца нямат нито един документ
export function NoDocsBadge({ ids }: { ids: string[] }) {
  const m = useCounts(ids)
  if (!m) return pulse
  const none = ids.filter(i => !m[i]).length
  if (!ids.length) return <span className="text-slate-300 text-xs">—</span>
  return none === 0
    ? <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 text-emerald-700" title="Всички деца имат документи">✓ док.</span>
    : <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-50 text-amber-700" title={`${none} деца без нито един документ`}>{none} без док.</span>
}

// За едно дете: брой документи
export function DocCount({ id }: { id: string }) {
  const m = useCounts([id])
  if (!m) return pulse
  const n = m[id] || 0
  return n > 0
    ? <span className="px-2 py-0.5 rounded-full text-[11px] bg-sky-50 text-sky-700">{n}</span>
    : <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-50 text-amber-700">няма</span>
}
