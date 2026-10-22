'use client'
// Контролна дейност — списък на проверките, Книга за контролната дейност и настройки (шаблони, проверяващи).
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ClipboardCheck, Plus, X, Loader2, FileText, BookOpen, Settings, AlertTriangle, CheckCircle2, Clock,
  MessageSquareWarning, Search, Check, ListChecks,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import DateInput from '@/components/ui/DateInput'
import {
  KIND_LABEL, FORM_LABEL, FOCUS_LABEL, STATUS_LABEL, protocolDeadline, dmy, defaultBasis, inspectorTitle,
  REC_STATUS_LABEL, REC_STATUS_TONE, recOverdue,
  type ControlCheck, type ControlTemplate, type CheckStaff, type CriteriaGroup, type Recommendation,
} from '@/lib/control'
import { generateControlBook } from '@/lib/docx-control'

type Person = { id: string; first_name: string; last_name: string; role: string; position: string | null }
type Row = ControlCheck & { staff: CheckStaff[] }
type Year = { id: string; name: string; is_current: boolean }
type RecRow = Recommendation & {
  responsible?: { first_name: string; last_name: string } | null
  check: { id: string; book_no: number | null; subject: string; signed_at: string | null; status: string; inspector_id: string; academic_year_id: string | null }
}

const ACCENT = '#0f2240'
const pname = (p?: { first_name: string; last_name: string } | null) => (p ? `${p.first_name} ${p.last_name}` : '—')
const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })

