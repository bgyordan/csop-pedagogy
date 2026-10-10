'use client'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search, FileDown, Check, X, Inbox, Banknote, RotateCcw, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { smartMatch } from '@/lib/search'
import { declarationPeriods, defaultPeriod, deadlineOf, sofiaTodayIso } from '@/lib/declaration-periods'
import { effectiveRates, type LecturerRates } from '@/lib/lecturer-rates'
import { generateLecturerPaymentOrder } from '@/lib/docx-substitution'
import { getCheckMonth, getCellDetail, setCheck, type Check as CheckT, type CheckKind, type CheckRow, type DetailLine } from './actions'

type Tab = 'sub' | 'over'
type Filter = 'all' | 'missing' | 'todo' | 'ok' | 'issue'
type StateKey = 'current' | 'waiting' | 'missing' | 'received' | 'ok' | 'issue' | 'changed' | 'paid'

const fmt = (iso: string) => iso ? iso.slice(0, 10).split('-').reverse().join('.') : ''
const KIND_LABEL: Record<CheckKind, string> = { sub_budget: 'Бюджет', sub_np: 'НП', over: 'Над норматив' }

const STATE: Record<StateKey, { label: string; cls: string; dot: string }> = {
  current:  { label: 'текущ месец',               cls: 'bg-slate-50 text-slate-400 border-slate-200',      dot: 'bg-slate-300' },
  waiting:  { label: 'очаква се',                 cls: 'bg-white text-slate-500 border-slate-200',         dot: 'bg-slate-400' },
  missing:  { label: 'липсва',                    cls: 'bg-rose-50 text-rose-700 border-rose-200',         dot: 'bg-rose-500' },
  received: { label: 'получена',                  cls: 'bg-sky-50 text-sky-700 border-sky-200',            dot: 'bg-sky-500' },
  ok:       { label: 'проверена',                 cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  issue:    { label: 'несъответствие',            cls: 'bg-pink-50 text-pink-700 border-pink-200',         dot: 'bg-pink-500' },
  changed:  { label: 'променено след проверката', cls: 'bg-amber-50 text-amber-800 border-amber-200',      dot: 'bg-amber-500' },
  paid:     { label: 'изплатена',                 cls: 'bg-slate-100 text-slate-500 border-slate-200',     dot: 'bg-slate-400' },
}

function stateOf(hours: number, c: CheckT | undefined, periodTo: string, today: string): { key: StateKey; late: boolean } {
  const due = deadlineOf(periodTo)
  const late = !!c?.receivedAt && fmtIso(c.receivedAt) > due
  if (c?.paidAt) return { key: 'paid', late }
  if (c?.status === 'ok') return { key: c.hoursAtCheck !== null && c.hoursAtCheck !== hours ? 'changed' : 'ok', late }
  if (c?.status === 'issue') return { key: 'issue', late }
  if (c?.receivedAt) return { key: 'received', late }
  if (today <= periodTo) return { key: 'current', late: false }
  return { key: today > due ? 'missing' : 'waiting', late: false }
}
// ISO дата по българско време от timestamp
function fmtIso(ts: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts))
}

