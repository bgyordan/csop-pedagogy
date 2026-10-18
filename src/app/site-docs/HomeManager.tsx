'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { X, ImagePlus, ExternalLink, Info, Repeat } from 'lucide-react'
import { ACCENT, SITE_URL, Toast, useFlash } from './shared'
import type { Album, Photo } from './shared'
import PhotoPicker, { useLibrary } from './PhotoPicker'

// Трите снимки в началото на сайта — „Пътят“: стъпки нагоре и надясно, №1 е най-голямата.
// pos/w са за умаления макет тук; цветът е на номерчето (от логото).
const SLOTS = [
  { n: 1, color: '#F39A1E', pos: { right: '0%', top: '0%' }, w: '46%', ar: '1 / 1.02', where: 'Най-голямата, вдясно' },
  { n: 2, color: '#8CC63F', pos: { left: '29%', top: '17%' }, w: '33%', ar: '1 / 1', where: 'Средната' },
  { n: 3, color: '#1D8BD1', pos: { left: '4%', top: '34%' }, w: '28%', ar: '1 / .95', where: 'Най-малката, вляво — минава под мотото' },
]
// Двете снимки до текста „Над 150 деца учат при нас…“ (под първия екран) — по желание.
// Пазят се в page_photos['nachalna-pod']; докато са празни, сайтът слага последните снимки от Галерията.
const ABOUT_KEY = 'nachalna-pod'
// същата форма „цвете“ като на сайта (lib/flower.ts там): 7 и 8 листа
function flower(petals: number, depth: number, rot: number) {
  const pts: string[] = []
  for (let i = 0; i < 180; i++) {
    const t = (i / 180) * Math.PI * 2; const r = 1 - depth + depth * Math.pow(Math.abs(Math.cos((petals * t) / 2)), 0.7)
    pts.push(`${(50 + 50 * r * Math.cos(t + rot)).toFixed(2)}% ${(50 + 50 * r * Math.sin(t + rot)).toFixed(2)}%`)
  }
  return `polygon(${pts.join(', ')})`
}
const FLOWERS = [flower(7, 0.17, -0.2), flower(8, 0.15, 0.25)]
const PETAL = ['#FBD9AE', '#D3EBB4']

