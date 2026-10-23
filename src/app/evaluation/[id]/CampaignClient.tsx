'use client'
// Кампания за ДТВ — табло, оценяване, подготовка, суми и документи.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Award, Users, Settings, Calculator, FileText, Play, Send, CheckCircle2, Loader2, X, Search, FileDown,
  Upload, Trash2, Plus, RotateCcw, MessageSquareWarning, AlertTriangle, Lock, FileSpreadsheet,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast, confirmDialog } from '@/components/ui/Toast'
import DateInput from '@/components/ui/DateInput'
import {
  CAMPAIGN_STATUS_LABEL, P_STATUS_LABEL, P_STATUS_TONE, GRP_LABEL, pname, dmy, isoOf, num, money, todayIso, daysLeft, addDays,
  sumScores, groupSum, scoresComplete, averageScores, eligibility, distribute, defaultTemplate, grpForRole, addWorkdays,
  type Campaign, type EvalTemplate, type Member, type Participant, type ScoreRow, type Pay, type Person, type Grp, type Scores, type EvalGroup,
} from '@/lib/evaluation'
import { generateCards, generateProtocol, generateOrder, exportPayExcel, type PayRow } from '@/lib/docx-evaluation'

type Props = {
  me: { id: string; role: string; name: string }
  isDirector: boolean; isManager: boolean; isFinance: boolean; isLead: boolean; myRole: 'chair' | 'member' | null
  tab: string; openP: string | null
  campaign: Campaign & { year?: { name: string } | null }
  members: Member[]; participants: Participant[]; scores: ScoreRow[]; templates: EvalTemplate[]; people: Person[]
  funds: { campaign_id: string; grp: Grp; amount: number }[]; pay: Pay[]; scanUrl: string | null
}
const ACCENT = '#0f2240'
const btn = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm'
const btnLine = `${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50`
const btnDark = `${btn} text-white disabled:opacity-50`

export default function CampaignClient(p: Props) {
  const router = useRouter()
  const c = p.campaign
  const tabs = [
    { k: 'board', l: 'Оценяване', i: <Award size={14} /> },
    ...(p.isLead ? [{ k: 'setup', l: 'Подготовка', i: <Settings size={14} /> }] : []),
    ...(p.isFinance ? [{ k: 'money', l: 'Суми', i: <Calculator size={14} /> }] : []),
    ...(p.isLead || p.isFinance ? [{ k: 'docs', l: 'Документи', i: <FileText size={14} /> }] : []),
  ]
  const tab = tabs.some(t => t.k === p.tab) ? p.tab : (c.status === 'setup' && p.isLead ? 'setup' : 'board')
  const go = (k: string) => router.push(`/evaluation/${c.id}?tab=${k}`)
  const ctx = { campaign: c, yearName: c.year?.name, members: p.members }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <header className="flex flex-wrap items-center gap-4 mb-5 pb-5 border-b border-slate-100">
        <Link href="/evaluation?tab=campaigns" className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><ArrowLeft size={18} /></Link>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">{c.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {CAMPAIGN_STATUS_LABEL[c.status]}
            {c.score_by ? ` · оценяване до ${dmy(c.score_by)}` : ''}{c.order_by ? ` · заповед до ${dmy(c.order_by)}` : ''}
            {p.myRole ? ` · вие сте ${p.myRole === 'chair' ? 'председател' : 'член'} на комисията` : ''}
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
      {tab === 'docs' && <Docs {...p} ctx={ctx} />}
    </div>
  )
}

type Ctx = { campaign: Campaign; yearName?: string | null; members: Member[] }