export default function CheckClient({ rates }: { rates: LecturerRates }) {
  const { toast } = useToast()
  const R = effectiveRates(rates)
  const today = sofiaTodayIso()
  const months = useMemo(() => declarationPeriods('sub'), [])
  const overPeriods = useMemo(() => declarationPeriods('over'), [])
  const [monthKey, setMonthKey] = useState(() => defaultPeriod(months).key)
  const month = months.find(m => m.key === monthKey) || months[0]
  const over = overPeriods.find(p => p.to === month.to) || null   // окт. → септ.–окт.; септ. → няма

  const [tab, setTab] = useState<Tab>('sub')
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<CheckRow[] | null>(null)
  const [checks, setChecks] = useState<CheckT[]>([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)          // `${staffId}|${kind}`
  const [detail, setDetail] = useState<Record<string, { lines: DetailLine[]; hasDecl?: boolean } | 'loading'>>({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setRows(null); setError(''); setOpen(null); setDetail({})
    const res: any = await getCheckMonth({ from: month.from, to: month.to }, over ? { from: over.from, to: over.to } : null)
    if (res.error) { setError(res.error); setRows([]); return }
    setRows(res.data); setChecks(res.checks)
  }, [month.from, month.to, over?.from, over?.to])
  useEffect(() => { load() }, [load])

  // клетките на таба: вид + период + часове
  type Cell = { kind: CheckKind; from: string; to: string; hours: number; extra?: string }
  const cellsOf = (r: CheckRow): Cell[] => tab === 'sub'
    ? [
        ...(r.subBudget > 0 ? [{ kind: 'sub_budget' as const, from: month.from, to: month.to, hours: r.subBudget }] : []),
        ...(r.subNp > 0 ? [{ kind: 'sub_np' as const, from: month.from, to: month.to, hours: r.subNp }] : []),
      ]
    : over && (r.overPlanned + r.overDeclared > 0)
      ? [{ kind: 'over' as const, from: over.from, to: over.to, hours: r.overDeclared || r.overPlanned,
           extra: r.overDeclared ? `по график ${r.overPlanned}` : 'не е подадена в системата' }]
      : []
  const checkOf = (staffId: string, c: Cell) => checks.find(x => x.staffId === staffId && x.kind === c.kind && x.from === c.from && x.to === c.to)
  const st = (r: CheckRow, c: Cell) => stateOf(c.hours, checkOf(r.staffId, c), c.to, today)

  const tabRows = (rows || []).filter(r => cellsOf(r).length > 0)
  const matches = (r: CheckRow, f: Filter) => {
    if (f === 'all') return true
    const keys = cellsOf(r).map(c => st(r, c).key)
    if (f === 'missing') return keys.some(k => k === 'missing' || k === 'waiting')
    if (f === 'todo') return keys.some(k => k === 'received' || k === 'changed')
    if (f === 'ok') return keys.every(k => k === 'ok' || k === 'paid')
    return keys.includes('issue')
  }
  const visible = tabRows.filter(r => matches(r, filter) && (!search.trim() || smartMatch(r.name + ' ' + r.position, search)))
  const count = (f: Filter) => tabRows.filter(r => matches(r, f)).length
  const subCount = (rows || []).filter(r => r.subBudget + r.subNp > 0).length
  const overCount = over ? (rows || []).filter(r => r.overPlanned + r.overDeclared > 0).length : 0

  async function toggle(r: CheckRow, c: Cell) {
    const id = `${r.staffId}|${c.kind}`
    setNote(checkOf(r.staffId, c)?.note || '')
    if (open === id) { setOpen(null); return }
    setOpen(id)
    if (detail[id] && detail[id] !== 'loading') return
    setDetail(p => ({ ...p, [id]: 'loading' }))
    const res = await getCellDetail(r.staffId, c.kind, c.from, c.to)
    if (res.error) { toast(res.error, 'error'); setDetail(p => { const x = { ...p }; delete x[id]; return x }); return }
    setDetail(p => ({ ...p, [id]: { lines: res.lines || [], hasDecl: res.hasDecl } }))
  }

  async function act(r: CheckRow, c: Cell, action: 'received' | 'ok' | 'issue' | 'paid' | 'unpaid' | 'reset') {
    if (action === 'issue' && !note.trim()) { toast('Напиши какво не съвпада', 'error'); return }
    if (action === 'reset' && !confirm('Да се изчистят всички отметки по тази декларация?')) return
    setBusy(true)
    const res: any = await setCheck({ staffId: r.staffId, kind: c.kind, from: c.from, to: c.to, action, note, hours: c.hours })
    setBusy(false)
    if (res?.error) { toast(res.error, 'error'); return }
    const now = new Date().toISOString()
    setChecks(prev => {
      const rest = prev.filter(x => !(x.staffId === r.staffId && x.kind === c.kind && x.from === c.from && x.to === c.to))
      if (action === 'reset') return rest
      const cur = prev.find(x => x.staffId === r.staffId && x.kind === c.kind && x.from === c.from && x.to === c.to)
        || { staffId: r.staffId, kind: c.kind, from: c.from, to: c.to, receivedAt: null, status: null, note: null, hoursAtCheck: null, paidAt: null }
      const next = { ...cur, receivedAt: cur.receivedAt || now }
      if (action === 'ok' || action === 'issue') Object.assign(next, { status: action, note: action === 'issue' ? note.trim() : null, hoursAtCheck: c.hours })
      if (action === 'paid') next.paidAt = now
      if (action === 'unpaid') next.paidAt = null
      return [...rest, next]
    })
  }

  // заповед за изплащане — само проверените (ОК) декларации от таба
  const [genning, setGenning] = useState(false)
  const [orderMenu, setOrderMenu] = useState(false)
  async function paymentOrder(mode: 'combined' | 'separate' = 'combined') {
    setOrderMenu(false)
    const okRows = tabRows.map(r => {
      const ok = (k: CheckKind) => { const c = cellsOf(r).find(x => x.kind === k); return c && ['ok', 'paid'].includes(st(r, c).key) ? c.hours : 0 }
      return { name: r.name, position: r.position, overNorm: tab === 'over' ? ok('over') : 0, budgetSub: tab === 'sub' ? ok('sub_budget') : 0, np: tab === 'sub' ? ok('sub_np') : 0 }
    }).filter(x => x.overNorm + x.budgetSub + x.np > 0)
    if (!okRows.length) { toast('Няма проверени декларации за заповед', 'error'); return }
    const notOk = tabRows.length - okRows.length
    if (notOk > 0 && !confirm(`${notOk} служители още нямат проверена декларация и няма да влязат в заповедта. Продължаваме ли?`)) return
    setGenning(true)
    try {
      await generateLecturerPaymentOrder({
        periodLabel: `${tab === 'over' && over ? over.label : month.label} г.`, yearName: '',
        rateOver: R.over, rateSub: R.sub, rateNp: R.np, rows: okRows,
      }, mode)
    } catch { /* */ }
    setGenning(false)
  }

  const due = deadlineOf(tab === 'over' && over ? over.to : month.to)
  const daysLeft = Math.round((Date.parse(due) - Date.parse(today)) / 86400000)

  const pill = (k: Filter, label: string) => (
    <button key={k} onClick={() => setFilter(k)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition ${filter === k ? 'bg-white shadow-sm border border-slate-200 text-[#0f2240] font-medium' : 'text-slate-500 hover:text-slate-700'}`}>
      {label} <span className="px-1.5 rounded-full text-[10px] bg-slate-100 text-slate-500">{count(k)}</span>
    </button>
  )
  const bigTab = (k: Tab, label: string, n: number) => (
    <button onClick={() => { setTab(k); setFilter('all'); setOpen(null) }}
      className={`relative z-10 flex-1 sm:flex-none sm:min-w-[180px] px-5 py-2.5 rounded-xl text-sm transition ${tab === k ? 'bg-white shadow-sm text-[#0f2240] font-medium' : 'text-slate-500 hover:text-slate-700'}`}>
      {label} <span className={`ml-1 text-xs ${tab === k ? 'text-slate-400' : 'text-slate-400'}`}>{n}</span>
    </button>
  )

  return (
    <div className="space-y-5">
      {/* ── ПЕРИОД (главен) ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Месец</div>
        <div className="flex flex-wrap gap-1.5">
          {months.map(m => (
            <button key={m.key} onClick={() => setMonthKey(m.key)}
              className={`px-3 py-1.5 rounded-lg text-sm transition border ${m.key === monthKey
                ? 'bg-teal-50 border-teal-200 text-teal-800 font-medium'
                : m.open ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-white border-dashed border-slate-200 text-slate-300'}`}>
              {m.label.replace(/\s\d{4}$/, '')}
            </button>
          ))}
        </div>
        <div className="mt-3 text-sm text-slate-500 font-light">
          Срок за предаване на декларациите: <span className="font-medium text-slate-700">до {fmt(due)}</span>
          {today <= (tab === 'over' && over ? over.to : month.to)
            ? <span className="text-slate-400"> · месецът още тече</span>
            : daysLeft >= 0 ? <span className="text-slate-400"> · остават {daysLeft} дни</span>
            : <span className="text-rose-600"> · срокът мина</span>}
        </div>
      </div>

      {/* ── ТАБОВЕ ── */}
      <div className="flex p-1 rounded-2xl bg-slate-100 w-full sm:w-fit">
        {bigTab('sub', 'Заместване', subCount)}
        {bigTab('over', 'Над норматив', overCount)}
      </div>

      {tab === 'over' && !over && (
        <div className="px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-500 font-light">
          Над норматив за септември се декларира заедно с октомври — избери <b className="font-medium">октомври</b>.
        </div>
      )}
      {tab === 'over' && over && over.from !== month.from && (
        <div className="text-xs text-slate-400 font-light -mt-2">Периодът за над норматив е {over.label} (септември и октомври заедно).</div>
      )}

      {(tab === 'sub' || over) && (
        <>
          {/* лента: филтри · търсене · заповед */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap p-0.5 rounded-xl bg-slate-50 border border-slate-100">
              {pill('all', 'Всички')}{pill('missing', 'Не са предадени')}{pill('todo', 'За проверка')}{pill('ok', 'Проверени')}{pill('issue', 'Несъответствие')}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Търси служител…"
                className="pl-8 pr-3 py-1.5 w-52 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-100" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {tab === 'sub' && (
                <Link href="/mon-export" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50">
                  <FileSpreadsheet size={14} /> МОН отчет (НП)
                </Link>
              )}
              <div className="relative">
                <button onClick={() => tab === 'sub' ? setOrderMenu(o => !o) : paymentOrder()} disabled={genning}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 text-sm text-teal-800 hover:bg-teal-100 disabled:opacity-50">
                  {genning ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Заповед за изплащане
                </button>
                {orderMenu && (
                  <div className="absolute right-0 z-30 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white shadow-lg p-1.5">
                    <button onClick={() => paymentOrder('separate')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-teal-50">
                      <div className="text-sm text-slate-800">Две отделни заповеди</div>
                      <div className="text-[11px] text-slate-400 font-light">бюджет и НП — в един файл, всяка на своя страница; НП-заповедта е за портала</div>
                    </button>
                    <button onClick={() => paymentOrder('combined')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-teal-50">
                      <div className="text-sm text-slate-800">Обща заповед</div>
                      <div className="text-[11px] text-slate-400 font-light">една заповед с две точки — бюджет и НП</div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* легенда */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 font-light">
            {(['waiting', 'missing', 'received', 'ok', 'issue', 'changed', 'paid'] as StateKey[]).map(k => (
              <span key={k} className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${STATE[k].dot}`} />{STATE[k].label}</span>
            ))}
          </div>

          {/* списък */}
          {error && <div className="px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div>}
          {!rows ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-10 justify-center"><Loader2 size={16} className="animate-spin" /> Зареждане…</div>
          ) : visible.length === 0 ? (
            <div className="text-sm text-slate-400 font-light py-10 text-center">
              {tabRows.length === 0 ? (tab === 'sub' ? 'Няма замествания с лекторски часове за този месец.' : 'Няма часове над норматив за този период.') : 'Няма служители по този филтър.'}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
              {visible.map((r, i) => (
                <Fragment key={r.staffId}>
                  <div className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-800 truncate">{r.name}</div>
                      <div className="text-[11px] text-slate-400 font-light truncate">{r.position}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {cellsOf(r).map(c => {
                        const s = st(r, c), id = `${r.staffId}|${c.kind}`
                        return (
                          <button key={c.kind} onClick={() => toggle(r, c)}
                            className={`text-left min-w-[150px] px-3 py-1.5 rounded-xl border transition hover:shadow-sm ${STATE[s.key].cls} ${open === id ? 'ring-2 ring-teal-200' : ''}`}>
                            <div className="flex items-center justify-between gap-3 text-[11px]">
                              <span className="opacity-80">{KIND_LABEL[c.kind]}</span>
                              <span className="font-medium tabular-nums">{c.hours} ч.</span>
                            </div>
                            <div className="text-[11px] font-light">
                              {STATE[s.key].label}{s.late && <span className="text-amber-700"> · закъсняла</span>}
                            </div>
                            {c.extra && <div className="text-[10px] font-light opacity-70">{c.extra}</div>}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* подробности — същите редове като в декларацията */}
                  {cellsOf(r).filter(c => open === `${r.staffId}|${c.kind}`).map(c => {
                    const id = `${r.staffId}|${c.kind}`, d = detail[id], chk = checkOf(r.staffId, c), s = st(r, c)
                    return (
                      <div key={id} className="px-4 py-4 bg-slate-50/70 border-t border-slate-100">
                        <div className="text-xs text-slate-500 font-light mb-2">
                          {KIND_LABEL[c.kind]} · {fmt(c.from)} – {fmt(c.to)} · <span className="text-slate-700">това е в декларацията на колегата — сравни ред по ред</span>
                        </div>
                        {d === 'loading' || !d ? (
                          <div className="flex items-center gap-2 text-sm text-slate-400 py-4"><Loader2 size={14} className="animate-spin" /> Зареждане…</div>
                        ) : (
                          <DetailTable kind={c.kind} lines={d.lines} />
                        )}
                        {c.kind === 'over' && d && d !== 'loading' && !d.hasDecl && (
                          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-700"><AlertTriangle size={13} /> Колегата не е подал декларацията през системата — показан е графикът.</div>
                        )}
                        {s.key === 'changed' && (
                          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-800"><AlertTriangle size={13} /> При проверката бяха {chk?.hoursAtCheck} ч., сега системата показва {c.hours} ч. Провери отново.</div>
                        )}

                        {/* отметки */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {!chk?.receivedAt && (
                            <ActBtn onClick={() => act(r, c, 'received')} disabled={busy} icon={<Inbox size={14} />} tone="sky">Получена</ActBtn>
                          )}
                          <ActBtn onClick={() => act(r, c, 'ok')} disabled={busy} icon={<Check size={14} />} tone="emerald">ОК — съвпада</ActBtn>
                          <input value={note} onChange={e => setNote(e.target.value)} placeholder="какво не съвпада…"
                            className="px-3 py-1.5 w-56 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-100" />
                          <ActBtn onClick={() => act(r, c, 'issue')} disabled={busy} icon={<X size={14} />} tone="pink">Несъответствие</ActBtn>
                          {(chk?.status === 'ok') && !chk.paidAt && <ActBtn onClick={() => act(r, c, 'paid')} disabled={busy} icon={<Banknote size={14} />} tone="slate">Изплатена</ActBtn>}
                          {chk?.paidAt && <ActBtn onClick={() => act(r, c, 'unpaid')} disabled={busy} icon={<RotateCcw size={14} />} tone="slate">Не е изплатена</ActBtn>}
                          {chk && <button onClick={() => act(r, c, 'reset')} disabled={busy} className="ml-auto text-xs text-slate-400 hover:text-rose-600">изчисти отметките</button>}
                        </div>
                        {chk && (
                          <div className="mt-2 text-[11px] text-slate-400 font-light">
                            {chk.receivedAt && <>получена {fmt(fmtIso(chk.receivedAt))}{s.late && <span className="text-amber-700"> (след срока {fmt(deadlineOf(c.to))})</span>}</>}
                            {chk.status === 'issue' && chk.note && <> · <span className="text-pink-700">{chk.note}</span></>}
                            {chk.paidAt && <> · изплатена {fmt(fmtIso(chk.paidAt))}</>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ActBtn({ onClick, disabled, icon, tone, children }: { onClick: () => void; disabled?: boolean; icon: React.ReactNode; tone: 'sky' | 'emerald' | 'pink' | 'slate'; children: React.ReactNode }) {
  const t = { sky: 'border-sky-200 text-sky-700 hover:bg-sky-50', emerald: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50', pink: 'border-pink-200 text-pink-700 hover:bg-pink-50', slate: 'border-slate-200 text-slate-600 hover:bg-slate-100' }[tone]
  return (
    <button onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white text-sm transition disabled:opacity-50 ${t}`}>
      {icon}{children}
    </button>
  )
}

// Таблицата — колоните като в хартиената декларация
function DetailTable({ kind, lines }: { kind: CheckKind; lines: DetailLine[] }) {
  if (!lines.length) return <div className="text-sm text-slate-400 font-light py-2">Няма редове.</div>
  const th = 'px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400 text-left'
  const td = 'px-3 py-1.5 text-sm text-slate-700 tabular-nums'
  const sub = kind !== 'over'
  const total = lines.filter(l => !l.mark || l.mark === 'declared').reduce((a, l) => a + l.hours, 0)
  const MARK: Record<string, string> = { missing: 'не е деклариран', absent: 'в отсъствие' }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className={th}>Дата</th>
            {sub && <th className={th}>Заповед</th>}
            <th className={th}>{sub ? 'Клас' : 'Група'}</th>
            <th className={th}>Предмет</th>
            <th className={`${th} text-right`}>Часове</th>
            <th className={th}>{sub ? 'Отсъстващ' : ''}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.map((l, i) => {
            const off = l.mark && l.mark !== 'declared'
            return (
              <tr key={i} className={off ? 'text-slate-300' : i % 2 ? 'bg-slate-50/50' : ''}>
                <td className={`${td} ${off ? 'text-slate-400 line-through' : ''}`}>{l.date}</td>
                {sub && <td className={td}>{l.orderRef}</td>}
                <td className={`${td} ${off ? 'text-slate-400' : ''}`}>{l.cls}</td>
                <td className={`${td} ${off ? 'text-slate-400' : ''}`}>{l.subject}</td>
                <td className={`${td} text-right ${off ? 'text-slate-400' : ''}`}>{l.hours}</td>
                <td className={`${td} ${off ? 'text-slate-400 text-xs' : ''}`}>{sub ? l.absent : off ? MARK[l.mark!] : ''}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="border-t border-slate-200 bg-slate-50">
          <tr><td colSpan={sub ? 4 : 3} className="px-3 py-1.5 text-xs text-slate-500 text-right">Общо:</td><td className="px-3 py-1.5 text-sm font-medium text-right tabular-nums">{total}</td><td /></tr>
        </tfoot>
      </table>
    </div>
  )
}
