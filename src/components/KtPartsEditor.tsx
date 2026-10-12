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
  const field = 'w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-[#0f2240]'
  const bad = (p: KtPart) => !p.from || !p.to || p.from > p.to || (from && p.from < from) || (to && p.to > to)
  const ready = !!from && !!to

  return (
    <div className="space-y-2">
      {parts.map((p, i) => (
        <div key={i} className={`rounded-xl border p-2.5 space-y-2 ${bad(p) ? 'border-rose-300 bg-rose-50/60' : 'border-[#0f2240]/20 bg-[#0f2240]/[0.03]'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Друг член {parts.length > 1 ? `№ ${i + 1}` : ''}</span>
            <button type="button" onClick={() => onChange(parts.filter((_, j) => j !== i))}
              className="inline-flex items-center gap-1 text-[12px] text-slate-400 hover:text-rose-600"><X size={13} /> махни</button>
          </div>
          <select value={p.kt} onChange={e => set(i, { kt: e.target.value })} className={`${field} cursor-pointer`}>
            {KT_ARTICLES.map(a => <option key={a.v} value={a.v}>{a.l}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[10px] text-slate-400 mb-0.5">От</span>
              <input type="date" value={p.from} min={from || undefined} max={to || undefined} onChange={e => set(i, { from: e.target.value })} className={field} />
            </label>
            <label className="block">
              <span className="block text-[10px] text-slate-400 mb-0.5">До</span>
              <input type="date" value={p.to} min={p.from || from || undefined} max={to || undefined} onChange={e => set(i, { to: e.target.value })} className={field} />
            </label>
          </div>
          {bad(p) && <p className="text-[11px] text-rose-600">Датите трябва да са в периода на отпуска ({from ? from.split('-').reverse().join('.') : '…'} – {to ? to.split('-').reverse().join('.') : '…'}).</p>}
        </div>
      ))}

      <button type="button" onClick={add} disabled={!ready}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-[#0f2240]/40 bg-white text-[13px] font-medium text-[#0f2240] hover:bg-[#0f2240]/5 hover:border-[#0f2240] disabled:opacity-40 disabled:cursor-not-allowed transition">
        <Plus size={15} /> {parts.length ? 'Добави още един член' : 'Част от периода е по друг член'}
      </button>
      <p className="text-[11px] text-slate-400 font-light leading-snug">
        {!ready ? 'Първо попълни периода на отпуска.'
          : parts.length ? 'Останалите дни от периода са по основния член отгоре.'
          : 'Напр. 2 дни платен (чл. 155) + 2 дни неплатен (чл. 160) в едно заявление.'}
      </p>
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
