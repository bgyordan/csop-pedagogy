'use client'
// Диагностика по РЕМЕЛКА: по всяко умение — ниво (0–4) и видът на грешките. Попълва се по областите;
// неотбелязаните умения просто не влизат (не се броят за „не владее“).

import { useMemo, useState } from 'react'
import { X, Loader2, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { LEVELS, LEVEL_COLOR, LEVEL_TEXT, ERRORS, PARTS, KINDS, todaySofia } from '@/lib/remelka'
import type { Assessment, Kind, Part, Result, Skill } from '@/lib/remelka'

export type Draft = Record<string, { level: number; errors: string[]; note: string }>

export default function AssessmentEditor({ skills, parts, initial, prev, onClose, onSave }: {
  skills: Skill[]; parts: Part[]
  initial?: { a: Assessment; results: Result[] }
  /** предишните нива — за подсказка и за „като миналия път“ */
  prev: Record<string, number>
  onClose: () => void
  onSave: (head: { kind: Kind; held_on: string; note: string }, draft: Draft) => Promise<void>
}) {
  const [kind, setKind] = useState<Kind>(initial?.a.kind || (Object.keys(prev).length ? 'mid' : 'entry'))
  const [date, setDate] = useState(initial?.a.held_on || todaySofia())
  const [note, setNote] = useState(initial?.a.note || '')
  const [draft, setDraft] = useState<Draft>(() => Object.fromEntries((initial?.results || []).map(r => [r.skill_id, { level: r.level, errors: r.errors || [], note: r.note || '' }])))
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  const areas = useMemo(() => {
    const m = new Map<string, Skill[]>()
    skills.filter(s => !s.archived && parts.includes(s.part)).sort((a, b) => a.sort - b.sort)
      .forEach(s => { const k = `${s.part}|${s.area}`; (m.get(k) || m.set(k, []).get(k)!).push(s) })
    return Array.from(m.entries())
  }, [skills, parts])

  const EMPTY = { level: 0, errors: [] as string[], note: '' }
  const set = (id: string, patch: Partial<Draft[string]>) => setDraft(d => ({ ...d, [id]: { ...EMPTY, ...d[id], ...patch } }))
  const toggleErr = (id: string, e: string) => {
    const cur = draft[id]?.errors || []
    set(id, { errors: cur.includes(e) ? cur.filter(x => x !== e) : [...cur, e] })
  }
  const filled = Object.keys(draft).length

  async function save() {
    if (!filled) return
    setBusy(true)
    await onSave({ kind, held_on: date, note }, draft)
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-3xl mx-auto my-0 md:my-8 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <h2 className="text-base text-[#0f2240]">{initial ? 'Диагностика — редакция' : 'Нова диагностика'}</h2>
            <p className="text-[12px] text-slate-500">Отбележете нивото и КАК греши детето — програмата се подрежда по грешките.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(KINDS) as Kind[]).map(k => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={`px-3 py-1.5 rounded-xl text-sm border ${kind === k ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>{KINDS[k]}</button>
            ))}
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm" />
          </div>

          {/* легенда на нивата */}
          <div className="grid sm:grid-cols-2 gap-2">
            {parts.map(p => (
              <div key={p} className="rounded-xl border border-slate-200 px-3 py-2">
                <div className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: PARTS[p].color }}>{PARTS[p].label} — нива</div>
                {LEVELS[p].map(l => (
                  <div key={l.n} className="flex items-center gap-2 text-[12px] text-slate-600">
                    <span className="w-5 h-5 rounded-md text-[11px] font-semibold flex items-center justify-center" style={{ background: LEVEL_COLOR[l.n], color: LEVEL_TEXT[l.n] }}>{l.n}</span>{l.label}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {areas.map(([key, list]) => {
            const [part, area] = key.split('|') as [Part, string]
            const done = list.filter(s => draft[s.id]).length
            return (
              <section key={key} className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: PARTS[part].bg }}>
                  <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: PARTS[part].color }}>{PARTS[part].short}</span>
                  <span className="text-sm text-slate-800 font-medium flex-1">{area}</span>
                  <span className="text-[11px] text-slate-500">{done}/{list.length}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {list.map(s => {
                    const d = draft[s.id]
                    const showErr = open[s.id] || (d && d.errors.length > 0)
                    return (
                      <div key={s.id} className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex-1 min-w-[180px]">
                            <div className="text-[13.5px] text-slate-800"><span className="text-slate-400 text-[11px] mr-1.5">{s.code}</span>{s.title}</div>
                            {s.hint && <div className="text-[11.5px] text-slate-500">{s.hint}</div>}
                          </div>
                          <div className="flex items-center gap-1">
                            {LEVELS[part].map(l => (
                              <button key={l.n} type="button" title={l.label} onClick={() => set(s.id, { level: l.n })}
                                className={`w-8 h-8 rounded-lg text-[13px] font-semibold border transition-all ${d?.level === l.n ? 'ring-2 ring-offset-1 ring-[#0f2240]' : 'opacity-70 hover:opacity-100'}`}
                                style={{ background: LEVEL_COLOR[l.n], color: LEVEL_TEXT[l.n], borderColor: 'transparent' }}>{l.n}</button>
                            ))}
                            {prev[s.id] !== undefined && <span className="text-[10.5px] text-slate-400 ml-1" title="Предишно ниво">преди {prev[s.id]}</span>}
                            <button type="button" onClick={() => setOpen(o => ({ ...o, [s.id]: !o[s.id] }))} title="Видът на грешките"
                              className="ml-1 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">{showErr ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
                          </div>
                        </div>
                        {showErr && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {ERRORS[part].map(e => {
                              const on = d?.errors.includes(e)
                              return <button key={e} type="button" onClick={() => toggleErr(s.id, e)}
                                className={`px-2 py-0.5 rounded-full text-[11.5px] border ${on ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>{e}</button>
                            })}
                            <input value={d?.note || ''} onChange={e => set(s.id, { note: e.target.value })} placeholder="бележка…"
                              className="flex-1 min-w-[140px] px-2 py-0.5 rounded-lg border border-slate-200 text-[12px]" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}

          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Общи наблюдения — как работи, кое го мотивира, кое го уморява…"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
        </div>

        <div className="sticky bottom-0 bg-white flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-200">
          <span className="text-[12px] text-slate-500">Отбелязани умения: {filled}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">Отказ</button>
            <button type="button" onClick={save} disabled={busy || !filled}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запази
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