/* ═══════════════ НАЧАЛНА СТРАНИЦА: 3-те снимки ═══════════════ */
export default function HomeManager({ albums, photos, initialSelected, initialAbout = [] }: { albums: Album[]; photos: Photo[]; initialSelected: string[]; initialAbout?: string[] }) {
  const supabase = createClient(); const router = useRouter()
  const { notice, flash } = useFlash()
  const library = useLibrary()
  const extra = Math.max(0, (initialSelected || []).length - 3)
  const [slots, setSlots] = useState<(string | null)[]>(() => [0, 1, 2].map((i) => initialSelected?.[i] || null))
  const [about, setAbout] = useState<(string | null)[]>(() => [0, 1].map((i) => initialAbout?.[i] || null))
  const [pickFor, setPickFor] = useState<number | null>(null) // 0–2 = началото, 3–4 = под първия екран
  const [dragFrom, setDragFrom] = useState<number | null>(null)

  async function save(next: (string | null)[], msg: string) {
    const prev = slots; setSlots(next)
    // празно място = '' (сайтът слага стандартна снимка точно там, без да размества другите)
    const value = next.map((u) => u || ''); while (value.length && !value[value.length - 1]) value.pop()
    const { error } = await supabase.from('site_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', 'hero_photos')
    if (error) { setSlots(prev); flash('Не се запази: ' + error.message, true); return }
    flash(msg); router.refresh()
  }
  const setSlot = (i: number, url: string | null, msg: string) => { const n = [...slots]; n[i] = url; return save(n, msg) }
  function swap(a: number, b: number) { const n = [...slots]; [n[a], n[b]] = [n[b], n[a]]; save(n, `Снимки ${a + 1} и ${b + 1} си смениха местата.`) }

  // 4 и 5: пише се само ключът 'nachalna-pod' в page_photos — първо се чете най-новото, за да не се затрие нещо от „Снимки“
  async function saveAbout(next: (string | null)[], msg: string) {
    const prev = about; setAbout(next)
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'page_photos').maybeSingle()
    const all = data?.value && typeof data.value === 'object' && !Array.isArray(data.value) ? { ...(data.value as Record<string, string[]>) } : {}
    const urls = next.map((u) => u || ''); while (urls.length && !urls[urls.length - 1]) urls.pop()
    if (urls.length) all[ABOUT_KEY] = urls; else delete all[ABOUT_KEY]
    const { error } = await supabase.from('site_settings').update({ value: all, updated_at: new Date().toISOString() }).eq('key', 'page_photos')
    if (error) { setAbout(prev); flash('Не се запази: ' + error.message, true); return }
    flash(msg); router.refresh()
  }
  const setAboutSlot = (i: number, url: string | null, msg: string) => { const n = [...about]; n[i] = url; return saveAbout(n, msg) }

  const filled = slots.filter(Boolean).length

  return (
    <div>
      <Toast notice={notice} />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,440px)_1fr] gap-6 items-start">
        {/* макет: трите стъпки */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="relative w-full max-w-[400px] mx-auto aspect-[1.3]">
            {SLOTS.map((s, i) => {
              const url = slots[i]
              return (
                <div key={s.n} className="absolute" style={{ ...s.pos, width: s.w, aspectRatio: s.ar, zIndex: i === 0 ? 3 : i === 1 ? 2 : 1 }}
                  draggable={!!url} onDragStart={() => setDragFrom(i)} onDragEnd={() => setDragFrom(null)}
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (dragFrom !== null && dragFrom !== i) swap(dragFrom, i); setDragFrom(null) }}>
                  <button onClick={() => setPickFor(i)} title={url ? 'Смени снимката' : 'Избери снимка'}
                    className={`group absolute inset-0 rounded-2xl overflow-hidden border-[4px] border-white bg-slate-100 shadow-md flex items-center justify-center ${dragFrom === i ? 'opacity-50' : ''} ${url ? 'cursor-grab' : ''}`}>
                    {url ? <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" /> : <span className="flex flex-col items-center gap-1 text-slate-400"><ImagePlus size={20} /><span className="text-[11px]">Избери</span></span>}
                    {url && <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center text-white text-[12px] font-medium opacity-0 group-hover:opacity-100"><Repeat size={14} className="mr-1" /> Смени</span>}
                  </button>
                  <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full text-white text-[12px] font-bold flex items-center justify-center shadow" style={{ backgroundColor: s.color }}>{s.n}</span>
                  {url && (
                    <button onClick={() => setSlot(i, null, `Снимка ${s.n} е махната.`)} title="Махни"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white text-slate-500 hover:text-rose-600 shadow flex items-center justify-center"><X size={13} /></button>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-center text-[12px] text-slate-400 mt-4">Влачете снимка върху друга, за да си сменят местата.</p>
        </section>

        {/* обяснение */}
        <section className="space-y-4">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight" style={{ color: ACCENT }}>Снимките в началото на сайта</h2>
            <p className="text-[13px] text-slate-500 mt-1">Три снимки като стъпки до мотото в началото на сайта. {filled}/3 избрани.</p>
            <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-sky-700 hover:underline mt-1.5">виж началната страница <ExternalLink size={12} /></a>
          </div>
          <ol className="space-y-2">
            {SLOTS.map((s, i) => (
              <li key={s.n} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2">
                <span className="w-6 h-6 rounded-full text-white text-[12px] font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: s.color }}>{s.n}</span>
                <span className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">{slots[i] && <img src={slots[i]!} alt="" className="w-full h-full object-cover" />}</span>
                <span className="flex-1 text-[13px] text-slate-600">{s.where}</span>
                <button onClick={() => setPickFor(i)} className="text-[12.5px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">{slots[i] ? 'Смени' : 'Избери'}</button>
              </li>
            ))}
          </ol>
          {filled < 3 && <p className="flex gap-2 text-[12.5px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2"><Info size={15} className="shrink-0 mt-px text-slate-400" /> Докато няма избрани три, на празните места сайтът показва стандартни снимки.</p>}
          {extra > 0 && <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">От старата въртележка има още {extra} снимки, които вече не се показват. При първата промяна тук ще бъдат махнати.</p>}
          <p className="flex gap-2 text-[12.5px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2"><Info size={15} className="shrink-0 mt-px text-slate-400" /> Лентата „Моменти от ежедневието“ по-надолу на началната страница се пълни сама с последните 8 снимки от Галерията.</p>

          {/* 4 и 5 — по желание */}
          <div className="pt-3 border-t border-slate-100">
            <h3 className="text-[15px] font-semibold tracking-tight" style={{ color: ACCENT }}>До текста „Над 150 деца учат при нас…“</h3>
            <p className="text-[12.5px] text-slate-500 mt-1">Две снимки, изрязани като цветя. По желание — ако са празни, сайтът слага последните снимки от Галерията.</p>
            <div className="grid grid-cols-2 gap-3 mt-3 max-w-[340px]">
              {[0, 1].map((i) => {
                const url = about[i]
                return (
                  <div key={i} className="relative" style={{ marginTop: i === 1 ? 28 : 0 }}>
                    <div className="relative w-full aspect-square">
                      <span className="absolute inset-0" style={{ clipPath: FLOWERS[i], background: PETAL[i], transform: 'translate(5%,5%) rotate(12deg)' }} />
                      <button onClick={() => setPickFor(3 + i)} title={url ? 'Смени снимката' : 'Избери снимка'}
                        className="group absolute inset-0 overflow-hidden bg-slate-100 flex items-center justify-center" style={{ clipPath: FLOWERS[i] }}>
                        {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <span className="flex flex-col items-center gap-1 text-slate-400"><ImagePlus size={20} /><span className="text-[11px]">от Галерията</span></span>}
                        {url && <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center text-white text-[12px] font-medium opacity-0 group-hover:opacity-100"><Repeat size={14} className="mr-1" /> Смени</span>}
                      </button>
                    </div>
                    <span className="absolute top-0 left-0 w-6 h-6 rounded-full text-white text-[12px] font-bold flex items-center justify-center shadow" style={{ backgroundColor: ACCENT }}>{4 + i}</span>
                    {url && (
                      <button onClick={() => setAboutSlot(i, null, `Снимка ${4 + i} е махната — там отново излиза снимка от Галерията.`)} title="Махни"
                        className="absolute top-0 right-0 w-6 h-6 rounded-full bg-white text-slate-500 hover:text-rose-600 shadow flex items-center justify-center"><X size={13} /></button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>

      <PhotoPicker open={pickFor !== null} onClose={() => setPickFor(null)} albums={albums} photos={photos} library={library} max={1}
        title={pickFor !== null ? `Снимка ${pickFor + 1} на началната страница` : ''} taken={[...slots, ...about].filter((u): u is string => !!u)}
        onDone={(urls) => {
          if (pickFor === null || !urls[0]) return
          if (pickFor < 3) setSlot(pickFor, urls[0], `Снимка ${pickFor + 1} е сменена.`)
          else setAboutSlot(pickFor - 3, urls[0], `Снимка ${pickFor + 1} е сменена.`)
        }} />
    </div>
  )
}
