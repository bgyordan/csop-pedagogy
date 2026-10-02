'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, ArrowLeft, Upload, Star, Trash2, Pencil, Check, X, Images, ExternalLink, GripVertical, MessageSquare, CheckSquare } from 'lucide-react'
import { ACCENT, SITE_URL, Field, INPUT, Toast, Drawer, Spinner, useFlash, fmtDate, moveItem, shrinkImage, mediaPath } from './shared'
import type { Album, Photo } from './shared'

/* ═══════════════ ГАЛЕРИЯ ═══════════════ */
export default function GalleryManager({ initialAlbums, initialPhotos }: { initialAlbums: Album[]; initialPhotos: Photo[] }) {
  const supabase = createClient(); const router = useRouter()
  const { notice, flash } = useFlash()
  const [albums, setAlbums] = useState<Album[]>(() => [...initialAlbums].sort((a, b) => a.sort_order - b.sort_order))
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [openId, setOpenId] = useState<string | null>(null)
  // нов албум
  const [drawer, setDrawer] = useState(false); const [title, setTitle] = useState(''); const [evDate, setEvDate] = useState(''); const [busy, setBusy] = useState(false)
  // влачене
  const [dragAlbum, setDragAlbum] = useState<string | null>(null); const [dragPhoto, setDragPhoto] = useState<string | null>(null)
  const [dropFiles, setDropFiles] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  // редакция на албума
  const [editing, setEditing] = useState(false); const [eTitle, setETitle] = useState(''); const [eDate, setEDate] = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [captionFor, setCaptionFor] = useState<string | null>(null); const [caption, setCaption] = useState('')
  const [selecting, setSelecting] = useState(false); const [sel, setSel] = useState<Set<string>>(new Set())

  const album = albums.find((a) => a.id === openId) || null
  const albumPhotos = useMemo(() => photos.filter((p) => p.album_id === openId).sort((a, b) => a.sort_order - b.sort_order), [photos, openId])
  const countOf = (id: string) => photos.filter((p) => p.album_id === id).length

  /* ── албуми ── */
  async function createAlbum() {
    if (!title.trim()) { flash('Въведете заглавие на албума.', true); return }
    setBusy(true)
    // новият албум излиза най-отпред (сайтът подрежда по sort_order)
    const top = albums.reduce((m, a) => Math.min(m, a.sort_order ?? 0), 1) - 1
    const { data, error } = await supabase.from('gallery_albums').insert({ title: title.trim(), event_date: evDate || null, sort_order: top }).select('*').single()
    setBusy(false)
    if (error) { flash(error.message, true); return }
    setAlbums((p) => [data as Album, ...p]); setTitle(''); setEvDate(''); setDrawer(false); setOpenId((data as Album).id)
    flash('Албумът е създаден — сега качете снимките.'); router.refresh()
  }
  async function dropAlbum(targetId: string) {
    if (!dragAlbum || dragAlbum === targetId) return
    const from = albums.findIndex((a) => a.id === dragAlbum); const to = albums.findIndex((a) => a.id === targetId)
    const next = moveItem(albums, from, to).map((a, i) => ({ ...a, sort_order: i + 1 }))
    setAlbums(next)
    await Promise.all(next.map((a) => supabase.from('gallery_albums').update({ sort_order: a.sort_order }).eq('id', a.id)))
    router.refresh()
  }
  async function deleteAlbum(a: Album) {
    const own = photos.filter((p) => p.album_id === a.id)
    await supabase.from('gallery_photos').delete().eq('album_id', a.id)
    const { error } = await supabase.from('gallery_albums').delete().eq('id', a.id)
    if (error) { flash(error.message, true); return }
    const paths = own.map((p) => mediaPath(p.photo_url)).filter((x): x is string => !!x)
    if (paths.length) await supabase.storage.from('public-media').remove(paths)
    setAlbums((p) => p.filter((x) => x.id !== a.id)); setPhotos((p) => p.filter((x) => x.album_id !== a.id))
    setConfirmDel(null); setOpenId(null); flash('Албумът е изтрит.'); router.refresh()
  }
  async function saveAlbumMeta() {
    if (!album || !eTitle.trim()) return
    const patch = { title: eTitle.trim(), event_date: eDate || null }
    setAlbums((p) => p.map((a) => (a.id === album.id ? { ...a, ...patch } : a))); setEditing(false)
    const { error } = await supabase.from('gallery_albums').update(patch).eq('id', album.id)
    if (error) flash(error.message, true); else { flash('Запазено.'); router.refresh() }
  }
  async function setCover(url: string) {
    if (!album) return
    setAlbums((p) => p.map((a) => (a.id === album.id ? { ...a, cover_url: url } : a)))
    await supabase.from('gallery_albums').update({ cover_url: url }).eq('id', album.id); flash('Корицата е сменена.'); router.refresh()
  }

  /* ── снимки ── */
  async function upload(files: File[]) {
    if (!album) return
    const imgs = files.filter((f) => f.type.startsWith('image/')); if (!imgs.length) return
    const base = albumPhotos.reduce((m, p) => Math.max(m, p.sort_order || 0), 0)
    const added: Photo[] = []
    for (let i = 0; i < imgs.length; i++) {
      setProgress({ done: i, total: imgs.length })
      try {
        const blob = await shrinkImage(imgs[i])
        const ext = blob.type === 'image/png' ? 'png' : 'jpg'
        const path = `gallery/${album.id}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}.${ext}`
        const { error } = await supabase.storage.from('public-media').upload(path, blob, { contentType: blob.type || imgs[i].type }); if (error) throw error
        const url = supabase.storage.from('public-media').getPublicUrl(path).data.publicUrl
        const { data, error: e2 } = await supabase.from('gallery_photos').insert({ album_id: album.id, photo_url: url, sort_order: base + i + 1 }).select('*').single(); if (e2) throw e2
        added.push(data as Photo)
      } catch (e: unknown) { flash(`${imgs[i].name}: ${e instanceof Error ? e.message : 'грешка'}`, true) }
    }
    setProgress(null)
    setPhotos((p) => [...p, ...added])
    if (added.length && !album.cover_url) await setCover(added[0].photo_url)
    flash(`Качени ${added.length} снимки.`); router.refresh()
  }
  async function dropPhoto(targetId: string) {
    if (!dragPhoto || dragPhoto === targetId) return
    const from = albumPhotos.findIndex((p) => p.id === dragPhoto); const to = albumPhotos.findIndex((p) => p.id === targetId)
    const next = moveItem(albumPhotos, from, to).map((p, i) => ({ ...p, sort_order: i + 1 }))
    setPhotos((p) => [...p.filter((x) => x.album_id !== openId), ...next])
    await Promise.all(next.map((p) => supabase.from('gallery_photos').update({ sort_order: p.sort_order }).eq('id', p.id)))
    router.refresh()
  }
  async function deletePhotos(list: Photo[]) {
    const ids = list.map((p) => p.id)
    const { error } = await supabase.from('gallery_photos').delete().in('id', ids)
    if (error) { flash(error.message, true); return }
    const paths = list.map((p) => mediaPath(p.photo_url)).filter((x): x is string => !!x)
    if (paths.length) await supabase.storage.from('public-media').remove(paths)
    setPhotos((p) => p.filter((x) => !ids.includes(x.id))); setSel(new Set()); setSelecting(false); setConfirmDel(null)
    if (album && list.some((p) => p.photo_url === album.cover_url)) {
      const rest = albumPhotos.filter((p) => !ids.includes(p.id))
      const cover = rest[0]?.photo_url || null
      setAlbums((p) => p.map((a) => (a.id === album.id ? { ...a, cover_url: cover } : a)))
      await supabase.from('gallery_albums').update({ cover_url: cover }).eq('id', album.id)
    }
    flash(list.length === 1 ? 'Снимката е изтрита.' : `Изтрити ${list.length} снимки.`); router.refresh()
  }
  async function saveCaption(p: Photo) {
    const v = caption.trim() || null; setCaptionFor(null)
    setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, caption: v } : x)))
    await supabase.from('gallery_photos').update({ caption: v }).eq('id', p.id); router.refresh()
  }

  /* ═════ един албум ═════ */
  if (album) {
    return (
      <div
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropFiles(true) } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDropFiles(false) }}
        onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDropFiles(false); upload(Array.from(e.dataTransfer.files)) } }}>
        <Toast notice={notice} />
        <button onClick={() => { setOpenId(null); setEditing(false); setSelecting(false); setSel(new Set()) }} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"><ArrowLeft size={15} /> Всички албуми</button>

        <section className={`bg-white border rounded-2xl shadow-sm transition ${dropFiles ? 'border-emerald-400 ring-4 ring-emerald-100' : 'border-slate-200'}`}>
          <div className="px-5 pt-4 pb-4 border-b border-slate-100 flex items-start gap-3 flex-wrap">
            {editing ? (
              <div className="flex-1 min-w-[240px] flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]"><Field label="Заглавие"><input autoFocus value={eTitle} onChange={(e) => setETitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveAlbumMeta(); if (e.key === 'Escape') setEditing(false) }} className={INPUT} /></Field></div>
                <div><Field label="Дата"><input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} className={INPUT} /></Field></div>
                <button onClick={saveAlbumMeta} className="h-[42px] px-3 rounded-xl text-white" style={{ backgroundColor: ACCENT }}><Check size={16} /></button>
                <button onClick={() => setEditing(false)} className="h-[42px] px-3 rounded-xl border border-slate-200 text-slate-500"><X size={16} /></button>
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <button onClick={() => { setETitle(album.title); setEDate(album.event_date || ''); setEditing(true) }} className="group flex items-center gap-2 text-left" title="Промени заглавието и датата">
                  <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: ACCENT }}>{album.title}</h2>
                  <Pencil size={14} className="text-slate-300 group-hover:text-slate-500" />
                </button>
                <div className="text-slate-500 text-[12.5px] mt-0.5 flex items-center gap-2 flex-wrap">
                  {albumPhotos.length} снимки · {album.event_date ? fmtDate(album.event_date) : 'без дата'}
                  <a href={`${SITE_URL}/galeriya`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-700 hover:underline">виж галерията <ExternalLink size={12} /></a>
                </div>
              </div>
            )}
            {!editing && (
              <div className="flex items-center gap-2 flex-wrap">
                {albumPhotos.length > 1 && (
                  <button onClick={() => { setSelecting((v) => !v); setSel(new Set()) }} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] ${selecting ? 'border-slate-400 text-slate-800 bg-slate-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <CheckSquare size={14} /> {selecting ? 'Готово' : 'Избери няколко'}
                  </button>
                )}
                <label className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium cursor-pointer hover:opacity-90 ${progress ? 'pointer-events-none opacity-70' : ''}`} style={{ backgroundColor: ACCENT }}>
                  {progress ? <Spinner /> : <Upload size={15} />} {progress ? `${Math.min(progress.done + 1, progress.total)} от ${progress.total}…` : 'Качи снимки'}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { upload(Array.from(e.target.files || [])); e.currentTarget.value = '' }} />
                </label>
              </div>
            )}
          </div>

          {selecting && (
            <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap text-[12.5px] border-b border-slate-100" style={{ backgroundColor: '#eef2f8' }}>
              <span className="font-semibold" style={{ color: ACCENT }}>Избрани: {sel.size}</span>
              <button onClick={() => setSel(new Set(albumPhotos.map((p) => p.id)))} className="px-2 py-1 rounded-lg hover:bg-white text-slate-600">всички</button>
              <span className="flex-1" />
              {sel.size > 0 && (confirmDel === 'bulk' ? (
                <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-0.5">
                  <button onClick={() => deletePhotos(albumPhotos.filter((p) => sel.has(p.id)))} className="px-2 py-1 font-bold text-rose-700 hover:bg-rose-100 rounded">Изтрий {sel.size}</button>
                  <button onClick={() => setConfirmDel(null)} className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded">Отказ</button>
                </span>
              ) : <button onClick={() => setConfirmDel('bulk')} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50"><Trash2 size={13} /> Изтрий избраните</button>)}
            </div>
          )}

          <div className="p-5">
            {albumPhotos.length === 0 ? (
              <label className="w-full rounded-2xl border-2 border-dashed border-slate-200 py-14 flex flex-col items-center gap-2 text-slate-400 hover:border-slate-300 hover:text-slate-600 transition cursor-pointer">
                <Upload size={26} /><span className="text-[13.5px] font-medium">Пуснете снимките тук или ги изберете</span>
                <span className="text-[12px]">Може много наведнъж · снимките от телефон се смаляват автоматично</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { upload(Array.from(e.target.files || [])); e.currentTarget.value = '' }} />
              </label>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
                {albumPhotos.map((p) => {
                  const isCover = album.cover_url === p.photo_url; const checked = sel.has(p.id)
                  return (
                    <div key={p.id} className="flex flex-col">
                      <div draggable={!selecting} onDragStart={(e) => { setDragPhoto(p.id); e.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDragPhoto(null)}
                        onDragOver={(e) => { if (dragPhoto) e.preventDefault() }} onDrop={(e) => { if (dragPhoto) { e.preventDefault(); e.stopPropagation(); dropPhoto(p.id) } }}
                        onClick={() => { if (selecting) setSel((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n }) }}
                        className={`group relative rounded-xl overflow-hidden aspect-square border-2 ${checked ? '' : isCover ? 'border-amber-300' : 'border-transparent'} ${selecting ? 'cursor-pointer' : 'cursor-grab'} ${dragPhoto === p.id ? 'opacity-40' : ''}`}
                        style={checked ? { borderColor: ACCENT } : {}}>
                        <img src={p.photo_url} alt="" loading="lazy" className="w-full h-full object-cover pointer-events-none bg-slate-100" />
                        {isCover && <span className="absolute top-1.5 left-1.5 text-[10.5px] font-semibold bg-amber-400 text-white px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"><Star size={10} /> корица</span>}
                        {selecting ? (
                          <span className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 border-white shadow flex items-center justify-center ${checked ? 'text-white' : 'bg-black/20'}`} style={checked ? { backgroundColor: ACCENT } : {}}>{checked && <Check size={14} />}</span>
                        ) : (<>
                          <GripVertical size={16} className="absolute top-1.5 right-1.5 text-white drop-shadow opacity-0 group-hover:opacity-100" />
                          <div className="absolute inset-x-0 bottom-0 p-1.5 flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition bg-gradient-to-t from-black/50 to-transparent">
                            {!isCover && <button onClick={() => setCover(p.photo_url)} className="px-2 py-1 rounded-md bg-white/90 text-[11px] font-medium text-slate-700 hover:bg-white inline-flex items-center gap-1"><Star size={11} /> Корица</button>}
                            <button onClick={() => { setCaptionFor(p.id); setCaption(p.caption || '') }} title="Надпис под снимката" className="w-7 h-7 rounded-md bg-white/90 text-slate-600 hover:bg-white flex items-center justify-center"><MessageSquare size={13} /></button>
                            {confirmDel === p.id
                              ? <button onClick={() => deletePhotos([p])} className="px-2 h-7 rounded-md bg-rose-600 text-white text-[11px] font-semibold">Изтрий?</button>
                              : <button onClick={() => setConfirmDel(p.id)} title="Изтрий" className="w-7 h-7 rounded-md bg-white/90 text-rose-600 hover:bg-white flex items-center justify-center"><Trash2 size={13} /></button>}
                          </div>
                        </>)}
                      </div>
                      {captionFor === p.id ? (
                        <div className="flex gap-1 mt-1">
                          <input autoFocus value={caption} onChange={(e) => setCaption(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveCaption(p); if (e.key === 'Escape') setCaptionFor(null) }} placeholder="Надпис (по избор)" className="flex-1 min-w-0 text-[12px] border border-slate-300 rounded-md px-1.5 py-1 focus:outline-none focus:border-[#0f2240]" />
                          <button onClick={() => saveCaption(p)} className="p-1 rounded text-emerald-600 hover:bg-emerald-50"><Check size={14} /></button>
                        </div>
                      ) : p.caption ? <span className="text-[11.5px] text-slate-500 mt-1 truncate" title={p.caption}>{p.caption}</span> : null}
                    </div>
                  )
                })}
              </div>
            )}
            {albumPhotos.length > 0 && !selecting && <p className="text-[12px] text-slate-400 mt-4">Подредбата се сменя с влачене · нови снимки може да се пуснат направо тук.</p>}
          </div>
        </section>

        <div className="mt-6 flex justify-end">
          {confirmDel === 'album' ? (
            <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-xl p-1 text-[13px]">
              <span className="px-2 text-rose-700">Албумът и {albumPhotos.length} снимки ще изчезнат.</span>
              <button onClick={() => deleteAlbum(album)} className="px-3 py-1.5 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg">Изтрий</button>
              <button onClick={() => setConfirmDel(null)} className="px-3 py-1.5 text-slate-500 hover:bg-white rounded-lg">Отказ</button>
            </span>
          ) : <button onClick={() => setConfirmDel('album')} className="inline-flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-rose-600"><Trash2 size={14} /> Изтрий албума</button>}
        </div>
      </div>
    )
  }

  /* ═════ всички албуми ═════ */
  return (
    <div>
      <Toast notice={notice} />
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: ACCENT }}>Галерия</h2>
          <div className="text-slate-500 text-[12.5px] mt-0.5 flex items-center gap-2 flex-wrap">
            {albums.length} албума · {photos.length} снимки
            <a href={`${SITE_URL}/galeriya`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-700 hover:underline">виж на сайта <ExternalLink size={12} /></a>
          </div>
        </div>
        <button onClick={() => setDrawer(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90" style={{ backgroundColor: ACCENT }}><Plus size={15} /> Нов албум</button>
      </div>

      {albums.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-14 text-center">
          <Images size={30} className="text-slate-200 mx-auto mb-2.5" />
          <div className="text-slate-700 font-semibold text-[15px] mb-1">Няма албуми</div>
          <p className="text-sm text-slate-500 mb-4">Създайте първия албум.</p>
          <button onClick={() => setDrawer(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Нов албум</button>
        </div>
      ) : (<>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))' }}>
          {albums.map((a) => {
            const n = countOf(a.id)
            return (
              <div key={a.id} draggable onDragStart={() => setDragAlbum(a.id)} onDragEnd={() => setDragAlbum(null)}
                onDragOver={(e) => { if (dragAlbum) e.preventDefault() }} onDrop={(e) => { e.preventDefault(); dropAlbum(a.id); setDragAlbum(null) }}
                onClick={() => setOpenId(a.id)}
                className={`group rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition ${dragAlbum === a.id ? 'opacity-40' : ''}`}>
                <div className="aspect-[4/3] bg-gradient-to-br from-slate-200 to-slate-100 relative flex items-center justify-center">
                  {a.cover_url ? <img src={a.cover_url} alt="" loading="lazy" className="w-full h-full object-cover pointer-events-none" /> : <Images size={28} className="text-slate-300" />}
                  <span className="absolute bottom-2 right-2 text-[11px] bg-[#0f2240]/75 text-white px-2 py-0.5 rounded-full">{n} снимки</span>
                  {n === 0 && <span className="absolute top-2 left-2 text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">празен</span>}
                  <GripVertical size={16} className="absolute top-2 right-2 text-white drop-shadow opacity-0 group-hover:opacity-100" />
                </div>
                <div className="px-3 py-2.5">
                  <b className="text-[13.5px] font-medium text-slate-800 block truncate">{a.title}</b>
                  <span className="text-[11.5px] text-slate-400">{a.event_date ? fmtDate(a.event_date) : 'без дата'}</span>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[12px] text-slate-400 mt-4">Както са подредени тук, така излизат на сайта — влачете албум, за да го преместите.</p>
      </>)}

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Нов албум" width={420}
        footer={<>
          <button onClick={() => setDrawer(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Отказ</button>
          <button onClick={createAlbum} disabled={busy} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: ACCENT }}>{busy ? <Spinner /> : <Check size={15} />} Създай и качи снимки</button>
        </>}>
        <Field label="Заглавие"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createAlbum() }} placeholder="напр. Спортен празник 2026" className={INPUT} /></Field>
        <Field label="Дата на събитието (по избор)"><input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} className={INPUT} /></Field>
        <p className="text-[12px] text-slate-400">Новият албум излиза най-отпред в галерията.</p>
      </Drawer>
    </div>
  )
}
