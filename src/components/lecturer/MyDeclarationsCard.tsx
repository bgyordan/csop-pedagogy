'use client'
// „Моите декларации“ — един бутон, един Word файл за периода, всяка декларация на своя страница:
// заместване НП, заместване бюджет, над норматив, ИФО / логопед (само тези, по които има часове).
// Генерира се една седмица — от 5-то до 11-то число на месеца след периода. Над норматив влиза
// по графика, без дните в отпуск/болничен и без неучебните дни; декларацията се записва за проверката.
// Прегледът „Какво ще влезе“ се вижда през целия период (по дати, махнатите — задраскани с причината);
// седмицата 5–11 ограничава само бутона за изтегляне.
import { useEffect, useState } from 'react'
import { Loader2, FileDown, CalendarClock, Lock, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { declarationPeriods, genPeriod, sofiaTodayIso } from '@/lib/declaration-periods'
import { getMonthlyDeclaration, getMyMonthlyPreview } from '@/app/substitutions/actions'
import { getMyLecturerDates, submitLecturerDeclaration, getMyDeclContext } from '@/app/my-lecturer/actions'
import { generateAllMyDeclarations } from '@/lib/docx-substitution'
import { buildLecturerDecls, declPeriodLabel, type DeclItem } from '@/lib/lecturer-decl'

const fmt = (iso: string) => iso.split('-').reverse().join('.')
const DAY_L = ['', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък']
type Ctx = { teacherName: string; position: string; orderOver: string; orderIfo: string; rate: number; isSpeech: boolean; hasSlots: boolean }
type OverRow = { slotId: string; dates: string[]; absent?: string[]; off?: { date: string; note: string }[]; day?: number; period: number; subject: string; holderType?: string; holderLabel: string; validFrom?: string; validTo?: string }

export default function MyDeclarationsCard({ onDone }: { onDone?: () => void }) {
  const { toast } = useToast()
  const periods = declarationPeriods('over', sofiaTodayIso())
  const [key, setKey] = useState(() => genPeriod(periods).key)
  const period = periods.find(p => p.key === key) || periods[0]
  const today = sofiaTodayIso()
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [sub, setSub] = useState<any | null>(null)
  const [over, setOver] = useState<OverRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { getMyDeclContext().then((r: any) => { if (!r.error) setCtx(r) }) }, [])
  useEffect(() => {
    setSub(null); setOver([])
    if (!ctx) return
    let alive = true
    setLoading(true)
    Promise.all([
      getMyMonthlyPreview(period.from, period.to),
      ctx.hasSlots ? getMyLecturerDates(period.from, period.to) : Promise.resolve({ rows: [] }),
    ]).then(([s, o]: any[]) => {
      if (!alive) return
      setSub(s?.data && s.data.rows?.length ? s.data : null)
      setOver((o?.rows || []) as OverRow[])
      setLoading(false)
    })
    return () => { alive = false }
  }, [period.key, ctx]) // eslint-disable-line react-hooks/exhaustive-deps

  // над норматив — всички часове по графика без дните в отпуск/болничен
  const taken = (r: OverRow) => r.dates.filter(d => !(r.absent || []).includes(d))
  const overItems: DeclItem[] = over.flatMap(r => taken(r).map(iso => ({ iso, period: r.period, subject: r.subject, holderType: r.holderType, holderLabel: r.holderLabel, validFrom: r.validFrom, validTo: r.validTo })))
  const ifoH = overItems.filter(i => i.holderType === 'ifo').length
  const overH = overItems.length - ifoH
  const npH = sub?.npHours || 0, budgetH = sub?.budgetHours || 0
  const parts = [
    npH && { label: 'Заместване НП', h: npH },
    budgetH && { label: 'Заместване бюджет', h: budgetH },
    overH && { label: ctx?.isSpeech ? 'Над норматив (логопед)' : 'Над норматив', h: overH },
    ifoH && { label: 'ИФО', h: ifoH },
  ].filter(Boolean) as { label: string; h: number }[]
  // заместванията — по отсъстващ колега (дати, часове, заповед), за да се види какво влиза
  const groups = Object.values(((sub?.rows || []) as any[]).reduce((m: Record<string, any>, r: any) => {
    const g = m[r.subId] || (m[r.subId] = { id: r.subId, absent: r.absentName, dates: [] as string[], np: 0, budget: 0, order: r.orderRef })
    if (!g.dates.includes(r.date)) g.dates.push(r.date)
    if (r.bsch) g.np += r.hours; else g.budget += r.hours
    return m
  }, {})) as { id: string; absent: string; dates: string[]; np: number; budget: number; order: string }[]

  async function gen() {
    if (!ctx || !parts.length || !period.genOpen) return
    setBusy(true)
    try {
      // заместванията — наново, през проверката на срока (сървърът пази седмицата 5–11)
      const fresh: any = await getMonthlyDeclaration(period.from, period.to)
      if (fresh?.error) { toast(fresh.error, 'error'); setBusy(false); return }
      const subData = fresh?.data && fresh.data.rows?.length ? fresh.data : null
      // над норматив се записва за проверката (заменя по-ранна непроверена за периода)
      if (overItems.length) {
        const entries = over.map(r => ({ slotId: r.slotId, dates: taken(r) })).filter(e => e.dates.length)
        const res: any = await submitLecturerDeclaration(period.from, period.to, entries)
        if (res.error) { toast(res.error, 'error'); setBusy(false); return }
      }
      const b = buildLecturerDecls({ teacherName: ctx.teacherName, position: ctx.position, periodLabel: declPeriodLabel(period.label),
        orderOver: ctx.orderOver, orderIfo: ctx.orderIfo, isSpeech: ctx.isSpeech, rate: ctx.rate, items: overItems })
      const n = await generateAllMyDeclarations(subData, b.docs, `декларации_${period.label.replace(/\s+/g, '_')}_${ctx.teacherName.replace(/\s+/g, '_')}.docx`)
      toast(n > 1 ? `Изтеглен е един файл с ${n} декларации — всяка на своя страница` : 'Декларацията е изтеглена')
      onDone?.()
    } catch { toast('Грешка при генериране', 'error') }
    setBusy(false)
  }

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
        <button onClick={gen} disabled={busy || loading || !period.genOpen || !parts.length}
          className="ml-auto inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: '#0f2240' }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Изтегли декларациите{parts.length ? ` · ${parts.reduce((a, p) => a + p.h, 0)} ч.` : ''}
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {!period.genOpen && (
          <div className="flex items-center gap-2 text-[13px] text-slate-500">
            <Lock size={14} className="text-slate-400 shrink-0" />
            {period.open
              ? <>Седмицата за генериране ({fmt(period.opensOn)} – {fmt(period.closesOn)}) мина — обърнете се към ЗДУД или ЗАС.</>
              : <>Изтегляне от <b className="font-medium text-slate-700">{fmt(period.opensOn)}</b> до <b className="font-medium text-slate-700">{fmt(period.closesOn)}</b>. Отдолу е какво ще влезе — ако нещо не е вярно, кажете на ЗДУД преди това.</>}
          </div>
        )}
        {loading || !ctx ? (
          <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={15} className="animate-spin" /> Зареждане…</div>
        ) : parts.length === 0 && over.every(r => !(r.off || []).length && !(r.absent || []).length) ? (
          <div className="flex items-center gap-2 text-sm text-slate-400"><CalendarClock size={15} /> Няма часове за деклариране за {period.label}.</div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Какво ще влезе · {period.label}</div>
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
                    ...r.dates.map(d => ({ d, kind: ab.has(d) ? 'absent' : d > today ? 'future' : 'ok', note: ab.has(d) ? 'отпуск / болничен' : d > today ? 'предстои' : '' })),
                    ...(r.off || []).map(o => ({ d: o.date, kind: 'off', note: o.note })),
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
                        {items.map(it => (
                          <span key={it.d} title={it.note || 'влиза'}
                            className={`text-[11.5px] tabular-nums px-1.5 py-0.5 rounded-md border ${
                              it.kind === 'ok' ? 'bg-white border-slate-200 text-slate-700'
                              : it.kind === 'future' ? 'bg-white border-dashed border-slate-200 text-slate-400'
                              : 'bg-rose-50/50 border-rose-100 text-rose-400 line-through'}`}>
                            {fmt(it.d).slice(0, 5)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {groups.length > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                {groups.map(g => (
                  <div key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-slate-800">Заместване на {g.absent}</div>
                      <div className="text-[11.5px] text-slate-500">{g.dates.join(', ')}</div>
                    </div>
                    {g.np > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">НП · {g.np} ч.</span>}
                    {g.budget > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Бюджет · {g.budget} ч.</span>}
                    {g.order === '—'
                      ? <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" title="Без регистрирана заповед полето „Заповед №“ остава празно"><AlertTriangle size={11} /> няма заповед</span>
                      : <span className="text-[11px] text-slate-400">Зап. № {g.order}</span>}
                  </div>
                ))}
              </div>
            )}
            {over.some(r => (r.off || []).length || (r.absent || []).length || r.dates.some(d => d > today)) && (
              <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm border border-slate-300 bg-white align-middle mr-1" />влиза</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm border border-dashed border-slate-300 align-middle mr-1" />предстои</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm border border-rose-200 bg-rose-50 align-middle mr-1" />не влиза (отпуск/болничен, неучебен ден) — посочете датата за причината</span>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-400 px-4 py-2.5 bg-slate-50/60 border-t border-slate-100">
        Един файл, всяка декларация на своя страница. Първият период е от началото на учебната година до края на октомври, после всеки месец.
        Генерира се от 5-то до 11-то число на следващия месец; подписаната декларация се предава до 10-то.
        Над норматив влиза по графика — без дните в отпуск/болничен и без неучебните дни; невзетите часове не се прехвърлят.
      </p>
    </section>
  )
}
