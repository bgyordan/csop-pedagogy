'use client'
// Занимание по РЕМЕЛКА — за минута: по кои умения от програмата се работи, на какво ниво на действие,
// с каква помощ и с каква дейност (с идеи по областта).

import { useState } from 'react'
import { X, Loader2, Check, Lightbulb } from 'lucide-react'
import { LEVELS, LEVEL_COLOR, LEVEL_TEXT, SUPPORT, PLACES, PARTS, AREA_IDEAS, todaySofia } from '@/lib/remelka'
import type { Goal, Skill, Support } from '@/lib/remelka'

export type SessionDraft = {
  held_on: string; minutes: number | null; place: string; note: string
  items: { skill_id: string; level: number; support: Support; activity: string }[]
}

export default function SessionForm({ goals, skills, levels, onClose, onSave }: {
  goals: Goal[]; skills: Skill[]; levels: Record<string, number>
  onClose: () => void; onSave: (d: SessionDraft) => Promise<void>
}) {
  const sk = Object.fromEntries(skills.map(s => [s.id, s]))
  const list = goals.filter(g => g.status === 'active' && sk[g.skill_id])
  const [date, setDate] = useState(todaySofia())
  const [minutes, setMinutes] = useState<number | null>(20)
  const [place, setPlace] = useState(PLACES[0])
  const [note, setNote] = useState('')
  // по подразбиране — нивото, следващо текущото (но не над целта)
  const [rows, setRows] = useState<Record<string, { on: boolean; level: number; support: Support; activity: string }>>(() =>
    Object.fromEntries(list.map(g => [g.skill_id, { on: false, level: Math.max(1, Math.min(g.target_level, (levels[g.skill_id] ?? 0) + 1)), support: 'partial' as Support, activity: '' }])))
  const [ideas, setIdeas] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (id: string, p: Partial<(typeof rows)[string]>) => setRows(r => ({ ...r, [id]: { ...r[id], ...p, on: p.on ?? true } }))
  const chosen = Object.entries(rows).filter(([, r]) => r.on)

  async function save() {
    if (!chosen.length) return
    setBusy(true)
    await onSave({ held_on: date, minutes, place, note, items: chosen.map(([skill_id, r]) => ({ skill_id, level: r.level, support: r.support, activity: r.activity })) })
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-2xl mx-auto my-0 md:my-8 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex-1"><h2 className="text-base text-[#0f2240]">Занимание</h2>
            <p className="text-[12px] text-slate-500">Отбележете уменията, по които работихте днес.</p></div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm" />
            <select value={minutes ?? ''} onChange={e => setMinutes(e.target.value ? Number(e.target.value) : null)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white">
              {[10, 15, 20, 30, 40, 45].map(m => <option key={m} value={m}>{m} мин</option>)}
            </select>
            <select value={place} onChange={e => setPlace(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white">
              {PLACES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          {!list.length && <p className="text-sm text-slate-500 py-6 text-center">Програмата е празна — първо добавете умения в „Програма“.</p>}
          {list.map(g => {
            const s = sk[g.skill_id], r = rows[g.skill_id]
            return (
              <div key={g.id} className={`rounded-2xl border px-4 py-3 transition-colors ${r.on ? 'border-[#0f2240]/30 bg-slate-50/60' : 'border-slate-200'}`}>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={r.on} onChange={e => set(g.skill_id, { on: e.target.checked })} className="mt-1 rounded" />
                  <span className="flex-1">
                    <span className="text-[11px] mr-1.5" style={{ color: PARTS[s.part].color }}>{s.code}</span>
                    <span className="text-[14px] text-slate-800">{s.title}</span>
                    <span className="block text-[11.5px] text-slate-400">{s.area}</span>
                  </span>
                </label>
                {r.on && (
                  <div className="mt-2.5 pl-6 space-y-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] text-slate-500 w-14">Ниво</span>
                      {LEVELS[s.part].filter(l => l.n > 0).map(l => (
                        <button key={l.n} type="button" onClick={() => set(g.skill_id, { level: l.n })} title={l.label}
                          className={`px-2 py-1 rounded-lg text-[12px] ${r.level === l.n ? 'ring-2 ring-[#0f2240]' : 'opacity-70 hover:opacity-100'}`}
                          style={{ background: LEVEL_COLOR[l.n], color: LEVEL_TEXT[l.n] }}>{l.n} · {l.short}</button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] text-slate-500 w-14">Помощ</span>
                      {(Object.keys(SUPPORT) as Support[]).map(k => (
                        <button key={k} type="button" onClick={() => set(g.skill_id, { support: k })}
                          className={`px-2.5 py-1 rounded-lg text-[12px] border ${r.support === k ? 'font-medium' : 'opacity-60 hover:opacity-100'}`}
                          style={{ background: SUPPORT[k].bg, color: SUPPORT[k].color, borderColor: r.support === k ? SUPPORT[k].color : 'transparent' }}>{SUPPORT[k].label}</button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input value={r.activity} onChange={e => set(g.skill_id, { activity: e.target.value })} placeholder="Какво правихте (игра, материал)…"
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px]" />
                      {AREA_IDEAS[s.area] && (
                        <button type="button" onClick={() => setIdeas(ideas === g.skill_id ? null : g.skill_id)} title="Идеи за дейности"
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"><Lightbulb size={16} /></button>
                      )}
                    </div>
                    {ideas === g.skill_id && (
                      <div className="flex flex-wrap gap-1.5">
                        {AREA_IDEAS[s.area].map(x => (
                          <button key={x} type="button" onClick={() => { set(g.skill_id, { activity: x }); setIdeas(null) }}
                            className="text-left px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[12px] text-amber-900 hover:bg-amber-100">{x}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Бележка — настроение, какво проработи, задача за вкъщи…"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">Отказ</button>
          <button type="button" onClick={save} disabled={busy || !chosen.length}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запази
          </button>
        </div>
      </div>
    </div>
  )
}
