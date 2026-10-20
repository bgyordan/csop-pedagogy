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
import { useToast } from '@/components/ui/Toast'
import { PERIOD_LABEL, PERIOD_TIMES, MORNING_PERIODS, AFTERNOON_PERIODS, byStartTime } from '@/lib/periods'

type Campaign = {
  id: string; title: string; focus_subject: string | null; note: string | null; date_from: string; date_to: string
  excluded_dates: string[]; per_day: number; use_schedule: boolean; roles: string[]; is_open: boolean
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
            {' · '}{c.per_day} на ден{!c.is_open && <span className="ml-2 text-[12px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">затворено за избор</span>}
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

      {form && <CampaignForm initial={form === 'new' ? null : form} meId={p.me.id} onClose={() => setForm(null)}
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

  // заетост без имената на другите (своят запис не се брои — може да го смени)
  const others = slots.filter(s => !s.mine)
  const takenOn = (d: string) => others.filter(s => s.date === d)
  const free = (d: string) => c.per_day - takenOn(d).length
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
    setDay(d); setPeriod(null); setCls(''); setSubject(c.focus_subject || '')
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
    if (!mine || !confirm('Да се откаже ли избраният ден?')) return
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

          {day && (
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
  const missing = people.filter(x => !booked.has(x.id))
  const byDay = (d: string) => bookings.filter(b => b.date === d).sort((a, b) => byStartTime(a.period, b.period))
  const name = (b: Booking) => b.staff ? `${b.staff.first_name} ${b.staff.last_name}` : '—'
  const usable = days.filter(d => !d.excluded && !d.nonSchool)

  async function toggleOpen() {
    const { error } = await supabase.from('visit_campaigns').update({ is_open: !c.is_open }).eq('id', c.id)
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  async function removeBooking(b: Booking) {
    if (!confirm(`Да се махне ли посещението на ${name(b)}? Ще може да избере отново.`)) return
    const { error } = await supabase.from('visit_bookings').delete().eq('id', b.id)
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  async function removeCampaign() {
    if (!confirm(`Да се изтрие ли „${c.title}“ заедно с всички избрани дни?`)) return
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
          <span className="text-sm text-slate-600"><span className="text-xl font-semibold text-slate-800">{bookings.length}</span> / {people.length} избрали</span>
          <span className="w-px h-6 bg-slate-200" />
          <span className="text-sm text-slate-600">{usable.length} дни × {c.per_day} = {usable.length * c.per_day} места</span>
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
            <div key={d.date} className={`rounded-2xl border p-3 min-h-[120px] ${off ? 'bg-slate-50 border-slate-100' : isToday ? 'bg-white border-indigo-300 shadow-sm ring-1 ring-indigo-100' : 'bg-white border-slate-200 shadow-[0_1px_2px_rgba(15,34,64,0.04)]'}`}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className={`text-lg font-semibold ${off ? 'text-slate-300' : 'text-slate-800'}`}>{parse(d.date).getDate()}</span>
                <span className={`text-[12px] ${off ? 'text-slate-300' : 'text-slate-500'}`}>{MONTHS[parse(d.date).getMonth()]} · {WD[parse(d.date).getDay()]}</span>
                {!off && <span className={`ml-auto text-[11px] px-1.5 py-0.5 rounded-full ${list.length >= c.per_day ? 'bg-emerald-50 text-emerald-700' : list.length ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{list.length}/{c.per_day}</span>}
              </div>
              {off ? <div className="text-[12px] text-slate-400">{d.excluded ? 'без посещения' : 'неучебен ден'}</div> : (
                <div className="space-y-1.5">
                  {list.map(b => (
                    <div key={b.id} className="group relative rounded-xl bg-indigo-50/50 border border-indigo-100 px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5 text-[11.5px] text-indigo-700"><Clock size={11} /> {periodText(b.period)}</div>
                      <div className="text-[13px] text-slate-800 leading-snug">{name(b)}</div>
                      <div className="text-[11.5px] text-slate-500 leading-snug">{[b.class_name, b.subject].filter(Boolean).join(' · ')}</div>
                      {b.topic && <div className="text-[11.5px] text-slate-500 leading-snug line-clamp-2" title={b.topic}>„{b.topic}“</div>}
                      <button type="button" onClick={() => removeBooking(b)} className="absolute top-1 right-1 p-1 rounded-md text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100"><X size={12} /></button>
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
            {missing.map(x => <span key={x.id} className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[12.5px] text-amber-900">{x.first_name} {x.last_name}</span>)}
          </div>
        ) : <p className="text-sm text-emerald-700">Всички са избрали.</p>}
      </section>
    </div>
  )
}

// ═══════════════ НАСТРОЙКИ НА ПРОВЕРКАТА ═══════════════
function CampaignForm({ initial, meId, onClose, onSaved }: { initial: Campaign | null; meId: string; onClose: () => void; onSaved: (id: string) => void }) {
  const supabase = createClient()
  const { toast } = useToast()
  const [title, setTitle] = useState(initial?.title || 'Посещение на час')
  const [focus, setFocus] = useState(initial?.focus_subject ?? 'Математика')
  const [note, setNote] = useState(initial?.note || '')
  const [from, setFrom] = useState(initial?.date_from || '')
  const [to, setTo] = useState(initial?.date_to || '')
  const [excluded, setExcluded] = useState<string[]>(initial?.excluded_dates || [])
  const [perDay, setPerDay] = useState(initial?.per_day || 2)
  const [useSchedule, setUseSchedule] = useState(initial?.use_schedule ?? true)
  const [roles, setRoles] = useState<string[]>(initial?.roles || ['class_teacher', 'teacher'])
  const [announce, setAnnounce] = useState(!initial)
  const [busy, setBusy] = useState(false)
  const days = from && to && to >= from ? weekdays(from, to) : []
  const workdays = days.filter(d => !excluded.includes(d)).length
  const ok = title.trim() && from && to && to >= from && roles.length && workdays > 0

  async function save() {
    if (!ok) return
    setBusy(true)
    const row = {
      title: title.trim(), focus_subject: focus.trim() || null, note: note.trim() || null, date_from: from, date_to: to,
      excluded_dates: excluded.filter(d => d >= from && d <= to), per_day: perDay, use_schedule: useSchedule, roles,
    }
    const res = initial
      ? await supabase.from('visit_campaigns').update(row).eq('id', initial.id).select('id').single()
      : await supabase.from('visit_campaigns').insert({ ...row, created_by: meId }).select('id').single()
    if (res.error || !res.data) { setBusy(false); toast(res.error?.message.includes('visit_') ? 'Пуснете SQL файла 2026-10-20_class_visits.sql' : res.error?.message || 'Грешка', 'error'); return }
    if (announce) {
      const skip = excluded.filter(d => d >= from && d <= to).map(dm).join(', ')
      const body = [
        `Изберете ден и час, в който да бъдете посетени${focus.trim() ? ` — основна тема: ${focus.trim()}` : ''}.`,
        `- Период: ${dm(from)} – ${dm(to)}${skip ? ` (без ${skip})` : ''}`,
        `- По ${perDay} посещения на ден — кой първи избере`,
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
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-2xl mx-auto my-0 md:my-8 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <h2 className="flex-1 text-base text-[#0f2240]">{initial ? 'Настройки на проверката' : 'Нова проверка — посещение на час'}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-5">
          <div className="grid sm:grid-cols-[1fr_200px] gap-3">
            <div><span className={lbl}>Заглавие</span><input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
            <div><span className={lbl}>Основна тема / предмет</span><input value={focus} onChange={e => setFocus(e.target.value)} placeholder="напр. Математика" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><span className={lbl}>От</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
            <div><span className={lbl}>До</span><input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
            <div><span className={lbl}>На ден</span>
              <div className="inline-flex p-1 rounded-xl bg-slate-100">{[1, 2, 3, 4].map(n => (
                <button key={n} type="button" onClick={() => setPerDay(n)} className={`w-9 py-1 rounded-lg text-sm ${perDay === n ? 'bg-white shadow-sm text-[#0f2240]' : 'text-slate-500'}`}>{n}</button>
              ))}</div>
            </div>
          </div>
          {days.length > 0 && (
            <div>
              <span className={lbl}>Дни — цъкнете, за да махнете ден (отпуск и др.) · {workdays} работни дни</span>
              <div className="flex flex-wrap gap-1.5">
                {days.map(d => {
                  const off = excluded.includes(d)
                  return (
                    <button key={d} type="button" onClick={() => setExcluded(off ? excluded.filter(x => x !== d) : [...excluded, d])}
                      className={`w-14 py-1.5 rounded-xl border text-center text-[12px] leading-tight ${off ? 'bg-slate-50 border-slate-200 text-slate-300 line-through' : 'bg-indigo-50 border-indigo-200 text-indigo-800'}`}>
                      <span className="block text-[10px] uppercase">{WD[parse(d).getDay()]}</span>{dm(d)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div>
            <span className={lbl}>Кой избира</span>
            <div className="flex flex-wrap gap-1.5">
              {ROLE_OPTS.map(r => {
                const on = roles.includes(r.v)
                return <button key={r.v} type="button" onClick={() => setRoles(on ? roles.filter(x => x !== r.v) : [...roles, r.v])}
                  className={`px-3 py-1.5 rounded-full text-[13px] border ${on ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200'}`}>{r.l}</button>
              })}
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setUseSchedule(v => !v)} className={`relative w-10 h-6 rounded-full transition-colors ${useSchedule ? 'bg-indigo-600' : 'bg-slate-300'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${useSchedule ? 'left-5' : 'left-1'}`} />
            </button>
            <span className="text-sm text-slate-700"><BookOpen size={14} className="inline mr-1 text-slate-400" />Предлагай часовете от седмичното разписание <span className="text-slate-400">(винаги може и „друг час“)</span></span>
          </label>
          <div><span className={lbl}>Пояснение към учителите</span>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="напр. Посещението е в рамките на контролната дейност на директора…" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
          </div>
          {!initial && (
            <label className="flex items-center gap-3 cursor-pointer">
              <button type="button" onClick={() => setAnnounce(v => !v)} className={`relative w-10 h-6 rounded-full transition-colors ${announce ? 'bg-amber-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${announce ? 'left-5' : 'left-1'}`} />
              </button>
              <span className="text-sm text-slate-700"><Megaphone size={14} className="inline mr-1 text-amber-500" />Изпрати съобщение-листче до участниците (изскача веднъж, важи до края)</span>
            </label>
          )}
        </div>
        <div className="sticky bottom-0 bg-white flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">Отказ</button>
          <button type="button" onClick={save} disabled={busy || !ok} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm text-white disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {initial ? 'Запази' : 'Отвори за избор'}
          </button>
        </div>
      </div>
    </div>
  )
}

