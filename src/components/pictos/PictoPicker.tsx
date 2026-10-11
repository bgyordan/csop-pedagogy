'use client'

// Избор на картинка: 263 пиктограми по групи + търсене + собствена снимка от компютъра/телефона.
// multi — прозорецът остава отворен и всяко натискане добавя картинка.

import { useEffect, useRef, useState } from 'react'
import { Search, X, Loader2, Upload, Check } from 'lucide-react'
import { pictoUrl } from '@/lib/pictos'
import type { PictoCatalog } from '@/lib/pictos'

export type Picked = { key?: string; photo?: string; label: string }

let cache: PictoCatalog | null = null
export function useCatalog() {
  const [cat, setCat] = useState<PictoCatalog | null>(cache)
  useEffect(() => {
    if (cache) return
    import('../../../public/pictos/catalog.json').then(m => { cache = (m.default || m) as unknown as PictoCatalog; setCat(cache) }).catch(() => {})
  }, [])
  return cat
}

export default function PictoPicker({ multi = false, title, onPick, onClose, toPhoto }: {
  multi?: boolean; title?: string; onPick: (p: Picked) => void; onClose: () => void
  toPhoto?: (f: File) => Promise<string>     // качване на снимка (ако го няма — без бутон)
}) {
  const cat = useCatalog()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('needs')
  const [added, setAdded] = useState(0)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const list = (cat?.items || []).filter(i => q ? i.label.toLowerCase().includes(q.toLowerCase()) : i.cat === group)

  function pick(p: Picked) {
    onPick(p)
    if (multi) setAdded(a => a + 1)
    else onClose()
  }
  async function upload(f: File | undefined) {
    if (!f || !toPhoto) return
    setBusy(true)
    try { pick({ photo: await toPhoto(f), label: '' }) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 print:hidden" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 pt-5">
          <div className="flex-1 text-[15px] font-semibold text-slate-800">{title || 'Избери картинка'}</div>
          {toPhoto && (
            <>
              <input ref={file} type="file" accept="image/*" className="hidden" onChange={e => { upload(e.target.files?.[0]); e.target.value = '' }} />
              <button type="button" onClick={() => file.current?.click()} disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240]">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Своя снимка
              </button>
            </>
          )}
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="px-5 pt-3 space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl focus-within:border-[#0f2240]">
            <Search size={15} className="text-slate-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Търси — напр. „вода“, „топка“, „тъга“" className="flex-1 text-[14px] focus:outline-none" />
            {q && <button type="button" onClick={() => setQ('')} className="text-slate-400"><X size={14} /></button>}
          </div>
          {!q && cat && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(cat.categories).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setGroup(k)}
                  className={`px-2.5 py-1 rounded-lg text-[12.5px] ${group === k ? 'bg-[#0f2240] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{l}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-auto p-5 grid grid-cols-[repeat(auto-fill,minmax(86px,1fr))] gap-2 content-start">
          {!cat && <Loader2 className="animate-spin text-slate-400" />}
          {list.map(i => (
            <button key={i.key} type="button" onClick={() => pick({ key: i.key, label: i.label })}
              className="rounded-2xl border-2 border-transparent p-2 flex flex-col items-center gap-1 hover:bg-sky-50 hover:border-sky-200 active:scale-95 transition">
              <img src={pictoUrl(i.key)} alt="" className="w-12 h-12" loading="lazy" />
              <span className="text-[11.5px] text-slate-600 text-center leading-tight">{i.label}</span>
            </button>
          ))}
          {cat && !list.length && <div className="text-sm text-slate-400 col-span-full">Няма такава картинка. Опитайте друга дума или качете своя снимка.</div>}
        </div>
        {multi && (
          <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-100">
            <span className="text-[13px] text-slate-500">{added ? `Добавени: ${added}` : 'Натискайте картинките, които искате да добавите.'}</span>
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm" style={{ backgroundColor: '#0f2240' }}><Check size={15} /> Готово</button>
          </div>
        )}
      </div>
    </div>
  )
}
