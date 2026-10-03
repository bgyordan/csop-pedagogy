'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  X, ImagePlus, Star, Trash2, Loader2, Bold, Heading2, List, Globe, ShieldCheck, Paperclip, Upload, Send, Eye, PenLine,
} from 'lucide-react'
import { renderRich, slugName } from '@/app/site-docs/shared'
import { KINDS, kindMeta, isImage, resizeImage, uid, STATUS } from './lib'
import type { Post, Kind, Media, Cls } from './lib'

type Item = { key: string; media?: Media; file?: File; preview?: string; caption: string; image: boolean }

function Grow({ value, onChange, placeholder, className, minRows = 3, taRef }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; minRows?: number; taRef?: React.RefObject<HTMLTextAreaElement | null>
}) {
  const own = useRef<HTMLTextAreaElement>(null); const ref = taRef || own
  useLayoutEffect(() => { const el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }, [value, ref])
  return <textarea ref={ref} value={value} rows={minRows} placeholder={placeholder} onChange={e => onChange(e.target.value)}
    className={`w-full resize-none overflow-hidden focus:outline-none placeholder:text-slate-400 ${className || ''}`} />
}

const monthOf = (d: string | null) => d ? d.slice(0, 7) : ''
const MONTH_NAMES = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']
// Месеците от миналата до следващата учебна година (септ → авг)
function monthOptions() {
  const now = new Date(); const sy = (now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1) - 1
  const out: { v: string; l: string }[] = []
  for (let i = 0; i < 36; i++) { const m = (8 + i) % 12, y = sy + Math.floor((8 + i) / 12); out.push({ v: `${y}-${String(m + 1).padStart(2, '0')}`, l: `${MONTH_NAMES[m]} ${y}` }) }
  return out
}
const lastDay = (ym: string) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` }

export default function PostEditor({ post, presetKind, meId, academicYearId, classes, myClassIds, thumbs, onClose, onSaved }: {
  post: Post | null; presetKind?: Kind; meId: string; academicYearId: string | null
  classes: Cls[]; myClassIds: string[]; thumbs: Record<string, string>
  onClose: () => void; onSaved: (id: string, msg: string) => void
}) {
  const supabase = createClient()
  const [kind, setKind] = useState<Kind>(post?.kind || presetKind || 'cabinet')
  const [title, setTitle] = useState(post?.title || '')
  const [body, setBody] = useState(post?.body || '')
  const [eventDate, setEventDate] = useState(post?.event_date || '')
  const [ideas, setIdeas] = useState(post?.ideas || '')
  const [activities, setActivities] = useState(post?.activities || '')
  const [goals, setGoals] = useState(post?.goals || '')
  const [from, setFrom] = useState(monthOf(post?.period_from || null))
  const [to, setTo] = useState(monthOf(post?.period_to || null))
  const [status, setStatus] = useState(post?.status || 'in_progress')
  const [classIds, setClassIds] = useState<string[]>(post ? post.classIds : (presetKind === 'project' ? myClassIds : []))
  const [items, setItems] = useState<Item[]>(() => (post?.media || []).map(m => ({
    key: m.id, media: m, caption: m.caption || '', image: isImage(m), preview: m.thumb_path ? thumbs[m.thumb_path] : undefined,
  })))
  const [coverKey, setCoverKey] = useState<string | null>(() => post?.media.find(m => m.path === post.cover_path)?.id || null)
  const wasRequested = post?.site_status === 'requested' || post?.site_status === 'published'
  const [siteWant, setSiteWant] = useState(wasRequested)
  const [consent, setConsent] = useState(post?.site_consent || false)
  const [siteNote, setSiteNote] = useState(post?.site_note || '')
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const pickRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dirty = useRef(false)
  useEffect(() => { dirty.current = true }, [title, body, items, kind]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { dirty.current = false }, [])

  const images = items.filter(i => i.image)
  const others = items.filter(i => !i.image)
  const cover = coverKey && images.some(i => i.key === coverKey) ? coverKey : images[0]?.key || null

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list)
    setItems(prev => [...prev, ...arr.map(f => {
      const image = f.type.startsWith('image/')
      return { key: uid(), file: f, caption: '', image, preview: image ? URL.createObjectURL(f) : undefined }
    })])
  }
  useEffect(() => () => { items.forEach(i => i.file && i.preview && URL.revokeObjectURL(i.preview)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+V със снимка → добавя я
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const fs = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/'))
      if (fs.length) { e.preventDefault(); addFiles(fs) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  function tryClose() {
    if (dirty.current && (title.trim() || body.trim() || items.some(i => i.file)) && !confirm('Да затворя ли без запис?')) return
    onClose()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); tryClose() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Мини форматиране: удебелен / подзаглавие / списък
  function wrap(kindFmt: 'bold' | 'h' | 'list') {
    const el = bodyRef.current; if (!el) return
    const s = el.selectionStart, e = el.selectionEnd
    let next = body, caret = e
    if (kindFmt === 'bold') { const sel = body.slice(s, e) || 'удебелен текст'; next = body.slice(0, s) + `**${sel}**` + body.slice(e); caret = s + sel.length + 4 }
    else {
      const ls = body.lastIndexOf('\n', s - 1) + 1
      const pre = kindFmt === 'h' ? '## ' : '- '
      next = body.slice(0, ls) + pre + body.slice(ls); caret = e + pre.length
    }
    setBody(next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret) })
  }

  async function save() {
    if (busy) return
    setErr('')
    if (!title.trim()) { setErr('Дай заглавие на публикацията.'); return }
    if (siteWant && !consent) { setErr('За сайта отбележи потвърждението за снимките на децата.'); return }
    setBusy('Записване…')
    try {
      const base: Record<string, unknown> = {
        kind, title: title.trim(), body: body.trim() || null,
        event_date: kind === 'event' && eventDate ? eventDate : null,
        ideas: kind === 'project' ? ideas.trim() || null : null,
        activities: kind === 'project' ? activities.trim() || null : null,
        goals: kind === 'project' ? goals.trim() || null : null,
        period_from: kind === 'project' && from ? `${from}-01` : null,
        period_to: kind === 'project' && to ? lastDay(to) : null,
        status: kind === 'project' ? status : null,
        updated_at: new Date().toISOString(),
      }
      // За сайта
      if (siteWant) {
        if (!post || post.site_status === 'none' || post.site_status === 'declined') Object.assign(base, { site_status: 'requested', site_requested_at: new Date().toISOString(), site_reply: null })
        Object.assign(base, { site_consent: consent, site_note: siteNote.trim() || null })
      } else if (post?.site_status === 'requested') Object.assign(base, { site_status: 'none', site_consent: false })

      let id = post?.id
      if (!id) {
        const { data, error } = await supabase.from('portfolio_posts')
          .insert({ ...base, author_id: meId, academic_year_id: academicYearId }).select('id').single()
        if (error) throw error
        id = data!.id as string
      } else {
        const { error } = await supabase.from('portfolio_posts').update(base).eq('id', id)
        if (error) throw error
      }

      // Махнати снимки/файлове
      const keep = new Set(items.filter(i => i.media).map(i => i.media!.id))
      const gone = (post?.media || []).filter(m => !keep.has(m.id))
      if (gone.length) {
        await supabase.storage.from('portfolio').remove(gone.flatMap(m => [m.path, m.thumb_path].filter(Boolean) as string[]))
        await supabase.from('portfolio_media').delete().in('id', gone.map(m => m.id))
      }

      // Нови и променени — по реда: снимките, после файловете
      const ordered = [...images, ...others]
      const pathOf: Record<string, string> = {}
      let n = 0
      for (let i = 0; i < ordered.length; i++) {
        const it = ordered[i]
        if (it.media) {
          pathOf[it.key] = it.media.path
          if (it.media.sort !== i || (it.media.caption || '') !== it.caption.trim())
            await supabase.from('portfolio_media').update({ sort: i, caption: it.caption.trim() || null }).eq('id', it.media.id)
          continue
        }
        const f = it.file!; n++
        setBusy(`Качване ${n} / ${ordered.filter(x => x.file).length}…`)
        const key = uid()
        let path: string, thumb: string | null = null, mime = f.type || 'application/octet-stream', size = f.size
        if (it.image) {
          let big: Blob | null = null, small: Blob | null = null
          try { big = await resizeImage(f, 2000); small = await resizeImage(f, 640, 0.8) } catch { /* непознат формат (напр. HEIC) — качва се както е */ }
          if (big && small) {
            path = `${id}/${key}.jpg`; thumb = `${id}/${key}_t.jpg`; mime = 'image/jpeg'; size = big.size
            const a = await supabase.storage.from('portfolio').upload(path, big, { contentType: 'image/jpeg' }); if (a.error) throw a.error
            const b = await supabase.storage.from('portfolio').upload(thumb, small, { contentType: 'image/jpeg' }); if (b.error) throw b.error
          } else {
            const ext = (f.name.split('.').pop() || 'jpg').toLowerCase()
            path = `${id}/${key}.${ext}`
            const a = await supabase.storage.from('portfolio').upload(path, f, { contentType: mime }); if (a.error) throw a.error
          }
        } else {
          const ext = (f.name.split('.').pop() || 'bin').toLowerCase()
          path = `${id}/${key}-${slugName(f.name)}.${ext}`
          const a = await supabase.storage.from('portfolio').upload(path, f, { contentType: mime }); if (a.error) throw a.error
        }
        const { error } = await supabase.from('portfolio_media').insert({
          post_id: id, path, thumb_path: thumb, name: f.name, mime, size, caption: it.caption.trim() || null, sort: i,
        })
        if (error) throw error
        pathOf[it.key] = path
      }
      const coverPath = cover ? pathOf[cover] || null : null
      if ((post?.cover_path || null) !== coverPath) await supabase.from('portfolio_posts').update({ cover_path: coverPath }).eq('id', id)

      // Паралелки
      const prev = post?.classIds || []
      const want = kind === 'project' || kind === 'event' ? classIds : []
      const add = want.filter(c => !prev.includes(c)), del = prev.filter(c => !want.includes(c))
      if (del.length) await supabase.from('portfolio_post_classes').delete().eq('post_id', id).in('class_id', del)
      if (add.length) await supabase.from('portfolio_post_classes').insert(add.map(c => ({ post_id: id, class_id: c })))

      dirty.current = false
      onSaved(id, post ? 'Промените са записани.' : siteWant ? 'Публикувано и предложено за сайта.' : 'Публикувано в портфолиото.')
    } catch (e: any) {
      setErr(e?.message || 'Грешка при запис.')
    } finally { setBusy(null) }
  }

  const k = kindMeta(kind)
  const months = monthOptions()
  if (from && !months.some(o => o.v === from)) months.unshift({ v: from, l: from })
  if (to && !months.some(o => o.v === to)) months.push({ v: to, l: to })
  const inputCls = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-[#0f2240] focus:ring-4 focus:ring-[#0f2240]/10'
  const coverItem = images.find(i => i.key === cover)

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto panel-in"
      onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={e => { if (e.currentTarget === e.target) setOver(false) }}
      onDrop={e => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files) }}>
      <div className="max-w-6xl mx-auto my-0 md:my-6 bg-white md:rounded-3xl shadow-2xl overflow-hidden">
        {/* Горна лента */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-5 md:px-8 py-3.5 bg-white/95 backdrop-blur border-b border-slate-200">
          <PenLine size={18} className="text-[#0f2240]" />
          <span className="font-semibold text-slate-900">{post ? 'Редакция на публикация' : 'Нова публикация'}</span>
          <div className="ml-4 hidden sm:flex rounded-xl bg-slate-100 p-0.5 text-[13px]">
            {(['edit', 'preview'] as const).map(v => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 ${view === v ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                {v === 'edit' ? <><PenLine size={13} /> Писане</> : <><Eye size={13} /> Как ще изглежда</>}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {busy && <span className="text-[12px] text-slate-500 hidden sm:inline">{busy}</span>}
            <button type="button" onClick={tryClose} className="px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100">Откажи</button>
            <button type="button" onClick={save} disabled={!!busy}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium bg-[#0f2240] text-white hover:bg-[#1a3560] disabled:opacity-60 shadow-sm">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {post ? 'Запиши' : 'Публикувай'}
            </button>
          </div>
        </div>

        {err && <div className="mx-5 md:mx-8 mt-4 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800">{err}</div>}

        {view === 'preview' ? (
          <div className="px-6 md:px-16 py-10 max-w-3xl mx-auto">
            {coverItem?.preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverItem.preview} alt="" className="w-full max-h-[380px] object-cover rounded-2xl mb-6" />
            )}
            <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full border ${k.soft}`}><k.icon size={13} /> {k.label}</span>
            <h1 className="text-3xl font-semibold tracking-tight mt-3">{title || 'Заглавие'}</h1>
            <div className="mt-5 text-[16px] leading-relaxed text-slate-800">{body.trim() ? renderRich(body) : <p className="text-slate-400">Текстът ще се появи тук.</p>}</div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_380px]">
            {/* ЛЯВО — писане */}
            <div className="px-5 md:px-10 py-7 space-y-6 min-w-0">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2.5">Какво споделяш?</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {KINDS.map(x => {
                    const on = kind === x.key; const I = x.icon
                    return (
                      <button key={x.key} type="button" onClick={() => setKind(x.key)}
                        className={`relative text-left rounded-2xl p-3.5 border-2 transition-all ${on ? `border-transparent bg-gradient-to-br ${x.grad} text-white shadow-md` : 'border-slate-200 hover:border-slate-400 bg-white'}`}>
                        <I size={20} className={on ? 'text-white' : x.tone} />
                        <div className={`mt-2 text-sm font-semibold ${on ? 'text-white' : 'text-slate-900'}`}>{x.label}</div>
                        <div className={`text-[11.5px] leading-snug mt-0.5 ${on ? 'text-white/85' : 'text-slate-500'}`}>{x.hint}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <Grow value={title} onChange={setTitle} minRows={1} placeholder={kind === 'cabinet' ? 'Напр. „Сензорната стая на първия етаж“' : kind === 'project' ? 'Име на проекта' : kind === 'event' ? 'Напр. „Коледен концерт в 3 Б“' : 'Напр. „Табло с емоции за сутрешния кръг“'}
                className="text-2xl md:text-[28px] font-semibold tracking-tight text-slate-900 border-b-2 border-slate-200 focus:border-[#0f2240] pb-2 transition-colors" />

              <div>
                <div className="flex items-center gap-1 mb-2">
                  <button type="button" onClick={() => wrap('bold')} title="Удебелен" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"><Bold size={15} /></button>
                  <button type="button" onClick={() => wrap('h')} title="Подзаглавие" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"><Heading2 size={15} /></button>
                  <button type="button" onClick={() => wrap('list')} title="Списък" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"><List size={15} /></button>
                  <span className="ml-2 text-[11.5px] text-slate-400">Пиши свободно — всеки ред е абзац. Снимка можеш и да поставиш с Ctrl+V.</span>
                </div>
                <Grow taRef={bodyRef} value={body} onChange={setBody} minRows={9}
                  placeholder={kind === 'cabinet'
                    ? 'Разкажи за кабинета: за кого е, какво има в него, как протича един ден, кое е любимо на децата…'
                    : kind === 'event' ? 'Какво се случи, кои участваха, какво постигнахме…'
                    : kind === 'material' ? 'Какво е материалът, за кого е подходящ, как се използва…'
                    : 'Кратко представяне на проекта…'}
                  className="text-[16px] leading-relaxed text-slate-800 bg-slate-50/70 rounded-2xl px-5 py-4 border border-slate-200 focus:bg-white focus:border-[#0f2240]" />
              </div>

              {kind === 'event' && (
                <div className="max-w-xs">
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Дата на събитието</label>
                  <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className={inputCls} />
                </div>
              )}

              {kind === 'project' && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 space-y-4">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-800">Проектът</div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div><label className="block text-[12px] text-slate-600 mb-1">От месец</label>
                      <select value={from} onChange={e => { setFrom(e.target.value); if (to && e.target.value > to) setTo(e.target.value) }} className={inputCls}>
                        <option value="">—</option>
                        {months.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select></div>
                    <div><label className="block text-[12px] text-slate-600 mb-1">До месец</label>
                      <select value={to} onChange={e => setTo(e.target.value)} className={inputCls}>
                        <option value="">—</option>
                        {months.filter(o => !from || o.v >= from).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select></div>
                    <div className="flex rounded-xl bg-white border border-slate-300 p-0.5 text-[13px]">
                      {Object.entries(STATUS).map(([key, s]) => (
                        <button key={key} type="button" onClick={() => setStatus(key)}
                          className={`px-3 py-2 rounded-lg ${status === key ? 'bg-[#0f2240] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{s.label}</button>
                      ))}
                    </div>
                  </div>
                  {([['Идеи', ideas, setIdeas, 'Какво искаме да направим?'], ['Дейности', activities, setActivities, 'Стъпките — какво ще правим с децата'], ['Цели', goals, setGoals, 'Какво ще постигнем?']] as const).map(([l, v, set, ph]) => (
                    <div key={l}>
                      <label className="block text-[12px] font-medium text-slate-700 mb-1">{l}</label>
                      <Grow value={v} onChange={set} minRows={2} placeholder={ph}
                        className="text-sm bg-white rounded-xl px-3.5 py-2.5 border border-slate-300 focus:border-[#0f2240]" />
                    </div>
                  ))}
                </div>
              )}

              {(kind === 'project' || kind === 'event') && classes.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Паралелки / групи <span className="normal-case tracking-normal font-normal text-slate-400">— по желание</span></div>
                  <div className="flex flex-wrap gap-1.5">
                    {classes.map(c => {
                      const on = classIds.includes(c.id)
                      return <button key={c.id} type="button" onClick={() => setClassIds(p => on ? p.filter(x => x !== c.id) : [...p, c.id])}
                        className={`px-3 py-1.5 rounded-full text-[13px] border transition-colors ${on ? 'bg-[#0f2240] border-[#0f2240] text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500'}`}>{c.name}</button>
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ДЯСНО — снимки, файлове, сайт */}
            <aside className="bg-slate-50/80 border-t lg:border-t-0 lg:border-l border-slate-200 px-5 md:px-6 py-7 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Снимки {images.length > 0 && `· ${images.length}`}</span>
                  {images.length > 1 && <span className="text-[11px] text-slate-400 inline-flex items-center gap-1"><Star size={11} /> = корица</span>}
                </div>
                <button type="button" onClick={() => pickRef.current?.click()}
                  className={`w-full rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors ${over ? 'border-[#0f2240] bg-[#0f2240]/5' : 'border-slate-300 hover:border-[#0f2240] bg-white'}`}>
                  <ImagePlus size={28} className="mx-auto text-[#0f2240]" />
                  <div className="text-sm font-medium text-slate-800 mt-2">Пусни снимките тук</div>
                  <div className="text-[12px] text-slate-500">или натисни, за да ги избереш · смаляват се автоматично</div>
                </button>
                <input ref={pickRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
                {images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {images.map(it => (
                      <div key={it.key} className={`rounded-xl overflow-hidden bg-white border-2 ${it.key === cover ? 'border-amber-400' : 'border-transparent'}`}>
                        <div className="relative aspect-[4/3] bg-slate-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {it.preview && <img src={it.preview} alt="" className="w-full h-full object-cover" />}
                          <button type="button" onClick={() => setCoverKey(it.key)} title="Направи корица"
                            className={`absolute top-1.5 left-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow ${it.key === cover ? 'bg-amber-400 text-white' : 'bg-white/90 text-slate-500 hover:text-amber-500'}`}>
                            <Star size={14} fill={it.key === cover ? 'currentColor' : 'none'} /></button>
                          <button type="button" onClick={() => setItems(p => p.filter(x => x.key !== it.key))} title="Махни"
                            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 text-slate-500 hover:text-rose-600 flex items-center justify-center shadow"><Trash2 size={13} /></button>
                        </div>
                        <input value={it.caption} onChange={e => setItems(p => p.map(x => x.key === it.key ? { ...x, caption: e.target.value } : x))}
                          placeholder="Надпис…" className="w-full px-2 py-1.5 text-[12px] focus:outline-none" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Файлове <span className="normal-case tracking-normal font-normal text-slate-400">— разработки, листове, презентации</span></div>
                {others.map(it => (
                  <div key={it.key} className="flex items-center gap-2 px-3 py-2 mb-1.5 rounded-xl bg-white border border-slate-200">
                    <Paperclip size={14} className="text-slate-500 shrink-0" />
                    <span className="text-[13px] truncate flex-1">{it.media?.name || it.file?.name}</span>
                    <button type="button" onClick={() => setItems(p => p.filter(x => x.key !== it.key))} className="text-slate-400 hover:text-rose-600"><X size={14} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-[13px] text-slate-700 hover:border-[#0f2240]">
                  <Upload size={14} /> Прикачи файл
                </button>
                <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.txt" className="hidden" onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
              </div>

              <div className={`rounded-2xl border-2 p-4 transition-colors ${siteWant ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white'}`}>
                {post?.site_status === 'published' ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-800"><Globe size={16} /> Публикацията вече е на сайта.</div>
                ) : (<>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <span className={`relative inline-flex w-10 h-6 rounded-full shrink-0 transition-colors ${siteWant ? 'bg-sky-600' : 'bg-slate-300'}`}>
                      <input type="checkbox" checked={siteWant} onChange={e => setSiteWant(e.target.checked)} className="sr-only" />
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${siteWant ? 'left-[18px]' : 'left-0.5'}`} />
                    </span>
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Globe size={15} className="text-sky-700" /> Предложи за сайта</span>
                    </span>
                  </label>
                  {post?.site_status === 'declined' && post.site_reply && <p className="mt-2 text-[12px] text-slate-600">Отговор: {post.site_reply}</p>}
                  {siteWant && (
                    <div className="mt-4 space-y-3">
                      <label className={`flex items-start gap-2.5 p-3 rounded-xl cursor-pointer border ${consent ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-amber-300'}`}>
                        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-600" />
                        <span className="text-[12.5px] text-slate-800 leading-snug">
                          <ShieldCheck size={13} className="inline -mt-0.5 mr-1 text-emerald-700" />
                          Потвърждавам, че на снимките <b>няма разпознаваеми деца</b> или <b>има писмено съгласие</b> от родителите им.
                        </span>
                      </label>
                      <textarea value={siteNote} onChange={e => setSiteNote(e.target.value)} rows={2} placeholder="Бележка (по желание)"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-[13px] focus:outline-none focus:border-[#0f2240] resize-none" />
                    </div>
                  )}
                </>)}
              </div>
              <p className="text-[11px] text-slate-400">Ctrl+Enter — запис · Esc — затваряне</p>
            </aside>
          </div>
        )}
      </div>
      {over && <div className="fixed inset-0 z-[55] pointer-events-none flex items-center justify-center"><div className="px-6 py-4 rounded-2xl bg-[#0f2240] text-white text-lg shadow-2xl">Пусни, за да добавиш</div></div>}
    </div>
  )
}
