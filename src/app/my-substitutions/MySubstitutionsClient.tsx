'use client'
import { useState } from 'react'
import { Loader2, FileDown, UserX, CalendarClock } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getMonthlyDeclaration } from '../substitutions/actions'
import { generateMonthlyNPDeclaration, generateMonthlyBudgetDeclaration } from '@/lib/docx-substitution'
import type { MySubRow } from './page'
import { declarationPeriods, defaultPeriod } from '@/lib/declaration-periods'

function fmt(d: string) { return d ? d.split('-').reverse().join('.') : '—' }

export default function MySubstitutionsClient({ rows }: { rows: MySubRow[] }) {
  const { toast } = useToast()
  // само приключили месеци (септември — от 01.10, октомври — от 01.11, …)
  const periods = declarationPeriods()
  const [periodKey, setPeriodKey] = useState(() => defaultPeriod(periods).key)
  const period = periods.find(p => p.key === periodKey) || periods[0]
  const first = period.from
  const last = period.to
  const [busy, setBusy] = useState<'np' | 'budget' | null>(null)

  async function gen(kind: 'np' | 'budget') {
    if (!period.open) { toast(`Периодът още не е приключил — декларацията се изтегля от ${fmt(period.opensOn)}`, 'error'); return }
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
            <label className="block text-xs text-slate-500 mb-1">Период</label>
            <select value={periodKey} onChange={e => setPeriodKey(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer">
              {periods.map(p => <option key={p.key} value={p.key} disabled={!p.open}>{p.label}{!p.open ? ` — от ${fmt(p.opensOn)}` : ''}</option>)}
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => gen('np')} disabled={busy !== null || !period.open}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#059669' }}>
              {busy === 'np' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Декларация НП
            </button>
            <button onClick={() => gen('budget')} disabled={busy !== null || !period.open}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
              {busy === 'budget' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Декларация бюджет
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Изберете период и генерирайте обобщена справка-декларация за всичките си замествания през него (НП отделно от бюджета). Декларира се само приключил месец (септември — от 01.10, октомври — от 01.11 и т.н.).</p>
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
                  {r.myDays ? <>Моите дни: {r.myDays}</> : <>{fmt(r.dateFrom)} – {fmt(r.dateTo)}</>}
                  {r.bsch && <span className="ml-2 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">НП</span>}
                  {!r.bsch && !r.overNorm && <span className="ml-2 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200" title="В рамките на нормата — не влиза в декларацията">без заплащане</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
