'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, MapPin, Video, AlignLeft, Users, Repeat, Eye, Bell, Clock, Search, Loader2, Tag } from 'lucide-react'
import { notify } from '@/components/ui/Toast'
import DateInput from '@/components/ui/DateInput'
import {
  type CalEventRow, type CalCategory, type RecurFreq, type Visibility, CATEGORIES, PALETTE, VISIBILITY_LABELS,
  ymd, hhmm, at, parseYmd, isoWd, WD_SHORT, WD_LONG, MONTHS, CATEGORY_BY_KEY,
} from '@/lib/calendar'
import { ROLE_LABELS } from '@/types'
import type { MeInfo, StaffLite } from './CalendarClient'

export interface Draft {
  start: Date; end: Date; allDay: boolean
  event?: CalEventRow        // при редакция / копиране
  occ?: string               // появяването, от което е отворено
  scope?: 'series' | 'one'   // при повтарящо се: цялата поредица или само това появяване
  duplicate?: boolean
}

const ROLE_GROUPS: { label: string; roles: string[] }[] = [
  { label: 'Ръководство', roles: ['director', 'zdud'] },
  { label: 'Учители', roles: ['class_teacher', 'teacher'] },
  { label: 'Възпитатели', roles: ['educator'] },
  { label: 'Терапевти', roles: ['psychologist', 'speech_therapist', 'rehabilitator'] },
  { label: 'Координатори', roles: ['coordinator'] },
]
const ROLE_CHOICES = ['director', 'zdud', 'coordinator', 'class_teacher', 'teacher', 'educator', 'psychologist', 'speech_therapist', 'rehabilitator', 'secretary', 'support']
const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`)

export default function EventEditor({ draft, me, staff, isPublisher, supabase, onClose, onSaved }: {
  draft: Draft; me: MeInfo; staff: StaffLite[]; isPublisher: boolean; supabase: any
  onClose: () => void; onSaved: () => void
}) {
  const ev = draft.event
  const editing = !!ev && !draft.duplicate
  const onlyOne = editing && draft.scope === 'one'
  // при редакция на цялата поредица — от началото на поредицата; иначе — от избраното появяване
  const s0 = editing && !onlyOne ? new Date(ev!.starts_at) : draft.start
  const e0 = editing && !onlyOne ? new Date(ev!.ends_at) : draft.end

  const [title, setTitle] = useState(ev?.title || '')
  const [category, setCategory] = useState<CalCategory>(ev?.category || 'meeting')
  const [color, setColor] = useState<string | null>(ev?.color || null)
  const [allDay, setAllDay] = useState(ev ? ev.all_day : draft.allDay)
  const [startDate, setStartDate] = useState(ymd(s0))
  const [startTime, setStartTime] = useState(hhmm(s0))
  const [endDate, setEndDate] = useState(ymd(e0))
  const [endTime, setEndTime] = useState(hhmm(e0))
  const [freq, setFreq] = useState<RecurFreq>(onlyOne ? 'none' : ev?.recur_freq || 'none')
  const [interval, setInterval_] = useState(ev?.recur_interval || 1)
  const [weekdays, setWeekdays] = useState<number[]>(ev?.recur_weekdays?.length ? ev.recur_weekdays : [isoWd(s0)])
  const [until, setUntil] = useState(ev?.recur_until || '')
  const [location, setLocation] = useState(ev?.location || '')
  const [onlineUrl, setOnlineUrl] = useState(ev?.online_url || '')
  const [description, setDescription] = useState(ev?.description || '')
  const [visibility, setVisibility] = useState<Visibility>(ev?.visibility || 'private')
  const [roles, setRoles] = useState<string[]>(ev?.roles || [])
  const [remind, setRemind] = useState<number | null>(ev ? ev.remind_days : 1)
  const [people, setPeople] = useState<string[]>((ev?.attendees || []).map(a => a.staff_id).filter(id => id !== me.id))
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => { titleRef.current?.focus() }, [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose() }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }, [onClose])

  // при смяна на началото — краят се мести със същата продължителност
  function changeStart(date: string, time: string) {
    if (!date) return
    const oldS = at(startDate, startTime), oldE = at(endDate, endTime)
    const dur = Math.max(0, oldE.getTime() - oldS.getTime())
    const ns = at(date, time)
    const ne = new Date(ns.getTime() + dur)
    setStartDate(date); setStartTime(time); setEndDate(ymd(ne)); setEndTime(hhmm(ne))
  }

  const sd = parseYmd(startDate || ymd(new Date()))
  const freqOptions: { v: string; l: string }[] = [
    { v: 'none', l: 'Не се повтаря' },
    { v: 'daily', l: 'Всеки ден' },
    { v: 'weekdays', l: 'Всеки делничен ден (Пн–Пт)' },
    { v: 'weekly', l: `Всяка седмица в ${WD_LONG[isoWd(sd) - 1]}` },
    { v: 'monthly', l: `Всеки месец на ${sd.getDate()}-о число` },
    { v: 'yearly', l: `Всяка година на ${sd.getDate()} ${MONTHS[sd.getMonth()]}` },
  ]
  const freqValue = freq === 'weekly' && weekdays.length === 5 && [1, 2, 3, 4, 5].every(d => weekdays.includes(d)) ? 'weekdays' : freq
  function pickFreq(v: string) {
    if (v === 'weekdays') { setFreq('weekly'); setWeekdays([1, 2, 3, 4, 5]); return }
    setFreq(v as RecurFreq)
    if (v === 'weekly') setWeekdays([isoWd(sd)])
  }

  const chosen = new Set(people)
  const byId = useMemo(() => new Map(staff.map(s => [s.id, s])), [staff])
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return staff.filter(s => s.id !== me.id && !chosen.has(s.id) && `${s.first_name} ${s.last_name} ${s.position || ''}`.toLowerCase().includes(t)).slice(0, 8)
  }, [q, staff, people]) // eslint-disable-line react-hooks/exhaustive-deps
  const addGroup = (rs: string[]) => setPeople(p => Array.from(new Set([...p, ...staff.filter(s => rs.includes(s.role) && s.id !== me.id).map(s => s.id)])))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { notify('Въведи заглавие'); titleRef.current?.focus(); return }
    if (!startDate || !endDate) { notify('Избери дати'); return }
    const starts = allDay ? at(startDate) : at(startDate, startTime)
    const ends = allDay ? at(endDate) : at(endDate, endTime)
    if (ends < starts || (!allDay && ends.getTime() === starts.getTime())) { notify('Краят трябва да е след началото'); return }
    if (freq === 'weekly' && !weekdays.length) { notify('Избери поне един ден от седмицата'); return }
    if (until && until < startDate) { notify('Повтарянето не може да свършва преди началото'); return }
    if (onlineUrl && !/^https?:\/\//i.test(onlineUrl.trim())) { notify('Линкът за онлайн среща трябва да започва с https://'); return }
    const vis: Visibility = isPublisher ? visibility : 'private'
    if (vis === 'roles' && !roles.length) { notify('Избери поне една длъжност'); return }

    const row = {
      title: title.trim(), description: description.trim() || null, location: location.trim() || null, online_url: onlineUrl.trim() || null,
      category, color, all_day: allDay, starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      recur_freq: onlyOne ? 'none' : freq, recur_interval: interval, recur_weekdays: freq === 'weekly' && !onlyOne ? [...weekdays].sort() : null,
      recur_until: freq !== 'none' && !onlyOne ? (until || null) : null,
      visibility: vis, roles: vis === 'roles' ? roles : [], remind_days: remind, updated_at: new Date().toISOString(),
    }
    setSaving(true)
    try {
      let id = ev?.id
      if (!editing || onlyOne) {
        const { data, error } = await supabase.from('cal_events').insert(row).select('id').single()
        if (error) throw error
        id = data.id
        if (onlyOne && ev && draft.occ) {
          const { error: e2 } = await supabase.from('cal_events').update({ exdates: [...(ev.exdates || []), draft.occ] }).eq('id', ev.id)
          if (e2) throw e2
        }
        if (people.length) {
          const { error: e3 } = await supabase.from('cal_event_attendees').insert(people.map(staff_id => ({ event_id: id, staff_id })))
          if (e3) throw e3
        }
      } else {
        const { error } = await supabase.from('cal_events').update(row).eq('id', ev!.id)
        if (error) throw error
        const before = new Set((ev!.attendees || []).map(a => a.staff_id).filter(x => x !== me.id))
        const add = people.filter(p => !before.has(p))
        const remove = Array.from(before).filter(p => !chosen.has(p))
        if (add.length) { const { error: e3 } = await supabase.from('cal_event_attendees').insert(add.map(staff_id => ({ event_id: ev!.id, staff_id }))); if (e3) throw e3 }
        if (remove.length) { const { error: e4 } = await supabase.from('cal_event_attendees').delete().eq('event_id', ev!.id).in('staff_id', remove); if (e4) throw e4 }
      }
      notify(editing ? 'Събитието е запазено' : people.length ? `Събитието е създадено, поканени: ${people.length}` : 'Събитието е създадено', 'success')
      onSaved()
    } catch (err: any) {
      notify(err?.message || 'Грешка при запис')
    } finally {
      setSaving(false)
    }
  }

  const accent = color || CATEGORY_BY_KEY[category].color

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Събитие">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <form onSubmit={save} className="relative w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="h-1.5 shrink-0" style={{ backgroundColor: accent }} />
        <div className="flex items-center justify-between px-5 pt-3">
          <span className="text-xs font-medium text-slate-500">
            {editing ? (onlyOne ? 'Редакция само на това появяване' : 'Редакция на събитие') : draft.duplicate ? 'Копие на събитие' : 'Ново събитие'}
          </span>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Затвори"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto px-5 pb-4 space-y-4">
          <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)} placeholder="Добави заглавие"
            className="w-full text-[22px] font-medium text-slate-900 placeholder:text-slate-300 border-0 border-b-2 border-slate-100 focus:border-blue-500 focus:outline-none pb-1.5 pt-1" />

          {/* категория */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.filter(c => c.key !== 'holiday' || isPublisher).map(c => (
              <button key={c.key} type="button" onClick={() => setCategory(c.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors ${category === c.key ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                style={category === c.key ? { backgroundColor: c.color } : undefined}>
                {category !== c.key && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />}{c.label}
              </button>
            ))}
          </div>

          {/* дата и час */}
          <Field icon={<Clock size={16} />}>
            <div className="flex flex-wrap items-center gap-2">
              <DateInput value={startDate} onChange={v => v && changeStart(v, startTime)} className="w-40" />
              {!allDay && <TimeSelect value={startTime} onChange={v => changeStart(startDate, v)} />}
              <span className="text-slate-400">–</span>
              {!allDay && <TimeSelect value={endTime} onChange={setEndTime} after={endDate === startDate ? startTime : undefined} />}
              <DateInput value={endDate} onChange={v => v && setEndDate(v)} min={startDate} className="w-40" />
            </div>
            <label className="inline-flex items-center gap-2 mt-2 text-sm text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="rounded border-slate-300" /> Цял ден
            </label>
          </Field>

          {/* повтаряне */}
          {!onlyOne && (
            <Field icon={<Repeat size={16} />}>
              <select value={freqValue} onChange={e => pickFreq(e.target.value)} className="text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white focus:outline-none focus:border-slate-400">
                {freqOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              {freq !== 'none' && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                  <label className="inline-flex items-center gap-1.5">на всеки
                    <input type="number" min={1} max={52} value={interval} onChange={e => setInterval_(Math.max(1, Math.min(52, +e.target.value || 1)))} className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                    {freq === 'daily' ? 'дни' : freq === 'weekly' ? 'седмици' : freq === 'monthly' ? 'месеца' : 'години'}
                  </label>
                  {freq === 'weekly' && (
                    <div className="flex gap-1">
                      {WD_SHORT.map((w, i) => {
                        const on = weekdays.includes(i + 1)
                        return <button key={w} type="button" onClick={() => setWeekdays(d => on ? d.filter(x => x !== i + 1) : [...d, i + 1])}
                          className={`w-8 h-8 rounded-full text-[12px] font-medium ${on ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{w}</button>
                      })}
                    </div>
                  )}
                  <label className="inline-flex items-center gap-1.5">до <DateInput value={until} onChange={setUntil} min={startDate} className="w-40" /></label>
                </div>
              )}
            </Field>
          )}

          {/* поканени */}
          <Field icon={<Users size={16} />}>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Покани колеги — пиши име"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (matches[0]) { setPeople(p => [...p, matches[0].id]); setQ('') } } }}
                className="w-full text-sm rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 focus:outline-none focus:border-slate-400" />
              {matches.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 max-h-60 overflow-y-auto">
                  {matches.map(s => (
                    <button key={s.id} type="button" onClick={() => { setPeople(p => [...p, s.id]); setQ('') }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-sm">
                      <span className="text-slate-800">{s.first_name} {s.last_name}</span>
                      <span className="text-slate-400 text-xs"> · {s.position || (ROLE_LABELS as any)[s.role] || s.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {ROLE_GROUPS.map(g => (
                <button key={g.label} type="button" onClick={() => addGroup(g.roles)} className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700">+ {g.label}</button>
              ))}
              {people.length > 0 && <button type="button" onClick={() => setPeople([])} className="text-[11px] px-2 py-0.5 text-rose-600 hover:underline">изчисти</button>}
            </div>
            {people.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {people.map(id => {
                  const s = byId.get(id)
                  return (
                    <span key={id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[12px]">
                      {s ? `${s.first_name} ${s.last_name}` : 'Служител'}
                      <button type="button" onClick={() => setPeople(p => p.filter(x => x !== id))} className="p-0.5 rounded-full hover:bg-blue-100"><X size={11} /></button>
                    </span>
                  )
                })}
              </div>
            )}
          </Field>

          <Field icon={<MapPin size={16} />}>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Място (напр. Учителска стая, кабинет 12)"
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none focus:border-slate-400" />
          </Field>
          <Field icon={<Video size={16} />}>
            <input value={onlineUrl} onChange={e => setOnlineUrl(e.target.value)} placeholder="Линк за онлайн среща (Meet / Teams / Zoom) — по избор"
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none focus:border-slate-400" />
          </Field>
          <Field icon={<AlignLeft size={16} />}>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Описание, дневен ред, какво да носят участниците…"
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:border-slate-400 resize-y" />
          </Field>

          {/* видимост */}
          <Field icon={<Eye size={16} />}>
            {isPublisher ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map(v => (
                    <button key={v} type="button" onClick={() => setVisibility(v)}
                      className={`px-2.5 py-1 rounded-lg text-[12.5px] border ${visibility === v ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{VISIBILITY_LABELS[v]}</button>
                  ))}
                </div>
                {visibility === 'roles' && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {ROLE_CHOICES.map(r => {
                      const on = roles.includes(r)
                      return <button key={r} type="button" onClick={() => setRoles(x => on ? x.filter(y => y !== r) : [...x, r])}
                        className={`px-2 py-0.5 rounded-full text-[11.5px] border ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>{(ROLE_LABELS as any)[r] || r}</button>
                    })}
                  </div>
                )}
                <p className="text-[11.5px] text-slate-400 mt-1.5">
                  {visibility === 'private' ? 'Вижда се само от теб и поканените.' : visibility === 'staff' ? 'Появява се в календара на целия персонал (като „Общо събитие“).' : visibility === 'managers' ? 'Вижда се от директора и заместник-директорите.' : 'Вижда се от служителите на избраните длъжности.'}
                </p>
              </>
            ) : <p className="text-sm text-slate-500 pt-1">Вижда се само от теб и поканените колеги.</p>}
          </Field>

          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Field icon={<Bell size={16} />}>
              <select value={remind ?? ''} onChange={e => setRemind(e.target.value === '' ? null : +e.target.value)} className="text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white">
                <option value="">Без напомняне</option>
                <option value={0}>Напомни в деня</option>
                <option value={1}>Напомни 1 ден преди</option>
                <option value={2}>Напомни 2 дни преди</option>
                <option value={3}>Напомни 3 дни преди</option>
                <option value={7}>Напомни седмица преди</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Показва се на таблото „Начало“</p>
            </Field>
            <Field icon={<Tag size={16} />}>
              <div className="flex flex-wrap gap-1.5 items-center">
                <button type="button" onClick={() => setColor(null)} title="Цветът на категорията"
                  className={`h-6 px-2 rounded-full text-[11px] border ${color === null ? 'border-slate-700 text-slate-700' : 'border-slate-200 text-slate-400'}`}>авто</button>
                {PALETTE.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)} aria-label={c}
                    className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </Field>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/60">
          <span className="mr-auto text-[12px] text-slate-400 hidden sm:block">
            {allDay ? '' : (() => { const m = (at(endDate, endTime).getTime() - at(startDate, startTime).getTime()) / 60000; return m > 0 ? `Продължителност: ${m >= 60 ? `${Math.floor(m / 60)} ч.` : ''}${m % 60 ? ` ${m % 60} мин.` : ''}` : '' })()}
          </span>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Отказ</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white bg-[#0f2240] hover:bg-[#1a3560] disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />} {editing ? 'Запази' : people.length ? 'Запази и покани' : 'Запази'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex gap-3"><span className="w-5 shrink-0 flex justify-center pt-2 text-slate-400">{icon}</span><div className="flex-1 min-w-0">{children}</div></div>
}

function TimeSelect({ value, onChange, after }: { value: string; onChange: (v: string) => void; after?: string }) {
  const opts = TIMES.includes(value) ? TIMES : [...TIMES, value].sort()
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="text-sm rounded-lg border border-slate-200 px-2 py-1.5 bg-white tabular-nums focus:outline-none focus:border-slate-400">
      {opts.map(t => {
        let label = t
        if (after) {
          const m = (+t.slice(0, 2) * 60 + +t.slice(3)) - (+after.slice(0, 2) * 60 + +after.slice(3))
          if (m > 0) label = `${t} (${m < 60 ? `${m} мин` : `${+(m / 60).toFixed(2)} ч`})`
        }
        return <option key={t} value={t}>{label}</option>
      })}
    </select>
  )
}

