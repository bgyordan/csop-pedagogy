'use client'
import { useState } from 'react'
import { Loader2, FileSpreadsheet } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getMonExport } from '../substitutions/actions'
import { generateMonImport } from '@/lib/excel-generator'

const MONTHS = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември']
function schoolMonths() {
  const now = new Date()
  const sy = (now.getMonth() + 1) >= 9 ? now.getFullYear() : now.getFullYear() - 1
  return [9,10,11,12,1,2,3,4,5,6].map(m => ({ m, y: m >= 9 ? sy : sy + 1, label: `${MONTHS[m-1]} ${m >= 9 ? sy : sy + 1}` }))
}
const mFirst = (m: number, y: number) => `${y}-${String(m).padStart(2,'0')}-01`
const mLast = (m: number, y: number) => `${y}-${String(m).padStart(2,'0')}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`

export default function MonExportClient() {
  const { toast } = useToast()
  const SM = schoolMonths()
  const now = new Date()
  const curIdx = Math.max(0, SM.findIndex(x => x.m === (now.getMonth() + 1)))
  const [fromIdx, setFromIdx] = useState(curIdx)
  const [toIdx, setToIdx] = useState(curIdx)
  const [rate, setRate] = useState(7.38)
  const [busy, setBusy] = useState(false)

  async function gen() {
    setBusy(true)
    const first = mFirst(SM[fromIdx].m, SM[fromIdx].y)
    const last = mLast(SM[toIdx].m, SM[toIdx].y)
    const res: any = await getMonExport(first, last, rate)
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
          <label className="block text-xs text-slate-500 mb-1">Ставка (EUR/час)</label>
          <select value={rate} onChange={e => setRate(Number(e.target.value))}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer">
            <option value={7.38}>7.38 € (в същото населено място)</option>
            <option value={8.60}>8.60 € (извън населеното място)</option>
          </select>
        </div>
      </div>
      <button onClick={gen} disabled={busy}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: '#059669' }}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Генерирай МОН файл
      </button>
      <p className="text-[11px] text-slate-400">Събира всички НП замествания за периода, изчислява часовете (без ваканции) и сумата по съответния член от КТ. Файлът се импортира директно в платформата на МОН.</p>
    </div>
  )
}
