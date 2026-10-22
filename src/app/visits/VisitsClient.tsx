'use client'
// Посещение на час.
// Управата: създава проверката (период, изключени дни, по колко на ден, предмет, кои роли) и вижда графика по дни,
//           кой още не е избрал, изтегля Word. По желание — съобщение-листче до участниците.
// Учителят: избира ден (свободните места се виждат), после час — от седмичното си разписание или ръчно, предмет и тема.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarCheck, Plus, X, Loader2, Check, Pencil, Trash2, Lock, Unlock, FileText, Users, Clock,
  BookOpen, Megaphone, Calculator,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast, confirmDialog } from '@/components/ui/Toast'
import { PERIOD_LABEL, PERIOD_TIMES, MORNING_PERIODS, AFTERNOON_PERIODS, COUD_PERIODS, byStartTime } from '@/lib/periods'

type Campaign = {
  id: string; title: string; focus_subject: string | null; note: string | null; date_from: string; date_to: string
  excluded_dates: string[]; per_day: number; use_schedule: boolean; roles: string[]; is_open: boolean
  slot_periods?: number[] | null   // фиксирани часове за всички (напр. [3, 4]); празно — всеки избира свой час
  excluded_staff?: string[] | null // не подлежат (изнесени групи, вече посетени)
  slot_periods_pm?: number[] | null // следобедни часове за учителите ЦОУД (21–26)
  per_day_pm?: number | null
}
type Booking = {
  id: string; campaign_id: string; staff_id: string; date: string; period: number; class_name: string | null
  subject: string | null; topic: string | null; staff?: { first_name: string; last_name: string; position: string | null } | null
}
type Lesson = { term: number; day: number; period: number; label: string; subject: string }

