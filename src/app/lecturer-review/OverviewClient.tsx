'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Loader2, FileDown, ChevronRight, ChevronDown, Check, Undo2, Search, AlertTriangle } from 'lucide-react'
import { generateLecturerPaymentOrder } from '@/lib/docx-substitution'
import { useToast } from '@/components/ui/Toast'
import { smartMatch } from '@/lib/search'
import { declarationPeriods, defaultPeriod } from '@/lib/declaration-periods'
import { getLecturerOverview, getReviewDetail, verifyDeclaration, unverifyDeclaration } from './actions'
import ReviewClient from './ReviewClient'
import RatesPanel from './RatesPanel'
import { effectiveRates, eurStr, type LecturerRates } from '@/lib/lecturer-rates'


type Decl = { id: string; status: string; from: string; to: string; hours: number }
type Row = {
  staffId: string; name: string; position: string
  planned: number; declared: number; hasDecl: boolean; np: number; budget: number
  substituted: { name: string; np: number; budget: number }[]
  decls: Decl[]
}
type ArchiveRow = { id: string; staffName: string; periodFrom: string; periodTo: string; totalHours: number; status: string }
type Detail = {
  over: { slotId: string; day: number; period: number; subject: string; holder: string; dates: { date: string; absent: boolean; declared: boolean }[] }[]
  subs: { date: string; absent: string; np: boolean; items: { period: number; cls: string; subject: string }[] }[]
}
type Filter = 'all' | 'over' | 'sub' | 'pending' | 'missing'

const DAY = ['', 'пон', 'вт', 'ср', 'чет', 'пет']
const fmt = (d: string) => d ? d.split('-').reverse().join('.') : ''
const short = (d: string) => d.split('-').reverse().slice(0, 2).join('.')
const n = (v: number) => v > 0 ? v : <span className="text-slate-300">—</span>
const money = (v: number) => v > 0 ? v.toFixed(2).replace('.', ',') : <span className="text-slate-300">—</span>

