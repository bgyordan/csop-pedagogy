'use client'
import { useEffect, useState } from 'react'
import { X, RotateCcw, Square, Sparkles } from 'lucide-react'
import { ViewPrefs, VIEW_DEFAULT, readView, saveView } from '@/lib/view-prefs'

// „Изглед“ — промените се виждат веднага и се помнят на това устройство.
export default function ViewSettings({ onClose }: { onClose: () => void }) {
  const [p, setP] = useState<ViewPrefs>(VIEW_DEFAULT)
  useEffect(() => { setP(readView()) }, [])
  const set = (patch: Partial<ViewPrefs>) => setP(prev => { const next = { ...prev, ...patch }; saveView(next); return next })
  const glass = p.mode === 'glass'

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Изглед">
      <button type="button" aria-label="Затвори" onClick={onClose} className="absolute inset-0 bg-slate-900/20 cursor-default" />
      <div className="relative m-3 w-full max-w-[380px] rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,34,64,0.18)] p-5 flex flex-col gap-5 overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[#0f2240]">Изглед</h2>
            <p className="text-[13px] text-slate-500">Само за теб, на това устройство. Вижда се веднага.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Затвори" className="ml-auto w-10 h-10 grid place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"><X size={17} /></button>
        </div>

        <Section title="Стил">
          <Seg value={p.mode} onChange={v => set({ mode: v as ViewPrefs['mode'] })}
            options={[{ v: 'classic', l: 'Класически', icon: <Square size={14} /> }, { v: 'glass', l: 'Стъклен', icon: <Sparkles size={14} /> }]} />
        </Section>

        <div className={`flex flex-col gap-5 transition-opacity ${glass ? '' : 'opacity-40 pointer-events-none'}`} aria-disabled={!glass}>
          <Section title="Стъкло">
            <div className="flex items-baseline justify-between">
              <label htmlFor="vs-frost" className="text-sm font-medium text-[#0f2240]">Матовост</label>
              <span className="text-[13px] text-slate-500">{p.solid ? 'изкл.' : `${p.frost} px`}</span>
            </div>
            <input id="vs-frost" type="range" min={0} max={24} step={2} value={p.frost} disabled={!glass || p.solid}
              onChange={e => set({ frost: Number(e.target.value) })} className="w-full accent-[#0f2240]" />
            <Switch label="Плътни панели" hint="Без прозрачност — най-лесно за четене" on={p.solid} onClick={() => set({ solid: !p.solid })} />
          </Section>
        </div>

        <Section title="Размер на съдържанието">
          <Seg value={p.text} onChange={v => set({ text: v as ViewPrefs['text'] })}
            options={[{ v: 's', l: 'А−', aria: 'По-малко' }, { v: 'm', l: 'А', aria: 'Нормално' }, { v: 'l', l: 'А+', aria: 'По-едро' }]} />
        </Section>

        <Section title="Движение">
          <Switch label="Намали анимациите" hint="Без плаващ фон и повдигане на картите" on={p.calm} onClick={() => set({ calm: !p.calm })} />
        </Section>

        <div className="flex gap-2.5 mt-auto pt-1">
          <button type="button" onClick={() => set(VIEW_DEFAULT)}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100">
            <RotateCcw size={15} /> По подразбиране
          </button>
          <button type="button" onClick={onClose} className="flex-1 min-h-[44px] rounded-xl bg-[#0f2240] text-white text-sm font-semibold hover:opacity-90">Готово</button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</div>
      {children}
    </div>
  )
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string; aria?: string; icon?: React.ReactNode }[] }) {
  return (
    <div role="group" className="grid gap-1 p-1 rounded-xl bg-slate-100" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)} aria-pressed={value === o.v} aria-label={o.aria}
          className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg text-[13.5px] transition-colors ${value === o.v ? 'bg-white text-[#0f2240] font-semibold shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          {o.icon}{o.l}
        </button>
      ))}
    </div>
  )
}

function Switch({ label, hint, on, onClick }: { label: string; hint: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className="flex items-center gap-3 min-h-[44px] text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[#0f2240]">{label}</span>
        <span className="block text-[12.5px] text-slate-500">{hint}</span>
      </span>
      <span className={`relative shrink-0 w-[52px] h-6 rounded-full transition-colors ${on ? 'bg-[#0f2240]' : 'bg-slate-300'}`}>
        <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-[left] ${on ? 'left-[31px]' : 'left-[3px]'}`} />
      </span>
    </button>
  )
}
