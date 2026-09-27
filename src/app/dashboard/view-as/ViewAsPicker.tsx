'use client'
import { useMemo, useState, useTransition } from 'react'
import { Eye, X, Loader2 } from 'lucide-react'
import { setViewAs } from './actions'

type Person = { id: string; name: string; label: string }

// Избор „Виж като…“ (в хедъра на таблото, само за админ) + лента, когато гледаш като друг
export default function ViewAsPicker({ people, viewing }: { people: Person[]; viewing?: Person | null }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [pending, start] = useTransition()
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? people.filter(p => (p.name + ' ' + p.label).toLowerCase().includes(t)) : people
  }, [q, people])

  if (viewing) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-2xl border border-amber-200 bg-amber-50 text-sm text-amber-900">
        <Eye size={16} className="text-amber-600" />
        <span>Гледаш менюто и таблото като <b className="font-medium">{viewing.name}</b> ({viewing.label}).</span>
        <span className="text-xs text-amber-700 font-light">Страниците и бутоните работят с твоите права.</span>
        <button onClick={() => start(() => setViewAs(null))} disabled={pending}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 disabled:opacity-50">
          {pending ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Изход
        </button>
      </div>
    )
  }

  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 border border-white/25 text-xs text-white hover:bg-white/25 transition">
        <Eye size={13} /> Виж като…
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg p-2 text-slate-700">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Търси служител…"
            className="w-full px-3 py-1.5 mb-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-100" />
          <div className="max-h-72 overflow-y-auto">
            {list.map(p => (
              <button key={p.id} disabled={pending} onClick={() => start(() => setViewAs(p.id))}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-sm hover:bg-sky-50 disabled:opacity-50">
                <span className="truncate">{p.name}</span>
                <span className="text-[11px] text-slate-400 shrink-0">{p.label}</span>
              </button>
            ))}
            {list.length === 0 && <div className="px-2.5 py-2 text-xs text-slate-400">Няма такъв служител</div>}
          </div>
        </div>
      )}
    </div>
  )
}
