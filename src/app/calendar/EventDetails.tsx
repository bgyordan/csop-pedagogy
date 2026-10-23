'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Pencil, Trash2, Copy, Download, MapPin, Video, AlignLeft, Users, Repeat, Eye, ArrowRight, Check, HelpCircle, Clock, UserRound } from 'lucide-react'
import { notify, confirmDialog } from '@/components/ui/Toast'
import {
  type CalItem, type Response, whenText, recurText, downloadIcs, VISIBILITY_LABELS, RESPONSE_LABELS, CATEGORY_BY_KEY, LAYER_BY_KEY, MANAGER_ROLES,
} from '@/lib/calendar'
import { ROLE_LABELS } from '@/types'
import type { MeInfo, StaffLite } from './CalendarClient'

const RESP_STYLE: Record<Response, string> = {
  yes: 'bg-emerald-100 text-emerald-700', no: 'bg-rose-100 text-rose-700', maybe: 'bg-amber-100 text-amber-700', pending: 'bg-slate-100 text-slate-500',
}

export default function EventDetails({ item, me, staff, canEdit, supabase, onClose, onEdit, onDuplicate, onRespond, onChanged }: {
  item: CalItem; me: MeInfo; staff: StaffLite[]; canEdit: boolean; supabase: any
  onClose: () => void; onEdit: (scope: 'series' | 'one') => void; onDuplicate: () => void
  onRespond: (r: Response) => void; onChanged: () => void
}) {
  const ev = item.event
  const recurring = !!ev && ev.recur_freq !== 'none'
  const [askDelete, setAskDelete] = useState(false)
  const [askEdit, setAskEdit] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }, [onClose])

  const byId = new Map(staff.map(s => [s.id, s]))
  const attendees = (ev?.attendees || []).map(a => ({ ...a, p: byId.get(a.staff_id) }))
    .sort((a, b) => (a.p?.first_name || '').localeCompare(b.p?.first_name || '', 'bg'))
  const tally = (r: Response) => attendees.filter(a => a.response === r).length
  const amInvited = attendees.some(a => a.staff_id === me.id) && ev?.owner_id !== me.id
  const canSeeAnswers = !!ev && (ev.owner_id === me.id || MANAGER_ROLES.includes(me.role) || amInvited)

  async function del(scope: 'one' | 'series') {
    if (!ev) return
    if (scope === 'series' && !(await confirmDialog(`Изтриване на „${ev.title}“${recurring ? ' (цялата поредица)' : ''}?`, { danger: true, confirmLabel: 'Изтрий' }))) return
    setBusy(true)
    const { error } = scope === 'one'
      ? await supabase.from('cal_events').update({ exdates: [...(ev.exdates || []), item.occ], updated_at: new Date().toISOString() }).eq('id', ev.id)
      : await supabase.from('cal_events').delete().eq('id', ev.id)
    setBusy(false)
    if (error) { notify(error.message); return }
    notify(scope === 'one' ? 'Появяването е премахнато' : 'Събитието е изтрито', 'success')
    onChanged()
  }

  const layer = LAYER_BY_KEY[item.layer]
  const description = item.description

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="absolute inset-0 bg-slate-900/30" />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* лента с действия */}
        <div className="flex items-center justify-end gap-0.5 px-3 pt-3">
          {canEdit && <IconBtn title="Редактирай" onClick={() => recurring ? setAskEdit(a => !a) : onEdit('series')}><Pencil size={16} /></IconBtn>}
          {canEdit && <IconBtn title="Изтрий" onClick={() => recurring ? setAskDelete(a => !a) : del('series')} disabled={busy}><Trash2 size={16} /></IconBtn>}
          {ev && <IconBtn title="Копирай като ново" onClick={onDuplicate}><Copy size={16} /></IconBtn>}
          <IconBtn title="Изтегли .ics (Outlook / Google / телефон)" onClick={() => downloadIcs([item], 'sabitie')}><Download size={16} /></IconBtn>
          <IconBtn title="Затвори (Esc)" onClick={onClose}><X size={18} /></IconBtn>
        </div>
        {(askEdit || askDelete) && (
          <div className="mx-5 mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm">
            <div className="text-slate-600 mb-2">{askEdit ? 'Какво да редактирам?' : 'Какво да изтрия?'}</div>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => askEdit ? onEdit('one') : del('one')} className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700">Само това появяване</button>
              <button disabled={busy} onClick={() => askEdit ? onEdit('series') : del('series')} className={`flex-1 px-3 py-1.5 rounded-lg text-white ${askEdit ? 'bg-[#0f2240] hover:bg-[#1a3560]' : 'bg-rose-600 hover:bg-rose-700'}`}>Цялата поредица</button>
            </div>
          </div>
        )}

        <div className="px-5 pb-5">
          <div className="flex gap-3.5">
            <span className="w-4 h-4 rounded-[5px] mt-1.5 shrink-0" style={{ backgroundColor: item.color }} />
            <div className="min-w-0">
              <h2 className={`text-[20px] leading-snug font-semibold text-slate-900 break-words ${item.done ? 'line-through text-slate-500' : ''}`}>{item.title}</h2>
              <div className="text-sm text-slate-600 mt-1 first-letter:uppercase">{whenText(item)}</div>
              {ev && recurring && <div className="text-[13px] text-slate-500 mt-0.5 flex items-center gap-1.5"><Repeat size={12} /> {recurText(ev)}</div>}
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            {item.location && <Row icon={<MapPin size={16} />}>{item.location}</Row>}
            {ev?.online_url && (
              <Row icon={<Video size={16} />}>
                <a href={ev.online_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-700">Включи се в срещата</a>
              </Row>
            )}
            {item.subtitle && !ev && <Row icon={<Clock size={16} />}>{item.subtitle}</Row>}
            {description && <Row icon={<AlignLeft size={16} />}><div className="whitespace-pre-wrap text-slate-700 break-words">{description}</div></Row>}
            {ev && (
              <Row icon={<UserRound size={16} />}>
                <span className="text-slate-700">{ev.owner_id === me.id ? 'Организатор: аз' : `Организатор: ${ev.owner ? `${ev.owner.first_name} ${ev.owner.last_name}` : '—'}`}</span>
                <span className="text-slate-400"> · {CATEGORY_BY_KEY[ev.category]?.label}</span>
              </Row>
            )}
            {ev && (
              <Row icon={<Eye size={16} />}>
                <span className="text-slate-600">{VISIBILITY_LABELS[ev.visibility]}</span>
                {ev.visibility === 'roles' && ev.roles?.length ? <span className="text-slate-400">: {ev.roles.map(r => (ROLE_LABELS as any)[r] || r).join(', ')}</span> : null}
              </Row>
            )}
            {attendees.length > 0 && (
              <Row icon={<Users size={16} />}>
                <div className="text-slate-700">{attendees.length} поканени{canSeeAnswers && <span className="text-slate-400"> · {tally('yes')} да · {tally('maybe')} може би · {tally('no')} не · {tally('pending')} чакат</span>}</div>
                <ul className="mt-1.5 space-y-1 max-h-48 overflow-y-auto pr-1">
                  {attendees.map(a => (
                    <li key={a.staff_id} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="truncate text-slate-700">{a.p ? `${a.p.first_name} ${a.p.last_name}` : 'Служител'}{a.staff_id === me.id && <span className="text-slate-400"> (аз)</span>}</span>
                      {canSeeAnswers && <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${RESP_STYLE[a.response]}`}>{RESPONSE_LABELS[a.response]}</span>}
                    </li>
                  ))}
                </ul>
              </Row>
            )}
            {!ev && (
              <Row icon={<span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: layer.color }} />}>
                <span className="text-slate-600">{item.sourceLabel || layer.label}</span>
              </Row>
            )}
          </div>

          {amInvited && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="text-[13px] text-slate-500 mb-2">Ще присъстваш ли?</div>
              <div className="flex gap-2">
                {([['yes', 'Да', <Check key="y" size={14} />], ['maybe', 'Може би', <HelpCircle key="m" size={14} />], ['no', 'Не', <X key="n" size={14} />]] as const).map(([r, l, i]) => (
                  <button key={r} onClick={() => onRespond(r)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-colors
                      ${item.myResponse === r ? (r === 'yes' ? 'bg-emerald-600 border-emerald-600 text-white' : r === 'no' ? 'bg-rose-600 border-rose-600 text-white' : 'bg-amber-500 border-amber-500 text-white') : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    {i}{l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {item.href && (
            <Link href={item.href} className="mt-5 flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-sm font-medium text-slate-700">
              Отвори в „{item.sourceLabel || layer.label}“ <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function IconBtn({ children, title, onClick, disabled }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return <button title={title} aria-label={title} onClick={onClick} disabled={disabled} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40">{children}</button>
}
function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex gap-3.5"><span className="w-4 shrink-0 flex justify-center pt-0.5 text-slate-400">{icon}</span><div className="min-w-0 flex-1">{children}</div></div>
}
