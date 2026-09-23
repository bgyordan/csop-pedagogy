'use client'
import { useState, useMemo, useEffect } from 'react'
import { Loader2, Check, Save, Users, GraduationCap, X, Trash2, FileDown } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getTeacherSchedule, saveLecturerSlots, clearLecturerSlots, schoolWeeks, getLecturerFrameworkData, removeLecturerSlot } from './actions'
import { generateLecturerFrameworkOrder } from '@/lib/docx-substitution'

type Teacher = { id: string; name: string }
type Marked = { id: string; staffId: string; staffName: string; day: number; period: number; subject: string; holderLabel: string; dateFrom: string; dateTo: string; orderNumber: string }
type SchedSlot = { day: number; period: number; subjectId: string | null; subject: string; holderType: string; holderLabel: string }

const DAYS = [{ n: 1, l: 'Пон' }, { n: 2, l: 'Вт' }, { n: 3, l: 'Ср' }, { n: 4, l: 'Чет' }, { n: 5, l: 'Пет' }]
const PERIODS = [1, 2, 3, 4, 5, 6, 7]
function fmt(d: string) { return d ? d.split('-').reverse().join('.') : '' }
// начало на лекторските часове: 15.09 на текущата учебна година
const yearStart = () => { const d = new Date(); const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-09-15` }
function weeksBetween(from: string, to: string): number {
  if (!from || !to) return 0
  const a = new Date(from + 'T00:00'), b = new Date(to + 'T00:00')
  if (b < a) return 0
  // брой понеделници (учебни седмици) в интервала
  let count = 0
  const d = new Date(a)
  while (d <= b) { if (d.getDay() === 1) count++; d.setDate(d.getDate() + 1) }
  // ако периодът започва след понеделник, добавяме първата непълна седмица
  return count > 0 ? count : 1
}

export default function LecturerClient({ academicYearId, teachers, marked: initialMarked }: {
  academicYearId: string; teachers: Teacher[]; marked: Marked[]
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

  const teacherName = teachers.find(t => t.id === teacherId)?.name || ''
  const filtered = teachers.filter(t => t.name.toLowerCase().includes(tSearch.toLowerCase())).slice(0, 40)

  async function selectTeacher(id: string) {
    setTeacherId(id); setTOpen(false); setTSearch(''); setFrom(yearStart()); setTo('')
    setLoadingSched(true); setSchedule([]); setPicked(new Set())
    const res: any = await getTeacherSchedule(id)
    setSchedule(res.slots || [])
    // НЕ зареждаме записаните в picked — те се показват отделно с периодите си; picked е за нова група
    setLoadingSched(false)
  }

  const slotAt = (day: number, period: number) => schedule.find(s => s.day === day && s.period === period)
  // вече записан лекторски слот (с период) за текущия учител
  const savedAt = (day: number, period: number) => marked.find(m => m.staffId === teacherId && m.day === day && m.period === period)
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
    const res: any = await saveLecturerSlots(teacherId, from, to, slots)
    if (res.error) { toast(res.error, 'error'); setSaving(false); return }
    // добавяме новите към marked (махаме само същите day/period, ако се презаписват)
    const keys = new Set(slots.map(s => `${s.day}-${s.period}`))
    const kept = marked.filter(m => !(m.staffId === teacherId && keys.has(`${m.day}-${m.period}`)))
    const mine: Marked[] = slots.map((s, i) => ({
      id: `tmp-${Date.now()}-${i}`, staffId: teacherId, staffName: teacherName, day: s.day, period: s.period,
      subject: slotAt(s.day, s.period)?.subject || '', holderLabel: s.holderLabel, dateFrom: from, dateTo: to, orderNumber: '',
    }))
    setMarked([...mine, ...kept])
    setPicked(new Set())  // чистим за следваща група
    toast('Добавено')
    setSaving(false)
  }

  const [genning, setGenning] = useState(false)
  async function downloadOrder() {
    setGenning(true)
    const res: any = await getLecturerFrameworkData()
    if (res.error) { toast(res.error, 'error'); setGenning(false); return }
    try { await generateLecturerFrameworkOrder(res.data); toast('Заповедта е изтеглена') }
    catch (e) { toast('Грешка при генериране', 'error') }
    setGenning(false)
  }

  async function removeTeacher(id: string) {
    if (!confirm('Изтрий лекторските на този учител?')) return
    await clearLecturerSlots(id)
    setMarked(prev => prev.filter(m => m.staffId !== id))
    if (id === teacherId) setPicked(new Set())
    toast('Изтрито')
  }

  // учебни седмици по период (от календара) — кеш
  const [weeksCache, setWeeksCache] = useState<Record<string, number>>({})
  useEffect(() => {
    const periods = Array.from(new Set(marked.map(x => `${x.dateFrom}|${x.dateTo}`)))
    periods.forEach(async p => {
      if (weeksCache[p] !== undefined) return
      const [f, t] = p.split('|')
      if (!f || !t) return
      const w = await schoolWeeks(f, t)
      setWeeksCache(prev => ({ ...prev, [p]: w }))
    })
  }, [marked])

  // групиране по учител — общо часа = СУМА по слот × седмиците на СВОЯ период
  const byTeacher = useMemo(() => {
    const m: Record<string, { name: string; count: number; total: number; periods: Set<string>; classes: Set<string> }> = {}
    marked.forEach(x => {
      if (!m[x.staffId]) m[x.staffId] = { name: x.staffName, count: 0, total: 0, periods: new Set(), classes: new Set() }
      const w = weeksCache[`${x.dateFrom}|${x.dateTo}`] ?? weeksBetween(x.dateFrom, x.dateTo)
      m[x.staffId].count++
      m[x.staffId].total += w   // 1 час/седмица × седмиците на този слот
      m[x.staffId].periods.add(`${fmt(x.dateFrom)}–${fmt(x.dateTo)}`)
      if (x.holderLabel) m[x.staffId].classes.add(x.holderLabel)
    })
    return Object.entries(m).map(([id, v]) => ({
      id, name: v.name, count: v.count, total: v.total,
      periods: [...v.periods], classes: [...v.classes],
    }))
  }, [marked, weeksCache])
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
    marked.filter(m => m.staffId === teacherId).forEach(m => {
      const key = `${m.dateFrom}|${m.dateTo}`
      const ex = g.find(x => x.key === key)
      if (ex) ex.count++; else g.push({ key, from: m.dateFrom, to: m.dateTo, count: 1 })
    })
    return g.sort((x, y) => x.to.localeCompare(y.to))
  }, [marked, teacherId])
  const colorOf = (from: string, to: string) => PERIOD_COLORS[Math.max(0, myGroups.findIndex(g => g.key === `${from}|${to}`)) % PERIOD_COLORS.length]
  const selectedInfo = byTeacher.find(t => t.id === teacherId)

  function closeTeacher() { setTeacherId(''); setSchedule([]); setPicked(new Set()); setFrom(yearStart()); setTo('') }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
      {/* ── ЛЯВО: списък с определените + обща заповед (не мърда) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden lg:sticky lg:top-4">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Определени лекторски</h3>
            <span className="text-xs text-slate-500">общо <span className="font-semibold text-slate-800">{grandTotal}</span> ч.</span>
          </div>
          <button onClick={downloadOrder} disabled={genning || byTeacher.length === 0}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-medium hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: '#0f2240' }}>
            {genning ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} Обща заповед
          </button>
        </div>

        {/* добавяне на учител */}
        <div className="p-3 border-b border-slate-100 relative">
          <input type="text" value={tSearch}
            onChange={e => { setTSearch(e.target.value); setTOpen(true) }}
            onFocus={() => setTOpen(true)} onBlur={() => setTimeout(() => setTOpen(false), 150)}
            placeholder="+ Добави / търси учител…"
            className="w-full px-3 py-2 bg-white border border-dashed border-slate-300 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
          {tOpen && (
            <div className="absolute z-30 left-3 right-3 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
              {filtered.map(t => (
                <button key={t.id} onMouseDown={e => e.preventDefault()} onClick={() => selectTeacher(t.id)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 text-slate-700">{t.name}</button>
              ))}
              {filtered.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">Няма такъв</div>}
            </div>
          )}
        </div>

        {byTeacher.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">Още няма определени.</div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
            {byTeacher.map(t => {
              const sel = t.id === teacherId
              return (
                <div key={t.id} onClick={() => !sel && selectTeacher(t.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer group border-l-4 ${sel ? 'bg-teal-50/70 border-l-teal-500' : 'border-l-transparent hover:bg-slate-50'}`}>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm truncate ${sel ? 'font-semibold text-teal-900' : 'text-slate-800'}`}>{t.name}</div>
                    <div className="text-[11px] text-slate-500">{t.count} ч./седм. · общо <span className="font-medium text-slate-700">{t.total} ч.</span></div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeTeacher(t.id) }}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100" title="Изтрий лекторските на учителя"><Trash2 size={13} /></button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── ДЯСНО: избраният учител ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        {!teacherId ? (
          <div className="p-12 text-center text-slate-400">
            <Users size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Изберете учител отляво — от списъка или с „+ Добави“.</p>
            <p className="text-xs mt-1">После маркирате часовете над норматива, задавате период и „Добави“.</p>
          </div>
        ) : (
          <>
            {/* заглавие — ясно кой е избран */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-teal-50/50 rounded-t-2xl">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-teal-700 font-semibold">Въвеждате лекторски за</div>
                <div className="text-lg font-semibold text-slate-800 truncate">{teacherName}</div>
                {selectedInfo && <div className="text-xs text-slate-500">{selectedInfo.count} ч./седм. · общо {selectedInfo.total} ч.</div>}
              </div>
              <button type="button" onClick={closeTeacher}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 shrink-0">
                <Check size={14} /> Готово
              </button>
            </div>

            {loadingSched ? (
              <div className="py-12 text-center text-slate-400"><Loader2 size={20} className="animate-spin inline" /></div>
            ) : schedule.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">Този учител няма въведено разписание.</div>
            ) : (
              <div className="p-4 space-y-3">
                {/* легенда на записаните периоди */}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {myGroups.map(g => (
                    <span key={g.key} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${colorOf(g.from, g.to).cell}`}>
                      <span className={`h-2 w-2 rounded-full ${colorOf(g.from, g.to).dot}`} /> {fmt(g.from)}–{fmt(g.to)} · {g.count} ч./седм.
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-500 bg-slate-500 text-white">маркирани сега</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600">свободни</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr><th className="w-10 px-1 py-1.5 text-[10px] text-slate-400">Час</th>
                        {DAYS.map(d => <th key={d.n} className="px-1 py-1.5 text-xs font-semibold text-slate-600">{d.l}</th>)}</tr>
                    </thead>
                    <tbody>
                      {PERIODS.map(period => (
                        <tr key={period}>
                          <td className="text-center text-sm font-semibold text-slate-600 py-1">{period}.</td>
                          {DAYS.map(d => {
                            const sl = slotAt(d.n, period)
                            const key = `${d.n}-${period}`
                            const on = picked.has(key)
                            const saved = savedAt(d.n, period)
                            return (
                              <td key={d.n} className="p-1">
                                {sl ? (
                                  saved ? (
                                    <div className={`relative w-full min-h-[46px] rounded-lg border px-1.5 py-1 text-left ${colorOf(saved.dateFrom, saved.dateTo).cell}`}>
                                      <div className="text-[10px] opacity-80 truncate pr-3">{sl.holderLabel}</div>
                                      <div className="text-[11px] truncate">{sl.subject}</div>
                                      <div className="text-[9px] opacity-80">{fmt(saved.dateFrom)}–{fmt(saved.dateTo)}</div>
                                      <button onClick={async () => {
                                        await removeLecturerSlot(teacherId, d.n, period)
                                        setMarked(prev => prev.filter(m => !(m.staffId === teacherId && m.day === d.n && m.period === period)))
                                      }} className="absolute top-0.5 right-0.5 opacity-50 hover:opacity-100 hover:text-rose-600" title="Премахни"><X size={11} /></button>
                                    </div>
                                  ) : (
                                    <button onClick={() => togglePick(d.n, period)}
                                      className={`w-full min-h-[46px] rounded-lg border px-1.5 py-1 text-left transition-all ${on ? 'border-slate-500 bg-slate-500 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400'}`}>
                                      <div className="text-[10px] opacity-80 truncate">{sl.holderLabel}</div>
                                      <div className="text-[11px] truncate">{sl.subject}</div>
                                    </button>
                                  )
                                ) : <div className="min-h-[46px]" />}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* период + добави — точно под решетката на този учител */}
                <div className="flex items-end gap-3 flex-wrap p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">От</label>
                    <input type="date" value={from} onChange={e => { setFrom(e.target.value); if (to && e.target.value > to) setTo('') }}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">До</label>
                    <div className="flex items-center gap-1.5">
                      <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
                      <button type="button" onClick={() => setTo('2027-05-31')} className="px-2 py-1.5 rounded-lg text-[11px] bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">31.05</button>
                      <button type="button" onClick={() => setTo('2027-06-15')} className="px-2 py-1.5 rounded-lg text-[11px] bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">15.06</button>
                      <button type="button" onClick={() => setTo('2027-06-30')} className="px-2 py-1.5 rounded-lg text-[11px] bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">30.06</button>
                    </div>
                  </div>
                  <button onClick={save} disabled={saving || pickedCount === 0 || !from || !to}
                    className="ml-auto inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Добави {pickedCount > 0 ? `${pickedCount} ч.` : ''}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
