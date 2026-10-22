'use client'

// „Занимание“ — режим на цял екран за телефон или таблет, с една ръка:
// избираш картинката, която детето подаде, и натискаш как го направи (сам / с помощ / грешка).
// Брои на живо, пази в браузъра докато не запишеш (ако падне връзката — нищо не се губи).

import { useEffect, useMemo, useState } from 'react'
import { X, Undo2, Check, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast, confirmDialog } from '@/components/ui/Toast'
import { PHASES, PLACES, PROMPTS, ROMAN, PHASE_COLOR, pct } from './lib'
import type { Item, Profile, Prompt, Session } from './lib'
import ItemPic from './ItemPic'

type T = { item: string | null; prompt: Prompt }

export default function SessionMode({ studentId, childName, profile, items, sessions, meId, onClose }: {
  studentId: string; childName: string; profile: Profile; items: Item[]; sessions: Session[]; meId: string; onClose: (saved: boolean) => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const KEY = `pecs-live-${studentId}`
  const [phase, setPhase] = useState(profile.phase)
  const [place, setPlace] = useState(PLACES[0])
  const [sel, setSel] = useState<string | null>(items.find(i => i.status === 'learning')?.id || items[0]?.id || null)
  const [trials, setTrials] = useState<T[]>([])
  const [note, setNote] = useState('')
  const [guide, setGuide] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ n: number; ind: number; best: boolean } | null>(null)

  // възстановяване на незаписано занимание
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (d?.trials?.length) { setTrials(d.trials); setPhase(d.phase || profile.phase); setPlace(d.place || PLACES[0]); setNote(d.note || '') }
      else { const pl = localStorage.getItem('pecs-place'); if (pl) setPlace(pl) }
    } catch { /* */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      if (trials.length) localStorage.setItem(KEY, JSON.stringify({ trials, phase, place, note }))
      else localStorage.removeItem(KEY)
    } catch { /* */ }
  }, [trials, phase, place, note]) // eslint-disable-line react-hooks/exhaustive-deps

  const ind = trials.filter(t => t.prompt === 'independent').length
  const p = trials.length ? Math.round(ind / trials.length * 100) : 0
  const prompts: Prompt[] = phase >= 3 ? ['independent', 'partial', 'full', 'error'] : ['independent', 'partial', 'full']
  const visible = useMemo(() => items.filter(i => i.status !== 'archived'), [items])
  const guideP = PHASES[phase]
  const col = PHASE_COLOR[phase]

  function add(prompt: Prompt) {
    setTrials(t => [...t, { item: sel, prompt }])
    try { navigator.vibrate?.(prompt === 'independent' ? 30 : 12) } catch { /* */ }
  }

  async function save() {
    if (!trials.length) { onClose(false); return }
    setBusy(true)
    try {
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
      const { data: s, error } = await supabase.from('pecs_sessions').insert({
        student_id: studentId, staff_id: meId, held_on: today, phase, place, trials: trials.length, independent: ind, note: note.trim() || null,
      }).select('id').single()
      if (error) throw error
      const { error: e2 } = await supabase.from('pecs_trials').insert(trials.map((t, k) => ({ session_id: s.id, student_id: studentId, item_id: t.item, prompt: t.prompt, seq: k })))
      if (e2) throw e2
      try { localStorage.removeItem(KEY); localStorage.setItem('pecs-place', place) } catch { /* */ }
      const prevBest = Math.max(0, ...sessions.filter(x => x.phase === phase && x.trials >= 3).map(pct))
      setDone({ n: trials.length, ind, best: trials.length >= 3 && p > prevBest && sessions.some(x => x.phase === phase) })
    } catch (e: any) {
      toast(e?.message || 'Не се записа — опитайте пак (опитите са запазени)', 'error')
    } finally { setBusy(false) }
  }

  if (done) return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-28 h-28 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: '#dcfce7' }}>
        {done.best ? <Sparkles size={52} className="text-emerald-600" /> : <Check size={56} className="text-emerald-600" />}
      </div>
      <div className="text-2xl font-semibold text-slate-800">{done.best ? 'Най-добрият резултат досега!' : 'Записано'}</div>
      <div className="text-lg text-slate-600 mt-2">{childName}: <b>{done.ind} от {done.n}</b> сам — {Math.round(done.ind / done.n * 100)}%</div>
      <button type="button" onClick={() => onClose(true)} className="mt-8 px-8 py-3 rounded-2xl text-white text-lg" style={{ backgroundColor: '#0f2240' }}>Готово</button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col">
      {/* горна лента */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={async () => { if (!trials.length || await confirmDialog('Да излезете без запис? Опитите остават в браузъра за следващия път.')) onClose(false) }}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-700"><X size={22} /></button>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-slate-800 truncate">Занимание · {childName}</div>
          <div className="text-[12px] text-slate-500">Етап {ROMAN[phase]} — {guideP.name}</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="relative w-12 h-12">
            <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="4" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(p / 100) * 97.4} 97.4`} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-700">{p}%</div>
          </div>
          <div className="text-right leading-tight">
            <div className="text-[18px] font-semibold text-slate-800 tabular-nums">{ind}/{trials.length}</div>
            <div className="text-[11px] text-slate-500">сам</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {/* етап и място */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button key={n} type="button" onClick={() => setPhase(n)}
                className={`w-9 h-8 rounded-lg text-[13px] font-semibold ${phase === n ? 'text-white' : 'text-slate-500'}`} style={phase === n ? { backgroundColor: PHASE_COLOR[n] } : {}}>{ROMAN[n]}</button>
            ))}
          </div>
          <select value={place} onChange={e => setPlace(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-[14px]">
            {PLACES.map(pl => <option key={pl}>{pl}</option>)}
          </select>
          <button type="button" onClick={() => setGuide(!guide)} className="ml-auto inline-flex items-center gap-1 text-[13px]" style={{ color: col }}>
            Как се прави {guide ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
        {guide && (
          <div className="rounded-2xl border p-3 text-[13.5px] text-slate-700 space-y-1.5" style={{ borderColor: col + '55', backgroundColor: col + '0d' }}>
            <div className="font-semibold" style={{ color: col }}>{guideP.goal}</div>
            <ul className="list-disc pl-5 space-y-0.5">{guideP.how.map((h, i) => <li key={i}>{h}</li>)}</ul>
            <div className="text-rose-700">Избягвайте: {guideP.avoid.join(' · ')}</div>
          </div>
        )}

        {/* картинките */}
        {visible.length ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {visible.map(it => (
              <button key={it.id} type="button" onClick={() => setSel(it.id)}
                className={`relative rounded-2xl border-2 bg-white p-2 flex flex-col items-center transition ${sel === it.id ? 'shadow-md' : 'border-slate-200'}`}
                style={sel === it.id ? { borderColor: col, boxShadow: `0 0 0 3px ${col}33` } : {}}>
                <ItemPic item={it} className="w-16 h-16" />
                <span className="text-[12.5px] text-slate-700 mt-1 text-center leading-tight">{it.label}</span>
                {it.status === 'independent' && <span className="absolute top-1 right-1.5 text-[11px] text-emerald-600">★</span>}
              </button>
            ))}
          </div>
        ) : <div className="text-sm text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300 p-4">Няма картинки в речника — опитите ще се запишат без картинка.</div>}

        {/* последните опити */}
        {trials.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            {trials.slice(-30).map((t, i) => <span key={i} title={PROMPTS[t.prompt].label} className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: PROMPTS[t.prompt].color }} />)}
            <button type="button" onClick={() => setTrials(t => t.slice(0, -1))} className="ml-2 inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-800"><Undo2 size={14} /> Върни последния</button>
          </div>
        )}
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Бележка (по желание): какво проработи, спонтанни искания, нова дума…"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-[14px] resize-none focus:outline-none focus:border-[#0f2240]" />
      </div>

      {/* големите бутони */}
      <div className="bg-white border-t border-slate-200 p-3 space-y-2">
        <div className={`grid gap-2 ${prompts.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
          {prompts.map(pr => (
            <button key={pr} type="button" onClick={() => add(pr)}
              className="rounded-2xl py-4 px-1 text-[15px] sm:text-[16px] font-semibold leading-tight active:scale-95 transition border-2"
              style={{ backgroundColor: PROMPTS[pr].bg, color: PROMPTS[pr].color, borderColor: PROMPTS[pr].color + '55' }}>
              {pr === 'independent' && '✓ '}{PROMPTS[pr].label}
            </button>
          ))}
        </div>
        <button type="button" onClick={save} disabled={busy}
          className="w-full rounded-2xl py-3 text-white text-[16px] inline-flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: '#0f2240' }}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} {trials.length ? `Запиши (${trials.length} опита)` : 'Затвори'}
        </button>
      </div>
    </div>
  )
}
