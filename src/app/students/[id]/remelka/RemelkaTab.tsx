'use client'

// Таб „РЕМЕЛКА“ в досието: диагностика → програма по грешките → занимания → напредък.
// Картата на уменията показва с един поглед къде е детето; подсказките казват какво следва.
// Вижда се и се пише само от колегите, които работят с детето (+ координатори и ръководство).

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Loader2, Lock, Play, ClipboardCheck, BookOpen, Sparkles, AlertTriangle, Info, Plus, Check, Pause, Trash2, Calculator,
  Pencil, Settings2, X, Trophy, Printer,
} from 'lucide-react'
import Link from 'next/link'
import { gensForSkill } from '@/lib/sheets'
import { createClient } from '@/lib/supabase/client'
import { useToast, confirmDialog } from '@/components/ui/Toast'
import {
  PARTS, KINDS, LEVELS, LEVEL_COLOR, LEVEL_TEXT, SUPPORT, currentLevels, suggestProgram, insights, areaAverages, todaySofia, fmtDate,
} from '@/lib/remelka'
import type { Assessment, Goal, Part, Profile, Result, Session, SessionItem, Skill, Insight, Kind } from '@/lib/remelka'
import AssessmentEditor, { type Draft } from './AssessmentEditor'
import SessionForm, { type SessionDraft } from './SessionForm'
import Guide from './Guide'

const SQL_MSG = 'РЕМЕЛКА още не е подготвена в базата — пуснете SQL файла 2026-10-17_remelka.sql.'

