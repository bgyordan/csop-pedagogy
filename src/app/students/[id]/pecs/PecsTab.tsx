'use client'

// Таб „PECS“ в досието на детето.
// Пътят през етапите · умни подсказки · речникът с напредък по картинка · „Кое избира?“ ·
// режим „Занимание“ за телефон · графика и матрица „кой и къде“ · книгата с един клик.
// Вижда се и се пише само от колегите, които работят с детето (+ координатори и ръководство).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Play, Trophy, BookHeart, Settings2, Plus, ImagePlus, Lock, Sparkles, AlertTriangle, Info, X, Check,
  Star, Trash2, MessagesSquare, ChevronRight, Archive,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { fileToDataUrl } from '@/lib/photo'
import PictoPicker from '@/components/pictos/PictoPicker'
import type { Picked } from '@/components/pictos/PictoPicker'
import {
  PHASES, ROMAN, PHASE_COLOR, PROMPTS, insights, itemStats, prefRanking, readiness, pct, todaySofia, fmtDate,
} from './lib'
import type { Item, PhaseLog, Pref, Profile, Session, Trial, Insight } from './lib'
import ItemPic from './ItemPic'
import SessionMode from './SessionMode'
import PrefGame from './PrefGame'
import { ProgressChart, GeneralizationMatrix } from './Progress'

