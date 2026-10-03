'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { smartMatch } from '@/lib/search'
import {
  Newspaper, Upload, Trash2, Plus, X, Search, Pencil, EyeOff, Star, ExternalLink, ChevronLeft, ChevronRight,
  Bold, List, Link2, Heading2, CalendarClock, Send, Save, GripVertical,
} from 'lucide-react'
import {
  ACCENT, SITE_URL, NEWS_CATS, Field, INPUT, Toast, Drawer, Spinner, useFlash, fmtDate, fmtDateTime, shrinkImage, moveItem, renderRich,
} from './shared'
import type { News } from './shared'

type Img = { key: string; url?: string; file?: File; preview: string }
type Status = 'draft' | 'scheduled' | 'published'

const statusOf = (n: News): Status => (n.status !== 'published' ? 'draft' : n.published_at && new Date(n.published_at) > new Date() ? 'scheduled' : 'published')
const BADGE: Record<Status, string> = { draft: 'bg-white text-amber-700 border border-amber-200', scheduled: 'bg-sky-600 text-white', published: 'bg-emerald-500 text-white' }
const LABEL: Record<Status, string> = { draft: 'Чернова', scheduled: 'Насрочена', published: 'Публикувана' }
// datetime-local иска „YYYY-MM-DDTHH:mm“ в местно време
const toLocalInput = (iso: string | null) => { const d = iso ? new Date(iso) : new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }

