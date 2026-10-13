'use client'
// Избор на заповед от регистъра за служител — „над норматив“ или „ИФО“. Зарежда се веднъж за годината,
// декларациите вземат номера и датата оттук.

import { useEffect, useState } from 'react'
import { Loader2, Search, X, FileText, Unlink } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { searchOrdersForLecturer, setLecturerOrder } from './actions'
import { LECTURER_ORDER_LABEL, type LecturerOrderKind, type LecturerOrderRef } from '@/lib/lecturer-orders'

type Opt = { id: string; number: string; title: string; date: string }

/** Малкият бутон в реда: показва вързаната заповед или „+ заповед“ */
export function OrderChip({ staffId, staffName, kind, current, needed, onSaved }: {
  staffId: string; staffName: string; kind: LecturerOrderKind; current?: LecturerOrderRef; needed?: boolean
  onSaved: (o: LecturerOrderRef | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const label = kind === 'ifo' ? 'ИФО' : 'Заповед'
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title={current?.title || `Изберете заповедта за ${LECTURER_ORDER_LABEL[kind]} от регистъра`}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] border max-w-[220px] ${current
          ? 'bg-white border-slate-200 text-slate-600 hover:border-[#0f2240]'
          : needed ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100' : 'bg-white border-dashed border-slate-200 text-slate-400 hover:text-slate-600'}`}>
        <FileText size={11} className="shrink-0" />
        <span className="truncate">{current ? `${label}: № ${current.number}` : `+ ${kind === 'ifo' ? 'ИФО заповед' : 'заповед'}`}</span>
      </button>
      {open && <OrderPicker staffId={staffId} staffName={staffName} kind={kind} current={current}
        onClose={() => setOpen(false)} onSaved={o => { setOpen(false); onSaved(o) }} />}
    </>
  )
}

function OrderPicker({ staffId, staffName, kind, current, onClose, onSaved }: {
  staffId: string; staffName: string; kind: LecturerOrderKind; current?: LecturerOrderRef
  onClose: () => void; onSaved: (o: LecturerOrderRef | undefined) => void
}) {
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [list, setList] = useState<Opt[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    const t = setTimeout(async () => {
      const res = await searchOrdersForLecturer(q)
      if (!alive) return
      if (res.error) toast(res.error, 'error')
      setList(res.list || [])
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  async function choose(o: Opt | null) {
    setBusy(true)
    const res: any = await setLecturerOrder(staffId, kind, o?.id || null)
    setBusy(false)
    if (res.error) { toast(res.error, 'error'); return }
    toast(o ? 'Заповедта е вързана' : 'Връзката е махната')
    onSaved(o ? { id: o.id, number: o.number, title: o.title } : undefined)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-xl mx-auto my-0 md:my-12 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
          <FileText size={17} className="text-teal-700" />
          <div className="flex-1 min-w-0">
            <h2 className="text-base text-[#0f2240]">Заповед за {LECTURER_ORDER_LABEL[kind]}</h2>
            <p className="text-[12px] text-slate-500 truncate">{staffName} · за учебната година</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          {current && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-50/60 border border-teal-200 text-[13px] text-slate-700">
              <span className="flex-1 min-w-0 truncate">Сега: <b className="font-medium">№ {current.number}</b>{current.title ? ` · ${current.title}` : ''}</span>
              <button type="button" onClick={() => choose(null)} disabled={busy}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] text-slate-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                <Unlink size={12} /> махни
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl focus-within:border-[#0f2240]">
            <Search size={14} className="text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="Номер или заглавие на заповедта…" className="flex-1 min-w-0 text-[14px] focus:outline-none" />
          </div>
          {list === null ? <div className="flex justify-center py-6 text-slate-400"><Loader2 className="animate-spin" size={18} /></div>
            : list.length === 0 ? <p className="text-[13px] text-slate-400 py-4 text-center">Няма такава заповед в регистъра.</p>
            : <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {list.map(o => (
                  <button key={o.id} type="button" disabled={busy} onClick={() => choose(o)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 disabled:opacity-50 ${o.id === current?.id ? 'bg-teal-50/50' : ''}`}>
                    <span className="block text-[14px] text-slate-800">№ {o.number}</span>
                    {o.title && <span className="block text-[12px] text-slate-500 truncate">{o.title}</span>}
                  </button>
                ))}
              </div>}
          <p className="text-[11.5px] text-slate-400">Избира се веднъж за годината — декларациите на колегата вземат номера и датата оттук.</p>
        </div>
      </div>
    </div>
  )
}
