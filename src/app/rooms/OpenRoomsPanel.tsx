'use client'

// „Отвори стаи“ — за ръководството: повод, период и паралелките (една, няколко или всички с един клик).
// Паралелка, която вече има отворена стая, е заключена (сива) — не се отваря втора за същото време.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X, DoorOpen } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import DateInput from '@/components/ui/DateInput'
import { todaySofia } from '@/lib/ores'
import { openClassRooms } from './actions'

const REASONS = ['Грипна ваканция', 'Извънредни обстоятелства', 'Неучебни дни']

export default function OpenRoomsPanel({ classes, busyClassIds }: { classes: { id: string; name: string }[]; busyClassIds: string[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const busySet = useMemo(() => new Set(busyClassIds), [busyClassIds])
  const free = classes.filter(c => !busySet.has(c.id))
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('Грипна ваканция')
  const [from, setFrom] = useState(todaySofia())
  const [to, setTo] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const toggle = (id: string) => setPicked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allPicked = free.length > 0 && free.every(c => picked.has(c.id))

  async function submit() {
    if (!from || !to) { toast('Изберете начална и крайна дата', 'error'); return }
    if (!picked.size) { toast('Изберете паралелки', 'error'); return }
    setSaving(true)
    const r: any = await openClassRooms(Array.from(picked), from, to, reason)
    setSaving(false)
    if (r?.error) { toast(r.error, 'error'); if (r.opened) router.refresh(); return }
    toast(`Отворени стаи: ${r.opened}${r.skipped ? ` · прескочени (вече отворени): ${r.skipped}` : ''}`)
    setPicked(new Set()); setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm hover:opacity-90 shadow-sm" style={{ backgroundColor: '#0f2240' }}>
        <DoorOpen size={16} /> Отвори стаи
      </button>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
      <div className="flex items-center gap-2 mb-4">
        <DoorOpen size={17} className="text-sky-600" />
        <h2 className="text-[15px] font-light text-[#0f2240] flex-1">Отвори стаи за паралелки</h2>
        <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[12px] text-slate-500 flex-1 min-w-[220px]">Повод
          <input value={reason} onChange={e => setReason(e.target.value)} className="block w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0f2240]" />
        </label>
        <label className="text-[12px] text-slate-500">От<div className="mt-1"><DateInput value={from} onChange={setFrom} /></div></label>
        <label className="text-[12px] text-slate-500">До<div className="mt-1"><DateInput value={to} onChange={setTo} min={from} /></div></label>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {REASONS.map(r => (
          <button key={r} type="button" onClick={() => setReason(r)}
            className={`px-2.5 py-1 rounded-full text-[12px] border ${reason === r ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>{r}</button>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-5 mb-2">
        <span className="text-[12px] text-slate-500">Паралелки — избрани {picked.size}</span>
        <button type="button" onClick={() => setPicked(allPicked ? new Set() : new Set(free.map(c => c.id)))}
          className="text-[12px] px-2.5 py-1 rounded-full border border-slate-300 text-slate-700 hover:border-[#0f2240]">
          {allPicked ? 'Махни всички' : 'Всички'}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {classes.map(c => {
          const busy = busySet.has(c.id)
          const on = picked.has(c.id)
          return (
            <button key={c.id} type="button" disabled={busy} onClick={() => toggle(c.id)} title={busy ? 'Вече има отворена стая' : ''}
              className={`min-w-[52px] px-3 py-1.5 rounded-xl text-[13px] border transition-colors tabular-nums ${busy ? 'border-emerald-200 bg-emerald-50 text-emerald-700 cursor-not-allowed'
                : on ? 'border-sky-400 bg-sky-100 text-sky-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
              {c.name}{busy ? ' ✓' : ''}
            </button>
          )
        })}
      </div>
      {busySet.size > 0 && <p className="text-[11.5px] text-slate-400 mt-2">Зелените вече имат отворена стая.</p>}

      <div className="flex justify-end mt-4">
        <button type="button" onClick={submit} disabled={saving || !picked.size}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Отвори {picked.size || ''} {picked.size === 1 ? 'стая' : 'стаи'}
        </button>
      </div>
    </div>
  )
}