export default function PecsTab({ studentId, childName, firstName, meId, isManager }: {
  studentId: string; childName: string; firstName: string; meId: string; isManager: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  const [access, setAccess] = useState<boolean | null>(null)
  const [err, setErr] = useState('')
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [items, setItems] = useState<Item[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [trials, setTrials] = useState<Trial[]>([])
  const [log, setLog] = useState<PhaseLog[]>([])
  const [prefs, setPrefs] = useState<Pref[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<'' | 'session' | 'prefs'>('')
  const [picker, setPicker] = useState<'' | 'word' | 'reinforcer'>('')
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [settings, setSettings] = useState(false)
  const [guide, setGuide] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const today = todaySofia()

  const load = useCallback(async () => {
    const { data: ok, error: e0 } = await supabase.rpc('works_with_student', { p_student: studentId })
    if (e0) { setErr('PECS още не е подготвен в базата — пуснете SQL файла 2026-10-11_pecs.sql.'); return }
    setAccess(!!ok)
    if (!ok) return
    const [pr, it, se, tr, lg, pf] = await Promise.all([
      supabase.from('pecs_profiles').select('*').eq('student_id', studentId).maybeSingle(),
      supabase.from('pecs_items').select('*').eq('student_id', studentId).order('sort').order('added_on'),
      supabase.from('pecs_sessions').select('*').eq('student_id', studentId).order('held_on', { ascending: false }).limit(500),
      supabase.from('pecs_trials').select('id, session_id, item_id, prompt, seq').eq('student_id', studentId).limit(5000),
      supabase.from('pecs_phase_log').select('*').eq('student_id', studentId).order('changed_on'),
      supabase.from('pecs_preferences').select('id, item_a, item_b, chosen, created_at').eq('student_id', studentId),
    ])
    if (pr.error) { setErr('PECS още не е подготвен в базата — пуснете SQL файла 2026-10-11_pecs.sql.'); return }
    setProfile((pr.data as Profile) || null)
    setItems((it.data || []) as Item[])
    setSessions((se.data || []) as Session[])
    setTrials((tr.data || []) as Trial[])
    setLog((lg.data || []) as PhaseLog[])
    setPrefs((pf.data || []) as Pref[])
    const ids = Array.from(new Set([...(se.data || []).map((s: any) => s.staff_id), ...(lg.data || []).map((l: any) => l.changed_by)].filter(Boolean))) as string[]
    if (ids.length) {
      const { data: st } = await supabase.from('staff_profiles').select('id, first_name, last_name').in('id', ids)
      setNames(Object.fromEntries((st || []).map((s: any) => [s.id, `${s.first_name} ${s.last_name}`])))
    }
  }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const active = useMemo(() => items.filter(i => i.status !== 'archived'), [items])
  const stats = useMemo(() => itemStats(items, trials, sessions), [items, trials, sessions])
  const tips = useMemo(() => profile ? insights(profile, items, sessions, trials, prefs, names, today) : [], [profile, items, sessions, trials, prefs, names, today])

  if (err) return <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">{err}</div>
  if (access === false) return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
      <Lock size={24} className="mx-auto mb-2 text-slate-300" />
      PECS на детето виждат колегите, които работят с него — класен, учители, възпитател, терапевти и ЕПЛР екипът.
    </div>
  )
  if (profile === undefined || access === null) return <div className="flex justify-center py-10 text-slate-400"><Loader2 className="animate-spin" size={20} /></div>

  // ── действия ──
  async function start() {
    setBusy(true)
    const { error } = await supabase.from('pecs_profiles').insert({ student_id: studentId, started_by: meId })
    if (!error) await supabase.from('pecs_phase_log').insert({ student_id: studentId, phase: 1, changed_by: meId, note: 'Начало' })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    await load()
    setPicker('reinforcer')
  }
  async function setPhase(n: number, note?: string) {
    if (!profile) return
    const { error } = await supabase.from('pecs_profiles').update({ phase: n, phase_since: today, updated_at: new Date().toISOString() }).eq('student_id', studentId)
    if (error) { toast(error.message, 'error'); return }
    await supabase.from('pecs_phase_log').insert({ student_id: studentId, phase: n, changed_by: meId, note: note || null })
    toast(`Етап ${ROMAN[n]} — ${PHASES[n].name}`)
    load()
  }
  async function addItem(p: Picked, reinforcer: boolean) {
    const { data, error } = await supabase.from('pecs_items').insert({
      student_id: studentId, label: p.label || 'картинка', picto_key: p.key || null, photo: p.photo || null,
      is_reinforcer: reinforcer, added_by: meId, sort: items.length,
    }).select('*').single()
    if (error) { toast(error.message, 'error'); return }
    setItems(x => [...x, data as Item])
  }
  async function saveItem(it: Item, patch: Partial<Item>) {
    const { error } = await supabase.from('pecs_items').update(patch).eq('id', it.id)
    if (error) { toast(error.message, 'error'); return }
    setItems(x => x.map(i => i.id === it.id ? { ...i, ...patch } : i))
  }
  async function master(id: string) {
    const it = items.find(i => i.id === id)
    if (it) await saveItem(it, { status: 'independent', mastered_on: today })
    toast('Браво! Отбелязано като научена ✓')
  }
  async function removeItem(it: Item) {
    if (!confirm(`Да се изтрие ли „${it.label}“? Опитите остават в историята, но без картинка.`)) return
    const { error } = await supabase.from('pecs_items').delete().eq('id', it.id)
    if (error) { toast(error.message, 'error'); return }
    setItems(x => x.filter(i => i.id !== it.id))
    setEditItem(null)
  }
  async function removeSession(s: Session) {
    if (!confirm(`Да се изтрие ли заниманието от ${fmtDate(s.held_on)}?`)) return
    const { error } = await supabase.from('pecs_sessions').delete().eq('id', s.id)
    if (error) { toast(error.message, 'error'); return }
    load()
  }
  function printBook() {
    const pics = active.map(i => ({ key: i.picto_key || undefined, photo: i.photo || undefined, label: i.label }))
    try {
      const d = JSON.parse(localStorage.getItem('gen-drafts-v1') || '{}')
      const drafts = { ...(d.drafts || {}), 'pecs-book': { type: 'pecs-book', title: 'Моята книга за общуване', who: firstName, color: '#2563eb', pics, size: 'small', labels: true, copies: 2, tokens: 5 } }
      localStorage.setItem('gen-drafts-v1', JSON.stringify({ type: 'pecs-book', drafts }))
    } catch { toast('Браузърът не позволи — отворете генератора ръчно', 'error'); return }
    router.push('/materials/make')
  }
  function act(i: Insight) {
    const a = i.action
    if (!a || !profile) return
    if (a.kind === 'advance') { if (confirm(`Детето преминава към етап ${ROMAN[profile.phase + 1]} — ${PHASES[profile.phase + 1].name}?`)) setPhase(profile.phase + 1, 'Достигнат праг') }
    else if (a.kind === 'master' && a.itemId) master(a.itemId)
    else if (a.kind === 'session') setMode('session')
    else if (a.kind === 'prefs') setMode('prefs')
    else if (a.kind === 'add') setPicker('reinforcer')
  }

  // ── още не е започнат ──
  if (!profile) return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="grid md:grid-cols-[1fr_280px]">
        <div className="p-6 md:p-8">
          <div className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-widest text-sky-700"><MessagesSquare size={14} /> PECS</div>
          <h3 className="text-xl md:text-2xl font-semibold text-slate-800 mt-2">Общуване чрез размяна на картинки</h3>
          <p className="text-[14px] text-slate-600 mt-2 leading-relaxed">Детето подава картинка, за да получи това, което иска — и така открива, че общуването работи. Методът минава през 6 етапа: от първата размяна до изречения и коментари.</p>
          <ul className="text-[13.5px] text-slate-600 mt-4 space-y-1.5">
            <li>• <b>Занимание от телефона</b> — броите опитите с едно натискане, ЕИС води сметката.</li>
            <li>• <b>Подсказки</b> — кога е готов за следващия етап, какво да промените, кой още да опита.</li>
            <li>• <b>Книгата на детето</b> — отпечатва се с един клик от речника му.</li>
          </ul>
          <button type="button" onClick={start} disabled={busy}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[15px] disabled:opacity-60" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Започни PECS за {firstName}
          </button>
          <p className="text-[12px] text-slate-400 mt-2">Може всеки, който работи с детето. Първата стъпка — какво най-много обича.</p>
        </div>
        <div className="hidden md:flex flex-col justify-center gap-2 p-6 bg-gradient-to-b from-sky-50 to-violet-50 border-l border-slate-100">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full text-white text-[12px] font-bold flex items-center justify-center" style={{ backgroundColor: PHASE_COLOR[n] }}>{ROMAN[n]}</span>
              <span className="text-[13px] text-slate-700">{PHASES[n].name}</span>
            </div>
          ))}
        </div>
      </div>
      {picker && <PictoPicker multi title="Какво най-много обича?" toPhoto={f => fileToDataUrl(f, 480, 0.8)} onPick={p => addItem(p, true)} onClose={() => { setPicker(''); load() }} />}
    </div>
  )

  const r = readiness(profile, sessions)
  const phaseDate = (n: number) => log.filter(l => l.phase === n).map(l => l.changed_on)[0]
  const col = PHASE_COLOR[profile.phase]
  const reinf = active.filter(i => i.is_reinforcer)
  const topReinf = prefRanking(reinf, prefs).filter(x => x.n > 0).slice(0, 3)
  const last = sessions[0]
  const g = guide ?? profile.phase
  const tone = { go: 'bg-emerald-50 border-emerald-200 text-emerald-900', warn: 'bg-amber-50 border-amber-200 text-amber-900', info: 'bg-sky-50 border-sky-200 text-sky-900' }
  const toneIcon = { go: <Sparkles size={16} className="text-emerald-600" />, warn: <AlertTriangle size={16} className="text-amber-600" />, info: <Info size={16} className="text-sky-600" /> }

  return (
    <div className="space-y-4">
      {/* ── етап и главните действия ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#eef2f7" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke={col} strokeWidth="3.5" strokeLinecap="round"
                  strokeDasharray={`${Math.min(100, (r.passing / profile.criterion_sessions) * 100) * 0.974} 97.4`} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[18px] font-bold" style={{ color: col }}>{ROMAN[profile.phase]}</div>
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-widest text-slate-400">Етап {ROMAN[profile.phase]} от VI</div>
              <div className="text-[19px] font-semibold text-slate-800 leading-tight">{PHASES[profile.phase].name}</div>
              <div className="text-[12.5px] text-slate-500">от {fmtDate(profile.phase_since)} · {r.passing}/{profile.criterion_sessions} занимания над {profile.criterion_pct}%{last ? ` · последно ${fmtDate(last.held_on)}` : ''}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 ml-auto">
            <button type="button" onClick={() => setMode('session')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[15px] font-medium shadow-sm hover:opacity-95" style={{ backgroundColor: col }}>
              <Play size={16} fill="currentColor" /> Занимание
            </button>
            <button type="button" onClick={() => setMode('prefs')} disabled={reinf.length < 2} title={reinf.length < 2 ? 'Нужни са поне два любими предмета' : ''}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 text-[14px] text-slate-700 hover:border-[#0f2240] disabled:opacity-40">
              <Trophy size={15} /> Кое избира?
            </button>
            <button type="button" onClick={printBook} disabled={!active.length}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 text-[14px] text-slate-700 hover:border-[#0f2240] disabled:opacity-40">
              <BookHeart size={15} /> Отпечатай книгата
            </button>
            <button type="button" onClick={() => setSettings(true)} className="p-2.5 rounded-xl border border-slate-300 text-slate-500 hover:border-[#0f2240]" title="Настройки"><Settings2 size={16} /></button>
          </div>
        </div>

        {/* пътят */}
        <div className="mt-5 grid grid-cols-6 gap-1.5">
          {[1, 2, 3, 4, 5, 6].map(n => {
            const done = n < profile.phase, cur = n === profile.phase
            return (
              <button key={n} type="button" onClick={() => setGuide(n)}
                className={`relative text-left rounded-2xl px-1.5 sm:px-2.5 py-2 border transition ${g === n ? 'shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
                style={g === n ? { borderColor: PHASE_COLOR[n] + '66', backgroundColor: PHASE_COLOR[n] + '0d' } : {}}>
                <div className="flex items-center gap-1.5">
                  <span className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center ${cur ? 'ring-4' : ''}`}
                    style={{ backgroundColor: done || cur ? PHASE_COLOR[n] : '#e2e8f0', color: done || cur ? '#fff' : '#94a3b8', ['--tw-ring-color' as any]: PHASE_COLOR[n] + '33' }}>
                    {done ? <Check size={13} /> : ROMAN[n]}
                  </span>
                  <span className="hidden md:block h-0.5 flex-1 rounded" style={{ backgroundColor: done ? PHASE_COLOR[n] : '#e2e8f0' }} />
                </div>
                <div className={`hidden sm:block text-[12px] mt-1 leading-tight ${cur ? 'font-semibold text-slate-800' : done ? 'text-slate-600' : 'text-slate-400'}`}>{PHASES[n].name}</div>
                {phaseDate(n) && <div className="hidden sm:block text-[10.5px] text-slate-400">{fmtDate(phaseDate(n)!)}</div>}
              </button>
            )
          })}
        </div>
        {/* ръководство за избрания етап */}
        <div className="mt-3 rounded-2xl p-4 grid md:grid-cols-[1fr_1fr] gap-4 text-[13.5px]" style={{ backgroundColor: PHASE_COLOR[g] + '0b' }}>
          <div>
            <div className="font-semibold" style={{ color: PHASE_COLOR[g] }}>Етап {ROMAN[g]} · {PHASES[g].name}</div>
            <p className="text-slate-700 mt-1">{PHASES[g].goal}</p>
            <ul className="mt-2 space-y-1 text-slate-600">{PHASES[g].how.map((h, i) => <li key={i} className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: PHASE_COLOR[g] }} />{h}</li>)}</ul>
          </div>
          <div className="space-y-2.5">
            <div><div className="text-[11.5px] uppercase tracking-wider text-slate-400">Готов е, когато</div><div className="text-slate-700">{PHASES[g].ready}</div></div>
            <div><div className="text-[11.5px] uppercase tracking-wider text-slate-400">Избягвайте</div><div className="text-slate-700">{PHASES[g].avoid.join(' · ')}</div></div>
            <div className="text-[12.5px] text-slate-500 italic">{PHASES[g].tip}</div>
          </div>
        </div>
      </div>

      {/* ── подсказки ── */}
      {tips.length > 0 && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {tips.map((t, i) => (
            <div key={i} className={`rounded-2xl border px-4 py-3 flex flex-col ${tone[t.tone]}`}>
              <div className="flex items-center gap-2 font-semibold text-[14px]">{toneIcon[t.tone]} {t.title}</div>
              <p className="text-[13px] mt-1 opacity-90 flex-1">{t.text}</p>
              {t.action && <button type="button" onClick={() => act(t)} className="mt-2 self-start px-3 py-1.5 rounded-lg bg-white/80 border border-current/20 text-[13px] font-medium hover:bg-white">{t.action.label}</button>}
            </div>
          ))}
        </div>
      )}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        {/* ── речникът ── */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-[15px] font-semibold text-slate-800">Речникът на {firstName}</div>
            <span className="text-[12px] text-slate-400">{active.filter(i => i.status === 'independent').length} научени · {active.filter(i => i.status === 'learning').length} в процес</span>
            <div className="ml-auto flex gap-1.5">
              <button type="button" onClick={() => setPicker('word')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-[12.5px] text-slate-700 hover:border-[#0f2240]"><Plus size={13} /> Картинка</button>
              <button type="button" onClick={() => setPicker('reinforcer')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-[12.5px] text-slate-700 hover:border-[#0f2240]"><Star size={13} /> Любимо</button>
            </div>
          </div>
          {active.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center text-[13px] text-slate-500">
              Добавете любимите неща на детето — с пиктограма или <ImagePlus size={13} className="inline" /> снимка на истинския предмет.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {active.map(it => {
                const s = stats[it.id]
                return (
                  <button key={it.id} type="button" onClick={() => setEditItem(it)}
                    className="relative rounded-2xl border border-slate-200 p-2 flex flex-col items-center hover:shadow-md hover:-translate-y-0.5 transition text-left">
                    {it.is_reinforcer && <Star size={13} className="absolute top-1.5 left-1.5 text-amber-400" fill="currentColor" />}
                    {it.status === 'independent' && <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center"><Check size={12} /></span>}
                    <ItemPic item={it} className="w-14 h-14" />
                    <div className="text-[12.5px] text-slate-700 mt-1 text-center leading-tight truncate w-full">{it.label}</div>
                    <div className="flex gap-[2px] mt-1.5 h-1.5">
                      {Array.from({ length: 10 }, (_, k) => {
                        const pr = s?.last[k]
                        return <span key={k} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pr ? PROMPTS[pr].color : '#e2e8f0' }} />
                      })}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          {topReinf.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[12.5px] text-slate-500">
              <Trophy size={14} className="text-amber-500" /> Най-любими:
              {topReinf.map((x, i) => <span key={x.item.id} className="inline-flex items-center gap-1 text-slate-700"><ItemPic item={x.item} className="w-5 h-5" />{x.item.label}{i < topReinf.length - 1 ? ',' : ''}</span>)}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-slate-400">
            {(['independent', 'partial', 'full', 'error'] as const).map(k => <span key={k} className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROMPTS[k].color }} />{PROMPTS[k].short}</span>)}
            <span>— последните 10 опита</span>
          </div>
        </div>

        {/* ── напредък ── */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <div className="text-[15px] font-semibold text-slate-800 mb-1">Напредък — % „сам“ по занимания</div>
            <ProgressChart sessions={sessions} criterion={profile.criterion_pct} />
          </div>
          {sessions.length > 0 && (
            <div>
              <div className="text-[13px] font-semibold text-slate-700 mb-1.5">Кой и къде — генерализация</div>
              <GeneralizationMatrix sessions={sessions} names={names} />
              <p className="text-[11.5px] text-slate-400 mt-1.5">Колкото повече хора и места — толкова по-уверено детето общува навсякъде.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── последни занимания ── */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
          <div className="text-[15px] font-semibold text-slate-800 mb-2">Занимания</div>
          <div className="divide-y divide-slate-100">
            {sessions.slice(0, 15).map(s => (
              <div key={s.id} className="py-2 flex items-center gap-3 text-[13.5px]">
                <span className="w-20 text-slate-500 tabular-nums">{fmtDate(s.held_on)}</span>
                <span className="w-9 h-6 rounded-md text-[11.5px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: PHASE_COLOR[s.phase] }}>{ROMAN[s.phase]}</span>
                <span className="w-28 tabular-nums"><b>{s.independent}</b>/{s.trials} сам · {pct(s)}%</span>
                <span className="flex-1 min-w-0 truncate text-slate-500">{[names[s.staff_id || ''], s.place, s.note].filter(Boolean).join(' · ')}</span>
                {(s.staff_id === meId || isManager) && <button type="button" onClick={() => removeSession(s)} className="p-1 text-slate-300 hover:text-rose-600"><Trash2 size={14} /></button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'session' && (
        <SessionMode studentId={studentId} childName={firstName} profile={profile} items={active} sessions={sessions} meId={meId}
          onClose={saved => { setMode(''); if (saved) load() }} />
      )}
      {mode === 'prefs' && (
        <PrefGame studentId={studentId} childName={firstName} items={reinf} prefs={prefs} meId={meId}
          onClose={changed => { setMode(''); if (changed) load() }} />
      )}
      {picker && (
        <PictoPicker multi title={picker === 'reinforcer' ? 'Какво най-много обича?' : 'Нова картинка в речника'}
          toPhoto={f => fileToDataUrl(f, 480, 0.8)} onPick={p => addItem(p, picker === 'reinforcer')} onClose={() => setPicker('')} />
      )}
      {editItem && (
        <ItemModal item={editItem} stat={stats[editItem.id]} onClose={() => setEditItem(null)}
          onSave={async patch => { await saveItem(editItem, patch); setEditItem(null) }} onDelete={() => removeItem(editItem)} />
      )}
      {settings && (
        <SettingsModal profile={profile} isManager={isManager} onClose={() => setSettings(false)}
          onPhase={n => { setSettings(false); setPhase(n, 'Ръчно') }}
          onSave={async patch => {
            const { error } = await supabase.from('pecs_profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('student_id', studentId)
            if (error) toast(error.message, 'error'); else { setSettings(false); load() }
          }} />
      )}
    </div>
  )
}

function ItemModal({ item, stat, onClose, onSave, onDelete }: {
  item: Item; stat?: { last: string[]; pct: number; total: number; lastUsed: string | null }
  onClose: () => void; onSave: (p: Partial<Item>) => void; onDelete: () => void
}) {
  const [label, setLabel] = useState(item.label)
  const [reinf, setReinf] = useState(item.is_reinforcer)
  const [status, setStatus] = useState(item.status)
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4">
          <ItemPic item={item} className="w-20 h-20" />
          <div className="flex-1 min-w-0">
            <input value={label} onChange={e => setLabel(e.target.value)} maxLength={30} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-[15px] focus:outline-none focus:border-[#0f2240]" />
            <div className="text-[12px] text-slate-500 mt-1.5">
              {stat?.total ? <>{stat.total} опита · последните 10: {stat.pct}% сам{stat.lastUsed ? ` · ${fmtDate(stat.lastUsed)}` : ''}</> : 'Още няма опити'}
              {item.mastered_on && <> · научена {fmtDate(item.mastered_on)}</>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="self-start p-1 text-slate-400"><X size={18} /></button>
        </div>
        <label className="flex items-center gap-2 text-[14px] text-slate-700"><input type="checkbox" checked={reinf} onChange={e => setReinf(e.target.checked)} className="accent-amber-500" /> Любимо (мотиватор)</label>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {([['learning', 'Учи я'], ['independent', 'Научена ✓'], ['archived', 'Прибрана']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setStatus(k)} className={`flex-1 px-3 py-1.5 rounded-lg text-[13px] ${status === k ? 'bg-white shadow-sm text-[#0f2240]' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-rose-600"><Trash2 size={14} /> Изтрий</button>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-sm">Откажи</button>
          <button type="button" onClick={() => onSave({
            label: label.trim() || item.label, is_reinforcer: reinf, status,
            mastered_on: status === 'independent' ? (item.mastered_on || todaySofia()) : null,
          })} className="px-4 py-2 rounded-xl text-white text-sm" style={{ backgroundColor: '#0f2240' }}>Запази</button>
        </div>
      </div>
    </div>
  )
}

function SettingsModal({ profile, isManager, onClose, onSave, onPhase }: {
  profile: Profile; isManager: boolean; onClose: () => void; onSave: (p: Partial<Profile>) => void; onPhase: (n: number) => void
}) {
  const [pctV, setPct] = useState(profile.criterion_pct)
  const [ses, setSes] = useState(profile.criterion_sessions)
  const [note, setNote] = useState(profile.note || '')
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><div className="text-[16px] font-semibold text-slate-800">Настройки на PECS</div><button type="button" onClick={onClose} className="p-1 text-slate-400"><X size={18} /></button></div>
        <div>
          <div className="text-[12px] text-slate-500 mb-1">Праг за следващ етап</div>
          <div className="flex items-center gap-2 text-[14px] text-slate-700">
            <select value={pctV} onChange={e => setPct(Number(e.target.value))} className="px-2 py-1.5 rounded-lg border border-slate-300">{[60, 70, 75, 80, 85, 90, 100].map(n => <option key={n} value={n}>{n}%</option>)}</select>
            „сам“ в
            <select value={ses} onChange={e => setSes(Number(e.target.value))} className="px-2 py-1.5 rounded-lg border border-slate-300">{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select>
            поредни занимания
          </div>
        </div>
        <label className="block text-[12px] text-slate-500">Бележка за екипа
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={500} placeholder="напр. Работи най-добре сутрин; любимото е балончета."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-[14px] resize-none focus:outline-none focus:border-[#0f2240]" />
        </label>
        <div>
          <div className="text-[12px] text-slate-500 mb-1">Смяна на етапа ръчно (напр. детето идва от друго място)</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button key={n} type="button" disabled={n === profile.phase} onClick={() => { if (confirm(`Етап ${ROMAN[n]} — ${PHASES[n].name}?`)) onPhase(n) }}
                className="flex-1 py-1.5 rounded-lg text-[13px] font-semibold border disabled:text-white"
                style={n === profile.phase ? { backgroundColor: PHASE_COLOR[n], borderColor: PHASE_COLOR[n] } : { borderColor: '#e2e8f0', color: PHASE_COLOR[n] }}>{ROMAN[n]}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {isManager && <span className="text-[11.5px] text-slate-400 inline-flex items-center gap-1"><Archive size={12} /> PECS профилът се трие само от ръководството</span>}
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-sm">Откажи</button>
          <button type="button" onClick={() => onSave({ criterion_pct: pctV, criterion_sessions: ses, note: note.trim() || null })} className="px-4 py-2 rounded-xl text-white text-sm" style={{ backgroundColor: '#0f2240' }}>Запази</button>
        </div>
      </div>
    </div>
  )
}
