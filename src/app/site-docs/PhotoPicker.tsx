'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Check, Images, FolderOpen } from 'lucide-react'
import { ACCENT, Drawer, Spinner, shrinkImage, slugName } from './shared'
import type { Album, Photo } from './shared'

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

/* ═══════════════ Избор на снимки: библиотека / галерия / качване ═══════════════ */
export default function PhotoPicker({
  open, onClose, onDone, albums, photos, library, max, title = 'Избери снимки', taken = [],
}: {
  open: boolean; onClose: () => void; onDone: (urls: string[]) => void
  albums: Album[]; photos: Photo[]; library: ReturnType<typeof useLibrary>
  max?: number; title?: string; taken?: string[]
}) {
  const [source, setSource] = useState<string>('library') // 'library' | album id
  const [picked, setPicked] = useState<string[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { if (open) { setPicked([]); setErr(null) } }, [open])

  const albumsWithPhotos = useMemo(() => albums.filter((a) => photos.some((p) => p.album_id === a.id)), [albums, photos])
  const grid: { key: string; url: string }[] = source === 'library'
    ? (library.items || []).map((i) => ({ key: i.name, url: i.url }))
    : photos.filter((p) => p.album_id === source).sort((a, b) => a.sort_order - b.sort_order).map((p) => ({ key: p.id, url: p.photo_url }))

  function toggle(url: string) {
    setPicked((p) => {
      if (p.includes(url)) return p.filter((u) => u !== url)
      if (max === 1) return [url]
      if (max && p.length >= max) return p
      return [...p, url]
    })
  }
  async function upload(files: File[]) {
    if (!files.length) return
    setErr(null)
    try {
      const urls = await library.upload(files, (done, total) => setProgress({ done, total }))
      setSource('library')
      setPicked((p) => (max === 1 ? urls.slice(-1) : [...p, ...urls].slice(0, max || Infinity)))
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Грешка при качване.') } finally { setProgress(null) }
  }

  return (
    <Drawer open={open} onClose={onClose} title={title} width={720}
      footer={<>
        <span className="text-[12.5px] text-slate-500 self-center mr-auto">{picked.length ? `Избрани: ${picked.length}${max && max > 1 ? ` от ${max}` : ''}` : max === 1 ? 'Изберете една снимка' : 'Изберете една или няколко'}</span>
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Отказ</button>
        <button onClick={() => { onDone(picked); onClose() }} disabled={!picked.length}
          className="px-5 py-2.5 rounded-xl text-white text-sm font-medium flex items-center gap-2 disabled:opacity-40" style={{ backgroundColor: ACCENT }}>
          <Check size={15} /> {max === 1 ? 'Избери' : `Добави${picked.length ? ` (${picked.length})` : ''}`}
        </button>
      </>}>
      {/* качване */}
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))) }}
        className={`flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3.5 cursor-pointer hover:border-slate-300 hover:bg-slate-50 transition ${progress ? 'pointer-events-none opacity-70' : ''}`}>
        <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">{progress ? <Spinner /> : <Upload size={17} />}</span>
        <span className="text-[13px] text-slate-600">
          {progress ? `Качване ${Math.min(progress.done + 1, progress.total)} от ${progress.total}…` : <><b className="font-medium text-slate-800">Качи нови снимки</b> — или ги пуснете тук. Снимките от телефон се смаляват автоматично.</>}
        </span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { upload(Array.from(e.target.files || [])); e.currentTarget.value = '' }} />
      </label>
      {err && <p className="text-[12.5px] text-rose-600">{err}</p>}

      {/* източник */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
        <button onClick={() => setSource('library')} className={`shrink-0 inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-lg border ${source === 'library' ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} style={source === 'library' ? { backgroundColor: ACCENT } : {}}>
          <FolderOpen size={13} /> Снимки за сайта {library.items ? `(${library.items.length})` : ''}
        </button>
        {albumsWithPhotos.map((a) => (
          <button key={a.id} onClick={() => setSource(a.id)} className={`shrink-0 inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-lg border ${source === a.id ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} style={source === a.id ? { backgroundColor: ACCENT } : {}}>
            <Images size={13} /> {a.title} ({photos.filter((p) => p.album_id === a.id).length})
          </button>
        ))}
      </div>

      {source === 'library' && library.items === null ? (
        <div className="flex justify-center py-12 text-slate-400"><Spinner size={20} /></div>
      ) : grid.length === 0 ? (
        <p className="text-center py-12 text-sm text-slate-500">Тук още няма снимки — качете от бутона горе.</p>
      ) : (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))' }}>
          {grid.map((g) => {
            const i = picked.indexOf(g.url); const on = i >= 0; const already = taken.includes(g.url)
            return (
              <button key={g.key} type="button" onClick={() => toggle(g.url)}
                className={`relative rounded-xl overflow-hidden aspect-square border-2 transition ${on ? '' : 'border-transparent hover:border-slate-300'}`}
                style={on ? { borderColor: ACCENT } : {}}>
                <img src={g.url} alt="" loading="lazy" className={`w-full h-full object-cover ${already && !on ? 'opacity-50' : ''}`} />
                {on && <span className="absolute top-1.5 right-1.5 min-w-6 h-6 px-1 rounded-full flex items-center justify-center text-white text-[12px] font-semibold shadow" style={{ backgroundColor: ACCENT }}>{max === 1 ? <Check size={14} /> : i + 1}</span>}
                {already && !on && <span className="absolute bottom-1.5 left-1.5 text-[10.5px] bg-white/90 text-slate-600 px-1.5 py-0.5 rounded-md">вече е тук</span>}
              </button>
            )
          })}
        </div>
      )}
    </Drawer>
  )
}
