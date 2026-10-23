'use client'
// Кампания — табло, оценяване, подготовка, суми (ДТВ), анализ, план за подкрепа (атестиране) и документи.
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Award, Users, Settings, Calculator, FileText, Play, Send, CheckCircle2, Loader2, X, Search, FileDown,
  Upload, Trash2, Plus, RotateCcw, MessageSquareWarning, AlertTriangle, Lock, FileSpreadsheet, BarChart3, LifeBuoy,
  Paperclip, ChevronDown, BookOpen, Copy, PenLine, ClipboardCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast, confirmDialog } from '@/components/ui/Toast'
import DateInput from '@/components/ui/DateInput'
import {
  CAMPAIGN_STATUS_LABEL, P_STATUS_LABEL, P_STATUS_TONE, GRP_LABEL, KIND_LABEL, pname, dmy, isoOf, num, money, daysLeft, addDays,
  sumScores, groupSum, scoresComplete, averageScores, eligibility, distribute, defaultTemplate, grpForRole, addWorkdays, maxTotal,
  scaleOf, gradeOf, stepOf, attestResult, finalGrade, employerOptions, addYears, items as itemsOf, ATTEST_ROLES, DEFAULT_SCALE,
  type Campaign, type EvalTemplate, type Member, type Participant, type ScoreRow, type Pay, type Person, type Grp, type Scores,
  type EvalGroup, type External, type EvalFile, type Support, type Evidence, type Kind, type ScaleStep,
} from '@/lib/evaluation'
import {
  generateCards, generateProtocol, generateOrder, exportPayExcel, generateCommissionOrder, generateSupportPlan, exportAnalysisExcel,
  type PayRow,
} from '@/lib/docx-evaluation'

type Props = {
  me: { id: string; role: string; name: string }
  isDirector: boolean; isManager: boolean; isFinance: boolean; isLead: boolean; isSecretary: boolean; myRole: 'chair' | 'member' | null
  tab: string; openP: string | null
  campaign: Campaign & { year?: { name: string } | null }
  members: Member[]; participants: Participant[]; scores: ScoreRow[]; templates: EvalTemplate[]; people: Person[]
  funds: { campaign_id: string; grp: Grp; amount: number }[]; pay: Pay[]; scanUrl: string | null
  externals: External[]; files: EvalFile[]; supports: Support[]
  others: { id: string; name: string; kind: Kind; created_at: string }[]
  prev: { name: string | null; rows: { staff_id: string; final_total: number | null; result: number | null; grade: string | null; employer_grade: string | null }[] }
}
const ACCENT = '#0f2240'
const btn = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm'
const btnLine = `${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50`
const btnDark = `${btn} text-white disabled:opacity-50`
const safeName = (s: string) => s.replace(/[^\w.\-]+/g, '_')

export default function CampaignClient(p: Props) {
  const router = useRouter()
  const c = p.campaign
  const kind = (c.kind || 'dtv') as Kind
  const tabs = [
    { k: 'board', l: 'Оценяване', i: <Award size={14} /> },
    ...(p.isLead ? [{ k: 'setup', l: 'Подготовка', i: <Settings size={14} /> }] : []),
    ...(p.isFinance && kind === 'dtv' ? [{ k: 'money', l: 'Суми', i: <Calculator size={14} /> }] : []),
    ...(p.isLead && c.status !== 'setup' ? [{ k: 'analysis', l: 'Анализ', i: <BarChart3 size={14} /> }] : []),
    ...(p.isLead && kind === 'attest' && c.status !== 'setup' ? [{ k: 'support', l: 'Подкрепа', i: <LifeBuoy size={14} /> }] : []),
    ...(p.isLead || p.isFinance || p.isSecretary ? [{ k: 'docs', l: 'Документи', i: <FileText size={14} /> }] : []),
  ]
  const tab = tabs.some(t => t.k === p.tab) ? p.tab : (c.status === 'setup' && p.isLead ? 'setup' : 'board')
  const go = (k: string) => router.push(`/evaluation/${c.id}?tab=${k}`)
  const ctx = { campaign: c, yearName: c.year?.name, members: p.members, externals: p.externals }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <header className="flex flex-wrap items-center gap-4 mb-5 pb-5 border-b border-slate-100">
        <Link href="/evaluation?tab=campaigns" className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><ArrowLeft size={18} /></Link>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">{c.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {KIND_LABEL[kind]} · {CAMPAIGN_STATUS_LABEL[c.status]}
            {kind === 'attest' && c.period_from ? ` · период ${dmy(c.period_from)} – ${dmy(c.period_to)}` : ''}
            {c.self_assess && c.self_by ? ` · самооценка до ${dmy(c.self_by)}` : ''}
            {c.score_by ? ` · оценяване до ${dmy(c.score_by)}` : ''}{kind === 'dtv' && c.order_by ? ` · заповед до ${dmy(c.order_by)}` : ''}
            {p.myRole ? ` · вие сте ${p.myRole === 'chair' ? 'председател' : 'член'} на комисията` : ''}
            {p.isSecretary ? ' · вие сте технически секретар' : ''}
            {` · ${c.aggregate === 'avg' ? 'средно от членовете' : 'обща оценка на комисията'}`}
          </p>
        </div>
      </header>
      {tabs.length > 1 && (
        <nav className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
          {tabs.map(t => (
            <button key={t.k} type="button" onClick={() => go(t.k)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm ${tab === t.k ? 'bg-[#0f2240] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {t.i} {t.l}
            </button>
          ))}
        </nav>
      )}
      {tab === 'board' && <Board {...p} ctx={ctx} />}
      {tab === 'setup' && <Setup {...p} />}
      {tab === 'money' && <Money {...p} ctx={ctx} />}
      {tab === 'analysis' && <Analysis {...p} ctx={ctx} />}
      {tab === 'support' && <SupportTab {...p} ctx={ctx} />}
      {tab === 'docs' && <Docs {...p} ctx={ctx} />}
    </div>
  )
}

type Ctx = { campaign: Campaign; yearName?: string | null; members: Member[]; externals: External[] }

/** Колко оценки се очакват за лицето (членовете без самото лице + външните) */
const expectedOf = (p: Props, x: Participant) =>
  x.evaluator === 'director' ? 0 : p.members.filter(m => m.staff_id !== x.staff_id).length + p.externals.length

// ── Табло / оценяване ─────────────────────────────────────────────────────
function Board(p: Props & { ctx: Ctx }) {
  const router = useRouter()
  const { toast } = useToast()
  const c = p.campaign
  const kind = (c.kind || 'dtv') as Kind
  const isAttest = kind === 'attest'
  const [q, setQ] = useState('')
  const [grp, setGrp] = useState<'all' | Grp>('all')
  const [st, setSt] = useState('all')
  const [openId, setOpenId] = useState<string | null>(p.openP)
  const [busy, setBusy] = useState(false)
  const scoresOf = (pid: string) => p.scores.filter(s => s.participant_id === pid)
  const submitted = (x: Participant) => scoresOf(x.id).filter(s => s.submitted_at).length

  const myTodo = c.status === 'scoring' && p.myRole
    ? p.participants.filter(x => x.status === 'pending' && x.evaluator === 'commission' && x.staff_id !== p.me.id)
    : []
  const mineDone = (x: Participant) => scoresOf(x.id).some(s => s.member_id === p.me.id && s.submitted_at)
  const myDone = myTodo.filter(mineDone).length
  const directorTodo = p.isDirector ? p.participants.filter(x => x.evaluator === 'director' && x.status === 'pending') : []
  const employerTodo = p.isDirector && isAttest ? p.participants.filter(x => (x.status === 'objected') || (x.status === 'acked' && !x.employer_at)) : []

  const list = p.participants
    .filter(x => (grp === 'all' || x.grp === grp) && (st === 'all' || x.status === st || (st === 'mine' && myTodo.includes(x)) || (st === 'noself' && !x.self_at))
      && (!q.trim() || pname(x.staff).toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => a.grp.localeCompare(b.grp) || pname(a.staff).localeCompare(pname(b.staff), 'bg'))
  const count = (s: string) => p.participants.filter(x => x.status === s).length
  const ready = p.participants.filter(x => x.status === 'pending' && x.evaluator === 'commission' && expectedOf(p, x) > 0 && submitted(x) >= expectedOf(p, x) && (!isAttest || x.self_total != null))
  const scored = count('scored')
  const left = c.score_by ? daysLeft(c.score_by) : null
  const selfDone = p.participants.filter(x => x.self_at).length

  async function finalizeReady() {
    if (!ready.length) return
    if (!(await confirmDialog(`Да се утвърди ли средното от членовете за ${ready.length} лица с всички подадени оценки?`))) return
    setBusy(true)
    const supabase = createClient()
    let ok = 0
    for (const x of ready) { const { error } = await supabase.rpc('eval_finalize', { p_participant: x.id, p_scores: null }); if (error) toast(`${pname(x.staff)}: ${error.message}`, 'error'); else ok++ }
    setBusy(false); toast(`Утвърдени: ${ok}`); router.refresh()
  }
  async function send() {
    if (!(await confirmDialog(`Картите на ${scored} лица ще станат видими за тях в „Оценяване → Моите карти“, където се запознават и могат да възразят до ${c.objection_days} работни дни. Продължи?`))) return
    setBusy(true)
    const { data, error } = await createClient().rpc('eval_send', { p_campaign: c.id })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`Изпратени карти: ${data}`); router.refresh()
  }

  const open = p.participants.find(x => x.id === openId) || null
  if (c.status === 'setup') return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500 text-center">
      Кампанията е в подготовка.{p.isLead ? ' В „Подготовка“ посочете комисията и оценяваните и натиснете „Започни оценяването“.' : ' Оценяването още не е започнало.'}
    </div>
  )
  return (
    <div className="space-y-4">
      <div className={`grid gap-3 sm:grid-cols-2 ${c.self_assess ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
        <Stat n={p.participants.length} l="оценявани" />
        {c.self_assess && <Stat n={selfDone} l={`подадени самооценки${c.self_by ? ` (до ${dmy(c.self_by)})` : ''}`} tone={selfDone === p.participants.length ? 'ok' : undefined} />}
        <Stat n={p.participants.filter(x => x.status !== 'pending').length} l="утвърдени" />
        <Stat n={p.participants.filter(x => x.sent_at).length} l="изпратени на лицата" />
        <Stat n={count('acked') + count('resolved')} l="запознати" tone="ok" />
        <Stat n={count('objected')} l="възражения за решаване" tone={count('objected') ? 'bad' : undefined} />
      </div>

      {(myTodo.length > 0 || directorTodo.length > 0 || employerTodo.length > 0) && (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-[13.5px] text-indigo-900 flex flex-wrap items-center gap-3">
          <Award size={16} />
          {myTodo.length > 0 && <span>Вашите оценки: <b>{myDone} от {myTodo.length}</b> подадени.</span>}
          {directorTodo.length > 0 && <span>Оценявате като директор: <b>{directorTodo.length}</b> (заместник-директори и членове на комисията).</span>}
          {employerTodo.length > 0 && <span>Коментар на работодателя: <b>{employerTodo.length}</b>{count('objected') ? ` (${count('objected')} с възражение)` : ''}.</span>}
          {left != null && myTodo.length > myDone && <span className={left < 0 ? 'text-rose-700' : ''}>Срок {dmy(c.score_by)} ({left < 0 ? `изтекъл преди ${-left} дни` : `остават ${left} дни`}).</span>}
          {myTodo.length > myDone && <button type="button" onClick={() => setOpenId((myTodo.find(x => !mineDone(x)) || myTodo[0]).id)} className={btnDark} style={{ backgroundColor: ACCENT }}>Оценявай</button>}
        </div>
      )}

      {p.isLead && c.status === 'scoring' && (
        <div className="flex flex-wrap gap-2">
          {c.aggregate === 'avg' && <button type="button" disabled={busy || !ready.length} onClick={finalizeReady} className={btnLine}><CheckCircle2 size={15} /> Утвърди средното ({ready.length} готови)</button>}
          <button type="button" disabled={busy || !scored} onClick={send} className={btnDark} style={{ backgroundColor: ACCENT }}><Send size={15} /> Изпрати картите на лицата ({scored})</button>
          <span className="text-[12.5px] text-slate-500 self-center">
            {isAttest ? 'Утвърждава се, след като има самооценка и оценки от всички членове.' : `Картата се дава на лицето до ${c.card_days} дни от подписването.`}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси" className="input pl-8 w-56" /></div>
        {kind === 'dtv' && (
          <select value={grp} onChange={e => setGrp(e.target.value as any)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
            <option value="all">Всички групи</option><option value="ped">{GRP_LABEL.ped}</option><option value="nonped">{GRP_LABEL.nonped}</option>
          </select>
        )}
        <select value={st} onChange={e => setSt(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="all">Всички</option>
          {myTodo.length > 0 && <option value="mine">За моя оценка</option>}
          {c.self_assess && <option value="noself">Без самооценка</option>}
          {Object.entries(P_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {list.map(x => {
          const mine = scoresOf(x.id).find(s => s.member_id === p.me.id)
          const exp = expectedOf(p, x)
          const g = finalGrade(x)
          return (
            <button key={x.id} type="button" onClick={() => setOpenId(x.id)} className="w-full flex flex-wrap items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] text-slate-800">{pname(x.staff)}</span>
                <span className="block text-[12px] text-slate-500 truncate">{x.position || x.staff?.position || ''}{kind === 'dtv' ? ` · ${GRP_LABEL[x.grp]}` : ''}{x.evaluator === 'director' ? ' · оценява директорът' : ''}</span>
              </span>
              {c.self_assess && x.status === 'pending' && (
                <span className={`text-[12px] px-2 py-0.5 rounded-full ${x.self_at ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-800'}`}>{x.self_at ? `СО ${num(x.self_total)}` : 'без самооценка'}</span>
              )}
              {x.status === 'pending' && exp > 0 && <span className="text-[12px] text-slate-500 tabular-nums" title="Подадени оценки от членовете">{submitted(x)}/{exp} членове</span>}
              {x.status === 'pending' && myTodo.includes(x) && (
                <span className={`text-[12px] px-2 py-0.5 rounded-full ${mine?.submitted_at ? 'bg-emerald-50 text-emerald-700' : mine ? 'bg-amber-50 text-amber-800' : 'bg-indigo-50 text-indigo-700'}`}>{mine?.submitted_at ? 'подадена' : mine ? 'чернова' : 'за оценка'}</span>
              )}
              {isAttest
                ? <span className="text-right min-w-[120px]"><span className="block text-[15px] font-semibold tabular-nums text-slate-800">{x.result != null ? num(x.result) : ''}</span>{g && <span className="block text-[11.5px] text-slate-500 leading-tight">{g}{x.employer_grade && x.employer_grade !== x.grade ? ' (работодател)' : ''}</span>}</span>
                : <span className="w-14 text-right text-[15px] font-semibold tabular-nums text-slate-800">{x.final_total != null ? num(x.final_total) : ''}</span>}
              <span className={`text-[12px] px-2 py-0.5 rounded-full ${P_STATUS_TONE[x.status]}`}>{P_STATUS_LABEL[x.status]}</span>
            </button>
          )
        })}
        {!list.length && <p className="p-6 text-sm text-slate-400 text-center">Няма оценявани по избраните филтри.</p>}
      </div>

      {open && <ScorePanel {...p} x={open} rows={scoresOf(open.id)} onClose={() => setOpenId(null)}
        onNext={() => { const i = list.findIndex(y => y.id === open.id); const n = list.slice(i + 1).find(y => myTodo.includes(y)) || list[i + 1]; setOpenId(n ? n.id : null) }} />}
    </div>
  )
}

