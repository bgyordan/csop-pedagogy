// Паспорт на детето — изглед „една страница“. Без състояние, ползва се и в досието, и при печат.

import { MessageCircle, Heart, CloudLightning, Sun, ShieldAlert, Accessibility } from 'lucide-react'
import { COMMUNICATION, EATING, TOILET, MOBILITY } from './lib'
import type { Passport } from './lib'

function Block({ icon: Icon, title, tone, children }: { icon: any; title: string; tone: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border px-4 py-3 break-inside-avoid ${tone}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-slate-500 mb-1.5">
        <Icon size={13} /> {title}
      </div>
      {children}
    </div>
  )
}

const text = (v: string | null | undefined) => v && v.trim()
  ? <p className="text-[14px] text-slate-800 whitespace-pre-line leading-relaxed">{v}</p>
  : <p className="text-[13px] text-slate-400">—</p>

export default function PassportSheet({ passport, name, subtitle }: { passport: Passport; name?: string; subtitle?: string }) {
  const p = passport
  const care = (label: string, v: string | null, map: Record<string, string>, note?: string | null) => (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-slate-100 last:border-0">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className="text-[14px] text-slate-800 text-right">
        {v ? map[v] : <span className="text-slate-400">—</span>}
        {note && note.trim() && <span className="block text-[12.5px] text-slate-500">{note}</span>}
      </span>
    </div>
  )

  return (
    <div className="space-y-3">
      {name && (
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="text-lg font-normal text-[#0f2240]">{name}</h2>
          {subtitle && <span className="text-[13px] text-slate-500">{subtitle}</span>}
        </div>
      )}

      {p.safety && p.safety.trim() && (
        <Block icon={ShieldAlert} title="Важно за безопасността" tone="border-rose-200 bg-rose-50/60">{text(p.safety)}</Block>
      )}

      <Block icon={MessageCircle} title="Как общува" tone="border-slate-200 bg-white">
        {p.communication.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {p.communication.map(c => (
              <span key={c} className="text-[12.5px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">{COMMUNICATION[c] || c}</span>
            ))}
          </div>
        )}
        {p.communication.length === 0 || (p.communication_note && p.communication_note.trim()) ? text(p.communication_note) : null}
      </Block>

      <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-3">
        <Block icon={Heart} title="Харесва и го мотивира" tone="border-emerald-200 bg-emerald-50/50">{text(p.likes)}</Block>
        <Block icon={CloudLightning} title="Тревожи го / провокира" tone="border-amber-200 bg-amber-50/50">{text(p.triggers)}</Block>
        <Block icon={Sun} title="Успокоява го" tone="border-sky-200 bg-sky-50/50">{text(p.calming)}</Block>
      </div>

      <Block icon={Accessibility} title="Грижи" tone="border-slate-200 bg-white">
        {care('Хранене', p.eating, EATING, p.eating_note)}
        {care('Тоалет', p.toilet, TOILET)}
        {care('Придвижване', p.mobility, MOBILITY)}
      </Block>
    </div>
  )
}
