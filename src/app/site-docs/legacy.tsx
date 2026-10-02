'use client'

// Раздели от „Сайт“, които още не са преработени: събития и кариери.
import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, Trash2, Plus, X, Check, Search, Pencil, ChevronDown, ArrowLeft, CalendarDays, Images, ImagePlus, Star, MapPin, Clock, Briefcase, Mail, Copy } from 'lucide-react'
import { ACCENT, fmtDate, MONTHS_SHORT, SITE_PAGES, Field, INPUT, Toast, Drawer } from './shared'
import type { Ev, Album, Photo, Job, Subscriber } from './shared'

/* ═══════════════ СЪБИТИЯ ═══════════════ */
export function EventsManager({ initial }: { initial: Ev[] }) {
  const supabase = createClient(); const router = useRouter()
  const [list, setList] = useState<Ev[]>(initial)
  const [q, setQ] = useState(''); const [when, setWhen] = useState<'all' | 'upcoming' | 'past'>('all')
  const [drawer, setDrawer] = useState(false); const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [title, setTitle] = useState(''); const [date, setDate] = useState(''); const [time, setTime] = useState('')
  const [location, setLocation] = useState(''); const [description, setDescription] = useState('')
  const [notice, setNotice] = useState<{ msg: string; err?: boolean } | null>(null)
  const flash = (msg: string, err = false) => { setNotice({ msg, err }); setTimeout(() => setNotice((p) => (p?.msg === msg ? null : p)), 3500) }
  const today = new Date().toISOString().split('T')[0]

  const shown = useMemo(() => list
    .filter((e) => (when === 'all' ? true : when === 'upcoming' ? e.event_date >= today : e.event_date < today))
    .filter((e) => (q.trim() ? e.title.toLowerCase().includes(q.trim().toLowerCase()) : true))
    .sort((a, b) => b.event_date.localeCompare(a.event_date)), [list, when, q, today])

  function openNew() { setEditId(null); setTitle(''); setDate(''); setTime(''); setLocation(''); setDescription(''); setDrawer(true) }
  function openEdit(e: Ev) { setEditId(e.id); setTitle(e.title); setDate(e.event_date); setTime(e.event_time || ''); setLocation(e.location || ''); setDescription(e.description || ''); setDrawer(true) }
  async function save() {
    if (!title.trim() || !date) { flash('Попълнете заглавие и дата.', true); return }
    try {
      setBusy(true)
      const payload = { title: title.trim(), event_date: date, event_time: time.trim() || null, location: location.trim() || null, description: description.trim() || null }
      if (editId) { const { data, error } = await supabase.from('site_events').update(payload).eq('id', editId).select('*').single(); if (error) throw error; setList((p) => p.map((x) => x.id === editId ? (data as Ev) : x)) }
      else { const { data, error } = await supabase.from('site_events').insert(payload).select('*').single(); if (error) throw error; setList((p) => [data as Ev, ...p]) }
      setDrawer(false); flash('Записано.'); router.refresh()
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Грешка.', true) } finally { setBusy(false) }
  }
  async function remove(e: Ev) { if (!confirm(`Изтриване на „${e.title}“?`)) return; await supabase.from('site_events').delete().eq('id', e.id); setList((p) => p.filter((x) => x.id !== e.id)); flash('Изтрито.'); router.refresh() }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div><h2 className="text-[18px] font-semibold tracking-tight" style={{ color: ACCENT }}>Събития</h2>
          <div className="text-slate-500 text-[12.5px] mt-0.5">Предстоящи и минали · показват се в календара на сайта</div></div>
        <div className="flex gap-2.5 items-center flex-wrap">
          <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търси събитие…" className="border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[13px] bg-white w-[180px] focus:outline-none focus:border-slate-400" /></div>
          <div className="inline-flex bg-white border border-slate-200 rounded-xl p-0.5">
            {([['all', 'Всички'], ['upcoming', 'Предстоящи'], ['past', 'Минали']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setWhen(k)} className={`text-[12.5px] px-3 py-1.5 rounded-lg ${when === k ? 'text-white font-medium' : 'text-slate-500'}`} style={when === k ? { backgroundColor: ACCENT } : {}}>{lbl}</button>
            ))}
          </div>
          <button onClick={openNew} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90" style={{ backgroundColor: ACCENT }}><Plus size={15} /> Ново събитие</button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-14 text-center">
          <CalendarDays size={30} className="text-slate-200 mx-auto mb-2.5" />
          <div className="text-slate-700 font-semibold text-[15px] mb-1">Няма събития</div>
          <p className="text-sm text-slate-500 mb-4">{q.trim() ? 'Няма съвпадение.' : 'Добави първото събитие.'}</p>
          {!q.trim() && <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Ново събитие</button>}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {shown.map((e) => {
            const d = new Date(e.event_date + 'T00:00'); const past = e.event_date < today
            return (
              <div key={e.id} className="group flex gap-4 items-center px-5 py-4 border-b border-slate-50 last:border-0 hover:bg-blue-50/40">
                <div className="w-14 text-center shrink-0">
                  <div className={`text-[22px] font-bold leading-none ${past ? 'text-slate-300' : ''}`} style={past ? {} : { color: ACCENT }}>{d.getDate()}</div>
                  <div className="text-[11px] text-slate-500">{MONTHS_SHORT[d.getMonth()]}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <b className="text-[14.5px] font-medium text-slate-800">{e.title}</b>
                  <div className="text-[12px] text-slate-500 mt-0.5 flex gap-3 flex-wrap">
                    {e.event_time && <span className="inline-flex items-center gap-1"><Clock size={12} /> {e.event_time}</span>}
                    {e.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {e.location}</span>}
                  </div>
                </div>
                <span className={`text-[10.5px] px-2.5 py-1 rounded-full font-semibold shrink-0 ${past ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600'}`}>{past ? 'минало' : 'предстои'}</span>
                <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(e)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-[#0f2240]" title="Редактирай"><Pencil size={14} /></button>
                  <button onClick={() => remove(e)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Изтрий"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Toast notice={notice} />
      <Drawer open={drawer} onClose={() => setDrawer(false)} title={editId ? 'Редактирай събитие' : 'Ново събитие'}
        footer={<>
          <button onClick={() => setDrawer(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Отказ</button>
          <button onClick={save} disabled={busy} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: ACCENT }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запази</button>
        </>}>
        <Field label="Заглавие"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. Родителска среща" className={INPUT} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} /></Field>
          <Field label="Час (по избор)"><input value={time} onChange={(e) => setTime(e.target.value)} placeholder="18:00" className={INPUT} /></Field>
        </div>
        <Field label="Място (по избор)"><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Актова зала" className={INPUT} /></Field>
        <Field label="Описание (по избор)"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={INPUT + ' resize-y'} /></Field>
      </Drawer>
    </div>
  )
}

/* ═══════════════ КАРИЕРИ ═══════════════ */
export function JobsManager({ initial, authorId, subscribers = [] }: { initial: Job[]; authorId: string | null; subscribers?: Subscriber[] }) {
  const supabase = createClient(); const router = useRouter()
  const [list, setList] = useState<Job[]>(initial)
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all')
  const [drawer, setDrawer] = useState(false); const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [title, setTitle] = useState(''); const [employment, setEmployment] = useState('Пълен работен ден')
  const [description, setDescription] = useState(''); const [requirements, setRequirements] = useState('')
  const [notice, setNotice] = useState<{ msg: string; err?: boolean } | null>(null)
  const flash = (msg: string, err = false) => { setNotice({ msg, err }); setTimeout(() => setNotice((p) => (p?.msg === msg ? null : p)), 3500) }
  const [subs, setSubs] = useState<Subscriber[]>(subscribers)
  const [showSubs, setShowSubs] = useState(false)
  async function removeSub(id: string) { await supabase.from('job_subscribers').delete().eq('id', id); setSubs((p) => p.filter((x) => x.id !== id)); router.refresh() }
  function copyEmails() { try { navigator.clipboard.writeText(subs.map((x) => x.email).join(', ')); flash('Имейлите са копирани.') } catch { flash('Копирането не сработи.', true) } }

  const shown = useMemo(() => list
    .filter((j) => (filter === 'all' ? true : j.status === filter))
    .sort((a, b) => (a.status === b.status ? (a.sort_order || 0) - (b.sort_order || 0) : a.status === 'active' ? -1 : 1)), [list, filter])
  const activeCount = list.filter((j) => j.status === 'active').length

  function openNew() { setEditId(null); setTitle(''); setEmployment('Пълен работен ден'); setDescription(''); setRequirements(''); setDrawer(true) }
  function openEdit(j: Job) { setEditId(j.id); setTitle(j.title); setEmployment(j.employment || ''); setDescription(j.description || ''); setRequirements(j.requirements || ''); setDrawer(true) }

  async function save() {
    if (!title.trim()) { flash('Въведете длъжност.', true); return }
    try {
      setBusy(true)
      const payload = { title: title.trim(), employment: employment.trim() || null, description: description.trim() || null, requirements: requirements.trim() || null }
      if (editId) { const { data, error } = await supabase.from('site_jobs').update(payload).eq('id', editId).select('*').single(); if (error) throw error; setList((p) => p.map((x) => x.id === editId ? (data as Job) : x)) }
      else { const sort = list.reduce((m, j) => Math.max(m, j.sort_order || 0), 0) + 1; const { data, error } = await supabase.from('site_jobs').insert({ ...payload, status: 'active', sort_order: sort, created_by: authorId }).select('*').single(); if (error) throw error; setList((p) => [...p, data as Job]) }
      setDrawer(false); flash('Записано.'); router.refresh()
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Грешка.', true) } finally { setBusy(false) }
  }
  async function toggleStatus(j: Job) { const next = j.status === 'active' ? 'closed' : 'active'; setList((p) => p.map((x) => x.id === j.id ? { ...x, status: next } : x)); await supabase.from('site_jobs').update({ status: next }).eq('id', j.id); router.refresh() }
  async function remove(j: Job) { if (!confirm(`Изтриване на „${j.title}“?`)) return; await supabase.from('site_jobs').delete().eq('id', j.id); setList((p) => p.filter((x) => x.id !== j.id)); flash('Изтрито.'); router.refresh() }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div><h2 className="text-[18px] font-semibold tracking-tight" style={{ color: ACCENT }}>Кариери</h2>
          <div className="text-slate-500 text-[12.5px] mt-0.5">{activeCount} активни обяви · показват се на сайта</div></div>
        <div className="flex gap-2.5 items-center flex-wrap">
          <div className="inline-flex bg-white border border-slate-200 rounded-xl p-0.5">
            {([['all', 'Всички'], ['active', 'Активни'], ['closed', 'Затворени']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setFilter(k)} className={`text-[12.5px] px-3 py-1.5 rounded-lg ${filter === k ? 'text-white font-medium' : 'text-slate-500'}`} style={filter === k ? { backgroundColor: ACCENT } : {}}>{lbl}</button>
            ))}
          </div>
          <button onClick={openNew} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90" style={{ backgroundColor: ACCENT }}><Plus size={15} /> Нова обява</button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-14 text-center">
          <Briefcase size={30} className="text-slate-200 mx-auto mb-2.5" />
          <div className="text-slate-700 font-semibold text-[15px] mb-1">Няма обяви</div>
          <p className="text-sm text-slate-500 mb-4">Публикувай първата обява за работа.</p>
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Нова обява</button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {shown.map((j) => {
            const closed = j.status !== 'active'
            return (
              <div key={j.id} className={`group flex gap-4 items-start px-5 py-4 border-b border-slate-50 last:border-0 hover:bg-blue-50/40 ${closed ? 'opacity-70' : ''}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: closed ? '#f1f5f9' : ACCENT + '12', color: closed ? '#94a3b8' : ACCENT }}><Briefcase size={17} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b className="text-[14.5px] font-medium text-slate-800">{j.title}</b>
                    <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-semibold ${closed ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600'}`}>{closed ? 'затворена' : 'активна'}</span>
                  </div>
                  <div className="text-[12px] text-slate-500 mt-0.5 flex gap-3 flex-wrap">
                    {j.employment && <span className="inline-flex items-center gap-1"><Clock size={12} /> {j.employment}</span>}
                    {j.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {j.location}</span>}
                  </div>
                  {j.description && <p className="text-[12.5px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{j.description}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => toggleStatus(j)} className="text-[11.5px] font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title={closed ? 'Активирай' : 'Затвори'}>{closed ? 'Активирай' : 'Затвори'}</button>
                  <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(j)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-[#0f2240]" title="Редактирай"><Pencil size={14} /></button>
                    <button onClick={() => remove(j)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Изтрий"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Toast notice={notice} />
      <Drawer open={drawer} onClose={() => setDrawer(false)} title={editId ? 'Редактирай обява' : 'Нова обява'}
        footer={<>
          <button onClick={() => setDrawer(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Отказ</button>
          <button onClick={save} disabled={busy} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: ACCENT }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запази</button>
        </>}>
        <Field label="Длъжност"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. Логопед" className={INPUT} /></Field>
        <Field label="Тип заетост"><input value={employment} onChange={(e) => setEmployment(e.target.value)} placeholder="Пълен работен ден" className={INPUT} /></Field>
        <Field label="Описание (по избор)"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Кратко описание на позицията…" className={INPUT + ' resize-y'} /></Field>
        <Field label="Изисквания (по избор)"><textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={4} placeholder="Едно изискване на ред…" className={INPUT + ' resize-y'} /></Field>
        <p className="text-[12px] text-slate-400">Кандидатстването на сайта е по имейл / на място — няма форма.</p>
      </Drawer>

      {/* Абонати за нови обяви */}
      <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <button onClick={() => setShowSubs((v) => !v)} className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center"><Mail size={16} /></div>
            <div className="text-left">
              <div className="text-[14px] font-semibold text-slate-800">Абонати за нови обяви</div>
              <div className="text-[12px] text-slate-500">{subs.length} души · известяваш ги ръчно по имейл (BCC)</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {subs.length > 0 && (
              <span onClick={(e) => { e.stopPropagation(); copyEmails() }} className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white cursor-pointer"><Copy size={13} /> Копирай имейлите</span>
            )}
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${showSubs ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {showSubs && (
          <div className="border-t border-slate-100 px-5 py-2 max-h-64 overflow-y-auto">
            {subs.length === 0 ? (
              <div className="text-[13px] text-slate-400 py-4 text-center">Още няма абонати.</div>
            ) : subs.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
                <span className="text-[13px] text-slate-700 truncate">{sub.email}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-slate-400">{fmtDate(sub.created_at)}</span>
                  <button onClick={() => removeSub(sub.id)} className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50" title="Премахни"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Toast notice={notice} />
    </div>
  )
}