// Състояние на декларацията за над норматив в периода
function declState(r: Row, periodOpen: boolean): { key: 'none' | 'missing' | 'notyet' | 'pending' | 'verified' | 'paid'; label: string; cls: string } {
  if (r.planned === 0 && !r.hasDecl) return { key: 'none', label: '—', cls: 'text-slate-300' }
  if (!r.hasDecl) return periodOpen
    ? { key: 'missing', label: 'неподадена', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
    : { key: 'notyet', label: 'периодът не е приключил', cls: 'bg-slate-50 text-slate-500 border-slate-200' }
  if (r.decls.some(d => d.status === 'submitted')) return { key: 'pending', label: 'чака проверка', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
  if (r.decls.every(d => d.status === 'paid')) return { key: 'paid', label: 'изплатена', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  return { key: 'verified', label: 'проверена', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
}

// „Проверка лекторски“: за периода — над норматив (по график / реализирани) и заместване (НП / бюджет),
// по служител, с подробности по дни за сверка с НЕИСПУО и потвърждаване на декларацията на място.
export default function OverviewClient({ archive, rates }: { archive: ArchiveRow[]; rates: LecturerRates }) {
  const { toast } = useToast()
  // ставки за лекторски час (въвеждат се долу в „Ставки“)
  const R = effectiveRates(rates)
  const periods = declarationPeriods('review')
  const [periodKey, setPeriodKey] = useState(() => defaultPeriod(periods).key)
  const period = periods.find(p => p.key === periodKey) || periods[0]
  const first = period.from, last = period.to

  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, Detail | 'loading'>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let off = false
    setLoading(true); setError(''); setOpen(null); setDetails({})
    getLecturerOverview(first, last).then((res: any) => {
      if (off) return
      if (res.error) { setError(res.error); setRows([]) } else setRows(res.data || [])
      setLoading(false)
    })
    return () => { off = true }
  }, [first, last])

  const all = rows || []
  // над норматив: „неподадена“ само за периоди, за които може да има декларация (не за отделен септември/октомври)
  const st = (r: Row) => declState(r, period.overOpen ?? period.open)
  const counts = useMemo(() => ({
    all: all.length,
    over: all.filter(r => r.planned + r.declared > 0).length,
    sub: all.filter(r => r.np + r.budget > 0).length,
    pending: all.filter(r => st(r).key === 'pending').length,
    missing: all.filter(r => st(r).key === 'missing').length,
  }), [rows, period.key]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = all.filter(r => smartMatch(r.name, search) && (
    filter === 'all' ? true : filter === 'over' ? r.planned + r.declared > 0 : filter === 'sub' ? r.np + r.budget > 0 : st(r).key === filter))

  const tot = all.reduce((a, r) => ({ planned: a.planned + r.planned, declared: a.declared + r.declared, np: a.np + r.np, budget: a.budget + r.budget }),
    { planned: 0, declared: 0, np: 0, budget: 0 })
  const sum = (r: { declared: number; budget: number; np: number }) => r.declared * R.over + r.budget * R.sub + r.np * R.np

  async function toggle(id: string) {
    if (open === id) { setOpen(null); return }
    setOpen(id)
    if (details[id]) return
    setDetails(p => ({ ...p, [id]: 'loading' }))
    const res: any = await getReviewDetail(id, first, last)
    if (res?.error) { toast(res.error, 'error'); setDetails(p => { const x = { ...p }; delete x[id]; return x }); return }
    setDetails(p => ({ ...p, [id]: res as Detail }))
  }

  async function setStatus(r: Row, d: Decl, verify: boolean) {
    setBusy(d.id)
    const res: any = verify ? await verifyDeclaration(d.id) : await unverifyDeclaration(d.id)
    setBusy(null)
    if (res?.error) { toast(res.error, 'error'); return }
    setRows(prev => (prev || []).map(x => x.staffId !== r.staffId ? x : { ...x, decls: x.decls.map(y => y.id === d.id ? { ...y, status: verify ? 'verified' : 'submitted' } : y) }))
    toast(verify ? 'Декларацията е потвърдена' : 'Върната като подадена')
  }

  const [genning, setGenning] = useState(false)
  async function paymentOrder() {
    if (!all.length) return
    if (counts.missing > 0 && !confirm(`${counts.missing} служители не са подали декларация за над норматив — техните часове над норматив няма да влязат. Продължаваме ли?`)) return
    setGenning(true)
    try {
      await generateLecturerPaymentOrder({
        periodLabel: `${period.label} г.`, yearName: '', rateOver: R.over, rateSub: R.sub, rateNp: R.np,
        rows: all.map(r => ({ name: r.name, position: r.position, overNorm: r.declared, budgetSub: r.budget, np: r.np })),
      })
    } catch (e) { /* noop */ }
    setGenning(false)
  }

  const tab = (k: Filter, label: string, c: number, tone = '') => (
    <button key={k} onClick={() => setFilter(k)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === k ? 'bg-white shadow-sm border border-slate-200 text-[#0f2240]' : 'text-slate-500 hover:text-slate-700'}`}>
      {label} <span className={`px-1.5 rounded-full text-[10px] ${c > 0 && tone ? tone : 'bg-slate-100 text-slate-500'}`}>{c}</span>
    </button>
  )
  const th = 'px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-400'
  const td = 'px-3 py-2.5 text-sm tabular-nums'

  return (
    <div className="space-y-4">
      {/* Период + обобщение */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Период</label>
            <select value={periodKey} onChange={e => setPeriodKey(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer">
              {periods.map(p => <option key={p.key} value={p.key}>{p.label}{p.current ? ' (текущ)' : !p.open ? ' (предстои)' : ''}</option>)}
            </select>
          </div>
          {!period.open && (
            <div className="text-xs text-amber-700 pb-1.5">Периодът не е приключил — декларациите се подават от {fmt(period.opensOn)}.</div>
          )}
          <button onClick={paymentOrder} disabled={genning || loading || !all.length}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white text-sm hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: '#0f2240' }}
            title="Над норматив — по реализираните (декларирани) часове; заместване — по заповедите">
            {genning ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Заповед за изплащане
          </button>
        </div>
        {!loading && !error && all.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 px-3 py-2.5">
              <div className="text-[11px] text-slate-500">Над норматив — реализирани</div>
              <div className="text-xl font-semibold text-slate-800 tabular-nums">{tot.declared} <span className="text-sm font-normal text-slate-400">от {tot.planned} по график</span></div>
            </div>
            <div className="rounded-xl border border-slate-200 px-3 py-2.5">
              <div className="text-[11px] text-slate-500">Заместване НП</div>
              <div className="text-xl font-semibold text-emerald-700 tabular-nums">{tot.np} <span className="text-sm font-normal text-slate-400">ч.</span></div>
            </div>
            <div className="rounded-xl border border-slate-200 px-3 py-2.5">
              <div className="text-[11px] text-slate-500">Заместване бюджет</div>
              <div className="text-xl font-semibold text-slate-800 tabular-nums">{tot.budget} <span className="text-sm font-normal text-slate-400">ч.</span></div>
            </div>
            <div className="rounded-xl border border-slate-200 px-3 py-2.5">
              <div className="text-[11px] text-slate-500">Сума</div>
              <div className="text-xl font-semibold text-slate-800 tabular-nums">{money(sum(tot))} <span className="text-sm font-normal text-slate-400">€</span></div>
            </div>
          </div>
        )}
        <RatesPanel rates={rates} />
        {!loading && (counts.missing > 0 || counts.pending > 0) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <AlertTriangle size={14} className="text-amber-500" />
            {counts.missing > 0 && <button onClick={() => setFilter('missing')} className="text-rose-700 hover:underline">{counts.missing} неподадени декларации</button>}
            {counts.missing > 0 && counts.pending > 0 && <span className="text-slate-300">·</span>}
            {counts.pending > 0 && <button onClick={() => setFilter('pending')} className="text-blue-700 hover:underline">{counts.pending} чакат проверка</button>}
          </div>
        )}
      </div>

      {/* Филтри + търсене */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100/80 border border-slate-200">
          {tab('all', 'Всички', counts.all)}
          {tab('over', 'Над норматив', counts.over)}
          {tab('sub', 'Заместване', counts.sub)}
          {tab('pending', 'Чакат проверка', counts.pending, 'bg-blue-100 text-blue-700')}
          {tab('missing', 'Неподадени', counts.missing, 'bg-rose-100 text-rose-700')}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Търси служител…"
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400"><Loader2 size={20} className="animate-spin inline" /></div>
        ) : error ? (
          <div className="py-10 text-center text-sm text-rose-500">{error}</div>
        ) : shown.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">{all.length ? 'Няма служители по този филтър.' : 'Няма лекторски часове за този период.'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th />
                  <th />
                  <th colSpan={3} className={`${th} text-center border-l border-slate-200`}>Над норматив</th>
                  <th colSpan={2} className={`${th} text-center border-l border-slate-200`}>Заместване</th>
                  <th colSpan={2} className={`${th} border-l border-slate-200`} />
                </tr>
                <tr className="border-b border-slate-200">
                  <th className="w-8" />
                  <th className={`${th} text-left`}>Служител</th>
                  <th className={`${th} text-right border-l border-slate-200`} title="Часовете по заповедта (графика) в учебните дни на периода, без отпуск/болничен">По график</th>
                  <th className={`${th} text-right`} title="Декларирани от учителя — реално взети; невзетите не се прехвърлят">Реализирани</th>
                  <th className={`${th} text-left`}>Декларация</th>
                  <th className={`${th} text-right border-l border-slate-200`}>НП</th>
                  <th className={`${th} text-right`}>Бюджет</th>
                  <th className={`${th} text-right border-l border-slate-200`}>Общо, ч.</th>
                  <th className={`${th} text-right`} title={`Над норматив × ${eurStr(R.over)} € + заместване бюджет × ${eurStr(R.sub)} € + НП × ${eurStr(R.np)} €`}>Сума, €</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const s = st(r)
                  const isOpen = open === r.staffId
                  const det = details[r.staffId]
                  const notTaken = r.hasDecl ? Math.max(0, r.planned - r.declared) : 0
                  return (
                    <Fragment key={r.staffId}>
                      <tr onClick={() => toggle(r.staffId)} className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${isOpen ? 'bg-slate-50' : ''}`}>
                        <td className="pl-3 text-slate-400">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                        <td className="px-3 py-2.5">
                          <div className="text-sm text-slate-800">{r.name}</div>
                          <div className="text-[11px] text-slate-400">{r.position}</div>
                        </td>
                        <td className={`${td} text-right text-slate-500 border-l border-slate-100`}>{n(r.planned)}</td>
                        <td className={`${td} text-right`}>
                          <div className="text-slate-800 font-medium">{r.hasDecl ? r.declared : <span className="text-slate-300">—</span>}</div>
                          {notTaken > 0 && <div className="text-[10px] text-slate-400">{notTaken} невзети</div>}
                        </td>
                        <td className="px-3 py-2.5">
                          {s.key === 'none' ? <span className="text-slate-300 text-sm">—</span>
                            : <span className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${s.cls}`}>{s.label}</span>}
                        </td>
                        <td className={`${td} text-right text-emerald-700 border-l border-slate-100`}>{n(r.np)}</td>
                        <td className={`${td} text-right text-slate-700`}>{n(r.budget)}</td>
                        <td className={`${td} text-right font-medium text-slate-900 border-l border-slate-100`}>{n(r.declared + r.np + r.budget)}</td>
                        <td className={`${td} text-right text-slate-700`}>{money(sum(r))}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-slate-200 bg-slate-50/60">
                          <td />
                          <td colSpan={8} className="px-3 py-4">
                            {det === 'loading' || !det ? (
                              <Loader2 size={16} className="animate-spin text-slate-400" />
                            ) : (
                              <div className="grid gap-4 lg:grid-cols-2">
                                {/* Над норматив */}
                                <div className="bg-white rounded-xl border border-slate-200 p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Над норматив</div>
                                    {r.planned > 0 && <div className="text-xs text-slate-500">реализирани {r.declared} от {r.planned}</div>}
                                  </div>
                                  {det.over.length === 0 ? <div className="text-xs text-slate-400">Няма часове по заповед в периода.</div> : (
                                    <div className="space-y-2.5">
                                      {det.over.map(o => (
                                        <div key={o.slotId}>
                                          <div className="text-[12px] text-slate-700 mb-1">{DAY[o.day]} · {o.period}. час · {o.subject}{o.holder ? <span className="text-slate-400"> · {o.holder}</span> : null}</div>
                                          <div className="flex flex-wrap gap-1">
                                            {o.dates.map(d => (
                                              <span key={d.date} title={d.absent ? 'отпуск/болничен' : d.declared ? 'деклариран (взет)' : 'не е деклариран (невзет)'}
                                                className={`text-[11px] px-1.5 py-0.5 rounded border tabular-nums ${d.absent ? 'bg-amber-50 border-amber-200 text-amber-700 line-through'
                                                  : d.declared ? 'bg-[#0f2240] border-[#0f2240] text-white' : 'bg-white border-slate-200 text-slate-400 line-through'}`}>
                                                {short(d.date)}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                      <div className="flex flex-wrap gap-3 text-[10px] text-slate-400 pt-1">
                                        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#0f2240] align-middle mr-1" />деклариран</span>
                                        <span><span className="inline-block w-2.5 h-2.5 rounded-sm border border-slate-300 align-middle mr-1" />невзет</span>
                                        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-200 align-middle mr-1" />отпуск/болничен</span>
                                      </div>
                                    </div>
                                  )}
                                  {r.decls.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                                      {r.decls.map(d => (
                                        <div key={d.id} className="flex flex-wrap items-center gap-2 text-xs">
                                          <span className="text-slate-600">Декларация {fmt(d.from)} – {fmt(d.to)} · {d.hours} ч.</span>
                                          <span className={`px-2 py-0.5 rounded-full border ${d.status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : d.status === 'paid' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                            {d.status === 'verified' ? 'проверена' : d.status === 'paid' ? 'изплатена' : 'чака проверка'}
                                          </span>
                                          {d.status === 'submitted' && (
                                            <button onClick={e => { e.stopPropagation(); setStatus(r, d, true) }} disabled={busy === d.id}
                                              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-white disabled:opacity-50" style={{ backgroundColor: '#059669' }}>
                                              {busy === d.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Потвърди
                                            </button>
                                          )}
                                          {d.status === 'verified' && (
                                            <button onClick={e => { e.stopPropagation(); setStatus(r, d, false) }} disabled={busy === d.id}
                                              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                                              <Undo2 size={12} /> Върни
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {/* Заместване */}
                                <div className="bg-white rounded-xl border border-slate-200 p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Заместване</div>
                                    {r.np + r.budget > 0 && <div className="text-xs text-slate-500">{r.np > 0 ? `НП ${r.np}` : ''}{r.np > 0 && r.budget > 0 ? ' · ' : ''}{r.budget > 0 ? `бюджет ${r.budget}` : ''} ч.</div>}
                                  </div>
                                  {det.subs.length === 0 ? <div className="text-xs text-slate-400">Няма платени замествания в периода.</div> : (
                                    <table className="w-full text-xs">
                                      <thead><tr className="text-[10px] uppercase tracking-wider text-slate-400">
                                        <th className="text-left font-medium py-1">Дата</th>
                                        <th className="text-left font-medium py-1">Замествал</th>
                                        <th className="text-left font-medium py-1">Часове</th>
                                        <th className="text-right font-medium py-1">Вид</th>
                                      </tr></thead>
                                      <tbody>
                                        {det.subs.map((sd, i) => (
                                          <tr key={i} className="border-t border-slate-100 align-top">
                                            <td className="py-1.5 pr-2 tabular-nums text-slate-700 whitespace-nowrap">{DAY[new Date(sd.date + 'T00:00').getDay()] || ''} {short(sd.date)}</td>
                                            <td className="py-1.5 pr-2 text-slate-700">{sd.absent}</td>
                                            <td className="py-1.5 pr-2 text-slate-600">
                                              {sd.items.map((it, k) => <div key={k}>{it.period}. · {it.cls}{it.subject ? <span className="text-slate-400"> · {it.subject}</span> : null}</div>)}
                                            </td>
                                            <td className="py-1.5 text-right whitespace-nowrap">
                                              <span className={sd.np ? 'text-emerald-700' : 'text-slate-600'}>{sd.items.length} ч. {sd.np ? 'НП' : 'бюджет'}</span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              {shown.length > 1 && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50/60">
                    <td />
                    <td className="px-3 py-2 text-xs text-slate-500">Общо ({shown.length})</td>
                    <td className={`${td} text-right text-slate-500 border-l border-slate-100`}>{shown.reduce((a, r) => a + r.planned, 0)}</td>
                    <td className={`${td} text-right font-medium`}>{shown.reduce((a, r) => a + r.declared, 0)}</td>
                    <td />
                    <td className={`${td} text-right text-emerald-700 border-l border-slate-100`}>{shown.reduce((a, r) => a + r.np, 0)}</td>
                    <td className={`${td} text-right`}>{shown.reduce((a, r) => a + r.budget, 0)}</td>
                    <td className={`${td} text-right font-medium border-l border-slate-100`}>{shown.reduce((a, r) => a + r.declared + r.np + r.budget, 0)}</td>
                    <td className={`${td} text-right font-medium`}>{money(shown.reduce((a, r) => a + sum(r), 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        <p className="px-4 py-2.5 text-[11px] text-slate-400 border-t border-slate-100">
          Над норматив се изплаща по реализираните (декларирани) часове — не повече от графика; невзетите не се прехвърлят към друг период.
          Заместването — по заповедите (вътрешните, в рамките на нормата, не се броят).
          Щракни на ред за подробности по дни.
        </p>
      </div>

      {/* Архив — само за справка, за избрания период */}
      <details className="group">
        <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 select-none">Всички декларации за периода (архив)</summary>
        <div className="mt-3">
          <ReviewClient key={first} rows={archive.filter(a => a.periodFrom <= last && a.periodTo >= first)} />
        </div>
      </details>
    </div>
  )
}
