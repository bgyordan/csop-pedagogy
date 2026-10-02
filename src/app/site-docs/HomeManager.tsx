'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { X, ImagePlus, ExternalLink, Info, Repeat } from 'lucide-react'
import { ACCENT, SITE_URL, Toast, useFlash } from './shared'
import type { Album, Photo } from './shared'
import PhotoPicker, { useLibrary } from './PhotoPicker'

// Трите кръга от началната страница на сайта (позиции и цветове като в home.css)
const SLOTS = [
  { n: 1, color: '#F39A1E', pos: { left: '24%', top: '0%' }, ring: 'translate(-6%,-5%)' },
  { n: 2, color: '#8CC63F', pos: { right: '0%', top: '40%' }, ring: 'translate(7%,-2%)' },
  { n: 3, color: '#1D8BD1', pos: { left: '0%', top: '44%' }, ring: 'translate(-4%,7%)' },
]

/* ═══════════════ НАЧАЛНА СТРАНИЦА: 3-те снимки ═══════════════ */
export default function HomeManager({ albums, photos, initialSelected }: { albums: Album[]; photos: Photo[]; initialSelected: string[] }) {
  const supabase = createClient(); const router = useRouter()
  const { notice, flash } = useFlash()
  const library = useLibrary()
  const extra = Math.max(0, (initialSelected || []).length - 3)
  const [slots, setSlots] = useState<(string | null)[]>(() => [0, 1, 2].map((i) => initialSelected?.[i] || null))
  const [pickFor, setPickFor] = useState<number | null>(null)
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

  const filled = slots.filter(Boolean).length

  return (
    <div>
      <Toast notice={notice} />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,440px)_1fr] gap-6 items-start">
        {/* макет на кръговете */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="relative w-full max-w-[380px] mx-auto aspect-square">
            {SLOTS.map((s, i) => {
              const url = slots[i]
              return (
                <div key={s.n} className="absolute w-[52%] aspect-square" style={s.pos}
                  draggable={!!url} onDragStart={() => setDragFrom(i)} onDragEnd={() => setDragFrom(null)}
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (dragFrom !== null && dragFrom !== i) swap(dragFrom, i); setDragFrom(null) }}>
                  <span className="absolute -inset-[7%] rounded-full" style={{ backgroundColor: s.color, transform: s.ring, opacity: url ? 1 : 0.25 }} />
                  <button onClick={() => setPickFor(i)} title={url ? 'Смени снимката' : 'Избери снимка'}
                    className={`group absolute inset-0 rounded-full overflow-hidden border-[5px] border-white bg-slate-100 flex items-center justify-center ${dragFrom === i ? 'opacity-50' : ''} ${url ? 'cursor-grab' : ''}`}>
                    {url ? <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" /> : <span className="flex flex-col items-center gap-1 text-slate-400"><ImagePlus size={22} /><span className="text-[11.5px]">Избери</span></span>}
                    {url && <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center text-white text-[12px] font-medium opacity-0 group-hover:opacity-100"><Repeat size={14} className="mr-1" /> Смени</span>}
                  </button>
                  <span className="absolute top-[4%] left-[4%] w-7 h-7 rounded-full text-white text-[13px] font-bold flex items-center justify-center shadow" style={{ backgroundColor: s.color }}>{s.n}</span>
                  {url && (
                    <button onClick={() => setSlot(i, null, `Снимка ${s.n} е махната.`)} title="Махни"
                      className="absolute top-[4%] right-[4%] w-7 h-7 rounded-full bg-white text-slate-500 hover:text-rose-600 shadow flex items-center justify-center"><X size={14} /></button>
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
            <p className="text-[13px] text-slate-500 mt-1">Три кръгли снимки до заглавието на началната страница. {filled}/3 избрани.</p>
            <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-sky-700 hover:underline mt-1.5">виж началната страница <ExternalLink size={12} /></a>
          </div>
          <ol className="space-y-2">
            {SLOTS.map((s, i) => (
              <li key={s.n} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2">
                <span className="w-6 h-6 rounded-full text-white text-[12px] font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: s.color }}>{s.n}</span>
                <span className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">{slots[i] && <img src={slots[i]!} alt="" className="w-full h-full object-cover" />}</span>
                <span className="flex-1 text-[13px] text-slate-600">{['Горе, в средата', 'Вдясно', 'Вляво'][i]}</span>
                <button onClick={() => setPickFor(i)} className="text-[12.5px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">{slots[i] ? 'Смени' : 'Избери'}</button>
              </li>
            ))}
          </ol>
          {filled < 3 && <p className="flex gap-2 text-[12.5px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2"><Info size={15} className="shrink-0 mt-px text-slate-400" /> Докато няма избрани три, на празните места сайтът показва стандартни снимки.</p>}
          {extra > 0 && <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">От старата въртележка има още {extra} снимки, които вече не се показват. При първата промяна тук ще бъдат махнати.</p>}
          <p className="flex gap-2 text-[12.5px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2"><Info size={15} className="shrink-0 mt-px text-slate-400" /> Лентата „Моменти от ежедневието“ по-надолу на началната страница се пълни сама с последните 8 снимки от Галерията.</p>
        </section>
      </div>

      <PhotoPicker open={pickFor !== null} onClose={() => setPickFor(null)} albums={albums} photos={photos} library={library} max={1}
        title={pickFor !== null ? `Снимка ${pickFor + 1} на началната страница` : ''} taken={slots.filter((u): u is string => !!u)}
        onDone={(urls) => { if (pickFor !== null && urls[0]) setSlot(pickFor, urls[0], `Снимка ${pickFor + 1} е сменена.`) }} />
    </div>
  )
}
