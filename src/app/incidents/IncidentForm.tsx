'use client'
// „Констатирай случай“ — за минута, и от телефона: вид, кога и къде, кои деца и в каква роля,
// форма и ниво, фактите, какво предшества и какво последва, какво е направено веднага.

import { useMemo, useState } from 'react'
import { X, Loader2, Check, Search, Info } from 'lucide-react'
import { smartMatch } from '@/lib/search'
import { KINDS, FORMS, LEVELS, ROLES, PLACES, ANTECEDENTS, CONSEQUENCES, ACTIONS, todaySofia } from '@/lib/incidents'
import type { Case, Kind, Participant, Role } from '@/lib/incidents'

export type FormValue = {
  kind: Kind; occurred_on: string; occurred_time: string; place: string; forms: string[]; level: number | null
  description: string; antecedents: string[]; antecedent_note: string; consequences: string[]; consequence_note: string
  actions: string[]; parents_notified: boolean
  participants: { student_id: string | null; name: string | null; role: Role }[]
}

const nowTime = () => new Date().toLocaleTimeString('bg-BG', { timeZone: 'Europe/Sofia', hour: '2-digit', minute: '2-digit', hour12: false })

function Chips({ options, value, onChange, tone = 'slate' }: { options: string[]; value: string[]; onChange: (v: string[]) => void; tone?: 'slate' | 'rose' | 'violet' | 'emerald' }) {
  const on = { slate: 'bg-[#0f2240] border-[#0f2240] text-white', rose: 'bg-rose-50 border-rose-300 text-rose-800', violet: 'bg-violet-50 border-violet-300 text-violet-800', emerald: 'bg-emerald-50 border-emerald-300 text-emerald-800' }[tone]
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const sel = value.includes(o)
        return <button key={o} type="button" onClick={() => onChange(sel ? value.filter(x => x !== o) : [...value, o])}
          className={`px-2.5 py-1 rounded-full text-[12.5px] border transition-colors ${sel ? on : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>{o}</button>
      })}
    </div>
  )
}

export default function IncidentForm({ students, initial, initialParts, initialStudent, onClose, onSave }: {
  students: { id: string; name: string; cls?: string }[]
  initial?: Case; initialParts?: Participant[]
  initialStudent?: string | null   // отворено от досието — детето е вече избрано
  onClose: () => void; onSave: (v: FormValue) => Promise<void>
}) {
  const [v, setV] = useState<FormValue>(() => initial ? {
    kind: initial.kind, occurred_on: initial.occurred_on, occurred_time: (initial.occurred_time || '').slice(0, 5), place: initial.place || '',
    forms: initial.forms || [], level: initial.level, description: initial.description, antecedents: initial.antecedents || [],
    antecedent_note: initial.antecedent_note || '', consequences: initial.consequences || [], consequence_note: initial.consequence_note || '',
    actions: initial.actions || [], parents_notified: initial.parents_notified,
    participants: (initialParts || []).map(p => ({ student_id: p.student_id, name: p.name, role: p.role })),
  } : {
    kind: 'bullying', occurred_on: todaySofia(), occurred_time: nowTime(), place: '', forms: [], level: 2, description: '',
    antecedents: [], antecedent_note: '', consequences: [], consequence_note: '', actions: [], parents_notified: false,
    participants: initialStudent && students.some(s => s.id === initialStudent) ? [{ student_id: initialStudent, name: null, role: 'victim' }] : [],
  })
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (p: Partial<FormValue>) => setV(x => ({ ...x, ...p }))
  const byId = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students])
  const found = q.trim().length >= 2 ? students.filter(s => smartMatch(s.name, q) && !v.participants.some(p => p.student_id === s.id)).slice(0, 8) : []
  const roles = ROLES[v.kind]
  const defaultRole: Role = v.kind === 'bullying' ? (v.participants.some(p => p.role === 'victim') ? 'perpetrator' : 'victim') : (v.participants.some(p => p.role === 'involved') ? 'affected' : 'involved')
  const ok = v.description.trim().length >= 5 && v.participants.length > 0 && v.occurred_on

  function switchKind(k: Kind) {
    // ролите и формите са различни — пренасяме децата с подходяща роля
    const map: Record<string, Role> = k === 'bullying' ? { involved: 'perpetrator', affected: 'victim' } : { perpetrator: 'involved', victim: 'affected' }
    set({ kind: k, forms: [], participants: v.participants.map(p => ({ ...p, role: map[p.role] || p.role })) })
  }
  async function save() {
    if (!ok) return
    setBusy(true)
    await onSave(v)
    setBusy(false)
  }
  const label = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5'

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-2xl mx-auto my-0 md:my-8 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex-1">
            <h2 className="text-base text-[#0f2240]">{initial ? `Случай № ${initial.number} — редакция` : 'Констатирай случай'}</h2>
            <p className="text-[12px] text-slate-500">Вижда се от Координационния съвет, ръководството и класния ръководител.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(KINDS) as Kind[]).map(k => (
              <button key={k} type="button" onClick={() => switchKind(k)} className="px-3 py-2.5 rounded-xl border text-sm text-left"
                style={v.kind === k ? { background: KINDS[k].bg, borderColor: KINDS[k].color, color: KINDS[k].color } : { borderColor: '#e2e8f0', color: '#475569' }}>
                <span className="font-medium">{KINDS[k].label}</span>
                <span className="block text-[11.5px] opacity-80">{k === 'bullying' ? 'по Механизма — между деца' : 'агресия, криза, бягство, самонараняване…'}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div><span className={label}>Дата</span><input type="date" value={v.occurred_on} max={todaySofia()} onChange={e => set({ occurred_on: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
            <div><span className={label}>Час</span><input type="time" value={v.occurred_time} onChange={e => set({ occurred_time: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></div>
            <div className="col-span-2 sm:col-span-1"><span className={label}>Място</span>
              <select value={v.place} onChange={e => set({ place: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                <option value="">—</option>{PLACES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <span className={label}>Деца</span>
            <div className="space-y-1.5 mb-2">
              {v.participants.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="flex-1 min-w-[140px] text-sm text-slate-800">{p.student_id ? byId[p.student_id]?.name || '—' : p.name}
                    {p.student_id && byId[p.student_id]?.cls && <span className="text-[11.5px] text-slate-400"> · {byId[p.student_id].cls}</span>}</span>
                  <div className="flex gap-1">
                    {roles.map(r => (
                      <button key={r.v} type="button" onClick={() => set({ participants: v.participants.map((x, j) => j === i ? { ...x, role: r.v } : x) })}
                        className={`px-2 py-0.5 rounded-lg text-[12px] border ${p.role === r.v ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200'}`}>{r.label}</button>
                    ))}
                  </div>
                  <button type="button" onClick={() => set({ participants: v.participants.filter((_, j) => j !== i) })} className="p-1 rounded text-slate-400 hover:text-rose-600"><X size={14} /></button>
                </div>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Добави дете — име…" className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm" />
              {(found.length > 0 || q.trim().length >= 2) && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg py-1 max-h-60 overflow-y-auto">
                  {found.map(s => (
                    <button key={s.id} type="button" onClick={() => { set({ participants: [...v.participants, { student_id: s.id, name: null, role: defaultRole }] }); setQ('') }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50">{s.name}{s.cls && <span className="text-[11.5px] text-slate-400"> · {s.cls}</span>}</button>
                  ))}
                  <button type="button" onClick={() => { set({ participants: [...v.participants, { student_id: null, name: q.trim(), role: defaultRole }] }); setQ('') }}
                    className="w-full text-left px-3 py-1.5 text-[12.5px] text-slate-500 hover:bg-slate-50">+ „{q.trim()}“ — не е от ЦСОП / друго</button>
                </div>
              )}
            </div>
          </div>

          <div>
            <span className={label}>{v.kind === 'bullying' ? 'Форма' : 'Вид поведение'}</span>
            <Chips options={FORMS[v.kind]} value={v.forms} onChange={f => set({ forms: f })} tone={v.kind === 'bullying' ? 'rose' : 'violet'} />
          </div>

          <div>
            <span className={label}>{v.kind === 'bullying' ? 'Ниво по Механизма' : 'Тежест'}</span>
            <div className="grid sm:grid-cols-3 gap-2">
              {LEVELS[v.kind].map(l => (
                <button key={l.n} type="button" onClick={() => set({ level: l.n })}
                  className={`text-left px-3 py-2 rounded-xl border ${v.level === l.n ? 'border-[#0f2240] bg-slate-50' : 'border-slate-200'}`}>
                  <span className="text-sm font-medium text-slate-800">{l.label}</span>
                  <span className="block text-[11.5px] text-slate-500 leading-snug">{l.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={label}>Какво се случи</span>
            <textarea value={v.description} onChange={e => set({ description: e.target.value })} rows={3}
              placeholder="Фактите — какво видяхте и чухте, кой какво направи. Без оценки и диагнози."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
          </div>

          <div className="rounded-2xl border border-slate-200 p-3 space-y-3">
            <div className="flex items-start gap-2 text-[12px] text-slate-500"><Info size={14} className="shrink-0 mt-0.5" />
              Какво предшества и какво последва — така се вижда какво отключва поведението и коя реакция помага.</div>
            <div>
              <span className={label}>Преди това</span>
              <Chips options={ANTECEDENTS} value={v.antecedents} onChange={a => set({ antecedents: a })} />
              <input value={v.antecedent_note} onChange={e => set({ antecedent_note: e.target.value })} placeholder="подробности…" className="mt-2 w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[13px]" />
            </div>
            <div>
              <span className={label}>След това / реакция</span>
              <Chips options={CONSEQUENCES} value={v.consequences} onChange={c => set({ consequences: c })} />
              <input value={v.consequence_note} onChange={e => set({ consequence_note: e.target.value })} placeholder="подробности…" className="mt-2 w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[13px]" />
            </div>
          </div>

          <div>
            <span className={label}>Направено веднага</span>
            <Chips options={ACTIONS} value={v.actions} onChange={a => set({ actions: a, parents_notified: a.includes('уведомен родител') })} tone="emerald" />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-200">
          <span className="text-[12px] text-slate-400">{!v.participants.length ? 'Добавете поне едно дете' : v.description.trim().length < 5 ? 'Опишете какво се случи' : ''}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">Отказ</button>
            <button type="button" onClick={save} disabled={busy || !ok}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запиши
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
