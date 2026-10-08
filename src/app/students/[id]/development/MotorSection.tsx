'use client'

// „Двигателна оценка“ в досието → Развитие: оценки по етапи, сравнение „входящ → повторен → извод“ по проби, цели.
// Без общ бал и без проценти — детето се сравнява само със себе си (по методиката на картата).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Plus, RotateCcw, FileDown, Target, Check, Trash2, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import MotorEditor from './MotorEditor'
import type { MotorInput } from './MotorEditor'
import { DOMAINS, ITEMS, STAGES, DETAIL, MOTOR_ROLES, GAS_LABEL, itemOf, resultText, compare, sortSessions, fmtD } from '@/lib/motor'
import type { MotorSession, MotorResult, MotorGoal } from '@/lib/motor'

const MANAGERS = ['admin', 'zdud', 'director']

export default function MotorSection({ studentId, studentName, className, academicYearId, meId, role, gmfcs }: {
  studentId: string; studentName: string; className: string; academicYearId: string | null; meId: string; role: string; gmfcs: number | null
}) {
  const supabase = createClient()
  const [data, setData] = useState<{ sessions: MotorSession[]; results: MotorResult[]; goals: MotorGoal[]; names: Record<string, string> } | null>(null)
  const [err, setErr] = useState('')
  const [editor, setEditor] = useState<{ s: MotorSession | null; template: MotorSession | null; detail?: string } | null>(null)
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [exporting, setExporting] = useState(false)
  const canAssess = MOTOR_ROLES.includes(role)
  const isManager = MANAGERS.includes(role)

  const load = useCallback(async () => {
    const [ss, gg] = await Promise.all([
      supabase.from('motor_sessions').select('*').eq('student_id', studentId),
      supabase.from('motor_goals').select('*').eq('student_id', studentId).order('set_at'),
    ])
    if (ss.error) { setErr('Двигателната оценка още не е подготвена в базата — пуснете SQL файла 2026-10-08_motor.sql.'); return }
    const sessions = sortSessions((ss.data || []) as MotorSession[])
    const ids = sessions.map(s => s.id)
    const { data: rs } = ids.length ? await supabase.from('motor_results').select('*').in('session_id', ids) : { data: [] as MotorResult[] }
    const staff = Array.from(new Set(sessions.map(s => s.assessor_id).filter(Boolean))) as string[]
    const { data: st } = staff.length ? await supabase.from('staff_profiles').select('id, first_name, last_name').in('id', staff) : { data: [] as any[] }
    const names: Record<string, string> = {}
    ;(st || []).forEach((s: any) => { names[s.id] = `${s.first_name} ${s.last_name}` })
    setData({ sessions, results: (rs || []) as MotorResult[], goals: (gg.data || []) as MotorGoal[], names })
  }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const sessions = data?.sessions || []
  const fromId = from && sessions.some(s => s.id === from) ? from : sessions[0]?.id || ''
  const toId = to && sessions.some(s => s.id === to) ? to : sessions[sessions.length - 1]?.id || ''
  const byS = useMemo(() => {
    const m: Record<string, Record<number, MotorResult>> = {}
    ;(data?.results || []).forEach(r => { (m[r.session_id] ||= {})[r.item] = r })
    return m
  }, [data])
  const canEdit = (s: MotorSession) => s.assessor_id === meId || isManager

  // последният резултат на всяка проба преди дадена оценка (за подсказка „преди“)
  function prevFor(s: MotorSession | null): Record<number, MotorResult> {
    const out: Record<number, MotorResult> = {}
    const until = s ? sessions.findIndex(x => x.id === s.id) : sessions.length
    sessions.slice(0, until).forEach(x => Object.values(byS[x.id] || {}).forEach(r => { out[r.item] = r }))
    return out
  }

  async function save(s: MotorSession | null, v: MotorInput) {
    let id = s?.id
    const row = { assessed_on: v.assessed_on, stage: v.stage, detail: v.detail, conditions: v.conditions, profile: v.profile, observations: v.observations.trim() || null }
    if (!id) {
      const { data: r, error } = await supabase.from('motor_sessions').insert({ ...row, student_id: studentId, academic_year_id: academicYearId, assessor_id: meId }).select('id').single()
      if (error) throw error
      id = r!.id as string
    } else {
      const { error } = await supabase.from('motor_sessions').update(row).eq('id', id)
      if (error) throw error
      const { error: e2 } = await supabase.from('motor_results').delete().eq('session_id', id)
      if (e2) throw e2
    }
    const rows = Object.entries(v.results).map(([item, r]) => ({ session_id: id, item: Number(item), ...r, note: r.note?.trim() || null }))
    if (rows.length) { const { error } = await supabase.from('motor_results').insert(rows); if (error) throw error }
    setEditor(null)
    await load()
  }

  async function remove(s: MotorSession) {
    await supabase.from('motor_sessions').delete().eq('id', s.id)
    setEditor(null)
    await load()
  }

  async function exportWord() {
    if (!data) return
    setExporting(true)
    try {
      const { exportMotor } = await import('@/lib/motor-docx')
      const ia = sessions.findIndex(s => s.id === fromId), ib = sessions.findIndex(s => s.id === toId)
      const A = sessions[Math.min(ia, ib)], B = sessions[Math.max(ia, ib)]
      await exportMotor({ studentName, className, sessions, A, B, results: data.results, goals: data.goals, names: data.names })
    } finally { setExporting(false) }
  }

  if (err) return <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">{err}</div>
  if (!data) return <div className="flex items-center gap-2 py-12 justify-center text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Зареждане…</div>

  // по-ранната е „от“, дори да са избрани обратно
  const ia = sessions.findIndex(s => s.id === fromId), ib = sessions.findIndex(s => s.id === toId)
  const A = sessions[Math.min(ia, ib)], B = sessions[Math.max(ia, ib)]
  const shown = A && B ? sessions.slice(Math.min(ia, ib), Math.max(ia, ib) + 1) : sessions.slice(-1)
  const itemsUsed = ITEMS.filter(it => shown.some(s => byS[s.id]?.[it.no]))
  // извод: последният резултат до A спрямо последния до B (за пробите, оценявани в различни дни)
  const lastUpTo = (s: MotorSession | undefined, no: number) => {
    if (!s) return undefined
    const idx = sessions.indexOf(s)
    for (let i = idx; i >= 0; i--) { const r = byS[sessions[i].id]?.[no]; if (r) return r }
    return undefined
  }
  const tally = { up: 0, same: 0, down: 0 }
  const verdicts: Record<number, ReturnType<typeof compare>> = {}
  if (A && B && A.id !== B.id) itemsUsed.forEach(it => {
    const v = compare(it, lastUpTo(A, it.no), lastUpTo(B, it.no)); verdicts[it.no] = v
    if (v.dir === 1) tally.up++; else if (v.dir === -1) tally.down++; else if (v.dir === 0) tally.same++
  })
  const last = sessions[sessions.length - 1]
  const label = (s: MotorSession) => `${fmtD(s.assessed_on)} · ${STAGES[s.stage] || ''}`

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-800 mr-auto">Двигателна оценка (ФВС)</h3>
          {canAssess && (<>
            {last && <button type="button" onClick={() => setEditor({ s: null, template: last })}
              title="Същите проби и условия като последната оценка — за сравнимост"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] border border-slate-300 hover:border-[#0f2240]"><RotateCcw size={14} /> Повторна оценка</button>}
            <button type="button" onClick={() => setEditor({ s: null, template: null, detail: 'basic' })}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] bg-[#0f2240] text-white hover:bg-[#1a3560]"><Plus size={14} /> Основна</button>
            <button type="button" onClick={() => setEditor({ s: null, template: null, detail: 'advanced' })}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] border border-[#0f2240] text-[#0f2240] hover:bg-slate-50"><Plus size={14} /> Подробна</button>
          </>)}
        </div>
        <p className="text-[12px] text-slate-500 mt-1">Работна педагогическа карта, не диагностичен тест: без общ бал и без норми — детето се сравнява със собственото си предходно изпълнение. Основната оценка е с ключовите {ITEMS.filter(i => i.basic).length} проби; подробната — всички {ITEMS.length}, с опити, ляво/дясно и качество на движението.</p>

        {sessions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {sessions.map(s => (
              <button key={s.id} type="button" onClick={() => setEditor({ s, template: null })}
                className="text-left px-3 py-2 rounded-xl border border-slate-200 hover:border-[#0f2240] bg-slate-50/50">
                <div className="text-[13px] font-medium text-slate-800">{label(s)}</div>
                <div className="text-[11.5px] text-slate-500">{DETAIL[s.detail]} · {Object.keys(byS[s.id] || {}).length} проби{s.assessor_id && data.names[s.assessor_id] ? ' · ' + data.names[s.assessor_id] : ''}</div>
              </button>
            ))}
          </div>
        ) : <div className="mt-4 text-sm text-slate-400">Още няма двигателна оценка.</div>}
      </div>

      {sessions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 md:px-5 py-3 border-b border-slate-200">
            <span className="text-[13px] text-slate-500">От</span>
            <select value={fromId} onChange={e => setFrom(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-300 text-[13px]">
              {sessions.map(s => <option key={s.id} value={s.id}>{label(s)}</option>)}
            </select>
            <span className="text-[13px] text-slate-500">до</span>
            <select value={toId} onChange={e => setTo(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-300 text-[13px]">
              {sessions.map(s => <option key={s.id} value={s.id}>{label(s)}</option>)}
            </select>
            {A && B && A.id !== B.id && (
              <span className="text-[12.5px] text-slate-600 ml-2">
                <span className="text-emerald-700">↑ {tally.up} напредък</span> · <span>= {tally.same} без промяна</span> · <span className="text-rose-700">↓ {tally.down} регрес</span>
              </span>
            )}
            <button type="button" onClick={exportWord} disabled={exporting || !A || !B}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] border border-slate-300 hover:border-[#0f2240] disabled:opacity-50">
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Word
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-slate-200 text-[11.5px] text-slate-500">
                <th className="text-left px-4 py-2 font-medium">Проба</th>
                {shown.map(s => <th key={s.id} className="text-left px-3 py-2 font-medium whitespace-nowrap">{fmtD(s.assessed_on)}<div className="font-normal">{STAGES[s.stage]}</div></th>)}
                {A && B && A.id !== B.id && <th className="text-left px-3 py-2 font-medium">Извод</th>}
              </tr></thead>
              <tbody>
                {DOMAINS.map(d => {
                  const rows = itemsUsed.filter(i => i.domain === d.key)
                  if (!rows.length) return null
                  return [
                    <tr key={d.key} className="bg-slate-50"><td colSpan={shown.length + 2} className="px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: d.color }}>{d.label}</td></tr>,
                    ...rows.map(it => {
                      const v = verdicts[it.no]
                      return (
                        <tr key={it.no} className="border-b border-slate-100 last:border-0">
                          <td className="px-4 py-1.5 text-slate-800"><span className="text-slate-400 mr-1">{it.no}.</span>{it.name}</td>
                          {shown.map(s => {
                            const r = byS[s.id]?.[it.no]
                            return <td key={s.id} className="px-3 py-1.5 text-slate-700 whitespace-nowrap" title={r?.note || ''}>{r ? resultText(it, r) : <span className="text-slate-300">—</span>}{r?.quality?.length && it.quality ? <span className="text-slate-400"> · к {r.quality.length}/{it.quality.length}</span> : null}</td>
                          })}
                          {A && B && A.id !== B.id && (
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              {v?.dir === 1 ? <span className="inline-flex items-center gap-1 text-emerald-700"><ArrowUp size={13} />{v.why}</span>
                                : v?.dir === -1 ? <span className="inline-flex items-center gap-1 text-rose-700"><ArrowDown size={13} />{v.why}</span>
                                : v?.dir === 0 ? <span className="inline-flex items-center gap-1 text-slate-500"><Minus size={13} />{v.why}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                          )}
                        </tr>
                      )
                    }),
                  ]
                })}
              </tbody>
            </table>
          </div>
          <p className="px-4 md:px-5 py-2 text-[11.5px] text-slate-500 border-t border-slate-100">
            Изводът сравнява последните резултати до двете дати: първо физическата помощ (0–4), после подкрепата за инструкцията, после стойността (време, разстояние, успехи; над 10%) и качеството. При променени условия го отбележете — може да обясни разликата. При устойчиви затруднения, болка, регрес или изразена асиметрия — обсъдете с екипа и съответния специалист.
          </p>
        </div>
      )}

      <GoalsPanel goals={data.goals} canEdit={canAssess} onChange={load} studentId={studentId} meId={meId} />

      {editor && (
        <MotorEditor session={editor.s} template={editor.template} startDetail={editor.detail}
          prevResults={prevFor(editor.s)} results={data.results} sessions={sessions} gmfcs={gmfcs} academicYearId={academicYearId}
          readOnly={!!editor.s && !canEdit(editor.s)} assessorName={editor.s?.assessor_id ? data.names[editor.s.assessor_id] : undefined}
          onClose={() => setEditor(null)} onSave={v => save(editor.s, v)}
          onDelete={editor.s && canEdit(editor.s) ? () => remove(editor.s!) : undefined} />
      )}
    </div>
  )
}

// Индивидуални цели: ситуация + действие + критерий + допустима помощ + срок; проследяване с GAS (−2…+2).
function GoalsPanel({ goals, canEdit, onChange, studentId, meId }: { goals: MotorGoal[]; canEdit: boolean; onChange: () => Promise<void>; studentId: string; meId: string }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ item: '', situation: '', action: '', criterion: '', help: '', due: '' })
  const [busy, setBusy] = useState(false)
  const text = [f.situation, f.action, f.criterion, f.help].map(x => x.trim()).filter(Boolean).join(', ')

  async function add() {
    if (!text) return
    setBusy(true)
    const it = f.item ? itemOf(Number(f.item)) : undefined
    const { error } = await supabase.from('motor_goals').insert({ student_id: studentId, item: it?.no ?? null, domain: it?.domain ?? null, goal: text, due: f.due || null, set_by: meId })
    setBusy(false)
    if (error) { alert(error.message); return }
    setF({ item: '', situation: '', action: '', criterion: '', help: '', due: '' }); setOpen(false)
    await onChange()
  }
  async function patch(id: string, p: Partial<MotorGoal>) { await supabase.from('motor_goals').update(p).eq('id', id); await onChange() }
  async function del(id: string) { if (!confirm('Да изтрия ли целта?')) return; await supabase.from('motor_goals').delete().eq('id', id); await onChange() }
  const inp = 'w-full px-3 py-2 rounded-xl border border-slate-300 text-[13px] focus:outline-none focus:border-[#0f2240]'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
      <div className="flex items-center gap-2">
        <Target size={16} className="text-[#0f2240]" />
        <h3 className="font-semibold text-slate-800 mr-auto">Двигателни цели</h3>
        {canEdit && !open && <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] border border-slate-300 hover:border-[#0f2240]"><Plus size={14} /> Цел</button>}
      </div>
      {open && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
          <select value={f.item} onChange={e => setF({ ...f, item: e.target.value })} className={inp}>
            <option value="">— проба (по желание) —</option>
            {DOMAINS.map(d => <optgroup key={d.key} label={d.label}>{ITEMS.filter(i => i.domain === d.key).map(i => <option key={i.no} value={i.no}>{i.no}. {i.name}</option>)}</optgroup>)}
          </select>
          <div className="grid md:grid-cols-2 gap-2">
            <input value={f.situation} onChange={e => setF({ ...f, situation: e.target.value })} placeholder="Ситуация: „до края на срока, в час по ФВС“" className={inp} />
            <input value={f.action} onChange={e => setF({ ...f, action: e.target.value })} placeholder="Действие: „улавя голяма мека топка от 1 м“" className={inp} />
            <input value={f.criterion} onChange={e => setF({ ...f, criterion: e.target.value })} placeholder="Критерий: „в 4 от 5 опита, в две поредни занятия“" className={inp} />
            <input value={f.help} onChange={e => setF({ ...f, help: e.target.value })} placeholder="Допустима помощ: „след демонстрация, без физическа помощ“" className={inp} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[13px] text-slate-600 flex items-center gap-1.5">Срок <input type="date" value={f.due} onChange={e => setF({ ...f, due: e.target.value })} className="px-2 py-1.5 rounded-lg border border-slate-300 text-[13px]" /></label>
            {text && <span className="text-[12.5px] text-slate-600 italic flex-1">„{text}“</span>}
            <button type="button" onClick={() => setOpen(false)} className="ml-auto px-3 py-1.5 rounded-lg text-[13px] text-slate-600 hover:bg-slate-100">Откажи</button>
            <button type="button" onClick={add} disabled={!text || busy} className="px-4 py-1.5 rounded-lg text-[13px] bg-[#0f2240] text-white disabled:opacity-50">Добави</button>
          </div>
        </div>
      )}
      {goals.length === 0 && !open && <p className="mt-2 text-sm text-slate-400">Няма поставени цели. Формула: ситуация + действие + критерий + допустима помощ + срок.</p>}
      <div className="mt-3 space-y-2">
        {goals.map(g => {
          const it = g.item ? itemOf(g.item) : undefined
          return (
            <div key={g.id} className={`rounded-xl border px-3 py-2.5 ${g.achieved_at ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-start gap-2">
                <div className="flex-1 min-w-[220px]">
                  <div className="text-[13.5px] text-slate-800">{g.goal}</div>
                  <div className="text-[11.5px] text-slate-500">{it ? `${it.no}. ${it.name} · ` : ''}{g.due ? `срок ${fmtD(g.due)}` : ''}{g.achieved_at ? ` · постигната ${fmtD(g.achieved_at.slice(0, 10))}` : ''}</div>
                </div>
                <select value={g.gas ?? ''} disabled={!canEdit} onChange={e => patch(g.id, { gas: e.target.value === '' ? null : Number(e.target.value) })}
                  title="GAS — спрямо очакваното за това дете" className="px-2 py-1 rounded-lg border border-slate-300 text-[12.5px]">
                  <option value="">GAS —</option>
                  {[-2, -1, 0, 1, 2].map(v => <option key={v} value={v}>{v > 0 ? '+' + v : v} {GAS_LABEL[v]}</option>)}
                </select>
                {canEdit && <button type="button" onClick={() => patch(g.id, { achieved_at: g.achieved_at ? null : new Date().toISOString() })}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12.5px] border ${g.achieved_at ? 'border-emerald-300 text-emerald-700' : 'border-slate-300 text-slate-600'}`}><Check size={13} /> {g.achieved_at ? 'Постигната' : 'Отбележи постигната'}</button>}
                {canEdit && <button type="button" onClick={() => del(g.id)} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50" title="Изтрий"><Trash2 size={14} /></button>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
