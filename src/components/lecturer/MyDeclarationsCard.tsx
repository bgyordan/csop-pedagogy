'use client'
// „Моите декларации“ — един бутон, един Word файл за периода, всяка декларация на своя страница:
// заместване НП, заместване бюджет, над норматив, ИФО / логопед (само тези, по които има часове).
// Генерира се една седмица — от 5-то до 11-то число на месеца след периода. Над норматив влиза
// по графика, без дните в отпуск/болничен и без неучебните дни; декларацията се записва за проверката.
// Прегледът „Какво ще влезе“ се вижда през целия период (по дати, махнатите — задраскани с причината);
// седмицата 5–11 ограничава само бутона за изтегляне.
// РЕДАКЦИЯ (в седмицата 5–11): декларацията е за ВЗЕТИ часове и е на колегата — той я коригира преди изтеглянето.
//  • над норматив / ИФО / логопед: щраква дата → маха часа (напр. ИФО детето не е дошло) или връща ден,
//    в който системата го води в отпуск, а е бил на работа; неучебен ден не може да се добави;
//  • заместване: −/+ часове на ред (НП — само намаляване), махане на ред и „Добави пропуснато заместване“
//    (бюджет; НП заместване се въвежда от Ванина в „Отсъствия и замествания“ — нужни са заповед и отчет към МОН).
// Корекциите влизат в Word файла и (за над норматив) в записа за проверката; Марина сверява на хартия.
import { useEffect, useState } from 'react'
import { Loader2, FileDown, CalendarClock, Lock, AlertTriangle, Pencil, Check, Plus, Minus, X, RotateCcw } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { declarationPeriods, genPeriod, sofiaTodayIso } from '@/lib/declaration-periods'
import { getMonthlyDeclaration, getMyMonthlyPreview } from '@/app/substitutions/actions'
import { getMyLecturerDates, submitLecturerDeclaration, getMyDeclContext } from '@/app/my-lecturer/actions'
import { generateAllMyDeclarations } from '@/lib/docx-substitution'
import { buildLecturerDecls, declPeriodLabel, type DeclItem } from '@/lib/lecturer-decl'

