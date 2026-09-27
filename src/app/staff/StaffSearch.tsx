'use client'
import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

// Търсене на служители докато пишеш (без Enter) — като при учениците
export default function StaffSearch({ q: initial, sort, dir }: { q: string; sort: string; dir: string }) {
  const router = useRouter()
  const [q, setQ] = useState(initial)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const t = setTimeout(() => {
      const p = new URLSearchParams({ sort, dir })
      if (q.trim()) p.set('q', q.trim())
      router.replace(`/staff?${p.toString()}`)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])
  return (
    <div className="relative mb-4 md:max-w-sm">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={q} onChange={e => setQ(e.target.value)} autoFocus
        placeholder="Търси по име или имейл…" className="input w-full pl-9" />
    </div>
  )
}
