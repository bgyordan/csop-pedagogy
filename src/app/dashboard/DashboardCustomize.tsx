'use client'
// Бутон „Подреди таблото“ — отметки кое да остава на началната страница + стрелки ↑↓ за реда.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal, Check, ChevronUp, ChevronDown } from 'lucide-react'
import { notify } from '@/components/ui/Toast'
import type { DashWidget } from '@/lib/dashboard-prefs'
import { HERO_THEMES } from './hero-themes'

export default function DashboardCustomize({ cookieName, orderCookieName, order: initialOrder, widgets, hidden, heroCookieName, heroKey, onDark = false }: {
  cookieName: string; orderCookieName: string; order: string[]; widgets: DashWidget[]; hidden: string[]; heroCookieName: string; heroKey: string; onDark?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [off, setOff] = useState<Set<string>>(new Set(hidden))
  const [hero, setHero] = useState(heroKey)
  const [order, setOrder] = useState<string[]>(initialOrder)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function save(next: Set<string>) {
    setOff(next)
    document.cookie = `${cookieName}=${encodeURIComponent(Array.from(next).join(','))}; path=/; max-age=${60 * 60 * 24 * 365 * 2}; samesite=lax`
    router.refresh()
  }
  function pickHero(k: string) {
    setHero(k)
    document.cookie = `${heroCookieName}=${k}; path=/; max-age=${60 * 60 * 24 * 365 * 2}; samesite=lax`
    router.refresh()
  }
  // картите в менюто — в реда от таблото
  const list = [...widgets].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  const movable = list.filter(w => !w.fixed)
  function move(k: string, dir: -1 | 1) {
    const i = movable.findIndex(w => w.key === k)
    const j = i + dir
    if (i < 0 || j < 0 || j >= movable.length) return
    const a = movable[i].key, b = movable[j].key
    const next = [...order]
    const ia = next.indexOf(a), ib = next.indexOf(b)
    next[ia] = b; next[ib] = a
    setOrder(next)
    document.cookie = `${orderCookieName}=${encodeURIComponent(next.join(','))}; path=/; max-age=${60 * 60 * 24 * 365 * 2}; samesite=lax`
    router.refresh()
  }
  function toggle(k: string) {
    const next = new Set(off)
    next.has(k) ? next.delete(k) : next.add(k)
    save(next)
  }

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border ${onDark ? 'bg-white/15 border-white/25 text-white hover:bg-white/25' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}>
        <SlidersHorizontal size={13} /> Подреди таблото
      </button>
      {open && (
        <div className="absolute left-0 md:left-auto md:right-0 top-full mt-2 z-40 w-80 max-w-[90vw] rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-[0_8px_24px_rgba(15,34,64,0.16)] p-2">
          <div className="px-2.5 pt-1.5 pb-1 text-[12px] font-medium text-slate-600">Цвят на горната лента</div>
          <div className="flex flex-wrap gap-2 px-2.5 pb-2.5 border-b border-slate-100 mb-1">
            {HERO_THEMES.map(t => (
              <button key={t.key} type="button" onClick={() => pickHero(t.key)} title={t.label} aria-label={t.label} aria-pressed={hero === t.key}
                className={`w-8 h-8 rounded-full ${t.swatch} flex items-center justify-center ${hero === t.key ? 'ring-2 ring-offset-2 ring-[#0f2240]' : 'hover:scale-110'} transition`}>
                {hero === t.key && <Check size={14} className={t.dark ? 'text-white' : 'text-teal-800'} />}
              </button>
            ))}
          </div>
          <div className="px-2.5 pt-1.5 pb-2 text-[12px] text-slate-500">Отметнатото стои на таблото, стрелките сменят реда. Пази се за вас, на това устройство.</div>
          {list.map(w => {
            const on = !off.has(w.key)
            const mi = movable.findIndex(m => m.key === w.key)
            return (
              <div key={w.key} className="flex items-center gap-1 rounded-xl hover:bg-slate-50">
                <button type="button" onClick={() => toggle(w.key)}
                  className="flex-1 min-w-0 flex items-start gap-2.5 px-2.5 py-2 text-left">
                  <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-[#0f2240] border-[#0f2240] text-white' : 'border-slate-300'}`}>{on && <Check size={11} />}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] text-slate-800">{w.label}</span>
                    {w.hint && <span className="block text-[11.5px] text-slate-400">{w.hint}</span>}
                  </span>
                </button>
                {!w.fixed && (
                  <span className="flex flex-col pr-1.5 shrink-0">
                    <button type="button" onClick={() => move(w.key, -1)} disabled={mi <= 0} aria-label="По-нагоре"
                      className="p-0.5 rounded text-slate-400 hover:text-[#0f2240] hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent"><ChevronUp size={14} /></button>
                    <button type="button" onClick={() => move(w.key, 1)} disabled={mi >= movable.length - 1} aria-label="По-надолу"
                      className="p-0.5 rounded text-slate-400 hover:text-[#0f2240] hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent"><ChevronDown size={14} /></button>
                  </span>
                )}
              </div>
            )
          })}
          <div className="flex justify-between items-center px-2.5 pt-2 pb-1 border-t border-slate-100 mt-1">
            <button type="button" onClick={() => { document.cookie = `${cookieName}=; path=/; max-age=0`; document.cookie = `${orderCookieName}=; path=/; max-age=0`; document.cookie = `${heroCookieName}=; path=/; max-age=0`; setHero(HERO_THEMES[0].key); setOrder(widgets.map(w => w.key)); setOpen(false); router.refresh(); notify('Върнато е подреждането по подразбиране', 'success') }}
              className="text-[12px] text-slate-500 hover:text-[#0f2240]">По подразбиране</button>
            <button type="button" onClick={() => setOpen(false)} className="text-[12px] px-3 py-1 rounded-lg bg-[#0f2240] text-white">Готово</button>
          </div>
        </div>
      )}
    </div>
  )
}