const ACCENT = '#0f2240'
const WD = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const WD_LONG = ['неделя', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота']
const MONTHS = ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек']
const ROLE_OPTS = [{ v: 'class_teacher', l: 'Класни ръководители' }, { v: 'teacher', l: 'Учители' }, { v: 'educator', l: 'Учители ЦОУД' }]

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => new Date(s + 'T00:00')
const dm = (s: string) => s.split('-').reverse().slice(0, 2).join('.')
const todayIso = () => iso(new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Sofia' })))
const fixedOf = (c: Campaign) => [...(c.slot_periods || [])].sort(byStartTime)
const pmSlotsOf = (c: Campaign) => [...(c.slot_periods_pm || [])].sort(byStartTime)
const isPm = (p: number) => p >= 21   // ЦОУД часовете — следобед
const slotLabel = (p: number) => (Number(PERIOD_LABEL[p]) ? `${PERIOD_LABEL[p]}. час` : PERIOD_LABEL[p] || `${p}. час`)
const timeOf = (p: number) => (PERIOD_TIMES[p] || '').split('–')
const periodText = (p: number) => `${PERIOD_LABEL[p] ? (Number(PERIOD_LABEL[p]) ? `${PERIOD_LABEL[p]}. час` : PERIOD_LABEL[p]) : `${p}. час`}${PERIOD_TIMES[p] ? ` · ${PERIOD_TIMES[p]}` : ''}`
function weekdays(from: string, to: string) {
  const out: string[] = []
  for (let d = parse(from); iso(d) <= to; d.setDate(d.getDate() + 1)) { const w = d.getDay(); if (w >= 1 && w <= 5) out.push(iso(d)) }
  return out
}

export default function VisitsClient(p: {
  me: { id: string; role: string; name: string }; isMgmt: boolean
  campaigns: { id: string; title: string; date_from: string; date_to: string }[]; campaign: Campaign | null
  bookings: Booking[]; slots: { date: string; period: number; mine: boolean }[]
  people: { id: string; first_name: string; last_name: string; role: string }[]
  lessons: Lesson[]; calendar: { date: string; is_school_day: boolean; term: number }[]
}) {
  const router = useRouter()
  const [form, setForm] = useState<Campaign | 'new' | null>(!p.campaign && p.isMgmt ? 'new' : null)
  const c = p.campaign

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <header className="flex flex-wrap items-center gap-4 mb-6 pb-5 border-b border-slate-100">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0"><CalendarCheck size={22} /></div>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">{c?.title || 'Посещение на час'}</h1>
          {c && <p className="text-sm text-slate-500 mt-0.5">
            {dm(c.date_from)} – {dm(c.date_to)}{c.focus_subject ? <> · основна тема: <span className="text-slate-700">{c.focus_subject}</span></> : null}
            {' · '}сутрин {c.per_day} на ден{fixedOf(c).length ? ` (${fixedOf(c).map(slotLabel).join(', ')})` : ''}
            {pmSlotsOf(c).length > 0 && (c.per_day_pm || 0) > 0 ? ` · следобед ${c.per_day_pm} (${pmSlotsOf(c).map(slotLabel).join(', ')})` : ''}{!c.is_open && <span className="ml-2 text-[12px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">затворено за избор</span>}
          </p>}
        </div>
        {p.isMgmt && p.campaigns.length > 1 && (
          <select value={c?.id || ''} onChange={e => router.push(`/visits?c=${e.target.value}`)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
            {p.campaigns.map(x => <option key={x.id} value={x.id}>{x.title} · {dm(x.date_from)}–{dm(x.date_to)}</option>)}
          </select>
        )}
        {p.isMgmt && (
          <button type="button" onClick={() => setForm('new')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white hover:opacity-90" style={{ backgroundColor: ACCENT }}>
            <Plus size={16} /> Нова проверка
          </button>
        )}
      </header>

      {c && (p.isMgmt ? <Board {...p} campaign={c} onEdit={() => setForm(c)} /> : <Pick {...p} campaign={c} />)}
      {!c && !p.isMgmt && <p className="text-sm text-slate-500">Няма отворена проверка.</p>}

      {form && <CampaignForm initial={form === 'new' ? null : form} meId={p.me.id} people={p.people} onClose={() => setForm(null)}
        onSaved={id => { setForm(null); router.push(`/visits?c=${id}`); router.refresh() }} />}
    </div>
  )
}

// ═══════════════ дни на проверката ═══════════════
function useDays(c: Campaign, calendar: { date: string; is_school_day: boolean; term: number }[]) {
  return useMemo(() => {
    const cal: Record<string, { school: boolean; term: number }> = {}
    calendar.forEach(d => { cal[d.date] = { school: d.is_school_day, term: d.term } })
    return weekdays(c.date_from, c.date_to).map(d => ({
      date: d,
      excluded: c.excluded_dates.includes(d),
      nonSchool: cal[d] ? !cal[d].school : false,
      term: cal[d]?.term || (parse(d).getMonth() >= 1 && parse(d).getMonth() <= 7 ? 2 : 1),
    }))
  }, [c, calendar])
}

// ═══════════════ УЧИТЕЛЯТ ═══════════════
function Pick({ me, campaign: c, bookings, slots, lessons, calendar }: Parameters<typeof VisitsClient>[0] & { campaign: Campaign }) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  const days = useDays(c, calendar)
  const mine = bookings.find(b => b.staff_id === me.id) || null
  const [changing, setChanging] = useState(!mine)
  const [day, setDay] = useState<string | null>(null)
  const [period, setPeriod] = useState<number | null>(null)
  const [cls, setCls] = useState('')
  const [subject, setSubject] = useState(c.focus_subject || '')
  const [topic, setTopic] = useState('')
  const [manual, setManual] = useState(!c.use_schedule)
  const [busy, setBusy] = useState(false)
  const today = todayIso()
  const pmMode = me.role === 'educator'            // учителите ЦОУД — следобедните места
  const fixed = pmMode ? pmSlotsOf(c) : fixedOf(c)
  const limit = pmMode ? (c.per_day_pm || 0) : c.per_day
  // паралелките/групите на учителя от разписанието — за бърз избор при фиксираните часове
  const myGroups = useMemo(() => Array.from(new Set(lessons.map(l => l.label).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'bg', { numeric: true })), [lessons])

  // заетост без имената на другите (своят запис не се брои — може да го смени)
  const others = slots.filter(s => !s.mine && isPm(s.period) === pmMode)
  const takenOn = (d: string) => others.filter(s => s.date === d)
  const free = (d: string) => limit - takenOn(d).length
  const takenPeriod = (d: string, per: number) => others.some(s => s.date === d && s.period === per)

  const dayInfo = days.find(d => d.date === day)
  const dayLessons = useMemo(() => {
    if (!day || !dayInfo) return []
    const dow = parse(day).getDay()
    const inTerm = lessons.filter(l => l.term === dayInfo.term)
    const src = inTerm.length ? inTerm : lessons.filter(l => l.term === 1)
    const focus = (c.focus_subject || '').toLowerCase()
    return src.filter(l => l.day === dow)
      .sort((a, b) => (focus ? Number(b.subject.toLowerCase().includes(focus)) - Number(a.subject.toLowerCase().includes(focus)) : 0) || byStartTime(a.period, b.period))
  }, [day, dayInfo, lessons, c.focus_subject])

  function pickDay(d: string) {
    setDay(d); setPeriod(null); setSubject(c.focus_subject || '')
    if (!fixed.length) setCls('')
    else if (!cls && myGroups.length === 1) setCls(myGroups[0])
    setManual(!c.use_schedule)
  }
  function pickLesson(l: Lesson) {
    setPeriod(l.period); setCls(l.label); setSubject(l.subject)
  }
  async function save() {
    if (!day || period === null) return
    setBusy(true)
    const row = { campaign_id: c.id, staff_id: me.id, date: day, period, class_name: cls.trim() || null, subject: subject.trim() || null, topic: topic.trim() || null }
    const { error } = mine
      ? await supabase.from('visit_bookings').update(row).eq('id', mine.id)
      : await supabase.from('visit_bookings').insert(row)
    setBusy(false)
    if (error) { toast(error.message.includes('visit_bookings_campaign_id_date_period') ? 'Този час вече е зает — изберете друг' : error.message, 'error'); router.refresh(); return }
    toast('Записано — ще бъдете посетен на избрания час')
    setChanging(false); router.refresh()
  }
  async function cancel() {
    if (!mine || !await confirmDialog('Да се откаже ли избраният ден?')) return
    const { error } = await supabase.from('visit_bookings').delete().eq('id', mine.id)
    if (error) { toast(error.message, 'error'); return }
    setChanging(true); router.refresh()
  }

  const canChange = c.is_open && (!mine || mine.date > today)

  return (
    <div className="space-y-6 max-w-4xl">
      {c.note && <div className="px-4 py-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-[14px] text-slate-700 whitespace-pre-wrap">{c.note}</div>}

      {mine && !changing && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-wrap items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-indigo-600 text-white flex flex-col items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
            <span className="text-[11px] uppercase tracking-wider opacity-80">{WD[parse(mine.date).getDay()]}</span>
            <span className="text-3xl font-semibold leading-none">{parse(mine.date).getDate()}</span>
            <span className="text-[11px] opacity-80">{MONTHS[parse(mine.date).getMonth()]}</span>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-[12px] uppercase tracking-wide text-slate-400">Вашето посещение</div>
            <div className="text-lg text-slate-800 mt-0.5">{WD_LONG[parse(mine.date).getDay()]}, {dm(mine.date)} · {periodText(mine.period)}</div>
            <div className="text-[14px] text-slate-600 mt-1">{[mine.class_name, mine.subject].filter(Boolean).join(' · ')}</div>
            {mine.topic && <div className="text-[14px] text-slate-500 mt-0.5">Тема: {mine.topic}</div>}
          </div>
          {canChange && (
            <div className="flex gap-2">
              <button type="button" onClick={() => { setChanging(true); pickDay(mine.date); setPeriod(mine.period); setCls(mine.class_name || ''); setSubject(mine.subject || ''); setTopic(mine.topic || ''); setManual(true) }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"><Pencil size={14} /> Промени</button>
              <button type="button" onClick={cancel} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Откажи"><Trash2 size={16} /></button>
            </div>
          )}
        </div>
      )}

      {changing && !c.is_open && <p className="text-sm text-slate-500">Изборът е затворен.</p>}

      {changing && c.is_open && (
        <>
          <section>
            <h2 className="text-[13px] uppercase tracking-wide text-slate-500 mb-2.5">1 · Изберете ден</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
              {days.map(d => {
                const n = free(d.date)
                const off = d.excluded || d.nonSchool || d.date <= today
                const full = n <= 0
                const sel = day === d.date
                return (
                  <button key={d.date} type="button" disabled={off || full} onClick={() => pickDay(d.date)}
                    className={`relative rounded-2xl border px-2 py-2.5 text-center transition-all ${sel ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/25 -translate-y-0.5'
                      : off || full ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:-translate-y-0.5 hover:shadow-sm'}`}>
                    <div className={`text-[11px] uppercase ${sel ? 'text-white/80' : ''}`}>{WD[parse(d.date).getDay()]}</div>
                    <div className="text-xl font-semibold leading-tight">{parse(d.date).getDate()}</div>
                    <div className={`text-[11px] ${sel ? 'text-white/80' : ''}`}>{MONTHS[parse(d.date).getMonth()]}</div>
                    <div className={`mt-1 text-[10.5px] ${sel ? 'text-white' : d.excluded || d.nonSchool ? 'text-slate-400' : full ? 'text-rose-400' : 'text-emerald-600'}`}>
                      {d.excluded ? 'без посещения' : d.nonSchool ? 'неучебен' : d.date <= today ? 'минал' : full ? 'зает' : `${n} ${n === 1 ? 'място' : 'места'}`}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {day && fixed.length > 0 && (
            <section className="animate-in fade-in slide-in-from-top-1 duration-300">
              <h2 className="text-[13px] uppercase tracking-wide text-slate-500 mb-2.5">2 · Час — {WD_LONG[parse(day).getDay()]}, {dm(day)}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {fixed.map(per => {
                  const taken = takenPeriod(day, per)
                  const sel = period === per
                  const [a, b] = timeOf(per)
                  return (
                    <button key={per} type="button" disabled={taken} onClick={() => setPeriod(per)}
                      className={`rounded-2xl border p-3 text-left transition-all ${sel ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/25' : taken ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-indigo-300 hover:-translate-y-0.5'}`}>
                      <div className={`text-[12px] ${sel ? 'text-white/80' : 'text-slate-500'}`}>{slotLabel(per)}</div>
                      <div className="text-xl font-semibold leading-tight tabular-nums">{a}<span className={`text-sm font-normal ${sel ? 'text-white/70' : 'text-slate-400'}`}> – {b}</span></div>
                      <div className={`text-[11px] mt-0.5 ${sel ? 'text-white/80' : taken ? 'text-rose-300' : 'text-emerald-600'}`}>{taken ? 'зает' : 'свободен'}</div>
                    </button>
                  )
                })}
              </div>
              <div className="mt-3">
                <span className="block text-[12px] text-slate-500 mb-1.5">Паралелка / група</span>
                {myGroups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {myGroups.map(g => (
                      <button key={g} type="button" onClick={() => setCls(g)}
                        className={`px-2.5 py-1 rounded-full text-[12.5px] border ${cls === g ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>{g}</button>
                    ))}
                  </div>
                )}
                <input value={cls} onChange={e => setCls(e.target.value)} placeholder="напр. паралелка 05"
                  className="w-full sm:w-80 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
              </div>
            </section>
          )}

          {day && fixed.length === 0 && (
            <section className="animate-in fade-in slide-in-from-top-1 duration-300">
              <div className="flex items-center gap-3 mb-2.5">
                <h2 className="text-[13px] uppercase tracking-wide text-slate-500">2 · Час — {WD_LONG[parse(day).getDay()]}, {dm(day)}</h2>
                {c.use_schedule && (
                  <div className="ml-auto inline-flex p-0.5 rounded-lg bg-slate-100 text-[12px]">
                    <button type="button" onClick={() => setManual(false)} className={`px-2.5 py-1 rounded-md ${!manual ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>от разписанието</button>
                    <button type="button" onClick={() => setManual(true)} className={`px-2.5 py-1 rounded-md ${manual ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>друг час</button>
                  </div>
                )}
              </div>
              {!manual ? (
                dayLessons.length ? (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {dayLessons.map((l, i) => {
                      const taken = takenPeriod(day, l.period)
                      const sel = period === l.period && cls === l.label
                      const focus = !!c.focus_subject && l.subject.toLowerCase().includes(c.focus_subject.toLowerCase())
                      return (
                        <button key={i} type="button" disabled={taken} onClick={() => pickLesson(l)}
                          className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${sel ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-200' : taken ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed' : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                          <span className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm shrink-0 ${sel ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{PERIOD_LABEL[l.period] || l.period}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[14px] text-slate-800">{l.subject || '—'}{focus && <Calculator size={13} className="text-indigo-500" />}</span>
                            <span className="block text-[12px] text-slate-500">{l.label} · {PERIOD_TIMES[l.period]}{taken ? ' · зает' : ''}</span>
                          </span>
                          {sel && <Check size={16} className="text-indigo-600" />}
                        </button>
                      )
                    })}
                  </div>
                ) : <p className="text-sm text-slate-500">В разписанието ви няма часове в този ден — изберете „друг час“.</p>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {[...MORNING_PERIODS, ...AFTERNOON_PERIODS].sort(byStartTime).map(per => {
                      const taken = takenPeriod(day, per)
                      return (
                        <button key={per} type="button" disabled={taken} onClick={() => setPeriod(per)} title={PERIOD_TIMES[per]}
                          className={`px-3 py-1.5 rounded-xl border text-[13px] ${period === per ? 'bg-indigo-600 border-indigo-600 text-white' : taken ? 'border-slate-100 text-slate-300 line-through cursor-not-allowed' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'}`}>
                          {Number(PERIOD_LABEL[per]) ? `${PERIOD_LABEL[per]}. час` : PERIOD_LABEL[per]}
                        </button>
                      )
                    })}
                  </div>
                  <input value={cls} onChange={e => setCls(e.target.value)} placeholder="Паралелка / група — напр. паралелка 05"
                    className="w-full sm:w-80 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
              )}
            </section>
          )}

          {day && period !== null && (
            <section className="animate-in fade-in slide-in-from-top-1 duration-300 bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <h2 className="text-[13px] uppercase tracking-wide text-slate-500">3 · Предмет и тема</h2>
              <div className="grid sm:grid-cols-[220px_1fr] gap-2">
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Предмет" className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Тема на урока" className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[13px] text-slate-500">{WD_LONG[parse(day).getDay()]}, {dm(day)} · {periodText(period)}{cls ? ` · ${cls}` : ''}</span>
                <div className="flex gap-2">
                  {mine && <button type="button" onClick={() => setChanging(false)} className="px-4 py-2 rounded-xl text-sm border border-slate-200 text-slate-700">Отказ</button>}
                  <button type="button" onClick={save} disabled={busy || !topic.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm text-white disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запиши
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════ УПРАВАТА ═══════════════
function Board({ campaign: c, bookings, people, calendar, onEdit }: Parameters<typeof VisitsClient>[0] & { campaign: Campaign; onEdit: () => void }) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  const days = useDays(c, calendar)
  const [busy, setBusy] = useState(false)
  const today = todayIso()
  const booked = new Set(bookings.map(b => b.staff_id))
  const ex = new Set(c.excluded_staff || [])
  const inScope = people.filter(x => (c.roles || []).includes(x.role))
  const participants = inScope.filter(x => !ex.has(x.id))
  const missing = participants.filter(x => !booked.has(x.id))
  const excludedPeople = inScope.filter(x => ex.has(x.id))
  const [openDay, setOpenDay] = useState<string | null>(null)
  const clsShort = (s: string | null) => (s || '').replace(/^паралелка\s*/i, '').replace(/^ИФО\s+.*/i, 'ИФО').trim()
  async function setExcluded(ids: string[]) {
    const { error } = await supabase.from('visit_campaigns').update({ excluded_staff: ids }).eq('id', c.id)
    if (error) { toast(error.message.includes('excluded_staff') ? 'Пуснете SQL файла 2026-10-20_class_visits_exclude.sql' : error.message, 'error'); return }
    router.refresh()
  }
  const byDay = (d: string) => bookings.filter(b => b.date === d).sort((a, b) => byStartTime(a.period, b.period))
  const name = (b: Booking) => b.staff ? `${b.staff.first_name} ${b.staff.last_name}` : '—'
  const usable = days.filter(d => !d.excluded && !d.nonSchool)

  async function toggleOpen() {
    const { error } = await supabase.from('visit_campaigns').update({ is_open: !c.is_open }).eq('id', c.id)
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  async function removeBooking(b: Booking) {
    if (!await confirmDialog(`Да се махне ли посещението на ${name(b)}? Ще може да избере отново.`)) return
    const { error } = await supabase.from('visit_bookings').delete().eq('id', b.id)
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  async function removeCampaign() {
    if (!await confirmDialog(`Да се изтрие ли „${c.title}“ заедно с всички избрани дни?`)) return
    const { error } = await supabase.from('visit_campaigns').delete().eq('id', c.id)
    if (error) { toast(error.message, 'error'); return }
    router.push('/visits'); router.refresh()
  }
  async function word() {
    setBusy(true)
    try {
      const { generateVisitSchedule } = await import('@/lib/docx-visits')
      await generateVisitSchedule({
        title: c.title, focus: c.focus_subject, from: c.date_from, to: c.date_to,
        rows: [...bookings].sort((a, b) => a.date.localeCompare(b.date) || byStartTime(a.period, b.period)).map(b => ({
          date: `${WD[parse(b.date).getDay()]}, ${dm(b.date)}`, period: periodText(b.period), teacher: name(b),
          cls: b.class_name || '', subject: b.subject || '', topic: b.topic || '',
        })),
      })
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-4 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-sm text-slate-600"><span className="text-xl font-semibold text-slate-800">{bookings.length}</span> / {participants.length} избрали</span>
          <span className="w-px h-6 bg-slate-200" />
          <span className="text-sm text-slate-600">{usable.length} дни · сутрин {usable.length * c.per_day} места{pmSlotsOf(c).length && c.per_day_pm ? ` · следобед ${usable.length * c.per_day_pm}` : ''}</span>
        </div>
        <span className="flex-1" />
        <button type="button" onClick={toggleOpen} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-700 hover:bg-slate-50">
          {c.is_open ? <><Lock size={14} /> Затвори избора</> : <><Unlock size={14} /> Отвори избора</>}
        </button>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-700 hover:bg-slate-50"><Pencil size={14} /> Настройки</button>
        <button type="button" onClick={word} disabled={busy || !bookings.length} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] text-white disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} График (Word)
        </button>
        <button type="button" onClick={removeCampaign} title="Изтрий проверката" className="p-2 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {days.map(d => {
          const list = byDay(d.date)
          const off = d.excluded || d.nonSchool
          const isToday = d.date === today
          return (
            <div key={d.date} onClick={() => !off && list.length > 0 && setOpenDay(d.date)}
              className={`rounded-2xl border p-3 min-h-[96px] transition-all ${off ? 'bg-slate-50 border-slate-100' : `${list.length ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''} ${isToday ? 'bg-white border-indigo-300 shadow-sm ring-1 ring-indigo-100' : 'bg-white border-slate-200 shadow-[0_1px_2px_rgba(15,34,64,0.04)]'}`}`}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className={`text-lg font-semibold ${off ? 'text-slate-300' : 'text-slate-800'}`}>{parse(d.date).getDate()}</span>
                <span className={`text-[12px] ${off ? 'text-slate-300' : 'text-slate-500'}`}>{MONTHS[parse(d.date).getMonth()]} · {WD[parse(d.date).getDay()]}</span>
                {!off && (() => {
                  const am = list.filter(b => !isPm(b.period)).length, pm = list.filter(b => isPm(b.period)).length
                  const pmCap = pmSlotsOf(c).length ? (c.per_day_pm || 0) : 0
                  const cls = (n: number, cap: number) => n >= cap ? 'bg-emerald-50 text-emerald-700' : n ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                  return <span className="ml-auto flex gap-1">
                    <span title="сутрин" className={`text-[11px] px-1.5 py-0.5 rounded-full ${cls(am, c.per_day)}`}>{am}/{c.per_day}</span>
                    {pmCap > 0 && <span title="следобед — ЦОУД" className={`text-[11px] px-1.5 py-0.5 rounded-full ${cls(pm, pmCap)}`}>☾ {pm}/{pmCap}</span>}
                  </span>
                })()}
              </div>
              {off ? <div className="text-[12px] text-slate-400">{d.excluded ? 'без посещения' : 'неучебен ден'}</div> : (
                <div className="space-y-1">
                  {list.map(b => (
                    <div key={b.id}
                      title={[periodText(b.period), name(b), b.class_name, b.subject, b.topic ? `„${b.topic}“` : ''].filter(Boolean).join('\n')}
                      className="flex items-center gap-2 rounded-lg bg-indigo-50/60 px-2 py-1">
                      <span className={`h-5 min-w-5 px-1 rounded-md text-white text-[11px] flex items-center justify-center shrink-0 ${isPm(b.period) ? 'bg-teal-600' : 'bg-indigo-600'}`}>{isPm(b.period) ? `Ц${String(PERIOD_LABEL[b.period] || '').replace(/\D/g, '')}` : PERIOD_LABEL[b.period] || b.period}</span>
                      <span className="text-[12.5px] text-slate-800 truncate flex-1">{name(b)}</span>
                      {clsShort(b.class_name) && <span className="text-[11.5px] text-slate-500 tabular-nums shrink-0">{clsShort(b.class_name)}</span>}
                    </div>
                  ))}
                  {!list.length && <div className="text-[12px] text-slate-300">свободен</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <Users size={15} className="text-slate-400" />
          <h2 className="text-[13px] uppercase tracking-wide text-slate-500">Още не са избрали</h2>
          <span className="text-xs text-slate-400">{missing.length}</span>
        </div>
        {missing.length ? (
          <div className="flex flex-wrap gap-1.5">
            {missing.map(x => (
              <span key={x.id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[12.5px] text-amber-900">
                {x.first_name} {x.last_name}
                <button type="button" title="Не подлежи — изключи" onClick={() => setExcluded([...(c.excluded_staff || []), x.id])}
                  className="p-0.5 rounded text-amber-300 hover:text-rose-600"><X size={12} /></button>
              </span>
            ))}
          </div>
        ) : <p className="text-sm text-emerald-700">Всички са избрали.</p>}
        {missing.length > 0 && <p className="text-[11.5px] text-slate-400 mt-2">× — не подлежи (изнесена група, вече посетен)</p>}
        {excludedPeople.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="text-[12px] text-slate-400 mb-1.5">Изключени · {excludedPeople.length} — клик връща</div>
            <div className="flex flex-wrap gap-1.5">
              {excludedPeople.map(x => (
                <button key={x.id} type="button" title="Върни в проверката" onClick={() => setExcluded((c.excluded_staff || []).filter(i => i !== x.id))}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[12.5px] text-slate-400 line-through hover:no-underline hover:text-slate-700">
                  {x.first_name} {x.last_name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {openDay && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpenDay(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex flex-col items-center justify-center leading-none">
                <span className="text-[10px] uppercase opacity-80">{WD[parse(openDay).getDay()]}</span>
                <span className="text-lg font-semibold">{parse(openDay).getDate()}</span>
              </div>
              <h3 className="flex-1 text-base text-slate-800">{WD_LONG[parse(openDay).getDay()]}, {dm(openDay)}</h3>
              <button type="button" onClick={() => setOpenDay(null)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-2.5">
              {byDay(openDay).map(b => (
                <div key={b.id} className="relative rounded-2xl border border-slate-200 p-3.5 pr-10">
                  <div className="flex items-center gap-1.5 text-[12px] text-indigo-700"><Clock size={12} /> {periodText(b.period)}</div>
                  <div className="text-[15px] text-slate-800 mt-0.5">{name(b)}</div>
                  <div className="text-[13px] text-slate-500">{[b.class_name, b.subject].filter(Boolean).join(' · ')}</div>
                  {b.topic && <div className="text-[13px] text-slate-700 mt-1">Тема: {b.topic}</div>}
                  {/* констативен протокол от посещението (контролна дейност) */}
                  <a href={`/control?visit=${b.id}`} className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg text-[12.5px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                    <FileText size={13} /> Протокол
                  </a>
                  <button type="button" onClick={() => removeBooking(b)} title="Махни — ще може да избере отново"
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
                </div>
              ))}
              {!byDay(openDay).length && <p className="text-sm text-slate-400">Няма записани.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════ НАСТРОЙКИ НА ПРОВЕРКАТА ═══════════════
// Компактно, в две колони: вляво — какво и кога; вдясно — сутрин (учители), следобед (учители ЦОУД), участници.
function CampaignForm({ initial, meId, people, onClose, onSaved }: {
  initial: Campaign | null; meId: string; people: { id: string; first_name: string; last_name: string; role: string }[]
  onClose: () => void; onSaved: (id: string) => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [title, setTitle] = useState(initial?.title || 'Посещение на час')
  const [focus, setFocus] = useState(initial?.focus_subject ?? 'Математика')
  const [note, setNote] = useState(initial?.note || '')
  const [from, setFrom] = useState(initial?.date_from || '')
  const [to, setTo] = useState(initial?.date_to || '')
  const [excluded, setExcluded] = useState<string[]>(initial?.excluded_dates || [])
  // сутрин — учители
  const [amRoles, setAmRoles] = useState<string[]>((initial?.roles || ['class_teacher', 'teacher']).filter(r => r !== 'educator'))
  const [slots, setSlots] = useState<number[]>(initial ? (initial.slot_periods || []) : [1, 2, 3, 4])
  const [perDay, setPerDay] = useState(initial?.per_day || 2)
  const [useSchedule, setUseSchedule] = useState(initial?.use_schedule ?? true)
  // следобед — учители ЦОУД
  const [pmOn, setPmOn] = useState(initial ? (initial.roles || []).includes('educator') : true)
  const [pmSlots, setPmSlots] = useState<number[]>(initial?.slot_periods_pm?.length ? initial.slot_periods_pm : [22])
  const [pmPerDay, setPmPerDay] = useState(initial?.per_day_pm || 1)
  const [exStaff, setExStaff] = useState<string[]>(initial?.excluded_staff || [])
  const [announce, setAnnounce] = useState(!initial)
  const [busy, setBusy] = useState(false)
  const days = from && to && to >= from ? weekdays(from, to) : []
  const workdays = days.filter(d => !excluded.includes(d)).length
  const roles = [...amRoles, ...(pmOn ? ['educator'] : [])]
  const ok = title.trim() && from && to && to >= from && roles.length && workdays > 0 && (!pmOn || pmSlots.length > 0)
  const amOk = amRoles.length > 0
  const slotName = (x: number) => Number(PERIOD_LABEL[x]) ? `${PERIOD_LABEL[x]}. час` : PERIOD_LABEL[x]

  async function save() {
    if (!ok) return
    setBusy(true)
    const row = {
      title: title.trim(), focus_subject: focus.trim() || null, note: note.trim() || null, date_from: from, date_to: to,
      excluded_dates: excluded.filter(d => d >= from && d <= to), roles,
      per_day: perDay, slot_periods: [...slots].sort(byStartTime), use_schedule: slots.length ? false : useSchedule,
      per_day_pm: pmOn ? pmPerDay : 0, slot_periods_pm: pmOn ? [...pmSlots].sort(byStartTime) : [],
      excluded_staff: exStaff,
    }
    const res = initial
      ? await supabase.from('visit_campaigns').update(row).eq('id', initial.id).select('id').single()
      : await supabase.from('visit_campaigns').insert({ ...row, created_by: meId }).select('id').single()
    if (res.error || !res.data) {
      setBusy(false)
      toast(res.error?.message.includes('_pm') ? 'Пуснете SQL файла 2026-10-21_class_visits_afternoon.sql' : res.error?.message.includes('visit_') ? 'Пуснете SQL файловете за посещенията' : res.error?.message || 'Грешка', 'error')
      return
    }
    if (announce) {
      const skip = excluded.filter(d => d >= from && d <= to).map(dm).join(', ')
      const body = [
        `Изберете ден и час, в който да бъдете посетени${focus.trim() ? ` — основна тема: ${focus.trim()}` : ''}.`,
        `- Период: ${dm(from)} – ${dm(to)}${skip ? ` (без ${skip})` : ''}`,
        ...(amOk ? [slots.length
          ? `- Учители: ${[...slots].sort(byStartTime).map(slotName).join(', ')} — по ${perDay} на ден, кой първи избере`
          : `- Учители: по ${perDay} посещения на ден — кой първи избере`] : []),
        ...(pmOn ? [`- Учители ЦОУД: ${[...pmSlots].sort(byStartTime).map(x => `${slotName(x)} (${PERIOD_TIMES[x]})`).join(', ')} — по ${pmPerDay} на ден`] : []),
        `- Таблото → „Посещение на час“ → ден → час → тема`,
        ...(note.trim() ? ['', note.trim()] : []),
      ].join('\n')
      const { error } = await supabase.from('announcements').insert({
        title: title.trim(), body, target_roles: roles, expires_at: to, created_by: meId, is_active: true, show_popup: true,
      })
      if (error) toast('Проверката е записана, но съобщението не се изпрати', 'error')
    }
    setBusy(false)
    toast(initial ? 'Запазено' : 'Проверката е отворена за избор')
    onSaved(res.data.id)
  }

  const lbl = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5'
  const inp = 'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm'
  const Toggle = ({ on, onClick, color = 'bg-indigo-600' }: { on: boolean; onClick: () => void; color?: string }) => (
    <button type="button" onClick={onClick} className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${on ? color : 'bg-slate-300'}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-1'}`} />
    </button>
  )
  const Count = ({ value, onChange, max = 4 }: { value: number; onChange: (n: number) => void; max?: number }) => (
    <div className="inline-flex p-0.5 rounded-lg bg-slate-100">{Array.from({ length: max }, (_, i) => i + 1).map(n => (
      <button key={n} type="button" onClick={() => onChange(n)} className={`w-7 py-0.5 rounded-md text-[13px] ${value === n ? 'bg-white shadow-sm text-[#0f2240]' : 'text-slate-500'}`}>{n}</button>
    ))}</div>
  )
  const SlotChips = ({ list, value, onChange }: { list: number[]; value: number[]; onChange: (v: number[]) => void }) => (
    <div className="flex flex-wrap gap-1">
      {list.map(per => {
        const on = value.includes(per)
        return (
          <button key={per} type="button" onClick={() => onChange(on ? value.filter(x => x !== per) : [...value, per])}
            className={`px-2 py-1 rounded-lg border text-left leading-tight ${on ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>
            <span className="block text-[12px]">{slotName(per)}</span>
            <span className="block text-[10px] tabular-nums opacity-80">{PERIOD_TIMES[per]}</span>
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div className="w-full max-w-5xl h-full md:h-auto md:max-h-[92vh] bg-white md:rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 shrink-0">
          <h2 className="flex-1 text-base text-[#0f2240]">{initial ? 'Настройки на проверката' : 'Нова проверка — посещение на час'}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 grid md:grid-cols-2 gap-x-6 gap-y-4 content-start">
          {/* ── вляво: какво и кога ── */}
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_150px] gap-2">
              <div><span className={lbl}>Заглавие</span><input value={title} onChange={e => setTitle(e.target.value)} className={inp} /></div>
              <div><span className={lbl}>Основна тема</span><input value={focus} onChange={e => setFocus(e.target.value)} placeholder="Математика" className={inp} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><span className={lbl}>От</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inp} /></div>
              <div><span className={lbl}>До</span><input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className={inp} /></div>
            </div>
            {days.length > 0 && (
              <div>
                <span className={lbl}>Дни · {workdays} работни — клик маха ден</span>
                <div className="grid grid-cols-5 gap-1">
                  {days.map(d => {
                    const off = excluded.includes(d)
                    return (
                      <button key={d} type="button" onClick={() => setExcluded(off ? excluded.filter(x => x !== d) : [...excluded, d])}
                        className={`py-1 rounded-lg border text-center text-[11.5px] leading-tight ${off ? 'bg-slate-50 border-slate-200 text-slate-300 line-through' : 'bg-indigo-50 border-indigo-200 text-indigo-800'}`}>
                        <span className="block text-[9.5px] uppercase opacity-70">{WD[parse(d).getDay()]}</span>{dm(d)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div><span className={lbl}>Пояснение към учителите</span>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="напр. В рамките на контролната дейност на директора…" className={inp} />
            </div>
            {!initial && (
              <label className="flex items-center gap-3 cursor-pointer">
                <Toggle on={announce} onClick={() => setAnnounce(v => !v)} color="bg-amber-500" />
                <span className="text-[13px] text-slate-700"><Megaphone size={13} className="inline mr-1 text-amber-500" />Съобщение-листче до участниците</span>
              </label>
            )}
          </div>

          {/* ── вдясно: сутрин, следобед, участници ── */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-slate-800 font-medium">Сутрин</span>
                {ROLE_OPTS.filter(r => r.v !== 'educator').map(r => {
                  const on = amRoles.includes(r.v)
                  return <button key={r.v} type="button" onClick={() => setAmRoles(on ? amRoles.filter(x => x !== r.v) : [...amRoles, r.v])}
                    className={`px-2.5 py-0.5 rounded-full text-[12px] border ${on ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-500 border-slate-200'}`}>{r.l}</button>
                })}
              </div>
              {amOk && (
                <>
                  <SlotChips list={MORNING_PERIODS} value={slots} onChange={setSlots} />
                  <div className="flex items-center gap-2 text-[12.5px] text-slate-600">
                    <span>Посещения на ден:</span><Count value={perDay} onChange={setPerDay} />
                    <span className="text-slate-400">{slots.length ? `избират между ${slots.length} часа` : 'без часове — всеки свой'}</span>
                  </div>
                  {!slots.length && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Toggle on={useSchedule} onClick={() => setUseSchedule(v => !v)} />
                      <span className="text-[12.5px] text-slate-600"><BookOpen size={13} className="inline mr-1 text-slate-400" />часовете от седмичното разписание</span>
                    </label>
                  )}
                </>
              )}
            </div>

            <div className={`rounded-2xl border p-3 space-y-2.5 ${pmOn ? 'border-slate-200' : 'border-dashed border-slate-200'}`}>
              <label className="flex items-center gap-2 cursor-pointer">
                <Toggle on={pmOn} onClick={() => setPmOn(v => !v)} />
                <span className="text-[13px] text-slate-800 font-medium">Следобед</span>
                <span className="text-[12px] text-slate-500">учители ЦОУД</span>
              </label>
              {pmOn && (
                <>
                  <SlotChips list={COUD_PERIODS} value={pmSlots} onChange={setPmSlots} />
                  <div className="flex items-center gap-2 text-[12.5px] text-slate-600">
                    <span>Посещения на ден:</span><Count value={pmPerDay} onChange={setPmPerDay} max={2} />
                  </div>
                </>
              )}
            </div>

            {people.some(x => roles.includes(x.role)) && (
              <div>
                <span className={lbl}>Участници — клик изключва{exStaff.length ? ` · изключени ${exStaff.length}` : ''}</span>
                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-0.5">
                  {people.filter(x => roles.includes(x.role)).map(x => {
                    const off = exStaff.includes(x.id)
                    return (
                      <button key={x.id} type="button" onClick={() => setExStaff(off ? exStaff.filter(i => i !== x.id) : [...exStaff, x.id])}
                        className={`px-2 py-0.5 rounded-lg border text-[12px] ${off ? 'bg-slate-50 border-slate-200 text-slate-400 line-through' : x.role === 'educator' ? 'bg-teal-50/50 border-teal-100 text-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}>
                        {x.first_name} {x.last_name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 shrink-0 bg-white">
          {!ok && <span className="mr-auto text-[12px] text-slate-400">{!from || !to ? 'Изберете период' : !roles.length ? 'Изберете кой участва' : pmOn && !pmSlots.length ? 'Изберете следобеден час' : ''}</span>}
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">Отказ</button>
          <button type="button" onClick={save} disabled={busy || !ok} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm text-white disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {initial ? 'Запази' : 'Отвори за избор'}
          </button>
        </div>
      </div>
    </div>
  )
}
