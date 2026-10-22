'use client'
// Самооценка на проверения: проверяващият я поисква, служителят оценява себе си по същите критерии,
// докато протоколът е чернова. Проверяващият вижда самооценката до своите констатации.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, ClipboardPen, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { SCORES, dmy, type CriteriaGroup, type Finding } from '@/lib/control'

export type SelfRequest = {
  check_id: string; subject: string; check_date: string; inspector: string
  criteria: CriteriaGroup[]; self_assessment: (Record<string, Finding> & { _note?: string }) | null; self_assessed_at: string | null
}

export default function SelfAssessments({ requests }: { requests: SelfRequest[] }) {
  const [open, setOpen] = useState<SelfRequest | null>(null)
  if (!requests.length) return null
  return (
    <section className="mb-6">
      <h2 className="text-[13px] uppercase tracking-wide text-slate-500 mb-2">Самооценка преди проверка</h2>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {requests.map(r => (
          <button key={r.check_id} type="button" onClick={() => setOpen(r)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left">
            <span className="w-20 text-[13px] text-slate-500 tabular-nums">{dmy(r.check_date)}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] text-slate-800 truncate">{r.subject || 'Проверка'}</span>
              <span className="block text-[12.5px] text-slate-500">{r.inspector}</span>
            </span>
            {r.self_assessed_at
              ? <span className="text-[12px] text-emerald-700 inline-flex items-center gap-1"><Check size={13} /> попълнена {dmy(r.self_assessed_at)}</span>
              : <span className="text-[12px] px-2 py-0.5 rounded-full bg-indigo-600 text-white">попълнете</span>}
          </button>
        ))}
      </div>
      {open && <SelfForm r={open} onClose={() => setOpen(null)} />}
    </section>
  )
}

function SelfForm({ r, onClose }: { r: SelfRequest; onClose: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = useState<Record<string, Finding>>(() => {
    const { _note, ...rest } = r.self_assessment || {}
    return rest as Record<string, Finding>
  })
  const [note, setNote] = useState<string>(r.self_assessment?._note || '')
  const [busy, setBusy] = useState(false)
  const groups = (r.criteria || []).filter(g => g.items?.length)
  async function save() {
    setBusy(true)
    const { error } = await createClient().rpc('control_self_assess', { p_check: r.check_id, p_data: { ...data, _note: note.trim() || undefined } })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Самооценката е изпратена'); onClose(); router.refresh()
  }
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <ClipboardPen size={18} className="text-indigo-600" />
          <h3 className="flex-1 text-base text-slate-800">Самооценка — {r.subject || 'проверка'} ({dmy(r.check_date)})</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-500">Оценете себе си по същите критерии, по които ще се проведе проверката. Самооценката вижда само проверяващият ({r.inspector}); не е оценка, а основа за разговора след наблюдението.</p>
          {groups.map(g => (
            <div key={g.g}>
              <div className="text-[13px] font-medium text-slate-700 mb-1.5">{g.g}</div>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {g.items.map(it => {
                  const f = data[it.k] || {}
                  return (
                    <div key={it.k} className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex-1 min-w-[200px] text-[13.5px] text-slate-800">{it.t}</span>
                        <div className="flex gap-1">
                          {SCORES.map(s => (
                            <button key={s.v} type="button" title={s.l} onClick={() => setData({ ...data, [it.k]: { ...f, s: f.s === s.v ? undefined : s.v } })}
                              className={`h-8 min-w-8 px-2 rounded-lg text-[12.5px] border ${f.s === s.v ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{s.short}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {!groups.length && <p className="text-sm text-slate-400">Проверката няма критерии — опишете накратко вашата самооценка.</p>}
          <label className="block text-[12px] text-slate-500">Коментар (по желание)
            <textarea className="input w-full mt-1" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Какво се получава добре, къде имате нужда от подкрепа" />
          </label>
          <p className="text-[12px] text-slate-400">3 — изпълнявам · 2 — частично · 1 — не изпълнявам · н/п — неприложимо</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary">Отказ</button>
          <button type="button" onClick={save} disabled={busy} className="btn-primary inline-flex items-center gap-1.5">{busy && <Loader2 size={14} className="animate-spin" />} Изпрати</button>
        </div>
      </div>
    </div>
  )
}
