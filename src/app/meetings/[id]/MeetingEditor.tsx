'use client'
import { useMemo, useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Landmark, Users, FileText, BookCheck, Check, Loader2, Plus, Trash2, ChevronUp, ChevronDown, X,
  Printer, Download, Mail, Sparkles, CircleCheck, AlertTriangle, ThumbsUp, ThumbsDown, MinusCircle, Gavel,
  UserPlus, Upload, Eye, PencilLine, Lock, FolderOpen, Info, Wand2, CloudOff,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { notify, confirmDialog } from '@/components/ui/Toast'
import DateInput from '@/components/ui/DateInput'
import ProtocolPaper from './ProtocolPaper'
import {
  BODY_LABEL, BODY_SHORT, BODY_TONE, STATUS_LABEL, STATUS_TONE, QUORUM_LABEL, MAJORITY_LABEL, OUTCOME_LABEL, TASK_LABEL, TASK_TONE,
  ATT_LABEL, ROLE_LABEL, ABSENCE_REASONS, PS_ITEMS, OS_ITEMS, PS_PRESETS, OS_PRESETS,
  quorum, voteResult, decisionNumbers, defaultMembers, protocolDue, dmy, hm, todayIso, longDate, weekday, fullName, attName,
  type Meeting, type Item, type Decision, type Attendance, type Person, type AttStatus, type Majority, type TaskStatus,
} from '@/lib/meetings'

type Staff = Person & { is_active?: boolean }
type CSet = { id: string; title: string; event_date: string | null }
type PrevDec = {
  id: string; text: string; responsible_id: string | null; due_date: string | null; task_status: TaskStatus; report: string | null; meeting_id: string
  meeting: { body: string; meeting_no: number | null; meeting_date: string }
}
type Step = 'prep' | 'att' | 'minutes' | 'review'
const NAVY = '#0f2240'

export default function MeetingEditor(props: {
  meId: string; isManager: boolean; canEdit: boolean; isLead: boolean; meeting: Meeting; yearName: string
  items: Item[]; decisions: Decision[]; attendance: Attendance[]; people: Staff[]; sets: CSet[]; prevOpen: PrevDec[]; scanUrl: string | null
}) {
  const { meId, isManager, isLead, yearName, people, sets, prevOpen } = props
  const supabase = createClient()
  const router = useRouter()
  const today = todayIso()
  const [m, setM] = useState<Meeting>(props.meeting)
  const [items, setItems] = useState<Item[]>(props.items)
  const [decs, setDecs] = useState<Decision[]>(props.decisions)
  const [att, setAtt] = useState<Attendance[]>(props.attendance)
  const [scanUrl, setScanUrl] = useState(props.scanUrl)
  const canEdit = isLead && m.status !== 'final'
  const [step, setStep] = useState<Step>(!canEdit ? 'review' : props.meeting.meeting_date <= today && props.items.length ? 'minutes' : 'prep')
  const [saving, setSaving] = useState(0)
  const [saveErr, setSaveErr] = useState(false)
  const pend = useRef<Record<string, { t: ReturnType<typeof setTimeout>; fn: () => Promise<boolean> }>>({})
  const inflight = useRef(new Set<Promise<boolean>>())
  const heldSent = useRef(false)

  const byId = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people]) as Record<string, Staff>
  const active = useMemo(() => people.filter(p => p.is_active !== false), [people])
  const q = quorum(att, m.quorum_rule)
  const nums = decisionNumbers(items, decs)
  const tone = BODY_TONE[m.body]

  // ── запис ──
  function run(p: PromiseLike<{ error: any }>): Promise<boolean> {
    setSaving(s => s + 1)
    const pr = Promise.resolve(p).then(({ error }) => {
      setSaving(s => s - 1)
      if (error) { setSaveErr(true); notify(error.message || 'Грешка при запис') } else setSaveErr(false)
      return !error
    })
    inflight.current.add(pr); pr.finally(() => inflight.current.delete(pr))
    return pr
  }
  // отложен запис (докато се пише) — по един таймер на поле
  function later(key: string, fn: () => Promise<boolean>, ms = 700) {
    if (pend.current[key]) clearTimeout(pend.current[key].t)
    pend.current[key] = { fn, t: setTimeout(() => { delete pend.current[key]; fn() }, ms) }
  }
  /** Изпраща веднага всички чакащи записи и изчаква да приключат. */
  async function flush() {
    const all = Object.values(pend.current); pend.current = {}
    all.forEach(x => clearTimeout(x.t))
    await Promise.all([...all.map(x => x.fn()), ...Array.from(inflight.current)])
  }
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (Object.keys(pend.current).length || saving) { e.preventDefault() } }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [saving])

  function patchMeeting(patch: Partial<Meeting>, debounce = false) {
    setM(x => ({ ...x, ...patch }))
    const doit = () => run(supabase.from('mtg_meetings').update(patch).eq('id', m.id))
    if (debounce) later('m:' + Object.keys(patch).join(','), doit); else doit()
  }
  // заседанието е проведено → протоколът е „в работа“ (дневният ред спира да е публичен като покана)
  function markHeld() {
    if (m.status === 'planned' && m.meeting_date <= today && !heldSent.current) { heldSent.current = true; patchMeeting({ status: 'held' }) }
  }

  // точки
  async function addItem(title = '') {
    const sort = items.length ? Math.max(...items.map(i => i.sort)) + 1 : 0
    const { data, error } = await supabase.from('mtg_items').insert({ meeting_id: m.id, sort, title }).select('*').single()
    if (error || !data) { notify(error?.message || 'Грешка'); return }
    setItems(x => [...x, data as Item])
  }
  function patchItem(id: string, patch: Partial<Item>, debounce = true) {
    setItems(x => x.map(i => i.id === id ? { ...i, ...patch } : i))
    const doit = () => run(supabase.from('mtg_items').update(patch).eq('id', id))
    if (debounce) later('i:' + id + Object.keys(patch).join(','), doit); else doit()
  }
  async function delItem(it: Item) {
    const n = decs.filter(d => d.item_id === it.id).length
    if (!await confirmDialog(`Изтрий т. „${it.title || 'без заглавие'}“${n ? ` и ${n} решения към нея` : ''}?`)) return
    if (n) await run(supabase.from('mtg_decisions').delete().eq('item_id', it.id))
    if (await run(supabase.from('mtg_items').delete().eq('id', it.id))) {
      setItems(x => x.filter(i => i.id !== it.id)); setDecs(x => x.filter(d => d.item_id !== it.id))
    }
  }
  function moveItem(idx: number, dir: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.sort - b.sort)
    const j = idx + dir; if (j < 0 || j >= sorted.length) return
    ;[sorted[idx], sorted[j]] = [sorted[j], sorted[idx]]
    const next = sorted.map((it, i) => ({ ...it, sort: i }))
    setItems(next)
    next.forEach(it => run(supabase.from('mtg_items').update({ sort: it.sort }).eq('id', it.id)))
  }
  async function applyPreset(list: string[]) {
    const have = new Set(items.map(i => i.title.trim()))
    const add = list.filter(t => !have.has(t))
    if (!add.length) return
    const base = items.length ? Math.max(...items.map(i => i.sort)) + 1 : 0
    const { data, error } = await supabase.from('mtg_items').insert(add.map((t, i) => ({ meeting_id: m.id, sort: base + i, title: t }))).select('*')
    if (error) { notify(error.message); return }
    setItems(x => [...x, ...((data || []) as Item[])])
  }

  // присъствие
  function patchAtt(a: Attendance, patch: Partial<Attendance>) {
    setAtt(x => x.map(r => r.id === a.id ? { ...r, ...patch } : r))
    later('a:' + a.id + Object.keys(patch).join(','), () => run(supabase.from('mtg_attendance').update(patch).eq('id', a.id)), 'reason' in patch ? 700 : 0)
    markHeld()
  }
  async function addAtt(rows: Partial<Attendance>[]) {
    if (!rows.length) return
    const base = att.length ? Math.max(...att.map(a => a.sort)) + 1 : 0
    const { data, error } = await supabase.from('mtg_attendance').insert(rows.map((r, i) => ({ meeting_id: m.id, status: 'present', role: 'member', sort: base + i, ...r }))).select('*')
    if (error) { notify(error.message); return }
    setAtt(x => [...x, ...((data || []) as Attendance[])])
  }
  async function delAtt(a: Attendance) {
    if (await run(supabase.from('mtg_attendance').delete().eq('id', a.id!))) setAtt(x => x.filter(r => r.id !== a.id))
  }
  function allPresent() {
    const ids = att.filter(a => a.role === 'member' && a.status !== 'present').map(a => a.id!)
    if (!ids.length) return
    setAtt(x => x.map(a => ids.includes(a.id!) ? { ...a, status: 'present', reason: null } : a))
    run(supabase.from('mtg_attendance').update({ status: 'present', reason: null }).in('id', ids)); markHeld()
  }

  // решения
  async function addDecision(itemId: string | null, preset: Partial<Decision> = {}) {
    const sort = decs.length ? Math.max(...decs.map(d => d.sort)) + 1 : 0
    const { data, error } = await supabase.from('mtg_decisions').insert({ meeting_id: m.id, item_id: itemId, sort, text: '', kind: 'vote', majority: m.body === 'os' ? 'simple' : 'simple', ...preset }).select('*').single()
    if (error || !data) { notify(error?.message || 'Грешка'); return }
    setDecs(x => [...x, data as Decision]); markHeld()
  }
  function patchDec(id: string, patch: Partial<Decision>, debounce = true) {
    const d = decs.find(x => x.id === id); if (!d) return
    const nd = { ...d, ...patch }
    // резултатът следва гласовете и вида мнозинство
    if (nd.kind === 'noted') nd.outcome = 'noted'
    else {
      const r = voteResult(nd, q.present, q.total)
      nd.outcome = r.empty || r.adopted ? 'adopted' : 'rejected'
    }
    setDecs(x => x.map(y => y.id === id ? nd : y))
    const full = { ...patch, outcome: nd.outcome }
    const doit = () => run(supabase.from('mtg_decisions').update(full).eq('id', id))
    if (debounce) later('d:' + id + Object.keys(patch).join(','), doit); else doit()
    markHeld()
  }
  async function delDecision(d: Decision) {
    if (!await confirmDialog('Изтрий решението?')) return
    if (await run(supabase.from('mtg_decisions').delete().eq('id', d.id))) setDecs(x => x.filter(y => y.id !== d.id))
  }

  // ── вписване, поправка, скан, изтриване ──
  const checks = [
    { ok: items.some(i => i.title.trim()), l: 'Има дневен ред' },
    { ok: q.total > 0, l: 'Попълнено присъствие' },
    { ok: q.ok, l: `Кворум (${QUORUM_LABEL[m.quorum_rule]})`, warn: true },
    { ok: !!m.secretary_id, l: 'Определен протоколчик' },
    { ok: decs.every(d => d.text.trim()), l: 'Всички решения имат текст' },
    { ok: decs.every(d => d.kind === 'noted' || d.votes_for != null), l: 'Гласуването е отразено при всички решения' },
    { ok: decs.every(d => d.kind === 'noted' || !voteResult(d, q.present, q.total).over), l: 'Гласовете не надвишават присъстващите' },
    { ok: m.meeting_date <= today, l: 'Заседанието е проведено' },
  ]
  const blocking = checks.filter(c => !c.ok && !c.warn && c.l !== 'Определен протоколчик')
  const [busy, setBusy] = useState(false)

  async function finalize() {
    const warn = checks.filter(c => !c.ok).map(c => '• ' + c.l).join('\n')
    if (!await confirmDialog(`Впиши протокола в Книгата? Получава пореден номер и се заключва.${warn ? `\n\nВнимание:\n${warn}` : ''}`, { title: 'Вписване в Книгата', confirmLabel: 'Впиши' })) return
    await flush()
    setBusy(true)
    const { data, error } = await supabase.rpc('mtg_finalize', { p_meeting: m.id })
    setBusy(false)
    if (error) { notify(error.message); return }
    setM(x => ({ ...x, status: 'final', meeting_no: data as number, finalized_at: new Date().toISOString() }))
    setStep('review')
    notify(`Протоколът е вписан в Книгата под № ${data}`, 'success')
  }
  const [reopenNote, setReopenNote] = useState<string | null>(null)
  async function reopen() {
    const note = (reopenNote || '').trim()
    if (!note) return
    const { error } = await supabase.rpc('mtg_reopen', { p_meeting: m.id, p_note: note })
    if (error) { notify(error.message); return }
    router.refresh()
    setM(x => ({ ...x, status: 'held', amended_at: new Date().toISOString(), amend_note: (x.amend_note ? x.amend_note + '\n' : '') + `${dmy(today)}: ${note}` }))
    setReopenNote(null); setStep('minutes')
  }
  async function del() {
    if (!await confirmDialog('Изтрий заседанието с дневния ред, присъствието и решенията?')) return
    const { error } = await supabase.from('mtg_meetings').delete().eq('id', m.id)
    if (error) { notify(error.message); return }
    router.push('/meetings')
  }
  const scanRef = useRef<HTMLInputElement>(null)
  async function uploadScan(f: File) {
    const safe = f.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
    const path = `${m.id}/${Date.now()}_${safe}`
    setBusy(true)
    const { error } = await supabase.storage.from('meetings').upload(path, f)
    if (error) { setBusy(false); notify(error.message); return }
    const old = m.scan_path
    const { error: e2 } = await supabase.from('mtg_meetings').update({ scan_path: path }).eq('id', m.id)
    if (e2) { await supabase.storage.from('meetings').remove([path]); setBusy(false); notify(e2.message); return }
    if (old) await supabase.storage.from('meetings').remove([old])
    const { data } = await supabase.storage.from('meetings').createSignedUrl(path, 1800)
    setM(x => ({ ...x, scan_path: path })); setScanUrl(data?.signedUrl || null); setBusy(false)
    notify('Сканираният протокол е прикачен', 'success')
  }

  async function word(kind: 'protocol' | 'invite') {
    const mod = await import('@/lib/docx-meetings')
    const d = { m, items: [...items].sort((a, b) => a.sort - b.sort), decisions: decs, attendance: [...att].sort((a, b) => a.sort - b.sort), people: byId, yearName }
    if (kind === 'invite') await mod.generateInvitation(d); else await mod.generateMeetingProtocol(d)
  }
  async function createSet() {
    const { data, error } = await supabase.from('council_sets').insert({
      title: `${m.title || BODY_LABEL[m.body]}`, event_date: m.meeting_date, created_by: meId,
    }).select('id').single()
    if (error || !data) { notify(error?.message || 'Грешка'); return }
    patchMeeting({ council_set_id: data.id })
    notify('Създаден е комплект в „За съгласуване“ — качете материалите там', 'success')
  }

  const sortedItems = [...items].sort((a, b) => a.sort - b.sort)
  const sortedAtt = [...att].sort((a, b) => a.sort - b.sort)
  const due = protocolDue(m)
  const steps: { k: Step; l: string; i: React.ReactNode; done: boolean }[] = [
    { k: 'prep', l: 'Подготовка', i: <Landmark size={16} />, done: items.length > 0 },
    { k: 'att', l: 'Присъствие', i: <Users size={16} />, done: q.total > 0 && q.ok },
    { k: 'minutes', l: 'Протокол', i: <FileText size={16} />, done: decs.length > 0 && decs.every(d => d.text.trim()) },
    { k: 'review', l: 'Книга', i: <BookCheck size={16} />, done: m.status === 'final' },
  ]
  const memberIds = new Set(att.filter(a => a.staff_id).map(a => a.staff_id))

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* заглавие */}
      <div className="print:hidden">
        <Link href="/meetings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-3"><ArrowLeft size={15} /> Заседания</Link>
        <header className="rounded-3xl bg-white border border-slate-200 shadow-[0_2px_12px_rgba(15,34,64,0.05)] overflow-hidden mb-5">
          <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${tone.fg}, ${tone.ring})` }} />
          <div className="p-5 md:p-6 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="w-16 shrink-0 text-center rounded-2xl py-2" style={{ background: tone.soft, boxShadow: `inset 0 0 0 1px ${tone.ring}` }}>
                <div className="text-[10px] font-semibold" style={{ color: tone.fg }}>{BODY_SHORT[m.body]}</div>
                <div className="text-2xl font-semibold tabular-nums leading-tight" style={{ color: tone.fg }}>{m.meeting_no ? `№${m.meeting_no}` : '—'}</div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg md:text-xl font-semibold text-slate-800">{m.title || BODY_LABEL[m.body]}</h1>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_TONE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
                  {m.kind === 'extraordinary' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">извънредно</span>}
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {BODY_LABEL[m.body]} · {weekday(m.meeting_date)}, {longDate(m.meeting_date)}{m.start_time ? ` · ${hm(m.start_time)} ч.` : ''}{m.place ? ` · ${m.place}` : ''}
                </p>
                {isLead && due && m.meeting_date <= today && (
                  <p className={`text-xs mt-1 inline-flex items-center gap-1 ${due.left < 0 ? 'text-rose-600' : due.left <= 3 ? 'text-amber-600' : 'text-slate-400'}`}>
                    <AlertTriangle size={12} /> Протоколът се изготвя до {dmy(due.due)} (10 дни, чл. 41, ал. 6 от Наредба № 8){due.left < 0 ? ` — закъснява с ${-due.left} д.` : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {canEdit && (
                <span className="text-xs text-slate-400 inline-flex items-center gap-1 mr-2 min-w-[80px]">
                  {saving > 0 ? <><Loader2 size={13} className="animate-spin" /> Запис…</> : saveErr ? <><CloudOff size={13} className="text-rose-500" /> Грешка</> : <><CircleCheck size={13} className="text-emerald-500" /> Запазено</>}
                </span>
              )}
              {(m.status === 'planned' || isLead) && <Btn onClick={() => word('invite')} icon={<Mail size={15} />}>Покана</Btn>}
              {(isLead || m.status === 'final') && <Btn onClick={() => word('protocol')} icon={<Download size={15} />}>Word</Btn>}
              {(isLead || m.status === 'final') && <Btn onClick={() => { setStep('review'); setTimeout(() => window.print(), 300) }} icon={<Printer size={15} />}>Печат / PDF</Btn>}
              {isManager && m.status !== 'final' && <button onClick={del} title="Изтрий заседанието" className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button>}
            </div>
          </div>

          {/* стъпки */}
          {isLead && (
            <nav className="border-t border-slate-100 px-3 md:px-5 flex overflow-x-auto">
              {steps.map((s, i) => {
                const on = step === s.k
                const lock = m.status === 'final' && s.k !== 'review'
                return (
                  <button key={s.k} onClick={() => !lock && setStep(s.k)} disabled={lock}
                    className={`relative flex items-center gap-2.5 px-3 md:px-4 py-3.5 text-sm whitespace-nowrap transition-colors ${on ? 'text-slate-900 font-medium' : lock ? 'text-slate-300' : 'text-slate-500 hover:text-slate-800'}`}>
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold ${s.done ? 'bg-emerald-500 text-white' : on ? 'text-white' : 'bg-slate-100 text-slate-500'}`} style={on && !s.done ? { background: tone.fg } : {}}>
                      {s.done ? <Check size={13} /> : i + 1}
                    </span>
                    {s.l}
                    {on && <span className="absolute left-3 right-3 bottom-0 h-0.5 rounded-full" style={{ background: tone.fg }} />}
                  </button>
                )
              })}
            </nav>
          )}
        </header>
      </div>

      {/* ── 1. Подготовка ── */}
      {step === 'prep' && canEdit && (
        <div className="grid lg:grid-cols-[1fr,340px] gap-5 print:hidden">
          <Card title="Дневен ред" icon={<FileText size={16} />} sub="Точките стават раздели в протокола; към всяка се добавят решения.">
            <div className="space-y-2">
              {sortedItems.map((it, idx) => (
                <div key={it.id} className="group flex gap-2.5 items-start rounded-2xl border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 mt-0.5" style={{ background: tone.bg, color: tone.fg }}>{idx + 1}</span>
                  <div className="flex-1 min-w-0 space-y-2">
                    <textarea value={it.title} onChange={e => patchItem(it.id, { title: e.target.value })} rows={1} placeholder="Точка от дневния ред…"
                      className="w-full resize-none text-[15px] text-slate-800 bg-transparent focus:outline-none placeholder:text-slate-300 field-sizing-content" />
                    <Rapporteur it={it} people={active} onChange={p => patchItem(it.id, p, 'rapporteur_text' in p)} />
                  </div>
                  <div className="flex flex-col opacity-40 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ChevronUp size={15} /></button>
                    <button onClick={() => moveItem(idx, 1)} disabled={idx === sortedItems.length - 1} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ChevronDown size={15} /></button>
                  </div>
                  <button onClick={() => delItem(it)} className="p-1.5 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100"><Trash2 size={15} /></button>
                </div>
              ))}
              <button onClick={() => addItem()} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:bg-white">
                <Plus size={15} /> Добави точка
              </button>
            </div>
            <Suggestions body={m.body} have={new Set(items.map(i => i.title.trim()))} onAdd={t => addItem(t)} onPreset={applyPreset} />
          </Card>

          <div className="space-y-5">
            <Card title="Кога и къде" icon={<Info size={16} />}>
              <div className="space-y-3">
                <Field label="Дата"><DateInput value={m.meeting_date} onChange={v => v && patchMeeting({ meeting_date: v })} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Начало"><input type="time" value={hm(m.start_time)} onChange={e => patchMeeting({ start_time: e.target.value || null }, true)} className="tinput" /></Field>
                  <Field label="Край"><input type="time" value={hm(m.end_time)} onChange={e => patchMeeting({ end_time: e.target.value || null }, true)} className="tinput" /></Field>
                </div>
                <Field label="Място"><input value={m.place || ''} onChange={e => patchMeeting({ place: e.target.value || null }, true)} placeholder="учителската стая" className="tinput" /></Field>
                <Field label="Тема"><input value={m.title || ''} onChange={e => patchMeeting({ title: e.target.value || null }, true)} placeholder={BODY_LABEL[m.body]} className="tinput" /></Field>
                <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
                  {(['regular', 'extraordinary'] as const).map(k => (
                    <button key={k} onClick={() => patchMeeting({ kind: k })} className={`flex-1 py-1.5 rounded-lg text-xs ${m.kind === k ? 'bg-white shadow-sm text-slate-800 font-medium' : 'text-slate-500'}`}>{k === 'regular' ? 'Редовно' : 'Извънредно'}</button>
                  ))}
                </div>
              </div>
            </Card>
            <Card title="Водещи" icon={<Users size={16} />}>
              <div className="space-y-3">
                <Field label="Председател"><PersonSelect value={m.chair_id} people={active} onChange={v => patchMeeting({ chair_id: v })} /></Field>
                <Field label="Протоколчик"><PersonSelect value={m.secretary_id} people={active} onChange={v => patchMeeting({ secretary_id: v })} placeholder="— изберете —" /></Field>
                <p className="text-[11px] text-slate-400 leading-snug">Председателят и протоколчикът могат да попълват протокола, без да са от ръководството.</p>
                <Field label="Кворум">
                  <select value={m.quorum_rule} onChange={e => patchMeeting({ quorum_rule: e.target.value as any })} className="tinput">
                    <option value="two_thirds">поне 2/3 от членовете</option>
                    <option value="half">повече от половината</option>
                  </select>
                </Field>
              </div>
            </Card>
            <Card title="Материали" icon={<FolderOpen size={16} />} sub="Колегите ги четат предварително и натискат „Запознах се“.">
              {m.council_set_id ? (
                <div className="flex items-center gap-2">
                  <Link href="/council" className="flex-1 text-sm text-blue-700 hover:underline truncate">{sets.find(s => s.id === m.council_set_id)?.title || 'Комплект материали'} →</Link>
                  <button onClick={() => patchMeeting({ council_set_id: null })} className="p-1 text-slate-400 hover:text-slate-700" title="Откачи"><X size={14} /></button>
                </div>
              ) : (
                <div className="space-y-2">
                  {sets.length > 0 && (
                    <select value="" onChange={e => e.target.value && patchMeeting({ council_set_id: e.target.value })} className="tinput">
                      <option value="">Свържи с комплект…</option>
                      {sets.map(s => <option key={s.id} value={s.id}>{s.title}{s.event_date ? ` — ${dmy(s.event_date)}` : ''}</option>)}
                    </select>
                  )}
                  <button onClick={createSet} className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"><Plus size={14} /> Нов комплект за съгласуване</button>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ── 2. Присъствие ── */}
      {step === 'att' && canEdit && (
        <div className="grid lg:grid-cols-[1fr,320px] gap-5 print:hidden">
          <Card title="Присъствен списък" icon={<Users size={16} />}
            action={<button onClick={allPresent} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 inline-flex items-center gap-1"><Check size={13} /> Всички присъстват</button>}>
            <div className="divide-y divide-slate-100">
              {sortedAtt.filter(a => a.role === 'member').map(a => (
                <AttRow key={a.id} a={a} name={attName(a, byId)} sub={a.staff_id ? byId[a.staff_id]?.position || '' : a.guest_role || ''} onPatch={p => patchAtt(a, p)} onDel={() => delAtt(a)} />
              ))}
              {q.total === 0 && <p className="text-sm text-slate-400 py-4">Няма членове. Добавете ги от дясно.</p>}
            </div>
            {att.some(a => a.role !== 'member') && (
              <>
                <h4 className="text-[11px] uppercase tracking-widest text-slate-400 mt-5 mb-1">Със съвещателен глас и гости</h4>
                <div className="divide-y divide-slate-100">
                  {sortedAtt.filter(a => a.role !== 'member').map(a => (
                    <AttRow key={a.id} a={a} name={attName(a, byId)} sub={`${ROLE_LABEL[a.role]}${a.guest_role ? ' · ' + a.guest_role : ''}`} onPatch={p => patchAtt(a, p)} onDel={() => delAtt(a)} />
                  ))}
                </div>
              </>
            )}
          </Card>
          <div className="space-y-5">
            <QuorumCard q={q} rule={m.quorum_rule} tone={tone.fg} />
            <AddPeople body={m.body} people={active} memberIds={memberIds} onAdd={addAtt} />
          </div>
        </div>
      )}

      {/* ── 3. Протокол ── */}
      {step === 'minutes' && canEdit && (
        <div className="grid lg:grid-cols-[1fr,300px] gap-5 print:hidden">
          <div className="space-y-4">
            <Card title="Откриване" icon={<PencilLine size={16} />} sub="По желание — напр. кой откри заседанието, приемане на дневния ред.">
              <AutoText value={m.intro || ''} onChange={v => patchMeeting({ intro: v || null }, true)} placeholder="Заседанието беше открито от председателя…" />
            </Card>
            {sortedItems.map((it, idx) => {
              const ds = decs.filter(d => d.item_id === it.id).sort((a, b) => a.sort - b.sort)
              const isReport = /изпълнение(то)? на решенията/i.test(it.title)
              return (
                <section key={it.id} className="rounded-3xl bg-white border border-slate-200 shadow-[0_1px_6px_rgba(15,34,64,0.04)] overflow-hidden">
                  <div className="px-5 py-4 flex items-start gap-3 border-b border-slate-100" style={{ background: `linear-gradient(90deg, ${tone.soft}, #fff 70%)` }}>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0" style={{ background: tone.fg, color: '#fff' }}>{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-semibold text-slate-800">{it.title || <span className="text-slate-400">Без заглавие</span>}</h3>
                      {(it.rapporteur_id || it.rapporteur_text) && <p className="text-xs text-slate-500 mt-0.5">Докладва: {it.rapporteur_id ? fullName(byId[it.rapporteur_id]) : it.rapporteur_text}</p>}
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    {isReport && prevOpen.length > 0 && <PrevDecisions list={prevOpen} byId={byId} onInsert={txt => patchItem(it.id, { discussion: ((it.discussion || '') + (it.discussion ? '\n' : '') + txt) }, false)} />}
                    <div>
                      <label className="text-[11px] uppercase tracking-widest text-slate-400">Разисквания</label>
                      <AutoText value={it.discussion || ''} onChange={v => { patchItem(it.id, { discussion: v || null }); markHeld() }}
                        placeholder="Кой какво докладва, изказвания, въпроси и предложения…" />
                    </div>
                    {ds.map(d => (
                      <DecisionCard key={d.id} d={d} no={nums[d.id]} present={q.present} total={q.total} people={active} body={m.body}
                        onPatch={(p, deb) => patchDec(d.id, p, deb)} onDel={() => delDecision(d)} />
                    ))}
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => addDecision(it.id)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: NAVY }}><Gavel size={14} /> Решение с гласуване</button>
                      <button onClick={() => addDecision(it.id, { kind: 'noted', outcome: 'noted', text: 'Приема за сведение информацията по т. ' + (idx + 1) + '.' })}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm border border-slate-200 text-slate-600 hover:bg-slate-50"><Eye size={14} /> Приема за сведение</button>
                    </div>
                  </div>
                </section>
              )
            })}
            {sortedItems.length === 0 && (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                Няма дневен ред. <button onClick={() => setStep('prep')} className="text-blue-700 hover:underline">Добавете точки</button>.
              </div>
            )}
          </div>
          <aside className="space-y-4 lg:sticky lg:top-4 self-start">
            <QuorumCard q={q} rule={m.quorum_rule} tone={tone.fg} compact onOpen={() => setStep('att')} />
            <div className="rounded-3xl bg-white border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Съдържание</h4>
              <ol className="space-y-1.5 text-sm">
                {sortedItems.map((it, i) => {
                  const n = decs.filter(d => d.item_id === it.id).length
                  return (
                    <li key={it.id} className="flex gap-2 text-slate-600">
                      <span className="tabular-nums text-slate-400">{i + 1}.</span>
                      <span className="flex-1 line-clamp-2">{it.title}</span>
                      {n > 0 ? <span className="text-[11px] text-emerald-600 shrink-0">{n} реш.</span> : it.discussion ? <Check size={13} className="text-slate-300 shrink-0 mt-1" /> : null}
                    </li>
                  )
                })}
              </ol>
              <button onClick={() => setStep('review')} className="mt-4 w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: tone.fg }}>
                <BookCheck size={15} /> Преглед и вписване
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── 4. Преглед / Книга (и изгледът за всички останали) ── */}
      {step === 'review' && (
        <div className="grid lg:grid-cols-[1fr,300px] gap-5 print:block">
          <div className="order-2 lg:order-1">
            {!isLead && m.status === 'planned' ? (
              <Agenda m={m} items={sortedItems} byId={byId} />
            ) : (
              <div className="rounded-3xl bg-slate-100/70 p-3 md:p-6 print:p-0 print:bg-white">
                <ProtocolPaper m={m} items={sortedItems} decisions={decs} attendance={sortedAtt} people={byId} />
              </div>
            )}
          </div>
          <aside className="order-1 lg:order-2 space-y-4 lg:sticky lg:top-4 self-start print:hidden">
            {m.status !== 'final' && canEdit && (
              <div className="rounded-3xl bg-white border border-slate-200 p-5">
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Проверка преди вписване</h4>
                <ul className="space-y-2">
                  {checks.map(c => (
                    <li key={c.l} className="flex items-start gap-2 text-sm">
                      {c.ok ? <CircleCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" /> : <AlertTriangle size={16} className={`${c.warn ? 'text-amber-500' : 'text-rose-500'} shrink-0 mt-0.5`} />}
                      <span className={c.ok ? 'text-slate-600' : 'text-slate-800'}>{c.l}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={finalize} disabled={busy || blocking.length > 0}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-40 shadow-md" style={{ background: `linear-gradient(135deg, ${NAVY}, ${tone.fg})` }}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Впиши в Книгата
                </button>
                <p className="text-[11px] text-slate-400 mt-2 leading-snug">Протоколът получава пореден № за учебната година (от № 1, отделно за ПС и ОС) и се заключва. Разпечатайте го, подпишете и прикачете сканираното копие.</p>
              </div>
            )}
            {m.status === 'final' && (
              <div className="rounded-3xl bg-white border border-emerald-200 p-5">
                <div className="flex items-center gap-2 text-emerald-700"><CircleCheck size={18} /><span className="text-sm font-semibold">Вписан в Книгата под № {m.meeting_no}</span></div>
                {m.finalized_at && <p className="text-xs text-slate-500 mt-1">на {dmy(m.finalized_at)}</p>}
                <div className="mt-4 space-y-2">
                  {scanUrl ? (
                    <a href={scanUrl} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"><Eye size={14} /> Подписаният протокол</a>
                  ) : isLead && <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">Прикачете сканирания подписан и подпечатан протокол.</p>}
                  {isLead && (
                    <>
                      <input ref={scanRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadScan(f); e.target.value = '' }} />
                      <button onClick={() => scanRef.current?.click()} disabled={busy} className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-600 hover:border-slate-400">
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {scanUrl ? 'Смени скана' : 'Прикачи скан'}
                      </button>
                    </>
                  )}
                  {isManager && (reopenNote === null ? (
                    <button onClick={() => setReopenNote('')} className="w-full text-xs text-slate-400 hover:text-slate-700 pt-1">Поправка на протокола…</button>
                  ) : (
                    <div className="pt-2 space-y-2">
                      <textarea value={reopenNote} onChange={e => setReopenNote(e.target.value)} rows={2} autoFocus placeholder="Мотив за поправката (остава в протокола)" className="tinput" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setReopenNote(null)} className="text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-50">Отказ</button>
                        <button onClick={reopen} disabled={!reopenNote.trim()} className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white disabled:opacity-40">Отключи за поправка</button>
                      </div>
                    </div>
                  ))}
                </div>
                {m.amend_note && <p className="text-[11px] text-slate-500 mt-3 whitespace-pre-line border-t border-slate-100 pt-2"><b>Поправки:</b>{'\n'}{m.amend_note}</p>}
              </div>
            )}
            {(m.status === 'final' || isLead) && decs.some(d => d.responsible_id || d.due_date) && (
              <div className="rounded-3xl bg-white border border-slate-200 p-5">
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Решения за изпълнение</h4>
                <ul className="space-y-2.5">
                  {decs.filter(d => d.responsible_id || d.due_date).sort((a, b) => nums[a.id] - nums[b.id]).map(d => (
                    <li key={d.id} className={`text-sm ${d.responsible_id === meId ? 'bg-blue-50/60 -mx-2 px-2 py-1 rounded-lg' : ''}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold tabular-nums text-slate-400 mt-0.5">{nums[d.id]}.</span>
                        <span className="flex-1 text-slate-700 line-clamp-3">{d.text}</span>
                      </div>
                      <div className="flex items-center gap-2 pl-5 mt-1 text-[11px] text-slate-500">
                        {d.responsible_id && <span>{fullName(byId[d.responsible_id])}</span>}
                        {d.due_date && <span>до {dmy(d.due_date)}</span>}
                        {m.status === 'final' && <span className={`ml-auto px-1.5 py-0.5 rounded-full ${TASK_TONE[d.task_status]}`}>{TASK_LABEL[d.task_status]}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
                {m.status === 'final' && <Link href="/meetings?tab=decisions" className="block text-xs text-blue-700 hover:underline mt-3">Отчитане и проследяване →</Link>}
              </div>
            )}
          </aside>
        </div>
      )}

      <style jsx global>{`
        .tinput { width: 100%; font-size: 0.875rem; border-radius: 0.6rem; border: 1px solid rgb(226 232 240); padding: 0.45rem 0.65rem; background: #fff; }
        .tinput:focus { outline: none; border-color: rgb(148 163 184); }
        .field-sizing-content { field-sizing: content; }
        @media print { @page { size: A4; margin: 16mm 14mm; } .protocol-paper { max-width: none !important; padding: 0 !important; font-size: 12pt; } }
      `}</style>
    </div>
  )
}

// ── малки части ──
function Btn({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300">{icon} {children}</button>
}
function Card({ title, icon, sub, action, children }: { title: string; icon?: React.ReactNode; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white border border-slate-200 shadow-[0_1px_6px_rgba(15,34,64,0.04)] p-5">
      <div className="flex items-start gap-2 mb-4">
        {icon && <span className="text-slate-400 mt-0.5">{icon}</span>}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">{label}</span>{children}</label>
}
function PersonSelect({ value, people, onChange, placeholder = '—' }: { value: string | null; people: Person[]; onChange: (v: string | null) => void; placeholder?: string }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value || null)} className="tinput">
      <option value="">{placeholder}</option>
      {people.map(p => <option key={p.id} value={p.id}>{fullName(p)}{p.position ? ` — ${p.position}` : ''}</option>)}
    </select>
  )
}
function AutoText({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = Math.max(76, el.scrollHeight) + 'px' } }, [value])
  return <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className="mt-1 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-[15px] leading-relaxed text-slate-800 focus:outline-none focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all" />
}

function Rapporteur({ it, people, onChange }: { it: Item; people: Person[]; onChange: (p: Partial<Item>) => void }) {
  const [free, setFree] = useState(!!it.rapporteur_text && !it.rapporteur_id)
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span className="shrink-0">Докладва:</span>
      {free ? (
        <input value={it.rapporteur_text || ''} onChange={e => onChange({ rapporteur_text: e.target.value || null, rapporteur_id: null })} placeholder="име / комисия" className="flex-1 min-w-0 border-b border-dashed border-slate-200 bg-transparent py-0.5 focus:outline-none focus:border-slate-400" />
      ) : (
        <select value={it.rapporteur_id || ''} onChange={e => onChange({ rapporteur_id: e.target.value || null, rapporteur_text: null })} className="flex-1 min-w-0 bg-transparent py-0.5 focus:outline-none text-slate-600">
          <option value="">—</option>
          {people.map(p => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
        </select>
      )}
      <button onClick={() => setFree(!free)} className="text-[11px] text-slate-400 hover:text-slate-700 shrink-0">{free ? 'от списъка' : 'друг'}</button>
    </div>
  )
}

function Suggestions({ body, have, onAdd, onPreset }: { body: 'ps' | 'os'; have: Set<string>; onAdd: (t: string) => void; onPreset: (l: string[]) => void }) {
  const lib = (body === 'ps' ? PS_ITEMS : OS_ITEMS).filter(t => !have.has(t))
  const presets = body === 'ps' ? PS_PRESETS : OS_PRESETS
  return (
    <div className="mt-5 pt-4 border-t border-slate-100">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2"><Wand2 size={13} /> Готови дневни редове</div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {presets.map(p => (
          <button key={p.label} onClick={() => onPreset(p.items)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900">
            <Sparkles size={11} /> {p.label}{p.hint ? <span className="text-slate-400"> · {p.hint}</span> : null}
          </button>
        ))}
      </div>
      {lib.length > 0 && (
        <>
          <div className="text-xs text-slate-500 mb-2">Чести точки {body === 'ps' ? '(чл. 263 ЗПУО)' : '(чл. 6–7 КТ)'}</div>
          <div className="flex flex-wrap gap-1.5">
            {lib.map(t => (
              <button key={t} onClick={() => onAdd(t)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                <Plus size={11} /> {t}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() }
function AttRow({ a, name, sub, onPatch, onDel }: { a: Attendance; name: string; sub: string; onPatch: (p: Partial<Attendance>) => void; onDel: () => void }) {
  const opts: { k: AttStatus; l: string; cls: string }[] = [
    { k: 'present', l: 'Присъства', cls: 'bg-emerald-500 text-white' },
    { k: 'late', l: 'Закъснял', cls: 'bg-amber-400 text-white' },
    { k: 'left', l: 'Напуснал', cls: 'bg-amber-500 text-white' },
    { k: 'absent', l: 'Отсъства', cls: 'bg-rose-500 text-white' },
  ]
  const absent = a.status === 'absent'
  return (
    <div className="group py-2.5">
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-semibold shrink-0 transition-colors ${absent ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-700'}`}>{initials(name)}</span>
        <div className="min-w-0 flex-1">
          <div className={`text-sm truncate ${absent ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-800'}`}>{name}</div>
          {sub && <div className="text-[11px] text-slate-400 truncate">{sub}</div>}
        </div>
        <div className="hidden sm:flex p-0.5 rounded-xl bg-slate-100">
          {opts.map(o => (
            <button key={o.k} onClick={() => onPatch({ status: o.k, ...(o.k !== 'absent' && o.k !== 'late' && o.k !== 'left' ? { reason: null } : {}) })}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all ${a.status === o.k ? o.cls + ' shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{o.l}</button>
          ))}
        </div>
        <select value={a.status} onChange={e => onPatch({ status: e.target.value as AttStatus })} className="sm:hidden text-xs border border-slate-200 rounded-lg px-1.5 py-1">
          {opts.map(o => <option key={o.k} value={o.k}>{o.l}</option>)}
        </select>
        <button onClick={onDel} className="p-1 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100"><X size={14} /></button>
      </div>
      {a.status !== 'present' && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-12">
          {(absent ? ABSENCE_REASONS : ['служебен ангажимент', 'лични причини']).map(r => (
            <button key={r} onClick={() => onPatch({ reason: a.reason === r ? null : r })}
              className={`px-2 py-0.5 rounded-full text-[11px] border ${a.reason === r ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>{r}</button>
          ))}
          <input value={a.reason && !ABSENCE_REASONS.includes(a.reason) ? a.reason : ''} onChange={e => onPatch({ reason: e.target.value || null })} placeholder={absent ? 'друга причина…' : 'час / бележка…'}
            className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-slate-200 focus:outline-none focus:border-slate-400 w-36" />
        </div>
      )}
    </div>
  )
}

function QuorumCard({ q, rule, tone, compact, onOpen }: { q: ReturnType<typeof quorum>; rule: Meeting['quorum_rule']; tone: string; compact?: boolean; onOpen?: () => void }) {
  const pct = q.total ? q.present / q.total : 0
  const needPct = q.total ? q.need / q.total : 0
  const R = 42, C = 2 * Math.PI * R
  return (
    <div className={`rounded-3xl border p-5 ${q.ok ? 'bg-white border-slate-200' : 'bg-rose-50/50 border-rose-200'}`}>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 100 100" className={compact ? 'w-16 h-16' : 'w-24 h-24'} aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" stroke="#eef2f7" strokeWidth="9" />
          <circle cx="50" cy="50" r={R} fill="none" stroke={q.ok ? '#10b981' : '#f43f5e'} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray .4s ease' }} />
          {q.total > 0 && <line x1="50" y1="3" x2="50" y2="13" stroke={tone} strokeWidth="2.5" transform={`rotate(${needPct * 360} 50 50)`} />}
          <text x="50" y="49" textAnchor="middle" className="fill-slate-800" style={{ fontSize: 22, fontWeight: 600 }}>{q.present}</text>
          <text x="50" y="66" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11 }}>от {q.total}</text>
        </svg>
        <div className="min-w-0">
          <div className={`text-sm font-semibold ${q.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{q.ok ? 'Има кворум' : q.total ? 'Няма кворум' : 'Няма членове'}</div>
          <div className="text-xs text-slate-500 mt-0.5">Нужни {q.need} ({QUORUM_LABEL[rule]})</div>
          <div className="text-xs text-slate-500">Отсъстват {q.absent}</div>
          {onOpen && <button onClick={onOpen} className="text-xs text-blue-700 hover:underline mt-1">Присъствие →</button>}
        </div>
      </div>
    </div>
  )
}

function AddPeople({ body, people, memberIds, onAdd }: { body: 'ps' | 'os'; people: Staff[]; memberIds: Set<string | null>; onAdd: (r: Partial<Attendance>[]) => void }) {
  const [pick, setPick] = useState('')
  const [guest, setGuest] = useState('')
  const [gRole, setGRole] = useState('')
  const [adv, setAdv] = useState(true)
  const missing = defaultMembers(body, people).filter(p => !memberIds.has(p.id))
  const others = people.filter(p => !memberIds.has(p.id))
  return (
    <div className="rounded-3xl bg-white border border-slate-200 p-5 space-y-4">
      <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><UserPlus size={15} className="text-slate-400" /> Добавяне</h4>
      {missing.length > 0 && (
        <button onClick={() => onAdd(missing.map(p => ({ staff_id: p.id, role: 'member' })))} className="w-full text-left text-sm rounded-2xl bg-blue-50 text-blue-800 px-3.5 py-2.5 hover:bg-blue-100">
          + {missing.length} {body === 'ps' ? 'педагогически специалисти' : 'служители'}, които липсват в списъка
        </button>
      )}
      <div className="flex gap-2">
        <select value={pick} onChange={e => setPick(e.target.value)} className="tinput flex-1 min-w-0">
          <option value="">Служител…</option>
          {others.map(p => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
        </select>
        <button disabled={!pick} onClick={() => { onAdd([{ staff_id: pick, role: 'member' }]); setPick('') }} className="px-3 rounded-xl text-sm text-white disabled:opacity-40" style={{ background: NAVY }}><Plus size={15} /></button>
      </div>
      <div className="pt-3 border-t border-slate-100 space-y-2">
        <div className="text-xs text-slate-500">Външен участник</div>
        <input value={guest} onChange={e => setGuest(e.target.value)} placeholder="Име и фамилия" className="tinput" />
        <input value={gRole} onChange={e => setGRole(e.target.value)} placeholder="напр. медицинско лице, родител, обществен съвет" className="tinput" />
        <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={adv} onChange={e => setAdv(e.target.checked)} /> със съвещателен глас (чл. 262, ал. 5 ЗПУО)</label>
        <button disabled={!guest.trim()} onClick={() => { onAdd([{ guest_name: guest.trim(), guest_role: gRole.trim() || null, role: adv ? 'advisory' : 'guest' }]); setGuest(''); setGRole('') }}
          className="w-full py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">Добави</button>
      </div>
    </div>
  )
}

function VoteInput({ label, icon, value, onChange, cls }: { label: string; icon: React.ReactNode; value: number | null; onChange: (v: number | null) => void; cls: string }) {
  return (
    <div className={`flex-1 min-w-[96px] rounded-2xl border px-3 py-2 ${cls}`}>
      <div className="flex items-center gap-1 text-[11px] font-medium opacity-80">{icon} {label}</div>
      <div className="flex items-center gap-1 mt-1">
        <button onClick={() => onChange(Math.max(0, (value ?? 0) - 1))} className="w-6 h-6 rounded-lg bg-white/70 hover:bg-white text-sm leading-none">−</button>
        <input type="number" min={0} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0))}
          className="w-full min-w-0 text-center text-lg font-semibold tabular-nums bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
        <button onClick={() => onChange((value ?? 0) + 1)} className="w-6 h-6 rounded-lg bg-white/70 hover:bg-white text-sm leading-none">+</button>
      </div>
    </div>
  )
}

function DecisionCard({ d, no, present, total, people, body, onPatch, onDel }: {
  d: Decision; no: number; present: number; total: number; people: Person[]; body: 'ps' | 'os'
  onPatch: (p: Partial<Decision>, debounce?: boolean) => void; onDel: () => void
}) {
  const r = voteResult(d, present, total)
  const noted = d.kind === 'noted'
  const [task, setTask] = useState(!!(d.responsible_id || d.due_date))
  return (
    <div className={`rounded-2xl border-2 p-4 transition-colors ${noted ? 'border-slate-200 bg-slate-50/50' : d.outcome === 'rejected' ? 'border-rose-200 bg-rose-50/30' : 'border-emerald-200/70 bg-emerald-50/20'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700"><Gavel size={13} /> Решение № {no}</span>
        <div className="ml-auto flex p-0.5 rounded-lg bg-white border border-slate-200">
          <button onClick={() => onPatch({ kind: 'vote' }, false)} className={`px-2 py-0.5 rounded-md text-[11px] ${!noted ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Гласуване</button>
          <button onClick={() => onPatch({ kind: 'noted' }, false)} className={`px-2 py-0.5 rounded-md text-[11px] ${noted ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>За сведение</button>
        </div>
        <button onClick={onDel} className="p-1 text-slate-300 hover:text-rose-600"><Trash2 size={14} /></button>
      </div>
      <textarea value={d.text} onChange={e => onPatch({ text: e.target.value })} rows={2}
        placeholder={body === 'ps' ? 'Приема годишния план за дейността на ЦСОП за учебната 2026/2027 година.' : 'Избира за представители…'}
        className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] leading-relaxed focus:outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-100" />

      {!noted && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            <VoteInput label="За" icon={<ThumbsUp size={11} />} value={d.votes_for} onChange={v => onPatch({ votes_for: v })} cls="border-emerald-200 bg-emerald-50 text-emerald-800" />
            <VoteInput label="Против" icon={<ThumbsDown size={11} />} value={d.votes_against} onChange={v => onPatch({ votes_against: v })} cls="border-rose-200 bg-rose-50 text-rose-800" />
            <VoteInput label="Въздържал се" icon={<MinusCircle size={11} />} value={d.votes_abstain} onChange={v => onPatch({ votes_abstain: v })} cls="border-slate-200 bg-slate-50 text-slate-700" />
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <button onClick={() => onPatch({ votes_for: present, votes_against: 0, votes_abstain: 0 }, false)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-white border border-slate-200 text-slate-600 hover:border-slate-300"><Check size={12} /> Единодушно ({present})</button>
            <select value={d.majority} onChange={e => onPatch({ majority: e.target.value as Majority }, false)} className="text-xs rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-600">
              {(Object.keys(MAJORITY_LABEL) as Majority[]).map(k => <option key={k} value={k}>{MAJORITY_LABEL[k]}</option>)}
            </select>
            {!r.empty && (
              <span className={`ml-auto inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${r.over ? 'bg-amber-100 text-amber-800' : d.outcome === 'adopted' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {r.over ? <><AlertTriangle size={12} /> гласовете ({r.cast}) са повече от присъстващите</> : <>{d.outcome === 'adopted' ? <Check size={12} /> : <X size={12} />} {OUTCOME_LABEL[d.outcome]} · нужни {r.need}</>}
              </span>
            )}
          </div>
        </div>
      )}

      {d.outcome !== 'rejected' && !noted && (
        task ? (
          <div className="mt-3 grid sm:grid-cols-[1fr,170px] gap-2 rounded-xl bg-white border border-slate-200 p-2.5">
            <PersonSelect value={d.responsible_id} people={people} onChange={v => onPatch({ responsible_id: v }, false)} placeholder="Отговорник…" />
            <DateInput value={d.due_date || ''} onChange={v => onPatch({ due_date: v || null }, false)} placeholder="Срок" />
          </div>
        ) : (
          <button onClick={() => setTask(true)} className="mt-3 text-xs text-blue-700 hover:underline inline-flex items-center gap-1"><Plus size={12} /> Отговорник и срок за изпълнение</button>
        )
      )}
    </div>
  )
}

function PrevDecisions({ list, byId, onInsert }: { list: PrevDec[]; byId: Record<string, Person>; onInsert: (t: string) => void }) {
  const txt = list.map(d => `Решение по протокол № ${d.meeting.meeting_no} от ${dmy(d.meeting.meeting_date)}: „${d.text}“${d.responsible_id ? ` (отг. ${fullName(byId[d.responsible_id])})` : ''} — ${TASK_LABEL[d.task_status].toLowerCase()}${d.report ? `: ${d.report}` : ''}.`).join('\n')
  return (
    <div className="rounded-2xl bg-indigo-50/60 border border-indigo-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-indigo-900">Неприключени решения от предходни заседания ({list.length})</span>
        <button onClick={() => onInsert(txt)} className="ml-auto text-xs px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50">Вмъкни в разискванията</button>
      </div>
      <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
        {list.map(d => (
          <li key={d.id} className="text-xs text-slate-700 flex gap-2">
            <span className="text-indigo-400 tabular-nums shrink-0">№{d.meeting.meeting_no}</span>
            <span className="flex-1">{d.text}{d.responsible_id ? <span className="text-slate-400"> · {fullName(byId[d.responsible_id])}</span> : null}</span>
            <span className={`shrink-0 px-1.5 rounded-full ${TASK_TONE[d.task_status]}`}>{TASK_LABEL[d.task_status]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Agenda({ m, items, byId }: { m: Meeting; items: Item[]; byId: Record<string, Person> }) {
  const tone = BODY_TONE[m.body]
  return (
    <div className="rounded-3xl bg-white border border-slate-200 p-6 md:p-8">
      <div className="text-[11px] uppercase tracking-widest text-slate-400">Покана</div>
      <h2 className="text-lg font-semibold text-slate-800 mt-1">Дневен ред</h2>
      <p className="text-sm text-slate-500 mt-1">{weekday(m.meeting_date)}, {longDate(m.meeting_date)}{m.start_time ? `, ${hm(m.start_time)} ч.` : ''}{m.place ? ` · ${m.place}` : ''}</p>
      <ol className="mt-5 space-y-3">
        {items.map((it, i) => (
          <li key={it.id} className="flex gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0" style={{ background: tone.bg, color: tone.fg }}>{i + 1}</span>
            <div>
              <div className="text-[15px] text-slate-800">{it.title}</div>
              {(it.rapporteur_id || it.rapporteur_text) && <div className="text-xs text-slate-500">Докладва: {it.rapporteur_id ? fullName(byId[it.rapporteur_id]) : it.rapporteur_text}</div>}
            </div>
          </li>
        ))}
      </ol>
      {m.council_set_id && <Link href="/council" className="mt-6 inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline"><FolderOpen size={15} /> Материалите за заседанието</Link>}
    </div>
  )
}
