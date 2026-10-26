'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  X, Pencil, Trash2, Globe, ChevronLeft, ChevronRight, Download, Eye, Paperclip, CalendarDays, Loader2,
  Newspaper, CheckCircle2, Ban, ExternalLink, ShieldCheck, Lock, Share2, Lightbulb, ListChecks, Target, CalendarClock, MapPin, Star,
} from 'lucide-react'
import { renderRich } from '@/app/site-docs/shared'
import { DocViewer } from '@/components/registry/DocViewer'
import { Avatar, coverThumb } from './PostCard'
import { kindMeta, fmtDate, fmtPeriod, STATUS, SITE, isImage, isVideo, isDrive, videoSrc, trashVideos, plain, resizeImage, isDraft, keyDates, nextKeyDate, todayYmd, relDays, dateTone } from './lib'
import type { Post, Person, Media } from './lib'
import { notify, confirmDialog } from '@/components/ui/Toast'

const NEWS_CAT: Record<string, string> = { event: 'Събития', project: 'Новини', cabinet: 'Публикации', material: 'Публикации' }

/** Колко снимки се показват веднага в галерията; останалите — с „покажи всички“ */
const GALLERY_MAX = 15

export default function PostReader({ post, author, thumbs, classNames, canEdit, canDelete, siteDesk, meId, onClose, onEdit, onDeleted, onChanged }: {
  post: Post; author?: Person; thumbs: Record<string, string>; classNames: Record<string, string>
  canEdit: boolean; canDelete: boolean; siteDesk: boolean; meId: string
  onClose: () => void; onEdit: () => void; onDeleted: () => void; onChanged: (msg: string) => void
}) {
  const supabase = createClient()
  const k = kindMeta(post.kind); const Icon = k.icon
  const images = post.media.filter(isImage)
  const videos = post.media.filter(m => isVideo(m))
  const files = post.media.filter(m => !isImage(m) && !isVideo(m))
  const [full, setFull] = useState<Record<string, string>>({})
  const [box, setBox] = useState<number | null>(null)
  /** Коя снимка е голяма в панела вдясно (по подразбиране корицата) */
  const [sel, setSel] = useState(() => Math.max(0, images.findIndex(m => m.path === post.cover_path)))
  const [allPhotos, setAllPhotos] = useState(false)
  const [viewFile, setViewFile] = useState<Media | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [declining, setDeclining] = useState(false); const [reply, setReply] = useState('')
  const site = SITE[post.site_status]
  const draft = isDraft(post)
  const today = todayYmd()
  const allDates = keyDates(post).filter(d => !d.main)
  const next = nextKeyDate(post, today)
  const cls = post.classIds.map(id => classNames[id]).filter(Boolean)

  useEffect(() => {
    if (!images.length) return
    supabase.storage.from('portfolio').createSignedUrls(images.map(m => m.path), 3600).then(({ data }) => {
      const map: Record<string, string> = {}
      ;(data || []).forEach((d: any) => { if (d.signedUrl && d.path) map[d.path] = d.signedUrl })
      setFull(map)
    })
  }, [post.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => { if (box !== null) setBox(null); else if (!viewFile) onClose() }, [box, viewFile, onClose])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (box !== null && e.key === 'ArrowRight') setBox(b => b === null ? b : (b + 1) % images.length)
      if (box !== null && e.key === 'ArrowLeft') setBox(b => b === null ? b : (b - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, box, images.length])

  // при разглеждане на цял екран — запомни докъде си стигнал
  useEffect(() => { if (box !== null) setSel(box) }, [box])

  const shown = images[sel] || images[0]
  const shownSrc = shown ? (full[shown.path] || (shown.thumb_path ? thumbs[shown.thumb_path] : undefined) || coverThumb(post, thumbs)) : undefined

  async function download(m: Media) {
    const { data } = await supabase.storage.from('portfolio').download(m.path)
    if (!data) return
    const a = document.createElement('a'); a.href = URL.createObjectURL(data)
    a.download = m.name || 'file'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  async function remove() {
    if (!await confirmDialog('Да изтрия ли публикацията заедно със снимките?')) return
    setBusy('del')
    const paths = post.media.flatMap(m => [m.path, m.thumb_path].filter(x => x && !isDrive(x)) as string[])
    if (paths.length) await supabase.storage.from('portfolio').remove(paths)
    await trashVideos(post.media.map(m => m.path))
    const { error } = await supabase.from('portfolio_posts').delete().eq('id', post.id)
    setBusy(null)
    if (error) { notify(error.message); return }
    onDeleted()
  }

  async function toggleShare() {
    setBusy('share')
    const patch: Record<string, unknown> = { is_shared: draft }
    if (!draft && post.site_status === 'requested') patch.site_status = 'none'
    const { error } = await supabase.from('portfolio_posts').update(patch).eq('id', post.id)
    setBusy(null)
    if (error) { notify(error.message); return }
    onChanged(draft ? 'Споделено с колегите.' : 'Вече го виждаш само ти.')
  }

  async function setSite(status: 'published' | 'declined' | 'requested', news?: string, msg?: string) {
    setBusy(status)
    const { error } = await supabase.rpc('portfolio_set_site_status', { p_post: post.id, p_status: status, p_news: news || null, p_reply: reply.trim() || null })
    setBusy(null)
    if (error) { notify(error.message); return }
    onChanged(msg || 'Готово.')
  }

  // Чернова на новина в „Сайт → Новини“: текстът + снимките (копират се в публичното хранилище)
  async function makeNews() {
    setBusy('news')
    try {
      const urls: string[] = []
      for (const m of images) {
        const { data } = await supabase.storage.from('portfolio').download(m.path)
        if (!data) continue
        const blob = await resizeImage(data, 2000).catch(() => data)
        const path = `news/gallery/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error } = await supabase.storage.from('public-media').upload(path, blob, { contentType: 'image/jpeg' })
        if (error) throw error
        urls.push(supabase.storage.from('public-media').getPublicUrl(path).data.publicUrl)
      }
      const coverIdx = Math.max(0, images.findIndex(m => m.path === post.cover_path))
      const extra = ([['Идеи', post.ideas], ['Дейности', post.activities], ['Цели', post.goals]] as [string, string | null][])
        .filter(([, v]) => v?.trim()).map(([h, v]) => `## ${h}\n${v!.trim()}`).join('\n')
      const content = [post.body?.trim(), extra, author ? `**Автор:** ${author.name}${author.label ? ', ' + author.label.toLowerCase() : ''}` : ''].filter(Boolean).join('\n')
      const { data: news, error } = await supabase.from('site_news').insert({
        title: post.title, excerpt: plain(post.body || post.ideas, 200) || null, content: content || null,
        category: NEWS_CAT[post.kind] || 'Новини', cover_url: urls[coverIdx] || null, gallery_images: urls,
        status: 'draft', published_at: null, author_id: meId,
      }).select('id').single()
      if (error) throw error
      await supabase.rpc('portfolio_set_site_status', { p_post: post.id, p_status: 'requested', p_news: news!.id, p_reply: null })
      onChanged('Черновата е в „Сайт → Новини“ — прегледай я и я публикувай.')
    } catch (e: any) { notify(e?.message || 'Грешка') } finally { setBusy(null) }
  }

  const projectBlocks = ([['Идеи', post.ideas, Lightbulb], ['Дейности', post.activities, ListChecks], ['Цели', post.goals, Target]] as const)
    .filter(([, v]) => v?.trim())

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto panel-in" onClick={onClose}>
      <article className="relative max-w-5xl mx-auto my-0 md:my-8 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onClose} title="Затвори (Esc)"
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-slate-700"><X size={18} /></button>

        {/* Горе: текст вляво, снимки вдясно (на телефон — снимките отгоре) */}
        <div className={`px-5 md:px-8 pt-14 md:pt-8 pb-2 ${images.length ? 'md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,400px)] md:gap-8' : ''}`}>
          {images.length > 0 && (
            <div className="md:order-2 md:sticky md:top-6 self-start mb-6 md:mb-0">
              <button type="button" onClick={() => setBox(sel)} title="Цял екран"
                className="group block w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {shownSrc && <img src={shownSrc} alt={shown?.caption || ''} className="w-full h-full object-contain" />}
              </button>
              {shown?.caption && <p className="mt-1.5 text-[12.5px] text-slate-500 leading-snug">{shown.caption}</p>}
              {images.length > 1 && (
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {(allPhotos ? images : images.slice(0, GALLERY_MAX)).map((m, i) => (
                    <button key={m.id} type="button" onClick={() => setSel(i)} title={m.caption || `Снимка ${i + 1}`}
                      className={`aspect-square rounded-lg overflow-hidden bg-slate-100 transition-all ${i === sel ? 'ring-2 ring-[#0f2240] ring-offset-1' : 'opacity-75 hover:opacity-100'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={(m.thumb_path && thumbs[m.thumb_path]) || full[m.path]} alt="" loading="lazy" className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {!allPhotos && images.length > GALLERY_MAX && (
                    <button type="button" onClick={() => setAllPhotos(true)}
                      className="aspect-square rounded-lg border border-dashed border-slate-300 text-slate-600 hover:border-[#0f2240] hover:text-[#0f2240] text-[13px] flex items-center justify-center">
                      +{images.length - GALLERY_MAX}
                    </button>
                  )}
                </div>
              )}
              <p className="mt-1.5 text-[11.5px] text-slate-400">{images.length > 1 ? `${sel + 1} от ${images.length} · ` : ''}клик върху снимката — на цял екран</p>
            </div>
          )}

          <div className="md:order-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full border ${k.soft}`}><Icon size={13} /> {k.label}</span>
              {post.kind === 'project' && post.status && STATUS[post.status] && <span className={`text-[12px] px-2.5 py-1 rounded-full ${STATUS[post.status].cls}`}>{STATUS[post.status].label}</span>}
              {next && <span className={`inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-full ${dateTone(next.date, today).tile}`}><CalendarClock size={12} /> {next.main ? 'Събитието е' : next.title + ' —'} {relDays(next.date, today)}</span>}
              {draft && <span className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-full bg-slate-700 text-white"><Lock size={12} /> Само за мен</span>}
              {!draft && site && <span className={`inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-full ${site.cls}`}><Globe size={12} /> {site.label}</span>}
            </div>
            <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight text-slate-900 leading-tight">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-4 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2"><Avatar name={author?.name || 'ЦСОП'} size={30} />
                <span><span className="text-slate-800 font-medium">{author?.name || 'ЦСОП'}</span>{author?.label ? <span className="block text-[12px]">{author.label}</span> : null}</span></span>
              <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> {fmtDate(post.event_date || post.created_at)}</span>
              {post.kind === 'project' && (post.period_from || post.period_to) && <span>· {fmtPeriod(post.period_from, post.period_to)}</span>}
              {cls.length > 0 && <span>· {cls.join(', ')}</span>}
            </div>
            {post.body?.trim() && <div className="mt-5 text-[15.5px] leading-relaxed text-slate-800">{renderRich(post.body)}</div>}
          </div>
        </div>

        <div className="px-5 md:px-8 pb-8">
          {projectBlocks.length > 0 && (
            <div className={`mt-6 grid gap-3 ${projectBlocks.length === 3 ? 'md:grid-cols-3' : projectBlocks.length === 2 ? 'md:grid-cols-2' : ''}`}>
              {projectBlocks.map(([h, v, I]) => (
                <div key={h} className="rounded-2xl bg-amber-50/60 border border-amber-200/70 p-4">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-amber-800 mb-1.5"><I size={14} /> {h}</div>
                  <div className="text-[14px] text-slate-800 whitespace-pre-line leading-relaxed">{v}</div>
                </div>
              ))}
            </div>
          )}

          {allDates.length > 0 && (
            <div className="mt-8">
              <h2 className="text-[12px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Дати и събития</h2>
              <div className="space-y-2">
                {allDates.map(d => {
                  const past = d.date < today
                  const t = dateTone(d.date, today)
                  const dt = new Date(d.date + 'T00:00')
                  return (
                    <div key={d.id} className={`flex items-start gap-3 px-4 py-3 rounded-2xl border ${past ? 'border-slate-200 bg-slate-50/60 opacity-75' : d.highlight ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'}`}>
                      <div className={`shrink-0 w-12 h-14 rounded-xl flex flex-col items-center justify-center leading-none ${past ? 'bg-slate-200 text-slate-600' : d.highlight ? t.tile : 'bg-slate-100 text-slate-700'}`}>
                        <span className="text-[18px] font-bold">{dt.getDate()}</span>
                        <span className="text-[10px] uppercase mt-1">{dt.toLocaleDateString('bg-BG', { month: 'short' }).replace('.', '')}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14.5px] font-semibold text-slate-900">{d.title}</span>
                          {d.highlight && !past && <span className="inline-flex items-center gap-1 text-[11px] text-rose-700"><Star size={11} className="fill-rose-600 text-rose-600" /> Акцент</span>}
                        </div>
                        <div className="text-[12.5px] text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                          <span>{fmtDate(d.date)} · {relDays(d.date, today)}</span>
                          {d.time && <span>· {d.time}</span>}
                          {d.place && <span className="inline-flex items-center gap-0.5">· <MapPin size={12} /> {d.place}</span>}
                        </div>
                        {d.note && <div className="text-[13px] text-slate-700 mt-1">{d.note}</div>}
                      </div>
                      {!past && (
                        <a href={`/calendar?view=week&date=${d.date}`} title="Отвори седмицата в календара"
                          className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-[#0f2240] hover:bg-slate-100"><CalendarDays size={16} /></a>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {videos.length > 0 && (
            <div className="mt-8">
              <h2 className="text-[12px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Видео</h2>
              <div className="space-y-5">
                {videos.map(m => (
                  <figure key={m.id}>
                    <video controls playsInline preload="metadata" src={videoSrc(m)} className="w-full max-h-[70vh] rounded-2xl bg-black" />
                    {m.caption && <figcaption className="mt-1.5 text-[13px] text-slate-600">{m.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </div>
          )}

          {files.length > 0 && (
            <div className="mt-8">
              <h2 className="text-[12px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Файлове</h2>
              <div className="space-y-2">
                {files.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-400 transition-colors">
                    <Paperclip size={16} className="text-[#0f2240] shrink-0" />
                    <span className="text-sm text-slate-800 truncate flex-1">{m.name || 'Файл'}</span>
                    <button type="button" onClick={() => setViewFile(m)} title="Преглед" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"><Eye size={16} /></button>
                    <button type="button" onClick={() => download(m)} title="Изтегли" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"><Download size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* За сайта — бележка от автора и действия за деловодителя/управата */}
          {post.site_status !== 'none' && !draft && (
            <div className="mt-8 rounded-2xl border border-sky-200 bg-sky-50/60 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-900"><Globe size={16} /> За сайта на ЦСОП</div>
              {post.site_consent && <div className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-emerald-800"><ShieldCheck size={14} /> Авторът потвърди: няма разпознаваеми деца или има съгласие на родителите.</div>}
              {post.site_note && <p className="mt-2 text-[13.5px] text-slate-700"><span className="text-slate-500">Бележка:</span> {post.site_note}</p>}
              {post.site_status === 'declined' && post.site_reply && <p className="mt-2 text-[13.5px] text-slate-700"><span className="text-slate-500">Отговор:</span> {post.site_reply}</p>}
              {siteDesk && post.site_status === 'requested' && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {post.site_news_id ? (
                    <a href={`/site-docs#news:${post.site_news_id}`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[#0f2240] text-white hover:bg-[#1a3560]">
                      <ExternalLink size={14} /> Отвори черновата в „Сайт“
                    </a>
                  ) : (
                    <button type="button" onClick={makeNews} disabled={!!busy}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[#0f2240] text-white hover:bg-[#1a3560] disabled:opacity-60">
                      {busy === 'news' ? <Loader2 size={14} className="animate-spin" /> : <Newspaper size={14} />} Направи чернова на новина
                    </button>
                  )}
                  <button type="button" onClick={() => setSite('published', undefined, 'Отбелязана като публикувана на сайта.')} disabled={!!busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-50">
                    <CheckCircle2 size={14} /> Публикувана е
                  </button>
                  <button type="button" onClick={() => setDeclining(d => !d)} disabled={!!busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border border-slate-300 text-slate-700 bg-white hover:bg-slate-50">
                    <Ban size={14} /> Не е за сайта
                  </button>
                  {declining && (
                    <div className="w-full flex gap-2 mt-1">
                      <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Кратко защо (по желание)"
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0f2240]" />
                      <button type="button" onClick={() => setSite('declined', undefined, 'Върната на автора.')} className="px-4 py-2 rounded-xl text-sm bg-slate-700 text-white">Потвърди</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(canEdit || canDelete) && (
            <div className="mt-10 pt-5 border-t border-slate-200 flex items-center gap-2">
              {canEdit && (
                <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[#0f2240] text-white hover:bg-[#1a3560]">
                  <Pencil size={14} /> Редактирай
                </button>
              )}
              {canEdit && (
                <button type="button" onClick={toggleShare} disabled={!!busy}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${draft ? 'border-[#0f2240] text-[#0f2240] bg-white hover:bg-slate-50' : 'border-slate-300 text-slate-700 bg-white hover:border-[#0f2240]'}`}>
                  {draft ? <><Share2 size={14} /> Сподели с колегите</> : <><Lock size={14} /> Само за мен</>}
                </button>
              )}
              {canDelete && (
                <button type="button" onClick={remove} disabled={busy === 'del'} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-rose-700 hover:bg-rose-50">
                  {busy === 'del' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Изтрий
                </button>
              )}
            </div>
          )}
        </div>
      </article>

      {/* Снимка на цял екран */}
      {box !== null && images[box] && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col" onClick={e => { e.stopPropagation(); setBox(null) }}>
          <div className="flex items-center gap-2 p-3 text-white text-sm" onClick={e => e.stopPropagation()}>
            <span className="flex-1 truncate">{images[box].caption || post.title} <span className="text-white/60">· {box + 1} / {images.length}</span></span>
            <button type="button" onClick={() => download(images[box])} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25"><Download size={13} /> Изтегли</button>
            <button type="button" onClick={() => setBox(null)} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25"><X size={14} /> Затвори</button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center relative px-14 pb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={full[images[box].path] || (images[box].thumb_path ? thumbs[images[box].thumb_path!] : '')} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
            {images.length > 1 && (<>
              <button type="button" onClick={e => { e.stopPropagation(); setBox((box - 1 + images.length) % images.length) }} className="absolute left-3 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center"><ChevronLeft size={22} /></button>
              <button type="button" onClick={e => { e.stopPropagation(); setBox((box + 1) % images.length) }} className="absolute right-3 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center"><ChevronRight size={22} /></button>
            </>)}
          </div>
        </div>
      )}

      <div onClick={e => e.stopPropagation()}>
        <DocViewer file={viewFile ? { id: viewFile.path, name: viewFile.name || 'файл' } : null} onClose={() => setViewFile(null)}
          load={async (id) => { const { data, error } = await supabase.storage.from('portfolio').download(id); if (error || !data) throw new Error('Файлът не може да се отвори'); return data }}
          onDownload={() => viewFile && download(viewFile)} />
      </div>
    </div>
  )
}
