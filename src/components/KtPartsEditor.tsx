'use client'
import { Plus, X } from 'lucide-react'
import { KT_ARTICLES, type KtPart } from '@/lib/kt'

/**
 * Отпуск по няколко члена от КТ: основният член важи за целия период,
 * а тук се добавят частите с друг член (напр. последните 2 дни — чл. 160 неплатен).
 */
export default function KtPartsEditor({ parts, onChange, from, to, base }: {
  parts: KtPart[]; onChange: (p: KtPart[]) => void
  from: string; to: string; base: string
}) {
  const set = (i: number, patch: Partial<KtPart>) => onChange(parts.map((p, j) => j === i ? { ...p, ...patch } : p))
  const add = () => onChange([...parts, { kt: base === '160' ? '155' : '160', from: to || from, to: to || from }])
  const inputCls = 'px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-slate-400'
  const bad = (p: KtPart) => !p.from || !p.to || p.from > p.to || (from && p.from < from) || (to && p.to > to)

  return (
    <div className="space-y-1.5">
      {parts.map((p, i) => (
        <div key={i} className={`flex flex-wrap items-center gap-1.5 p-2 rounded-xl border ${bad(p) ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200 bg-slate-50/60'}`}>
          <select value={p.kt} onChange={e => set(i, { kt: e.target.value })} className={`${inputCls} flex-1 min-w-[180px] cursor-pointer`}>
            {KT_ARTICLES.map(a => <option key={a.v} value={a.v}>{a.l}</option>)}
          </select>
          <span className="text-[12px] text-slate-500">от</span>
          <input type="date" value={p.from} min={from || undefined} max={to || undefined} onChange={e => set(i, { from: e.target.value })} className={inputCls} />
          <span className="text-[12px] text-slate-500">до</span>
          <input type="date" value={p.to} min={p.from || from || undefined} max={to || undefined} onChange={e => set(i, { to: e.target.value })} className={inputCls} />
          <button type="button" onClick={() => onChange(parts.filter((_, j) => j !== i))} title="Махни" className="p-1 text-slate-400 hover:text-rose-600"><X size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={add} disabled={!from || !to}
        className="inline-flex items-center gap-1 text-[12px] text-slate-600 hover:text-[#0f2240] disabled:opacity-40">
        <Plus size={13} /> друг член за част от периода (напр. 2 дни платен + 2 дни неплатен)
      </button>
      {parts.length > 0 && <p className="text-[11px] text-slate-400 font-light">Останалите дни от периода са по основния член.</p>}
    </div>
  )
}

/** Проверка преди запис: частите да са в периода и с правилни дати */
export function ktPartsError(parts: KtPart[], from: string, to: string): string {
  for (const p of parts) {
    if (!p.from || !p.to || p.from > p.to) return 'Провери датите при „друг член“'
    if (p.from < from || p.to > to) return 'Частта с друг член трябва да е в периода на отпуска'
  }
  return ''
}
