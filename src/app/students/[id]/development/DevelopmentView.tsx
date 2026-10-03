'use client'

import { useMemo, useState } from 'react'
import { Plus, FileDown, Star, CheckCircle2, TrendingUp, TrendingDown, Minus, Sprout, ChevronDown, Loader2 } from 'lucide-react'
import Radar, { Spark } from './Radar'
import { AREAS, SCALE, KINDS, fmtD, profileUpTo, areaPct } from './lib'
import type { Skill, Assessment, Score, Target } from './lib'

export default function DevelopmentView({ skills, assessments, scores, targets, staffNames, canAssess, canEditAssessment, onNew, onOpen, onToggleTarget, onExport, exporting }: {
  skills: Skill[]; assessments: Assessment[]; scores: Score[]; targets: Target[]; staffNames: Record<string, string>
  canAssess: boolean; canEditAssessment: (a: Assessment) => boolean
  onNew: () => void; onOpen: (a: Assessment) => void; onToggleTarget: (skillId: string) => void
  onExport: (fromIdx: number, toIdx: number) => void; exporting?: boolean
}) {
  const n = assessments.length
  const [fromIdx, setFromIdx] = useState(0)
  const [toSel, setToIdx] = useState<number | null>(null)   // null = последната
  const toIdx = toSel ?? n - 1
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const from = Math.min(fromIdx, n - 1), to = Math.min(Math.max(toIdx, from), n - 1)

  const profiles = useMemo(() => assessments.map((_, i) => profileUpTo(assessments, scores, i)), [assessments, scores])
  const scoreAt = useMemo(() => {
    const m: Record<string, Record<string, number>> = {}
    scores.forEach(s => { (m[s.assessment_id] ||= {})[s.skill_id] = s.score })
    return m
  }, [scores])
  const activeSkills = skills.filter(s => s.active || scores.some(sc => sc.skill_id === s.id))
  const targetBy = Object.fromEntries(targets.map(t => [t.skill_id, t]))

  if (n === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-12 text-center">
        <span className="inline-flex w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 items-center justify-center"><Sprout size={28} /></span>
        <h2 className="text-lg font-semibold text-slate-900 mt-4">Още няма оценка на развитието</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Входната оценка показва откъдето тръгваме. Всяка следваща се сравнява с нея.</p>
        {canAssess && (
          <button type="button" onClick={onNew} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0f2240] text-white text-sm font-medium hover:bg-[#1a3560]">
            <Plus size={16} /> Входна оценка
          </button>
        )}
      </div>
    )
  }

  const before = AREAS.map(a => areaPct(profiles[from], activeSkills, a.key))
  const after = AREAS.map(a => areaPct(profiles[to], activeSkills, a.key))
  const last = assessments[n - 1]
  const label = (a: Assessment, i: number) => `${fmtD(a.assessed_on)} · ${KINDS[a.kind] || ''}${i === n - 1 ? ' (последна)' : ''}`
  const initials = (id: string | null) => (staffNames[id || ''] || '—').split(' ').map(w => w[0]).join('').slice(0, 2)

  return (
    <div className="space-y-5">
      {/* Горна лента */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><Sprout size={19} className="text-emerald-600" /> Развитие</h2>
          <p className="text-[13px] text-slate-500">{n} {n === 1 ? 'оценка' : 'оценки'} · последна {fmtD(last.assessed_on)}{last.assessor_id && staffNames[last.assessor_id] ? ` (${staffNames[last.assessor_id]})` : ''}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => onExport(from, to)} disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-700 hover:border-[#0f2240] disabled:opacity-60">
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Word
          </button>
          {canAssess && (
            <button type="button" onClick={onNew} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0f2240] text-white text-sm font-medium hover:bg-[#1a3560]">
              <Plus size={15} /> Нова оценка
            </button>
          )}
        </div>
      </div>

      {/* Профил + области */}
      <div className="grid lg:grid-cols-[400px_1fr] gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <Radar before={n > 1 ? before : AREAS.map(() => null)} after={after} />
          {n > 1 && (
            <div className="mt-3 space-y-2 text-[12.5px]">
              <label className="flex items-center gap-2">
                <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 3" /></svg>
                <select value={from} onChange={e => setFromIdx(+e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg border border-slate-300 bg-white">
                  {assessments.map((a, i) => <option key={a.id} value={i}>{label(a, i)}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke="#0f2240" strokeWidth="2.5" /></svg>
                <select value={to} onChange={e => setToIdx(+e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg border border-slate-300 bg-white">
                  {assessments.map((a, i) => i >= from && <option key={a.id} value={i}>{label(a, i)}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">По области</div>
          <div className="space-y-3">
            {AREAS.map((a, i) => {
              const b = before[i], v = after[i]
              const delta = n > 1 && b !== null && v !== null ? v - b : null
              const series = assessments.map((_, k) => areaPct(profiles[k], activeSkills, a.key))
              return (
                <div key={a.key} className="grid grid-cols-[210px_1fr_44px_56px_70px] items-center gap-3">
                  <span className="text-[13px] text-slate-800 truncate flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />{a.label}</span>
                  <div className="relative h-2.5 rounded-full bg-slate-100">
                    {v !== null && <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v}%`, background: a.color }} />}
                    {n > 1 && b !== null && <div className="absolute -top-1 -bottom-1 w-0.5 bg-slate-500 rounded" style={{ left: `calc(${b}% - 1px)` }} title={`Начало: ${b}%`} />}
                  </div>
                  <span className="text-[13px] font-semibold text-slate-900 text-right tabular-nums">{v === null ? '—' : `${v}%`}</span>
                  <span className="text-[12px] tabular-nums">
                    {delta === null ? '' : delta > 0
                      ? <span className="inline-flex items-center gap-0.5 text-emerald-700"><TrendingUp size={13} />+{delta}</span>
                      : delta < 0 ? <span className="inline-flex items-center gap-0.5 text-rose-700"><TrendingDown size={13} />{delta}</span>
                      : <span className="inline-flex items-center gap-0.5 text-slate-500"><Minus size={13} />0</span>}
                  </span>
                  <Spark vals={series} color={a.color} />
                </div>
              )
            })}
          </div>
          {/* Цели */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2.5 flex items-center gap-1.5"><Star size={12} className="text-amber-500" /> Цели {targets.length > 0 && `· ${targets.length}`}</div>
            {targets.length === 0 ? (
              <p className="text-[13px] text-slate-400">Отбележи със звездичка умение в таблицата по-долу, за да стане цел.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {targets.map(t => {
                  const sk = skills.find(s => s.id === t.skill_id); if (!sk) return null
                  const cur = profiles[n - 1][sk.id]
                  const done = cur !== undefined && cur >= 3
                  const sc = cur !== undefined ? SCALE[cur] : null
                  return (
                    <span key={t.id} className={`inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-xl border text-[12.5px] ${done ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                      <span className="w-2 h-2 rounded-full" style={{ background: AREAS.find(a => a.key === sk.area)?.color }} />
                      <span className="text-slate-800">{sk.label}</span>
                      {done ? <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><CheckCircle2 size={13} /> постигната</span>
                        : sc && <span className="px-1.5 py-0.5 rounded-md text-[11px]" style={{ background: sc.bg, color: sc.fg }}>{sc.short}</span>}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Решетка: умения × оценки */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-slate-100">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mr-2">Умения</span>
          {SCALE.map(s => (
            <span key={s.v} className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-600">
              <span className="w-3.5 h-3.5 rounded" style={{ background: s.bg }} />{s.label}
            </span>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50">
                <th className="w-8" />
                <th className="text-left font-medium text-slate-500 px-2 py-2 min-w-[240px] w-full">Умение</th>
                {assessments.map((a, i) => (
                  <th key={a.id} className="px-1 py-1.5 min-w-[76px] w-[80px] whitespace-nowrap">
                    <button type="button" onClick={() => onOpen(a)} title={`${KINDS[a.kind] || ''} · ${staffNames[a.assessor_id || ''] || ''}${canEditAssessment(a) ? ' — отвори за редакция' : ''}`}
                      className={`w-full rounded-lg px-1 py-1 text-[11px] leading-tight hover:bg-white hover:shadow-sm ${i === to ? 'text-[#0f2240] font-semibold' : 'text-slate-500 font-normal'}`}>
                      {fmtD(a.assessed_on).slice(0, 5)}<br />
                      <span className="text-[10px] text-slate-400">{(KINDS[a.kind] || '').slice(0, 4)}. · {initials(a.assessor_id)}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AREAS.map(area => {
                const rows = activeSkills.filter(s => s.area === area.key)
                if (!rows.length) return null
                const isClosed = closed[area.key]
                return [
                  <tr key={area.key} className="border-t border-slate-200 bg-white">
                    <td colSpan={2 + n} className="px-2 py-2">
                      <button type="button" onClick={() => setClosed(c => ({ ...c, [area.key]: !c[area.key] }))}
                        className="inline-flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: area.color }}>
                        <ChevronDown size={14} className={`transition-transform ${isClosed ? '-rotate-90' : ''}`} /> {area.label}
                        <span className="text-slate-400 font-normal">{rows.length}</span>
                      </button>
                    </td>
                  </tr>,
                  ...(isClosed ? [] : rows.map(sk => {
                    const t = targetBy[sk.id]
                    return (
                      <tr key={sk.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="text-center">
                          <button type="button" disabled={!canAssess} onClick={() => onToggleTarget(sk.id)} title={t ? 'Махни от целите' : 'Направи цел'}
                            className={`p-1 rounded ${t ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'} disabled:cursor-default`}>
                            <Star size={14} fill={t ? 'currentColor' : 'none'} />
                          </button>
                        </td>
                        <td className="px-2 py-1.5 text-slate-800">{sk.label}</td>
                        {assessments.map(a => {
                          const v = scoreAt[a.id]?.[sk.id]
                          const s = v !== undefined ? SCALE[v] : null
                          return (
                            <td key={a.id} className="px-1 py-1">
                              <div className="h-7 rounded-md flex items-center justify-center text-[11px] font-semibold"
                                style={s ? { background: s.bg, color: s.fg } : undefined} title={s ? s.label : 'не е оценено'}>
                                {s ? v : <span className="text-slate-200">·</span>}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })),
                ]
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
