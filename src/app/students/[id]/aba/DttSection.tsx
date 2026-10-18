'use client'

// DTT (дискретни опити): цели → сесии с опити + / P / − → % самостоятелни → автоматично „Усвоено“ по критерий.
// Подсказката (P) не се брои за самостоятелен верен отговор.

import { useMemo, useState } from 'react'
import {
  Plus, X, Loader2, Check, Trash2, Play, Pause, RotateCcw, Trophy, ChevronDown, ChevronRight, Undo2, Pencil,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { MARKS, DTT_AREAS, scoreOf, sortSessions, streakOf, todaySofia, fmtDate } from '@/lib/aba'
import type { Mark, Target, DttSession } from '@/lib/aba'
import DttChart from './DttChart'

const card = 'bg-white rounded-2xl border border-slate-200 shadow-sm'
const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'

export default function DttSection({ studentId, firstName, meId, isManager, targets, sessions, names, reload }: {
  studentId: string; firstName: string; meId: string; isManager: boolean
  targets: Target[]; sessions: DttSession[]; names: Record<string, string>; reload: () => Promise<void>
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [form, setForm] = useState<{ edit: Target | null; area?: string } | null>(null)
  const [run, setRun] = useState<Target | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [justMastered, setJustMastered] = useState<Target | null>(null)
  const [showDone, setShowDone] = useState(false)

  const byTarget = useMemo(() => {
    const m: Record<string, DttSession[]> = {}
    sessions.forEach(s => { (m[s.target_id] ||= []).push(s) })
    return m
  }, [sessions])
  const active = targets.filter(t => t.status === 'active')
  const paused = targets.filter(t => t.status === 'paused')
  const mastered = targets.filter(t => t.status === 'mastered').sort((a, b) => (b.mastered_on || '').localeCompare(a.mastered_on || ''))

  async function setStatus(t: Target, status: Target['status']) {
    const { error } = await supabase.from('dtt_targets').update({ status, mastered_on: status === 'mastered' ? todaySofia() : null }).eq('id', t.id)
    if (error) { toast(error.message, 'error'); return }
    await reload()
  }
  async function removeTarget(t: Target) {
    if (!confirm(`Да се изтрие ли целта „${t.title}“ заедно с всичките ѝ сесии?`)) return
    const { error } = await supabase.from('dtt_targets').delete().eq('id', t.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Целта е изтрита')
    await reload()
  }
  async function removeSession(s: DttSession) {
    if (!confirm(`Да се изтрие ли сесията от ${fmtDate(s.held_on)}?`)) return
    const { error } = await supabase.from('dtt_sessions').delete().eq('id', s.id)
    if (error) { toast(error.message, 'error'); return }
    await reload()
  }

  async function saveSession(t: Target, held_on: string, marks: string, note: string) {
    const { data, error } = await supabase.from('dtt_sessions')
      .insert({ target_id: t.id, student_id: studentId, held_on, marks, note: note.trim() || null, staff_id: meId || null })
      .select('*').single()
    if (error || !data) { toast(error?.message || 'Грешка', 'error'); return }
    setRun(null)
    // критерият: N поредни сесии с ≥ X% самостоятелни верни → „Усвоено“
    const { met } = streakOf(t, [...(byTarget[t.id] || []), data as DttSession])
    if (met && t.status === 'active') {
      const { error: e2 } = await supabase.from('dtt_targets').update({ status: 'mastered', mastered_on: held_on }).eq('id', t.id)
      if (!e2) { setJustMastered(t); toast('Целта е постигната!') }
    } else {
      toast(`Сесията е записана — ${scoreOf(marks).pct}%`)
    }
    await reload()
  }

  const Row = ({ t }: { t: Target }) => {
    const ss = sortSessions(byTarget[t.id] || [])
    const last = ss[ss.length - 1]
    const { streak } = streakOf(t, ss)
    const open = openId === t.id
    const sc = last ? scoreOf(last.marks) : null
    return (
      <div className={t.status === 'paused' ? 'opacity-70' : ''}>
        <div className="px-4 py-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setOpenId(open ? null : t.id)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div className="flex-1 min-w-[200px] cursor-pointer" onClick={() => setOpenId(open ? null : t.id)}>
            <div className="text-[14px] text-slate-800">{t.title}</div>
            <div className="text-[11.5px] text-slate-500">
              {t.area ? `${t.area} · ` : ''}критерий {t.criterion_pct}% в {t.criterion_sessions} поредни · {ss.length} сесии
              {t.status === 'mastered' && t.mastered_on ? ` · усвоено ${fmtDate(t.mastered_on)}` : ''}
              {t.status === 'paused' ? ' · пауза' : ''}
            </div>
          </div>
          {/* последните сесии — точки: зелено ≥ критерий */}
          <div className="flex items-center gap-1" title="Последните сесии">
            {ss.slice(-8).map(s => {
              const p = scoreOf(s.marks).pct, ok = p >= t.criterion_pct
              return <span key={s.id} className="w-7 h-5 rounded-md text-[10px] tabular-nums flex items-center justify-center border"
                style={{ background: ok ? '#f0fdf4' : '#f8fafc', color: ok ? '#15803d' : '#475569', borderColor: ok ? '#bbf7d0' : '#e2e8f0' }}>{p}</span>
            })}
          </div>
          {t.status === 'active' && (
            <span className="text-[11.5px] px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600 border-slate-200 tabular-nums" title="Поредни успешни сесии">
              {Math.min(streak, t.criterion_sessions)}/{t.criterion_sessions}
            </span>
          )}
          {t.status === 'mastered' && <span className="text-[11.5px] px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 inline-flex items-center gap-1"><Trophy size={12} /> Усвоено</span>}
          {t.status === 'active' && (
            <button type="button" onClick={() => setRun(t)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[13px] font-medium text-white" style={{ backgroundColor: '#0f2240' }}>
              <Play size={14} /> Сесия
            </button>
          )}
          {sc && t.status !== 'active' && <span className="text-[12px] text-slate-400">последно {sc.pct}%</span>}
        </div>
        {open && (
          <div className="px-4 pb-4 pl-12 space-y-3">
            <DttChart sessions={ss} criterion={t.criterion_pct} />
            {t.note && <p className="text-[12.5px] text-slate-600 whitespace-pre-wrap">{t.note}</p>}
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setForm({ edit: t })} className={btn}><Pencil size={14} /> Промени</button>
              {t.status === 'active' && <button type="button" onClick={() => setStatus(t, 'mastered')} className={btn}><Check size={14} className="text-emerald-600" /> Усвоено</button>}
              {t.status === 'active' && <button type="button" onClick={() => setStatus(t, 'paused')} className={btn}><Pause size={14} /> Пауза</button>}
              {t.status !== 'active' && <button type="button" onClick={() => setStatus(t, 'active')} className={btn}><RotateCcw size={14} /> Върни в работа</button>}
              <button type="button" onClick={() => removeTarget(t)} className={`${btn} hover:!text-rose-700 hover:!bg-rose-50`}><Trash2 size={14} /> Изтрий целта</button>
            </div>
            {ss.length > 0 && (
              <div className="rounded-xl border border-slate-100 divide-y divide-slate-100">
                {ss.slice().reverse().map((s, i) => {
                  const c = scoreOf(s.marks)
                  return (
                    <div key={s.id} className={`px-3 py-1.5 flex flex-wrap items-center gap-3 text-[12.5px] ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                      <span className="w-20 tabular-nums text-slate-600">{fmtDate(s.held_on)}</span>
                      <span className="flex gap-0.5">{s.marks.split('').map((m, k) => (
                        <span key={k} className="w-5 h-5 rounded text-[11px] flex items-center justify-center" style={{ background: MARKS[m as Mark].bg, color: MARKS[m as Mark].color }}>{m === '-' ? '−' : m}</span>
                      ))}</span>
                      <span className={`tabular-nums ${c.pct >= t.criterion_pct ? 'text-emerald-700' : 'text-slate-700'}`}>{c.pct}% ({c.correct} от {c.total})</span>
                      <span className="flex-1 text-slate-400 truncate">{[s.staff_id ? names[s.staff_id] : '', s.note].filter(Boolean).join(' · ')}</span>
                      {(s.staff_id === meId || isManager) && (
                        <button type="button" onClick={() => removeSession(s)} title="Изтрий сесията" className="p-1 rounded text-slate-300 hover:text-rose-700"><Trash2 size={13} /></button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className={`${card} px-4 py-3 flex flex-wrap items-center gap-2`}>
        <div className="flex-1 min-w-[220px]">
          <div className="text-[15px] text-slate-800">Дискретни опити (DTT)</div>
          <div className="text-[12px] text-slate-500">Цел → сесия с опити <b className="text-emerald-700">+</b> сам · <b className="text-amber-700">P</b> с подсказка · <b className="text-rose-700">−</b> грешно. Усвояването се отчита само.</div>
        </div>
        <button type="button" onClick={() => setForm({ edit: null })}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#0f2240' }}>
          <Plus size={15} /> Нова цел
        </button>
      </div>

      {justMastered && (
        <div className="rounded-2xl border px-4 py-3 flex flex-wrap items-center gap-3 bg-emerald-50 border-emerald-200 text-emerald-900">
          <Trophy size={18} className="shrink-0" />
          <div className="flex-1 min-w-[220px] text-[13.5px]">
            <b>„{justMastered.title}“</b> е усвоена — {justMastered.criterion_pct}% в {justMastered.criterion_sessions} поредни сесии. Можете да въведете следващата цел.
          </div>
          <button type="button" onClick={() => { setForm({ edit: null, area: justMastered.area || undefined }); setJustMastered(null) }}
            className="px-3 py-1.5 rounded-lg bg-white/80 border border-emerald-300 text-[12.5px] hover:bg-white inline-flex items-center gap-1"><Plus size={13} /> Следваща цел</button>
          <button type="button" onClick={() => setJustMastered(null)} className="p-1 rounded-lg hover:bg-white/60"><X size={15} /></button>
        </div>
      )}

      <section className={card}>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <h3 className="text-[14px] font-medium text-slate-800 flex-1">Текущи цели</h3>
          <span className="text-[12px] text-slate-400">{active.length}</span>
        </div>
        {active.length === 0
          ? <p className="px-4 py-6 text-[13px] text-slate-500 text-center">Няма текущи цели. С „Нова цел“ описвате какво точно трябва да прави {firstName || 'детето'}, напр. „Посочва червения цвят сред 3 опции“.</p>
          : <div className="divide-y divide-slate-100">{active.map(t => <Row key={t.id} t={t} />)}</div>}
        {paused.length > 0 && (
          <div className="border-t border-slate-100 divide-y divide-slate-100">
            <div className="px-4 pt-2.5 text-[11px] text-slate-400 uppercase tracking-widest">На пауза</div>
            {paused.map(t => <Row key={t.id} t={t} />)}
          </div>
        )}
      </section>

      {mastered.length > 0 && (
        <section className={card}>
          <button type="button" onClick={() => setShowDone(!showDone)} className="w-full px-4 py-3 flex items-center gap-2 text-left">
            <Trophy size={15} className="text-emerald-600" />
            <h3 className="text-[14px] font-medium text-slate-800 flex-1">Усвоени</h3>
            <span className="text-[12px] text-slate-400">{mastered.length}</span>
            {showDone ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
          </button>
          {showDone && <div className="border-t border-slate-100 divide-y divide-slate-100">{mastered.map(t => <Row key={t.id} t={t} />)}</div>}
        </section>
      )}

      {form && <TargetForm studentId={studentId} meId={meId} edit={form.edit} area={form.area} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await reload() }} />}
      {run && <SessionRunner target={run} onClose={() => setRun(null)} onSave={(d, m, n) => saveSession(run, d, m, n)} />}
    </div>
  )
}

function TargetForm({ studentId, meId, edit, area, onClose, onSaved }: {
  studentId: string; meId: string; edit: Target | null; area?: string; onClose: () => void; onSaved: () => Promise<void>
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [title, setTitle] = useState(edit?.title || '')
  const [ar, setAr] = useState(edit?.area || area || '')
  const [pct, setPct] = useState(edit?.criterion_pct ?? 80)
  const [n, setN] = useState(edit?.criterion_sessions ?? 3)
  const [trials, setTrials] = useState(edit?.trials_per_session ?? 10)
  const [note, setNote] = useState(edit?.note || '')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!title.trim()) return
    setBusy(true)
    const row = { title: title.trim(), area: ar || null, criterion_pct: pct, criterion_sessions: n, trials_per_session: trials, note: note.trim() || null }
    const { error } = edit
      ? await supabase.from('dtt_targets').update(row).eq('id', edit.id)
      : await supabase.from('dtt_targets').insert({ ...row, student_id: studentId, added_by: meId || null })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast(edit ? 'Целта е променена' : 'Целта е добавена')
    await onSaved()
  }

  const sel = 'px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white'
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-lg mx-auto my-0 md:my-12 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <h2 className="flex-1 text-base text-[#0f2240]">{edit ? 'Промяна на целта' : 'Нова цел'}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-[12px] text-slate-500">Какво точно трябва да прави детето</label>
            <input value={title} onChange={e => setTitle(e.target.value)} autoFocus placeholder="Посочва червения цвят сред 3 опции"
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
          </div>
          <div>
            <label className="text-[12px] text-slate-500">Област</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {DTT_AREAS.map(a => (
                <button key={a} type="button" onClick={() => setAr(ar === a ? '' : a)}
                  className={`px-2.5 py-1 rounded-lg text-[12.5px] border ${ar === a ? 'border-[#0f2240] text-[#0f2240] bg-slate-50 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{a}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] text-slate-500">Критерий за усвояване</label>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-slate-700">
              <select value={pct} onChange={e => setPct(Number(e.target.value))} className={sel}>
                {[60, 70, 80, 90, 100].map(v => <option key={v} value={v}>{v}%</option>)}
              </select>
              самостоятелни верни в
              <select value={n} onChange={e => setN(Number(e.target.value))} className={sel}>
                {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              поредни сесии
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <span className="text-[12px] text-slate-500">Опити в сесия</span>
            <select value={trials} onChange={e => setTrials(Number(e.target.value))} className={sel}>
              {[5, 8, 10, 12, 15, 20].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Как се провежда — материали, инструкция, какво е подсказка…"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} className={btn}>Отказ</button>
          <button type="button" onClick={save} disabled={busy || !title.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запази
          </button>
        </div>
      </div>
    </div>
  )
}

function SessionRunner({ target, onClose, onSave }: { target: Target; onClose: () => void; onSave: (held_on: string, marks: string, note: string) => Promise<void> }) {
  const [date, setDate] = useState(todaySofia())
  const [marks, setMarks] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const sc = scoreOf(marks)
  const full = marks.length >= target.trials_per_session

  async function save() {
    if (!marks) return
    setBusy(true)
    await onSave(date, marks, note)
    setBusy(false)
  }
  const add = (m: Mark) => setMarks(s => (s.length < 30 ? s + m : s))

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-lg mx-auto my-0 md:my-12 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <h2 className="text-base text-[#0f2240] truncate">{target.title}</h2>
            <p className="text-[12px] text-slate-500">{target.trials_per_session} опита · критерий {target.criterion_pct}%</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm" />

          {/* опитите досега */}
          <div className="flex flex-wrap gap-1.5 min-h-[36px]">
            {Array.from({ length: Math.max(target.trials_per_session, marks.length) }, (_, i) => {
              const m = marks[i] as Mark | undefined
              return (
                <span key={i} className="w-8 h-8 rounded-lg text-[14px] font-medium flex items-center justify-center border"
                  style={m ? { background: MARKS[m].bg, color: MARKS[m].color, borderColor: MARKS[m].color + '55' } : { borderColor: '#e2e8f0', borderStyle: 'dashed', color: '#cbd5e1' }}>
                  {m ? (m === '-' ? '−' : m) : i + 1}
                </span>
              )
            })}
          </div>

          {/* бутоните — големи, за таблет */}
          <div className="grid grid-cols-3 gap-2">
            {(['+', 'P', '-'] as Mark[]).map(m => (
              <button key={m} type="button" onClick={() => add(m)} title={MARKS[m].hint}
                className="py-5 rounded-2xl border-2 text-center transition-transform active:scale-95"
                style={{ background: MARKS[m].bg, color: MARKS[m].color, borderColor: MARKS[m].color + '40' }}>
                <span className="block text-2xl font-light leading-none">{m === '-' ? '−' : m}</span>
                <span className="block text-[12px] mt-1">{MARKS[m].label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <button type="button" onClick={() => setMarks(s => s.slice(0, -1))} disabled={!marks} className={`${btn} disabled:opacity-40`}><Undo2 size={14} /> Назад</button>
            <span className="flex-1 text-right tabular-nums text-slate-600">
              {marks ? <>{sc.correct} от {sc.total} сам — <b className={sc.pct >= target.criterion_pct ? 'text-emerald-700' : 'text-slate-800'}>{sc.pct}%</b></> : 'Отбележете всеки опит'}
            </span>
          </div>
          {full && <p className="text-[12px] text-emerald-700">Опитите за сесията са направени — запазете.</p>}
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Бележка (по желание) — вид подсказка, мотиватор, настроение…"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} className={btn}>Отказ</button>
          <button type="button" onClick={save} disabled={busy || !marks}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запази сесията
          </button>
        </div>
      </div>
    </div>
  )
}