export default function ControlClient(p: {
  me: { id: string; role: string; name: string; position: string }
  isDirector: boolean; isInspector: boolean; tab: string
  years: Year[]; year: Year | null; checks: Row[]; recs: RecRow[]; templates: ControlTemplate[]; people: Person[]
  inspectorIds: string[]; visit: any
}) {
  const router = useRouter()
  const [creating, setCreating] = useState<boolean>(!!p.visit)
  const tabs = p.isInspector
    ? [{ k: 'checks', l: 'Проверки', i: <ClipboardCheck size={14} /> },
       { k: 'recs', l: 'Препоръки', i: <ListChecks size={14} />, n: p.recs.filter(r => (p.isDirector || r.check.inspector_id === p.me.id) && (r.status === 'reported' || recOverdue(r))).length },
       { k: 'book', l: 'Книга', i: <BookOpen size={14} /> },
       ...(['director', 'zdud'].includes(p.me.role) ? [{ k: 'settings', l: 'Настройки', i: <Settings size={14} /> }] : [])]
    : []
  const go = (tab: string) => router.push(`/control?tab=${tab}${p.year && !p.year.is_current ? `&y=${p.year.id}` : ''}`)

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <header className="flex flex-wrap items-center gap-4 mb-6 pb-5 border-b border-slate-100">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0"><ClipboardCheck size={22} /></div>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">{p.isInspector ? 'Контролна дейност' : 'Моите констативни протоколи'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {p.isInspector ? 'Проверки, констативни протоколи и Книга за контролната дейност' : 'Протоколите от проверките, в които сте проверен/а — запознаване и възражение'}
          </p>
        </div>
        {p.years.length > 1 && (
          <select value={p.year?.id || ''} onChange={e => router.push(`/control?tab=${p.tab}&y=${e.target.value}`)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
            {p.years.map(y => <option key={y.id} value={y.id}>{y.name.replace('-', '/')}{y.is_current ? ' (текуща)' : ''}</option>)}
          </select>
        )}
        {p.isInspector && (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-white" style={{ backgroundColor: ACCENT }}>
            <Plus size={15} /> Нова проверка
          </button>
        )}
      </header>

      {tabs.length > 0 && (
        <nav className="flex gap-1.5 mb-5">
          {tabs.map(t => (
            <button key={t.k} type="button" onClick={() => go(t.k)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm ${p.tab === t.k ? 'bg-[#0f2240] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {t.i} {t.l}
              {'n' in t && !!t.n && <span className={`ml-0.5 text-[11px] min-w-5 px-1.5 rounded-full ${p.tab === t.k ? 'bg-white/20' : 'bg-rose-100 text-rose-700'}`}>{t.n}</span>}
            </button>
          ))}
        </nav>
      )}

      {!p.isInspector && <MyRecs recs={p.recs} />}
      {!p.isInspector && <MyProtocols me={p.me} checks={p.checks} />}
      {p.isInspector && p.tab === 'recs' && <Recs {...p} />}
      {p.isInspector && p.tab === 'checks' && <MyRecs recs={p.recs.filter(r => r.responsible_id === p.me.id)} />}
      {p.isInspector && p.tab === 'checks' && <Checks {...p} />}
      {p.isInspector && p.tab === 'book' && <Book {...p} />}
      {p.isInspector && p.tab === 'settings' && <SettingsTab {...p} />}

      {creating && p.year && <NewCheck {...p} onClose={() => { setCreating(false); if (p.visit) router.replace('/control') }} />}
    </div>
  )
}

// ── Проверки ───────────────────────────────────────────────────────────────
function Checks(p: Parameters<typeof ControlClient>[0]) {
  const [who, setWho] = useState<string>(p.isDirector ? 'all' : p.me.id)
  const [status, setStatus] = useState<string>('all')
  const [q, setQ] = useState('')
  const inspectors = useMemo(() => {
    const m = new Map<string, string>()
    p.checks.forEach(c => m.set(c.inspector_id, pname(c.inspector)))
    return Array.from(m.entries())
  }, [p.checks])
  const list = p.checks.filter(c =>
    (who === 'all' || c.inspector_id === who) && (status === 'all' || c.status === status)
    && (!q.trim() || `${c.subject} ${c.staff.map(s => pname(s.staff)).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())))

  const mine = p.checks.filter(c => p.isDirector || c.inspector_id === p.me.id)
  const drafts = mine.filter(c => c.status === 'draft')
  const late = drafts.filter(c => protocolDeadline(c.check_date).left <= 5)
  const unacked = mine.filter(c => c.status === 'signed' && c.staff.some(s => !s.acked_at))
  const objections = mine.filter(c => c.status === 'signed' && c.staff.some(s => s.objection))

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<FileText size={16} />} n={drafts.length} l="чернови" tone="slate" />
        <Stat icon={<AlertTriangle size={16} />} n={late.length} l="до 5 дни до 15-дневния срок или просрочени" tone={late.length ? 'rose' : 'slate'} />
        <Stat icon={<Clock size={16} />} n={unacked.length} l="подписани, но незапознати" tone={unacked.length ? 'amber' : 'slate'} />
        <Stat icon={<MessageSquareWarning size={16} />} n={objections.length} l="с възражение" tone={objections.length ? 'amber' : 'slate'} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси по предмет или служител" className="input pl-8 w-64" />
        </div>
        {p.isDirector && inspectors.length > 0 && (
          <select value={who} onChange={e => setWho(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
            <option value="all">Всички проверяващи</option>
            {inspectors.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        )}
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="all">Всички</option>
          <option value="draft">Чернови</option>
          <option value="signed">Подписани</option>
          <option value="voided">Анулирани</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {list.map(c => <CheckRow key={c.id} c={c} showInspector={p.isDirector} />)}
        {!list.length && <p className="p-6 text-sm text-slate-400 text-center">Няма проверки{p.year ? ` за ${p.year.name.replace('-', '/')}` : ''}. Натиснете „Нова проверка“ или „Протокол“ от посещение на час.</p>}
      </div>
    </div>
  )
}

function Stat({ icon, n, l, tone }: { icon: React.ReactNode; n: number; l: string; tone: 'slate' | 'rose' | 'amber' }) {
  const c = tone === 'rose' ? 'bg-rose-50 border-rose-100 text-rose-700' : tone === 'amber' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-white border-slate-200 text-slate-600'
  return (
    <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${c}`}>
      {icon}<span className="text-xl font-semibold tabular-nums">{n}</span><span className="text-[12.5px] leading-tight">{l}</span>
    </div>
  )
}

function CheckRow({ c, showInspector }: { c: Row; showInspector: boolean }) {
  const d = protocolDeadline(c.check_date)
  return (
    <Link href={`/control/${c.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50">
      <span className="w-20 shrink-0 text-[13px] text-slate-500 tabular-nums">{dmy(c.check_date)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] text-slate-800 truncate">{c.subject || 'Без предмет'}</span>
        <span className="block text-[12.5px] text-slate-500 truncate">
          {c.staff.map(s => pname(s.staff)).join(', ') || 'няма посочен служител'} · {KIND_LABEL[c.kind]}, {FORM_LABEL[c.form].toLowerCase()}
          {showInspector ? ` · ${pname(c.inspector)}` : ''}
        </span>
      </span>
      {c.status === 'draft' && (
        <span className={`text-[12px] px-2 py-0.5 rounded-full ${d.left < 0 ? 'bg-rose-100 text-rose-700' : d.left <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
          чернова · {d.left < 0 ? `просрочена с ${-d.left} дни` : `остават ${d.left} дни`}
        </span>
      )}
      {c.status === 'signed' && (
        <span className="flex items-center gap-1.5">
          <span className="text-[12px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">№ {c.book_no}</span>
          {c.staff.some(s => s.objection) && <span title="Има възражение" className="text-amber-600"><MessageSquareWarning size={15} /></span>}
          {c.staff.every(s => s.acked_at)
            ? <span title="Всички са запознати" className="text-emerald-600"><CheckCircle2 size={15} /></span>
            : <span title="Очаква запознаване" className="text-amber-500"><Clock size={15} /></span>}
        </span>
      )}
      {c.status === 'voided' && <span className="text-[12px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 line-through">№ {c.book_no}</span>}
    </Link>
  )
}

// ── За проверения служител ─────────────────────────────────────────────────
function MyProtocols({ me, checks }: { me: { id: string }; checks: Row[] }) {
  const list = checks.filter(c => c.status !== 'draft' && c.staff.some(x => x.staff_id === me.id))
  return (
    <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
      {list.map(c => {
        const s = c.staff.find(x => x.staff_id === me.id)
        return (
          <Link key={c.id} href={`/control/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
            <span className="w-20 text-[13px] text-slate-500 tabular-nums">{dmy(c.check_date)}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] text-slate-800 truncate">{c.subject}</span>
              <span className="block text-[12.5px] text-slate-500">№ {c.book_no} · {pname(c.inspector)}</span>
            </span>
            {c.status === 'voided' ? <span className="text-[12px] text-slate-400">анулиран</span>
              : s?.acked_at ? <span className="text-[12px] text-emerald-700 inline-flex items-center gap-1"><Check size={13} /> запознат/а</span>
              : <span className="text-[12px] px-2 py-0.5 rounded-full bg-indigo-600 text-white">за запознаване</span>}
          </Link>
        )
      })}
      {!list.length && <p className="p-6 text-sm text-slate-400 text-center">Няма протоколи.</p>}
    </div>
  )
}

// ── Препоръки ──────────────────────────────────────────────────────────────
function Recs(p: Parameters<typeof ControlClient>[0]) {
  const [who, setWho] = useState<string>(p.isDirector ? 'all' : p.me.id)
  const [status, setStatus] = useState<string>('active')
  const [q, setQ] = useState('')
  const base = p.recs.filter(r => p.isDirector || r.check.inspector_id === p.me.id)
  const inspectors = useMemo(() => {
    const names = new Map(p.checks.map(c => [c.inspector_id, pname(c.inspector)]))
    return Array.from(new Set(base.map(r => r.check.inspector_id))).map(id => [id, names.get(id) || (id === p.me.id ? p.me.name : 'Проверяващ')] as const)
  }, [p.recs, p.checks])
  const reported = base.filter(r => r.status === 'reported')
  const overdue = base.filter(r => recOverdue(r))
  const open = base.filter(r => r.status === 'open' || r.status === 'not_done')
  const list = base.filter(r =>
    (who === 'all' || r.check.inspector_id === who)
    && (status === 'all' || (status === 'active' ? r.status !== 'done' : status === 'overdue' ? recOverdue(r) : r.status === status))
    && (!q.trim() || `${r.text} ${pname(r.responsible)} ${r.check.subject}`.toLowerCase().includes(q.trim().toLowerCase())))
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={<MessageSquareWarning size={16} />} n={reported.length} l="отчетени — очакват потвърждение" tone={reported.length ? 'amber' : 'slate'} />
        <Stat icon={<AlertTriangle size={16} />} n={overdue.length} l="с изтекъл срок" tone={overdue.length ? 'rose' : 'slate'} />
        <Stat icon={<Clock size={16} />} n={open.length} l="отворени или неизпълнени" tone="slate" />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси по текст или служител" className="input pl-8 w-64" />
        </div>
        {p.isDirector && inspectors.length > 1 && (
          <select value={who} onChange={e => setWho(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
            <option value="all">Всички проверяващи</option>
            {inspectors.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        )}
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
          <option value="active">Неприключени</option>
          <option value="reported">Отчетени</option>
          <option value="overdue">С изтекъл срок</option>
          <option value="done">Изпълнени</option>
          <option value="not_done">Неизпълнени</option>
          <option value="all">Всички</option>
        </select>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {list.map(r => <RecRowView key={r.id} r={r} />)}
        {!list.length && <p className="p-6 text-sm text-slate-400 text-center">Няма препоръки по този филтър. Препоръките идват от подписаните протоколи.</p>}
      </div>
      <p className="text-[12.5px] text-slate-500">Отговорникът отчита изпълнението от своя профил; вие потвърждавате в протокола. За проверка на място — „Последващ контрол“ в протокола.</p>
    </div>
  )
}

function RecRowView({ r, mine }: { r: RecRow; mine?: boolean }) {
  const status = r.status || 'open'
  const late = recOverdue(r)
  return (
    <Link href={`/control/${r.check.id}`} className="flex flex-wrap items-start gap-3 px-4 py-3 hover:bg-slate-50">
      <span className={`w-24 shrink-0 text-[13px] tabular-nums ${late ? 'text-rose-700 font-medium' : 'text-slate-500'}`}>{r.due_date ? dmy(r.due_date) : 'без срок'}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] text-slate-800">{r.text}</span>
        <span className="block text-[12.5px] text-slate-500 truncate">
          {mine ? '' : `${pname(r.responsible)} · `}КП № {r.check.book_no} / {dmy(r.check.signed_at)} · {r.check.subject}
        </span>
        {r.status === 'reported' && r.report && <span className="block text-[12.5px] text-indigo-800 mt-1">Отчет: {r.report}</span>}
      </span>
      <span className={`text-[12px] px-2 py-0.5 rounded-full ${late ? 'bg-rose-100 text-rose-700' : REC_STATUS_TONE[status]}`}>{late ? 'изтекъл срок' : REC_STATUS_LABEL[status]}</span>
    </Link>
  )
}

// За отговорника: препоръките към него (отчетът се прави в протокола)
function MyRecs({ recs }: { recs: RecRow[] }) {
  const active = recs.filter(r => r.status !== 'done')
  if (!recs.length) return null
  return (
    <section className="mb-6">
      <h2 className="text-[13px] uppercase tracking-wide text-slate-500 mb-2">Моите препоръки{active.length ? ` · ${active.length} неприключени` : ''}</h2>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {(active.length ? active : recs).map(r => <RecRowView key={r.id} r={r} mine />)}
      </div>
      {active.length > 0 && <p className="text-[12.5px] text-slate-500 mt-2">Отворете препоръката и натиснете „Отчети изпълнение“, когато я изпълните.</p>}
    </section>
  )
}

// ── Книга ──────────────────────────────────────────────────────────────────
function Book(p: Parameters<typeof ControlClient>[0]) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const rows = p.checks.filter(c => c.book_no && (p.isDirector || c.inspector_id === p.me.id)).sort((a, b) => (a.book_no || 0) - (b.book_no || 0))
  const summary = (c: Row) => (c.conclusions || c.findings_text || '').replace(/\s+/g, ' ').slice(0, 220)
  async function word() {
    if (!p.year) return
    setBusy(true)
    try {
      await generateControlBook({
        yearName: p.year.name,
        rows: rows.map(c => ({
          no: c.book_no || 0, signed: dmy(c.signed_at), date: dmy(c.check_date),
          inspector: `${pname(c.inspector)}\n${c.inspector_title || ''}`,
          kind: `${KIND_LABEL[c.kind]}, ${FOCUS_LABEL[c.focus].toLowerCase()}\n${FORM_LABEL[c.form].toLowerCase()}`,
          subject: c.subject, checked: c.staff.map(s => pname(s.staff)).join('\n'), summary: summary(c),
          acked: c.staff.length && c.staff.every(s => s.acked_at) ? 'да' : c.staff.some(s => s.acked_at) ? 'частично' : 'не',
          voided: c.status === 'voided' ? (c.voided_reason || '') : null,
        })),
      })
    } catch (e: any) { toast(e.message || 'Грешка при Word', 'error') }
    setBusy(false)
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-600 flex-1 min-w-[260px]">
          {p.isDirector ? 'Обща книга за центъра' : 'Вашите записи в книгата'} за {p.year?.name.replace('-', '/')} · {rows.length} записа. Номерът се дава при подписване и започва от № 1 всяка учебна година.
        </p>
        <button type="button" onClick={word} disabled={busy || !rows.length} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm text-white disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Word за Книгата
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>{['№', 'Дата на КП', 'Проверка', 'Проверяващ', 'Вид / форма', 'Предмет', 'Проверени', 'Запознат'].map(h => <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(c => (
              <tr key={c.id} className={c.status === 'voided' ? 'text-slate-400' : ''}>
                <td className="px-3 py-2 tabular-nums">{c.book_no}</td>
                <td className="px-3 py-2 tabular-nums">{dmy(c.signed_at)}</td>
                <td className="px-3 py-2 tabular-nums">{dmy(c.check_date)}</td>
                <td className="px-3 py-2">{pname(c.inspector)}</td>
                <td className="px-3 py-2">{KIND_LABEL[c.kind]} · {FORM_LABEL[c.form].toLowerCase()}</td>
                <td className="px-3 py-2"><Link href={`/control/${c.id}`} className={`hover:underline ${c.status === 'voided' ? 'line-through' : 'text-slate-800'}`}>{c.subject}</Link>{c.status === 'voided' && <span className="block text-[12px]">анулиран: {c.voided_reason}</span>}</td>
                <td className="px-3 py-2">{c.staff.map(s => pname(s.staff)).join(', ')}</td>
                <td className="px-3 py-2">{c.staff.every(s => s.acked_at) ? 'да' : 'не'}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">Още няма подписани протоколи.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Нова проверка ──────────────────────────────────────────────────────────
function NewCheck(p: Parameters<typeof ControlClient>[0] & { onClose: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const active = p.templates.filter(t => t.is_active)
  const v = p.visit
  const initialTpl = v ? (active.find(t => t.code === (v.period >= 21 ? 'coud' : 'lesson')) || active[0]) : active[0]
  const [tplId, setTplId] = useState(initialTpl?.id || '')
  const [date, setDate] = useState<string>(v?.date || todayIso())
  const [staffIds, setStaffIds] = useState<string[]>(v?.staff_id ? [v.staff_id] : [])
  const [planned, setPlanned] = useState(true)
  const [announced, setAnnounced] = useState(true)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const tpl = active.find(t => t.id === tplId)
  const found = p.people.filter(x => !staffIds.includes(x.id) && x.id !== p.me.id && q.trim().length > 0 && `${x.first_name} ${x.last_name}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)

  async function create() {
    if (!tpl || !p.year) return
    setBusy(true)
    const supabase = createClient()
    const details: Record<string, string> = {}
    if (v) {
      if (v.class_name) details.class = v.class_name
      if (v.subject) details.subject = v.subject
      if (v.topic) details.topic = v.topic
    }
    const subject = tpl.subject ? (v?.subject && tpl.code === 'lesson' ? `${tpl.subject} по ${v.subject}` : tpl.subject) : ''
    const { data, error } = await supabase.from('control_checks').insert({
      academic_year_id: p.year.id, inspector_id: p.me.id, inspector_title: inspectorTitle(p.me.role, p.me.position),
      template_id: tpl.id, visit_booking_id: v?.id || null,
      kind: tpl.kind, focus: tpl.focus, form: tpl.form, planned, announced, check_date: date,
      subject, purpose: tpl.purpose, method: tpl.method, basis: defaultBasis({ role: p.me.role, planned, yearName: p.year.name }),
      details, criteria: tpl.criteria,
    }).select('id').single()
    if (error || !data) { toast(error?.message || 'Грешка', 'error'); setBusy(false); return }
    if (staffIds.length) {
      const { error: e2 } = await supabase.from('control_check_staff').insert(staffIds.map(id => ({ check_id: data.id, staff_id: id })))
      if (e2) toast(e2.message, 'error')
    }
    router.push(`/control/${data.id}`)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={p.onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <h3 className="flex-1 text-base text-slate-800">{v ? 'Протокол от посещение на час' : 'Нова проверка'}</h3>
          <button type="button" onClick={p.onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <div className="text-[12px] uppercase tracking-wide text-slate-500 mb-2">Вид протокол</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {active.map(t => (
                <button key={t.id} type="button" onClick={() => setTplId(t.id)}
                  className={`text-left rounded-xl border px-3 py-2.5 ${tplId === t.id ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-200' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <span className="block text-[13.5px] text-slate-800">{t.name}</span>
                  <span className="block text-[12px] text-slate-500">{KIND_LABEL[t.kind]} · {FOCUS_LABEL[t.focus].toLowerCase()} · {FORM_LABEL[t.form].toLowerCase()}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[12px] uppercase tracking-wide text-slate-500">Дата на проверката</span>
              <DateInput value={date} onChange={setDate} className="mt-1" />
            </label>
            <div className="space-y-2 pt-5">
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={planned} onChange={e => setPlanned(e.target.checked)} /> По плана за контролната дейност</label>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={announced} onChange={e => setAnnounced(e.target.checked)} /> Предварително оповестена</label>
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wide text-slate-500 mb-2">Проверен/и служител/и</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {staffIds.map(id => { const x = p.people.find(y => y.id === id); return (
                <span key={id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-indigo-50 text-[13px] text-indigo-900">
                  {pname(x)}<button type="button" onClick={() => setStaffIds(staffIds.filter(s => s !== id))} className="p-0.5 text-indigo-300 hover:text-rose-600"><X size={12} /></button>
                </span>) })}
            </div>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Напишете име…" className="input w-full" />
            {found.length > 0 && (
              <div className="mt-1 rounded-xl border border-slate-200 divide-y divide-slate-100">
                {found.map(x => (
                  <button key={x.id} type="button" onClick={() => { setStaffIds([...staffIds, x.id]); setQ('') }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                    {pname(x)} <span className="text-slate-400 text-[12px]">{x.position || ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button type="button" onClick={p.onClose} className="btn-secondary">Отказ</button>
          <button type="button" onClick={create} disabled={busy || !tpl} className="btn-primary inline-flex items-center gap-1.5">
            {busy && <Loader2 size={14} className="animate-spin" />} Създай и попълни протокола
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Настройки: шаблони и проверяващи ──────────────────────────────────────
// Критериите се пишат като текст: ред с „# “ е група, всеки следващ ред — критерий.
const toText = (g: CriteriaGroup[]) => g.map(x => [`# ${x.g}`, ...x.items.map(i => i.t)].join('\n')).join('\n\n')
function fromText(s: string, old: CriteriaGroup[]): CriteriaGroup[] {
  const byText = new Map<string, string>()
  old.forEach(g => g.items.forEach(i => byText.set(i.t, i.k)))
  const out: CriteriaGroup[] = []
  let n = 0
  s.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
    if (l.startsWith('#')) { out.push({ g: l.replace(/^#+\s*/, ''), items: [] }); return }
    if (!out.length) out.push({ g: 'Критерии', items: [] })
    const k = byText.get(l) || `k${Date.now().toString(36)}${n++}`
    out[out.length - 1].items.push({ k, t: l })
  })
  return out
}

function SettingsTab(p: Parameters<typeof ControlClient>[0]) {
  const router = useRouter()
  const { toast } = useToast()
  const [edit, setEdit] = useState<ControlTemplate | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const supabase = createClient()
  const candidates = p.people.filter(x => x.role === 'admin' || p.inspectorIds.includes(x.id))

  async function toggleInspector(id: string, on: boolean) {
    const { error } = await supabase.rpc('control_set_inspector', { p_staff: id, p_on: on })
    if (error) toast(error.message, 'error'); else router.refresh()
  }
  async function save() {
    if (!edit) return
    setBusy(true)
    const row = { name: edit.name, subject: edit.subject, purpose: edit.purpose, method: edit.method, kind: edit.kind, focus: edit.focus, form: edit.form, is_active: edit.is_active, criteria: fromText(text, edit.criteria) }
    const { error } = edit.id ? await supabase.from('control_templates').update(row).eq('id', edit.id) : await supabase.from('control_templates').insert({ ...row, sort: 95 })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    setEdit(null); router.refresh()
  }
  const open = (t: ControlTemplate) => { setEdit(t); setText(toText(t.criteria || [])) }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5">
      <section className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center mb-3">
          <h2 className="flex-1 text-[13px] uppercase tracking-wide text-slate-500">Шаблони на протоколите</h2>
          <button type="button" onClick={() => open({ id: '', code: null, name: 'Нов шаблон', kind: 'current', focus: 'pedagogical', form: 'current', subject: '', purpose: '', method: '', details: [], criteria: [], is_active: true, sort: 95 })}
            className="inline-flex items-center gap-1 text-sm text-indigo-700"><Plus size={14} /> Нов</button>
        </div>
        <div className="divide-y divide-slate-100">
          {p.templates.map(t => (
            <button key={t.id} type="button" onClick={() => open(t)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-slate-50 px-1 rounded-lg">
              <span className="flex-1">
                <span className={`block text-[14px] ${t.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{t.name}</span>
                <span className="block text-[12px] text-slate-500">{KIND_LABEL[t.kind]} · {FOCUS_LABEL[t.focus].toLowerCase()} · {(t.criteria || []).reduce((a, g) => a + g.items.length, 0)} критерия</span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="bg-white rounded-2xl border border-slate-200 p-4 h-fit">
        <h2 className="text-[13px] uppercase tracking-wide text-slate-500 mb-1">Проверяващи</h2>
        <p className="text-[12.5px] text-slate-500 mb-3">Директорът и ЗДУД са проверяващи по роля. Тук директорът добавя и други, например ЗДАСД.</p>
        {candidates.map(x => (
          <label key={x.id} className="flex items-center gap-2 py-1.5 text-sm text-slate-700">
            <input type="checkbox" disabled={!p.isDirector} checked={p.inspectorIds.includes(x.id)} onChange={e => toggleInspector(x.id, e.target.checked)} />
            {pname(x)} <span className="text-[12px] text-slate-400">{x.position || ''}</span>
          </label>
        ))}
        {!candidates.length && <p className="text-sm text-slate-400">Няма служители с роля „Администратор“.</p>}
      </section>

      {edit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center"><h3 className="flex-1 text-base text-slate-800">Шаблон</h3><button type="button" onClick={() => setEdit(null)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
            <input className="input w-full" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="Име" />
            <div className="grid grid-cols-3 gap-2">
              <select className="input" value={edit.kind} onChange={e => setEdit({ ...edit, kind: e.target.value as any })}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <select className="input" value={edit.focus} onChange={e => setEdit({ ...edit, focus: e.target.value as any })}>{Object.entries(FOCUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <select className="input" value={edit.form} onChange={e => setEdit({ ...edit, form: e.target.value as any })}>{Object.entries(FORM_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </div>
            <input className="input w-full" value={edit.subject || ''} onChange={e => setEdit({ ...edit, subject: e.target.value })} placeholder="Предмет (напр. наблюдение на учебен час)" />
            <input className="input w-full" value={edit.purpose || ''} onChange={e => setEdit({ ...edit, purpose: e.target.value })} placeholder="Цел" />
            <input className="input w-full" value={edit.method || ''} onChange={e => setEdit({ ...edit, method: e.target.value })} placeholder="Как се осъществява" />
            <label className="block">
              <span className="text-[12px] text-slate-500">Критерии: ред с „# “ е група, всеки следващ ред е критерий</span>
              <textarea className="input w-full font-mono text-[12.5px]" rows={12} value={text} onChange={e => setText(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={edit.is_active} onChange={e => setEdit({ ...edit, is_active: e.target.checked })} /> Активен</label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEdit(null)} className="btn-secondary">Отказ</button>
              <button type="button" onClick={save} disabled={busy} className="btn-primary">Запази</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
