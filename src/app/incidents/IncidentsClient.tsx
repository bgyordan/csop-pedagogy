'use client'
// Дневник на случаите — списък с филтри, „Констатирай случай“, детайл с дирята, анализ и Word за архива.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, Plus, Search, BarChart3, List, FileText, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { smartMatch } from '@/lib/search'
import { KINDS, STATUS, LEVELS, ROLE_LABEL, analyze, fmtDate, todaySofia } from '@/lib/incidents'
import type { Case, Event, Participant, Status, Kind } from '@/lib/incidents'
import IncidentForm, { type FormValue } from './IncidentForm'
import IncidentDetail from './IncidentDetail'
import IncidentAnalysis from './IncidentAnalysis'

type Props = {
  meId: string; isCouncil: boolean; isAdmin: boolean; yearId: string | null; yearName: string
  cases: Case[]; parts: Participant[]; events: Event[]
  students: { id: string; name: string; cls?: string }[]; staffNames: Record<string, string>; studentNames: Record<string, string>
  protocols: { id: string; number: number; date: string }[]
}

const MONTHS = ['септември', 'октомври', 'ноември', 'декември', 'януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август']

export default function IncidentsClient(p: Props) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  const [cases, setCases] = useState(p.cases)
  const [parts, setParts] = useState(p.parts)
  const [events, setEvents] = useState(p.events)
  const [view, setView] = useState<'list' | 'analysis'>('list')
  const [kind, setKind] = useState<'' | Kind>('')
  const [status, setStatus] = useState<'' | Status | 'open'>('')
  const [month, setMonth] = useState('')
  const [q, setQ] = useState('')
  const [form, setForm] = useState<Case | 'new' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const studentNames = { ...p.studentNames, ...Object.fromEntries(p.students.map(s => [s.id, s.name])) }

  const byCase = useMemo(() => {
    const m: Record<string, Participant[]> = {}
    parts.forEach(x => { (m[x.case_id] ||= []).push(x) })
    return m
  }, [parts])
  const months = useMemo(() => Array.from(new Set(cases.map(c => c.occurred_on.slice(0, 7)))).sort().reverse(), [cases])
  const filtered = useMemo(() => cases.filter(c =>
    (!kind || c.kind === kind) &&
    (!status || (status === 'open' ? c.status !== 'closed' : c.status === status)) &&
    (!month || c.occurred_on.startsWith(month)) &&
    (!q.trim() || (byCase[c.id] || []).some(x => smartMatch(x.student_id ? studentNames[x.student_id] || '' : x.name || '', q)) || smartMatch(c.description, q))
  ).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.number - a.number), [cases, kind, status, month, q, byCase]) // eslint-disable-line react-hooks/exhaustive-deps
  const analysis = useMemo(() => analyze(filtered, parts, studentNames, todaySofia()), [filtered, parts]) // eslint-disable-line react-hooks/exhaustive-deps
  const open = cases.find(c => c.id === openId) || null
  const monthLabel = (ym: string) => `${MONTHS[(Number(ym.slice(5, 7)) + 3) % 12]} ${ym.slice(0, 4)}`

  // ── запис ──
  async function save(v: FormValue) {
    const editing = form && form !== 'new' ? form : null
    const row = {
      kind: v.kind, occurred_on: v.occurred_on, occurred_time: v.occurred_time || null, place: v.place || null, forms: v.forms, level: v.level,
      description: v.description.trim(), antecedents: v.antecedents, antecedent_note: v.antecedent_note.trim() || null,
      consequences: v.consequences, consequence_note: v.consequence_note.trim() || null, actions: v.actions, parents_notified: v.parents_notified,
      updated_at: new Date().toISOString(),
    }
    let id = editing?.id
    if (editing) {
      const { error } = await supabase.from('incident_cases').update(row).eq('id', editing.id)
      if (error) { toast(error.message, 'error'); return }
      await supabase.from('incident_participants').delete().eq('case_id', editing.id)
    } else {
      const { data: n } = await supabase.rpc('incident_next_number', { p_year: p.yearId })
      const { data, error } = await supabase.from('incident_cases').insert({ ...row, academic_year_id: p.yearId, number: n || 1, reported_by: p.meId }).select('*').single()
      if (error || !data) { toast(error?.message.includes('incident_') ? 'Пуснете SQL файла 2026-10-17_incidents.sql' : error?.message || 'Грешка', 'error'); return }
      id = data.id
      setCases(x => [data as Case, ...x])
    }
    const { data: ps, error: e2 } = await supabase.from('incident_participants').insert(v.participants.map(x => ({ ...x, case_id: id }))).select('*')
    if (e2) { toast(e2.message, 'error'); return }
    setParts(x => [...x.filter(y => y.case_id !== id), ...((ps || []) as Participant[])])
    if (editing) setCases(x => x.map(c => c.id === id ? { ...c, ...row } as Case : c))
    toast(editing ? 'Случаят е обновен' : 'Случаят е записан — Координационният съвет го вижда')
    setForm(null)
    router.refresh()
  }
  async function addEvent(caseId: string, k: Event['kind'], text: string) {
    const { data, error } = await supabase.from('incident_events').insert({ case_id: caseId, kind: k, text, staff_id: p.meId }).select('*').single()
    if (error || !data) { toast(error?.message || 'Грешка', 'error'); return }
    setEvents(x => [...x, data as Event])
    if (k === 'parent') { await supabase.from('incident_cases').update({ parents_notified: true }).eq('id', caseId); setCases(x => x.map(c => c.id === caseId ? { ...c, parents_notified: true } : c)) }
  }
  async function setCaseStatus(c: Case, s: Status, outcome?: string) {
    const patch: Partial<Case> = { status: s, closed_on: s === 'closed' ? todaySofia() : null, ...(s === 'closed' ? { outcome: outcome || null } : {}) }
    const { error } = await supabase.from('incident_cases').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', c.id)
    if (error) { toast(error.message, 'error'); return }
    setCases(x => x.map(i => i.id === c.id ? { ...i, ...patch } : i))
    await addEvent(c.id, 'status', `${STATUS[c.status].label} → ${STATUS[s].label}${outcome ? `\n${outcome}` : ''}`)
  }
  async function setProtocol(c: Case, pid: string | null) {
    const { error } = await supabase.from('incident_cases').update({ protocol_id: pid }).eq('id', c.id)
    if (error) { toast(error.message, 'error'); return }
    setCases(x => x.map(i => i.id === c.id ? { ...i, protocol_id: pid } : i))
    const pr = p.protocols.find(x => x.id === pid)
    if (pr) await addEvent(c.id, 'protocol', `Разгледан в протокол № ${pr.number} от ${fmtDate(pr.date)}`)
  }
  async function remove(c: Case) {
    const { error } = await supabase.from('incident_cases').delete().eq('id', c.id)
    if (error) { toast(error.message, 'error'); return }
    setCases(x => x.filter(i => i.id !== c.id)); setOpenId(null)
  }
  async function exportWord() {
    setBusy(true)
    try {
      const { generateIncidentRegister } = await import('@/lib/docx-incidents')
      await generateIncidentRegister({ yearName: p.yearName, periodLabel: month ? monthLabel(month) : '', cases: filtered, parts, students: studentNames, staff: p.staffNames })
    } finally { setBusy(false) }
  }

  const sel = 'px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-700'
  const tabBtn = (v: typeof view, l: string, I: any) => (
    <button type="button" onClick={() => setView(v)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${view === v ? 'bg-white shadow-sm text-[#0f2240] font-medium' : 'text-slate-500 hover:text-slate-700'}`}><I size={14} />{l}</button>
  )

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <header className="flex flex-wrap items-center gap-4 mb-5 pb-5 border-b border-slate-100">
        <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center justify-center shrink-0"><ShieldAlert size={22} /></div>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Дневник на случаите</h1>
          <p className="text-sm text-slate-500 mt-0.5">Тормоз и инциденти с поведение · {p.yearName} · {p.isCouncil ? 'всички случаи' : 'констатираните от вас и с деца от вашата паралелка'}</p>
        </div>
        <button type="button" onClick={() => setForm('new')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: '#b91c1c' }}>
          <Plus size={16} /> Констатирай случай
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {p.isCouncil && <div className="inline-flex gap-0.5 p-1 rounded-xl bg-slate-100">{tabBtn('list', 'Дневник', List)}{tabBtn('analysis', 'Анализ', BarChart3)}</div>}
        <select value={kind} onChange={e => setKind(e.target.value as any)} className={sel}>
          <option value="">Всички видове</option>{(Object.keys(KINDS) as Kind[]).map(k => <option key={k} value={k}>{KINDS[k].label}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value as any)} className={sel}>
          <option value="">Всички статуси</option><option value="open">Неприключени</option>
          {(Object.keys(STATUS) as Status[]).map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(e.target.value)} className={sel}>
          <option value="">Цялата година</option>{months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Дете или текст…" className="pl-8 pr-7 py-1.5 w-48 rounded-xl border border-slate-200 text-[13px]" />
          {q && <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"><X size={13} /></button>}
        </div>
        <div className="flex-1" />
        {p.isCouncil && (
          <button type="button" onClick={exportWord} disabled={busy || !filtered.length} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Дневник (Word)
          </button>
        )}
      </div>

      {view === 'analysis' && p.isCouncil ? <IncidentAnalysis a={analysis} cases={filtered} onOpen={setOpenId} /> : (
        filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
            <p className="text-sm text-slate-600">{cases.length ? 'Няма случаи по тези филтри.' : 'Още няма записани случаи.'}</p>
            <p className="text-[12.5px] text-slate-400 mt-1">„Констатирай случай“ — записва се за минута, и от телефона.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {filtered.map(c => {
              const ps = byCase[c.id] || []
              const lvl = LEVELS[c.kind].find(l => l.n === c.level)
              return (
                <button key={c.id} type="button" onClick={() => setOpenId(c.id)} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-wrap items-start gap-3">
                  <span className="w-10 text-[12px] text-slate-400 tabular-nums pt-0.5">№ {c.number}</span>
                  <div className="w-24 shrink-0">
                    <div className="text-[13px] text-slate-800 tabular-nums">{fmtDate(c.occurred_on)}</div>
                    <div className="text-[11.5px] text-slate-400">{c.occurred_time?.slice(0, 5)}{c.place ? ` · ${c.place}` : ''}</div>
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ background: KINDS[c.kind].bg, color: KINDS[c.kind].color }}>{KINDS[c.kind].short}{lvl ? ` · ${lvl.label}` : ''}</span>
                      {c.forms.slice(0, 3).map(f => <span key={f} className="text-[11px] text-slate-500">{f}</span>)}
                    </div>
                    <div className="text-[13.5px] text-slate-800 line-clamp-2">{c.description}</div>
                    <div className="text-[12px] text-slate-500 mt-0.5">{ps.map(x => `${x.student_id ? studentNames[x.student_id] || '—' : x.name} (${ROLE_LABEL[x.role]})`).join(', ')}</div>
                  </div>
                  <span className="text-[11.5px] px-2 py-0.5 rounded-full shrink-0" style={{ background: STATUS[c.status].bg, color: STATUS[c.status].color }}>{STATUS[c.status].label}</span>
                </button>
              )
            })}
          </div>
        )
      )}

      {form && <IncidentForm students={p.students} initial={form === 'new' ? undefined : form} initialParts={form === 'new' ? undefined : byCase[form.id]}
        onClose={() => setForm(null)} onSave={save} />}
      {open && (
        <IncidentDetail c={open} parts={byCase[open.id] || []} events={events.filter(e => e.case_id === open.id).sort((a, b) => a.at.localeCompare(b.at))}
          names={p.staffNames} studentNames={studentNames} protocols={p.protocols}
          canManage={p.isCouncil} canEdit={p.isCouncil || (open.reported_by === p.meId && open.status === 'new')} isAdmin={p.isAdmin}
          onClose={() => setOpenId(null)} onEdit={() => { setForm(open); setOpenId(null) }}
          onStatus={(s, o) => setCaseStatus(open, s, o)} onEvent={(k, t) => addEvent(open.id, k, t)} onProtocol={pid => setProtocol(open, pid)} onDelete={() => remove(open)} />
      )}
    </div>
  )
}
