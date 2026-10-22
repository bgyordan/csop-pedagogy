'use client'
// Анализ на контролната дейност: изпълнение на графика, проверки по вид и форма, силни и слаби критерии, препоръки.
// Изход: доклад за педагогическия съвет (февруари — първи срок, юли — годината) като Word.
import { useMemo, useState } from 'react'
import { FileText, Loader2, TrendingDown, TrendingUp, CalendarRange, ClipboardCheck, Users, ListChecks } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { analyzeControl, analysisText, MONTH_LABEL, PERIOD_LABEL, type Period } from '@/lib/control-plan'
import { generateControlAnalysis } from '@/lib/docx-control'
import type { ControlProps } from './ControlClient'
import CouncilSend from './CouncilSend'

const ACCENT = '#0f2240'
const pname = (p?: { first_name: string; last_name: string } | null) => (p ? `${p.first_name} ${p.last_name}` : '—')
const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
const PEDAGOGICAL = ['teacher', 'class_teacher', 'educator', 'psychologist', 'speech_therapist', 'rehabilitator', 'coordinator']

export default function AnalysisTab(p: ControlProps) {
  const { toast } = useToast()
  const month = parseInt(todayIso().slice(5, 7), 10)
  const [period, setPeriod] = useState<Period>(month >= 2 && month <= 8 ? 'year' : 't1')
  const [who, setWho] = useState<string>(p.isDirector ? 'all' : p.me.id)
  const [busy, setBusy] = useState(false)
  const names = useMemo(() => Object.fromEntries(p.checks.map(c => [c.inspector_id, pname(c.inspector)])), [p.checks])
  const inspectors = Object.entries(names)

  const checks = p.checks.filter(c => who === 'all' || c.inspector_id === who)
  const plans = p.plans.filter(x => who === 'all' || x.owner_id === who)
  const items = p.planItems.filter(i => plans.some(x => x.id === i.plan_id))
  const recs = p.recs.filter(r => who === 'all' || r.check.inspector_id === who)
  const a = useMemo(() => analyzeControl({
    checks: checks as any, recs: recs as any, items, yearName: p.year?.name || '', period, today: todayIso(), inspectorNames: names,
  }), [checks, recs, items, period])
  const whoName = who === 'all' ? '' : names[who] || (who === p.me.id ? p.me.name : '')
  const auto = analysisText(a, { yearName: p.year?.name || '', period, who: whoName || undefined }).join('\n\n')
  const [text, setText] = useState<string | null>(null)
  const body = text ?? auto
  const pedagogical = p.people.filter(x => PEDAGOGICAL.includes(x.role)).length

  async function word() {
    if (!p.year) return
    setBusy(true)
    try {
      await generateControlAnalysis({ yearName: p.year.name, period, who: whoName, analysis: a, text: body, author: p.me.name, authorTitle: p.me.position })
    } catch (e: any) { toast(e.message || 'Грешка при Word', 'error') }
    setBusy(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5">
          {(['t1', 't2', 'year'] as Period[]).map(x => (
            <button key={x} type="button" onClick={() => { setPeriod(x); setText(null) }} className={`px-3 py-1.5 rounded-lg text-[13px] ${period === x ? 'bg-[#0f2240] text-white' : 'text-slate-600'}`}>
              {x === 't1' ? 'I срок' : x === 't2' ? 'II срок' : 'Година'}
            </button>
          ))}
        </div>
        {p.isDirector && inspectors.length > 1 && (
          <select value={who} onChange={e => { setWho(e.target.value); setText(null) }} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
            <option value="all">Целият център</option>
            {inspectors.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        )}
        <span className="flex-1" />
        {p.year && <CouncilSend meId={p.me.id} desc="Анализ на контролната дейност" make={() => generateControlAnalysis({ yearName: p.year!.name, period, who: whoName, analysis: a, text: body, author: p.me.name, authorTitle: p.me.position, asBlob: true })} />}
        <button type="button" onClick={word} disabled={busy} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm text-white" style={{ backgroundColor: ACCENT }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Доклад за ПС (Word)
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={<ClipboardCheck size={16} />} big={a.total} l="подписани протокола" sub={`${a.planned} по плана · ${a.total - a.planned} извън`} />
        <Card icon={<CalendarRange size={16} />} big={a.plan.due ? `${Math.round((a.plan.done / a.plan.due) * 100)}%` : '—'} l="изпълнение на графика" sub={a.plan.due ? `${a.plan.done} от ${a.plan.due} дейности с изтекъл срок` : a.plan.total ? 'срокът на дейностите не е изтекъл' : 'няма въведен график'} />
        <Card icon={<Users size={16} />} big={a.staff} l="проверени служители" sub={pedagogical ? `от ${pedagogical} педагогически специалисти` : ''} />
        <Card icon={<ListChecks size={16} />} big={a.rec.total ? `${a.rec.done}/${a.rec.total}` : '0'} l="изпълнени препоръки" sub={a.rec.overdue ? `${a.rec.overdue} с изтекъл срок` : `${a.followUps} последващи проверки`} tone={a.rec.overdue ? 'rose' : undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Проверки по вид, насоченост и форма">
          <Bars rows={[...a.byKind, ...a.byFocus]} />
          <div className="h-2" />
          <Bars rows={a.byForm} />
          {a.byInspector.length > 1 && <><div className="h-2" /><Bars rows={a.byInspector} /></>}
        </Panel>
        <Panel title="Изпълнение на графика">
          {!a.plan.total ? <p className="text-sm text-slate-400">Няма въведен график в „План“.</p> : (
            <div className="space-y-2 text-[13.5px]">
              <p className="text-slate-700">Изпълнени изцяло: <b>{a.plan.done}</b> · частично: <b>{a.plan.partial}</b> · непроведени: <b className={a.plan.missed.length ? 'text-rose-700' : ''}>{a.plan.missed.length}</b> (от {a.plan.due} с изтекъл срок; общо {a.plan.total} в графика)</p>
              {a.plan.missed.length > 0 && (
                <ul className="space-y-1">
                  {a.plan.missed.map(i => <li key={i.id} className="text-rose-800 text-[13px]">{MONTH_LABEL[i.month]}: {i.subject}</li>)}
                </ul>
              )}
            </div>
          )}
        </Panel>
        <Panel title="Силни страни" icon={<TrendingUp size={14} className="text-emerald-600" />}>
          {a.strong.length ? <Crit rows={a.strong.map(x => ({ t: x.t, v: x.high, n: x.n }))} tone="emerald" /> : <p className="text-sm text-slate-400">Още няма достатъчно оценени критерии (поне 2 оценки на критерий).</p>}
        </Panel>
        <Panel title="Области за подобрение" icon={<TrendingDown size={14} className="text-rose-600" />}>
          {a.weak.length ? <Crit rows={a.weak.map(x => ({ t: x.t, v: x.low, n: x.n }))} tone="rose" /> : <p className="text-sm text-slate-400">Няма критерии, оценени като частично или неизпълнени.</p>}
        </Panel>
      </div>

      <Panel title={`Текст на анализа — ${PERIOD_LABEL[period]}`}>
        <textarea className="input w-full text-[14px]" rows={Math.min(22, body.split('\n').length + 3)} value={body} onChange={e => setText(e.target.value)} />
        <div className="flex items-center gap-3 mt-2">
          <p className="flex-1 text-[12px] text-slate-400">Текстът се сглобява от данните; допълнете го преди да свалите доклада. Влиза и в част 1 на плана за следващата година.</p>
          {text !== null && <button type="button" onClick={() => setText(null)} className="text-[12.5px] text-indigo-700">Върни автоматичния текст</button>}
        </div>
      </Panel>
    </div>
  )
}

function Card({ icon, big, l, sub, tone }: { icon: React.ReactNode; big: React.ReactNode; l: string; sub?: string; tone?: 'rose' }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone === 'rose' ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-2 text-slate-500 text-[12.5px]">{icon}{l}</div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${tone === 'rose' ? 'text-rose-700' : 'text-slate-800'}`}>{big}</div>
      {sub && <div className="text-[12px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}
function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <section className="bg-white rounded-2xl border border-slate-200 p-5"><h3 className="text-[13px] uppercase tracking-wide text-slate-500 mb-3 inline-flex items-center gap-1.5">{icon}{title}</h3>{children}</section>
}
function Bars({ rows }: { rows: readonly (readonly [string, number])[] }) {
  const max = Math.max(1, ...rows.map(r => r[1]))
  if (!rows.length) return <p className="text-sm text-slate-400">Няма данни.</p>
  return (
    <div className="space-y-1">
      {rows.map(([l, n]) => (
        <div key={l} className="grid grid-cols-[150px_1fr_32px] items-center gap-2 text-[13px]">
          <span className="text-slate-600 truncate">{l}</span>
          <span className="h-2.5 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full rounded-full bg-indigo-500" style={{ width: `${(n / max) * 100}%` }} /></span>
          <span className="text-right tabular-nums text-slate-700">{n}</span>
        </div>
      ))}
    </div>
  )
}
function Crit({ rows, tone }: { rows: { t: string; v: number; n: number }[]; tone: 'emerald' | 'rose' }) {
  return (
    <ul className="space-y-1.5">
      {rows.map(r => (
        <li key={r.t} className="flex items-start gap-2 text-[13.5px]">
          <span className="flex-1 text-slate-700">{r.t}</span>
          <span className={`shrink-0 text-[12px] px-2 py-0.5 rounded-full tabular-nums ${tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{r.v} от {r.n}</span>
        </li>
      ))}
    </ul>
  )
}