// ── Табло / оценяване ─────────────────────────────────────────────────────
function Board(p: Props & { ctx: Ctx }) {
  const router = useRouter()
  const { toast } = useToast()
  const c = p.campaign
  const [q, setQ] = useState('')
  const [grp, setGrp] = useState<'all' | Grp>('all')
  const [st, setSt] = useState('all')
  const [openId, setOpenId] = useState<string | null>(p.openP)
  const [busy, setBusy] = useState(false)
  const memberIds = p.members.map(m => m.staff_id)
  const scoresOf = (pid: string) => p.scores.filter(s => s.participant_id === pid)
  const expected = (x: Participant) => (x.evaluator === 'director' ? 0 : memberIds.filter(id => id !== x.staff_id).length)
  const submitted = (x: Participant) => scoresOf(x.id).filter(s => s.submitted_at).length

  // за кого оценявам аз
  const myTodo = c.status === 'scoring' && p.myRole
    ? p.participants.filter(x => x.status === 'pending' && x.evaluator === 'commission' && x.staff_id !== p.me.id)
    : []
  const myDone = myTodo.filter(x => scoresOf(x.id).some(s => s.member_id === p.me.id && s.submitted_at)).length
  const directorTodo = p.isDirector ? p.participants.filter(x => x.evaluator === 'director' && x.status === 'pending') : []

  const list = p.participants
    .filter(x => (grp === 'all' || x.grp === grp) && (st === 'all' || x.status === st || (st === 'mine' && myTodo.includes(x)))
      && (!q.trim() || pname(x.staff).toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => a.grp.localeCompare(b.grp) || pname(a.staff).localeCompare(pname(b.staff), 'bg'))
  const count = (s: string) => p.participants.filter(x => x.status === s).length
  const ready = p.participants.filter(x => x.status === 'pending' && x.evaluator === 'commission' && expected(x) > 0 && submitted(x) >= expected(x))
  const scored = count('scored')
  const left = c.score_by ? daysLeft(c.score_by) : null

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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat n={p.participants.length} l="оценявани" />
        <Stat n={p.participants.filter(x => x.status !== 'pending').length} l="утвърдени" />
        <Stat n={p.participants.filter(x => x.sent_at).length} l="изпратени на лицата" />
        <Stat n={count('acked') + count('resolved')} l="запознати" tone="ok" />
        <Stat n={count('objected')} l="възражения за решаване" tone={count('objected') ? 'bad' : undefined} />
      </div>

      {(myTodo.length > 0 || directorTodo.length > 0) && (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-[13.5px] text-indigo-900 flex flex-wrap items-center gap-3">
          <Award size={16} />
          {myTodo.length > 0 && <span>Вашите оценки: <b>{myDone} от {myTodo.length}</b> подадени.</span>}
          {directorTodo.length > 0 && <span>Оценявате като директор: <b>{directorTodo.length}</b> (заместник-директори и членове на комисията).</span>}
          {left != null && <span className={left < 0 ? 'text-rose-700' : ''}>Срок {dmy(c.score_by)} ({left < 0 ? `изтекъл преди ${-left} дни` : `остават ${left} дни`}).</span>}
          {myTodo.length > myDone && <button type="button" onClick={() => setOpenId((myTodo.find(x => !scoresOf(x.id).some(s => s.member_id === p.me.id && s.submitted_at)) || myTodo[0]).id)} className={btnDark} style={{ backgroundColor: ACCENT }}>Оценявай</button>}
        </div>
      )}

      {p.isLead && c.status === 'scoring' && (
        <div className="flex flex-wrap gap-2">
          {c.aggregate === 'avg' && <button type="button" disabled={busy || !ready.length} onClick={finalizeReady} className={btnLine}><CheckCircle2 size={15} /> Утвърди средното ({ready.length} готови)</button>}
          <button type="button" disabled={busy || !scored} onClick={send} className={btnDark} style={{ backgroundColor: ACCENT }}><Send size={15} /> Изпрати картите на лицата ({scored})</button>
          <span className="text-[12.5px] text-slate-500 self-center">Картата се дава на лицето до {c.card_days} дни от подписването.</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси" className="input pl-8 w-56" /></div>
        <select value={grp} onChange={e => setGrp(e.target.value as any)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="all">Всички групи</option><option value="ped">{GRP_LABEL.ped}</option><option value="nonped">{GRP_LABEL.nonped}</option>
        </select>
        <select value={st} onChange={e => setSt(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="all">Всички</option>
          {myTodo.length > 0 && <option value="mine">За моя оценка</option>}
          {Object.entries(P_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {list.map(x => {
          const mine = scoresOf(x.id).find(s => s.member_id === p.me.id)
          const exp = expected(x)
          return (
            <button key={x.id} type="button" onClick={() => setOpenId(x.id)} className="w-full flex flex-wrap items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] text-slate-800">{pname(x.staff)}</span>
                <span className="block text-[12px] text-slate-500 truncate">{x.position || x.staff?.position || ''} · {GRP_LABEL[x.grp]}{x.evaluator === 'director' ? ' · оценява директорът' : ''}</span>
              </span>
              {x.status === 'pending' && exp > 0 && <span className="text-[12px] text-slate-500 tabular-nums" title="Подадени оценки от членовете">{submitted(x)}/{exp} членове</span>}
              {x.status === 'pending' && myTodo.includes(x) && (
                <span className={`text-[12px] px-2 py-0.5 rounded-full ${mine?.submitted_at ? 'bg-emerald-50 text-emerald-700' : mine ? 'bg-amber-50 text-amber-800' : 'bg-indigo-50 text-indigo-700'}`}>{mine?.submitted_at ? 'подадена' : mine ? 'чернова' : 'за оценка'}</span>
              )}
              <span className="w-14 text-right text-[15px] font-semibold tabular-nums text-slate-800">{x.final_total != null ? num(x.final_total) : ''}</span>
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

/** Картата на едно лице: моята оценка, оценките на другите членове, средното, утвърждаване, възражение. */
function ScorePanel(p: Props & { ctx: Ctx; x: Participant; rows: ScoreRow[]; onClose: () => void; onNext: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const { x, campaign: c } = p
  const crit: EvalGroup[] = x.criteria || p.templates.find(t => t.id === x.template_id)?.criteria || []
  const mineRow = p.rows.find(r => r.member_id === p.me.id)
  const canScore = c.status === 'scoring' && x.status === 'pending' && x.evaluator === 'commission' && !!p.myRole && x.staff_id !== p.me.id
  const directorMode = x.evaluator === 'director' && p.isDirector && x.status === 'pending' && c.status === 'scoring'
  const jointMode = c.aggregate === 'joint' && p.isLead && x.evaluator === 'commission' && x.status === 'pending' && c.status === 'scoring' && x.staff_id !== p.me.id
  const leadView = p.isLead || p.isDirector
  const [mine, setMine] = useState<Scores>(() => ({ ...(mineRow?.scores || {}) }))
  const [fin, setFin] = useState<Scores>(() => ({ ...(x.final_scores || averageScores(p.rows) || {}) }))
  const [decision, setDecision] = useState('')
  const [change, setChange] = useState(false)
  const [busy, setBusy] = useState(false)
  const others = p.rows.filter(r => r.member_id !== p.me.id)
  const avg = averageScores(p.rows)
  const name = (id: string) => pname(p.members.find(m => m.staff_id === id)?.staff)
  const showOthers = leadView || !!mineRow?.submitted_at
  const canDecide = x.status === 'objected' && (p.isLead || (x.evaluator === 'director' && p.isDirector))
  const editFinal = directorMode || jointMode || (canDecide && change)

  async function saveMine(submit: boolean) {
    if (submit && !scoresComplete(crit, mine)) { toast('Попълнете точките по всички критерии (между 0 и максимума)', 'error'); return }
    setBusy(true)
    const { error } = await createClient().from('eval_scores').upsert({
      participant_id: x.id, member_id: p.me.id, scores: mine, total: sumScores(crit, mine),
      submitted_at: submit ? new Date().toISOString() : (mineRow?.submitted_at || null), updated_at: new Date().toISOString(),
    })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast(submit ? 'Оценката е подадена' : 'Черновата е запазена')
    router.refresh()
    if (submit) p.onNext()
  }
  async function finalize(useScores: boolean) {
    if (useScores && !scoresComplete(crit, fin)) { toast('Попълнете точките по всички критерии', 'error'); return }
    if (!useScores && p.rows.filter(r => r.submitted_at).length < p.members.filter(m => m.staff_id !== x.staff_id).length
      && !(await confirmDialog('Не всички членове са подали оценка. Да се утвърди ли средното от подадените?'))) return
    setBusy(true)
    const { error } = await createClient().rpc('eval_finalize', { p_participant: x.id, p_scores: useScores ? fin : null })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Оценката е утвърдена'); router.refresh(); p.onNext()
  }
  async function reopen() {
    if (!(await confirmDialog('Да се върне ли оценката за преоценка? Утвърдените точки се изчистват; оценките на членовете остават.'))) return
    const { error } = await createClient().rpc('eval_reopen', { p_participant: x.id })
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  async function decide() {
    if (!decision.trim()) { toast('Напишете решението по възражението', 'error'); return }
    if (change && !scoresComplete(crit, fin)) { toast('Попълнете новите точки', 'error'); return }
    setBusy(true)
    const { error } = await createClient().rpc('eval_decide', { p_participant: x.id, p_decision: decision, p_scores: change ? fin : null })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Решението е записано'); router.refresh(); p.onClose()
  }
  async function word() {
    await generateCards(p.ctx, [{ p: x, template: p.templates.find(t => t.id === x.template_id) }])
  }
  const cellIn = (val: number | undefined, max: number, on: (v: number | undefined) => void) => (
    <input type="number" min={0} max={max} step="any" value={val ?? ''} onChange={e => on(e.target.value === '' ? undefined : Math.min(max, Math.max(0, Number(e.target.value))))}
      className="w-16 px-1.5 py-1 rounded-lg border border-slate-300 text-center text-[13px] tabular-nums focus:border-indigo-500 focus:outline-none" />
  )
  const setOne = (setter: typeof setMine, k: string) => (v: number | undefined) => setter(s => { const n = { ...s }; if (v === undefined) delete n[k]; else n[k] = v; return n })
  const objDue = x.acked_at ? addWorkdays(isoOf(x.acked_at), c.objection_days) : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={p.onClose} />
      <div className="relative bg-white w-full max-w-5xl h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-semibold text-slate-800">{pname(x.staff)}</div>
            <div className="text-[12.5px] text-slate-500">{x.position || x.staff?.position || ''} · {p.templates.find(t => t.id === x.template_id)?.name || 'карта'}{x.evaluator === 'director' ? ' · оценява директорът' : ''}</div>
          </div>
          <span className={`text-[12px] px-2 py-0.5 rounded-full ${P_STATUS_TONE[x.status]}`}>{P_STATUS_LABEL[x.status]}</span>
          <button type="button" onClick={word} className={btnLine}><FileDown size={15} /> Word</button>
          <button type="button" onClick={p.onClose} className="p-2 rounded-lg hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {x.status === 'pending' && x.evaluator === 'commission' && !canScore && !leadView && (
            <p className="text-[13px] text-slate-500">Вие не оценявате това лице.</p>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50 text-slate-500 text-[12px]">
                <tr>
                  <th className="px-2 py-2 text-left w-10">№</th><th className="px-2 py-2 text-left">Показатели и критерии</th><th className="px-2 py-2 w-14">Макс.</th>
                  {canScore && <th className="px-2 py-2 w-20 text-indigo-700">Моята</th>}
                  {showOthers && others.map(r => <th key={r.member_id} className="px-2 py-2 w-20 font-normal" title={name(r.member_id)}>{name(r.member_id).split(' ')[0]}{r.submitted_at ? '' : ' (чернова)'}</th>)}
                  {showOthers && x.evaluator === 'commission' && p.rows.length > 0 && <th className="px-2 py-2 w-16">Средно</th>}
                  {(editFinal || x.final_scores) && <th className="px-2 py-2 w-20 text-emerald-700">{editFinal ? (directorMode ? 'Оценка' : jointMode ? 'Обща' : 'Нова') : 'Утвърдена'}</th>}
                </tr>
              </thead>
              <tbody>
                {crit.map(g => [
                  <tr key={g.n} className="bg-slate-50/60 font-medium text-slate-800 border-t border-slate-100">
                    <td className="px-2 py-1.5">{g.n}</td><td className="px-2 py-1.5">{g.g}</td><td className="px-2 py-1.5 text-center tabular-nums">{num(g.max)}</td>
                    {canScore && <td className="px-2 py-1.5 text-center tabular-nums text-indigo-700">{num(groupSum(g, mine))}</td>}
                    {showOthers && others.map(r => <td key={r.member_id} className="px-2 py-1.5 text-center tabular-nums">{num(groupSum(g, r.scores))}</td>)}
                    {showOthers && x.evaluator === 'commission' && p.rows.length > 0 && <td className="px-2 py-1.5 text-center tabular-nums">{avg ? num(groupSum(g, avg)) : ''}</td>}
                    {(editFinal || x.final_scores) && <td className="px-2 py-1.5 text-center tabular-nums text-emerald-700">{num(groupSum(g, editFinal ? fin : x.final_scores))}</td>}
                  </tr>,
                  ...g.items.map(it => {
                    const vals = p.rows.filter(r => r.submitted_at).map(r => Number(r.scores?.[it.k])).filter(v => !isNaN(v))
                    const spread = vals.length > 1 && Math.max(...vals) - Math.min(...vals) >= Math.max(1, it.max / 2)
                    return (
                      <tr key={it.k} className="border-t border-slate-100 text-slate-700 align-top">
                        <td className="px-2 py-1.5 text-slate-500">{it.k}</td><td className="px-2 py-1.5">{it.t}</td><td className="px-2 py-1.5 text-center tabular-nums text-slate-500">{num(it.max)}</td>
                        {canScore && <td className="px-2 py-1 text-center">{cellIn(mine[it.k], it.max, setOne(setMine, it.k))}</td>}
                        {showOthers && others.map(r => <td key={r.member_id} className="px-2 py-1.5 text-center tabular-nums">{num(r.scores?.[it.k])}</td>)}
                        {showOthers && x.evaluator === 'commission' && p.rows.length > 0 && <td className={`px-2 py-1.5 text-center tabular-nums ${spread ? 'bg-amber-50 text-amber-800' : ''}`} title={spread ? 'Голяма разлика между членовете' : ''}>{avg ? num(avg[it.k]) : ''}</td>}
                        {(editFinal || x.final_scores) && <td className="px-2 py-1 text-center">{editFinal ? cellIn(fin[it.k], it.max, setOne(setFin, it.k)) : <span className="tabular-nums text-emerald-700">{num(x.final_scores?.[it.k])}</span>}</td>}
                      </tr>
                    )
                  }),
                ])}
                <tr className="border-t-2 border-slate-200 font-semibold text-slate-800">
                  <td /><td className="px-2 py-2">ОБЩ БРОЙ ТОЧКИ</td><td className="px-2 py-2 text-center tabular-nums">{num(crit.reduce((a, g) => a + Number(g.max), 0))}</td>
                  {canScore && <td className="px-2 py-2 text-center tabular-nums text-indigo-700">{num(sumScores(crit, mine))}</td>}
                  {showOthers && others.map(r => <td key={r.member_id} className="px-2 py-2 text-center tabular-nums">{num(sumScores(crit, r.scores))}</td>)}
                  {showOthers && x.evaluator === 'commission' && p.rows.length > 0 && <td className="px-2 py-2 text-center tabular-nums">{avg ? num(sumScores(crit, avg)) : ''}</td>}
                  {(editFinal || x.final_scores) && <td className="px-2 py-2 text-center tabular-nums text-emerald-700">{num(editFinal ? sumScores(crit, fin) : x.final_total)}</td>}
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
            {p.isLead && x.status === 'pending' && x.evaluator === 'commission' && c.aggregate === 'avg' && c.status === 'scoring' && x.staff_id !== p.me.id && p.rows.some(r => r.submitted_at) && (
              <button type="button" disabled={busy} onClick={() => finalize(false)} className={btnLine}><CheckCircle2 size={15} /> Утвърди средното ({num(avg ? sumScores(crit, avg) : 0)} т.)</button>
            )}
            {(directorMode || jointMode) && <button type="button" disabled={busy} onClick={() => finalize(true)} className={btnDark} style={{ backgroundColor: ACCENT }}><CheckCircle2 size={15} /> Утвърди оценката ({num(sumScores(crit, fin))} т.)</button>}
            {x.status === 'scored' && (p.isLead || (x.evaluator === 'director' && p.isDirector)) && <button type="button" onClick={reopen} className={btnLine}><RotateCcw size={15} /> Върни за преоценка</button>}
            <button type="button" onClick={p.onNext} className={`${btnLine} ml-auto`}>Следващ →</button>
          </div>

          {x.sent_at && (
            <div className="text-[12.5px] text-slate-500">
              Изпратена {dmy(isoOf(x.sent_at))}{x.acked_at ? ` · запознат/а ${dmy(isoOf(x.acked_at))}` : ' · не е запознат/а'}
              {objDue && x.status === 'acked' ? ` · възражение до ${dmy(objDue)}` : ''}
            </div>
          )}
          {x.objection && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 space-y-2">
              <div className="text-[13.5px] text-rose-800"><MessageSquareWarning size={14} className="inline mr-1" /><b>Възражение</b> ({dmy(isoOf(x.objection_at))}): {x.objection}</div>
              {x.decision && <div className="text-[13.5px] text-slate-700"><b>Решение</b> ({dmy(isoOf(x.decided_at))}): {x.decision}{x.decision_changed ? ' — точките са променени.' : ''}</div>}
              {canDecide && (
                <div className="space-y-2">
                  <textarea value={decision} onChange={e => setDecision(e.target.value)} rows={3} className="input w-full" placeholder="Комисията разгледа възражението и … (решението е окончателно)" />
                  <label className="flex items-center gap-2 text-[13px] text-slate-700"><input type="checkbox" checked={change} onChange={e => { setChange(e.target.checked); setFin({ ...(x.final_scores || {}) }) }} /> Променяме точките (колона „Нова“ в картата)</label>
                  <button type="button" disabled={busy} onClick={decide} className={btnDark} style={{ backgroundColor: ACCENT }}>Запиши решението</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Подготовка ────────────────────────────────────────────────────────────
function Setup(p: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const c = p.campaign
  const [f, setF] = useState({ ...c })
  const [busy, setBusy] = useState(false)
  const [addMember, setAddMember] = useState('')
  const [addPerson, setAddPerson] = useState('')
  const editable = c.status === 'setup'
  const supabase = createClient()
  const templates = p.templates.filter(t => t.kind === 'dtv' && t.is_active)
  const inIds = new Set(p.participants.map(x => x.staff_id))
  const memIds = new Set(p.members.map(m => m.staff_id))

  async function saveSettings() {
    setBusy(true)
    const { error } = await supabase.from('eval_campaigns').update({
      name: f.name, aggregate: f.aggregate, score_by: f.score_by || null, order_by: f.order_by || null,
      card_days: f.card_days, objection_days: f.objection_days, min_days_ped: f.min_days_ped, min_days_nonped: f.min_days_nonped,
      sick_tolerance: f.sick_tolerance, basis: f.basis, protocol_no: f.protocol_no, protocol_date: f.protocol_date || null,
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
  function rowFor(person: Person) {
    const t = defaultTemplate(p.templates, person.role)
    return {
      campaign_id: c.id, staff_id: person.id, template_id: t?.id || null, grp: t?.grp || grpForRole(person.role),
      position: person.position, criteria: t?.criteria || null,
      evaluator: ['zdud', 'admin'].includes(person.role) || memIds.has(person.id) ? 'director' : 'commission',
    }
  }
  async function addAll() {
    const add = p.people.filter(x => x.role !== 'director' && !inIds.has(x.id))
    if (!add.length) { toast('Всички активни служители вече са добавени'); return }
    if (!(await confirmDialog(`Да се добавят ли ${add.length} активни служители (без директора)? Картата се избира по длъжността; проверете ги в списъка.`))) return
    setBusy(true)
    const { error } = await supabase.from('eval_participants').insert(add.map(rowFor))
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
    if (!(await confirmDialog('Да започне ли оценяването? Картите се копират към оценяваните — по-късни промени в „Карти“ няма да ги засегнат. Комисията ще вижда своя списък в „Оценяване“.'))) return
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

  return (
    <div className="space-y-5">
      {editable && (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-3 text-[13.5px]">
          <Step ok={!!chair} t="Председател и членове" />
          <Step ok={p.participants.length > 0 && !noTpl} t={`Оценявани с карта (${p.participants.length})`} />
          <button type="button" disabled={busy} onClick={start} className={`${btnDark} ml-auto`} style={{ backgroundColor: ACCENT }}><Play size={15} /> Започни оценяването</button>
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
          <label className="block"><span className="label">Оценяване до</span><DateInput value={f.score_by || ''} onChange={v => setF({ ...f, score_by: v })} /></label>
          <label className="block"><span className="label">Заповед до</span><DateInput value={f.order_by || ''} onChange={v => setF({ ...f, order_by: v })} /></label>
          <label className="block"><span className="label">Картата на лицето до (дни)</span><input type="number" value={f.card_days} onChange={num$('card_days')} className="input w-full" /></label>
          <label className="block"><span className="label">Възражение до (работни дни)</span><input type="number" value={f.objection_days} onChange={num$('objection_days')} className="input w-full" /></label>
          <label className="block"><span className="label">Мин. дни — педагогически</span><input type="number" value={f.min_days_ped} onChange={num$('min_days_ped')} className="input w-full" /></label>
          <label className="block"><span className="label">Мин. дни — непедагогически</span><input type="number" value={f.min_days_nonped} onChange={num$('min_days_nonped')} className="input w-full" /></label>
          <label className="block"><span className="label">Допустим недостиг по болест (дни)</span><input type="number" value={f.sick_tolerance} onChange={num$('sick_tolerance')} className="input w-full" /></label>
          <label className="block md:col-span-3"><span className="label">Комисията е определена с</span><input value={f.basis || ''} onChange={e => setF({ ...f, basis: e.target.value })} className="input w-full" placeholder="с решение на педагогическия съвет (Протокол № … от …)" /></label>
          <label className="block"><span className="label">Протокол на комисията №</span><input value={f.protocol_no || ''} onChange={e => setF({ ...f, protocol_no: e.target.value })} className="input w-full" /></label>
          <label className="block"><span className="label">от дата</span><DateInput value={f.protocol_date || ''} onChange={v => setF({ ...f, protocol_date: v })} /></label>
        </div>
        <button type="button" disabled={busy} onClick={saveSettings} className="btn-primary">Запиши настройките</button>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="text-[15px] font-semibold text-slate-800">Комисия</h2>
        <p className="text-[12.5px] text-slate-500">Членовете на комисията и заместник-директорите се оценяват от директора. Една комисия оценява и педагогическия, и непедагогическия персонал.</p>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {p.members.map(m => (
            <div key={m.staff_id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="flex-1 text-[14px] text-slate-800">{pname(m.staff)} <span className="text-[12px] text-slate-500">{m.staff?.position || ''}</span></span>
              <select value={m.role} disabled={!p.isManager} onChange={e => member(m.staff_id, e.target.value as any)} className="px-2 py-1 rounded-lg border border-slate-200 text-[13px]">
                <option value="chair">Председател</option><option value="member">Член</option>
              </select>
              {p.isManager && editable && <button type="button" onClick={() => member(m.staff_id, null)} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>}
            </div>
          ))}
          {!p.members.length && <p className="px-3 py-3 text-[13px] text-slate-400">Няма членове.</p>}
        </div>
        {p.isManager && editable && (
          <div className="flex gap-2">
            <select value={addMember} onChange={e => setAddMember(e.target.value)} className="input flex-1">
              <option value="">Добави член…</option>
              {p.people.filter(x => !memIds.has(x.id)).map(x => <option key={x.id} value={x.id}>{pname(x)}{x.position ? ` — ${x.position}` : ''}</option>)}
            </select>
            <button type="button" disabled={!addMember} onClick={() => { member(addMember, chair ? 'member' : 'chair'); setAddMember('') }} className={btnLine}><Plus size={15} /> Добави</button>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-slate-800 flex-1">Оценявани ({p.participants.length})</h2>
          <button type="button" disabled={busy} onClick={addAll} className={btnLine}><Users size={15} /> Добави всички активни</button>
        </div>
        {noTpl > 0 && <p className="text-[12.5px] text-amber-700"><AlertTriangle size={13} className="inline mr-1" />{noTpl} без карта — изберете карта (картата за педагогическите специалисти се въвежда от „Оценяване → Карти“).</p>}
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {sorted.map(x => (
            <div key={x.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="flex-1 min-w-[180px] text-[14px] text-slate-800">{pname(x.staff)} <span className="text-[12px] text-slate-500">{x.position || ''}</span></span>
              <select value={x.template_id || ''} disabled={x.status !== 'pending'} onChange={e => updateP(x, { template_id: e.target.value || null })} className={`px-2 py-1 rounded-lg border text-[13px] max-w-[260px] ${x.template_id ? 'border-slate-200' : 'border-amber-300 bg-amber-50'}`}>
                <option value="">— карта —</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={x.grp} onChange={e => updateP(x, { grp: e.target.value as Grp })} className="px-2 py-1 rounded-lg border border-slate-200 text-[13px]" title="Фонд">
                <option value="ped">педагогически</option><option value="nonped">непедагогически</option>
              </select>
              <select value={x.evaluator} disabled={x.status !== 'pending' || memIds.has(x.staff_id)} onChange={e => updateP(x, { evaluator: e.target.value as any })} className="px-2 py-1 rounded-lg border border-slate-200 text-[13px]">
                <option value="commission">оценява комисията</option><option value="director">оценява директорът</option>
              </select>
              <button type="button" onClick={() => removeP(x)} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={addPerson} onChange={e => setAddPerson(e.target.value)} className="input flex-1">
            <option value="">Добави служител (и напуснал през годината)…</option>
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

// ── Суми ──────────────────────────────────────────────────────────────────
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

// ── Документи ─────────────────────────────────────────────────────────────
function Docs(p: Props & { ctx: Ctx }) {
  const router = useRouter()
  const { toast } = useToast()
  const c = p.campaign
  const [busy, setBusy] = useState(false)
  const done = p.participants.filter(x => x.final_total != null)
  const tpl = (x: Participant) => p.templates.find(t => t.id === x.template_id)
  const open = p.participants.filter(x => !['acked', 'resolved'].includes(x.status))
  const lateCards = p.participants.filter(x => x.status === 'scored' && x.finalized_at && daysLeft(addDays(isoOf(x.finalized_at), c.card_days)) < 0)

  async function upload(file: File) {
    setBusy(true)
    const path = `${c.id}/protokol_${Date.now()}_${file.name.replace(/[^\w.\-]+/g, '_')}`
    const supabase = createClient()
    const { error } = await supabase.storage.from('evaluation').upload(path, file)
    if (!error) await supabase.from('eval_campaigns').update({ scan_path: path }).eq('id', c.id)
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Сканираният протокол е прикачен'); router.refresh()
  }
  async function close() {
    if (open.length && !(await confirmDialog(`${open.length} лица още не са запознати или имат нерешено възражение. Да се приключи ли кампанията въпреки това?`))) return
    const { error } = await createClient().from('eval_campaigns').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', c.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Кампанията е приключена'); router.refresh()
  }
  return (
    <div className="space-y-4">
      {lateCards.length > 0 && <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[13px] px-4 py-3"><AlertTriangle size={14} className="inline mr-1" />{lateCards.length} утвърдени карти не са изпратени до {c.card_days} дни от подписването.</div>}
      <div className="grid gap-3 md:grid-cols-2">
        <DocCard title="Карти за оценка" text={`Всички утвърдени карти (${done.length}) в един файл — всяка на отделна страница, за подпис от комисията и лицето.`}>
          <button type="button" disabled={!done.length} onClick={() => generateCards(p.ctx, done.map(x => ({ p: x, template: tpl(x) })))} className={btnLine}><FileDown size={15} /> Всички карти</button>
          {(['ped', 'nonped'] as Grp[]).map(g => done.some(x => x.grp === g) && (
            <button key={g} type="button" onClick={() => generateCards(p.ctx, done.filter(x => x.grp === g).map(x => ({ p: x, template: tpl(x) })), `Карти_ДТВ_${g === 'ped' ? 'педагогически' : 'непедагогически'}.docx`)} className={btnLine}>{g === 'ped' ? 'Педагогически' : 'Непедагогически'}</button>
          ))}
          <button type="button" onClick={() => generateCards(p.ctx, p.participants.map(x => ({ p: { ...x, final_scores: null, final_total: null, finalized_at: null, acked_at: null, objection: null }, template: tpl(x) })), 'Карти_ДТВ_празни.docx')} className={btnLine}>Празни (за ръчно попълване)</button>
        </DocCard>
        <DocCard title="Протокол на комисията" text={`Резултатите по групи, възраженията и решенията. Номер и дата: ${c.protocol_no ? `№ ${c.protocol_no}` : 'не са въведени'}${c.protocol_date ? ` / ${dmy(c.protocol_date)}` : ''} (в „Подготовка“).`}>
          <button type="button" disabled={!done.length} onClick={() => generateProtocol(p.ctx, done)} className={btnLine}><FileDown size={15} /> Протокол (Word)</button>
          {p.isLead && <label className={`${btnLine} cursor-pointer`}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Прикачи подписания<input type="file" accept=".pdf,image/*" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} /></label>}
          {p.scanUrl && <a href={p.scanUrl} target="_blank" rel="noreferrer" className="text-[13px] text-indigo-700 hover:underline self-center">Виж сканирания протокол</a>}
        </DocCard>
        {p.isFinance && (
          <DocCard title="Заповед и суми" text="Заповедта за размерите (без номер — номерът се поставя при регистрирането) и таблицата за счетоводството са в „Суми“.">
            <Link href={`/evaluation/${c.id}?tab=money`} className={btnLine}><Calculator size={15} /> Към „Суми“</Link>
          </DocCard>
        )}
        {p.isLead && c.status === 'scoring' && (
          <DocCard title="Приключване" text={`Когато всички са запознати и възраженията са решени (${p.participants.length - open.length} от ${p.participants.length}).`}>
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