/* ═══════════════ НОВИНИ ═══════════════ */
export default function NewsManager({ initial, authorId, openId, openNewSignal }: { initial: News[]; authorId: string | null; openId?: string | null; openNewSignal?: number }) {
  const supabase = createClient(); const router = useRouter()
  const { notice, flash } = useFlash()
  const [list, setList] = useState<News[]>(initial)
  const [q, setQ] = useState(''); const [filter, setFilter] = useState<'all' | Status>('all')
  const [page, setPage] = useState(1); const PER = 12
  // редактор
  const [drawer, setDrawer] = useState(false); const [busy, setBusy] = useState(false); const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [editId, setEditId] = useState<string | null>(null)
  const [title, setTitle] = useState(''); const [category, setCategory] = useState('Новини')
  const [excerpt, setExcerpt] = useState(''); const [content, setContent] = useState('')
  const [imgs, setImgs] = useState<Img[]>([]); const [coverKey, setCoverKey] = useState<string | null>(null)
  const [when, setWhen] = useState(''); const [dirty, setDirty] = useState(false)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const counts = useMemo(() => { const c = { all: list.length, draft: 0, scheduled: 0, published: 0 }; list.forEach((n) => { c[statusOf(n)]++ }); return c }, [list])
  const shown = useMemo(() => list
    .filter((n) => (filter === 'all' ? true : statusOf(n) === filter))
    .filter((n) => (q.trim() ? smartMatch(n.title + ' ' + (n.excerpt || ''), q) : true)), [list, filter, q])
  const pages = Math.max(1, Math.ceil(shown.length / PER)); const cur = Math.min(page, pages)
  const paged = shown.slice((cur - 1) * PER, cur * PER)

  // отваряне от таблото
  useEffect(() => { if (openId) { const n = list.find((x) => x.id === openId); if (n) openEdit(n) } }, [openId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (openNewSignal) openNew() }, [openNewSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  function reset() { setView('edit'); setDirty(false); setDragKey(null) }
  function openNew() {
    reset(); setEditId(null); setTitle(''); setCategory('Новини'); setExcerpt(''); setContent(''); setImgs([]); setCoverKey(null); setWhen(toLocalInput(null)); setDrawer(true)
  }
  function openEdit(n: News) {
    reset(); setEditId(n.id); setTitle(n.title); setCategory(n.category); setExcerpt(n.excerpt || ''); setContent(n.content || '')
    const gal = Array.isArray(n.gallery_images) ? n.gallery_images : []
    const urls = n.cover_url && !gal.includes(n.cover_url) ? [n.cover_url, ...gal] : gal
    setImgs(urls.map((u) => ({ key: u, url: u, preview: u }))); setCoverKey(n.cover_url || null)
    setWhen(toLocalInput(n.published_at)); setDrawer(true)
  }
  function close() {
    if (dirty && !confirm('Има незапазени промени. Да затворя ли без запис?')) return
    setDrawer(false)
  }
  const touch = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setDirty(true) }

  /* ---------- текстов редактор: бутоните вмъкват прост формат ---------- */
  function wrap(kind: 'bold' | 'h' | 'list' | 'link') {
    const ta = textRef.current; if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const sel = value.slice(s, e)
    let ins = ''
    if (kind === 'bold') ins = `**${sel || 'удебелен текст'}**`
    if (kind === 'h') ins = `\n\n## ${sel || 'Подзаглавие'}\n\n`
    if (kind === 'list') ins = `\n\n${(sel || 'първа точка\nвтора точка').split('\n').map((l) => `- ${l.replace(/^[-•]\s*/, '')}`).join('\n')}\n\n`
    if (kind === 'link') { const url = prompt('Адрес на връзката (https://…)'); if (!url) return; ins = `[${sel || 'текст на връзката'}](${url})` }
    const next = value.slice(0, s) + ins + value.slice(e)
    setContent(next.replace(/\n{3,}/g, '\n\n')); setDirty(true)
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + ins.length })
  }

  /* ---------- снимки ---------- */
  function addFiles(files: File[]) {
    const add = files.filter((f) => f.type.startsWith('image/')).map((f) => ({ key: `new-${Date.now()}-${Math.random()}`, file: f, preview: URL.createObjectURL(f) }))
    setImgs((p) => [...p, ...add]); if (!coverKey && add[0]) setCoverKey(add[0].key); setDirty(true)
  }
  function removeImg(k: string) { setImgs((p) => p.filter((x) => x.key !== k)); if (coverKey === k) setCoverKey(null); setDirty(true) }

  /* ---------- запис ---------- */
  async function save(mode: 'draft' | 'publish' | 'schedule') {
    if (!title.trim()) { flash('Въведете заглавие.', true); return }
    if (mode === 'schedule' && (!when || new Date(when) <= new Date())) { flash('Изберете бъдеща дата и час за публикуване.', true); return }
    try {
      setBusy(true)
      const urlOf: Record<string, string> = {}
      for (const im of imgs) {
        if (im.url) { urlOf[im.key] = im.url; continue }
        const blob = await shrinkImage(im.file!)
        const ext = blob.type === 'image/png' ? 'png' : 'jpg'
        const path = `news/gallery/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from('public-media').upload(path, blob, { contentType: blob.type || 'image/jpeg' })
        if (error) throw error
        urlOf[im.key] = supabase.storage.from('public-media').getPublicUrl(path).data.publicUrl
      }
      const gallery = imgs.map((im) => urlOf[im.key])
      const cover = (coverKey && urlOf[coverKey]) || gallery[0] || null
      const prev = list.find((x) => x.id === editId)
      const published_at = mode === 'draft' ? null
        : mode === 'schedule' ? new Date(when).toISOString()
        : prev?.status === 'published' && prev.published_at && when ? new Date(when).toISOString() : new Date().toISOString()
      const payload = {
        title: title.trim(), excerpt: excerpt.trim() || null, content: content.trim() || null, category,
        cover_url: cover, gallery_images: gallery, status: mode === 'draft' ? 'draft' : 'published', published_at,
        ...(editId ? {} : { author_id: authorId }),
      }
      if (editId) { const { data, error } = await supabase.from('site_news').update(payload).eq('id', editId).select('*').single(); if (error) throw error; setList((p) => p.map((x) => (x.id === editId ? (data as News) : x))) }
      else { const { data, error } = await supabase.from('site_news').insert(payload).select('*').single(); if (error) throw error; setList((p) => [data as News, ...p]) }
      setDirty(false); setDrawer(false)
      flash(mode === 'draft' ? 'Запазено като чернова.' : mode === 'schedule' ? `Ще се публикува на ${fmtDateTime(published_at)}.` : 'Публикувано на сайта.')
      router.refresh()
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Грешка при запис.', true) } finally { setBusy(false) }
  }
  async function unpublish(n: News) { setList((p) => p.map((x) => (x.id === n.id ? { ...x, status: 'draft', published_at: null } : x))); await supabase.from('site_news').update({ status: 'draft', published_at: null }).eq('id', n.id); flash('Върната в чернова – вече не се вижда на сайта.'); router.refresh() }
  async function publishNow(n: News) { const at = new Date().toISOString(); setList((p) => p.map((x) => (x.id === n.id ? { ...x, status: 'published', published_at: at } : x))); await supabase.from('site_news').update({ status: 'published', published_at: at }).eq('id', n.id); flash('Публикувано на сайта.'); router.refresh() }
  async function remove(n: News) { if (!confirm(`Изтриване на „${n.title}“? Това не може да се върне.`)) return; await supabase.from('site_news').delete().eq('id', n.id); setList((p) => p.filter((x) => x.id !== n.id)); flash('Изтрито.'); router.refresh() }

  const editing = list.find((x) => x.id === editId)
  const coverPreview = imgs.find((x) => x.key === coverKey)?.preview || imgs[0]?.preview

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: ACCENT }}>Новини</h2>
          <div className="text-slate-500 text-[12.5px] mt-0.5">{counts.published} на сайта · {counts.scheduled} насрочени · {counts.draft} чернови</div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90" style={{ backgroundColor: ACCENT }}><Plus size={15} /> Нова новина</button>
      </div>

      <div className="flex gap-2.5 items-center flex-wrap mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Търси новина…" className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[13px] bg-white focus:outline-none focus:border-slate-400" />
        </div>
        <div className="inline-flex bg-white border border-slate-200 rounded-xl p-0.5 flex-wrap">
          {([['all', 'Всички'], ['published', 'На сайта'], ['scheduled', 'Насрочени'], ['draft', 'Чернови']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => { setFilter(k); setPage(1) }} className={`text-[12.5px] px-3 py-1.5 rounded-lg ${filter === k ? 'text-white font-medium' : 'text-slate-500'}`} style={filter === k ? { backgroundColor: ACCENT } : {}}>
              {lbl} <span className="opacity-70">{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-14 text-center">
          <Newspaper size={30} className="text-slate-200 mx-auto mb-2.5" />
          <div className="text-slate-700 font-semibold text-[15px] mb-1">{q.trim() || filter !== 'all' ? 'Няма съвпадение' : 'Още няма новини'}</div>
          <p className="text-sm text-slate-500 mb-4">{q.trim() || filter !== 'all' ? 'Променете търсенето или филтъра.' : 'Напишете първата новина за сайта.'}</p>
          {!q.trim() && filter === 'all' && <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Нова новина</button>}
        </div>
      ) : (<>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {paged.map((n) => {
            const st = statusOf(n)
            return (
              <div key={n.id} className="group grid grid-cols-[88px_1fr_auto] gap-4 items-center px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-blue-50/30">
                <button onClick={() => openEdit(n)} className="w-[88px] h-[64px] rounded-xl overflow-hidden bg-gradient-to-br from-slate-200 to-slate-100 flex items-center justify-center shrink-0" title="Редактирай">
                  {n.cover_url ? <img src={n.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-slate-400">без снимка</span>}
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-[11.5px]">
                    <span className={`font-semibold px-2 py-0.5 rounded-full ${BADGE[st]}`}>{LABEL[st]}</span>
                    <span className="text-teal-700 font-semibold">{n.category}</span>
                    <span className="text-slate-400">{st === 'draft' ? `създадена ${fmtDate(n.created_at)}` : st === 'scheduled' ? `ще излезе ${fmtDateTime(n.published_at)}` : fmtDate(n.published_at)}</span>
                  </div>
                  <button onClick={() => openEdit(n)} className="block text-left text-[15px] font-semibold mt-1 leading-snug hover:underline truncate max-w-full" style={{ color: ACCENT }}>{n.title}</button>
                  {n.excerpt && <p className="text-[12.5px] text-slate-500 line-clamp-1">{n.excerpt}</p>}
                </div>
                <div className="flex items-center gap-0.5">
                  {st === 'draft' && <button onClick={() => publishNow(n)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-emerald-700 hover:bg-emerald-50">Публикувай</button>}
                  {st === 'published' && <a href={`${SITE_URL}/novini/${n.id}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100" title="Виж на сайта"><ExternalLink size={14} /></a>}
                  <button onClick={() => openEdit(n)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-[#0f2240]" title="Редактирай"><Pencil size={14} /></button>
                  {st !== 'draft' && <button onClick={() => unpublish(n)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-[#0f2240]" title="Махни от сайта (в чернова)"><EyeOff size={14} /></button>}
                  <button onClick={() => remove(n)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-600" title="Изтрий"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <div className="text-[12.5px] text-slate-500">{(cur - 1) * PER + 1}–{Math.min(cur * PER, shown.length)} от {shown.length}</div>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(Math.max(1, cur - 1))} disabled={cur === 1} className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center disabled:opacity-40" aria-label="Предишна"><ChevronLeft size={15} /></button>
              {Array.from({ length: pages }).map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`min-w-8 h-8 px-2 rounded-lg border text-[12.5px] ${cur === i + 1 ? 'text-white border-transparent' : 'bg-white border-slate-200'}`} style={cur === i + 1 ? { backgroundColor: ACCENT } : {}}>{i + 1}</button>
              ))}
              <button onClick={() => setPage(Math.min(pages, cur + 1))} disabled={cur === pages} className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center disabled:opacity-40" aria-label="Следваща"><ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </>)}

      <Toast notice={notice} />
      <Drawer open={drawer} onClose={close} width={760} title={editId ? 'Редакция на новина' : 'Нова новина'}
        footer={<div className="flex flex-wrap gap-2 w-full">
          <button onClick={() => save('draft')} disabled={busy} className="py-2.5 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 inline-flex items-center gap-2"><Save size={15} /> Чернова</button>
          <span className="flex-1" />
          <div className="inline-flex items-center gap-1.5 border border-slate-200 rounded-xl pl-2.5 pr-1 py-1">
            <CalendarClock size={15} className="text-slate-400" />
            <input type="datetime-local" value={when} onChange={(e) => touch(setWhen)(e.target.value)} className="text-[12.5px] bg-transparent focus:outline-none" aria-label="Дата и час на публикуване" />
            <button onClick={() => save('schedule')} disabled={busy} className="px-2.5 py-1.5 rounded-lg text-[12.5px] font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-60">Насрочи</button>
          </div>
          <button onClick={() => save('publish')} disabled={busy} className="py-2.5 px-4 rounded-xl text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60" style={{ backgroundColor: ACCENT }}>{busy ? <Spinner /> : <Send size={15} />} {editing && statusOf(editing) === 'published' ? 'Запази промените' : 'Публикувай сега'}</button>
        </div>}>
        <div className="inline-flex bg-slate-100 rounded-xl p-0.5 -mt-1">
          {([['edit', 'Редакция'], ['preview', 'Преглед като на сайта']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`text-[12.5px] px-3 py-1.5 rounded-lg ${view === k ? 'bg-white shadow-sm font-medium' : 'text-slate-500'}`} style={view === k ? { color: ACCENT } : {}}>{l}</button>
          ))}
        </div>

        {view === 'preview' ? (
          <article className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-gradient-to-b from-lime-50 to-white">
              <div className="text-[12px] text-slate-500 flex gap-2 items-center"><span className="px-2 py-0.5 rounded-full bg-lime-100 text-lime-800 font-semibold">{category}</span>{fmtDate(when ? new Date(when).toISOString() : null)}</div>
              <h1 className="text-[24px] font-bold leading-tight mt-2" style={{ color: ACCENT }}>{title || 'Заглавие на новината'}</h1>
            </div>
            {coverPreview && <img src={coverPreview} alt="" className="w-full aspect-[16/9] object-cover" />}
            <div className="p-5 text-[15px] leading-relaxed text-slate-700">
              {excerpt && <p className="text-[16.5px] text-slate-900 border-l-4 border-lime-400 pl-3 mb-4">{excerpt}</p>}
              {content ? renderRich(content) : <p className="text-slate-400">Още няма текст.</p>}
              {imgs.length > 1 && <div className="grid grid-cols-4 gap-1.5 mt-4">{imgs.filter((x) => x.key !== coverKey).slice(0, 8).map((x) => <img key={x.key} src={x.preview} alt="" className="aspect-square object-cover rounded-lg" />)}</div>}
            </div>
          </article>
        ) : (<>
          <Field label="Заглавие"><input value={title} onChange={(e) => touch(setTitle)(e.target.value)} placeholder="напр. Ден на Земята в училищния двор" className={INPUT + ' !text-[15px] font-medium'} /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4">
            <Field label="Категория"><select value={category} onChange={(e) => touch(setCategory)(e.target.value)} className={INPUT}>{NEWS_CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
            <Field label={`Кратко описание (${excerpt.length}/200)`}>
              <textarea value={excerpt} onChange={(e) => touch(setExcerpt)(e.target.value)} rows={2} placeholder="Едно-две изречения – показват се в списъка с новини." className={INPUT + ' resize-y ' + (excerpt.length > 200 ? '!border-amber-400' : '')} />
            </Field>
          </div>
          <Field label="Текст">
            <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:border-slate-500 bg-slate-50 focus-within:bg-white">
              <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-white">
                <button type="button" onClick={() => wrap('h')} className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100" title="Подзаглавие"><Heading2 size={16} /></button>
                <button type="button" onClick={() => wrap('bold')} className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100" title="Удебели"><Bold size={16} /></button>
                <button type="button" onClick={() => wrap('list')} className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100" title="Списък"><List size={16} /></button>
                <button type="button" onClick={() => wrap('link')} className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100" title="Връзка"><Link2 size={16} /></button>
                <span className="ml-auto text-[11px] text-slate-400 pr-1">Нов ред = нов абзац · ## подзаглавие · - списък</span>
              </div>
              <textarea ref={textRef} value={content} onChange={(e) => touch(setContent)(e.target.value)} rows={12} placeholder="Пълният текст на новината…" className="w-full px-3 py-2.5 text-[14px] leading-relaxed bg-transparent focus:outline-none resize-y" />
            </div>
          </Field>
          <Field label={`Снимки (${imgs.length}) – влачете за подредба, звездата избира корицата`}>
            {imgs.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
                {imgs.map((im, i) => {
                  const isCover = (coverKey || imgs[0]?.key) === im.key
                  return (
                    <div key={im.key} draggable
                      onDragStart={() => setDragKey(im.key)} onDragEnd={() => setDragKey(null)}
                      onDragOver={(e) => { if (dragKey) e.preventDefault() }}
                      onDrop={(e) => { e.preventDefault(); if (!dragKey || dragKey === im.key) return; const from = imgs.findIndex((x) => x.key === dragKey); setImgs((p) => moveItem(p, from, i)); setDirty(true) }}
                      className={`relative aspect-square rounded-lg overflow-hidden group cursor-grab ${isCover ? 'ring-[3px] ring-amber-400' : im.file ? 'ring-2 ring-emerald-300' : ''} ${dragKey === im.key ? 'opacity-40' : ''}`}>
                      <img src={im.preview} alt="" className="w-full h-full object-cover pointer-events-none" />
                      <GripVertical size={14} className="absolute top-1 left-1 text-white drop-shadow opacity-0 group-hover:opacity-100" />
                      <button type="button" onClick={() => { setCoverKey(im.key); setDirty(true) }} title={isCover ? 'Корица' : 'Направи корица'}
                        className={`absolute bottom-1 left-1 p-1 rounded-md ${isCover ? 'bg-amber-400 text-white' : 'bg-white/90 text-slate-600 opacity-0 group-hover:opacity-100'}`}><Star size={12} fill={isCover ? 'currentColor' : 'none'} /></button>
                      <button type="button" onClick={() => removeImg(im.key)} title="Махни" className="absolute top-1 right-1 p-1 rounded-md bg-white/90 text-slate-600 hover:text-rose-600 opacity-0 group-hover:opacity-100"><X size={12} /></button>
                    </div>
                  )
                })}
              </div>
            )}
            <label className="block border-[1.5px] border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors"
              onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
              onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)) } }}>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.currentTarget.value = '' }} />
              <Upload size={18} className="mx-auto mb-1.5 text-slate-400" />
              <span className="block text-[13px] font-medium text-slate-700">Добавете снимки (може много наведнъж)</span>
              <span className="block text-[12px] text-slate-400 mt-0.5">Снимките от телефон се смаляват автоматично</span>
            </label>
          </Field>
          {editing && statusOf(editing) === 'published' && (
            <p className="text-[12px] text-slate-500">Публикувана на {fmtDateTime(editing.published_at)}. Датата може да се смени от полето долу и „Запази промените“.</p>
          )}
        </>)}
      </Drawer>
    </div>
  )
}
