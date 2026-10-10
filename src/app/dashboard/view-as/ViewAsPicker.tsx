'use client'
import { useMemo, useState, useTransition } from 'react'
import { Eye, X, Loader2 } from 'lucide-react'
import { setViewAs } from './actions'
import { startImpersonation } from '@/app/impersonate/actions'

type Person = { id: string; name: string; label: string; role?: string }

// Избор „Виж като…“ (в хедъра на таблото, само за админ) + лента, когато гледаш като друг.
// Два режима: „Само меню“ (безопасно, само сайдбар+табло) и „Влез като“ (истинска сесия на колегата).
export default function ViewAsPicker({ people, viewing }: { people: Person[]; viewing?: Person | null }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [mode, setMode] = useState<'view' | 'login'>('view')
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const base = mode === 'login' ? people.filter(p => p.role !== 'admin') : people
    return t ? base.filter(p => (p.name + ' ' + p.label).toLowerCase().includes(t)) : base
  }, [q, people, mode])

  const pick = (id: string) => {
    setErr('')
    if (mode === 'view') return start(() => setViewAs(id))
    start(async () => {
      const r = await startImpersonation(id)
      if (r?.error) setErr(r.error)
      else window.location.assign('/dashboard') // пълно презареждане — новата сесия навсякъде
    })
  }

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
          <div className="relative grid grid-cols-2 p-0.5 mb-1.5 rounded-lg bg-slate-100 text-xs">
            <span className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md bg-white shadow-sm transition-all ${mode === 'login' ? 'left-1/2' : 'left-0.5'}`} />
            <button onClick={() => { setMode('view'); setErr('') }}
              className={`relative z-10 py-1.5 rounded-md transition ${mode === 'view' ? 'text-[#0f2240] font-medium' : 'text-slate-500'}`}>Само меню</button>
            <button onClick={() => { setMode('login'); setErr('') }}
              className={`relative z-10 py-1.5 rounded-md transition ${mode === 'login' ? 'text-[#0f2240] font-medium' : 'text-slate-500'}`}>Влез като</button>
          </div>
          {mode === 'login' && (
            <p className="px-1 mb-1.5 text-[11px] leading-snug text-amber-700 font-light">
              Истинска сесия на колегата за 1 час. Каквото запишеш или подадеш, е от негово име.
            </p>
          )}
          {err && <p className="px-1 mb-1.5 text-[11px] text-rose-600">{err}</p>}
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Търси служител…"
            className="w-full px-3 py-1.5 mb-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-100" />
          <div className="max-h-72 overflow-y-auto">
            {list.map(p => (
              <button key={p.id} disabled={pending} onClick={() => pick(p.id)}
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