const fmt = (iso: string) => iso.split('-').reverse().join('.')
const DAY_L = ['', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък']
type Ctx = { teacherName: string; position: string; orderOver: string; orderIfo: string; rate: number; isSpeech: boolean; hasSlots: boolean }
type SubRow = { subId: string; date: string; orderRef: string; cls: string; subject: string; hours: number; items?: { period: number; subject: string }[]; bsch: boolean; kt: string; absentName: string; manual?: boolean }
type Manual = { id: string; iso: string; absentName: string; cls: string; subject: string; hours: number }
const rowKey = (r: SubRow) => `${r.subId}|${r.date}|${r.cls}`
const dmyToIso = (d: string) => d.split('.').reverse().join('-')
type OverRow = { slotId: string; dates: string[]; absent?: string[]; off?: { date: string; note: string }[]; day?: number; period: number; subject: string; holderType?: string; holderLabel: string; validFrom?: string; validTo?: string }

export default function MyDeclarationsCard({ onDone }: { onDone?: () => void }) {
  const { toast } = useToast()
  const periods = declarationPeriods('over', sofiaTodayIso())
  const [key, setKey] = useState(() => genPeriod(periods).key)
  const period = periods.find(p => p.key === key) || periods[0]
  const today = sofiaTodayIso()
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [sub, setSub] = useState<any | null>(null)   // данните за заместването (и празни — за ставката и името)
  const [over, setOver] = useState<OverRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  // ── редакция ──
  const [edit, setEdit] = useState(false)
  const [removed, setRemoved] = useState<Set<string>>(new Set())    // над норматив: махнати „slotId|дата“
  const [restored, setRestored] = useState<Set<string>>(new Set())  // над норматив: върнати дни (системата ги води в отпуск)
  const [subHours, setSubHours] = useState<Record<string, number>>({})  // заместване: часове на ред (0 = махнат)
  const [manual, setManual] = useState<Manual[]>([])                 // заместване: добавени ръчно (бюджет)
  const [addOpen, setAddOpen] = useState(false)
  const [nf, setNf] = useState({ iso: '', absentName: '', cls: '', subject: '', hours: 1 })
  const k2 = (slotId: string, d: string) => `${slotId}|${d}`
  const toggleIn = (set: (f: (p: Set<string>) => Set<string>) => void, k: string) => set(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })
  function resetEdits() { setRemoved(new Set()); setRestored(new Set()); setSubHours({}); setManual([]); setAddOpen(false) }
  const changed = removed.size + restored.size + Object.keys(subHours).length + manual.length > 0

  useEffect(() => { getMyDeclContext().then((r: any) => { if (!r.error) setCtx(r) }) }, [])
  useEffect(() => {
    setSub(null); setOver([]); resetEdits(); setEdit(false)
    if (!ctx) return
    let alive = true
    setLoading(true)
    Promise.all([
      getMyMonthlyPreview(period.from, period.to),
      ctx.hasSlots ? getMyLecturerDates(period.from, period.to) : Promise.resolve({ rows: [] }),
    ]).then(([s, o]: any[]) => {
      if (!alive) return
      setSub(s?.data || null)
      setOver((o?.rows || []) as OverRow[])
      setLoading(false)
    })
    return () => { alive = false }
  }, [period.key, ctx]) // eslint-disable-line react-hooks/exhaustive-deps

  // над норматив — по графика без дните в отпуск/болничен (освен върнатите) и без махнатите
  const taken = (r: OverRow) => {
    const ab = new Set(r.absent || [])
    return r.dates.filter(d => (!ab.has(d) || restored.has(k2(r.slotId, d))) && !removed.has(k2(r.slotId, d)))
  }
  const overItems: DeclItem[] = over.flatMap(r => taken(r).map(iso => ({ iso, period: r.period, subject: r.subject, holderType: r.holderType, holderLabel: r.holderLabel, validFrom: r.validFrom, validTo: r.validTo })))
  const ifoH = overItems.filter(i => i.holderType === 'ifo').length
  const overH = overItems.length - ifoH

  // заместване — корекциите върху данните (и върху пресните при изтегляне)
  function applySubEdits(data: any) {
    if (!data) return null
    const base: SubRow[] = (data.rows || []).map((r: SubRow) => {
      const h = subHours[rowKey(r)]
      if (h === undefined) return r
      return { ...r, hours: h, items: (r.items || []).slice(0, h) }
    }).filter((r: SubRow) => r.hours > 0)
    const extra: SubRow[] = manual.map(m => ({ subId: m.id, date: fmt(m.iso), orderRef: '—', cls: m.cls, subject: m.subject, hours: m.hours, items: [], bsch: false, kt: '', absentName: m.absentName, manual: true }))
    const rows = [...base, ...extra].sort((a, b) => dmyToIso(a.date).localeCompare(dmyToIso(b.date)))
    const totalHours = rows.reduce((a, r) => a + r.hours, 0)
    const npHours = rows.filter(r => r.bsch).reduce((a, r) => a + r.hours, 0)
    return { ...data, rows, totalHours, npHours, budgetHours: totalHours - npHours }
  }
  const subE = applySubEdits(sub)
  const subRows: SubRow[] = subE?.rows || []
  const npH = subE?.npHours || 0, budgetH = subE?.budgetHours || 0
  const parts = [
    npH && { label: 'Заместване НП', h: npH },
    budgetH && { label: 'Заместване бюджет', h: budgetH },
    overH && { label: ctx?.isSpeech ? 'Над норматив (логопед)' : 'Над норматив', h: overH },
    ifoH && { label: 'ИФО', h: ifoH },
  ].filter(Boolean) as { label: string; h: number }[]
  // заместванията — по отсъстващ колега (дати, часове, заповед), за да се види какво влиза
  const groups = Object.values(subRows.reduce((m: Record<string, any>, r) => {
    const g = m[r.subId] || (m[r.subId] = { id: r.subId, absent: r.absentName, dates: [] as string[], np: 0, budget: 0, order: r.orderRef, manual: !!r.manual })
    if (!g.dates.includes(r.date)) g.dates.push(r.date)
    if (r.bsch) g.np += r.hours; else g.budget += r.hours
    return m
  }, {})) as { id: string; absent: string; dates: string[]; np: number; budget: number; order: string; manual: boolean }[]
  // в редакция — всички редове от системата (и махнатите, за да се върнат) + ръчните
  const editRows: (SubRow & { orig: number; cur: number })[] = [
    ...((sub?.rows || []) as SubRow[]).map(r => ({ ...r, orig: r.hours, cur: subHours[rowKey(r)] ?? r.hours })),
    ...manual.map(m => ({ subId: m.id, date: fmt(m.iso), orderRef: '—', cls: m.cls, subject: m.subject, hours: m.hours, bsch: false, kt: '', absentName: m.absentName, manual: true, orig: m.hours, cur: m.hours })),
  ].sort((a, b) => dmyToIso(a.date).localeCompare(dmyToIso(b.date)))
  function setRowHours(r: SubRow & { orig: number }, h: number) {
    if (r.manual) { setManual(prev => prev.map(m => m.id === r.subId ? { ...m, hours: Math.max(1, Math.min(7, h)) } : m)); return }
    const max = r.bsch ? r.orig : 7      // НП — само намаляване (по заповедта и портала)
    const v = Math.max(0, Math.min(max, h))
    setSubHours(prev => { const n = { ...prev }; if (v === r.orig) delete n[rowKey(r)]; else n[rowKey(r)] = v; return n })
  }
  const maxDay = period.to < today ? period.to : today
  function addManual() {
    if (!nf.iso || nf.iso < period.from || nf.iso > maxDay) { toast(`Дата от ${fmt(period.from)} до ${fmt(maxDay)}`, 'error'); return }
    if (!nf.absentName.trim() || !nf.cls.trim()) { toast('Попълнете кого сте заместили и паралелката', 'error'); return }
    setManual(prev => [...prev, { id: `manual-${Date.now()}`, iso: nf.iso, absentName: nf.absentName.trim(), cls: nf.cls.trim(), subject: nf.subject.trim(), hours: Math.max(1, Math.min(7, nf.hours || 1)) }])
    setNf({ iso: '', absentName: nf.absentName, cls: nf.cls, subject: '', hours: 1 })
    setAddOpen(false)
  }

  async function gen() {
    if (!ctx || !parts.length || !period.genOpen) return
    setBusy(true)
    try {
      // заместванията — наново, през проверката на срока (сървърът пази седмицата 5–11), с корекциите
      const fresh: any = await getMonthlyDeclaration(period.from, period.to)
      if (fresh?.error) { toast(fresh.error, 'error'); setBusy(false); return }
      const e = applySubEdits(fresh?.data || null)
      const subData = e && e.rows.length ? e : null
      // над норматив се записва за проверката (заменя по-ранна непроверена за периода)
      if (overItems.length) {
        const entries = over.map(r => ({ slotId: r.slotId, dates: taken(r) })).filter(x => x.dates.length)
        const res: any = await submitLecturerDeclaration(period.from, period.to, entries)
        if (res.error) { toast(res.error, 'error'); setBusy(false); return }
      }
      const b = buildLecturerDecls({ teacherName: ctx.teacherName, position: ctx.position, periodLabel: declPeriodLabel(period.label),
        orderOver: ctx.orderOver, orderIfo: ctx.orderIfo, isSpeech: ctx.isSpeech, rate: ctx.rate, items: overItems })
      const n = await generateAllMyDeclarations(subData, b.docs, `декларации_${period.label.replace(/\s+/g, '_')}_${ctx.teacherName.replace(/\s+/g, '_')}.docx`)
      toast(n > 1 ? `Изтеглен е един файл с ${n} декларации — всяка на своя страница` : 'Декларацията е изтеглена')
      setEdit(false)
      onDone?.()
    } catch { toast('Грешка при генериране', 'error') }
    setBusy(false)
  }

  const nothing = parts.length === 0 && !(sub?.rows || []).length && over.every(r => !r.dates.length && !(r.off || []).length)
  const inp = 'px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-[#0f2240]'
  const stepBtn = 'w-6 h-6 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:border-[#0f2240] disabled:opacity-30 disabled:hover:border-slate-200'

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-end gap-3 p-4 border-b border-slate-100">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Моите декларации за</label>
          <select value={key} onChange={e => setKey(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none cursor-pointer">
            {periods.map(p => <option key={p.key} value={p.key}>{p.label}{p.genOpen ? ' — сега' : !p.open ? ` — от ${fmt(p.opensOn)}` : ' — мина'}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {period.genOpen && !loading && ctx && (
            <button onClick={() => setEdit(v => !v)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border transition-colors ${edit ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:border-[#0f2240]'}`}>
              {edit ? <><Check size={15} /> Готово</> : <><Pencil size={14} /> Редакция</>}
            </button>
          )}
          <button onClick={gen} disabled={busy || loading || !period.genOpen || !parts.length}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Изтегли декларациите{parts.length ? ` · ${parts.reduce((a, p) => a + p.h, 0)} ч.` : ''}
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {!period.genOpen && (
          <div className="flex items-center gap-2 text-[13px] text-slate-500">
            <Lock size={14} className="text-slate-400 shrink-0" />
            {period.open
              ? <>Седмицата за генериране ({fmt(period.opensOn)} – {fmt(period.closesOn)}) мина — обърнете се към ЗДУД или ЗАС.</>
              : <>Изтегляне от <b className="font-medium text-slate-700">{fmt(period.opensOn)}</b> до <b className="font-medium text-slate-700">{fmt(period.closesOn)}</b>. Отдолу е какво ще влезе; корекции („Редакция“) — при изтеглянето.</>}
          </div>
        )}
        {edit && (
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] px-3 py-2 rounded-xl bg-sky-50/60 border border-sky-100 text-slate-600">
            <Pencil size={13} className="text-sky-600 shrink-0" />
            <span className="flex-1 min-w-0">Декларацията е за взети часове. Щракнете дата, за да махнете или върнете час; при заместване — −/+ часове или добавете пропуснато. Корекциите влизат при „Изтегли“.</span>
            {changed && <button onClick={resetEdits} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"><RotateCcw size={12} /> Върни като в системата</button>}
          </div>
        )}
        {loading || !ctx ? (
          <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={15} className="animate-spin" /> Зареждане…</div>
        ) : nothing && !edit ? (
          <div className="flex items-center gap-2 text-sm text-slate-400"><CalendarClock size={15} /> Няма часове за деклариране за {period.label}.</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Какво ще влезе · {period.label}
              {changed && !edit && <span className="normal-case tracking-normal font-normal text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">с ваши корекции</span>}
            </div>
            {parts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {parts.map(p => (
                  <span key={p.label} className="text-[12.5px] px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">{p.label} · <b className="font-medium">{p.h} ч.</b></span>
                ))}
              </div>
            )}
            {/* над норматив — по часове от графика, всяка дата; махнатите са задраскани с причината */}
            {over.length > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                {over.map(r => {
                  const ab = new Set(r.absent || [])
                  const items = [
                    ...r.dates.map(d => {
                      const k = k2(r.slotId, d)
                      const kind = removed.has(k) ? 'removed' : ab.has(d) ? (restored.has(k) ? 'restored' : 'absent') : d > today ? 'future' : 'ok'
                      const note = kind === 'removed' ? 'махнат от вас — не е взет'
                        : kind === 'restored' ? 'върнат от вас — системата го води в отпуск/болничен'
                        : kind === 'absent' ? 'отпуск / болничен' : kind === 'future' ? 'предстои' : ''
                      return { d, k, kind, note }
                    }),
                    ...(r.off || []).map(o => ({ d: o.date, k: '', kind: 'off', note: o.note })),
                  ].sort((x, y) => x.d.localeCompare(y.d))
                  if (!items.length) return null
                  const h = taken(r).length
                  return (
                    <div key={r.slotId} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="text-[13px] text-slate-800 flex-1 min-w-0 truncate">
                          {r.holderType === 'ifo' ? 'ИФО' : 'Над норматив'} · {r.day ? DAY_L[r.day] + ', ' : ''}{r.period}. час · {r.subject}{r.holderLabel && <span className="text-slate-400"> · {r.holderLabel}</span>}
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">{h} ч.</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {items.map(it => {
                          const cls = `text-[11.5px] tabular-nums px-1.5 py-0.5 rounded-md border ${
                            it.kind === 'ok' ? 'bg-white border-slate-200 text-slate-700'
                            : it.kind === 'restored' ? 'bg-sky-50 border-sky-200 text-sky-700'
                            : it.kind === 'future' ? 'bg-white border-dashed border-slate-200 text-slate-400'
                            : it.kind === 'removed' ? 'bg-amber-50 border-amber-200 text-amber-600 line-through'
                            : 'bg-rose-50/50 border-rose-100 text-rose-400 line-through'}`
                          const click = edit && it.kind !== 'off' && it.kind !== 'future'
                          if (!click) return <span key={it.d} title={it.note || 'влиза'} className={cls}>{fmt(it.d).slice(0, 5)}</span>
                          const onClick = () => it.kind === 'absent' || it.kind === 'restored'
                            ? (removed.has(it.k) ? toggleIn(setRemoved, it.k) : toggleIn(setRestored, it.k))
                            : toggleIn(setRemoved, it.k)
                          return (
                            <button key={it.d} type="button" onClick={onClick}
                              title={it.kind === 'ok' ? 'Взет — щракнете, ако не е взет' : it.kind === 'absent' ? 'Отпуск/болничен — щракнете, ако все пак сте го взели' : `${it.note} (щракнете, за да го върнете)`}
                              className={`${cls} cursor-pointer hover:border-[#0f2240]`}>{fmt(it.d).slice(0, 5)}</button>
                          )
                        })}
                      </div>
                      {r.holderType === 'ifo' && !edit && (
                        <div className="text-[11px] text-slate-400 mt-1">Ако ИФО детето не е дошло в даден ден — „Редакция“ и щракнете датата (при изтеглянето, от 5-то до 11-то число).</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {/* заместване */}
            {edit ? (
              <div className="border border-slate-100 rounded-xl">
                <div className="px-3 py-2 text-[12px] text-slate-500 border-b border-slate-100 bg-slate-50/50">Заместване — по дни</div>
                {editRows.length === 0 && <div className="px-3 py-2 text-[13px] text-slate-400">Няма записани замествания за периода.</div>}
                <div className="divide-y divide-slate-100">
                  {editRows.map(r => {
                    const off = r.cur === 0
                    return (
                      <div key={rowKey(r)} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 ${off ? 'opacity-60' : ''}`}>
                        <span className="text-[12.5px] tabular-nums text-slate-500 w-11 shrink-0">{r.date.slice(0, 5)}</span>
                        <div className={`min-w-0 flex-1 text-[13px] ${off ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {r.absentName ? `Заместване на ${r.absentName}` : 'Заместване'} · {r.cls}{r.subject && <span className="text-slate-400"> · {r.subject}</span>}
                        </div>
                        {r.bsch
                          ? <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">НП</span>
                          : <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">бюджет</span>}
                        {r.manual && <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">добавено от вас</span>}
                        <div className="flex items-center gap-1">
                          <button type="button" className={stepBtn} disabled={r.manual ? r.cur <= 1 : r.cur <= 0} onClick={() => setRowHours(r, r.cur - 1)} title="Час по-малко"><Minus size={12} /></button>
                          <span className="w-9 text-center text-[12.5px] tabular-nums text-slate-700">{r.cur} ч.</span>
                          <button type="button" className={stepBtn} disabled={r.bsch ? r.cur >= r.orig : r.cur >= 7} onClick={() => setRowHours(r, r.cur + 1)} title={r.bsch ? 'НП — само по заповедта' : 'Час повече'}><Plus size={12} /></button>
                        </div>
                        {r.manual && <button type="button" onClick={() => setManual(prev => prev.filter(m => m.id !== r.subId))} className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Махни"><X size={13} /></button>}
                      </div>
                    )
                  })}
                </div>
                <div className="px-3 py-2 border-t border-slate-100">
                  {!addOpen ? (
                    <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-600 hover:text-[#0f2240]"><Plus size={13} /> Добави пропуснато заместване</button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-end gap-2">
                        <div><label className="block text-[11px] text-slate-500 mb-0.5">Дата</label>
                          <input type="date" value={nf.iso} min={period.from} max={maxDay} onChange={e => setNf({ ...nf, iso: e.target.value })} className={inp} /></div>
                        <div className="flex-1 min-w-[150px]"><label className="block text-[11px] text-slate-500 mb-0.5">Кого заместих</label>
                          <input value={nf.absentName} onChange={e => setNf({ ...nf, absentName: e.target.value })} placeholder="Име Фамилия" className={`${inp} w-full`} /></div>
                        <div className="w-28"><label className="block text-[11px] text-slate-500 mb-0.5">Паралелка / група</label>
                          <input value={nf.cls} onChange={e => setNf({ ...nf, cls: e.target.value })} placeholder="напр. 14" className={`${inp} w-full`} /></div>
                        <div className="flex-1 min-w-[130px]"><label className="block text-[11px] text-slate-500 mb-0.5">Предмет (по желание)</label>
                          <input value={nf.subject} onChange={e => setNf({ ...nf, subject: e.target.value })} className={`${inp} w-full`} /></div>
                        <div className="w-16"><label className="block text-[11px] text-slate-500 mb-0.5">Часове</label>
                          <input type="number" min={1} max={7} value={nf.hours} onChange={e => setNf({ ...nf, hours: Number(e.target.value) })} className={`${inp} w-full`} /></div>
                        <button type="button" onClick={addManual} className="px-3 py-1.5 rounded-lg text-white text-[13px]" style={{ backgroundColor: '#0f2240' }}>Добави</button>
                        <button type="button" onClick={() => setAddOpen(false)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] text-slate-600">Отказ</button>
                      </div>
                      <p className="text-[11px] text-slate-400">Добавеното влиза в декларацията за бюджета, без № на заповед. Заместване по НП се въвежда от Ванина в „Отсъствия и замествания“ — за него са нужни заповед и отчет към МОН.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : groups.length > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                {groups.map(g => (
                  <div key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-slate-800">Заместване на {g.absent}</div>
                      <div className="text-[11.5px] text-slate-500">{g.dates.join(', ')}</div>
                    </div>
                    {g.np > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">НП · {g.np} ч.</span>}
                    {g.budget > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Бюджет · {g.budget} ч.</span>}
                    {g.manual
                      ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">добавено от вас</span>
                      : g.order === '—'
                        ? <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" title="Без регистрирана заповед полето „Заповед №“ остава празно"><AlertTriangle size={11} /> няма заповед</span>
                        : <span className="text-[11px] text-slate-400">Зап. № {g.order}</span>}
                  </div>
                ))}
              </div>
            )}
            {(over.length > 0) && (
              <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm border border-slate-300 bg-white align-middle mr-1" />влиза</span>
                {over.some(r => r.dates.some(d => d > today)) && <span><span className="inline-block w-2.5 h-2.5 rounded-sm border border-dashed border-slate-300 align-middle mr-1" />предстои</span>}
                {(edit || removed.size > 0) && <span><span className="inline-block w-2.5 h-2.5 rounded-sm border border-amber-200 bg-amber-50 align-middle mr-1" />махнат от вас</span>}
                {(edit || restored.size > 0) && <span><span className="inline-block w-2.5 h-2.5 rounded-sm border border-sky-200 bg-sky-50 align-middle mr-1" />върнат от вас</span>}
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm border border-rose-200 bg-rose-50 align-middle mr-1" />не влиза (отпуск/болничен, неучебен ден) — посочете датата за причината</span>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-400 px-4 py-2.5 bg-slate-50/60 border-t border-slate-100">
        Един файл, всяка декларация на своя страница. Първият период е от началото на учебната година до края на октомври, после всеки месец.
        Генерира се от 5-то до 11-то число на следващия месец; подписаната декларация се предава до 10-то.
        Над норматив влиза по графика — без дните в отпуск/болничен и без неучебните дни; с „Редакция“ коригирате невзетите или пропуснатите часове.
      </p>
    </section>
  )
}
