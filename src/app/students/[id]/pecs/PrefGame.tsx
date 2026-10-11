'use client'

// „Кое избира?“ — бърза оценка на предпочитанията: показвате на детето два любими предмета,
// то посяга към единия — натискате него. След 8–10 избора ЕИС подрежда мотиваторите.

import { useState } from 'react'
import { X, Loader2, SkipForward, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { nextPair, prefRanking } from './lib'
import type { Item, Pref } from './lib'
import ItemPic from './ItemPic'

export default function PrefGame({ studentId, childName, items, prefs, meId, onClose }: {
  studentId: string; childName: string; items: Item[]; prefs: Pref[]; meId: string; onClose: (changed: boolean) => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [all, setAll] = useState<Pref[]>(prefs)
  const [pair, setPair] = useState(() => nextPair(items, prefs))
  const [busy, setBusy] = useState(false)
  const [n, setN] = useState(0)

  async function choose(chosen: string | null) {
    if (!pair) return
    setBusy(true)
    const row = { student_id: studentId, item_a: pair[0].id, item_b: pair[1].id, chosen, chosen_by: meId }
    const { data, error } = await supabase.from('pecs_preferences').insert(row).select('id, item_a, item_b, chosen, created_at').single()
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    const next = [...all, data as Pref]
    setAll(next)
    setN(n + 1)
    const k = pair[0].id < pair[1].id ? pair[0].id + pair[1].id : pair[1].id + pair[0].id
    setPair(nextPair(items, next, k))
  }

  const rank = prefRanking(items, all)

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => onClose(n > 0)} className="p-2 -ml-2 text-slate-400 hover:text-slate-700"><X size={22} /></button>
        <div>
          <div className="text-[15px] font-semibold text-slate-800">Кое избира? · {childName}</div>
          <div className="text-[12px] text-slate-500">Покажете двата предмета. Натиснете този, към който детето посегне първо.</div>
        </div>
        <div className="ml-auto text-[13px] text-slate-500">избори: {n}</div>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {pair ? (
          <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
            {pair.map(it => (
              <button key={it.id} type="button" disabled={busy} onClick={() => choose(it.id)}
                className="bg-white rounded-3xl border-2 border-slate-200 hover:border-emerald-400 active:scale-95 transition p-6 flex flex-col items-center gap-3 shadow-sm">
                <ItemPic item={it} className="w-32 h-32 md:w-44 md:h-44" />
                <span className="text-xl font-semibold text-slate-800">{it.label}</span>
              </button>
            ))}
            <button type="button" disabled={busy} onClick={() => choose(null)}
              className="col-span-2 inline-flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-slate-300 text-slate-500 hover:text-slate-800">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <SkipForward size={16} />} Не избра нито едно
            </button>
          </div>
        ) : <div className="text-center text-slate-500">Нужни са поне два мотиватора в речника.</div>}

        {all.length > 0 && (
          <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 mb-3"><Trophy size={15} className="text-amber-500" /> Класация на любимите</div>
            <div className="space-y-1.5">
              {rank.map((r, i) => (
                <div key={r.item.id} className="flex items-center gap-3">
                  <span className="w-5 text-right text-[13px] text-slate-400 tabular-nums">{i + 1}</span>
                  <ItemPic item={r.item} className="w-8 h-8" />
                  <span className="w-32 text-[14px] text-slate-700 truncate">{r.item.label}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(r.score * 100)}%` }} />
                  </div>
                  <span className="w-20 text-right text-[12px] text-slate-500 tabular-nums">{r.w} от {r.n}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
