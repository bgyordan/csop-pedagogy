'use client'

// Цели с оценка GAS: за всяка цел — какво е реално очаквано за това дете (= 0),
// а на всеки етап — оценка от −2 (много под очакваното) до +2 (много над очакваното).

import { useState } from 'react'
import { Star, ChevronDown, Check } from 'lucide-react'
import { AREAS, GAS, gasOf, fmtD, KINDS, scaleOf } from './lib'
import type { Skill, Assessment, Target, Gas } from './lib'

export default function TargetsPanel({ targets, skills, assessments, gas, current, canEdit, onExpected, onRate }: {
  targets: Target[]; skills: Skill[]; assessments: Assessment[]; gas: Gas[]; current: Record<string, number>
  canEdit: boolean; onExpected: (targetId: string, text: string) => Promise<void>; onRate: (targetId: string, assessmentId: string, v: number | null) => Promise<void>
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const gasBy: Record<string, Record<string, number>> = {}
  gas.forEach(g => { (gasBy[g.target_id] ||= {})[g.assessment_id] = g.gas })

  const lastGas = (t: Target) => {
    for (let i = assessments.length - 1; i >= 0; i--) { const v = gasBy[t.id]?.[assessments[i].id]; if (v !== undefined) return v }
    return undefined
  }
  const rated = targets.map(lastGas).filter(v => v !== undefined) as number[]
  const reached = rated.filter(v => v >= 0).length

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2.5 flex items-center gap-1.5">
        <Star size={12} className="text-amber-500" /> Цели {targets.length > 0 && `· ${targets.length}`}
        {rated.length > 0 && <span className="normal-case tracking-normal font-normal text-slate-600 ml-2">постигнато очакваното: <b className="text-emerald-700">{reached}/{rated.length}</b></span>}
      </div>
      {targets.length === 0 ? (
        <p className="text-[13px] text-slate-400">Отбележи със звездичка умение в таблицата по-долу, за да стане цел.</p>
      ) : (
        <div className="space-y-1.5">
          {targets.map(t => {
            const sk = skills.find(s => s.id === t.skill_id); if (!sk) return null
            const area = AREAS.find(a => a.key === sk.area)
            const lg = lastGas(t), cur = current[sk.id]
            const isOpen = open === t.id
            return (
              <div key={t.id} className={`rounded-xl border ${isOpen ? 'border-slate-300' : 'border-slate-200'}`}>
                <button type="button" onClick={() => setOpen(isOpen ? null : t.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: area?.color }} />
                  <span className="text-[13px] text-slate-800 flex-1 min-w-0 truncate">{sk.label}</span>
                  {cur !== undefined && <span className="text-[11px] px-1.5 py-0.5 rounded-md shrink-0" style={{ background: scaleOf(cur).bg, color: scaleOf(cur).fg }}>{scaleOf(cur).short}</span>}
                  {lg !== undefined
                    ? <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold shrink-0" style={{ background: gasOf(lg).bg, color: gasOf(lg).fg }} title={gasOf(lg).label}>{lg > 0 ? '+' : ''}{lg}</span>
                    : <span className="text-[11px] text-slate-400 shrink-0">без GAS</span>}
                  <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-3">
                    <div>
                      <label className="block text-[11.5px] text-slate-500 mb-1">Очакван резултат до края на годината (= 0)</label>
                      <textarea value={draft[t.id] ?? t.expected ?? ''} readOnly={!canEdit} rows={2}
                        onChange={e => setDraft(d => ({ ...d, [t.id]: e.target.value }))}
                        onBlur={() => { if (draft[t.id] !== undefined && draft[t.id] !== (t.expected ?? '')) onExpected(t.id, draft[t.id]) }}
                        placeholder="Напр. „Седи с подкана 5 минути по време на занимание“"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[13px] focus:outline-none focus:border-[#0f2240] resize-none" />
                    </div>
                    {assessments.length > 0 && (
                      <div className="space-y-1.5">
                        {assessments.map(a => {
                          const v = gasBy[t.id]?.[a.id]
                          return (
                            <div key={a.id} className="flex flex-wrap items-center gap-2">
                              <span className="text-[12px] text-slate-600 w-[130px]">{fmtD(a.assessed_on)} · {KINDS[a.kind] || ''}</span>
                              <div className="flex gap-1">
                                {GAS.map(g => (
                                  <button key={g.v} type="button" disabled={!canEdit} title={g.label}
                                    onClick={() => onRate(t.id, a.id, v === g.v ? null : g.v)}
                                    className={`w-9 h-7 rounded-md text-[12px] font-semibold transition-all ${v === g.v ? 'ring-2 ring-offset-1 ring-[#0f2240]' : 'opacity-50 hover:opacity-100'} disabled:cursor-default`}
                                    style={{ background: g.bg, color: g.fg }}>{g.v > 0 ? '+' : ''}{g.v}</button>
                                ))}
                              </div>
                              {v !== undefined && <span className="text-[11.5px] text-slate-600 inline-flex items-center gap-1">{v >= 0 && <Check size={12} className="text-emerald-600" />}{gasOf(v).label}</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
