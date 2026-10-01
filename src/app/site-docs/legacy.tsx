'use client'

// Раздели от „Сайт“, които още не са преработени (част Б).
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

/* ═══════════════ ГАЛЕРИЯ ═══════════════ */
export function GalleryManager({ initialAlbums, initialPhotos }: { initialAlbums: Album[]; initialPhotos: Photo[] }) {
  const supabase = createClient(); const router = useRouter()
  const [albums, setAlbums] = useState<Album[]>(initialAlbums)
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [openId, setOpenId] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false); const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState(''); const [evDate, setEvDate] = useState('')
  const [notice, setNotice] = useState<{ msg: string; err?: boolean } | null>(null)
  const flash = (msg: string, err = false) => { setNotice({ msg, err }); setTimeout(() => setNotice((p) => (p?.msg === msg ? null : p)), 3500) }

  const openAlbum = albums.find((a) => a.id === openId)
  const openPhotos = photos.filter((p) => p.album_id === openId).sort((a, b) => a.sort_order - b.sort_order)

  async function createAlbum() {
    if (!title.trim()) { flash('Въведете заглавие на албума.', true); return }
    try {
      setBusy(true)
      const { data, error } = await supabase.from('gallery_albums').insert({ title: title.trim(), event_date: evDate || null, sort_order: albums.length + 1 }).select('*').single()
      if (error) throw error
      setAlbums((p) => [...p, data as Album]); setTitle(''); setEvDate(''); setDrawer(false); flash('Албумът е създаден.'); router.refresh()
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Грешка.', true) } finally { setBusy(false) }
  }
  async function deleteAlbum(a: Album) {
    if (!confirm(`Изтриване на албума „${a.title}“ и всичките му снимки?`)) return
    await supabase.from('gallery_albums').delete().eq('id', a.id)
    setAlbums((p) => p.filter((x) => x.id !== a.id)); setPhotos((p) => p.filter((x) => x.album_id !== a.id))
    if (openId === a.id) setOpenId(null); flash('Албумът е изтрит.'); router.refresh()
  }
  async function uploadPhotos(albumId: string, files: FileList) {
    setBusy(true)
    const existing = photos.filter((p) => p.album_id === albumId).length
    const added: Photo[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]; const ext = f.name.split('.').pop()
      const path = `gallery/${albumId}/${Date.now()}-${i}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('public-media').upload(path, f); if (upErr) continue
      const url = supabase.storage.from('public-media').getPublicUrl(path).data.publicUrl
      const { data } = await supabase.from('gallery_photos').insert({ album_id: albumId, photo_url: url, sort_order: existing + i + 1 }).select('*').single()
      if (data) added.push(data as Photo)
    }
    setPhotos((p) => [...p, ...added])
    // ако албумът няма корица — сложи първата качена
    if (added.length && openAlbum && !openAlbum.cover_url) await setCover(albumId, added[0].photo_url)
    setBusy(false); flash(`Качени ${added.length} снимки.`); router.refresh()
  }
  async function setCover(albumId: string, url: string) { setAlbums((p) => p.map((a) => a.id === albumId ? { ...a, cover_url: url } : a)); await supabase.from('gallery_albums').update({ cover_url: url }).eq('id', albumId); router.refresh() }
  async function deletePhoto(p: Photo) { await supabase.from('gallery_photos').delete().eq('id', p.id); setPhotos((prev) => prev.filter((x) => x.id !== p.id)); router.refresh() }

  // Изглед на един албум
  if (openAlbum) {
    return (
      <div>
        <button onClick={() => setOpenId(null)} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"><ArrowLeft size={15} /> Всички албуми</button>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <div><h2 className="text-[18px] font-semibold tracking-tight" style={{ color: ACCENT }}>{openAlbum.title}</h2>
            <div className="text-slate-500 text-[12.5px] mt-0.5">{openPhotos.length} снимки{openAlbum.event_date ? ` · ${fmtDate(openAlbum.event_date)}` : ''}</div></div>
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90 cursor-pointer" style={{ backgroundColor: ACCENT }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Качи снимки
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) uploadPhotos(openAlbum.id, e.target.files); e.currentTarget.value = '' }} />
          </label>
        </div>
        {openPhotos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-14 text-center">
            <Images size={30} className="text-slate-200 mx-auto mb-2.5" />
            <div className="text-slate-700 font-semibold text-[15px] mb-1">Празен албум</div>
            <p className="text-sm text-slate-500">Качи първите снимки.</p>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
            {openPhotos.map((p) => {
              const isCover = openAlbum.cover_url === p.photo_url
              return (
                <div key={p.id} className="group relative rounded-xl overflow-hidden border border-slate-200 aspect-square">
                  <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                  {isCover && <span className="absolute top-2 left-2 text-[10px] font-semibold bg-amber-400 text-white px-2 py-0.5 rounded-full inline-flex items-center gap-1"><Star size={10} /> корица</span>}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    {!isCover && <button onClick={() => setCover(openAlbum.id, p.photo_url)} className="px-2.5 py-1.5 rounded-lg bg-white/90 text-[11px] font-medium text-slate-700 hover:bg-white inline-flex items-center gap-1"><Star size={12} /> Корица</button>}
                    <button onClick={() => deletePhoto(p)} className="w-8 h-8 rounded-lg bg-white/90 text-rose-600 hover:bg-white flex items-center justify-center"><Trash2 size={14} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <Toast notice={notice} />
      </div>
    )
  }

  // Списък с албуми
  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div><h2 className="text-[18px] font-semibold tracking-tight" style={{ color: ACCENT }}>Галерия</h2>
          <div className="text-slate-500 text-[12.5px] mt-0.5">{albums.length} албума · {photos.length} снимки</div></div>
        <button onClick={() => setDrawer(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90" style={{ backgroundColor: ACCENT }}><Plus size={15} /> Нов албум</button>
      </div>

      {albums.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-14 text-center">
          <Images size={30} className="text-slate-200 mx-auto mb-2.5" />
          <div className="text-slate-700 font-semibold text-[15px] mb-1">Няма албуми</div>
          <p className="text-sm text-slate-500 mb-4">Създай първия албум.</p>
          <button onClick={() => setDrawer(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Нов албум</button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
          {albums.map((a) => {
            const count = photos.filter((p) => p.album_id === a.id).length
            return (
              <div key={a.id} className="group rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                <div className="h-[120px] bg-gradient-to-br from-slate-200 to-slate-100 relative cursor-pointer flex items-center justify-center" onClick={() => setOpenId(a.id)}>
                  {a.cover_url ? <img src={a.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[13px] font-bold text-slate-300 tracking-widest">ЦСОП</span>}
                  <span className="absolute bottom-2 right-2 text-[11px] bg-[#0f2240]/75 text-white px-2 py-0.5 rounded-full">{count} снимки</span>
                </div>
                <div className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 cursor-pointer" onClick={() => setOpenId(a.id)}>
                    <b className="text-[13.5px] font-medium text-slate-800 block truncate">{a.title}</b>
                    <span className="text-[11.5px] text-slate-400">{a.event_date ? fmtDate(a.event_date) : 'без дата'}</span>
                  </div>
                  <button onClick={() => deleteAlbum(a)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Изтрий албума"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Toast notice={notice} />
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Нов албум" width={420}
        footer={<>
          <button onClick={() => setDrawer(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Отказ</button>
          <button onClick={createAlbum} disabled={busy} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: ACCENT }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Създай</button>
        </>}>
        <Field label="Заглавие"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. Спортен празник 2026" className={INPUT} /></Field>
        <Field label="Дата на събитието (по избор)"><input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} className={INPUT} /></Field>
        <p className="text-[12px] text-slate-400">Снимките се качват след създаване, отвътре в албума.</p>
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

/* ═══════════════ НАЧАЛНА (HERO) ═══════════════ */
export function HeroManager({ photos, albums, initialSelected }: { photos: Photo[]; albums: Album[]; initialSelected: string[] }) {
  const supabase = createClient(); const router = useRouter()
  const [selected, setSelected] = useState<string[]>(initialSelected || [])
  const [filterAlbum, setFilterAlbum] = useState<string>('all')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ msg: string; err?: boolean } | null>(null)
  const flash = (msg: string, err = false) => { setNotice({ msg, err }); setTimeout(() => setNotice((p) => (p?.msg === msg ? null : p)), 3500) }

  const shownPhotos = filterAlbum === 'all' ? photos : photos.filter((p) => p.album_id === filterAlbum)
  const toggle = (url: string) => setSelected((prev) => prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url])
  const albumTitle = (id: string) => albums.find((a) => a.id === id)?.title || 'албум'

  async function save() {
    try {
      setBusy(true)
      const { error } = await supabase.from('site_settings').update({ value: selected, updated_at: new Date().toISOString() }).eq('key', 'hero_photos')
      if (error) throw error
      flash('Началната въртележка е обновена.'); router.refresh()
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Грешка при запис.', true) } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div><h2 className="text-[18px] font-semibold tracking-tight" style={{ color: ACCENT }}>Начална страница</h2>
          <div className="text-slate-500 text-[12.5px] mt-0.5">Избери кои снимки от галерията да се въртят в началото на сайта</div></div>
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: ACCENT }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запази ({selected.length})</button>
      </div>

      {selected.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-5">
          <div className="text-[12px] font-semibold text-slate-500 mb-2.5">Избрани за въртележката ({selected.length})</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {selected.map((url) => (
              <div key={url} className="relative shrink-0">
                <img src={url} alt="" className="w-24 h-16 object-cover rounded-lg border border-slate-200" />
                <button onClick={() => toggle(url)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow"><X size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-14 text-center">
          <Images size={30} className="text-slate-200 mx-auto mb-2.5" />
          <div className="text-slate-700 font-semibold text-[15px] mb-1">Няма снимки в галерията</div>
          <p className="text-sm text-slate-500">Първо качи снимки в раздел „Галерия", после ги избери тук.</p>
        </div>
      ) : (<>
        <div className="flex gap-1.5 flex-wrap mb-4">
          <button onClick={() => setFilterAlbum('all')} className={`text-[12.5px] px-3 py-1.5 rounded-lg border ${filterAlbum === 'all' ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} style={filterAlbum === 'all' ? { backgroundColor: ACCENT } : {}}>Всички</button>
          {albums.map((a) => {
            const cnt = photos.filter((p) => p.album_id === a.id).length; if (!cnt) return null
            return <button key={a.id} onClick={() => setFilterAlbum(a.id)} className={`text-[12.5px] px-3 py-1.5 rounded-lg border ${filterAlbum === a.id ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} style={filterAlbum === a.id ? { backgroundColor: ACCENT } : {}}>{a.title} ({cnt})</button>
          })}
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>
          {shownPhotos.map((p) => {
            const on = selected.includes(p.photo_url)
            return (
              <button key={p.id} onClick={() => toggle(p.photo_url)} className={`relative rounded-xl overflow-hidden border-2 aspect-square transition-all ${on ? '' : 'border-transparent hover:border-slate-300'}`} style={on ? { borderColor: ACCENT } : {}}>
                <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                {on && <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-white shadow" style={{ backgroundColor: ACCENT }}><Check size={14} /></span>}
                <span className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[10px] px-1.5 py-0.5 truncate text-left">{albumTitle(p.album_id)}</span>
              </button>
            )
          })}
        </div>
      </>)}

      <Toast notice={notice} />
    </div>
  )
}


/* ═══════════════ СНИМКИ ЗА САЙТА (склад, не се показват като галерия) ═══════════════ */
const SITE_IMG_DIR = 'site'
const TR: Record<string, string> = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sht',ъ:'a',ь:'y',ю:'yu',я:'ya' }
function slugName(name: string) {
  const base = name.replace(/\.[^.]+$/, '').toLowerCase().split('').map((c) => TR[c] ?? c).join('')
  return base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'snimka'
}
// Смалява до 2000px по дългата страна (снимките от телефон са по 5–8 MB)
async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') return file
  const bmp = await createImageBitmap(file)
  const max = 2000; const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  if (k === 1 && file.size < 1_500_000) return file
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  const png = file.type === 'image/png'
  return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), png ? 'image/png' : 'image/jpeg', 0.85))
}

// Страници от сайта, на които може да се покаже снимка (ключът е в site_settings.page_photos)

export function SiteImagesManager() {
  const supabase = createClient()
  const [pages, setPages] = useState<Record<string, string[]>>({})
  const [items, setItems] = useState<{ name: string; size: number; url: string }[] | null>(null)
  const [busy, setBusy] = useState(false); const [q, setQ] = useState('')
  const [notice, setNotice] = useState<{ msg: string; err?: boolean } | null>(null)
  const flash = (msg: string, err = false) => { setNotice({ msg, err }); setTimeout(() => setNotice((p) => (p?.msg === msg ? null : p)), 3000) }
  const urlOf = (name: string) => supabase.storage.from('public-media').getPublicUrl(`${SITE_IMG_DIR}/${name}`).data.publicUrl

  async function load() {
    const { data, error } = await supabase.storage.from('public-media').list(SITE_IMG_DIR, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
    if (error) { flash(error.message, true); setItems([]); return }
    setItems((data || []).filter((f) => f.name && !f.name.startsWith('.')).map((f) => ({ name: f.name, size: (f.metadata as any)?.size || 0, url: urlOf(f.name) })))
  }
  async function loadPages() {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'page_photos').maybeSingle()
    setPages(data?.value && typeof data.value === 'object' ? (data.value as Record<string, string[]>) : {})
  }
  useEffect(() => { load(); loadPages() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pageOf = (url: string) => Object.keys(pages).find((k) => (pages[k] || []).includes(url)) || ''
  async function assign(url: string, page: string) {
    const next: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(pages)) { const list = (v || []).filter((u) => u !== url); if (list.length) next[k] = list }
    if (page) next[page] = [...(next[page] || []), url]
    setPages(next)
    const { error } = await supabase.from('site_settings').update({ value: next, updated_at: new Date().toISOString() }).eq('key', 'page_photos')
    if (error) { flash(error.message, true); loadPages(); return }
    flash(page ? `Показва се на „${SITE_PAGES.find((x) => x.key === page)?.label}“.` : 'Махната от страницата.')
  }

  async function upload(files: FileList) {
    setBusy(true)
    try {
      const taken = new Set((items || []).map((i) => i.name))
      for (const f of Array.from(files)) {
        const blob = await shrinkImage(f)
        const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : (f.name.split('.').pop() || 'jpg').toLowerCase()
        const base = slugName(f.name); let name = `${base}.${ext}`; let n = 2
        while (taken.has(name)) name = `${base}-${n++}.${ext}`
        taken.add(name)
        const { error } = await supabase.storage.from('public-media').upload(`${SITE_IMG_DIR}/${name}`, blob, { contentType: blob.type || f.type })
        if (error) throw error
      }
      flash(`Качени ${files.length} снимки.`); await load()
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Грешка при качване.', true) } finally { setBusy(false) }
  }
  async function remove(name: string) {
    if (!confirm(`Изтриване на „${name}"? Ако е сложена на страница от сайта, там ще изчезне.`)) return
    const { error } = await supabase.storage.from('public-media').remove([`${SITE_IMG_DIR}/${name}`])
    if (error) { flash(error.message, true); return }
    if (pageOf(urlOf(name))) await assign(urlOf(name), '')
    setItems((p) => (p || []).filter((i) => i.name !== name)); flash('Изтрито.')
  }
  async function copy(text: string, what: string) { try { await navigator.clipboard.writeText(text); flash(`Копирано: ${what}`) } catch { flash('Не можах да копирам.', true) } }

  const shown = (items || []).filter((i) => !q.trim() || i.name.includes(q.trim().toLowerCase()))

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div>
          <div className="text-slate-800 font-semibold text-[15px]">Снимки за сайта</div>
          <div className="text-slate-500 text-[12.5px] mt-0.5">Качете снимка и под нея изберете на коя страница от сайта да се покаже. {items ? `${items.length} снимки` : ''}</div>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търси по име…" className="pl-9 pr-3 py-2 w-56 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
        </div>
        <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`} style={{ backgroundColor: ACCENT }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Качи снимки
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.currentTarget.value = '' }} />
        </label>
      </div>

      {items === null ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 className="animate-spin" /></div>
      ) : shown.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <ImagePlus size={28} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-500">{items.length ? 'Няма съвпадение.' : 'Още няма качени снимки.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {shown.map((i) => (
            <div key={i.name} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 group">
              <a href={i.url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] bg-slate-50">
                <img src={i.url} alt={i.name} loading="lazy" className="w-full h-full object-cover" />
              </a>
              <div className="px-3 py-2.5">
                <div className="text-[13px] text-slate-800 truncate" title={i.name}>{i.name}</div>
                <select value={pageOf(i.url)} onChange={(e) => assign(i.url, e.target.value)} aria-label={`Страница за ${i.name}`}
                  className={`mt-2 w-full px-2 py-1.5 rounded-lg border text-[12.5px] focus:outline-none ${pageOf(i.url) ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <option value="">Не е на страница</option>
                  {SITE_PAGES.map((pg) => <option key={pg.key} value={pg.key}>{pg.label}</option>)}
                </select>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[11px] text-slate-400">{i.size ? `${Math.round(i.size / 1024)} KB` : ''}</span>
                  <div className="flex-1" />
                  <button onClick={() => copy(i.name, i.name)} title="Копирай името" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50"><Copy size={14} /></button>
                  <button onClick={() => remove(i.name)} title="Изтрий" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Toast notice={notice} />
    </div>
  )
}
