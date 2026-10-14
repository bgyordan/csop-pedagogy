'use client'
// „Вече е издадена“ — избор на заповедта от регистъра, вместо номерът да се пише на ръка.
// Номерът и датата за декларациите се вземат точно оттам.

import { useEffect, useState } from 'react'
import { Search, Loader2, FileText, X } from 'lucide-react'
import { searchSubstitutionOrders, type RegistryOrder } from './actions'

export default function RegistryOrderPick({ value, onChange }: { value: RegistryOrder | null; onChange: (o: RegistryOrder | null) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<RegistryOrder[] | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setList(null)
    const t = setTimeout(async () => {
      const res = await searchSubstitutionOrders(q)
      if (alive) setList(res.list || [])
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [q, open])

  if (value) return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/60 border border-emerald-200 text-sm text-slate-700">
      <FileText size={14} className="text-emerald-700 shrink-0" />
      <span className="flex-1 min-w-0 truncate"><b className="font-medium">№ {value.number}</b>{value.title ? ` · ${value.title}` : ''}</span>
      <button type="button" onClick={() => onChange(null)} title="Отвържи (заповедта остава в регистъра)"
        className="p-1 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50"><X size={14} /></button>
    </div>
  )

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-slate-200">
        <Search size={14} className="text-slate-400 shrink-0" />
        <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Търси в регистъра — номер или заглавие…" className="flex-1 min-w-0 text-sm focus:outline-none" />
      </div>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100">
          {list === null ? <div className="flex justify-center py-4 text-slate-400"><Loader2 size={16} className="animate-spin" /></div>
            : list.length === 0 ? <p className="text-[13px] text-slate-400 py-3 text-center">Няма такава заповед в регистъра.</p>
            : list.map(o => (
              <button key={o.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(o); setQ(''); setOpen(false) }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50">
                <span className="block text-sm text-slate-800">№ {o.number}</span>
                {o.title && <span className="block text-[12px] text-slate-500 truncate">{o.title}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
