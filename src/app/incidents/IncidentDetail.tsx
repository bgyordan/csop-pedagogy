'use client'
// Случаят и неговата диря: какво е констатирано, кой е участвал, какво е направено после.
// Съветът движи статуса (нов → разглежда се → взети мерки → приключен) и връзва протокола.
// Бележка (разговор с родител, мярка, наблюдение) добавя всеки, който вижда случая.

import { useState } from 'react'
import Link from 'next/link'
import { X, Pencil, Send, Loader2, FileText, MessageSquare, ShieldCheck, Phone, Flag, Trash2 } from 'lucide-react'
import { KINDS, STATUS, LEVELS, ROLE_LABEL, fmtDate } from '@/lib/incidents'
import type { Case, Event, Participant, Status } from '@/lib/incidents'
import { confirmDialog } from '@/components/ui/Toast'

const EV_ICON = { note: MessageSquare, status: Flag, measure: ShieldCheck, parent: Phone, protocol: FileText }
const EV_LABEL = { note: 'Бележка', status: 'Статус', measure: 'Мярка', parent: 'Родител', protocol: 'Протокол' }

export default function IncidentDetail({ c, parts, events, names, studentNames, protocols, canManage, canEdit, isAdmin, onClose, onEdit, onStatus, onEvent, onProtocol, onDelete }: {
  c: Case; parts: Participant[]; events: Event[]; names: Record<string, string>; studentNames: Record<string, string>
  protocols: { id: string; number: number; date: string }[]
  canManage: boolean; canEdit: boolean; isAdmin: boolean
  onClose: () => void; onEdit: () => void
  onStatus: (s: Status, outcome?: string) => Promise<void>
  onEvent: (kind: Event['kind'], text: string) => Promise<void>
  onProtocol: (id: string | null) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState<Event['kind']>('note')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState(c.outcome || '')
  const [closing, setClosing] = useState(false)
  const lvl = LEVELS[c.kind].find(l => l.n === c.level)

  async function add() {
    if (!text.trim()) return
    setBusy(true); await onEvent(kind, text.trim()); setText(''); setBusy(false)
  }
  const row = (k: string, v: React.ReactNode) => v ? <div className="flex gap-3 py-1.5"><span className="w-32 shrink-0 text-[12px] text-slate-500">{k}</span><span className="text-[13.5px] text-slate-800 flex-1">{v}</span></div> : null
  const chips = (xs: string[], cls = 'bg-slate-100 text-slate-700') => xs.length ? <span className="flex flex-wrap gap-1">{xs.map(x => <span key={x} className={`text-[12px] px-2 py-0.5 rounded-full ${cls}`}>{x}</span>)}</span> : null

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-4 flex items-center gap-2">
          <span className="text-[12px] px-2 py-0.5 rounded-full font-medium" style={{ background: KINDS[c.kind].bg, color: KINDS[c.kind].color }}>{KINDS[c.kind].short}</span>
          <h2 className="flex-1 text-base text-[#0f2240]">Случай № {c.number} · {fmtDate(c.occurred_on)}{c.occurred_time ? ` ${c.occurred_time.slice(0, 5)}` : ''}</h2>
          {canEdit && <button type="button" onClick={onEdit} title="Редакция" className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><Pencil size={16} /></button>}
          {isAdmin && <button type="button" onClick={async () => await confirmDialog(`Да се изтрие ли случай № ${c.number}? Дирята се губи.`) && onDelete()} title="Изтрий" className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button>}
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* статус */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(STATUS) as Status[]).map(s => {
              const active = c.status === s
              return (
                <button key={s} type="button" disabled={!canManage || active} onClick={() => s === 'closed' ? setClosing(true) : onStatus(s)}
                  className={`px-3 py-1.5 rounded-xl text-[12.5px] border transition-all ${active ? 'font-medium' : canManage ? 'opacity-60 hover:opacity-100' : 'opacity-40'}`}
                  style={{ background: active ? STATUS[s].bg : '#fff', color: STATUS[s].color, borderColor: active ? STATUS[s].color : '#e2e8f0' }}>{STATUS[s].label}</button>
              )
            })}
          </div>
          {closing && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
              <textarea value={outcome} onChange={e => setOutcome(e.target.value)} rows={2} placeholder="Резултат — какво се промени, спряло ли е поведението…"
                className="w-full px-3 py-2 rounded-xl border border-emerald-200 text-sm bg-white" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setClosing(false)} className="px-3 py-1.5 rounded-lg text-[13px] border border-slate-200 bg-white">Отказ</button>
                <button type="button" onClick={async () => { await onStatus('closed', outcome.trim()); setClosing(false) }} className="px-3 py-1.5 rounded-lg text-[13px] text-white bg-emerald-600 hover:bg-emerald-700">Приключи</button>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {row('Деца', <span className="flex flex-col gap-1">{parts.map(p => (
              <span key={p.id}>
                {p.student_id ? <Link href={`/students/${p.student_id}`} className="hover:underline">{studentNames[p.student_id] || '—'}</Link> : p.name}
                <span className="text-[12px] text-slate-500"> — {ROLE_LABEL[p.role]}</span>
              </span>))}</span>)}
            {row('Място', c.place)}
            {row(c.kind === 'bullying' ? 'Форма' : 'Поведение', chips(c.forms, c.kind === 'bullying' ? 'bg-rose-50 text-rose-800' : 'bg-violet-50 text-violet-800'))}
            {row(c.kind === 'bullying' ? 'Ниво' : 'Тежест', lvl ? <span title={lvl.hint}>{lvl.label}</span> : null)}
            {row('Какво се случи', <span className="whitespace-pre-wrap">{c.description}</span>)}
            {row('Преди това', (c.antecedents.length || c.antecedent_note) ? <span>{chips(c.antecedents)}{c.antecedent_note && <span className="block mt-1">{c.antecedent_note}</span>}</span> : null)}
            {row('След това', (c.consequences.length || c.consequence_note) ? <span>{chips(c.consequences)}{c.consequence_note && <span className="block mt-1">{c.consequence_note}</span>}</span> : null)}
            {row('Направено веднага', chips(c.actions, 'bg-emerald-50 text-emerald-800'))}
            {row('Констатирал', c.reported_by ? names[c.reported_by] : null)}
            {row('Резултат', c.outcome)}
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-slate-400" />
              <select value={c.protocol_id || ''} onChange={e => onProtocol(e.target.value || null)} className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-[13px] bg-white">
                <option value="">Без протокол от Координационния съвет</option>
                {protocols.map(p => <option key={p.id} value={p.id}>Протокол № {p.number} от {fmtDate(p.date)}</option>)}
              </select>
            </div>
          )}

          {/* дирята */}
          <section>
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Диря</h3>
            <ol className="relative border-l-2 border-slate-100 ml-2 space-y-3">
              <li className="pl-4 relative">
                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-white" />
                <div className="text-[12px] text-slate-500">{new Date(c.created_at).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', dateStyle: 'short', timeStyle: 'short' })} · {c.reported_by ? names[c.reported_by] : ''}</div>
                <div className="text-[13px] text-slate-700">Констатиран</div>
              </li>
              {events.map(e => {
                const I = EV_ICON[e.kind]
                return (
                  <li key={e.id} className="pl-4 relative">
                    <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white" />
                    <div className="text-[12px] text-slate-500 flex items-center gap-1.5"><I size={12} />{EV_LABEL[e.kind]} · {new Date(e.at).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', dateStyle: 'short', timeStyle: 'short' })} · {e.staff_id ? names[e.staff_id] : ''}</div>
                    <div className="text-[13px] text-slate-800 whitespace-pre-wrap">{e.text}</div>
                  </li>
                )
              })}
            </ol>
          </section>

          <div className="rounded-2xl border border-slate-200 p-3 space-y-2">
            <div className="flex gap-1">
              {(['note', 'measure', 'parent'] as const).map(k => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`px-2.5 py-1 rounded-lg text-[12px] border ${kind === k ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200'}`}>
                  {k === 'note' ? 'Бележка' : k === 'measure' ? 'Мярка' : 'Разговор с родител'}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea value={text} onChange={e => setText(e.target.value)} rows={2}
                placeholder={kind === 'measure' ? 'Каква мярка/подкрепа — кой и докога…' : kind === 'parent' ? 'С кого, кога, какво беше договорено…' : 'Наблюдение, промяна…'}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
              <button type="button" onClick={add} disabled={busy || !text.trim()} className="self-end p-2.5 rounded-xl text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
