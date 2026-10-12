'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, FileDown, UserX, CalendarClock, IdCard, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getMonthlyDeclaration } from '../substitutions/actions'
import { generateMonthlyNPDeclaration, generateMonthlyBudgetDeclaration } from '@/lib/docx-substitution'
import type { MySubRow } from './page'
import { declarationPeriods, defaultPeriod, sofiaTodayIso } from '@/lib/declaration-periods'

function fmt(d: string) { return d ? d.split('-').reverse().join('.') : '—' }
// дати на заместването: при няколко заместника — само моите дни
const datesOf = (r: MySubRow) => r.myDays || (r.dateFrom === r.dateTo ? fmt(r.dateFrom) : `${fmt(r.dateFrom)} – ${fmt(r.dateTo)}`)

type DeclRow = { subId: string; date: string; orderRef: string; hours: number; bsch: boolean; absentName: string }
type Group = { subId: string; absentName: string; dates: string[]; npHours: number; budgetHours: number; orderRef: string }

export default function MySubstitutionsClient({ rows }: { rows: MySubRow[] }) {
  const { toast } = useToast()
  const today = sofiaTodayIso()
  // само приключили месеци (септември — от 01.10, октомври — от 01.11, …)
  const periods = declarationPeriods('sub')
  const [periodKey, setPeriodKey] = useState(() => defaultPeriod(periods).key)
  const period = periods.find(p => p.key === periodKey) || periods[0]
  const [busy, setBusy] = useState<'np' | 'budget' | null>(null)
  const [loading, setLoading] = useState(false)
  const [decl, setDecl] = useState<any | null>(null)

  // това, което влиза в декларацията за избрания месец
  useEffect(() => {
    if (!period.open) { setDecl(null); return }
    let alive = true
    setLoading(true)
    getMonthlyDeclaration(period.from, period.to).then((res: any) => {
      if (!alive) return
      setDecl(res?.data || null)
      setLoading(false)
    })
    return () => { alive = false }
  }, [period.from, period.to, period.open])

  const groups: Group[] = useMemo(() => {
    const map: Record<string, Group> = {}
    ;((decl?.rows || []) as DeclRow[]).forEach(r => {
      const g = map[r.subId] || (map[r.subId] = { subId: r.subId, absentName: r.absentName, dates: [], npHours: 0, budgetHours: 0, orderRef: r.orderRef })
      if (!g.dates.includes(r.date)) g.dates.push(r.date)
      if (r.bsch) g.npHours += r.hours; else g.budgetHours += r.hours
    })
    return Object.values(map)
  }, [decl])
  const npHours = decl?.npHours || 0
  const budgetHours = decl?.budgetHours || 0

  // текущи и предстоящи — с паспортите на децата
  const current = rows.filter(r => r.dateTo >= today).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))

  async function gen(kind: 'np' | 'budget') {
    if (!decl) return
    setBusy(kind)
    try {
      if (kind === 'np') await generateMonthlyNPDeclaration(decl)
      else await generateMonthlyBudgetDeclaration(decl)
      toast('Декларацията е изтеглена')
    } catch (e) { toast('Грешка при генериране', 'error') }
    setBusy(null)
  }

  return (
    <div className="space-y-6">
      {/* ── Текущи и предстоящи ── */}
      {current.length > 0 && (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Сега замествам</h2>
          <div className="space-y-2">
            {current.map(r => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-[0_1px_4px_rgba(15,34,64,0.06)]">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-500 shrink-0"><UserX size={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-800">{r.absentName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{datesOf(r)}</div>
                </div>
                {r.absentId && (
                  <Link href={`/passports?staff=${r.absentId}`} target="_blank"
                    title="Паспортите на децата, с които работи отсъстващият колега"
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240]">
                    <IdCard size={14} /> Паспорти на децата
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Декларация за месец ── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-end gap-3 p-4 border-b border-slate-100">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Декларация за месец</label>
            <select value={periodKey} onChange={e => setPeriodKey(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer">
              {periods.map(p => <option key={p.key} value={p.key} disabled={!p.open}>{p.label}{!p.open ? ` — от ${fmt(p.opensOn)}` : ''}</option>)}
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => gen('np')} disabled={busy !== null || loading || npHours === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: '#059669' }}>
              {busy === 'np' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Декларация НП{npHours > 0 ? ` · ${npHours} ч.` : ''}
            </button>
            <button onClick={() => gen('budget')} disabled={busy !== null || loading || budgetHours === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: '#0f2240' }}>
              {busy === 'budget' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Декларация бюджет{budgetHours > 0 ? ` · ${budgetHours} ч.` : ''}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Зареждане…</div>
        ) : groups.length === 0 ? (
          <div className="py-10 text-center">
            <CalendarClock size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">Няма часове за деклариране през {period.label}.</p>
          </div>
        ) : (
          <div>
            {groups.map((g, i) => (
              <div key={g.subId} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 border-b border-slate-100 last:border-0 ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-800">{g.absentName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{g.dates.join(', ')}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {g.npHours > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">НП · {g.npHours} ч.</span>}
                  {g.budgetHours > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Бюджет · {g.budgetHours} ч.</span>}
                  {g.orderRef === '—'
                    ? <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" title="Без регистрирана заповед полето „Заповед №“ в декларацията остава празно"><AlertTriangle size={11} /> няма заповед</span>
                    : <span className="text-[11px] text-slate-400">Зап. № {g.orderRef}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-400 px-4 py-2.5 bg-slate-50/60 border-t border-slate-100">Декларира се само приключил месец (септември — от 01.10, октомври — от 01.11 и т.н.). Заместванията в рамките на нормата не се плащат и не влизат тук.</p>
      </section>
    </div>
  )
}
