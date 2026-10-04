'use client'
import { useState, useMemo, useEffect } from 'react'
import { Loader2, Check, Save, Search, Plus, X, Trash2, UserRound, Lock } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getTeacherSchedule, saveLecturerSlots, clearLecturerSlots, removeLecturerSlot } from './actions'
import { slotHours } from './distribute'

type Teacher = { id: string; name: string }
type Marked = { id: string; staffId: string; staffName: string; day: number; period: number; subject: string; holderLabel: string; dateFrom: string; dateTo: string; orderNumber: string; term: number; manual?: boolean }
type SchedSlot = { day: number; period: number; subjectId: string | null; subject: string; holderType: string; holderLabel: string }

const DAYS = [{ n: 1, l: 'Пон' }, { n: 2, l: 'Вт' }, { n: 3, l: 'Ср' }, { n: 4, l: 'Чет' }, { n: 5, l: 'Пет' }]
const PERIODS = [1, 2, 3, 4, 5, 6, 7]
function fmt(d: string) { return d ? d.split('-').reverse().join('.') : '' }
// начало на лекторските часове: 15.09 на текущата учебна година
const startYear = () => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1 }
const yearStart = () => `${startYear()}-09-15`
// граници на сроковете (МОН): I срок до 30.01, II срок от 03.02
const TERM_START: Record<number, () => string> = { 1: yearStart, 2: () => `${startYear() + 1}-02-03` }
const TERM1_END = () => `${startYear() + 1}-01-30`
export default function LecturerClient({ teachers, marked: initialMarked, schoolDates, initialTeacherId }: {
  academicYearId: string; teachers: Teacher[]; marked: Marked[]; schoolDates: string[]; initialTeacherId?: string
}) {
  const { toast } = useToast()
  const [marked, setMarked] = useState<Marked[]>(initialMarked)

  const [teacherId, setTeacherId] = useState('')
  const [tSearch, setTSearch] = useState('')
  const [tOpen, setTOpen] = useState(false)
  const [schedule, setSchedule] = useState<SchedSlot[]>([])
  const [loadingSched, setLoadingSched] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())  // "ден-час"
  const [from, setFrom] = useState(yearStart())
  const [to, setTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [term, setTerm] = useState(1)

  useEffect(() => { if (initialTeacherId) selectTeacher(initialTeacherId) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const teacherName = teachers.find(t => t.id === teacherId)?.name || ''
  const filtered = teachers.filter(t => t.name.toLowerCase().includes(tSearch.toLowerCase())).slice(0, 40)

  async function loadSchedule(id: string, t: number) {
    setLoadingSched(true); setSchedule([]); setPicked(new Set())
    setFrom(TERM_START[t]()); setTo('')
    const res: any = await getTeacherSchedule(id, t)
    setSchedule(res.slots || [])
    setLoadingSched(false)
  }
  function switchTerm(t: number) {
    if (t === term) return
    setTerm(t)
    if (teacherId) loadSchedule(teacherId, t)
  }

  async function selectTeacher(id: string) {
    setTeacherId(id); setTOpen(false); setTSearch(''); setFrom(TERM_START[term]()); setTo('')
    setLoadingSched(true); setSchedule([]); setPicked(new Set())
    const res: any = await getTeacherSchedule(id, term)
    setSchedule(res.slots || [])
    // НЕ зареждаме записаните в picked — те се показват отделно с периодите си; picked е за нова група
    setLoadingSched(false)
  }

  const slotAt = (day: number, period: number) => schedule.find(s => s.day === day && s.period === period)
  // вече записан лекторски слот (с период) за текущия учител
  const savedAt = (day: number, period: number) => marked.find(m => m.staffId === teacherId && m.day === day && m.period === period && m.term === term)
  function togglePick(day: number, period: number) {
    const key = `${day}-${period}`
    if (!slotAt(day, period)) return // само реални часове
    if (savedAt(day, period)) return // вече записан — маха се с бутона за премахване
    setPicked(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  const pickedCount = picked.size

  async function save() {
    if (!teacherId) { toast('Изберете учител', 'error'); return }
    if (!from || !to) { toast('Задайте период', 'error'); return }
    if (picked.size === 0) { toast('Маркирайте поне един час', 'error'); return }
    setSaving(true)
    const slots = Array.from(picked).map(key => {
      const [day, period] = key.split('-').map(Number)
      const sl = slotAt(day, period)!
      return { day, period, subjectId: sl.subjectId, holderType: sl.holderType, holderLabel: sl.holderLabel }
    })
    const res: any = await saveLecturerSlots(teacherId, from, to, slots, term)
    if (res.error) { toast(res.error, 'error'); setSaving(false); return }
    // добавяме новите към marked (махаме само същите day/period, ако се презаписват)
    const keys = new Set(slots.map(s => `${s.day}-${s.period}`))
    const kept = marked.filter(m => !(m.staffId === teacherId && m.term === term && keys.has(`${m.day}-${m.period}`)))
    const mine: Marked[] = slots.map((s, i) => ({
      id: `tmp-${Date.now()}-${i}`, staffId: teacherId, staffName: teacherName, day: s.day, period: s.period,
      subject: slotAt(s.day, s.period)?.subject || '', holderLabel: s.holderLabel, dateFrom: from, dateTo: to, orderNumber: '', term, manual: true,
    }))
    setMarked([...mine, ...kept])
    setPicked(new Set())  // чистим за следваща група
    toast('Добавено')
    setSaving(false)
  }

  async function removeTeacher(id: string) {
    if (!confirm('Изтрий лекторските на този учител?')) return
    await clearLecturerSlots(id)
    setMarked(prev => prev.filter(m => m.staffId !== id))
    if (id === teacherId) setPicked(new Set())
    toast('Изтрито')
  }

  // групиране по учител — общо часа = СУМА по слот × седмиците на СВОЯ период
  const byTeacher = useMemo(() => {
    const m: Record<string, { name: string; count: number; total: number; periods: Set<string>; classes: Set<string> }> = {}
    marked.forEach(x => {
      if (!m[x.staffId]) m[x.staffId] = { name: x.staffName, count: 0, total: 0, periods: new Set(), classes: new Set() }
      m[x.staffId].count++
      m[x.staffId].total += slotHours(schoolDates, x.day, x.dateFrom, x.dateTo)   // точно по календара
      m[x.staffId].periods.add(`${fmt(x.dateFrom)}–${fmt(x.dateTo)}`)
      if (x.holderLabel) m[x.staffId].classes.add(x.holderLabel)
    })
    return Object.entries(m).map(([id, v]) => ({
      id, name: v.name, count: v.count, total: v.total,
      periods: [...v.periods], classes: [...v.classes],
    }))
  }, [marked, schoolDates])
  const grandTotal = byTeacher.reduce((a, t) => a + t.total, 0)

  // цвят по период — за да се виждат групите на избрания учител
  const PERIOD_COLORS = [
    { cell: 'border-emerald-300 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-400' },
    { cell: 'border-sky-300 bg-sky-50 text-sky-800', dot: 'bg-sky-400' },
    { cell: 'border-amber-300 bg-amber-50 text-amber-800', dot: 'bg-amber-400' },
    { cell: 'border-violet-300 bg-violet-50 text-violet-800', dot: 'bg-violet-400' },
    { cell: 'border-rose-300 bg-rose-50 text-rose-800', dot: 'bg-rose-400' },
  ]
  const myGroups = useMemo(() => {
    const g: { key: string; from: string; to: string; count: number }[] = []
    marked.filter(m => m.staffId === teacherId && m.term === term).forEach(m => {
      const key = `${m.dateFrom}|${m.dateTo}`
      const ex = g.find(x => x.key === key)
      if (ex) ex.count++; else g.push({ key, from: m.dateFrom, to: m.dateTo, count: 1 })
    })
    return g.sort((x, y) => x.to.localeCompare(y.to))
  }, [marked, teacherId, term])
  // часове от I срок с период след края на срока — те вече покриват и II срок (риск от двойно броене)
  const spillover = useMemo(() => marked.filter(m => m.staffId === teacherId && m.term === 1 && m.dateTo > TERM1_END()).length, [marked, teacherId])
  const colorOf = (from: string, to: string) => PERIOD_COLORS[Math.max(0, myGroups.findIndex(g => g.key === `${from}|${to}`)) % PERIOD_COLORS.length]
  const selectedInfo = byTeacher.find(t => t.id === teacherId)

  function closeTeacher() { setTeacherId(''); setSchedule([]); setPicked(new Set()); setFrom(TERM_START[term]()); setTo(''); setTSearch('') }

  // показваме само часовете, в които учителят има нещо (празните редове се скриват)
  const visiblePeriods = PERIODS.filter(p => schedule.some(s => s.period === p))
  const dayLabel = (n: number) => DAYS.find(d => d.n === n)?.l || ''
  const pickedList = Array.from(picked)
    .map(k => { const [day, period] = k.split('-').map(Number); return { k, day, period, sl: slotAt(day, period) } })
    .sort((a, b) => a.day - b.day || a.period - b.period)
  const withLecturer = new Set(byTeacher.map(t => t.id))

  const Step = ({ n, title, hint }: { n: number; title: string; hint?: string }) => (
    <div className="flex items-baseline gap-2.5 mb-3">
      <span className="h-6 w-6 shrink-0 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-medium flex items-center justify-center self-center">{n}</span>
      <h4 className="text-[15px] text-slate-800">{title}</h4>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
      {/* ── ЛЯВО: списък с определените + обща заповед (не мърда) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden lg:sticky lg:top-4">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-800">Определени лекторски</h3>
            <span className="text-xs text-slate-500">общо <span className="font-medium text-slate-800">{grandTotal}</span> ч.</span>
          </div>
          <button onClick={closeTeacher}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100">
            <Plus size={13} /> Учител
          </button>
        </div>

        {byTeacher.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">Още няма определени.</div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[65vh] overflow-y-auto">
            {byTeacher.map(t => {
              const sel = t.id === teacherId
              return (
                <div key={t.id} onClick={() => !sel && selectTeacher(t.id)}
                  className={`flex items-center gap-2 px-4 py-3 cursor-pointer group border-l-4 ${sel ? 'bg-teal-50/70 border-l-teal-500' : 'border-l-transparent hover:bg-slate-50'}`}>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm truncate ${sel ? 'font-medium text-teal-900' : 'text-slate-800'}`}>{t.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{t.count} ч./седм. · общо <span className="text-slate-700">{t.total} ч.</span></div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeTeacher(t.id) }}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100" title="Изтрий лекторските на учителя"><Trash2 size={13} /></button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── ДЯСНО ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        {!teacherId ? (
          /* СТЪПКА 1 — избор на учител, голямо и ясно */
          <div className="p-8 sm:p-10">
            <Step n={1} title="Изберете учител" hint="започнете да пишете името" />
            <div className="relative max-w-xl">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="text" value={tSearch} autoFocus
                onChange={e => setTSearch(e.target.value)}
                placeholder="Име на учител…"
                className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-base focus:outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50" />
            </div>
            <div className="max-w-xl mt-3 max-h-[50vh] overflow-y-auto rounded-xl border border-slate-100">
              {filtered.map(t => (
                <button key={t.id} onClick={() => selectTeacher(t.id)}
                  className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-teal-50/60 border-b border-slate-50 last:border-b-0">
                  <UserRound size={15} className="text-slate-400 shrink-0" />
                  <span className="flex-1 truncate">{t.name}</span>
                  {withLecturer.has(t.id) && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">има лекторски</span>}
                </button>
              ))}
              {filtered.length === 0 && <div className="px-4 py-3 text-sm text-slate-500">Няма такъв учител.</div>}
            </div>
          </div>
        ) : (
          <>
            {/* заглавие — ясно кой е избран */}
            <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-slate-100 bg-teal-50/50 rounded-t-2xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-11 w-11 shrink-0 rounded-full bg-white border border-teal-200 text-teal-700 flex items-center justify-center"><UserRound size={20} /></div>
                <div className="min-w-0">
                  <div className="text-xs text-teal-700">Въвеждате лекторски за</div>
                  <div className="text-xl text-slate-800 truncate">{teacherName}</div>
                  {selectedInfo && <div className="text-xs text-slate-500 mt-0.5">{selectedInfo.count} ч./седм. · общо {selectedInfo.total} ч.</div>}
                </div>
              </div>
              {/* срок — по чие разписание маркираме */}
              <div className="inline-flex p-0.5 rounded-xl bg-white border border-slate-200 shrink-0 ml-auto">
                {[1, 2].map(t => (
                  <button key={t} type="button" onClick={() => switchTerm(t)}
                    className={`px-3.5 py-1.5 rounded-lg text-sm transition-all ${term === t ? 'bg-teal-50 shadow-sm text-[#0f2240] border border-teal-200' : 'text-slate-500 hover:text-slate-700 border border-transparent'}`}>
                    {t === 1 ? 'I срок' : 'II срок'}
                  </button>
                ))}
              </div>
              <button type="button" onClick={closeTeacher}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 shrink-0">
                <Check size={14} /> Готово
              </button>
            </div>

            {loadingSched ? (
              <div className="py-16 text-center text-slate-400"><Loader2 size={22} className="animate-spin inline" /></div>
            ) : schedule.length === 0 ? (
              <div className="py-14 text-center text-sm text-slate-500">Този учител няма въведено разписание за {term === 1 ? 'I' : 'II'} срок.</div>
            ) : (
              <div className="p-6 space-y-8">
                {term === 2 && spillover > 0 && (
                  <div className="text-[13px] px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                    {spillover} ч./седм., маркирани в I срок, са с период след {fmt(TERM1_END())} — те вече се броят и през II срок.
                    Ако маркираш тук часове по новото разписание, съкрати онези до {fmt(TERM1_END())}, за да не се броят два пъти.
                  </div>
                )}

                {/* СТЪПКА 2 — часовете */}
                <section>
                  <Step n={2} title="Маркирайте часовете над норматива" hint="щракнете върху клетка" />
                  {myGroups.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
                      <span className="text-slate-500">Вече записани:</span>
                      {myGroups.map(g => (
                        <span key={g.key} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${colorOf(g.from, g.to).cell}`}>
                          <span className={`h-2 w-2 rounded-full ${colorOf(g.from, g.to).dot}`} /> {fmt(g.from)}–{fmt(g.to)} · {g.count} ч./седм.
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full border-separate" style={{ borderSpacing: '6px' }}>
                      <thead>
                        <tr><th className="w-10 text-xs font-normal text-slate-400">час</th>
                          {DAYS.map(d => <th key={d.n} className="py-1 text-sm font-medium text-slate-600">{d.l}</th>)}</tr>
                      </thead>
                      <tbody>
                        {visiblePeriods.map(period => (
                          <tr key={period}>
                            <td className="text-center text-sm text-slate-500">{period}.</td>
                            {DAYS.map(d => {
                              const sl = slotAt(d.n, period)
                              const key = `${d.n}-${period}`
                              const on = picked.has(key)
                              const saved = savedAt(d.n, period)
                              return (
                                <td key={d.n} className="align-top">
                                  {sl ? (
                                    saved ? (
                                      <div className={`relative w-full min-h-[64px] rounded-xl border px-2.5 py-2 text-left ${colorOf(saved.dateFrom, saved.dateTo).cell}`}>
                                        <div className="text-[11px] opacity-80 truncate pr-4 flex items-center gap-1">
                                          {saved.manual && <span title="Сложен на ръка — остава при „Наново“"><Lock size={10} className="shrink-0" /></span>}{sl.holderLabel}
                                        </div>
                                        <div className="text-[13px] truncate">{sl.subject}</div>
                                        <div className="text-[11px] opacity-80 mt-0.5">{fmt(saved.dateFrom).slice(0, 5)}–{fmt(saved.dateTo).slice(0, 5)}</div>
                                        <button onClick={async () => {
                                          await removeLecturerSlot(teacherId, d.n, period, term)
                                          setMarked(prev => prev.filter(m => !(m.staffId === teacherId && m.day === d.n && m.period === period && m.term === term)))
                                        }} className="absolute top-1.5 right-1.5 opacity-50 hover:opacity-100 hover:text-rose-600" title="Премахни"><X size={13} /></button>
                                      </div>
                                    ) : (
                                      <button onClick={() => togglePick(d.n, period)}
                                        className={`relative w-full min-h-[64px] rounded-xl px-2.5 py-2 text-left transition-all ${on
                                          ? 'border-2 border-teal-500 bg-teal-50 text-teal-900 shadow-sm'
                                          : 'border border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/30'}`}>
                                        {on && <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-teal-500 text-white flex items-center justify-center"><Check size={12} strokeWidth={3} /></span>}
                                        <div className="text-[11px] text-slate-500 truncate pr-5">{sl.holderLabel}</div>
                                        <div className="text-[13px] truncate">{sl.subject}</div>
                                      </button>
                                    )
                                  ) : <div className="min-h-[64px] rounded-xl border border-dashed border-slate-100" />}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* СТЪПКА 3 — избрани + период + добави */}
                <section>
                  <Step n={3} title="Период и добавяне" />
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
                    {/* какво е избрано */}
                    <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
                      {pickedList.length === 0 ? (
                        <span className="text-sm text-slate-500">Още не сте маркирали часове.</span>
                      ) : (
                        <>
                          <span className="text-sm text-slate-700">Избрани <span className="font-medium text-teal-700">{pickedList.length} ч./седм.</span>:</span>
                          {pickedList.map(p => (
                            <span key={p.k} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-white border border-teal-200 text-xs text-teal-900">
                              {dayLabel(p.day)} {p.period}. ч{p.sl?.holderLabel ? ` · ${p.sl.holderLabel}` : ''}
                              <button onClick={() => togglePick(p.day, p.period)} className="text-teal-400 hover:text-rose-600" title="Махни"><X size={12} /></button>
                            </span>
                          ))}
                          <button onClick={() => setPicked(new Set())} className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 ml-1">изчисти</button>
                        </>
                      )}
                    </div>

                    <div className="flex items-end gap-4 flex-wrap">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1.5">От</label>
                        <input type="date" value={from} onChange={e => { setFrom(e.target.value); if (to && e.target.value > to) setTo('') }}
                          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1.5">До</label>
                        <div className="flex items-center gap-2 flex-wrap">
                          <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}
                            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" />
                          {(term === 1
                            ? [[TERM1_END(), 'край I срок ' + fmt(TERM1_END()).slice(0, 5)], [`${startYear() + 1}-06-30`, 'цяла година 30.06']]
                            : [[`${startYear() + 1}-05-31`, '31.05'], [`${startYear() + 1}-06-15`, '15.06'], [`${startYear() + 1}-06-30`, '30.06']]
                          ).map(([v, l]) => (
                            <button key={v} type="button" onClick={() => setTo(v)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs border ${to === v ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{l}</button>
                          ))}
                        </div>
                      </div>
                      <button onClick={save} disabled={saving || pickedCount === 0 || !from || !to}
                        className="ml-auto inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm disabled:opacity-40 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Добави {pickedCount > 0 ? `${pickedCount} ч./седм.` : ''}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
