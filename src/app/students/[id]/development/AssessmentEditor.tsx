'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, Save, Plus, MessageSquare, Trash2, Check } from 'lucide-react'
import { AREAS, SCALE, KINDS, STAGES, LEVELS, NA, NA_STYLE, scaleOf, fmtD, profileUpTo, severity, openLevels } from './lib'
import type { Skill, Assessment, Score, AreaKey, Profile } from './lib'

export type AssessmentInput = {
  kind: string; assessed_on: string; notes: Record<string, string>
  scores: Record<string, { score: number; note: string }>
}

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })

export default function AssessmentEditor({ skills, assessments, scores, assessment, role, readOnly, assessorName, onClose, onSave, onDelete, onAddSkill, profile, academicYearId }: {
  skills: Skill[]; assessments: Assessment[]; scores: Score[]; assessment: Assessment | null; role: string
  profile: Profile | null; academicYearId: string | null
  readOnly: boolean; assessorName?: string
  onClose: () => void; onSave: (v: AssessmentInput) => Promise<void>; onDelete?: () => Promise<void>
  onAddSkill: (area: AreaKey, label: string) => Promise<Skill | null>
}) {
  const own = useMemo(() => {
    const m: Record<string, { score: number; note: string }> = {}
    if (assessment) scores.filter(s => s.assessment_id === assessment.id).forEach(s => { m[s.skill_id] = { score: s.score, note: s.note || '' } })
    return m
  }, [assessment, scores])
  // Предишното ниво на всяко умение (за подсказка)
  const prev = useMemo(() => {
    const idx = assessment ? assessments.findIndex(a => a.id === assessment.id) - 1 : assessments.length - 1
    return idx >= 0 ? profileUpTo(assessments, scores, idx) : {}
  }, [assessment, assessments, scores])

  // Следващият етап за годината: входна → междинна → изходна
  const [kind, setKind] = useState(() => {
    if (assessment) return assessment.kind
    const done = new Set(assessments.filter(a => a.academic_year_id === academicYearId).map(a => a.kind))
    return !done.has('entry') ? 'entry' : !done.has('mid') ? 'mid' : 'exit'
  })
  const stageOpts = assessment?.kind === 'current' ? KINDS : STAGES
  const [levelsOpen, setLevelsOpen] = useState<number[]>(() => openLevels(severity(profile)))
  const [date, setDate] = useState(assessment?.assessed_on || today())
  const [vals, setVals] = useState(own)
  const [notes, setNotes] = useState<Record<string, string>>(assessment?.notes || {})
  const [openNote, setOpenNote] = useState<string | null>(null)
  const mine = AREAS.filter(a => a.roles.includes(role)).map(a => a.key)
  const [area, setArea] = useState<AreaKey>(() => {
    const used = AREAS.find(a => skills.some(s => s.area === a.key && own[s.id]))
    return used?.key || (mine[0] as AreaKey) || 'gross_motor'
  })
  const [newSkill, setNewSkill] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const list = skills.filter(s => s.area === area && (s.active || vals[s.id]))
  const countIn = (a: AreaKey) => skills.filter(s => s.area === a && vals[s.id]).length
  const total = Object.keys(vals).length

  function setScore(id: string, v: number) {
    if (readOnly) return
    setVals(p => {
      const n = { ...p }
      if (n[id]?.score === v) delete n[id]
      else n[id] = { score: v, note: n[id]?.note || '' }
      return n
    })
  }

  async function save() {
    setErr('')
    if (!total) { setErr('Оцени поне едно умение.'); return }
    setBusy(true)
    try { await onSave({ kind, assessed_on: date, notes, scores: vals }) }
    catch (e: any) { setErr(e?.message || 'Грешка при запис.'); setBusy(false) }
  }

  async function addSkill() {
    if (!newSkill.trim()) return
    const s = await onAddSkill(area, newSkill.trim())
    if (s) setNewSkill('')
  }

  const meta = AREAS.find(a => a.key === area)!

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto panel-in">
      <div className="max-w-6xl mx-auto my-0 md:my-6 bg-white md:rounded-3xl shadow-2xl overflow-hidden">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-5 md:px-8 py-3.5 bg-white/95 backdrop-blur border-b border-slate-200">
          <span className="font-semibold text-slate-900">{assessment ? (readOnly ? 'Оценка' : 'Редакция на оценка') : 'Нова оценка'}</span>
          {readOnly && assessorName && <span className="text-[13px] text-slate-500">{assessorName} · {fmtD(date)}</span>}
          {!readOnly && (<>
            <div className="flex rounded-xl bg-slate-100 p-0.5 text-[13px]">
              {Object.entries(stageOpts).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`px-3 py-1.5 rounded-lg ${kind === k ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500'}`}>{l}</button>
              ))}
            </div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] focus:outline-none focus:border-[#0f2240]" />
          </>)}
          <div className="ml-auto flex items-center gap-2">
            {!readOnly && <span className="text-[12px] text-slate-500">Оценени: <b className="text-slate-800">{total}</b></span>}
            {onDelete && !readOnly && (
              <button type="button" onClick={async () => { if (confirm('Да изтрия ли тази оценка?')) { setBusy(true); await onDelete() } }}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50" title="Изтрий"><Trash2 size={16} /></button>
            )}
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100">{readOnly ? 'Затвори' : 'Откажи'}</button>
            {!readOnly && (
              <button type="button" onClick={save} disabled={busy}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium bg-[#0f2240] text-white hover:bg-[#1a3560] disabled:opacity-60">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Запиши
              </button>
            )}
          </div>
        </div>
        {err && <div className="mx-5 md:mx-8 mt-4 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800">{err}</div>}

        <div className="grid md:grid-cols-[250px_1fr]">
          {/* Области */}
          <nav className="bg-slate-50/80 border-b md:border-b-0 md:border-r border-slate-200 p-3 md:p-4 flex md:flex-col gap-1 overflow-x-auto">
            {AREAS.map(a => {
              const c = countIn(a.key), on = area === a.key
              return (
                <button key={a.key} type="button" onClick={() => { setArea(a.key); setOpenNote(null) }}
                  className={`shrink-0 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[13px] transition-colors ${on ? 'bg-white shadow-sm ring-1 ring-slate-200 text-slate-900 font-medium' : 'text-slate-600 hover:bg-white/70'}`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                  <span className="flex-1">{a.label}</span>
                  {c > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{c}</span>}
                  {mine.includes(a.key) && c === 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#0f2240]/40" title="Твоя област" />}
                </button>
              )
            })}
          </nav>

          {/* Умения */}
          <div className="p-5 md:p-7 min-w-0">
            <h3 className="text-lg font-semibold mb-1" style={{ color: meta.color }}>{meta.label}</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[11.5px] text-slate-500">
              {SCALE.map(s => <span key={s.v} className="inline-flex items-center gap-1.5"><span className="w-5 h-5 rounded-md text-[11px] font-semibold flex items-center justify-center" style={{ background: s.bg, color: s.fg }}>{s.v}</span>{s.label}</span>)}
              <span className="inline-flex items-center gap-1.5"><span className="w-6 h-5 rounded-md text-[10px] font-semibold flex items-center justify-center border border-dashed border-slate-300" style={{ background: NA_STYLE.bg, color: '#64748b' }}>н/п</span>Неприложимо</span>
            </div>

            {[1, 2, 3].map(lv => {
              const rows = list.filter(sk => (sk.level || 2) === lv)
              if (!rows.length) return null
              const isOpen = levelsOpen.includes(lv) || rows.some(r => vals[r.id])
              return (
              <div key={lv} className="mb-4">
                <button type="button" onClick={() => setLevelsOpen(o => o.includes(lv) ? o.filter(x => x !== lv) : [...o, lv])}
                  className="flex items-center gap-2 mb-1.5 text-[12px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-800">
                  <span className={`inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span> {LEVELS[lv]} <span className="font-normal normal-case tracking-normal text-slate-400">{rows.length}</span>
                </button>
                {isOpen && (
            <div className="space-y-1.5">
              {rows.map(sk => {
                const v = vals[sk.id]?.score
                const p = prev[sk.id]
                return (
                  <div key={sk.id} className={`rounded-xl border px-3 py-2 ${v !== undefined ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50/50'}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex-1 min-w-[200px] text-[14px] text-slate-800">{sk.label}</span>
                      {p !== undefined && <span className="text-[11px] text-slate-400" title={`Предишно: ${scaleOf(p).label}`}>преди: {p === NA ? 'н/п' : p}</span>}
                      <div className="flex gap-1">
                        {SCALE.map(s => {
                          const on = v === s.v
                          return (
                            <button key={s.v} type="button" onClick={() => setScore(sk.id, s.v)} title={s.label} disabled={readOnly}
                              className={`w-9 h-9 rounded-lg text-[13px] font-semibold transition-all ${on ? 'ring-2 ring-offset-1 ring-[#0f2240] scale-105' : 'opacity-60 hover:opacity-100'} disabled:cursor-default`}
                              style={{ background: s.bg, color: s.fg }}>{s.v}</button>
                          )
                        })}
                        <button type="button" onClick={() => setScore(sk.id, NA)} title="Неприложимо за това дете — не влиза в процента" disabled={readOnly}
                          className={`w-9 h-9 rounded-lg text-[11px] font-semibold transition-all border border-dashed border-slate-300 ${v === NA ? 'ring-2 ring-offset-1 ring-[#0f2240]' : 'opacity-60 hover:opacity-100'} disabled:cursor-default`}
                          style={{ background: NA_STYLE.bg, color: '#64748b' }}>н/п</button>
                      </div>
                      {!readOnly && v !== undefined && (
                        <button type="button" onClick={() => setOpenNote(openNote === sk.id ? null : sk.id)} title="Бележка"
                          className={`p-1.5 rounded-lg ${vals[sk.id]?.note ? 'text-[#0f2240]' : 'text-slate-400 hover:text-slate-700'}`}><MessageSquare size={15} /></button>
                      )}
                    </div>
                    {(openNote === sk.id || (readOnly && vals[sk.id]?.note)) && (
                      <input value={vals[sk.id]?.note || ''} readOnly={readOnly} autoFocus={!readOnly}
                        onChange={e => setVals(pv => ({ ...pv, [sk.id]: { ...pv[sk.id], note: e.target.value } }))}
                        placeholder="Наблюдение, условия, вид помощ…"
                        className="mt-2 w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] focus:outline-none focus:border-[#0f2240]" />
                    )}
                  </div>
                )
              })}
            </div>
                )}
              </div>
              )
            })}

            {!readOnly && (
              <div className="mt-3 flex gap-2">
                <input value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSkill() }}
                  placeholder="Добави умение в тази област…"
                  className="flex-1 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-[13px] focus:outline-none focus:border-[#0f2240]" />
                <button type="button" onClick={addSkill} disabled={!newSkill.trim()}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240] disabled:opacity-40"><Plus size={14} /> Добави</button>
              </div>
            )}

            <div className="mt-6">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Обобщение за областта</label>
              <textarea value={notes[area] || ''} readOnly={readOnly} onChange={e => setNotes(n => ({ ...n, [area]: e.target.value }))} rows={3}
                placeholder="Силни страни, трудности, препоръки…"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-[14px] focus:outline-none focus:border-[#0f2240] resize-y" />
            </div>
            {!readOnly && (
              <div className="mt-4 flex justify-end">
                {(() => {
                  const i = AREAS.findIndex(a => a.key === area); const nx = AREAS[i + 1]
                  return nx ? (
                    <button type="button" onClick={() => setArea(nx.key)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border border-slate-300 hover:border-[#0f2240]">
                      Следваща: {nx.label} →
                    </button>
                  ) : (
                    <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm bg-emerald-600 text-white hover:bg-emerald-700">
                      <Check size={15} /> Готово — запиши
                    </button>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
