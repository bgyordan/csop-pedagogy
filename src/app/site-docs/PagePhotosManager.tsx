'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, X, Star, ExternalLink, GripVertical, ImagePlus, Trash2, Search, Upload, Info, LayoutGrid, FolderOpen } from 'lucide-react'
import { ACCENT, SITE_URL, SITE_PAGES, Toast, useFlash, moveItem, pageLabel, Spinner } from './shared'
import type { Album, Photo, PageMode } from './shared'
import PhotoPicker, { useLibrary } from './PhotoPicker'

const MODE_TEXT: Record<PageMode, string> = {
  both: 'Първата снимка е заглавна — стои горе до заглавието. Всички снимки се показват и в лента по-надолу на страницата.',
  hero: 'Тук се показва само една снимка — заглавната, горе до заглавието.',
  band: 'Снимките се показват в лента в този раздел на страницата „Материална база“.',
}
const GROUPS = Array.from(new Set(SITE_PAGES.map((p) => p.group)))

/* ═══════════════ СНИМКИ ПО СТРАНИЦИ ═══════════════ */
export default function PagePhotosManager({ albums, photos, initialPages, startPage }: {
  albums: Album[]; photos: Photo[]; initialPages: Record<string, string[]>; startPage?: string
}) {
  const supabase = createClient(); const router = useRouter()
  const { notice, flash } = useFlash()
  const library = useLibrary()
  const [view, setView] = useState<'pages' | 'library'>('pages')
  const [pages, setPages] = useState<Record<string, string[]>>(initialPages || {})
  const [cur, setCur] = useState(startPage && SITE_PAGES.some((p) => p.key === startPage) ? startPage : SITE_PAGES[0].key)
  const [picker, setPicker] = useState(false)
  const [dragI, setDragI] = useState<number | null>(null)
  const [q, setQ] = useState(''); const [busyLib, setBusyLib] = useState<string | null>(null)

  const page = SITE_PAGES.find((p) => p.key === cur)!
  const list = pages[cur] || []

  async function save(next: Record<string, string[]>, msg?: string) {
    const prev = pages; setPages(next)
    const { error } = await supabase.from('site_settings').update({ value: next, updated_at: new Date().toISOString() }).eq('key', 'page_photos')
    if (error) { setPages(prev); flash('Не се запази: ' + error.message, true); return }
    if (msg) flash(msg)
    router.refresh()
  }
  const setList = (key: string, urls: string[], msg?: string) => {
    const next = { ...pages }; if (urls.length) next[key] = urls; else delete next[key]
    return save(next, msg)
  }

  // на кои страници е дадена снимка
  const usage = useMemo(() => {
    const m: Record<string, string[]> = {}
    Object.entries(pages).forEach(([k, urls]) => (urls || []).forEach((u) => { (m[u] ||= []).push(k) }))
    return m
  }, [pages])

  async function removeFromLibrary(name: string, url: string) {
    const on = usage[url] || []
    if (!confirm(on.length ? `Снимката е на: ${on.map(pageLabel).join(', ')}.\nДа се изтрие ли и да се махне оттам?` : `Изтриване на „${name}“?`)) return
    setBusyLib(name)
    try {
      await library.remove(name)
      if (on.length) {
        const next: Record<string, string[]> = {}
        Object.entries(pages).forEach(([k, urls]) => { const l = (urls || []).filter((u) => u !== url); if (l.length) next[k] = l })
        await save(next)
      }
      flash('Изтрита.')
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Грешка.', true) } finally { setBusyLib(null) }
  }

  const libShown = (library.items || []).filter((i) => !q.trim() || i.name.includes(q.trim().toLowerCase()))
  const heroOnly = page.mode === 'hero'

  return (
    <div>
      <Toast notice={notice} />
      {/* превключвател */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <div className="inline-flex bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
          {([['pages', 'По страници', LayoutGrid], ['library', 'Всички снимки', FolderOpen]] as const).map(([k, lbl, Icon]) => (
            <button key={k} onClick={() => setView(k)} className={`inline-flex items-center gap-1.5 text-[13px] px-3.5 py-1.5 rounded-lg ${view === k ? 'font-medium text-white' : 'text-slate-500 hover:text-slate-700'}`} style={view === k ? { backgroundColor: ACCENT } : {}}>
              <Icon size={14} /> {lbl}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-slate-500">{view === 'pages' ? 'Изберете страница и подредете снимките ѝ — както ги подредите, така излизат на сайта.' : 'Всички качени снимки за страниците и къде се използват.'}</p>
      </div>

      {view === 'pages' ? (
        <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-5">
          {/* страници */}
          <nav className="bg-white border border-slate-200 rounded-2xl shadow-sm p-2 self-start">
            {GROUPS.map((g) => (
              <div key={g} className="mb-1.5 last:mb-0">
                <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g}</div>
                {SITE_PAGES.filter((p) => p.group === g).map((p) => {
                  const n = (pages[p.key] || []).length; const on = cur === p.key; const first = pages[p.key]?.[0]
                  return (
                    <button key={p.key} onClick={() => setCur(p.key)}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition ${on ? 'text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                      style={on ? { backgroundColor: ACCENT } : {}}>
                      <span className={`w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center ${first ? '' : on ? 'bg-white/10' : 'bg-slate-100'}`}>
                        {first ? <img src={first} alt="" className="w-full h-full object-cover" /> : <ImagePlus size={14} className={on ? 'text-white/60' : 'text-slate-300'} />}
                      </span>
                      <span className="flex-1 min-w-0 text-[13px] truncate">{p.label}</span>
                      <span className={`text-[11px] min-w-[20px] h-[20px] px-1.5 rounded-full leading-[20px] text-center ${on ? 'bg-white/20' : n ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{n}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>

          {/* избраната страница */}
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm min-w-0">
            <div className="px-5 pt-4 pb-4 border-b border-slate-100 flex items-start gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-semibold tracking-tight" style={{ color: ACCENT }}>{pageLabel(page.key)}</h2>
                <a href={SITE_URL + page.path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-sky-700 hover:underline mt-0.5">
                  csop-varna.bg{page.path} <ExternalLink size={12} />
                </a>
              </div>
              <button onClick={() => setPicker(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90" style={{ backgroundColor: ACCENT }}>
                <Plus size={15} /> {heroOnly && list.length ? 'Смени снимката' : 'Добави снимки'}
              </button>
              <p className="basis-full flex gap-2 text-[12.5px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                <Info size={15} className="shrink-0 mt-px text-slate-400" /> {MODE_TEXT[page.mode]}
              </p>
            </div>

            {/* как изглежда горе на страницата */}
            {page.mode !== 'band' && (
              <div className="px-5 pt-5">
                <div className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Горе на страницата</div>
                <div className="rounded-2xl bg-sky-50/70 border border-sky-100 p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="text-[11px] text-slate-400">Начало / {page.group}</div>
                    <div className="text-[19px] font-semibold leading-tight" style={{ color: ACCENT }}>{page.label}</div>
                    <div className="h-2 rounded bg-slate-200/70 w-11/12" /><div className="h-2 rounded bg-slate-200/70 w-3/4" />
                  </div>
                  <div className="w-[38%] max-w-[220px] aspect-[4/3] rounded-2xl overflow-hidden bg-white border border-sky-100 flex items-center justify-center shrink-0">
                    {list[0] ? <img src={list[0]} alt="" className="w-full h-full object-cover" /> : <span className="text-[11.5px] text-slate-400 text-center px-2">без заглавна снимка</span>}
                  </div>
                </div>
              </div>
            )}

            {/* подредба */}
            <div className="p-5">
              <div className="flex items-baseline gap-2 mb-2.5">
                <div className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{page.mode === 'hero' ? 'Снимка' : 'Снимки на страницата'}</div>
                {list.length > 1 && <span className="text-[11.5px] text-slate-400">· влачете, за да смените реда</span>}
              </div>
              {heroOnly && list.length > 1 && (
                <p className="mb-3 text-[12.5px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">На тази страница се вижда само първата снимка. Останалите не се показват — махнете ги или ги преместете първи.</p>
              )}
              {list.length === 0 ? (
                <button onClick={() => setPicker(true)} className="w-full rounded-2xl border-2 border-dashed border-slate-200 py-12 flex flex-col items-center gap-2 text-slate-400 hover:border-slate-300 hover:text-slate-600 transition">
                  <ImagePlus size={26} /><span className="text-[13px]">Няма снимки — добавете от библиотеката, галерията или нови от компютъра</span>
                </button>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
                  {list.map((u, i) => {
                    const lead = i === 0 && page.mode !== 'band'; const hidden = heroOnly && i > 0
                    return (
                      <div key={u} draggable
                        onDragStart={() => setDragI(i)} onDragEnd={() => setDragI(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); if (dragI !== null && dragI !== i) setList(cur, moveItem(list, dragI, i)); setDragI(null) }}
                        className={`group relative rounded-xl overflow-hidden aspect-[4/3] border bg-slate-50 cursor-grab ${lead ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'} ${dragI === i ? 'opacity-40' : ''} ${hidden ? 'opacity-50' : ''}`}>
                        <img src={u} alt="" className="w-full h-full object-cover pointer-events-none" />
                        <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md bg-white/90 text-slate-700">
                          {lead ? <><Star size={10} className="text-amber-500" /> Заглавна</> : i + 1}
                        </span>
                        <GripVertical size={16} className="absolute top-1.5 right-1.5 text-white drop-shadow opacity-0 group-hover:opacity-100" />
                        <div className="absolute inset-x-0 bottom-0 p-1.5 flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition bg-gradient-to-t from-black/50 to-transparent">
                          {i > 0 && page.mode !== 'band' && (
                            <button onClick={() => setList(cur, moveItem(list, i, 0), 'Сложена като заглавна.')} className="px-2 py-1 rounded-md bg-white/90 text-[11px] font-medium text-slate-700 hover:bg-white inline-flex items-center gap-1"><Star size={11} /> Заглавна</button>
                          )}
                          <button onClick={() => setList(cur, list.filter((x) => x !== u), 'Махната от страницата.')} title="Махни от страницата" className="w-7 h-7 rounded-md bg-white/90 text-slate-600 hover:text-rose-600 hover:bg-white flex items-center justify-center"><X size={14} /></button>
                        </div>
                      </div>
                    )
                  })}
                  {!heroOnly && (
                    <button onClick={() => setPicker(true)} className="rounded-xl aspect-[4/3] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-slate-300 hover:text-slate-600 transition">
                      <Plus size={20} /><span className="text-[12px]">Добави</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        /* ═════ библиотека ═════ */
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търси по име…" className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[13px] bg-slate-50 focus:outline-none focus:bg-white focus:border-slate-400" />
            </div>
            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium cursor-pointer hover:opacity-90" style={{ backgroundColor: ACCENT }}>
              {busyLib === '__up' ? <Spinner /> : <Upload size={15} />} Качи снимки
              <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                const files = Array.from(e.target.files || []); e.currentTarget.value = ''; if (!files.length) return
                setBusyLib('__up'); try { await library.upload(files); flash(`Качени ${files.length} снимки.`) } catch (er: unknown) { flash(er instanceof Error ? er.message : 'Грешка.', true) } finally { setBusyLib(null) }
              }} />
            </label>
          </div>
          {library.items === null ? (
            <div className="flex justify-center py-16 text-slate-400"><Spinner size={20} /></div>
          ) : libShown.length === 0 ? (
            <p className="text-center py-16 text-sm text-slate-500">{library.items.length ? 'Няма съвпадение.' : 'Още няма качени снимки.'}</p>
          ) : (
            <div className="p-5 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
              {libShown.map((it) => {
                const on = usage[it.url] || []
                return (
                  <div key={it.name} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <a href={it.url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] bg-slate-50"><img src={it.url} alt="" loading="lazy" className="w-full h-full object-cover" /></a>
                    <div className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className="flex-1 text-[12.5px] text-slate-700 truncate" title={it.name}>{it.name}</span>
                        <button onClick={() => removeFromLibrary(it.name, it.url)} disabled={busyLib === it.name} title="Изтрий" className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50">{busyLib === it.name ? <Spinner size={13} /> : <Trash2 size={14} />}</button>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {on.length ? on.map((k) => (
                          <button key={k} onClick={() => { setCur(k); setView('pages') }} className="text-[11px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100">{pageLabel(k)}</button>
                        )) : <span className="text-[11px] text-slate-400">не е на страница</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      <PhotoPicker open={picker} onClose={() => setPicker(false)} albums={albums} photos={photos} library={library}
        title={`Снимки за „${pageLabel(page.key)}“`} max={heroOnly ? 1 : undefined} taken={list}
        onDone={(urls) => {
          if (heroOnly) { setList(cur, [urls[0]], 'Снимката е сменена.'); return }
          const add = urls.filter((u) => !list.includes(u))
          if (add.length) setList(cur, [...list, ...add], `Добавени ${add.length} снимки.`)
        }} />
    </div>
  )
}
