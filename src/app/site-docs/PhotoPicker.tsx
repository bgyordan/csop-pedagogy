'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Check, Images, FolderOpen, Newspaper, BookHeart, Search, ShieldCheck, ShieldAlert } from 'lucide-react'
import { ACCENT, Drawer, Spinner, shrinkImage, slugName } from './shared'
import type { Album, Photo } from './shared'
import { smartMatch } from '@/lib/search'

const LIB_DIR = 'site'
export type LibItem = { name: string; size: number; url: string }

/* Библиотека „Снимки за сайта“ (public-media/site/) — общо място за снимките по страниците */
export function useLibrary() {
  const supabase = createClient()
  const [items, setItems] = useState<LibItem[] | null>(null)
  const urlOf = useCallback((name: string) => supabase.storage.from('public-media').getPublicUrl(`${LIB_DIR}/${name}`).data.publicUrl, []) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(async () => {
    const { data } = await supabase.storage.from('public-media').list(LIB_DIR, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
    setItems((data || []).filter((f) => f.name && !f.name.startsWith('.')).map((f) => ({ name: f.name, size: (f.metadata as { size?: number } | null)?.size || 0, url: urlOf(f.name) })))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, [reload])

  // качва и връща адресите на качените снимки (по реда на избора)
  async function upload(files: File[], onProgress?: (done: number, total: number) => void): Promise<string[]> {
    const taken = new Set((items || []).map((i) => i.name)); const urls: string[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]; onProgress?.(i, files.length)
      const blob = await shrinkImage(f)
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : (f.name.split('.').pop() || 'jpg').toLowerCase()
      const base = slugName(f.name); let name = `${base}.${ext}`; let n = 2
      while (taken.has(name)) name = `${base}-${n++}.${ext}`
      taken.add(name)
      const { error } = await supabase.storage.from('public-media').upload(`${LIB_DIR}/${name}`, blob, { contentType: blob.type || f.type })
      if (error) throw error
      urls.push(urlOf(name))
    }
    onProgress?.(files.length, files.length)
    await reload()
    return urls
  }
  async function remove(name: string) {
    const { error } = await supabase.storage.from('public-media').remove([`${LIB_DIR}/${name}`])
    if (error) throw error
    setItems((p) => (p || []).filter((i) => i.name !== name))
  }
  return { items, reload, upload, remove }
}

/* ── източници ── */
type Source = 'library' | 'gallery' | 'news' | 'portfolio'
// Една снимка в избора. За портфолиото снимката е в частно хранилище → при „Избери“ се копира в „Снимки за сайта“.
type Item = { key: string; preview: string; url?: string; pf?: { path: string; name: string } }
type Group = { id: string; title: string; sub?: string; consent?: boolean; items: Item[] }

type NewsRow = { id: string; title: string; cover_url: string | null; gallery_images: string[] | null; published_at: string | null; created_at: string }
type PfPost = { id: string; title: string; site_consent: boolean; created_at: string; author: { first_name: string; last_name: string } | null }
type PfMedia = { id: string; post_id: string; path: string; thumb_path: string | null; name: string | null; mime: string | null }

const isImg = (m: PfMedia) => (m.mime ? m.mime.startsWith('image/') : /\.(jpe?g|png|webp|gif)$/i.test(m.path))
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

/* ═══════════════ Избор на снимки: снимки за сайта / галерия / новини / портфолио / качване ═══════════════ */
export default function PhotoPicker({
  open, onClose, onDone, albums, photos, library, max, title = 'Избери снимки', taken = [],
}: {
  open: boolean; onClose: () => void; onDone: (urls: string[]) => void
  albums: Album[]; photos: Photo[]; library: ReturnType<typeof useLibrary>
  max?: number; title?: string; taken?: string[]
}) {
  const supabase = createClient()
  const [source, setSource] = useState<Source>('library')
  const [picked, setPicked] = useState<Item[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [news, setNews] = useState<Group[] | null>(null)
  const [pf, setPf] = useState<Group[] | null>(null)
  const [onlyConsent, setOnlyConsent] = useState(true)

  useEffect(() => { if (open) { setPicked([]); setErr(null); setQ('') } }, [open])

  /* новините — зарежда се при първото отваряне на раздела */
  useEffect(() => {
    if (source !== 'news' || news) return
    supabase.from('site_news').select('id, title, cover_url, gallery_images, published_at, created_at').order('created_at', { ascending: false })
      .then(({ data }) => {
        const groups = ((data || []) as NewsRow[]).map((n) => {
          const urls = Array.from(new Set([n.cover_url, ...(Array.isArray(n.gallery_images) ? n.gallery_images : [])].filter((u): u is string => !!u)))
          return { id: n.id, title: n.title, sub: fmt(n.published_at || n.created_at), items: urls.map((u) => ({ key: u, preview: u, url: u })) }
        }).filter((g) => g.items.length)
        setNews(groups)
      })
  }, [source, news]) // eslint-disable-line react-hooks/exhaustive-deps

  /* портфолиото на колегите — само споделените публикации; миниатюрите са с временни адреси */
  useEffect(() => {
    if (source !== 'portfolio' || pf) return
    ;(async () => {
      const { data: posts } = await supabase.from('portfolio_posts')
        .select('id, title, site_consent, created_at, author:staff_profiles(first_name, last_name)')
        .eq('is_shared', true).order('created_at', { ascending: false })
      const list = (posts || []) as unknown as PfPost[]
      if (!list.length) { setPf([]); return }
      const { data: media } = await supabase.from('portfolio_media').select('id, post_id, path, thumb_path, name, mime')
        .in('post_id', list.map((p) => p.id)).order('sort', { ascending: true })
      const imgs = ((media || []) as PfMedia[]).filter(isImg)
      const thumbs = imgs.map((m) => m.thumb_path || m.path)
      const signed: Record<string, string> = {}
      for (let i = 0; i < thumbs.length; i += 100) {
        const { data } = await supabase.storage.from('portfolio').createSignedUrls(thumbs.slice(i, i + 100), 3600)
        ;(data || []).forEach((s) => { if (s.path && s.signedUrl) signed[s.path] = s.signedUrl })
      }
      setPf(list.map((p) => ({
        id: p.id, title: p.title, consent: p.site_consent,
        sub: [p.author ? `${p.author.first_name} ${p.author.last_name}` : '', fmt(p.created_at)].filter(Boolean).join(' · '),
        items: imgs.filter((m) => m.post_id === p.id && signed[m.thumb_path || m.path])
          .map((m) => ({ key: `pf:${m.id}`, preview: signed[m.thumb_path || m.path], pf: { path: m.path, name: m.name || p.title } })),
      })).filter((g) => g.items.length))
    })()
  }, [source, pf]) // eslint-disable-line react-hooks/exhaustive-deps

  const galleryGroups: Group[] = useMemo(() => albums
    .map((a) => ({ id: a.id, title: a.title, sub: fmt(a.event_date), items: photos.filter((p) => p.album_id === a.id).sort((x, y) => x.sort_order - y.sort_order).map((p) => ({ key: p.id, preview: p.photo_url, url: p.photo_url })) }))
    .filter((g) => g.items.length), [albums, photos])

  const raw: Group[] | null =
    source === 'library' ? (library.items ? [{ id: 'lib', title: '', items: library.items.map((i) => ({ key: i.name, preview: i.url, url: i.url })) }] : null)
    : source === 'gallery' ? galleryGroups
    : source === 'news' ? news
    : pf
  const hiddenNoConsent = source === 'portfolio' && onlyConsent ? (pf || []).filter((g) => !g.consent).length : 0
  const groups = (raw || [])
    .filter((g) => !(source === 'portfolio' && onlyConsent && !g.consent))
    .filter((g) => (q.trim() && source !== 'library' ? smartMatch(`${g.title} ${g.sub || ''}`, q) : true))

  function toggle(it: Item) {
    setPicked((p) => {
      if (p.some((x) => x.key === it.key)) return p.filter((x) => x.key !== it.key)
      if (max === 1) return [it]
      if (max && p.length >= max) return p
      return [...p, it]
    })
  }
  async function upload(files: File[]) {
    if (!files.length) return
    setErr(null)
    try {
      const urls = await library.upload(files, (done, total) => setProgress({ done, total, label: 'Качване' }))
      setSource('library')
      const items = urls.map((u) => ({ key: u.split('/').pop() || u, preview: u, url: u }))
      setPicked((p) => (max === 1 ? items.slice(-1) : [...p, ...items].slice(0, max || Infinity)))
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Грешка при качване.') } finally { setProgress(null) }
  }

  // „Избери“: снимките от портфолиото се копират в „Снимки за сайта“ (публични); останалите са готови адреси
  async function finish() {
    setErr(null)
    try {
      const out: string[] = []; const toCopy = picked.filter((p) => p.pf).length; let n = 0
      for (const it of picked) {
        if (it.url) { out.push(it.url); continue }
        setProgress({ done: n++, total: toCopy, label: 'Копиране от портфолиото' })
        const { data, error } = await supabase.storage.from('portfolio').download(it.pf!.path)
        if (error || !data) throw error || new Error('Снимката не може да се изтегли.')
        const file = new File([data], it.pf!.name.replace(/\.[^.]+$/, '') + '.jpg', { type: data.type || 'image/jpeg' })
        const [url] = await library.upload([file])
        out.push(url)
      }
      onDone(out); onClose()
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Грешка при копиране.') } finally { setProgress(null) }
  }

  const consentOf = (key: string) => !!(pf || []).find((g) => g.items.some((i) => i.key === key))?.consent
  const pickedNoConsent = picked.filter((p) => p.pf && !consentOf(p.key)).length

  const SRC: { id: Source; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'library', label: 'Снимки за сайта', icon: <FolderOpen size={13} />, count: library.items?.length },
    { id: 'gallery', label: 'Галерия', icon: <Images size={13} />, count: galleryGroups.reduce((s, g) => s + g.items.length, 0) },
    { id: 'news', label: 'От новините', icon: <Newspaper size={13} /> },
    { id: 'portfolio', label: 'Портфолио на колегите', icon: <BookHeart size={13} /> },
  ]

  return (
    <Drawer open={open} onClose={onClose} title={title} width={760}
      footer={<>
        <span className="text-[12.5px] text-slate-500 self-center mr-auto">
          {progress ? `${progress.label} ${Math.min(progress.done + 1, progress.total)} от ${progress.total}…`
            : picked.length ? `Избрани: ${picked.length}${max && max > 1 ? ` от ${max}` : ''}${pickedNoConsent ? ` · ${pickedNoConsent} без потвърдено съгласие` : ''}`
            : max === 1 ? 'Изберете една снимка' : 'Изберете една или няколко'}
        </span>
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Отказ</button>
        <button onClick={finish} disabled={!picked.length || !!progress}
          className="px-5 py-2.5 rounded-xl text-white text-sm font-medium flex items-center gap-2 disabled:opacity-40" style={{ backgroundColor: ACCENT }}>
          {progress ? <Spinner /> : <Check size={15} />} {max === 1 ? 'Избери' : `Добави${picked.length ? ` (${picked.length})` : ''}`}
        </button>
      </>}>
      {/* качване */}
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))) }}
        className={`flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3.5 cursor-pointer hover:border-slate-300 hover:bg-slate-50 transition ${progress ? 'pointer-events-none opacity-70' : ''}`}>
        <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">{progress ? <Spinner /> : <Upload size={17} />}</span>
        <span className="text-[13px] text-slate-600"><b className="font-medium text-slate-800">Качи нови снимки</b> — или ги пуснете тук. Снимките от телефон се смаляват автоматично.</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { upload(Array.from(e.target.files || [])); e.currentTarget.value = '' }} />
      </label>
      {err && <p className="text-[12.5px] text-rose-600">{err}</p>}

      {/* откъде */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {SRC.map((s) => (
          <button key={s.id} onClick={() => { setSource(s.id); setQ('') }}
            className={`shrink-0 inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-lg border ${source === s.id ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            style={source === s.id ? { backgroundColor: ACCENT } : {}}>
            {s.icon} {s.label}{s.count !== undefined ? ` (${s.count})` : ''}
          </button>
        ))}
      </div>

      {source !== 'library' && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={source === 'gallery' ? 'Търси албум…' : source === 'news' ? 'Търси новина…' : 'Търси публикация или колега…'}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-slate-400" />
          </div>
          {source === 'portfolio' && (
            <button type="button" onClick={() => setOnlyConsent((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-[12.5px] px-3 py-2 rounded-xl border ${onlyConsent ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600'}`}>
              <ShieldCheck size={14} /> {onlyConsent ? 'Само с потвърдено съгласие' : 'Всички публикации'}
            </button>
          )}
        </div>
      )}
      {source === 'portfolio' && (
        <p className="text-[12px] text-slate-500 -mt-1">
          Избраната снимка се копира в „Снимки за сайта“ и чак тогава става публична.
          {hiddenNoConsent > 0 && <> Скрити са {hiddenNoConsent} публикации, за които авторът не е потвърдил, че няма разпознаваеми деца или има съгласие на родителите.</>}
        </p>
      )}

      {raw === null ? (
        <div className="flex justify-center py-12 text-slate-400"><Spinner size={20} /></div>
      ) : groups.every((g) => !g.items.length) ? (
        <p className="text-center py-12 text-sm text-slate-500">
          {source === 'library' ? 'Тук още няма снимки — качете от бутона горе.' : q ? 'Нищо не съвпада с търсенето.' : source === 'portfolio' && onlyConsent ? 'Няма публикации с потвърдено съгласие — превключете на „Всички публикации“.' : 'Тук още няма снимки.'}
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.id}>
              {g.title && (
                <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                  <h4 className="text-[13px] font-semibold text-slate-800">{g.title}</h4>
                  {g.sub && <span className="text-[12px] text-slate-400">{g.sub}</span>}
                  {source === 'portfolio' && (g.consent
                    ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700"><ShieldCheck size={12} /> съгласие</span>
                    : <span className="inline-flex items-center gap-1 text-[11px] text-amber-700"><ShieldAlert size={12} /> без потвърждение</span>)}
                </div>
              )}
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))' }}>
                {g.items.map((it) => {
                  const i = picked.findIndex((x) => x.key === it.key); const on = i >= 0; const already = !!it.url && taken.includes(it.url)
                  return (
                    <button key={it.key} type="button" onClick={() => toggle(it)}
                      className={`relative rounded-xl overflow-hidden aspect-square border-2 transition ${on ? '' : 'border-transparent hover:border-slate-300'}`}
                      style={on ? { borderColor: ACCENT } : {}}>
                      <img src={it.preview} alt="" loading="lazy" className={`w-full h-full object-cover ${already && !on ? 'opacity-50' : ''}`} />
                      {on && <span className="absolute top-1.5 right-1.5 min-w-6 h-6 px-1 rounded-full flex items-center justify-center text-white text-[12px] font-semibold shadow" style={{ backgroundColor: ACCENT }}>{max === 1 ? <Check size={14} /> : i + 1}</span>}
                      {already && !on && <span className="absolute bottom-1.5 left-1.5 text-[10.5px] bg-white/90 text-slate-600 px-1.5 py-0.5 rounded-md">вече е тук</span>}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </Drawer>
  )
}
