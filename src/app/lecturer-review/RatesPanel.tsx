'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Check, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { effectiveRates, eurStr, type LecturerRates } from '@/lib/lecturer-rates'
import { saveLecturerRates } from './actions'

// Ставки за лекторски час: една ставка; отметка „същата ставка“ за заместване от бюджета (иначе отделно поле).
// По НП заместникът получава ставката за заместване; отделно — таванът на час за МОН заедно с осигуровките.
export default function RatesPanel({ rates }: { rates: LecturerRates }) {
  const { toast } = useToast()
  const router = useRouter()
  const eff = effectiveRates(rates)
  const [edit, setEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState(() => ({ unified: rates.unified, npSame: rates.npSame, over: eurStr(rates.over), sub: eurStr(rates.sub), np: eurStr(rates.np) }))
  const num = (s: string) => Number(String(s).replace(',', '.').trim())

  async function save() {
    setSaving(true)
    const res: any = await saveLecturerRates({ unified: f.unified, npSame: f.npSame, over: num(f.over), sub: num(f.sub), np: num(f.np) })
    setSaving(false)
    if (res?.error) { toast(res.error, 'error'); return }
    toast('Ставките са записани')
    setEdit(false)
    router.refresh()
  }

  const input = (k: 'over' | 'sub' | 'np', label: string) => (
    <label className="block">
      <span className="block text-[11px] text-slate-500 mb-1">{label}</span>
      <span className="relative inline-block">
        <input value={f[k]} onChange={e => setF(p => ({ ...p, [k]: e.target.value }))} inputMode="decimal"
          className="w-28 pl-3 pr-7 py-1.5 border border-slate-200 rounded-lg text-sm tabular-nums focus:outline-none focus:border-slate-400" />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">€</span>
      </span>
    </label>
  )

  if (!edit) return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
      <span className="text-slate-500">Ставка за лекторски час:</span>
      <span>над норматив <b className="tabular-nums">{eurStr(eff.over)} €</b></span>
      <span>заместване бюджет <b className="tabular-nums">{eurStr(eff.sub)} €</b>{rates.unified && <span className="text-slate-400"> (същата)</span>}</span>
      <span>заместване НП <b className="tabular-nums">{eurStr(eff.np)} €</b> <span className="text-slate-400">(МОН с осигуровките до {eurStr(eff.npCap)} €)</span></span>
      <button onClick={() => setEdit(true)} className="inline-flex items-center gap-1 text-[#0f2240] hover:underline"><Pencil size={12} /> Промени</button>
      {rates.updatedAt && <span className="text-slate-400">· {new Date(rates.updatedAt).toLocaleDateString('bg-BG')}{rates.updatedBy ? `, ${rates.updatedBy}` : ''}</span>}
    </div>
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
      <div className="text-xs font-semibold text-slate-600">Ставки за лекторски час</div>
      <div className="flex flex-wrap items-end gap-4">
        {input('over', 'Лекторски час (над норматив)')}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={f.unified} onChange={e => setF(p => ({ ...p, unified: e.target.checked }))} className="rounded" />
            Заместване от бюджета — със същата ставка
          </label>
          {!f.unified && input('sub', 'Заместване от бюджета')}
        </div>
        <div className="space-y-1">
          {input('np', 'НП „Без свободен час“ — максимум на час за МОН с осигуровките на работодателя')}
          <div className="text-[11px] text-slate-400 max-w-xs">На заместника се плаща ставката за заместване; в МОН файла сумата + осигуровките не надвишават този максимум.</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Запази
        </button>
        <button onClick={() => setEdit(false)} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-600"><X size={12} /> Отказ</button>
        <span className="text-[11px] text-slate-400">Ставките влизат в сумите, заповедта за изплащане и декларациите на учителите.</span>
      </div>
    </div>
  )
}
