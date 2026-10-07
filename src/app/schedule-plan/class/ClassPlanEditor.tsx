'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, X, Plus, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { PERIOD_TIMES, PERIOD_LABEL, periodsOverlap } from '@/lib/periods'
import type { PlanCard } from '@/lib/curriculum'
import { linkCurriculumSubject, addSubjectQuick } from '@/app/my-schedule/edit/actions'
import { placeClassSlot, removeClassSlot, relinkSlots } from '../actions'

type Slot = { id: string; day: number; period: number; staffId: string | null; subjectId: string; group: boolean; subject: string; teacher: string }
type Busy = Record<string, { day: number; period: number; label: string }[]>

const DAYS = [
  { n: 1, label: 'Понеделник' }, { n: 2, label: 'Вторник' }, { n: 3, label: 'Сряда' },
  { n: 4, label: 'Четвъртък' }, { n: 5, label: 'Петък' },
]
const r1 = (x: number) => Math.round(x * 10) / 10
const fmt = (x: number) => r1(x).toLocaleString('bg-BG', { maximumFractionDigits: 1 })

export default function ClassPlanEditor({ classId, term, classes, cards: initialCards, slots: initialSlots, busy, subjects }: {
  classId: string; term: number; classes: { id: string; name: string }[]
  cards: PlanCard[]; slots: Slot[]; busy: Busy; subjects: { id: string; name: string }[]
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [cards, setCards] = useState(initialCards)
  const [slots, setSlots] = useState(initialSlots)
  const [subjectList, setSubjectList] = useState(subjects)
  const placeable = (c: PlanCard) => c.place === 'class' && !!c.subjectId && !!c.staffId
  const [active, setActive] = useState<string>(() => initialCards.find(placeable)?.key || '')
  const [pending, setPending] = useState<string | null>(null)
  const [linking, setLinking] = useState<string | null>(null)
  const [show7, setShow7] = useState(() => initialSlots.some(s => s.period === 7))
  const PERIODS = show7 ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6]
  const activeCard = cards.find(c => c.key === active && placeable(c)) || null

  // наредени часове по карта: същият учител + предмет в паралелката; еднаквите редове делят по ред
  const check = useMemo(() => {
    const k = (staffId: string | null, subjectId: string | null) => `${staffId}|${subjectId}`
    const pool: Record<string, number> = {}
    slots.forEach(s => { pool[k(s.staffId, s.subjectId)] = (pool[k(s.staffId, s.subjectId)] || 0) + 1 })
    const groups: Record<string, PlanCard[]> = {}
    cards.filter(c => c.place === 'class' && c.subjectId && c.staffId).forEach(c => { (groups[k(c.staffId, c.subjectId)] ||= []).push(c) })
    const placed: Record<string, number> = {}
    Object.entries(groups).forEach(([key, cs]) => {
      let left = pool[key] || 0
      cs.forEach((c, i) => { const n = i === cs.length - 1 ? left : Math.min(left, c.hours); placed[c.key] = n; left -= n })
    })
    const offPlan = new Set(slots.filter(s => !groups[k(s.staffId, s.subjectId)]).map(s => s.id))
    const cls = cards.filter(c => c.place === 'class')
    const planH = cls.reduce((a, c) => a + c.hours, 0)
    const doneH = cls.reduce((a, c) => a + Math.min(placed[c.key] || 0, c.hours), 0)
    return { placed, offPlan, planH, doneH, over: cls.filter(c => (placed[c.key] || 0) > c.hours) }
  }, [slots, cards])

  const busyAt = (staffId: string | null, day: number, period: number) =>
    staffId ? (busy[staffId] || []).find(b => b.day === day && periodsOverlap(b.period, period)) : undefined

  async function onCell(day: number, period: number) {
    const c = activeCard
    if (!c || pending) return
    const here = slots.filter(s => s.day === day && s.period === period)
    const same = here.find(s => s.staffId === c.staffId && s.subjectId === c.subjectId)
    if (same) { await remove(same, false); return }
    const b = busyAt(c.staffId, day, period)
    if (b) { toast(`${c.teacher} е зает(а) по това време — ${b.label}`, 'error'); return }
    let group = false
    if (here.length) {
      if (!confirm(`Часът е зает: ${here.map(s => `${s.subject} (${s.teacher})`).join(', ')}.\nПаралелката е разделена на групи — да се добави и ${c.subject} (${c.teacher}) в същия час?`)) return
      group = true
    }
    const key = `${day}-${period}`
    setPending(key)
    const res: any = await placeClassSlot({ classId, term, day, period, staffId: c.staffId!, subjectId: c.subjectId!, group })
    setPending(null)
    if (res?.error) { toast(res.error, 'error'); return }
    setSlots(prev => [...prev, { id: res.id, day, period, staffId: c.staffId, subjectId: c.subjectId!, group, subject: subjectList.find(s => s.id === c.subjectId)?.name || c.subject, teacher: c.teacher }])
  }

  async function remove(s: Slot, ask = true) {
    if (ask && !confirm(`Да се махне ${s.subject} (${s.teacher}) — ${DAYS[s.day - 1]?.label}, ${PERIOD_LABEL[s.period]}. час? Часът изчезва и от разписанието на учителя.`)) return
    setPending(`${s.day}-${s.period}`)
    const res: any = await removeClassSlot(s.id)
    setPending(null)
    if (res?.error) { toast(res.error, 'error'); return }
    setSlots(prev => prev.filter(x => x.id !== s.id))
  }

  async function linkSubject(c: PlanCard, subjectId: string) {
    if (!subjectId) return
    setLinking(c.key)
    const res: any = await linkCurriculumSubject(c.subject, subjectId)
    setLinking(null)
    if (res?.error) { toast(res.error, 'error'); return }
    setCards(prev => prev.map(x => x.subject === c.subject ? { ...x, subjectId } : x))
    toast('Предметът е свързан')
  }
  async function createAndLink(c: PlanCard) {
    setLinking(c.key)
    const res: any = await addSubjectQuick(c.subject, false)
    if (res?.error) { setLinking(null); toast(res.error, 'error'); return }
    setSubjectList(prev => [...prev, res.subject])
    await linkSubject(c, res.subject.id)
  }

  // часовете „извън плана“, групирани по учител + предмет — с причината и избор „Това е →“ ред от плана
  const offGroups = useMemo(() => {
    const g: Record<string, { key: string; staffId: string | null; subjectId: string; subject: string; teacher: string; ids: string[] }> = {}
    slots.filter(s => check.offPlan.has(s.id)).forEach(s => {
      const k = `${s.staffId}|${s.subjectId}`
      ;(g[k] ||= { key: k, staffId: s.staffId, subjectId: s.subjectId, subject: s.subject, teacher: s.teacher, ids: [] }).ids.push(s.id)
    })
    const linkable = cards.filter(c => c.place === 'class' && c.subjectId && c.staffId)
    return Object.values(g).map(x => {
      const sameSubj = linkable.filter(c => c.subjectId === x.subjectId)
      const sameTeacher = linkable.filter(c => c.staffId === x.staffId)
      const why = sameSubj.length ? `в плана предметът е на ${Array.from(new Set(sameSubj.map(c => c.teacher))).join(', ')}`
        : sameTeacher.length ? 'учителят е в плана, но с друг предмет (в EIS предметът е различен)'
        : !x.staffId ? 'часът няма учител' : 'нито предметът, нито учителят са в плана на паралелката'
      // подсказка: ред от плана със същия учител (ако е само един) или със същия предмет
      const guess = sameTeacher.length === 1 ? sameTeacher[0].key : sameSubj.length === 1 ? sameSubj[0].key : ''
      return { ...x, why, guess }
    }).sort((a, b) => a.subject.localeCompare(b.subject, 'bg'))
  }, [slots, cards, check.offPlan])
  const [relinkTo, setRelinkTo] = useState<Record<string, string>>({})

  async function relink(gr: { key: string; staffId: string | null; teacher: string; subject: string; ids: string[] }, cardKey: string) {
    const c = cards.find(x => x.key === cardKey)
    if (!c || !c.staffId || !c.subjectId) return
    const n = gr.ids.length
    const msg = c.staffId !== gr.staffId
      ? `${n} ${n === 1 ? 'час' : 'часа'} „${gr.subject}“ (${gr.teacher || 'без учител'}) ще станат „${c.subject}“ на ${c.teacher}.\nЧасовете минават в разписанието на ${c.teacher}. Продължаваме?`
      : `${n} ${n === 1 ? 'час' : 'часа'} „${gr.subject}“ (${gr.teacher}) ще се свържат с „${c.subject}“ от плана. Продължаваме?`
    if (!confirm(msg)) return
    setPending(gr.key)
    const res: any = await relinkSlots(gr.ids, c.staffId, c.subjectId)
    setPending(null)
    if (res?.error) { toast(res.error, 'error'); return }
    const done = new Set<string>(res.updated || [])
    const subjName = subjectList.find(x => x.id === c.subjectId)?.name || c.subject
    setSlots(prev => prev.map(s => done.has(s.id) ? { ...s, staffId: c.staffId, subjectId: c.subjectId!, subject: subjName, teacher: c.teacher } : s))
    if (res.skipped?.length) toast(`Свързани ${done.size}; пропуснати ${res.skipped.length}: ${res.skipped.slice(0, 3).join('; ')}`, 'error')
    else toast(`Свързани ${done.size} ${done.size === 1 ? 'час' : 'часа'}`)
  }

  const left = r1(check.planH - check.doneH)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <select value={classId} onChange={e => router.push(`?c=${e.target.value}${term === 2 ? '&term=2' : ''}`)}
          className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none">
          {classes.map(c => <option key={c.id} value={c.id}>Паралелка {c.name}</option>)}
        </select>
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          {[1, 2].map(t => (
            <a key={t} href={`?c=${classId}&term=${t}`} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${term === t ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`} style={term === t ? { backgroundColor: '#0f2240' } : {}}>
              {t === 1 ? 'I' : 'II'} срок
            </a>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Учебен план на паралелката · {term === 2 ? 'II' : 'I'} срок — избери предмет и цъкай в клетките</div>
          {check.planH > 0 && (
            <div className={`text-xs font-medium ${left <= 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
              {left <= 0 ? 'всичко по плана е наредено' : `остават ${fmt(left)} от ${fmt(check.planH)} ч.`}
            </div>
          )}
        </div>
        {cards.length === 0 && <div className="text-sm text-slate-400">Няма редове в учебния план за тази паралелка и срок.</div>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(c => {
            const cls = c.place === 'class'
            const n = check.placed[c.key] || 0
            const isActive = active === c.key && placeable(c)
            const state = !cls ? '' : n > c.hours ? 'over' : n === c.hours ? 'done' : ''
            return (
              <div key={c.key} onClick={() => placeable(c) && setActive(isActive ? '' : c.key)}
                className={`rounded-xl border px-3 py-2 transition-all ${!cls ? 'bg-slate-50 border-slate-200 text-slate-500'
                  : isActive ? 'border-[#0f2240] ring-2 ring-slate-200 bg-blue-50 cursor-pointer'
                  : placeable(c) ? 'bg-white border-slate-200 hover:border-slate-400 cursor-pointer' : 'bg-amber-50/50 border-amber-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-800 leading-snug break-words">
                      {c.place === 'ich' && <span className="mr-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-50 border border-violet-200 text-violet-700">ИЧ</span>}
                      {c.subject}
                      {c.kind && c.kind !== 'ЗП' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-600">{c.kind}</span>}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{c.teacher || 'без учител'}</div>
                  </div>
                  <div className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${!cls ? 'bg-slate-100 text-slate-500'
                    : state === 'over' ? 'bg-amber-100 text-amber-800' : state === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                    title={cls ? `наредени ${n} от ${fmt(c.hours)} ч. седмично по плана` : 'часове седмично по плана'}>
                    {!cls ? `${fmt(c.hours)} ч.` : state === 'done' ? <><Check size={11} className="inline -mt-0.5" /> готово</>
                      : state === 'over' ? `+${fmt(n - c.hours)} над плана` : `остават ${fmt(c.hours - n)}`}
                  </div>
                </div>
                {c.place === 'ich' && <div className="text-[11px] text-slate-400 mt-0.5">ИЧ с дете — нарежда се в разписанието на учителя</div>}
                {c.note && <div className="text-[11px] text-slate-400 mt-0.5">{c.note}</div>}
                {cls && !c.staffId && <div className="text-[11px] text-amber-700 mt-0.5">Учителят не е свързан — свържете го в „Учебни планове“</div>}
                {cls && !c.subjectId && (
                  <div className="mt-1.5 space-y-1" onClick={e => e.stopPropagation()}>
                    <div className="text-[11px] text-amber-700">Предметът не е свързан с предмет в EIS:</div>
                    <select defaultValue="" disabled={linking === c.key} onChange={e => linkSubject(c, e.target.value)}
                      className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none">
                      <option value="">— Избери предмет —</option>
                      {subjectList.map(sb => <option key={sb.id} value={sb.id}>{sb.name}</option>)}
                    </select>
                    <button onClick={() => createAndLink(c)} disabled={linking === c.key} className="text-[11px] text-[#0f2240] hover:underline disabled:opacity-50">
                      {linking === c.key ? <Loader2 size={11} className="inline animate-spin" /> : '+'} Създай предмет „{c.subject}“
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {(check.over.length > 0 || check.offPlan.size > 0) && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Разлика с учебния план:</div>
            {check.over.map(c => <div key={c.key} className="text-xs">{c.subject} ({c.teacher}) — наредени {check.placed[c.key]}, по план {fmt(c.hours)}</div>)}
            {check.offPlan.size > 0 && <div className="text-xs">{check.offPlan.size} {check.offPlan.size === 1 ? 'час не е' : 'часа не са'} в учебния план (отбелязани „извън плана“) — виж по-долу защо и ги свържи.</div>}
          </div>
        </div>
      )}

      {offGroups.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Часове извън плана</div>
          <p className="text-xs text-slate-500 mb-3">Час е „по план“, когато и учителят, и предметът в EIS съвпадат с ред от учебния план. Тези са въведени с друг предмет или учител — избери на кой ред от плана отговарят.</p>
          <div className="space-y-2">
            {offGroups.map(gr => {
              const sel = relinkTo[gr.key] ?? gr.guess
              return (
                <div key={gr.key} className="flex flex-wrap items-center gap-2 text-sm border-b border-slate-100 last:border-0 pb-2">
                  <div className="min-w-[220px] flex-1">
                    <div className="text-slate-800">{gr.subject || '(без предмет)'} · <span className="text-slate-500">{gr.teacher || 'без учител'}</span> <span className="text-xs text-slate-400">· {gr.ids.length} ч.</span></div>
                    <div className="text-[11px] text-amber-700">{gr.why}</div>
                  </div>
                  <span className="text-xs text-slate-500">Това е →</span>
                  <select value={sel} onChange={e => setRelinkTo(p => ({ ...p, [gr.key]: e.target.value }))}
                    className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none max-w-[280px]">
                    <option value="">— ред от плана —</option>
                    {cards.filter(c => c.place === 'class' && c.subjectId && c.staffId).map(c => (
                      <option key={c.key} value={c.key}>{c.subject} · {c.teacher}</option>
                    ))}
                  </select>
                  <button onClick={() => sel && relink(gr, sel)} disabled={!sel || pending === gr.key}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs text-white disabled:opacity-40" style={{ backgroundColor: '#0f2240' }}>
                    {pending === gr.key ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Свържи
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full border-collapse table-fixed min-w-[820px]">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="w-14 px-2 py-3 text-[11px] font-semibold text-slate-400 uppercase">Час</th>
              {DAYS.map(d => <th key={d.n} className="px-2 py-3 text-xs font-semibold text-slate-600">{d.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map(period => (
              <tr key={period} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-2 text-center align-top">
                  <div className="font-semibold text-slate-700 text-sm pt-2">{PERIOD_LABEL[period]}.</div>
                  <div className="text-[9px] text-slate-400 leading-tight">{PERIOD_TIMES[period]}</div>
                </td>
                {DAYS.map(d => {
                  const key = `${d.n}-${period}`
                  const here = slots.filter(s => s.day === d.n && s.period === period)
                  const tb = activeCard ? busyAt(activeCard.staffId, d.n, period) : undefined
                  return (
                    <td key={d.n} className="px-1.5 py-1.5 align-top">
                      <div onClick={() => onCell(d.n, period)}
                        style={tb && !here.length ? { backgroundImage: 'repeating-linear-gradient(135deg, rgba(244,63,94,0.10) 0 6px, rgba(255,255,255,0) 6px 12px)' } : undefined}
                        className={`w-full min-h-[56px] rounded-xl border px-2 py-1.5 space-y-1 transition-all ${activeCard ? 'cursor-pointer hover:border-slate-400' : ''} ${
                          here.length ? 'border-slate-200 bg-slate-50' : tb ? 'border-rose-200' : 'border-dashed border-slate-200'}`}>
                        {pending === key && <Loader2 size={14} className="animate-spin text-slate-400" />}
                        {here.map(s => (
                          <div key={s.id} className="group relative pr-4">
                            <div className="text-xs text-slate-800 leading-snug line-clamp-2 break-words" title={s.subject}>{s.subject}</div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {s.group && <span className="px-1 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 mr-1">гр.</span>}
                              {s.teacher}
                            </div>
                            {check.offPlan.has(s.id) && <div className="text-[9px] text-amber-700">извън плана</div>}
                            <button onClick={e => { e.stopPropagation(); remove(s) }} title="Махни часа"
                              className="absolute top-0 right-0 text-slate-300 hover:text-rose-600"><X size={12} /></button>
                          </div>
                        ))}
                        {!here.length && !pending && (tb
                          ? <div className="text-[10px] text-rose-600 pt-1">{activeCard?.teacher.split(' ')[0]} е зает(а): {tb.label}</div>
                          : <div className="text-sm text-slate-300 pt-1.5 text-center">{activeCard ? '+' : ''}</div>)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!show7 && (
        <button onClick={() => setShow7(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
          <Plus size={13} /> Добави 7-ми час
        </button>
      )}
      <p className="text-xs text-slate-400">Промените се записват веднага. Втори клик на същия предмет в клетката го маха.</p>
    </div>
  )
}
