'use client'
import { useState } from 'react'
import { Loader2, FileSpreadsheet } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getMonExport } from '../substitutions/actions'
import { generateMonImport } from '@/lib/excel-generator'
import { eurStr } from '@/lib/lecturer-rates'

const MONTHS = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември']
function schoolMonths() {
  const now = new Date()
  const sy = (now.getMonth() + 1) >= 9 ? now.getFullYear() : now.getFullYear() - 1
  return [9,10,11,12,1,2,3,4,5,6].map(m => ({ m, y: m >= 9 ? sy : sy + 1, label: `${MONTHS[m-1]} ${m >= 9 ? sy : sy + 1}` }))
}
const mFirst = (m: number, y: number) => `${y}-${String(m).padStart(2,'0')}-01`
const mLast = (m: number, y: number) => `${y}-${String(m).padStart(2,'0')}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`

// rate — плащането на заместника, cap — таванът на час с осигуровките (само за показване; сървърът ги взима сам)
export default function MonExportClient({ rate, cap }: { rate: number; cap: number }) {
  const { toast } = useToast()
  const SM = schoolMonths()
  const now = new Date()
  const curIdx = Math.max(0, SM.findIndex(x => x.m === (now.getMonth() + 1)))
  const [fromIdx, setFromIdx] = useState(curIdx)
  const [toIdx, setToIdx] = useState(curIdx)
  const [busy, setBusy] = useState(false)

  async function gen() {
    setBusy(true)
    const first = mFirst(SM[fromIdx].m, SM[fromIdx].y)
    const last = mLast(SM[toIdx].m, SM[toIdx].y)
    const res: any = await getMonExport(first, last)
    if (res.error) { toast(res.error, 'error'); setBusy(false); return }
    try { generateMonImport(res.data.rows); toast(`Файлът е готов (${res.data.rows.length} реда)`) }
    catch (e) { toast('Грешка при генериране', 'error') }
    setBusy(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">От месец</label>
          <select value={fromIdx} onChange={e => { const i = Number(e.target.value); setFromIdx(i); if (i > toIdx) setToIdx(i) }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer">
            {SM.map((x, i) => <option key={i} value={i}>{x.label} г.</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">До месец</label>
          <select value={toIdx} onChange={e => setToIdx(Number(e.target.value))}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer">
            {SM.map((x, i) => <option key={i} value={i} disabled={i < fromIdx}>{x.label} г.</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Ставка</div>
          <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm tabular-nums" title="Променя се в „Проверка лекторски“ → Ставки">
            {eurStr(rate)} € / час <span className="text-slate-500">· с осигуровките до {eurStr(cap)} €</span>
          </div>
        </div>
      </div>
      <button onClick={gen} disabled={busy}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: '#059669' }}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Генерирай МОН файл
      </button>
      <p className="text-[11px] text-slate-400">Събира всички НП замествания за периода, изчислява часовете (без ваканции) и сумата по съответния член от КТ. Файлът се импортира директно в платформата на МОН. Сумата е часове × ставката на заместника; осигуровките от работодателя се вписват до тавана — сума + осигуровки ≤ часове × {eurStr(cap)} €. Ставките се променят в „Проверка лекторски“ → Ставки.</p>
    </div>
  )
}