export default function RemelkaTab({ studentId, firstName, meId, isManager }: { studentId: string; firstName: string; meId: string; isManager: boolean }) {
  const supabase = createClient()
  const { toast } = useToast()
  const [err, setErr] = useState('')
  const [access, setAccess] = useState<boolean | null>(null)
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [skills, setSkills] = useState<Skill[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [items, setItems] = useState<SessionItem[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [modal, setModal] = useState<'' | 'assess' | 'session' | 'guide' | 'settings'>('')
  const [editA, setEditA] = useState<Assessment | null>(null)
  const [newParts, setNewParts] = useState<Part[]>(['math', 'social'])
  const [busy, setBusy] = useState(false)
  const today = todaySofia()

  const load = useCallback(async () => {
    const { data: ok, error: e0 } = await supabase.rpc('works_with_student', { p_student: studentId })
    if (e0) { setErr(SQL_MSG); return }
    setAccess(!!ok)
    if (!ok) return
    const [pr, sk, as, rs, gl, se, si] = await Promise.all([
      supabase.from('remelka_profiles').select('*').eq('student_id', studentId).maybeSingle(),
      supabase.from('remelka_skills').select('*').order('sort'),
      supabase.from('remelka_assessments').select('*').eq('student_id', studentId).order('held_on'),
      supabase.from('remelka_results').select('assessment_id, skill_id, level, errors, note').eq('student_id', studentId),
      supabase.from('remelka_goals').select('*').eq('student_id', studentId).order('added_on'),
      supabase.from('remelka_sessions').select('*').eq('student_id', studentId).order('held_on', { ascending: false }).limit(500),
      supabase.from('remelka_session_items').select('id, session_id, skill_id, level, support, activity').eq('student_id', studentId).limit(5000),
    ])
    if (pr.error || sk.error) { setErr(SQL_MSG); return }
    setProfile((pr.data as Profile) || null)
    setSkills((sk.data || []) as Skill[])
    setAssessments((as.data || []) as Assessment[])
    setResults((rs.data || []) as Result[])
    setGoals((gl.data || []) as Goal[])
    setSessions((se.data || []) as Session[])
    setItems((si.data || []) as SessionItem[])
    const ids = Array.from(new Set([...(se.data || []).map((s: any) => s.staff_id), ...(as.data || []).map((a: any) => a.staff_id)].filter(Boolean))) as string[]
    if (ids.length) {
      const { data: st } = await supabase.from('staff_profiles').select('id, first_name, last_name').in('id', ids)
      setNames(Object.fromEntries((st || []).map((s: any) => [s.id, `${s.first_name} ${s.last_name}`])))
    }
  }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const sk = useMemo(() => Object.fromEntries(skills.map(s => [s.id, s])), [skills])
  const levels = useMemo(() => currentLevels(assessments, results, sessions, items), [assessments, results, sessions, items])
  const parts = profile?.parts?.length ? profile.parts : (['math', 'social'] as Part[])
  const activeGoals = goals.filter(g => g.status === 'active' && sk[g.skill_id])
  const suggested = useMemo(() => profile ? suggestProgram(skills, parts, levels, goals) : [], [profile, skills, parts, levels, goals]) // eslint-disable-line react-hooks/exhaustive-deps
  const tips = useMemo(() => profile ? insights(profile, skills, assessments, goals, sessions, items, today) : [], [profile, skills, assessments, goals, sessions, items, today])
  const areas = useMemo(() => {
    const m = new Map<string, Skill[]>()
    skills.filter(s => !s.archived && parts.includes(s.part)).forEach(s => { const k = `${s.part}|${s.area}`; (m.get(k) || m.set(k, []).get(k)!).push(s) })
    return Array.from(m.entries())
  }, [skills, parts]) // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">{err}</div>
  if (access === false) return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
      <Lock size={24} className="mx-auto mb-2 text-slate-300" />
      РЕМЕЛКА на детето виждат колегите, които работят с него — класен, учители, учител ЦОУД, терапевти и ЕПЛР екипът.
    </div>
  )
  if (profile === undefined || access === null) return <div className="flex justify-center py-10 text-slate-400"><Loader2 className="animate-spin" size={20} /></div>

  // ── действия ──
  async function start() {
    if (!newParts.length) return
    setBusy(true)
    const { error } = await supabase.from('remelka_profiles').insert({ student_id: studentId, parts: newParts, started_by: meId })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    await load()
    setModal('assess')
  }
  async function saveAssessment(head: { kind: Kind; held_on: string; note: string }, draft: Draft) {
    let aid = editA?.id
    if (aid) {
      const { error } = await supabase.from('remelka_assessments').update({ kind: head.kind, held_on: head.held_on, note: head.note || null }).eq('id', aid)
      if (error) { toast(error.message, 'error'); return }
      await supabase.from('remelka_results').delete().eq('assessment_id', aid)
    } else {
      const { data, error } = await supabase.from('remelka_assessments').insert({ student_id: studentId, kind: head.kind, held_on: head.held_on, note: head.note || null, staff_id: meId }).select('id').single()
      if (error || !data) { toast(error?.message || 'Грешка', 'error'); return }
      aid = data.id
    }
    const rows = Object.entries(draft).map(([skill_id, d]) => ({ assessment_id: aid, student_id: studentId, skill_id, level: d.level, errors: d.errors, note: d.note || null }))
    const { error: e2 } = await supabase.from('remelka_results').insert(rows)
    if (e2) { toast(e2.message, 'error'); return }
    toast('Диагностиката е записана')
    setModal(''); setEditA(null)
    await load()
  }
  async function removeAssessment(a: Assessment) {
    if (!await confirmDialog(`Да се изтрие ли диагностиката от ${fmtDate(a.held_on)}?`)) return
    const { error } = await supabase.from('remelka_assessments').delete().eq('id', a.id)
    if (error) { toast(error.message, 'error'); return }
    load()
  }
  async function addGoals(list: Skill[]) {
    if (!list.length) return
    const rows = list.map(s => ({ student_id: studentId, skill_id: s.id, added_by: meId, status: 'active' }))
    const { error } = await supabase.from('remelka_goals').upsert(rows, { onConflict: 'student_id,skill_id' })
    if (error) { toast(error.message, 'error'); return }
    toast(list.length > 1 ? `Добавени ${list.length} умения в програмата` : 'Добавено в програмата')
    load()
  }
  async function setGoal(g: Goal, patch: Partial<Goal>) {
    const { error } = await supabase.from('remelka_goals').update(patch).eq('id', g.id)
    if (error) { toast(error.message, 'error'); return }
    setGoals(x => x.map(i => i.id === g.id ? { ...i, ...patch } : i))
  }
  async function removeGoal(g: Goal) {
    const { error } = await supabase.from('remelka_goals').delete().eq('id', g.id)
    if (error) { toast(error.message, 'error'); return }
    setGoals(x => x.filter(i => i.id !== g.id))
  }
  async function master(goalId: string) {
    const g = goals.find(x => x.id === goalId)
    if (g) await setGoal(g, { status: 'mastered', mastered_on: today })
    toast('Браво! Умението е овладяно ✓')
  }
  async function saveSession(d: SessionDraft) {
    const { data, error } = await supabase.from('remelka_sessions').insert({ student_id: studentId, staff_id: meId, held_on: d.held_on, minutes: d.minutes, place: d.place, note: d.note || null }).select('id').single()
    if (error || !data) { toast(error?.message || 'Грешка', 'error'); return }
    const { error: e2 } = await supabase.from('remelka_session_items').insert(d.items.map(i => ({ ...i, activity: i.activity || null, session_id: data.id, student_id: studentId })))
    if (e2) { toast(e2.message, 'error'); return }
    toast('Заниманието е записано')
    setModal('')
    load()
  }
  async function removeSession(s: Session) {
    if (!await confirmDialog(`Да се изтрие ли заниманието от ${fmtDate(s.held_on)}?`)) return
    const { error } = await supabase.from('remelka_sessions').delete().eq('id', s.id)
    if (error) { toast(error.message, 'error'); return }
    load()
  }
  async function saveParts(p: Part[], active: boolean) {
    const { error } = await supabase.from('remelka_profiles').update({ parts: p, active, updated_at: new Date().toISOString() }).eq('student_id', studentId)
    if (error) { toast(error.message, 'error'); return }
    setModal(''); load()
  }
  function act(i: Insight) {
    const k = i.action?.kind
    if (k === 'assess') { setEditA(null); setModal('assess') }
    else if (k === 'session') setModal('session')
    else if (k === 'master' && i.action?.goalId) master(i.action.goalId)
    else if (k === 'program') document.getElementById('remelka-program')?.scrollIntoView({ behavior: 'smooth' })
  }

  const prevLevels = Object.fromEntries(Object.entries(levels))
  const card = 'bg-white rounded-2xl border border-slate-200 shadow-sm'
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'

  // ── още не е започната ──
  if (!profile) return (
    <div className={`${card} p-6 md:p-8`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0"><Calculator size={22} /></div>
        <div className="flex-1">
          <h3 className="text-lg text-slate-800">РЕМЕЛКА за {firstName}</h3>
          <p className="text-[13.5px] text-slate-600 mt-1 leading-relaxed">Методика за смятане и социални умения: първо диагностика къде и как греши детето,
            после програма точно по грешките — с игри и примери от ежедневието.</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {(Object.keys(PARTS) as Part[]).map(p => {
              const on = newParts.includes(p)
              return <button key={p} type="button" onClick={() => setNewParts(x => on ? x.filter(y => y !== p) : [...x, p])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border"
                style={on ? { background: PARTS[p].bg, color: PARTS[p].color, borderColor: PARTS[p].color } : { borderColor: '#e2e8f0', color: '#64748b' }}>
                {on && <Check size={14} />}{PARTS[p].label}</button>
            })}
          </div>
          <div className="flex flex-wrap gap-2 mt-5">
            <button type="button" onClick={start} disabled={busy || !newParts.length}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Започни с входяща диагностика
            </button>
            <Link href={`/remelka/sheets?student=${studentId}`} className={btn}><Printer size={15} /> Работни листове</Link>
            <button type="button" onClick={() => setModal('guide')} className={btn}><BookOpen size={15} /> Наръчник</button>
          </div>
        </div>
      </div>
      {modal === 'guide' && <Guide onClose={() => setModal('')} />}
    </div>
  )

  const sorted = assessments.slice().sort((a, b) => a.held_on.localeCompare(b.held_on) || a.created_at.localeCompare(b.created_at))
  const first = sorted[0], lastA = sorted[sorted.length - 1]
  const avgFirst = first ? areaAverages(skills, results, first.id) : {}
  const avgLast = lastA && lastA !== first ? areaAverages(skills, results, lastA.id) : {}
  const mastered = goals.filter(g => g.status === 'mastered' && sk[g.skill_id]).sort((a, b) => (b.mastered_on || '').localeCompare(a.mastered_on || ''))
  const paused = goals.filter(g => g.status === 'paused' && sk[g.skill_id])
  const inProgram = new Set(goals.filter(g => g.status !== 'mastered').map(g => g.skill_id))
  const addable = skills.filter(s => !s.archived && parts.includes(s.part) && !goals.some(g => g.skill_id === s.id))
  const lastErrors = (skillId: string) => {
    const r = results.filter(x => x.skill_id === skillId).sort((a, b) => (assessments.find(z => z.id === b.assessment_id)?.held_on || '').localeCompare(assessments.find(z => z.id === a.assessment_id)?.held_on || ''))[0]
    return r?.errors || []
  }

  return (
    <div className="space-y-4">
      {/* горна лента */}
      <div className={`${card} px-4 py-3 flex flex-wrap items-center gap-2`}>
        <Calculator size={18} className="text-indigo-600" />
        <span className="text-[15px] text-slate-800 font-medium">РЕМЕЛКА</span>
        {parts.map(p => <span key={p} className="text-[11.5px] px-2 py-0.5 rounded-full" style={{ background: PARTS[p].bg, color: PARTS[p].color }}>{PARTS[p].short}</span>)}
        <span className="text-[12px] text-slate-400">от {fmtDate(profile.started_at)}{!profile.active ? ' · спряна' : ''}</span>
        <div className="flex-1" />
            <button type="button" onClick={() => setModal('guide')} className={btn}><BookOpen size={15} /> Наръчник</button>
        <button type="button" onClick={() => { setEditA(null); setModal('assess') }} className={btn}><ClipboardCheck size={15} /> Диагностика</button>
        <button type="button" onClick={() => setModal('session')} disabled={!activeGoals.length}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
          <Play size={15} /> Занимание
        </button>
        <button type="button" onClick={() => setModal('settings')} title="Части и статус" className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><Settings2 size={16} /></button>
      </div>

      {/* подсказки */}
      {tips.length > 0 && (
        <div className="grid md:grid-cols-2 gap-2.5">
          {tips.map((t, i) => {
            const tone = t.tone === 'go' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : t.tone === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-sky-50 border-sky-200 text-sky-900'
            const Icon = t.tone === 'go' ? Sparkles : t.tone === 'warn' ? AlertTriangle : Info
            return (
              <div key={i} className={`rounded-2xl border px-4 py-3 flex gap-3 ${tone}`}>
                <Icon size={17} className="shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium">{t.title}</div>
                  <div className="text-[12.5px] opacity-90 mt-0.5">{t.text}</div>
                </div>
                {t.action && <button type="button" onClick={() => act(t)} className="self-center shrink-0 px-3 py-1.5 rounded-lg bg-white/80 border border-current/20 text-[12.5px] hover:bg-white">{t.action.label}</button>}
              </div>
            )
          })}
        </div>
      )}

      {/* програмата */}
      <section id="remelka-program" className={card}>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <h3 className="text-[14px] font-medium text-slate-800 flex-1">Програма — по това работим сега</h3>
          <span className="text-[12px] text-slate-400">{activeGoals.length} умения</span>
        </div>
        {activeGoals.length === 0 ? <p className="px-4 py-5 text-[13px] text-slate-500">Още няма умения в програмата.</p> : (
          <div className="divide-y divide-slate-100">
            {activeGoals.map(g => {
              const s = sk[g.skill_id], lv = levels[g.skill_id] ?? 0
              const hist = items.filter(i => i.skill_id === g.skill_id).map(i => ({ i, d: sessions.find(x => x.id === i.session_id)?.held_on || '' })).sort((a, b) => a.d.localeCompare(b.d)).slice(-8)
              const errs = lastErrors(g.skill_id)
              return (
                <div key={g.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <span className="w-8 h-8 rounded-lg text-[13px] font-semibold flex items-center justify-center shrink-0" style={{ background: LEVEL_COLOR[lv], color: LEVEL_TEXT[lv] }} title={LEVELS[s.part][lv]?.label}>{lv}</span>
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-[14px] text-slate-800"><span className="text-[11px] mr-1.5" style={{ color: PARTS[s.part].color }}>{s.code}</span>{s.title}</div>
                    <div className="text-[11.5px] text-slate-500">{s.area} · цел: ниво {g.target_level} ({LEVELS[s.part][g.target_level]?.short}) · от {fmtDate(g.added_on)}</div>
                    {errs.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{errs.map(e => <span key={e} className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">{e}</span>)}</div>}
                  </div>
                  <div className="flex items-center gap-1" title="Последните занимания: цвят — помощта, число — нивото">
                    {hist.map(({ i }, k) => (
                      <span key={k} className="w-5 h-5 rounded-full text-[10px] font-semibold flex items-center justify-center" style={{ background: SUPPORT[i.support].bg, color: SUPPORT[i.support].color }}>{i.level}</span>
                    ))}
                  </div>
                  {gensForSkill(s.code).length > 0 && (
                    <Link href={`/remelka/sheets?student=${studentId}&skill=${encodeURIComponent(s.code)}&level=${lv}`} title="Работен лист за това умение, на нивото на детето"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 text-[12px] hover:bg-indigo-100"><Printer size={13} /> Лист</Link>
                  )}
                  <select value={g.target_level} onChange={e => setGoal(g, { target_level: Number(e.target.value) })} title="Целево ниво"
                    className="px-2 py-1 rounded-lg border border-slate-200 text-[12px] bg-white">
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>цел {n}</option>)}
                  </select>
                  <button type="button" onClick={() => master(g.id)} title="Овладяно" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><Check size={16} /></button>
                  <button type="button" onClick={() => setGoal(g, { status: 'paused' })} title="Пауза" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><Pause size={15} /></button>
                  <button type="button" onClick={() => removeGoal(g)} title="Махни от програмата" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50"><Trash2 size={15} /></button>
                </div>
              )
            })}
          </div>
        )}
        {suggested.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-indigo-50/40">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-indigo-600" />
              <span className="text-[12.5px] text-indigo-900 flex-1">Предложени по диагностиката — първите неовладени във всяка област</span>
              <button type="button" onClick={() => addGoals(suggested)} className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[12px] hover:bg-indigo-700">Добави всички</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggested.map(s => (
                <button key={s.id} type="button" onClick={() => addGoals([s])}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-indigo-200 text-[12px] text-slate-700 hover:border-indigo-400">
                  <Plus size={12} className="text-indigo-600" /><span className="text-slate-400">{s.code}</span> {s.title}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="px-4 py-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <select value="" onChange={e => { const s = sk[e.target.value]; if (s) addGoals([s]) }} className="px-3 py-1.5 rounded-xl border border-slate-200 text-[13px] bg-white max-w-full">
            <option value="">+ Добави умение от каталога…</option>
            {addable.map(s => <option key={s.id} value={s.id}>{s.code} · {s.title} ({s.area})</option>)}
          </select>
          {paused.length > 0 && <span className="text-[12px] text-slate-500">На пауза: {paused.map(g => (
            <button key={g.id} type="button" onClick={() => setGoal(g, { status: 'active' })} className="underline decoration-dotted hover:text-slate-800 mr-2">{sk[g.skill_id].code}</button>))}</span>}
        </div>
      </section>

      {/* картата на уменията */}
      {assessments.length > 0 && (
        <section className={`${card} p-4`}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-[14px] font-medium text-slate-800 flex-1">Карта на уменията</h3>
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500">
              {[0, 1, 2, 3, 4].map(n => <span key={n} className="w-4 h-4 rounded" style={{ background: LEVEL_COLOR[n] }} title={`ниво ${n}`} />)}
              <span className="ml-1">0 → 4</span>
            </div>
          </div>
          <div className="space-y-2">
            {areas.map(([key, list]) => {
              const [part, area] = key.split('|') as [Part, string]
              const a0 = avgFirst[key], a1 = avgLast[key]
              return (
                <div key={key} className="flex flex-wrap items-center gap-2">
                  <div className="w-44 shrink-0">
                    <div className="text-[12.5px] text-slate-700">{area}</div>
                    <div className="text-[10.5px]" style={{ color: PARTS[part].color }}>{PARTS[part].short}
                      {a0 !== undefined && <span className="text-slate-400"> · {a0.toFixed(1)}{a1 !== undefined ? ` → ${a1.toFixed(1)}` : ''}</span>}</div>
                  </div>
                  <div className="flex flex-wrap gap-1 flex-1">
                    {list.sort((x, y) => x.sort - y.sort).map(s => {
                      const lv = levels[s.id]
                      const isGoal = inProgram.has(s.id)
                      return (
                        <button key={s.id} type="button" onClick={() => !goals.some(g => g.skill_id === s.id) && addGoals([s])}
                          title={`${s.code} ${s.title}${lv !== undefined ? ` — ниво ${lv}` : ' — не е проверено'}${goals.some(g => g.skill_id === s.id) ? '' : ' (клик — в програмата)'}`}
                          className={`px-2 py-1 rounded-lg text-[11.5px] ${isGoal ? 'ring-2 ring-indigo-400' : ''}`}
                          style={{ background: lv !== undefined ? LEVEL_COLOR[lv] : '#f8fafc', color: lv !== undefined ? LEVEL_TEXT[lv] : '#94a3b8', border: lv === undefined ? '1px dashed #cbd5e1' : 'none' }}>
                          {s.code}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">С рамка — уменията в програмата; пунктир — още не е проверено. До областта: средното ниво при първата → последната диагностика.</p>
        </section>
      )}

      {/* овладени */}
      {mastered.length > 0 && (
        <section className={`${card} px-4 py-3`}>
          <div className="flex items-center gap-2 mb-2"><Trophy size={15} className="text-amber-500" /><h3 className="text-[14px] font-medium text-slate-800">Овладени</h3></div>
          <div className="flex flex-wrap gap-1.5">
            {mastered.map(g => <span key={g.id} className="text-[12px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100">
              {sk[g.skill_id].code} {sk[g.skill_id].title}{g.mastered_on ? ` · ${fmtDate(g.mastered_on)}` : ''}</span>)}
          </div>
        </section>
      )}

      {/* история */}
      <div className="grid md:grid-cols-2 gap-4">
        <section className={card}>
          <h3 className="px-4 py-3 border-b border-slate-100 text-[14px] font-medium text-slate-800">Занимания</h3>
          {sessions.length === 0 ? <p className="px-4 py-4 text-[13px] text-slate-500">Още няма.</p> : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {sessions.slice(0, 60).map(s => {
                const its = items.filter(i => i.session_id === s.id)
                const mine = s.staff_id === meId || isManager
                return (
                  <div key={s.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-2 text-[12.5px]">
                      <span className="font-medium text-slate-800">{fmtDate(s.held_on)}</span>
                      <span className="text-slate-500 flex-1 truncate">{names[s.staff_id || ''] || ''}{s.minutes ? ` · ${s.minutes} мин` : ''}{s.place ? ` · ${s.place}` : ''}</span>
                      {mine && <button type="button" onClick={() => removeSession(s)} className="p-1 rounded text-slate-300 hover:text-rose-600"><Trash2 size={13} /></button>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {its.map(i => <span key={i.id} className="text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: SUPPORT[i.support].bg, color: SUPPORT[i.support].color }}
                        title={i.activity || ''}>{sk[i.skill_id]?.code} · {i.level}</span>)}
                    </div>
                    {s.note && <p className="text-[12px] text-slate-500 mt-1">{s.note}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </section>
        <section className={card}>
          <h3 className="px-4 py-3 border-b border-slate-100 text-[14px] font-medium text-slate-800">Диагностики</h3>
          {assessments.length === 0 ? <p className="px-4 py-4 text-[13px] text-slate-500">Още няма.</p> : (
            <div className="divide-y divide-slate-100">
              {sorted.slice().reverse().map(a => {
                const n = results.filter(r => r.assessment_id === a.id).length
                const mine = a.staff_id === meId || isManager
                return (
                  <div key={a.id} className="px-4 py-2.5 flex items-center gap-2 text-[12.5px]">
                    <span className="font-medium text-slate-800">{KINDS[a.kind]}</span>
                    <span className="text-slate-500 flex-1 truncate">{fmtDate(a.held_on)} · {n} умения{names[a.staff_id || ''] ? ` · ${names[a.staff_id || '']}` : ''}</span>
                    <button type="button" onClick={() => { setEditA(a); setModal('assess') }} className="p-1 rounded text-slate-400 hover:text-slate-700"><Pencil size={13} /></button>
                    {mine && <button type="button" onClick={() => removeAssessment(a)} className="p-1 rounded text-slate-300 hover:text-rose-600"><Trash2 size={13} /></button>}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {modal === 'assess' && (
        <AssessmentEditor skills={skills} parts={parts} prev={editA ? {} : prevLevels}
          initial={editA ? { a: editA, results: results.filter(r => r.assessment_id === editA.id) } : undefined}
          onClose={() => { setModal(''); setEditA(null) }} onSave={saveAssessment} />
      )}
      {modal === 'session' && <SessionForm goals={activeGoals} skills={skills} levels={levels} onClose={() => setModal('')} onSave={saveSession} />}
      {modal === 'guide' && <Guide onClose={() => setModal('')} />}
      {modal === 'settings' && (
        <Settings parts={parts} active={profile.active} onClose={() => setModal('')} onSave={saveParts} />
      )}
    </div>
  )
}

function Settings({ parts, active, onClose, onSave }: { parts: Part[]; active: boolean; onClose: () => void; onSave: (p: Part[], a: boolean) => void }) {
  const [p, setP] = useState<Part[]>(parts)
  const [a, setA] = useState(active)
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="max-w-sm mx-auto mt-24 bg-white rounded-3xl shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center"><h2 className="flex-1 text-base text-[#0f2240]">РЕМЕЛКА — настройки</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button></div>
        <div className="space-y-1.5">
          {(Object.keys(PARTS) as Part[]).map(k => (
            <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={p.includes(k)} onChange={e => setP(x => e.target.checked ? [...x, k] : x.filter(y => y !== k))} className="rounded" />{PARTS[k].label}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={a} onChange={e => setA(e.target.checked)} className="rounded" />Детето работи по методиката (махнете за спиране)
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm border border-slate-200">Отказ</button>
          <button type="button" disabled={!p.length} onClick={() => onSave(p, a)} className="px-4 py-2 rounded-xl text-sm text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>Запази</button>
        </div>
      </div>
    </div>
  )
}