function Stat({ n, l, tone }: { n: number; l: string; tone?: 'ok' | 'bad' }) {
  const cl = tone === 'bad' ? 'bg-rose-50 border-rose-100 text-rose-700' : tone === 'ok' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'
  return <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${cl}`}><span className="text-xl font-semibold tabular-nums">{n}</span><span className="text-[12.5px] leading-tight">{l}</span></div>
}

type Col = { key: string; head: React.ReactNode; title?: string; cls?: string; group: (g: EvalGroup) => React.ReactNode; item: (k: string, max: number) => React.ReactNode; total: React.ReactNode }

/** Картата на едно лице: самооценка, моята оценка, оценките на другите членове, средното, утвърждаване, възражение. */
function ScorePanel(p: Props & { ctx: Ctx; x: Participant; rows: ScoreRow[]; onClose: () => void; onNext: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const { x, campaign: c } = p
  const kind = (c.kind || 'dtv') as Kind
  const isAttest = kind === 'attest'
  const tpl = p.templates.find(t => t.id === x.template_id)
  const crit: EvalGroup[] = x.criteria || tpl?.criteria || []
  const scale = scaleOf(c)
  const mineRow = p.rows.find(r => r.member_id === p.me.id)
  const pending = c.status === 'scoring' && x.status === 'pending'
  const canScore = pending && x.evaluator === 'commission' && !!p.myRole && x.staff_id !== p.me.id
  const canHelp = p.isLead || p.isSecretary            // въвежда хартиени оценки (външни членове, самооценка)
  const directorMode = x.evaluator === 'director' && p.isDirector && pending
  const jointMode = c.aggregate === 'joint' && p.isLead && x.evaluator === 'commission' && pending && x.staff_id !== p.me.id
  const leadView = p.isLead || p.isDirector || p.isSecretary
  const [mine, setMine] = useState<Scores>(() => ({ ...(mineRow?.scores || {}) }))
  const [fin, setFin] = useState<Scores>(() => ({ ...(x.final_scores || averageScores(p.rows) || {}) }))
  const [selfEdit, setSelfEdit] = useState(false)
  const [selfD, setSelfD] = useState<Scores>(() => ({ ...(x.self_scores || {}) }))
  const [extEdit, setExtEdit] = useState<string | null>(null)
  const [extD, setExtD] = useState<Scores>({})
  const [decision, setDecision] = useState('')
  const [change, setChange] = useState(false)
  const [busy, setBusy] = useState(false)
  const [comment, setComment] = useState(x.commission_comment || '')
  const [empGrade, setEmpGrade] = useState(x.grade || '')
  const [empNote, setEmpNote] = useState(x.status === 'acked' ? 'Няма възражение от страна на атестирания. Потвърждавам оценката на атестационната комисия.' : '')
  const [showGuide, setShowGuide] = useState(false)
  const memberRows = p.rows.filter(r => r.member_id && r.member_id !== p.me.id)
  const extRow = (id: string) => p.rows.find(r => r.ext_id === id)
  const avg = averageScores(p.rows)
  const name = (id: string) => pname(p.members.find(m => m.staff_id === id)?.staff)
  const showOthers = leadView || !!mineRow?.submitted_at
  const canDecide = !isAttest && x.status === 'objected' && (p.isLead || (x.evaluator === 'director' && p.isDirector))
  const canEmployer = isAttest && p.isDirector && (x.status === 'objected' || (x.status === 'acked' && !x.employer_at))
  const editFinal = directorMode || jointMode || (canDecide && change)
  const supabase = createClient()

  async function saveMine(submit: boolean) {
    if (submit && !scoresComplete(crit, mine)) { toast('Попълнете точките по всички критерии (между 0 и максимума)', 'error'); return }
    setBusy(true)
    const { error } = await supabase.from('eval_scores').upsert({
      participant_id: x.id, member_id: p.me.id, scores: mine, total: sumScores(crit, mine),
      submitted_at: submit ? new Date().toISOString() : (mineRow?.submitted_at || null), updated_at: new Date().toISOString(),
    }, { onConflict: 'participant_id,member_id' })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast(submit ? 'Оценката е подадена' : 'Черновата е запазена')
    router.refresh()
    if (submit) p.onNext()
  }
  async function saveExt() {
    if (!extEdit) return
    if (!scoresComplete(crit, extD)) { toast('Попълнете точките по всички критерии', 'error'); return }
    setBusy(true)
    const { error } = await supabase.from('eval_scores').upsert({
      participant_id: x.id, ext_id: extEdit, member_id: null, scores: extD, total: sumScores(crit, extD),
      submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'participant_id,ext_id' })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Точките на външния член са записани'); setExtEdit(null); router.refresh()
  }
  async function saveSelf() {
    if (!scoresComplete(crit, selfD)) { toast('Попълнете самооценката по всички критерии', 'error'); return }
    setBusy(true)
    const { error } = await supabase.rpc('eval_self', { p_participant: x.id, p_scores: selfD, p_section_a: null, p_submit: true })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Самооценката е въведена'); setSelfEdit(false); router.refresh()
  }
  async function finalize(useScores: boolean) {
    if (useScores && !scoresComplete(crit, fin)) { toast('Попълнете точките по всички критерии', 'error'); return }
    if (!useScores && p.rows.filter(r => r.submitted_at).length < expectedOf(p, x)
      && !(await confirmDialog('Не всички членове са подали оценка. Да се утвърди ли средното от подадените?'))) return
    setBusy(true)
    const { error } = await supabase.rpc('eval_finalize', { p_participant: x.id, p_scores: useScores ? fin : null })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Оценката е утвърдена'); router.refresh(); p.onNext()
  }
  async function reopen() {
    if (!(await confirmDialog('Да се върне ли оценката за преоценка? Утвърдените точки се изчистват; оценките на членовете остават.'))) return
    const { error } = await supabase.rpc('eval_reopen', { p_participant: x.id })
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  async function decide() {
    if (!decision.trim()) { toast('Напишете решението по възражението', 'error'); return }
    if (change && !scoresComplete(crit, fin)) { toast('Попълнете новите точки', 'error'); return }
    setBusy(true)
    const { error } = await supabase.rpc('eval_decide', { p_participant: x.id, p_decision: decision, p_scores: change ? fin : null })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Решението е записано'); router.refresh(); p.onClose()
  }
  async function employer() {
    if (!empNote.trim()) { toast('Напишете мотивите', 'error'); return }
    setBusy(true)
    const { error } = await supabase.rpc('eval_employer', { p_participant: x.id, p_grade: empGrade, p_note: empNote })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Коментарът на работодателя е записан'); router.refresh(); p.onClose()
  }
  async function saveComment() {
    const { error } = await supabase.from('eval_participants').update({ commission_comment: comment.trim() || null }).eq('id', x.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Коментарът е записан'); router.refresh()
  }
  async function word() {
    await generateCards(p.ctx, [{ p: x, template: tpl }])
  }
  const cellIn = (val: number | undefined, max: number, on: (v: number | undefined) => void) => (
    <input type="number" min={0} max={max} step="any" value={val ?? ''} onChange={e => on(e.target.value === '' ? undefined : Math.min(max, Math.max(0, Number(e.target.value))))}
      className="w-16 px-1.5 py-1 rounded-lg border border-slate-300 text-center text-[13px] tabular-nums focus:border-indigo-500 focus:outline-none" />
  )
  const setOne = (setter: React.Dispatch<React.SetStateAction<Scores>>, k: string) => (v: number | undefined) => setter(s => { const n = { ...s }; if (v === undefined) delete n[k]; else n[k] = v; return n })
  const show = (s: Scores | null | undefined) => ({
    group: (g: EvalGroup) => num(groupSum(g, s)), item: (k: string) => num(s?.[k]), total: num(sumScores(crit, s)),
  })
  const edit = (s: Scores, setter: React.Dispatch<React.SetStateAction<Scores>>) => ({
    group: (g: EvalGroup) => num(groupSum(g, s)), item: (k: string, max: number) => cellIn(s[k], max, setOne(setter, k)), total: num(sumScores(crit, s)),
  })
  const objDue = x.acked_at ? addWorkdays(isoOf(x.acked_at), c.objection_days) : null

  const cols: Col[] = []
  if (c.self_assess) cols.push({ key: 'self', head: 'СО', title: 'Самооценка', cls: 'text-slate-600', ...(selfEdit ? edit(selfD, setSelfD) : show(x.self_at ? x.self_scores : null)) })
  if (canScore) cols.push({ key: 'mine', head: 'Моята', cls: 'text-indigo-700', ...edit(mine, setMine) })
  if (showOthers) memberRows.forEach(r => cols.push({ key: r.member_id!, head: `${name(r.member_id!).split(' ')[0]}${r.submitted_at ? '' : ' (чернова)'}`, title: name(r.member_id!), ...show(r.scores) }))
  if (showOthers || canHelp) p.externals.forEach(e => {
    const r = extRow(e.id)
    if (extEdit === e.id) cols.push({ key: e.id, head: e.name.split(' ')[0], title: `${e.name}${e.org ? ` (${e.org})` : ''}`, cls: 'text-indigo-700', ...edit(extD, setExtD) })
    else if (r) cols.push({ key: e.id, head: e.name.split(' ')[0], title: `${e.name}${e.org ? ` (${e.org})` : ''}`, ...show(r.scores) })
  })
  if (showOthers && x.evaluator === 'commission' && p.rows.length > 0) cols.push({ key: 'avg', head: c.self_assess ? 'ОАК (средно)' : 'Средно', ...show(avg), item: (k: string) => avg ? num(avg[k]) : '' })
  if (editFinal || x.final_scores) cols.push({ key: 'fin', head: editFinal ? (directorMode ? 'Оценка' : jointMode ? 'Обща' : 'Нова') : 'Утвърдена', cls: 'text-emerald-700', ...(editFinal ? edit(fin, setFin) : show(x.final_scores)) })

  const spreadOf = (k: string, max: number) => {
    const vals = p.rows.filter(r => r.submitted_at).map(r => Number(r.scores?.[k])).filter(v => !isNaN(v))
    return vals.length > 1 && Math.max(...vals) - Math.min(...vals) >= Math.max(1, max / 2)
  }
  const liveOak = x.final_total ?? (avg ? sumScores(crit, avg) : null)
  const liveRes = x.result ?? attestResult(x.self_total, liveOak)
  let lastH = ''

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={p.onClose} />
      <div className="relative bg-white w-full max-w-6xl h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-semibold text-slate-800">{pname(x.staff)}</div>
            <div className="text-[12.5px] text-slate-500">{x.position || x.staff?.position || ''} · {tpl?.name || 'карта'}{x.evaluator === 'director' ? ' · оценява директорът' : ''}</div>
          </div>
          <span className={`text-[12px] px-2 py-0.5 rounded-full ${P_STATUS_TONE[x.status]}`}>{P_STATUS_LABEL[x.status]}</span>
          {tpl?.guide && <button type="button" onClick={() => setShowGuide(v => !v)} className={btnLine}><BookOpen size={15} /> Скала</button>}
          <button type="button" onClick={word} className={btnLine}><FileDown size={15} /> Word</button>
          <button type="button" onClick={p.onClose} className="p-2 rounded-lg hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {showGuide && tpl?.guide && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-[12.5px] text-slate-700 space-y-1.5 max-h-72 overflow-y-auto">
              {tpl.guide.split('\n').filter(Boolean).map((l, i) => <p key={i} className={/^\d,\d/.test(l) ? '' : 'font-medium text-slate-800'}>{l}</p>)}
            </div>
          )}
          {isAttest && (
            <div className="grid gap-3 sm:grid-cols-4">
              <Box l="Самооценка (СО)" v={x.self_at ? num(x.self_total) : 'не е подадена'} warn={!x.self_at} />
              <Box l={x.final_total != null ? 'ОАК (утвърдена)' : 'ОАК (текущо средно)'} v={liveOak != null ? num(liveOak) : '—'} />
              <Box l="ОР = 0,25·СО + 0,75·ОАК" v={liveRes != null ? num(liveRes) : '—'} />
              <Box l="Крайна оценка" v={finalGrade(x) || (liveRes != null ? `${gradeOf(scale, liveRes)} (очаквана)` : '—')} />
            </div>
          )}
          {pending && x.evaluator === 'commission' && !canScore && !leadView && (
            <p className="text-[13px] text-slate-500">Вие не оценявате това лице.</p>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50 text-slate-500 text-[12px]">
                <tr>
                  <th className="px-2 py-2 text-left w-12">№</th><th className="px-2 py-2 text-left">{tpl?.col_label || 'Показатели и критерии'}</th><th className="px-2 py-2 w-14">Макс.</th>
                  {cols.map(col => <th key={col.key} className={`px-2 py-2 w-20 font-normal ${col.cls || ''}`} title={col.title}>{col.head}</th>)}
                </tr>
              </thead>
              <tbody>
                {crit.map(g => {
                  const head = g.h && g.h !== lastH ? g.h : null
                  if (head) lastH = head
                  return [
                    head ? <tr key={`h${g.n}`} className="bg-indigo-50/50 text-indigo-900 border-t border-slate-100"><td colSpan={3 + cols.length} className="px-2 py-1.5 font-medium">{head}</td></tr> : null,
                    <tr key={g.n} className="bg-slate-50/60 font-medium text-slate-800 border-t border-slate-100">
                      <td className="px-2 py-1.5">{g.n}</td><td className="px-2 py-1.5">{g.g}</td><td className="px-2 py-1.5 text-center tabular-nums">{num(g.max)}</td>
                      {cols.map(col => <td key={col.key} className={`px-2 py-1.5 text-center tabular-nums ${col.cls || ''}`}>{col.group(g)}</td>)}
                    </tr>,
                    ...g.items.map(it => (
                      <tr key={it.k} className="border-t border-slate-100 text-slate-700 align-top">
                        <td className="px-2 py-1.5 text-slate-500">{it.k}</td><td className="px-2 py-1.5">{it.t}</td><td className="px-2 py-1.5 text-center tabular-nums text-slate-500">{num(it.max)}</td>
                        {cols.map(col => {
                          const sp = col.key === 'avg' && spreadOf(it.k, it.max)
                          return <td key={col.key} className={`px-2 py-1 text-center tabular-nums ${col.cls || ''} ${sp ? 'bg-amber-50 text-amber-800' : ''}`} title={sp ? 'Голяма разлика между членовете' : ''}>{col.item(it.k, it.max)}</td>
                        })}
                      </tr>
                    )),
                  ]
                })}
                <tr className="border-t-2 border-slate-200 font-semibold text-slate-800">
                  <td /><td className="px-2 py-2">ОБЩ БРОЙ ТОЧКИ</td><td className="px-2 py-2 text-center tabular-nums">{num(maxTotal(crit))}</td>
                  {cols.map(col => <td key={col.key} className={`px-2 py-2 text-center tabular-nums ${col.cls || ''}`}>{col.total}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
          {!showOthers && canScore && <p className="text-[12.5px] text-slate-500"><Lock size={12} className="inline mr-1" />Оценките на другите членове се виждат, след като подадете своята.</p>}

          <div className="flex flex-wrap gap-2">
            {canScore && <>
              <button type="button" disabled={busy} onClick={() => saveMine(true)} className={btnDark} style={{ backgroundColor: ACCENT }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {mineRow?.submitted_at ? 'Запази промените' : 'Подай оценката'}</button>
              {!mineRow?.submitted_at && <button type="button" disabled={busy} onClick={() => saveMine(false)} className={btnLine}>Запази чернова</button>}
            </>}
            {p.isLead && pending && x.evaluator === 'commission' && c.aggregate === 'avg' && x.staff_id !== p.me.id && p.rows.some(r => r.submitted_at) && (
              <button type="button" disabled={busy} onClick={() => finalize(false)} className={btnLine}><CheckCircle2 size={15} /> Утвърди средното ({num(avg ? sumScores(crit, avg) : 0)} т.)</button>
            )}
            {(directorMode || jointMode) && <button type="button" disabled={busy} onClick={() => finalize(true)} className={btnDark} style={{ backgroundColor: ACCENT }}><CheckCircle2 size={15} /> Утвърди оценката ({num(sumScores(crit, fin))} т.)</button>}
            {x.status === 'scored' && (p.isLead || (x.evaluator === 'director' && p.isDirector)) && <button type="button" onClick={reopen} className={btnLine}><RotateCcw size={15} /> Върни за преоценка</button>}
            <button type="button" onClick={p.onNext} className={`${btnLine} ml-auto`}>Следващ →</button>
          </div>

          {canHelp && pending && x.evaluator === 'commission' && (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3 flex flex-wrap items-center gap-2 text-[13px] text-slate-600">
              <PenLine size={14} /> <span>Въвеждане от хартия:</span>
              {c.self_assess && (selfEdit
                ? <><button type="button" disabled={busy} onClick={saveSelf} className={btnDark} style={{ backgroundColor: ACCENT }}>Запиши самооценката</button><button type="button" onClick={() => setSelfEdit(false)} className={btnLine}>Отказ</button></>
                : <button type="button" onClick={() => { setSelfD({ ...(x.self_scores || {}) }); setSelfEdit(true); setExtEdit(null) }} className={btnLine}>{x.self_at ? 'Поправи самооценката' : 'Самооценката на лицето'}</button>)}
              {p.externals.map(e => extEdit === e.id
                ? <span key={e.id} className="inline-flex gap-2"><button type="button" disabled={busy} onClick={saveExt} className={btnDark} style={{ backgroundColor: ACCENT }}>Запиши точките на {e.name}</button><button type="button" onClick={() => setExtEdit(null)} className={btnLine}>Отказ</button></span>
                : <button key={e.id} type="button" onClick={() => { setExtD({ ...(extRow(e.id)?.scores || {}) }); setExtEdit(e.id); setSelfEdit(false) }} className={btnLine}>{extRow(e.id) ? 'Поправи' : 'Точките на'} {e.name}{e.org ? ` (${e.org})` : ''}</button>)}
              {!c.self_assess && !p.externals.length && <span className="text-slate-400">няма външни членове</span>}
            </div>
          )}

          {(isAttest || kind === 'other') && (p.isLead || x.commission_comment) && x.evaluator === 'commission' && (
            <div className="space-y-1.5">
              <div className="text-[13px] font-medium text-slate-700">Коментар на комисията</div>
              {p.isLead && ['pending', 'scored'].includes(x.status)
                ? <><textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} className="input w-full" placeholder="Силни страни и препоръки за професионалното развитие…" />
                  <button type="button" onClick={saveComment} className={btnLine}>Запиши коментара</button></>
                : <p className="text-[13.5px] text-slate-700">{x.commission_comment}</p>}
            </div>
          )}

          {x.sent_at && (
            <div className="text-[12.5px] text-slate-500">
              Изпратена {dmy(isoOf(x.sent_at))}{x.acked_at ? ` · запознат/а ${dmy(isoOf(x.acked_at))}` : ' · не е запознат/а'}
              {objDue && x.status === 'acked' ? ` · възражение до ${dmy(objDue)}` : ''}
            </div>
          )}
          {x.objection && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 space-y-2">
              <div className="text-[13.5px] text-rose-800"><MessageSquareWarning size={14} className="inline mr-1" /><b>Възражение</b> ({dmy(isoOf(x.objection_at))}): {x.objection}</div>
              {x.decision && <div className="text-[13.5px] text-slate-700"><b>Решение</b> ({dmy(isoOf(x.decided_at))}): {x.decision}{x.decision_changed ? (isAttest ? ` — оценката е променена на „${x.employer_grade}“.` : ' — точките са променени.') : ''}</div>}
              {canDecide && (
                <div className="space-y-2">
                  <textarea value={decision} onChange={e => setDecision(e.target.value)} rows={3} className="input w-full" placeholder="Комисията разгледа възражението и … (решението е окончателно)" />
                  <label className="flex items-center gap-2 text-[13px] text-slate-700"><input type="checkbox" checked={change} onChange={e => { setChange(e.target.checked); setFin({ ...(x.final_scores || {}) }) }} /> Променяме точките (колона „Нова“ в картата)</label>
                  <button type="button" disabled={busy} onClick={decide} className={btnDark} style={{ backgroundColor: ACCENT }}>Запиши решението</button>
                </div>
              )}
            </div>
          )}
          {isAttest && x.employer_at && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-[13.5px] text-slate-700">
              <b>Коментар на работодателя</b> ({dmy(isoOf(x.employer_at))}): крайна оценка „{x.employer_grade}“. {x.employer_note}
            </div>
          )}
          {canEmployer && (
            <div className="rounded-xl border border-slate-200 px-4 py-3 space-y-2">
              <div className="text-[13.5px] font-medium text-slate-800">Коментар на работодателя</div>
              <p className="text-[12.5px] text-slate-500">{x.status === 'objected' ? `Атестираният е възразил. Решете в срок до ${c.decide_days ?? 5} работни дни: потвърдете оценката на комисията или я променете с една степен.` : 'Без възражение — потвърдете оценката на атестационната комисия.'}</p>
              <select value={empGrade} onChange={e => setEmpGrade(e.target.value)} className="input w-full max-w-md">
                {employerOptions(scale, x.grade, x.status === 'objected').map(g => <option key={g} value={g}>{g}{g === x.grade ? ' (на комисията)' : ''}</option>)}
              </select>
              <textarea value={empNote} onChange={e => setEmpNote(e.target.value)} rows={3} className="input w-full" placeholder="Мотиви" />
              <button type="button" disabled={busy} onClick={employer} className={btnDark} style={{ backgroundColor: ACCENT }}>Запиши</button>
            </div>
          )}

          {(leadView || canScore) && <EvidencePanel {...p} x={x} />}
        </div>
      </div>
    </div>
  )
}

function Box({ l, v, warn }: { l: string; v: string; warn?: boolean }) {
  return <div className={`rounded-xl border px-3 py-2 ${warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}><div className="text-[11.5px] text-slate-500">{l}</div><div className={`text-[15px] font-semibold ${warn ? 'text-amber-800' : 'text-slate-800'}`}>{v}</div></div>
}

