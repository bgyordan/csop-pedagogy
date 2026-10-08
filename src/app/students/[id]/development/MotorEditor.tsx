'use client'

// Редактор на двигателна оценка (ФВС): основна (ключовите проби) или подробна (всички, с опити, страни и качество).

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save, Trash2, MessageSquare, Info, AlertTriangle } from 'lucide-react'
import { DOMAINS, ITEMS, MSCALE, CODES, SUPPORT, STAGES, DETAIL, CONDITIONS, UNIT, resultText, isEmptyResult, fmtD, compare } from '@/lib/motor'
import type { MotorItem, MotorSession, MotorResult } from '@/lib/motor'

export type MR = Omit<MotorResult, 'session_id' | 'item'>
export type MotorInput = {
  stage: string; detail: string; assessed_on: string; conditions: Record<string, string>
  profile: Record<string, { strengths?: string; priority?: string }>; observations: string
  results: Record<number, MR>
}

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
const numIn = (s: string) => { const v = s.replace(',', '.').trim(); return v === '' || Number.isNaN(Number(v)) ? null : Number(v) }

/** Числово поле, което позволява „1,5“ докато се пише */
export function NumInput({ value, onChange, disabled, className, placeholder }: {
  value: number | null | undefined; onChange: (v: number | null) => void; disabled?: boolean; className?: string; placeholder?: string
}) {
  const [s, setS] = useState(value === null || value === undefined ? '' : String(value).replace('.', ','))
  useEffect(() => {
    if (numIn(s) !== (value ?? null)) setS(value === null || value === undefined ? '' : String(value).replace('.', ','))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return <input inputMode="decimal" value={s} disabled={disabled} placeholder={placeholder} className={className}
    onChange={e => { setS(e.target.value); onChange(numIn(e.target.value)) }} />
}

const EMPTY: MR = { score: null, code: null, t1: null, t2: null, l: null, r: null, pref: null, support: [], quality: [], note: null }

export default function MotorEditor({ session, template, prevResults, results, sessions, gmfcs, academicYearId, readOnly, assessorName, onClose, onSave, onDelete, startDetail }: {
  session: MotorSession | null
  template: MotorSession | null          // „повтори“: същите проби и условия
  prevResults: Record<number, MotorResult> // последният резултат на всяка проба преди тази оценка
  results: MotorResult[]
  sessions: MotorSession[]
  gmfcs: number | null
  academicYearId: string | null
  readOnly: boolean; assessorName?: string
  startDetail?: string
  onClose: () => void; onSave: (v: MotorInput) => Promise<void>; onDelete?: () => Promise<void>
}) {
  const own = useMemo(() => {
    const m: Record<number, MR> = {}
    if (session) results.filter(r => r.session_id === session.id).forEach(r => { const { session_id: _s, item, ...rest } = r; m[item] = rest })
    return m
  }, [session, results])
  const templItems = useMemo(() => new Set(template ? results.filter(r => r.session_id === template.id).map(r => r.item) : []), [template, results])

  const [stage, setStage] = useState(() => {
    if (session) return session.stage
    const done = new Set(sessions.filter(s => s.academic_year_id === academicYearId).map(s => s.stage))
    return !done.has('entry') ? 'entry' : !done.has('mid') ? 'mid' : 'exit'
  })
  const [detail, setDetail] = useState(session?.detail || template?.detail || startDetail || 'basic')
  const [date, setDate] = useState(session?.assessed_on || today())
  const [conditions, setConditions] = useState<Record<string, string>>(session?.conditions || template?.conditions || {})
  const [profile, setProfile] = useState(session?.profile || {})
  const [observations, setObservations] = useState(session?.observations || '')
  const [vals, setVals] = useState<Record<number, MR>>(own)
  const [domain, setDomain] = useState(() => {
    const first = ITEMS.find(i => own[i.no] || templItems.has(i.no))
    return first?.domain || DOMAINS[0].key
  })
  const [openNote, setOpenNote] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [showCond, setShowCond] = useState(!session && !template)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const adv = detail === 'advanced'
  const visible = (it: MotorItem) => adv || it.basic || !!vals[it.no] || templItems.has(it.no)
  const list = ITEMS.filter(it => it.domain === domain && visible(it))
  const filled = (no: number) => !isEmptyResult(vals[no])
  const countIn = (d: string) => ITEMS.filter(i => i.domain === d && filled(i.no)).length
  const total = ITEMS.filter(i => filled(i.no)).length
  const lowMobility = (gmfcs ?? 0) >= 4

  const upd = (no: number, patch: Partial<MR>) => {
    if (readOnly) return
    setVals(p => ({ ...p, [no]: { ...EMPTY, ...p[no], ...patch } }))
  }
  const toggleScore = (no: number, v: number) => upd(no, vals[no]?.score === v ? { score: null } : { score: v, code: null })
  const toggleCode = (no: number, c: string) => upd(no, vals[no]?.code === c ? { code: null } : { code: c, score: null })
  const toggleArr = <T,>(arr: T[], x: T) => arr.includes(x) ? arr.filter(y => y !== x) : [...arr, x]

  function markStandingNA() {
    setVals(p => {
      const n = { ...p }
      ITEMS.filter(i => i.stand && visible(i) && isEmptyResult(n[i.no])).forEach(i => { n[i.no] = { ...EMPTY, code: 'НП' } })
      return n
    })
  }

  async function save() {
    setErr('')
    const res: Record<number, MR> = {}
    Object.entries(vals).forEach(([k, v]) => { if (!isEmptyResult(v)) res[Number(k)] = v })
    if (!Object.keys(res).length) { setErr('Попълни поне една проба.'); return }
    setBusy(true)
    try { await onSave({ stage, detail, assessed_on: date, conditions, profile, observations, results: res }) }
    catch (e: any) { setErr(e?.message || 'Грешка при запис.'); setBusy(false) }
  }

  const dm = DOMAINS.find(d => d.key === domain)!
  const inp = 'w-20 px-2 py-1.5 rounded-lg border border-slate-300 text-[13px] focus:outline-none focus:border-[#0f2240] disabled:bg-slate-50'

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto panel-in">
      <div className="max-w-6xl mx-auto my-0 md:my-6 bg-white md:rounded-3xl shadow-2xl overflow-hidden">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-5 md:px-8 py-3.5 bg-white/95 backdrop-blur border-b border-slate-200">
          <span className="font-semibold text-slate-900">{session ? (readOnly ? 'Двигателна оценка' : 'Редакция — двигателна оценка') : 'Нова двигателна оценка'}</span>
          {readOnly && <span className="text-[13px] text-slate-500">{assessorName ? assessorName + ' · ' : ''}{fmtD(date)} · {STAGES[stage]} · {DETAIL[detail]}</span>}
          {!readOnly && (<>
            <div className="flex rounded-xl bg-slate-100 p-0.5 text-[13px]">
              {Object.entries(DETAIL).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setDetail(k)} title={k === 'basic' ? 'Ключовите проби: оценка 0–4, една стойност и подкрепа' : 'Всички 62 проби: два опита, ляво/дясно, качество на движението, профил по области'}
                  className={`px-3 py-1.5 rounded-lg ${detail === k ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500'}`}>{l}</button>
              ))}
            </div>
            <div className="flex rounded-xl bg-slate-100 p-0.5 text-[13px]">
              {Object.entries(STAGES).filter(([k]) => k !== 'current' || stage === 'current').map(([k, l]) => (
                <button key={k} type="button" onClick={() => setStage(k)}
                  className={`px-3 py-1.5 rounded-lg ${stage === k ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500'}`}>{l}</button>
              ))}
            </div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] focus:outline-none focus:border-[#0f2240]" />
          </>)}
          <div className="ml-auto flex items-center gap-2">
            {!readOnly && <span className="text-[12px] text-slate-500">Проби: <b className="text-slate-800">{total}</b></span>}
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

        {/* Условия */}
        <div className="px-5 md:px-8 pt-4">
          <button type="button" onClick={() => setShowCond(s => !s)} className="text-[12px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-800">
            <span className={`inline-block transition-transform ${showCond ? 'rotate-90' : ''}`}>›</span> Данни и условия
            {!showCond && Object.values(conditions).some(Boolean) && <span className="ml-2 normal-case tracking-normal font-normal text-slate-400">попълнени</span>}
          </button>
          {showCond && (
            <div className="mt-2 grid md:grid-cols-2 gap-3">
              {CONDITIONS.map(c => (
                <label key={c.k} className="block">
                  <span className="block text-[12px] text-slate-500 mb-1">{c.label}</span>
                  <input value={conditions[c.k] || ''} readOnly={readOnly} placeholder={c.ph}
                    onChange={e => setConditions(p => ({ ...p, [c.k]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-[13px] focus:outline-none focus:border-[#0f2240]" />
                </label>
              ))}
              <p className="md:col-span-2 text-[12px] text-slate-500 flex gap-1.5"><Info size={14} className="shrink-0 mt-0.5" />
                При болка, замайване, необичаен задух, внезапна слабост или силен дистрес пробата се прекратява. За проследяване пазете същите разстояния, пособия, инструкции и помощни средства.</p>
            </div>
          )}
          {lowMobility && !readOnly && (
            <div className="mt-3 flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-900">
              <AlertTriangle size={15} className="shrink-0" /> В профила е GMFCS {gmfcs === 4 ? 'IV' : 'V'} — пробите в стоеж, скоковете и бягането обикновено са НП; изберете задачи в седеж.
              <button type="button" onClick={markStandingNA} className="ml-auto px-3 py-1 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-[12px]">Отбележи НП на пробите в стоеж</button>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-[250px_1fr] mt-3">
          <nav className="bg-slate-50/80 border-y md:border-b-0 md:border-r border-slate-200 p-3 md:p-4 flex md:flex-col gap-1 overflow-x-auto">
            {DOMAINS.map(d => {
              const c = countIn(d.key), on = domain === d.key
              const n = ITEMS.filter(i => i.domain === d.key && visible(i)).length
              if (!n) return null
              return (
                <button key={d.key} type="button" onClick={() => { setDomain(d.key); setOpenNote(null) }}
                  className={`shrink-0 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[13px] transition-colors ${on ? 'bg-white shadow-sm ring-1 ring-slate-200 text-slate-900 font-medium' : 'text-slate-600 hover:bg-white/70'}`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="flex-1">{d.label}</span>
                  {c > 0 ? <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{c}/{n}</span> : <span className="text-[11px] text-slate-400">{n}</span>}
                </button>
              )
            })}
          </nav>

          <div className="p-5 md:p-7 min-w-0">
            <h3 className="text-lg font-semibold mb-1" style={{ color: dm.color }}>{dm.label}</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[11.5px] text-slate-500">
              {MSCALE.map(s => <span key={s.v} className="inline-flex items-center gap-1.5"><span className="w-5 h-5 rounded-md text-[11px] font-semibold flex items-center justify-center" style={{ background: s.bg, color: s.fg }}>{s.v}</span>{s.label}</span>)}
              <span>· Кодовете {Object.entries(CODES).map(([k, l]) => `${k} – ${l}`).join(', ')} не са 0 точки.</span>
            </div>

            <div className="space-y-2">
              {list.map(it => {
                const v = vals[it.no] || EMPTY
                const p = prevResults[it.no]
                const ch = p && !isEmptyResult(v) ? compare(it, p, v) : null
                const u = UNIT[it.measure]
                return (
                  <div key={it.no} className={`rounded-xl border px-3 py-2.5 ${filled(it.no) ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50/50'}`}>
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex-1 min-w-[220px]">
                        <div className="text-[14px] text-slate-800"><span className="text-slate-400 mr-1">{it.no}.</span>{it.name}
                          {it.stand && lowMobility && <span className="ml-2 text-[11px] text-amber-700">в стоеж</span>}
                          {templItems.has(it.no) && !session && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">от предишната</span>}
                        </div>
                        <div className="text-[12px] text-slate-500">{it.how} <span className="text-slate-400">Записва се: {it.record}</span></div>
                        {p && <div className="text-[11.5px] text-slate-400 mt-0.5">преди: {resultText(it, p)}{ch && ch.dir !== null && <span className={ch.dir > 0 ? 'text-emerald-700' : ch.dir < 0 ? 'text-rose-700' : ''}> · {ch.dir > 0 ? '↑' : ch.dir < 0 ? '↓' : '='} {ch.why}</span>}</div>}
                      </div>
                      <div className="flex flex-wrap gap-1 items-center">
                        {MSCALE.map(s => (
                          <button key={s.v} type="button" onClick={() => toggleScore(it.no, s.v)} title={s.label} disabled={readOnly}
                            className={`w-9 h-9 rounded-lg text-[13px] font-semibold transition-all ${v.score === s.v ? 'ring-2 ring-offset-1 ring-[#0f2240] scale-105' : 'opacity-60 hover:opacity-100'} disabled:cursor-default`}
                            style={{ background: s.bg, color: s.fg }}>{s.v}</button>
                        ))}
                        <span className="w-1" />
                        {Object.entries(CODES).map(([c, l]) => (
                          <button key={c} type="button" onClick={() => toggleCode(it.no, c)} title={l} disabled={readOnly}
                            className={`h-9 px-1.5 rounded-lg text-[11px] font-semibold border border-dashed border-slate-300 text-slate-500 bg-slate-50 ${v.code === c ? 'ring-2 ring-offset-1 ring-[#0f2240] opacity-100' : 'opacity-60 hover:opacity-100'} disabled:cursor-default`}>{c}</button>
                        ))}
                        {!readOnly && (
                          <button type="button" onClick={() => setOpenNote(openNote === it.no ? null : it.no)} title="Бележка"
                            className={`p-1.5 rounded-lg ${v.note ? 'text-[#0f2240]' : 'text-slate-400 hover:text-slate-700'}`}><MessageSquare size={15} /></button>
                        )}
                      </div>
                    </div>

                    {/* Стойности и подкрепа */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-slate-600">
                      {it.measure === 'pref' ? (
                        <label className="flex items-center gap-1.5">Предпочитание
                          <input value={v.pref || ''} disabled={readOnly} onChange={e => upd(it.no, { pref: e.target.value || null })}
                            placeholder={it.no === 23 ? 'ляво/дясно око' : 'ръка Д, крак Л…'} className={inp + ' w-40'} />
                        </label>
                      ) : it.sides ? (<>
                        <label className="flex items-center gap-1.5">Ляво <NumInput value={v.l} disabled={readOnly} onChange={x => upd(it.no, { l: x })} className={inp} />{u}</label>
                        <label className="flex items-center gap-1.5">Дясно <NumInput value={v.r} disabled={readOnly} onChange={x => upd(it.no, { r: x })} className={inp} />{u}</label>
                      </>) : it.measure !== 'none' ? (<>
                        <label className="flex items-center gap-1.5">{adv && it.trials ? 'Опит 1' : 'Резултат'}
                          <NumInput value={v.t1} disabled={readOnly} onChange={x => upd(it.no, { t1: x })} className={inp} />
                          {it.measure === 'hits' && it.of ? `от ${it.of}` : u}{it.of && it.measure !== 'hits' ? <span className="text-slate-400">(до {it.of})</span> : null}
                        </label>
                        {adv && it.trials && (
                          <label className="flex items-center gap-1.5">Опит 2
                            <NumInput value={v.t2} disabled={readOnly} onChange={x => upd(it.no, { t2: x })} className={inp} />{u}
                          </label>
                        )}
                      </>) : null}
                      <span className="flex items-center gap-1 flex-wrap">
                        <span className="text-slate-500 mr-0.5" title="Подкрепа за разбиране на инструкцията — отделно от двигателния резултат">Подкрепа:</span>
                        {SUPPORT.map(s => {
                          const on = v.support.includes(s.k)
                          return (
                            <button key={s.k} type="button" disabled={readOnly} title={s.label} onClick={() => upd(it.no, { support: toggleArr(v.support, s.k) })}
                              className={`px-1.5 py-0.5 rounded-md border text-[11.5px] ${on ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'border-slate-300 text-slate-500 hover:border-slate-500'} disabled:cursor-default`}>{s.k}</button>
                          )
                        })}
                      </span>
                    </div>

                    {adv && it.quality && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="text-[12px] text-slate-500 mr-1">Качество:</span>
                        {it.quality.map((q, qi) => {
                          const on = v.quality.includes(qi)
                          return (
                            <button key={qi} type="button" disabled={readOnly} onClick={() => upd(it.no, { quality: toggleArr(v.quality, qi).sort() })}
                              className={`text-left px-2 py-1 rounded-lg border text-[12px] ${on ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'border-slate-200 text-slate-500 hover:border-slate-400'} disabled:cursor-default`}>
                              {on ? '✓ ' : ''}{q}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {(openNote === it.no || !!v.note) && (
                      <input value={v.note || ''} readOnly={readOnly} autoFocus={!readOnly && openNote === it.no}
                        onChange={e => upd(it.no, { note: e.target.value || null })}
                        placeholder="Наблюдение: качество, асиметрия, умора, мотивация, адаптация…"
                        className="mt-2 w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] focus:outline-none focus:border-[#0f2240]" />
                    )}
                  </div>
                )
              })}
            </div>

            {adv && (
              <div className="mt-6 grid md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Силни страни и затруднения</span>
                  <textarea value={profile[domain]?.strengths || ''} readOnly={readOnly} rows={3}
                    onChange={e => setProfile(p => ({ ...p, [domain]: { ...p[domain], strengths: e.target.value } }))}
                    placeholder="Конкретни умения — проба, резултат, подкрепа (не „добър“/„слаб“)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-[13px] focus:outline-none focus:border-[#0f2240] resize-y" />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Приоритет за работа</span>
                  <textarea value={profile[domain]?.priority || ''} readOnly={readOnly} rows={3}
                    onChange={e => setProfile(p => ({ ...p, [domain]: { ...p[domain], priority: e.target.value } }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-[13px] focus:outline-none focus:border-[#0f2240] resize-y" />
                </label>
              </div>
            )}

            <div className="mt-6">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Наблюдения за разбиране, болка, умора, мотивация и адаптации</label>
              <textarea value={observations} readOnly={readOnly} onChange={e => setObservations(e.target.value)} rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-[14px] focus:outline-none focus:border-[#0f2240] resize-y" />
            </div>

            {!readOnly && (
              <div className="mt-4 flex justify-end">
                {(() => {
                  const vis = DOMAINS.filter(d => ITEMS.some(i => i.domain === d.key && visible(i)))
                  const nx = vis[vis.findIndex(d => d.key === domain) + 1]
                  return nx ? (
                    <button type="button" onClick={() => setDomain(nx.key)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border border-slate-300 hover:border-[#0f2240]">
                      Следваща: {nx.label} →
                    </button>
                  ) : (
                    <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm bg-emerald-600 text-white hover:bg-emerald-700">
                      <Save size={15} /> Готово — запиши
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
