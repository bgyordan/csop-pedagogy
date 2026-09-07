'use client'
import { useState } from 'react'
import { Loader2, FileDown, UserX, CalendarClock } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getMonthlyDeclaration } from '../substitutions/actions'
import { generateMonthlyNPDeclaration, generateMonthlyBudgetDeclaration } from '@/lib/docx-substitution'
import type { MySubRow } from './page'

function fmt(d: string) { return d ? d.split('-').reverse().join('.') : '—' }
const MONTHS = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември']

export default function MySubstitutionsClient({ rows }: { rows: MySubRow[] }) {
  const { toast } = useToast()
  const now = new Date()
  const schoolStartYear = (now.getMonth() + 1) >= 9 ? now.getFullYear() : now.getFullYear() - 1
  const SCHOOL_MONTHS = [9,10,11,12,1,2,3,4,5,6].map(m => ({ m, y: m >= 9 ? schoolStartYear : schoolStartYear + 1, label: `${MONTHS[m-1]} ${m >= 9 ? schoolStartYear : schoolStartYear + 1}` }))
  const curIdx = Math.max(0, SCHOOL_MONTHS.findIndex(x => x.m === (now.getMonth() + 1)))
  const [fromIdx, setFromIdx] = useState(curIdx)
  const [toIdx, setToIdx] = useState(curIdx)
  const mFirst = (m: number, y: number) => `${y}-${String(m).padStart(2,'0')}-01`
  const mLast = (m: number, y: number) => `${y}-${String(m).padStart(2,'0')}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`
  const first = mFirst(SCHOOL_MONTHS[fromIdx].m, SCHOOL_MONTHS[fromIdx].y)
  const last = mLast(SCHOOL_MONTHS[toIdx].m, SCHOOL_MONTHS[toIdx].y)
  const [busy, setBusy] = useState<'np' | 'budget' | null>(null)

  async function gen(kind: 'np' | 'budget') {
    setBusy(kind)
    const res: any = await getMonthlyDeclaration(first, last)
    if (res.error) { toast(res.error, 'error'); setBusy(null); return }
    const d = res.data
    const has = kind === 'np' ? d.rows.some((r: any) => r.bsch) : d.rows.some((r: any) => !r.bsch)
    if (!has) { toast(kind === 'np' ? 'Няма НП часове за този месец' : 'Няма бюджетни часове за този месец', 'error'); setBusy(null); return }
    try {
      if (kind === 'np') await generateMonthlyNPDeclaration(d)
      else await generateMonthlyBudgetDeclaration(d)
      toast('Декларацията е изтеглена')
    } catch (e) { toast('Грешка при генериране', 'error') }
    setBusy(null)
  }


  return (
    <div className="space-y-4">
      {/* Избор месец + генериране */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">От месец</label>
            <select value={fromIdx} onChange={e => { const i = Number(e.target.value); setFromIdx(i); if (i > toIdx) setToIdx(i) }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer">
              {SCHOOL_MONTHS.map((x, i) => <option key={i} value={i}>{x.label} г.</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">До месец</label>
            <select value={toIdx} onChange={e => setToIdx(Number(e.target.value))}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer">
              {SCHOOL_MONTHS.map((x, i) => <option key={i} value={i} disabled={i < fromIdx}>{x.label} г.</option>)}
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => gen('np')} disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#059669' }}>
              {busy === 'np' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Декларация НП
            </button>
            <button onClick={() => gen('budget')} disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
              {busy === 'budget' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Декларация бюджет
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Изберете месец и генерирайте обобщена справка-декларация за всичките си замествания през него (НП отделно от бюджета).</p>
      </div>

      {/* Списък на моите замествания (преглед) */}
      {rows.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-14 text-center">
          <CalendarClock size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">Нямате замествания.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div key={r.id}
              className={`bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-[0_1px_4px_rgba(15,34,64,0.06)] ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                <UserX size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-800">Замествам: <span className="font-medium">{r.absentName}</span></div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {fmt(r.dateFrom)} – {fmt(r.dateTo)}
                  {r.bsch && <span className="ml-2 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">НП</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