/** Доказателства: данни от ЕИС за периода (контролна дейност, дейности), портфолио и предишни оценки. */
function EvidencePanel(p: Props & { x: Participant }) {
  const router = useRouter()
  const { toast } = useToast()
  const { x, campaign: c } = p
  const [open, setOpen] = useState(false)
  const [ev, setEv] = useState<Evidence | null>(null)
  const [hist, setHist] = useState<any[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const files = p.files.filter(f => f.participant_id === x.id)
  const canUpload = p.isLead || p.isSecretary
  useEffect(() => {
    if (!open || ev || err) return
    const supabase = createClient()
    supabase.rpc('eval_evidence', { p_participant: x.id }).then(({ data, error }) => { if (error) setErr(error.message); else setEv(data as Evidence) })
    supabase.from('eval_participants').select('final_total, result, grade, employer_grade, status, campaign:eval_campaigns(id, name, kind, created_at)')
      .eq('staff_id', x.staff_id).neq('campaign_id', c.id).not('final_total', 'is', null)
      .then(({ data }) => setHist(((data || []) as any[]).sort((a, b) => (b.campaign?.created_at || '').localeCompare(a.campaign?.created_at || ''))))
  }, [open, ev, err, x.id, x.staff_id, c.id])
  async function openFile(f: EvalFile) {
    const { data, error } = await createClient().storage.from('evaluation').createSignedUrl(f.path, 600)
    if (error || !data) { toast(error?.message || 'Файлът не може да се отвори', 'error'); return }
    window.open(data.signedUrl, '_blank')
  }
  async function upload(list: FileList) {
    setBusy(true)
    const supabase = createClient()
    for (const file of Array.from(list)) {
      const path = `${c.id}/p/${x.id}/${Date.now()}_${safeName(file.name)}`
      const { error } = await supabase.storage.from('evaluation').upload(path, file)
      if (error) { toast(error.message, 'error'); continue }
      const { error: e2 } = await supabase.from('eval_files').insert({ participant_id: x.id, name: file.name, path, uploaded_by: p.me.id })
      if (e2) toast(e2.message, 'error')
    }
    setBusy(false); router.refresh()
  }
  async function remove(f: EvalFile) {
    if (!(await confirmDialog(`Да се изтрие ли „${f.name}“?`))) return
    const supabase = createClient()
    await supabase.storage.from('evaluation').remove([f.path])
    const { error } = await supabase.from('eval_files').delete().eq('id', f.id)
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  return (
    <div className="rounded-xl border border-slate-200">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <ClipboardCheck size={15} className="text-slate-500" />
        <span className="flex-1 text-[14px] font-medium text-slate-800">Доказателства и портфолио{files.length ? ` · ${files.length} файла` : ''}</span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 text-[13px]">
          <div>
            <div className="text-[12px] uppercase tracking-wide text-slate-400 mb-1.5">Портфолио и приложени документи</div>
            {files.length ? (
              <ul className="space-y-1">
                {files.map(f => (
                  <li key={f.id} className="flex items-center gap-2">
                    <Paperclip size={13} className="text-slate-400" />
                    <button type="button" onClick={() => openFile(f)} className="text-indigo-700 hover:underline truncate">{f.name}</button>
                    <span className="text-[11.5px] text-slate-400">{dmy(isoOf(f.created_at))}</span>
                    {canUpload && <button type="button" onClick={() => remove(f)} className="ml-auto p-1 text-slate-400 hover:text-rose-600"><Trash2 size={13} /></button>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-slate-400">Няма прикачени файлове.</p>}
            {canUpload && <label className={`${btnLine} cursor-pointer mt-2`}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Прикачи<input type="file" multiple className="hidden" onChange={e => e.target.files?.length && upload(e.target.files)} /></label>}
          </div>
          {err && <p className="text-amber-700">Данните от ЕИС не могат да се заредят: {err}</p>}
          {!ev && !err && <p className="text-slate-400"><Loader2 size={13} className="inline animate-spin mr-1" />Зареждане на данните от ЕИС…</p>}
          {ev && (
            <>
              <div>
                <div className="text-[12px] uppercase tracking-wide text-slate-400 mb-1.5">Дейност в ЕИС · {dmy(ev.from)} – {dmy(ev.to)}</div>
                <div className="flex flex-wrap gap-2">
                  {ev.counts.filter(k => k.n).map(k => <span key={k.k} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700"><b className="tabular-nums">{k.n}</b> {k.l.toLowerCase()}</span>)}
                  {!ev.counts.some(k => k.n) && <span className="text-slate-400">Няма записи за периода.</span>}
                </div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wide text-slate-400 mb-1.5">Контролна дейност ({ev.checks.length})</div>
                {ev.checks.length ? ev.checks.map(k => (
                  <div key={k.id} className="py-1.5 border-t border-slate-100 first:border-0">
                    <div className="text-slate-800"><span className="tabular-nums text-slate-500">{dmy(k.date)}</span> · {k.subject} <span className="text-slate-400">· № {k.book_no} · {k.inspector}</span>{k.objection ? <span className="text-amber-700"> · има възражение</span> : ''}</div>
                    {k.strengths && <div className="text-slate-600"><b className="font-medium">Силни страни:</b> {k.strengths}</div>}
                    {k.conclusions && <div className="text-slate-600"><b className="font-medium">Изводи:</b> {k.conclusions}</div>}
                  </div>
                )) : <p className="text-slate-400">Няма подписани протоколи за периода.</p>}
                {ev.recs.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[12px] text-slate-500">Препоръки: {ev.recs.filter(r => r.status === 'done').length} изпълнени от {ev.recs.length}</div>
                    {ev.recs.filter(r => r.status !== 'done').map((r, i) => <div key={i} className="text-slate-700">• {r.text}{r.due ? <span className="text-slate-400"> (срок {dmy(r.due)})</span> : ''}</div>)}
                  </div>
                )}
              </div>
            </>
          )}
          {hist && hist.length > 0 && (
            <div>
              <div className="text-[12px] uppercase tracking-wide text-slate-400 mb-1.5">Предишни оценки</div>
              {hist.map((h, i) => <div key={i} className="text-slate-700">{h.campaign?.name}: <b className="tabular-nums">{h.campaign?.kind === 'attest' ? `${num(h.result)} — ${h.employer_grade || h.grade || ''}` : `${num(h.final_total)} т.`}</b></div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Подготовка ────────────────────────────────────────────────────────────
function Setup(p: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const c = p.campaign
  const kind = (c.kind || 'dtv') as Kind
  const [f, setF] = useState({ ...c, scale: scaleOf(c) })
  const [busy, setBusy] = useState(false)
  const [addMember, setAddMember] = useState('')
  const [addPerson, setAddPerson] = useState('')
  const [ext, setExt] = useState({ name: '', org: '' })
  const [copyFrom, setCopyFrom] = useState('')
  const editable = c.status === 'setup'
  const supabase = createClient()
  const templates = p.templates.filter(t => t.kind === kind && t.is_active)
  const inIds = new Set(p.participants.map(x => x.staff_id))
  const memIds = new Set(p.members.map(m => m.staff_id))

  async function saveSettings() {
    setBusy(true)
    const { error } = await supabase.from('eval_campaigns').update({
      name: f.name, aggregate: f.aggregate, score_by: f.score_by || null, order_by: f.order_by || null,
      card_days: f.card_days, objection_days: f.objection_days, min_days_ped: f.min_days_ped, min_days_nonped: f.min_days_nonped,
      sick_tolerance: f.sick_tolerance, basis: f.basis, protocol_no: f.protocol_no, protocol_date: f.protocol_date || null,
      period_from: f.period_from || null, period_to: f.period_to || null, self_by: f.self_by || null, decide_days: f.decide_days ?? 5,
      secretary_id: f.secretary_id || null, ...(editable ? { self_assess: !!f.self_assess } : {}),
      ...(kind === 'attest' ? { scale: f.scale } : {}),
    }).eq('id', c.id)
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Записано'); router.refresh()
  }
  async function member(staffId: string, role: 'chair' | 'member' | null) {
    const { error } = role === null
      ? await supabase.from('eval_commission').delete().eq('campaign_id', c.id).eq('staff_id', staffId)
      : await supabase.from('eval_commission').upsert({ campaign_id: c.id, staff_id: staffId, role, sort: p.members.find(m => m.staff_id === staffId)?.sort ?? p.members.length })
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  async function memberOrg(staffId: string, org: string) {
    const { error } = await supabase.from('eval_commission').update({ org: org.trim() || null }).eq('campaign_id', c.id).eq('staff_id', staffId)
    if (error) toast(error.message, 'error')
  }
  async function addExt() {
    if (!ext.name.trim()) return
    const { error } = await supabase.from('eval_external').insert({ campaign_id: c.id, name: ext.name.trim(), org: ext.org.trim() || null, sort: p.externals.length })
    if (error) { toast(error.message, 'error'); return }
    setExt({ name: '', org: '' }); router.refresh()
  }
  async function removeExt(id: string) {
    if (!(await confirmDialog('Да се премахне ли външният член? Въведените негови точки се изтриват.'))) return
    const { error } = await supabase.from('eval_external').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  function rowFor(person: Person, templateId?: string | null) {
    const t = (templateId && p.templates.find(x => x.id === templateId)) || defaultTemplate(p.templates, person.role, kind)
    return {
      campaign_id: c.id, staff_id: person.id, template_id: t?.id || null, grp: t?.grp || grpForRole(person.role),
      position: person.position, criteria: t?.criteria || null,
      evaluator: kind === 'dtv' && (['zdud', 'admin'].includes(person.role) || memIds.has(person.id)) ? 'director' : 'commission',
    }
  }
  const candidates = () => p.people.filter(x => x.role !== 'director' && !inIds.has(x.id) && (kind !== 'attest' || ATTEST_ROLES.includes(x.role)))
  async function addAll() {
    const add = candidates()
    if (!add.length) { toast('Всички подходящи служители вече са добавени'); return }
    if (!(await confirmDialog(`Да се добавят ли ${add.length} ${kind === 'attest' ? 'педагогически специалисти' : 'активни служители'} (без директора)? Картата се избира по длъжността; проверете ги в списъка.`))) return
    setBusy(true)
    const { error } = await supabase.from('eval_participants').insert(add.map(x => rowFor(x)))
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  async function addOne(id: string) {
    const person = p.people.find(x => x.id === id)
    if (!person) return
    const { error } = await supabase.from('eval_participants').insert(rowFor(person))
    if (error) { toast(error.message, 'error'); return }
    setAddPerson(''); router.refresh()
  }
  async function copy() {
    const src = p.others.find(o => o.id === copyFrom)
    if (!src) return
    if (!(await confirmDialog(`Да се копират ли комисията${src.kind === kind ? ', външните членове' : ''} и оценяваните от „${src.name}“? Добавят се само липсващите; напусналите служители се пропускат.`))) return
    setBusy(true)
    const [{ data: mem }, { data: exts }, { data: parts }] = await Promise.all([
      supabase.from('eval_commission').select('staff_id, role, sort, org').eq('campaign_id', src.id),
      supabase.from('eval_external').select('name, org, sort').eq('campaign_id', src.id),
      supabase.from('eval_participants').select('staff_id, template_id').eq('campaign_id', src.id),
    ])
    const active = new Set(p.people.map(x => x.id))
    const hasChair = p.members.some(m => m.role === 'chair')
    const memRows = ((mem || []) as any[]).filter(m => active.has(m.staff_id) && !memIds.has(m.staff_id))
      .map(m => ({ campaign_id: c.id, staff_id: m.staff_id, role: m.role === 'chair' && hasChair ? 'member' : m.role, sort: m.sort, org: m.org }))
    if (memRows.length) { const { error } = await supabase.from('eval_commission').insert(memRows); if (error) toast(error.message, 'error') }
    if (src.kind === kind && exts?.length && !p.externals.length) {
      const { error } = await supabase.from('eval_external').insert((exts as any[]).map(e => ({ ...e, campaign_id: c.id }))); if (error) toast(error.message, 'error')
    }
    const pRows = ((parts || []) as any[]).filter(x => active.has(x.staff_id) && !inIds.has(x.staff_id))
      .map(x => rowFor(p.people.find(y => y.id === x.staff_id)!, src.kind === kind ? x.template_id : null))
    if (pRows.length) { const { error } = await supabase.from('eval_participants').insert(pRows); if (error) toast(error.message, 'error') }
    setBusy(false); setCopyFrom('')
    toast(`Копирани: ${memRows.length} членове, ${pRows.length} оценявани`); router.refresh()
  }
  async function updateP(x: Participant, patch: Partial<Participant>) {
    if (patch.template_id !== undefined) {
      const t = p.templates.find(y => y.id === patch.template_id)
      patch = { ...patch, criteria: t?.criteria || null, grp: t?.grp || x.grp }
    }
    const { error } = await supabase.from('eval_participants').update(patch).eq('id', x.id)
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  async function removeP(x: Participant) {
    if (x.status !== 'pending') { toast('Лицето вече има утвърдена оценка', 'error'); return }
    if (!(await confirmDialog(`Да се премахне ли ${pname(x.staff)} от кампанията? Оценките на членовете за лицето се изтриват.`))) return
    const { error } = await supabase.from('eval_participants').delete().eq('id', x.id)
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  async function start() {
    const extra = c.self_assess ? ' Оценяваните ще видят картата си в „Оценяване → Моите карти“ и ще попълнят самооценката.' : ''
    if (!(await confirmDialog(`Да започне ли оценяването? Картите се копират към оценяваните — по-късни промени в „Карти“ няма да ги засегнат. Комисията ще вижда своя списък в „Оценяване“.${extra}`))) return
    setBusy(true)
    const { error } = await supabase.rpc('eval_start', { p_campaign: c.id })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Оценяването започна'); router.push(`/evaluation/${c.id}?tab=board`); router.refresh()
  }
  async function del() {
    if (!(await confirmDialog('Да се изтрие ли кампанията с комисията и оценяваните?'))) return
    const { error } = await supabase.from('eval_campaigns').delete().eq('id', c.id)
    if (error) { toast(error.message, 'error'); return }
    router.push('/evaluation?tab=campaigns')
  }

  const noTpl = p.participants.filter(x => !x.template_id).length
  const chair = p.members.find(m => m.role === 'chair')
  const sorted = [...p.participants].sort((a, b) => a.grp.localeCompare(b.grp) || pname(a.staff).localeCompare(pname(b.staff), 'bg'))
  const num$ = (k: keyof Campaign) => (e: React.ChangeEvent<HTMLInputElement>) => setF(s => ({ ...s, [k]: Number(e.target.value) }))
  const setStep = (i: number, patch: Partial<ScaleStep>) => setF(s => ({ ...s, scale: s.scale.map((x, j) => (j === i ? { ...x, ...patch } : x)) }))

  return (
    <div className="space-y-5">
      {editable && (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-3 text-[13.5px]">
          <Step ok={!!chair} t="Председател и членове" />
          <Step ok={p.participants.length > 0 && !noTpl} t={`Оценявани с карта (${p.participants.length})`} />
          {kind === 'attest' && <Step ok={!!c.period_from && !!c.self_by} t="Период и срок за самооценка" />}
          <button type="button" disabled={busy} onClick={start} className={`${btnDark} ml-auto`} style={{ backgroundColor: ACCENT }}><Play size={15} /> Започни оценяването</button>
        </div>
      )}

      {editable && p.others.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <Copy size={15} className="text-slate-400" />
          <select value={copyFrom} onChange={e => setCopyFrom(e.target.value)} className="input flex-1 max-w-md">
            <option value="">Копирай комисията и оценяваните от предишна кампания…</option>
            {p.others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button type="button" disabled={!copyFrom || busy} onClick={copy} className={btnLine}>Копирай</button>
        </div>
      )}

      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="text-[15px] font-semibold text-slate-800">Настройки</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block md:col-span-2"><span className="label">Име</span><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className="input w-full" /></label>
          <label className="block"><span className="label">Крайна оценка</span>
            <select value={f.aggregate} onChange={e => setF({ ...f, aggregate: e.target.value as any })} className="input w-full" disabled={!editable}>
              <option value="avg">Средно от членовете (всеки оценява отделно)</option>
              <option value="joint">Обща оценка на комисията (въвежда председателят)</option>
            </select>
          </label>
          {kind !== 'dtv' && <>
            <label className="block"><span className="label">{kind === 'attest' ? 'Период за атестиране от' : 'Период от'}</span><DateInput value={f.period_from || ''} onChange={v => setF({ ...f, period_from: v })} /></label>
            <label className="block"><span className="label">до</span><DateInput value={f.period_to || ''} onChange={v => setF({ ...f, period_to: v })} /></label>
          </>}
          {kind === 'other' && (
            <label className="flex items-center gap-2 text-[13.5px] text-slate-700 self-end pb-2"><input type="checkbox" disabled={!editable} checked={!!f.self_assess} onChange={e => setF({ ...f, self_assess: e.target.checked })} /> Със самооценка от лицето</label>
          )}
          {(kind === 'attest' || f.self_assess) && <label className="block"><span className="label">Самооценка и портфолио до</span><DateInput value={f.self_by || ''} onChange={v => setF({ ...f, self_by: v })} /></label>}
          <label className="block"><span className="label">Оценяване до</span><DateInput value={f.score_by || ''} onChange={v => setF({ ...f, score_by: v })} /></label>
          {kind === 'dtv' && <label className="block"><span className="label">Заповед до</span><DateInput value={f.order_by || ''} onChange={v => setF({ ...f, order_by: v })} /></label>}
          {kind !== 'attest' && <label className="block"><span className="label">Картата на лицето до (дни)</span><input type="number" value={f.card_days} onChange={num$('card_days')} className="input w-full" /></label>}
          <label className="block"><span className="label">Възражение до (работни дни)</span><input type="number" value={f.objection_days} onChange={num$('objection_days')} className="input w-full" /></label>
          {kind === 'attest' && <label className="block"><span className="label">Решение на работодателя до (работни дни)</span><input type="number" value={f.decide_days ?? 5} onChange={num$('decide_days')} className="input w-full" /></label>}
          {kind === 'dtv' && <>
            <label className="block"><span className="label">Мин. дни — педагогически</span><input type="number" value={f.min_days_ped} onChange={num$('min_days_ped')} className="input w-full" /></label>
            <label className="block"><span className="label">Мин. дни — непедагогически</span><input type="number" value={f.min_days_nonped} onChange={num$('min_days_nonped')} className="input w-full" /></label>
            <label className="block"><span className="label">Допустим недостиг по болест (дни)</span><input type="number" value={f.sick_tolerance} onChange={num$('sick_tolerance')} className="input w-full" /></label>
          </>}
          <label className="block"><span className="label">Технически секретар</span>
            <select value={f.secretary_id || ''} onChange={e => setF({ ...f, secretary_id: e.target.value || null })} className="input w-full">
              <option value="">— няма —</option>
              {p.people.map(x => <option key={x.id} value={x.id}>{pname(x)}</option>)}
            </select>
          </label>
          <label className="block md:col-span-3"><span className="label">Комисията е определена с</span><input value={f.basis || ''} onChange={e => setF({ ...f, basis: e.target.value })} className="input w-full" placeholder={kind === 'dtv' ? 'с решение на педагогическия съвет (Протокол № … от …)' : 'със заповед на директора № … от …'} /></label>
          <label className="block"><span className="label">Протокол на комисията №</span><input value={f.protocol_no || ''} onChange={e => setF({ ...f, protocol_no: e.target.value })} className="input w-full" /></label>
          <label className="block"><span className="label">от дата</span><DateInput value={f.protocol_date || ''} onChange={v => setF({ ...f, protocol_date: v })} /></label>
        </div>
        {kind === 'attest' && (
          <div className="space-y-1.5">
            <div className="text-[13px] font-medium text-slate-700">Скала за крайната оценка (ОР)</div>
            {f.scale.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="text-slate-500 w-10">от</span>
                <input type="number" step="0.01" value={s.min} disabled={!editable} onChange={e => setStep(i, { min: Number(e.target.value) })} className="input w-20 text-center" />
                <input value={s.l} disabled={!editable} onChange={e => setStep(i, { l: e.target.value })} className="input flex-1 min-w-[240px]" />
                <label className="flex items-center gap-1 text-[12px] text-slate-600"><input type="checkbox" disabled={!editable} checked={!!s.support} onChange={e => setStep(i, { support: e.target.checked })} /> план за подкрепа</label>
                <label className="flex items-center gap-1 text-[12px] text-slate-600"><input type="checkbox" disabled={!editable} checked={!!s.reattest} onChange={e => setStep(i, { reattest: e.target.checked })} /> повторно след 1 г.</label>
              </div>
            ))}
            {editable && <button type="button" onClick={() => setF(s => ({ ...s, scale: DEFAULT_SCALE }))} className="text-[12.5px] text-indigo-700">Върни скалата по подразбиране</button>}
          </div>
        )}
        <button type="button" disabled={busy} onClick={saveSettings} className="btn-primary">Запиши настройките</button>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="text-[15px] font-semibold text-slate-800">{kind === 'attest' ? 'Атестационна комисия' : 'Комисия'}</h2>
        <p className="text-[12.5px] text-slate-500">
          {kind === 'dtv' ? 'Членовете на комисията и заместник-директорите се оценяват от директора. Една комисия оценява и педагогическия, и непедагогическия персонал.'
            : kind === 'attest' ? 'Всеки член оценява самостоятелно. Външните членове (напр. представител на РУО) не влизат в системата — точките им от хартиената карта въвежда председателят или техническият секретар.'
              : 'Всеки член оценява самостоятелно; външните членове се въвеждат от председателя или секретаря.'}
        </p>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {p.members.map(m => (
            <div key={m.staff_id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="flex-1 min-w-[180px] text-[14px] text-slate-800">{pname(m.staff)} <span className="text-[12px] text-slate-500">{m.staff?.position || ''}</span></span>
              <input defaultValue={m.org || ''} disabled={!p.isManager} onBlur={e => e.target.value !== (m.org || '') && memberOrg(m.staff_id, e.target.value)} placeholder="в качеството на (по желание)" className="px-2 py-1 rounded-lg border border-slate-200 text-[13px] w-56" />
              <select value={m.role} disabled={!p.isManager} onChange={e => member(m.staff_id, e.target.value as any)} className="px-2 py-1 rounded-lg border border-slate-200 text-[13px]">
                <option value="chair">Председател</option><option value="member">Член</option>
              </select>
              {p.isManager && editable && <button type="button" onClick={() => member(m.staff_id, null)} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>}
            </div>
          ))}
          {p.externals.map(e => (
            <div key={e.id} className="flex flex-wrap items-center gap-3 px-3 py-2 bg-slate-50/50">
              <span className="flex-1 text-[14px] text-slate-800">{e.name} <span className="text-[12px] text-slate-500">{e.org || ''} · външен член</span></span>
              {p.isManager && editable && <button type="button" onClick={() => removeExt(e.id)} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>}
            </div>
          ))}
          {!p.members.length && !p.externals.length && <p className="px-3 py-3 text-[13px] text-slate-400">Няма членове.</p>}
        </div>
        {p.isManager && editable && (
          <div className="grid gap-2 md:grid-cols-2">
            <div className="flex gap-2">
              <select value={addMember} onChange={e => setAddMember(e.target.value)} className="input flex-1">
                <option value="">Добави член от служителите…</option>
                {p.people.filter(x => !memIds.has(x.id)).map(x => <option key={x.id} value={x.id}>{pname(x)}{x.position ? ` — ${x.position}` : ''}</option>)}
              </select>
              <button type="button" disabled={!addMember} onClick={() => { member(addMember, chair ? 'member' : 'chair'); setAddMember('') }} className={btnLine}><Plus size={15} /> Добави</button>
            </div>
            <div className="flex gap-2">
              <input value={ext.name} onChange={e => setExt({ ...ext, name: e.target.value })} placeholder="Външен член — име" className="input flex-1" />
              <input value={ext.org} onChange={e => setExt({ ...ext, org: e.target.value })} placeholder="РУО – Варна" className="input w-36" />
              <button type="button" disabled={!ext.name.trim()} onClick={addExt} className={btnLine}><Plus size={15} /></button>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-slate-800 flex-1">{kind === 'attest' ? 'Атестирани' : 'Оценявани'} ({p.participants.length})</h2>
          <button type="button" disabled={busy} onClick={addAll} className={btnLine}><Users size={15} /> {kind === 'attest' ? 'Добави педагогическите специалисти' : 'Добави всички активни'}</button>
        </div>
        {noTpl > 0 && <p className="text-[12.5px] text-amber-700"><AlertTriangle size={13} className="inline mr-1" />{noTpl} без карта — изберете карта (нови карти се въвеждат от „Оценяване → Карти“).</p>}
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {sorted.map(x => (
            <div key={x.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="flex-1 min-w-[180px] text-[14px] text-slate-800">{pname(x.staff)} <span className="text-[12px] text-slate-500">{x.position || ''}</span></span>
              <select value={x.template_id || ''} disabled={x.status !== 'pending' || (c.status !== 'setup')} onChange={e => updateP(x, { template_id: e.target.value || null })} className={`px-2 py-1 rounded-lg border text-[13px] max-w-[260px] ${x.template_id ? 'border-slate-200' : 'border-amber-300 bg-amber-50'}`}>
                <option value="">— карта —</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {kind === 'dtv' && (
                <select value={x.grp} onChange={e => updateP(x, { grp: e.target.value as Grp })} className="px-2 py-1 rounded-lg border border-slate-200 text-[13px]" title="Фонд">
                  <option value="ped">педагогически</option><option value="nonped">непедагогически</option>
                </select>
              )}
              {kind !== 'attest' && (
                <select value={x.evaluator} disabled={x.status !== 'pending' || (kind === 'dtv' && memIds.has(x.staff_id))} onChange={e => updateP(x, { evaluator: e.target.value as any })} className="px-2 py-1 rounded-lg border border-slate-200 text-[13px]">
                  <option value="commission">оценява комисията</option><option value="director">оценява директорът</option>
                </select>
              )}
              <button type="button" onClick={() => removeP(x)} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={addPerson} onChange={e => setAddPerson(e.target.value)} className="input flex-1">
            <option value="">Добави служител{kind === 'dtv' ? ' (и напуснал през годината)' : ''}…</option>
            {p.people.filter(x => !inIds.has(x.id)).map(x => <option key={x.id} value={x.id}>{pname(x)}{x.position ? ` — ${x.position}` : ''}</option>)}
          </select>
          <button type="button" disabled={!addPerson} onClick={() => addOne(addPerson)} className={btnLine}><Plus size={15} /> Добави</button>
        </div>
      </section>
      {editable && p.isManager && <button type="button" onClick={del} className="text-[13px] text-rose-700 hover:underline">Изтрий кампанията</button>}
    </div>
  )
}
function Step({ ok, t }: { ok: boolean; t: string }) {
  return <span className={`inline-flex items-center gap-1.5 ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>{ok ? <CheckCircle2 size={15} /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />}{t}</span>
}

// ── Суми (ДТВ) ────────────────────────────────────────────────────────────
function useRows(p: Props, funds: Partial<Record<Grp, number>>, pay: Record<string, Pay>) {
  return useMemo(() => {
    const base = p.participants.map(x => {
      const e = eligibility(p.campaign, x.grp, pay[x.id])
      return { x, e }
    })
    const { amounts, info } = distribute(base.map(r => ({ id: r.x.id, grp: r.x.grp, points: Number(r.x.final_total || 0), eligible: r.e.ok })), funds)
    const rows: PayRow[] = base.map(r => ({ p: r.x, eligible: r.e.ok, why: r.e.why, amount: amounts[r.x.id] ?? null, worked: pay[r.x.id]?.worked_days ?? null, sick: pay[r.x.id]?.sick_days ?? null }))
    return { rows, info }
  }, [p.participants, p.campaign, funds, pay])
}

function Money(p: Props & { ctx: Ctx }) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [funds, setFunds] = useState<Partial<Record<Grp, number>>>(() => Object.fromEntries(p.funds.map(f => [f.grp, Number(f.amount)])))
  const [pay, setPay] = useState<Record<string, Pay>>(() => Object.fromEntries(p.pay.map(x => [x.participant_id, x])))
  const { rows, info } = useRows(p, funds, pay)
  const notFinal = p.participants.filter(x => x.final_total == null).length
  const noDays = rows.filter(r => r.eligible === null).length

  async function saveFund(g: Grp, v: number) {
    const { error } = await supabase.from('eval_funds').upsert({ campaign_id: p.campaign.id, grp: g, amount: v || 0 })
    if (error) toast(error.message, 'error')
  }
  async function savePay(id: string, patch: Partial<Pay>) {
    const empty: Pay = { participant_id: id, worked_days: null, sick_days: null, override: null, note: null }
    const next: Pay = { ...empty, ...(pay[id] || {}), ...patch }
    setPay(s => ({ ...s, [id]: next }))
    const { error } = await supabase.from('eval_pay').upsert({ ...next, updated_at: new Date().toISOString() })
    if (error) toast(error.message, 'error')
  }
  const intOrNull = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.round(Number(v))))

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-[12.5px] text-slate-600">
        Сумата е пропорционална на точките спрямо общия брой точки в групата. Право имат лицата с поне {p.campaign.min_days_ped} (педагогически) / {p.campaign.min_days_nonped} (непедагогически) отработени дни без отпуските; недостиг до {p.campaign.sick_tolerance} работни дни по здравословни причини се допуска. Вижда се само от директора и определените за „Суми“.
        {notFinal > 0 && <span className="text-amber-700"> {notFinal} лица още нямат утвърдени точки.</span>}
        {noDays > 0 && <span className="text-amber-700"> {noDays} без въведени дни.</span>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(['ped', 'nonped'] as Grp[]).map(g => (
          <div key={g} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
            <div className="text-[14px] font-medium text-slate-800">{GRP_LABEL[g]}</div>
            <label className="flex items-center gap-2 text-[13px]">Фонд, лв.
              <input type="number" step="0.01" defaultValue={funds[g] ?? ''} onBlur={e => { const v = Number(e.target.value || 0); setFunds(s => ({ ...s, [g]: v })); saveFund(g, v) }} className="input w-40 text-right" />
            </label>
            <div className="text-[12.5px] text-slate-600 tabular-nums">
              {info[g].people} лица · {num(info[g].points)} т. · {money(info[g].perPoint)} лв. на точка · изплащат се {money(info[g].paid)} лв.{info[g].rest ? ` · остатък от закръгляне ${money(info[g].rest)} лв.` : ''}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => exportPayExcel(p.ctx, rows)} className={btnLine}><FileSpreadsheet size={15} /> Excel за счетоводството</button>
        <button type="button" onClick={() => generateOrder(p.ctx, rows)} className={btnLine}><FileDown size={15} /> Заповед за размерите (Word)</button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-slate-500 text-[12px]">
            <tr><th className="px-3 py-2 text-left">Служител</th><th className="px-2 py-2">Група</th><th className="px-2 py-2">Точки</th><th className="px-2 py-2">Отработени дни</th><th className="px-2 py-2" title="От недостига — дни по здравословни причини">Болнични</th><th className="px-2 py-2">Право</th><th className="px-2 py-2 text-right">Сума, лв.</th></tr>
          </thead>
          <tbody>
            {rows.slice().sort((a, b) => a.p.grp.localeCompare(b.p.grp) || pname(a.p.staff).localeCompare(pname(b.p.staff), 'bg')).map(r => (
              <tr key={r.p.id} className="border-t border-slate-100">
                <td className="px-3 py-1.5"><div className="text-slate-800">{pname(r.p.staff)}</div><div className="text-[11.5px] text-slate-500">{r.p.position || ''}</div></td>
                <td className="px-2 py-1.5 text-center text-[12px] text-slate-500">{r.p.grp === 'ped' ? 'пед.' : 'непед.'}</td>
                <td className="px-2 py-1.5 text-center tabular-nums">{num(r.p.final_total)}</td>
                <td className="px-2 py-1.5 text-center"><input type="number" defaultValue={r.worked ?? ''} onBlur={e => savePay(r.p.id, { worked_days: intOrNull(e.target.value) })} className="w-20 px-1.5 py-1 rounded-lg border border-slate-300 text-center" /></td>
                <td className="px-2 py-1.5 text-center"><input type="number" defaultValue={r.sick ?? ''} onBlur={e => savePay(r.p.id, { sick_days: intOrNull(e.target.value) })} className="w-16 px-1.5 py-1 rounded-lg border border-slate-300 text-center" /></td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[12px] px-2 py-0.5 rounded-full ${r.eligible === true ? 'bg-emerald-50 text-emerald-700' : r.eligible === false ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`} title={r.why}>{r.eligible === true ? 'да' : r.eligible === false ? 'не' : '?'}</span>
                    <select value={pay[r.p.id]?.override || ''} onChange={e => savePay(r.p.id, { override: (e.target.value || null) as any })} className="px-1.5 py-0.5 rounded border border-slate-200 text-[12px]" title={r.why}>
                      <option value="">по дните</option><option value="yes">има право</option><option value="no">няма право</option>
                    </select>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">{r.amount != null ? money(r.amount) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => router.refresh()} className="text-[12.5px] text-slate-500 hover:underline">Опресни</button>
    </div>
  )
}

// ── Анализ ────────────────────────────────────────────────────────────────
function Bar({ pct, label, value, tone }: { pct: number; label: string; value: string; tone?: 'low' }) {
  return (
    <div className="flex items-center gap-3 text-[13px]" title={`${label}: ${value}`}>
      <span className="w-64 shrink-0 truncate text-slate-700">{label}</span>
      <span className="flex-1 h-3.5 bg-slate-100 rounded">
        <span className={`block h-full rounded ${tone === 'low' ? 'bg-amber-500' : 'bg-indigo-600'}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </span>
      <span className="w-24 text-right tabular-nums text-slate-600">{value}</span>
    </div>
  )
}

function Analysis(p: Props & { ctx: Ctx }) {
  const c = p.campaign
  const kind = (c.kind || 'dtv') as Kind
  const isAttest = kind === 'attest'
  const scale = scaleOf(c)
  const done = p.participants.filter(x => x.final_scores && x.final_total != null)
  const tplCount = new Map<string, number>()
  done.forEach(x => x.template_id && tplCount.set(x.template_id, (tplCount.get(x.template_id) || 0) + 1))
  const tplIds = Array.from(tplCount.entries()).sort((a, b) => b[1] - a[1]).map(e => e[0])
  const [tplId, setTplId] = useState(tplIds[0] || '')
  const sel = done.filter(x => x.template_id === tplId)
  const crit: EvalGroup[] = sel[0]?.criteria || p.templates.find(t => t.id === tplId)?.criteria || []

  const byGroup = crit.map(g => {
    const vals = sel.map(x => groupSum(g, x.final_scores))
    const avg = vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0
    return { n: g.n, g: g.g, max: Number(g.max), avg, pct: g.max ? (avg / Number(g.max)) * 100 : 0, people: vals.length }
  })
  const byItem = itemsOf(crit).map(it => {
    const vals = sel.map(x => Number(x.final_scores?.[it.k])).filter(v => !isNaN(v))
    const avg = vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0
    return { ...it, avg, pct: it.max ? (avg / it.max) * 100 : 0 }
  }).sort((a, b) => a.pct - b.pct)

  // разпределение
  const dist = isAttest
    ? scale.map(s => ({ l: s.l, n: done.filter(x => finalGrade(x) === s.l).length }))
    : [[90, 'от 90%'], [80, '80–89%'], [70, '70–79%'], [60, '60–69%'], [0, 'под 60%']].map(([min, l], i, arr) => ({
      l: l as string,
      n: done.filter(x => { const pc = (Number(x.final_total) / (maxTotal(x.criteria) || 100)) * 100; const hi = i === 0 ? 1e9 : (arr[i - 1][0] as number); return pc >= (min as number) && pc < hi }).length,
    }))
  const maxN = Math.max(1, ...dist.map(d => d.n))

  // постоянство на членовете: отклонение на общия им брой точки от средното за лицето
  const memberStats = useMemo(() => {
    const acc = new Map<string, { name: string; diffs: number[] }>()
    p.participants.forEach(x => {
      const rows = p.scores.filter(s => s.participant_id === x.id && s.submitted_at)
      if (rows.length < 2) return
      const crit2 = x.criteria || []
      const avgTotal = sumScores(crit2, averageScores(rows))
      rows.forEach(r => {
        const key = r.member_id || r.ext_id || ''
        const nm = r.member_id ? pname(p.members.find(m => m.staff_id === r.member_id)?.staff) : (p.externals.find(e => e.id === r.ext_id)?.name || '—')
        const a = acc.get(key) || { name: nm, diffs: [] }
        a.diffs.push(sumScores(crit2, r.scores) - avgTotal)
        acc.set(key, a)
      })
    })
    return Array.from(acc.values()).map(a => ({ name: a.name, n: a.diffs.length, dev: a.diffs.reduce((s, v) => s + v, 0) / a.diffs.length, abs: a.diffs.reduce((s, v) => s + Math.abs(v), 0) / a.diffs.length }))
  }, [p.participants, p.scores, p.members, p.externals])

  // сравнение с предишната кампания
  const cmp = p.prev.rows.length ? done.map(x => {
    const pr = p.prev.rows.find(r => r.staff_id === x.staff_id)
    const now = isAttest ? x.result : x.final_total
    const before = pr ? (isAttest ? pr.result : pr.final_total) : null
    return { x, now, before, d: now != null && before != null ? Number(now) - Number(before) : null }
  }).filter(r => r.d != null).sort((a, b) => (a.d as number) - (b.d as number)) : []

  const avgAll = done.length ? done.reduce((a, x) => a + Number(isAttest ? x.result : x.final_total), 0) / done.length : null
  if (!done.length) return <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500 text-center">Анализът се появява, когато има утвърдени оценки.</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-[13.5px] text-slate-600">Утвърдени: <b>{done.length}</b> от {p.participants.length} · средно {isAttest ? 'ОР' : 'точки'}: <b className="tabular-nums">{num(avgAll)}</b></div>
        {tplIds.length > 1 && (
          <select value={tplId} onChange={e => setTplId(e.target.value)} className="input max-w-xs ml-auto">
            {tplIds.map(id => <option key={id} value={id}>{p.templates.find(t => t.id === id)?.name || 'карта'} ({tplCount.get(id)})</option>)}
          </select>
        )}
        <button type="button" onClick={() => exportAnalysisExcel(p.ctx, done, byGroup, memberStats)} className={`${btnLine} ${tplIds.length > 1 ? '' : 'ml-auto'}`}><FileSpreadsheet size={15} /> Excel</button>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
        <h2 className="text-[15px] font-semibold text-slate-800">Показатели — средно като % от максимума</h2>
        <p className="text-[12.5px] text-slate-500">Карта „{p.templates.find(t => t.id === tplId)?.name || ''}“, {sel.length} лица. Под 70% е отбелязано в жълто.</p>
        {byGroup.map(g => <Bar key={g.n} label={`${g.n}. ${g.g}`} pct={g.pct} value={`${num(g.avg)} / ${num(g.max)} · ${Math.round(g.pct)}%`} tone={g.pct < 70 ? 'low' : undefined} />)}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
          <h2 className="text-[15px] font-semibold text-slate-800">Най-слаби критерии — теми за квалификация</h2>
          {byItem.slice(0, 6).map(it => (
            <div key={it.k} className="text-[13px] flex gap-2"><span className="w-12 shrink-0 text-slate-500">{it.k}</span><span className="flex-1 text-slate-700">{it.t}</span><span className="tabular-nums text-slate-600 w-12 text-right">{Math.round(it.pct)}%</span></div>
          ))}
        </section>
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
          <h2 className="text-[15px] font-semibold text-slate-800">{isAttest ? 'Разпределение по крайна оценка' : 'Разпределение по точки (% от максимума)'}</h2>
          {dist.map(d => <Bar key={d.l} label={d.l} pct={(d.n / maxN) * 100} value={`${d.n} ${d.n === 1 ? 'лице' : 'лица'}`} tone={isAttest && stepOf(scale, d.l)?.support ? 'low' : undefined} />)}
        </section>
      </div>

      {memberStats.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
          <h2 className="text-[15px] font-semibold text-slate-800">Комисия — съгласуваност на оценките</h2>
          <p className="text-[12.5px] text-slate-500">Средно колко точки над (+) или под (−) средното на комисията дава всеки член. Голямо отклонение означава, че критериите се тълкуват различно — обсъдете ги преди утвърждаването.</p>
          <table className="w-full text-[13px]">
            <thead className="text-[12px] text-slate-500"><tr><th className="text-left py-1">Член</th><th className="py-1">Оценени</th><th className="py-1">Средно отклонение</th><th className="py-1">Средно абсолютно</th></tr></thead>
            <tbody>{memberStats.map(m => (
              <tr key={m.name} className="border-t border-slate-100"><td className="py-1.5 text-slate-800">{m.name}</td><td className="text-center tabular-nums">{m.n}</td>
                <td className={`text-center tabular-nums ${Math.abs(m.dev) >= 3 ? 'text-amber-700 font-medium' : ''}`}>{m.dev > 0 ? '+' : ''}{num(m.dev)}</td><td className="text-center tabular-nums">{num(m.abs)}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      {cmp.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
          <h2 className="text-[15px] font-semibold text-slate-800">Сравнение с „{p.prev.name}“</h2>
          <table className="w-full text-[13px]">
            <thead className="text-[12px] text-slate-500"><tr><th className="text-left py-1">Служител</th><th className="py-1">Преди</th><th className="py-1">Сега</th><th className="py-1">Разлика</th></tr></thead>
            <tbody>{cmp.map(r => (
              <tr key={r.x.id} className="border-t border-slate-100"><td className="py-1.5 text-slate-800">{pname(r.x.staff)}</td><td className="text-center tabular-nums">{num(r.before)}</td><td className="text-center tabular-nums">{num(r.now)}</td>
                <td className={`text-center tabular-nums ${(r.d as number) < 0 ? 'text-rose-700' : (r.d as number) > 0 ? 'text-emerald-700' : ''}`}>{(r.d as number) > 0 ? '+' : ''}{num(r.d)}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </div>
  )
}

// ── План за подкрепа (атестиране) ─────────────────────────────────────────
function SupportTab(p: Props & { ctx: Ctx }) {
  const scale = scaleOf(p.campaign)
  const need = p.participants.filter(x => stepOf(scale, finalGrade(x))?.support)
  const sent = p.participants.filter(x => x.status !== 'pending' && !stepOf(scale, finalGrade(x))?.support)
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-[12.5px] text-slate-600">
        При оценки „{scale.filter(s => s.support).map(s => s.l).join('“ и „')}“ директорът и комисията анализират причините, изготвят план за методическа и организационна подкрепа и определят наставник.
        {scale.some(s => s.reattest) && ` При „${scale.find(s => s.reattest)?.l}“ се провежда повторно атестиране една година след началото на мерките.`}
      </div>
      {need.map(x => <SupportCard key={x.id} {...p} x={x} />)}
      {!need.length && <p className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-400 text-center">Няма атестирани, за които е нужен план за подкрепа{sent.length ? '' : ' (още няма утвърдени оценки)'}.</p>}
    </div>
  )
}

function SupportCard(p: Props & { ctx: Ctx; x: Participant }) {
  const router = useRouter()
  const { toast } = useToast()
  const { x } = p
  const scale = scaleOf(p.campaign)
  const step = stepOf(scale, finalGrade(x))
  const cur = p.supports.find(s => s.participant_id === x.id)
  const empty: Support = { participant_id: x.id, mentor_id: null, causes: null, measures: null, training: null, start_date: null, reattest_by: null, status: 'open', result: null }
  const [s, setS] = useState<Support>(() => ({ ...empty, ...(cur || {}) }))
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<Support>) => setS(v => ({ ...v, ...patch }))
  const mentor = p.people.find(y => y.id === s.mentor_id)
  async function save() {
    setBusy(true)
    const { error } = await createClient().from('eval_support').upsert({ ...s, updated_at: new Date().toISOString() })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Планът е записан'); router.refresh()
  }
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-slate-800">{pname(x.staff)}</div>
          <div className="text-[12.5px] text-slate-500">{x.position || ''} · ОР {num(x.result)} · „{finalGrade(x)}“{step?.reattest ? ' · повторно атестиране след 1 година' : ''}</div>
        </div>
        <span className={`text-[12px] px-2 py-0.5 rounded-full ${cur ? (s.status === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800') : 'bg-rose-50 text-rose-700'}`}>{cur ? (s.status === 'done' ? 'изпълнен' : 'в изпълнение') : 'няма план'}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block"><span className="label">Наставник</span>
          <select value={s.mentor_id || ''} onChange={e => set({ mentor_id: e.target.value || null })} className="input w-full">
            <option value="">— изберете —</option>
            {p.people.filter(y => y.id !== x.staff_id).map(y => <option key={y.id} value={y.id}>{pname(y)}{y.position ? ` — ${y.position}` : ''}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">Начало на мерките</span><DateInput value={s.start_date || ''} onChange={v => set({ start_date: v, ...(step?.reattest && v && !s.reattest_by ? { reattest_by: addYears(v, 1) } : {}) })} /></label>
        <label className="block"><span className="label">Повторно атестиране до</span><DateInput value={s.reattest_by || ''} onChange={v => set({ reattest_by: v })} /></label>
        <label className="block md:col-span-3"><span className="label">Анализ на причините</span><textarea value={s.causes || ''} onChange={e => set({ causes: e.target.value })} rows={2} className="input w-full" /></label>
        <label className="block md:col-span-3"><span className="label">Мерки за методическа и организационна подкрепа</span><textarea value={s.measures || ''} onChange={e => set({ measures: e.target.value })} rows={3} className="input w-full" placeholder="Посещения и обсъждане на уроци с наставника, открити уроци, обучение по …, срокове" /></label>
        <label className="block md:col-span-3"><span className="label">Теми за квалификация (предложение към ПС)</span><textarea value={s.training || ''} onChange={e => set({ training: e.target.value })} rows={2} className="input w-full" /></label>
        <label className="block md:col-span-2"><span className="label">Резултат</span><textarea value={s.result || ''} onChange={e => set({ result: e.target.value })} rows={2} className="input w-full" /></label>
        <label className="block"><span className="label">Състояние</span>
          <select value={s.status} onChange={e => set({ status: e.target.value as any })} className="input w-full"><option value="open">в изпълнение</option><option value="done">изпълнен</option></select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={save} className="btn-primary">Запиши</button>
        <button type="button" onClick={() => generateSupportPlan(p.ctx, x, s, mentor ? pname(mentor) : null)} className={btnLine}><FileDown size={15} /> План (Word)</button>
      </div>
    </section>
  )
}

// ── Документи ─────────────────────────────────────────────────────────────
function Docs(p: Props & { ctx: Ctx }) {
  const router = useRouter()
  const { toast } = useToast()
  const c = p.campaign
  const kind = (c.kind || 'dtv') as Kind
  const [busy, setBusy] = useState(false)
  const done = p.participants.filter(x => x.final_total != null)
  const tpl = (x: Participant) => p.templates.find(t => t.id === x.template_id)
  const open = p.participants.filter(x => !['acked', 'resolved'].includes(x.status) || (kind === 'attest' && !x.employer_at))
  const lateCards = kind === 'attest' ? [] : p.participants.filter(x => x.status === 'scored' && x.finalized_at && daysLeft(addDays(isoOf(x.finalized_at), c.card_days)) < 0)
  const label = kind === 'attest' ? 'Атестационни карти' : 'Карти за оценка'
  const short = kind === 'attest' ? 'атестация' : kind === 'dtv' ? 'ДТВ' : 'оценка'

  async function upload(file: File) {
    setBusy(true)
    const path = `${c.id}/protokol_${Date.now()}_${safeName(file.name)}`
    const supabase = createClient()
    const { error } = await supabase.storage.from('evaluation').upload(path, file)
    if (!error) await supabase.from('eval_campaigns').update({ scan_path: path }).eq('id', c.id)
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Сканираният протокол е прикачен'); router.refresh()
  }
  async function close() {
    if (open.length && !(await confirmDialog(`${open.length} лица още не са запознати${kind === 'attest' ? ', нямат коментар на работодателя' : ''} или имат нерешено възражение. Да се приключи ли кампанията въпреки това?`))) return
    const { error } = await createClient().from('eval_campaigns').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', c.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Кампанията е приключена'); router.refresh()
  }
  const blank = (x: Participant): Participant => ({ ...x, final_scores: null, final_total: null, finalized_at: null, acked_at: null, objection: null, self_scores: null, self_total: null, result: null, grade: null, employer_grade: null, employer_note: null, employer_at: null, commission_comment: null })
  return (
    <div className="space-y-4">
      {lateCards.length > 0 && <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[13px] px-4 py-3"><AlertTriangle size={14} className="inline mr-1" />{lateCards.length} утвърдени карти не са изпратени до {c.card_days} дни от подписването.</div>}
      <div className="grid gap-3 md:grid-cols-2">
        <DocCard title="Заповед за комисията" text={`Съставът на комисията${kind === 'attest' ? ', техническият секретар, сроковете за самооценка и портфолио, редът за възражение' : ' и сроковете'} — без номер, за регистриране.`}>
          <button type="button" disabled={!p.members.length} onClick={() => generateCommissionOrder(p.ctx, p.participants.length, c.secretary_id ? pname(p.people.find(x => x.id === c.secretary_id)) : null)} className={btnLine}><FileDown size={15} /> Заповед (Word)</button>
        </DocCard>
        <DocCard title={label} text={`Всички утвърдени карти (${done.length}) в един файл — всяка на отделна страница, за подпис от комисията и лицето.`}>
          <button type="button" disabled={!done.length} onClick={() => generateCards(p.ctx, done.map(x => ({ p: x, template: tpl(x) })))} className={btnLine}><FileDown size={15} /> Всички карти</button>
          {kind === 'dtv' && (['ped', 'nonped'] as Grp[]).map(g => done.some(x => x.grp === g) && (
            <button key={g} type="button" onClick={() => generateCards(p.ctx, done.filter(x => x.grp === g).map(x => ({ p: x, template: tpl(x) })), `Карти_ДТВ_${g === 'ped' ? 'педагогически' : 'непедагогически'}.docx`)} className={btnLine}>{g === 'ped' ? 'Педагогически' : 'Непедагогически'}</button>
          ))}
          <button type="button" onClick={() => generateCards(p.ctx, p.participants.map(x => ({ p: blank(x), template: tpl(x) })), `Карти_${short}_празни.docx`)} className={btnLine}>Празни (за ръчно попълване)</button>
        </DocCard>
        <DocCard title="Протокол на комисията" text={`Резултатите${kind === 'dtv' ? ' по групи' : kind === 'attest' ? ' (СО, ОАК, ОР, крайна оценка)' : ''}, възраженията и решенията. Номер и дата: ${c.protocol_no ? `№ ${c.protocol_no}` : 'не са въведени'}${c.protocol_date ? ` / ${dmy(c.protocol_date)}` : ''} (в „Подготовка“).`}>
          <button type="button" disabled={!done.length} onClick={() => generateProtocol(p.ctx, done)} className={btnLine}><FileDown size={15} /> Протокол (Word)</button>
          {p.isLead && <label className={`${btnLine} cursor-pointer`}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Прикачи подписания<input type="file" accept=".pdf,image/*" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} /></label>}
          {p.scanUrl && <a href={p.scanUrl} target="_blank" rel="noreferrer" className="text-[13px] text-indigo-700 hover:underline self-center">Виж сканирания протокол</a>}
        </DocCard>
        {p.isFinance && kind === 'dtv' && (
          <DocCard title="Заповед и суми" text="Заповедта за размерите (без номер — номерът се поставя при регистрирането) и таблицата за счетоводството са в „Суми“.">
            <Link href={`/evaluation/${c.id}?tab=money`} className={btnLine}><Calculator size={15} /> Към „Суми“</Link>
          </DocCard>
        )}
        {kind === 'attest' && p.isLead && (
          <DocCard title="Планове за подкрепа" text="За атестираните с двете най-ниски оценки — анализ, мерки, наставник, повторно атестиране.">
            <Link href={`/evaluation/${c.id}?tab=support`} className={btnLine}><LifeBuoy size={15} /> Към „Подкрепа“</Link>
          </DocCard>
        )}
        {p.isLead && c.status === 'scoring' && (
          <DocCard title="Приключване" text={`Когато всички са запознати и възраженията са решени (${p.participants.length - open.length} от ${p.participants.length}). Приключената кампания остава в архива.`}>
            <button type="button" onClick={close} className={btnLine}><Lock size={15} /> Приключи кампанията</button>
          </DocCard>
        )}
      </div>
    </div>
  )
}
function DocCard({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
      <div className="text-[14px] font-medium text-slate-800">{title}</div>
      <p className="text-[12.5px] text-slate-500">{text}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
