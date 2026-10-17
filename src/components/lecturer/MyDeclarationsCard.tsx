'use client'
// „Моите декларации“ — един бутон, един Word файл за периода, всяка декларация на своя страница:
// заместване НП, заместване бюджет, над норматив, ИФО / логопед (само тези, по които има часове).
// Генерира се една седмица — от 5-то до 11-то число на месеца след периода. Над норматив влиза
// по графика, без дните в отпуск/болничен и без неучебните дни; декларацията се записва за проверката.
import { useEffect, useState } from 'react'
import { Loader2, FileDown, CalendarClock, Lock, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { declarationPeriods, genPeriod, sofiaTodayIso } from '@/lib/declaration-periods'
import { getMonthlyDeclaration } from '@/app/substitutions/actions'
import { getMyLecturerDates, submitLecturerDeclaration, getMyDeclContext } from '@/app/my-lecturer/actions'
import { generateAllMyDeclarations } from '@/lib/docx-substitution'
import { buildLecturerDecls, declPeriodLabel, type DeclItem } from '@/lib/lecturer-decl'

const fmt = (iso: string) => iso.split('-').reverse().join('.')
type Ctx = { teacherName: string; position: string; orderOver: string; orderIfo: string; rate: number; isSpeech: boolean; hasSlots: boolean }
type OverRow = { slotId: string; dates: string[]; absent?: string[]; period: number; subject: string; holderType?: string; holderLabel: string; validFrom?: string; validTo?: string }

export default function MyDeclarationsCard({ onDone }: { onDone?: () => void }) {
  const { toast } = useToast()
  const periods = declarationPeriods('over', sofiaTodayIso())
  const [key, setKey] = useState(() => genPeriod(periods).key)
  const period = periods.find(p => p.key === key) || periods[0]
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [sub, setSub] = useState<any | null>(null)
  const [over, setOver] = useState<OverRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { getMyDeclContext().then((r: any) => { if (!r.error) setCtx(r) }) }, [])
  useEffect(() => {
    setSub(null); setOver([])
    if (!period.genOpen || !ctx) return
    let alive = true
    setLoading(true)
    Promise.all([
      getMonthlyDeclaration(period.from, period.to),
      ctx.hasSlots ? getMyLecturerDates(period.from, period.to) : Promise.resolve({ rows: [] }),
    ]).then(([s, o]: any[]) => {
      if (!alive) return
      setSub(s?.data && s.data.rows?.length ? s.data : null)
      setOver((o?.rows || []) as OverRow[])
      setLoading(false)
    })
    return () => { alive = false }
  }, [period.key, period.genOpen, ctx]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!ctx || !parts.length) return
    setBusy(true)
    try {
      // над норматив се записва за проверката (заменя по-ранна непроверена за периода)
      if (overItems.length) {
        const entries = over.map(r => ({ slotId: r.slotId, dates: taken(r) })).filter(e => e.dates.length)
        const res: any = await submitLecturerDeclaration(period.from, period.to, entries)
        if (res.error) { toast(res.error, 'error'); setBusy(false); return }
      }
      const b = buildLecturerDecls({ teacherName: ctx.teacherName, position: ctx.position, periodLabel: declPeriodLabel(period.label),
        orderOver: ctx.orderOver, orderIfo: ctx.orderIfo, isSpeech: ctx.isSpeech, rate: ctx.rate, items: overItems })
      const n = await generateAllMyDeclarations(sub, b.docs, `декларации_${period.label.replace(/\s+/g, '_')}_${ctx.teacherName.replace(/\s+/g, '_')}.docx`)
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

      <div className="px-4 py-3">
        {!period.genOpen ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Lock size={15} className="text-slate-400" />
            {period.open
              ? <>Седмицата за генериране ({fmt(period.opensOn)} – {fmt(period.closesOn)}) мина — обърнете се към ЗДУД или ЗАС.</>
              : <>Декларациите за „{period.label}“ се генерират от <b className="font-medium text-slate-700">{fmt(period.opensOn)}</b> до <b className="font-medium text-slate-700">{fmt(period.closesOn)}</b>.</>}
          </div>
        ) : loading || !ctx ? (
          <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={15} className="animate-spin" /> Зареждане…</div>
        ) : parts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-400"><CalendarClock size={15} /> Няма часове за деклариране за {period.label}.</div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-2">
              {parts.map(p => (
                <span key={p.label} className="text-[12.5px] px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">{p.label} · <b className="font-medium">{p.h} ч.</b></span>
              ))}
            </div>
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
