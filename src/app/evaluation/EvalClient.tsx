'use client'
// Оценяване — начален екран: моите карти (запознаване, възражение), кампаниите, картите (шаблоните) и достъпът.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Award, Plus, Loader2, FileText, Settings, CheckCircle2, MessageSquareWarning, FileDown, ChevronRight, LayoutList,
  Trash2, Copy, ClipboardPaste, AlertTriangle, Save, ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast, confirmDialog } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import {
  CAMPAIGN_STATUS_LABEL, P_STATUS_LABEL, P_STATUS_TONE, GRP_LABEL, addWorkdays, isoOf, dmy, num, pname, groupSum, maxTotal,
  validateTemplate, campaignName, todayIso,
  type EvalTemplate, type EvalGroup, type Participant, type Grp, type Person,
} from '@/lib/evaluation'
import { generateCards } from '@/lib/docx-evaluation'

type CampaignRow = {
  id: string; name: string; status: 'setup' | 'scoring' | 'closed'; created_at: string; score_by: string | null
  year?: { name: string } | null; participants: { status: string; evaluator: string }[]
}
type MyCard = Participant & { campaign: { id: string; name: string; objection_days: number; year?: { name: string } | null } }
type Year = { id: string; name: string; is_current: boolean }
type Props = {
  me: { id: string; role: string; name: string }
  isDirector: boolean; isManager: boolean; isFinance: boolean; tab: string
  campaigns: CampaignRow[]; myCommission: { campaign_id: string; role: string }[]; cards: MyCard[]; years: Year[]
  templates: EvalTemplate[]; people: Person[]; access: { staff_id: string; kind: string }[]
}

const ACCENT = '#0f2240'

export default function EvalClient(p: Props) {
  const router = useRouter()
  const seesCampaigns = p.isManager || p.isFinance || p.myCommission.length > 0
  const tabs = [
    { k: 'mine', l: 'Моите карти', i: <Award size={14} />, n: p.cards.filter(c => c.status === 'sent').length },
    ...(seesCampaigns ? [{ k: 'campaigns', l: 'Кампании', i: <LayoutList size={14} />, n: 0 }] : []),
    ...(p.isManager ? [{ k: 'cards', l: 'Карти', i: <FileText size={14} />, n: 0 }] : []),
    ...(p.isDirector ? [{ k: 'access', l: 'Достъп', i: <Settings size={14} />, n: 0 }] : []),
  ]
  const tab = tabs.some(t => t.k === p.tab) ? p.tab : (seesCampaigns ? 'campaigns' : 'mine')
  const [creating, setCreating] = useState(false)

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <header className="flex flex-wrap items-center gap-4 mb-6 pb-5 border-b border-slate-100">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0"><Award size={22} /></div>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Оценяване</h1>
          <p className="text-sm text-slate-500 mt-0.5">ДТВ за постигнати резултати от труда — карти, комисия, протоколи и суми</p>
        </div>
        {p.isManager && (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-white" style={{ backgroundColor: ACCENT }}>
            <Plus size={15} /> Нова кампания
          </button>
        )}
      </header>

      {tabs.length > 1 && (
        <nav className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
          {tabs.map(t => (
            <button key={t.k} type="button" onClick={() => router.push(`/evaluation?tab=${t.k}`)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm ${tab === t.k ? 'bg-[#0f2240] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {t.i} {t.l}
              {!!t.n && <span className={`ml-0.5 text-[11px] min-w-5 px-1.5 rounded-full ${tab === t.k ? 'bg-white/20' : 'bg-rose-100 text-rose-700'}`}>{t.n}</span>}
            </button>
          ))}
        </nav>
      )}

      {tab === 'mine' && <MyCards cards={p.cards} />}
      {tab === 'campaigns' && <Campaigns {...p} />}
      {tab === 'cards' && <Templates {...p} />}
      {tab === 'access' && <Access {...p} />}
      {creating && <NewCampaign years={p.years} onClose={() => setCreating(false)} />}
    </div>
  )
}

// ── Моите карти ───────────────────────────────────────────────────────────
function MyCards({ cards }: { cards: MyCard[] }) {
  if (!cards.length) return <p className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-400 text-center">Нямате карти за оценка. Тук ще се появи картата ви, когато комисията я изпрати.</p>
  return <div className="space-y-4">{cards.map(c => <MyCardView key={c.id} c={c} />)}</div>
}

function MyCardView({ c }: { c: MyCard }) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(c.status === 'sent')
  const [objecting, setObjecting] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const objectDue = c.acked_at ? addWorkdays(isoOf(c.acked_at), c.campaign.objection_days) : null
  const canObject = c.status === 'sent' || (c.status === 'acked' && !!objectDue && todayIso() <= objectDue)

  async function ack(objection?: string) {
    if (objection !== undefined && !objection.trim()) { toast('Напишете мотивите за несъгласието', 'error'); return }
    setBusy(true)
    const { error } = await createClient().rpc('eval_ack', { p_participant: c.id, p_objection: objection ?? null })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast(objection ? 'Възражението е подадено до председателя на комисията' : 'Отбелязано: запознат/а сте с оценката')
    setObjecting(false); router.refresh()
  }
  async function download() {
    const supabase = createClient()
    const [{ data: tpl }, { data: members }] = await Promise.all([
      c.template_id ? supabase.from('eval_templates').select('*').eq('id', c.template_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('eval_commission').select('*, staff:staff_profiles(id, first_name, last_name, role, position)').eq('campaign_id', c.campaign_id),
    ])
    await generateCards({ campaign: c.campaign as any, yearName: c.campaign.year?.name, members: (members || []) as any }, [{ p: c, template: tpl as any }])
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex flex-wrap items-center gap-3 px-5 py-4 text-left">
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-medium text-slate-800">{c.campaign.name}</span>
          <span className="block text-[12.5px] text-slate-500">изпратена {dmy(isoOf(c.sent_at))}{c.acked_at ? ` · запознат/а ${dmy(isoOf(c.acked_at))}` : ''}</span>
        </span>
        <span className="text-xl font-semibold tabular-nums text-slate-800">{num(c.final_total)} <span className="text-sm font-normal text-slate-400">т.</span></span>
        <span className={`text-[12px] px-2 py-0.5 rounded-full ${P_STATUS_TONE[c.status]}`}>{P_STATUS_LABEL[c.status]}</span>
        <ChevronRight size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4">
          <ScoreTable criteria={c.criteria || []} scores={c.final_scores || {}} />
          {c.objection && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-800">
              <b>Вашето възражение</b> ({dmy(isoOf(c.objection_at))}): {c.objection}
              {c.decision && <div className="mt-2 text-slate-700"><b>Решение</b> ({dmy(isoOf(c.decided_at))}): {c.decision}{c.decision_changed ? ' — точките са променени.' : ''}</div>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {c.status === 'sent' && (
              <button type="button" disabled={busy} onClick={() => ack()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-white" style={{ backgroundColor: ACCENT }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Запознах се с оценката
              </button>
            )}
            {canObject && !objecting && (
              <button type="button" onClick={() => setObjecting(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border border-slate-200 text-slate-700 hover:bg-slate-50">
                <MessageSquareWarning size={15} /> Не съм съгласен/на
              </button>
            )}
            <button type="button" onClick={download} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border border-slate-200 text-slate-700 hover:bg-slate-50"><FileDown size={15} /> Картата (Word)</button>
          </div>
          {objecting && (
            <div className="space-y-2">
              <p className="text-[13px] text-slate-600">Възражението се подава писмено до председателя на комисията в срок до {c.campaign.objection_days} работни дни от запознаването{objectDue ? ` (до ${dmy(objectDue)})` : ''}. Посочете мотивите си. Решението на комисията е окончателно.</p>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={4} className="input w-full" placeholder="Не съм съгласен/на с оценката по … защото …" />
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => ack(text)} className="btn-primary">Подай възражението</button>
                <button type="button" onClick={() => setObjecting(false)} className="btn-secondary">Отказ</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Картата с точките — по показатели. */
export function ScoreTable({ criteria, scores }: { criteria: EvalGroup[]; scores: Record<string, number> }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left w-12">№</th><th className="px-3 py-2 text-left">Показатели и критерии</th><th className="px-3 py-2 w-20">Макс.</th><th className="px-3 py-2 w-20">Точки</th></tr></thead>
        <tbody>
          {criteria.map(g => [
            <tr key={g.n} className="bg-slate-50/60 font-medium text-slate-800 border-t border-slate-100"><td className="px-3 py-2">{g.n}</td><td className="px-3 py-2">{g.g}</td><td className="px-3 py-2 text-center tabular-nums">{num(g.max)}</td><td className="px-3 py-2 text-center tabular-nums">{num(groupSum(g, scores))}</td></tr>,
            ...g.items.map(it => <tr key={it.k} className="border-t border-slate-100 text-slate-700"><td className="px-3 py-1.5 text-slate-500">{it.k}</td><td className="px-3 py-1.5">{it.t}</td><td className="px-3 py-1.5 text-center tabular-nums text-slate-500">{num(it.max)}</td><td className="px-3 py-1.5 text-center tabular-nums">{num(scores[it.k])}</td></tr>),
          ])}
        </tbody>
      </table>
    </div>
  )
}

// ── Кампании ──────────────────────────────────────────────────────────────
function Campaigns(p: Props) {
  const roleIn = (id: string) => p.myCommission.find(m => m.campaign_id === id)?.role
  if (!p.campaigns.length) return <p className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-400 text-center">Няма кампании.{p.isManager ? ' Натиснете „Нова кампания“ — например „ДТВ за постигнати резултати 2025/2026“.' : ''}</p>
  return (
    <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
      {p.campaigns.map(c => {
        const n = c.participants.length
        const done = c.participants.filter(x => x.status !== 'pending').length
        const acked = c.participants.filter(x => ['acked', 'resolved'].includes(x.status)).length
        const obj = c.participants.filter(x => x.status === 'objected').length
        const r = roleIn(c.id)
        return (
          <Link key={c.id} href={`/evaluation/${c.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-slate-50">
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] text-slate-800">{c.name}</span>
              <span className="block text-[12.5px] text-slate-500">
                {CAMPAIGN_STATUS_LABEL[c.status]} · {n} оценявани · утвърдени {done}/{n} · запознати {acked}/{n}
                {c.score_by ? ` · оценяване до ${dmy(c.score_by)}` : ''}{r ? ` · вие сте ${r === 'chair' ? 'председател' : 'член'} на комисията` : ''}
              </span>
            </span>
            {obj > 0 && <span className="text-[12px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">{obj} възражения</span>}
            <span className={`text-[12px] px-2 py-0.5 rounded-full ${c.status === 'closed' ? 'bg-emerald-50 text-emerald-700' : c.status === 'scoring' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{CAMPAIGN_STATUS_LABEL[c.status]}</span>
            <ChevronRight size={16} className="text-slate-400" />
          </Link>
        )
      })}
    </div>
  )
}

function NewCampaign({ years, onClose }: { years: Year[]; onClose: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  // ДТВ се дава за изминалата учебна година — по подразбиране предходната спрямо текущата
  const cur = years.findIndex(y => y.is_current)
  const def = years[cur + 1] || years[cur] || years[0]
  const [yearId, setYearId] = useState(def?.id || '')
  const year = years.find(y => y.id === yearId)
  const [name, setName] = useState(campaignName(def?.name))
  const [busy, setBusy] = useState(false)
  async function create() {
    if (!name.trim()) return
    setBusy(true)
    const end = Number((year?.name || '').split(/[-/]/)[1]) || new Date().getFullYear()
    const { data, error } = await createClient().from('eval_campaigns').insert({
      name: name.trim(), academic_year_id: yearId || null, score_by: `${end}-10-01`, order_by: `${end}-10-30`,
    }).select('id').single()
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    router.push(`/evaluation/${data.id}?tab=setup`)
  }
  return (
    <Modal open onClose={onClose} title="Нова кампания за ДТВ">
      <div className="space-y-3">
        <label className="block"><span className="label">За учебната година</span>
          <select value={yearId} onChange={e => { setYearId(e.target.value); setName(campaignName(years.find(y => y.id === e.target.value)?.name)) }} className="input w-full">
            {years.map(y => <option key={y.id} value={y.id}>{y.name.replace('-', '/')}{y.is_current ? ' (текуща)' : ''}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">Име</span><input value={name} onChange={e => setName(e.target.value)} className="input w-full" /></label>
        <p className="text-[12.5px] text-slate-500">Сроковете се попълват по вътрешните правила (оценяване до 1 октомври, заповед до 30 октомври) и се променят в следващата стъпка.</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Отказ</button>
          <button type="button" disabled={busy} onClick={create} className="btn-primary">{busy ? 'Създаване…' : 'Създай'}</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Карти (шаблони) ───────────────────────────────────────────────────────
const ROLE_OPTIONS: { k: string; l: string }[] = [
  { k: 'class_teacher', l: 'Учител (класен)' }, { k: 'teacher', l: 'Учител' }, { k: 'educator', l: 'Възпитател' },
  { k: 'speech_therapist', l: 'Логопед' }, { k: 'psychologist', l: 'Психолог' }, { k: 'rehabilitator', l: 'Рехабилитатор / терапевт' },
  { k: 'zdud', l: 'ЗДУД' }, { k: 'admin', l: 'Администратор' }, { k: 'secretary', l: 'Секретар' }, { k: 'support', l: 'Помощен персонал' },
]

function Templates(p: Props) {
  const [sel, setSel] = useState<string | null>(p.templates[0]?.id || null)
  const [draft, setDraft] = useState<EvalTemplate | null>(null)
  const current = draft || p.templates.find(t => t.id === sel) || null
  const blank = (): EvalTemplate => ({
    id: '', code: null, kind: 'dtv', grp: 'ped', name: 'ДТВ — педагогически специалисти', col_label: 'Показатели и критерии',
    title: 'ЗА ОПРЕДЕЛЯНЕ НА ДОПЪЛНИТЕЛНО ТРУДОВО ВЪЗНАГРАЖДЕНИЕ ЗА ПОСТИГНАТИ РЕЗУЛТАТИ ОТ ТРУДА НА ПЕДАГОГИЧЕСКИТЕ СПЕЦИАЛИСТИ',
    adopted: 'Приета с решение на Педагогическия съвет, Протокол № ……… от ……………… г.', roles: ['class_teacher', 'teacher', 'educator', 'speech_therapist', 'psychologist'],
    criteria: [], base: null, total: 100, is_active: true, sort: 10,
  })
  const hasPed = p.templates.some(t => t.kind === 'dtv' && t.grp === 'ped' && t.is_active)
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        {!hasPed && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[12.5px] px-3 py-2">
            Няма карта за педагогическите специалисти (Приложение № 4). Натиснете „Нова карта“ и поставете таблицата от Word.
          </div>
        )}
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {p.templates.map(t => (
            <button key={t.id} type="button" onClick={() => { setDraft(null); setSel(t.id) }}
              className={`w-full text-left px-4 py-3 ${sel === t.id && !draft ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}>
              <span className="block text-[14px] text-slate-800">{t.name}</span>
              <span className="block text-[12px] text-slate-500">{GRP_LABEL[t.grp]} · {num(maxTotal(t.criteria))} т.{t.is_active ? '' : ' · неактивна'}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setDraft(blank())} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 bg-white hover:bg-slate-50"><Plus size={14} /> Нова карта</button>
          {current && current.id && (
            <button type="button" onClick={() => setDraft({ ...current, id: '', code: null, name: `${current.name} (копие)` })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 bg-white hover:bg-slate-50" title="Копие"><Copy size={14} /></button>
          )}
        </div>
      </div>
      {current ? <TemplateEditor key={current.id || 'new'} t={current} onSaved={id => { setDraft(null); setSel(id) }} /> : <div />}
    </div>
  )
}

/** Таблица, поставена от Word/Excel: „1 ⇥ Показател ⇥ 14“, „1.1 ⇥ Критерий ⇥ 4“ */
function parsePasted(text: string): EvalGroup[] {
  const out: EvalGroup[] = []
  let pending: { k: string; t: string; max?: number } | null = null
  const flush = () => {
    if (!pending) return
    const { k, t, max } = pending
    if (k.includes('.')) out[out.length - 1]?.items.push({ k, t: t.trim(), max: Number(max || 0) })
    else out.push({ n: k, g: t.trim(), max: Number(max || 0), items: [] })
    pending = null
  }
  text.split(/\r?\n/).forEach(line => {
    const cells = line.split('\t').map(s => s.trim()).filter(Boolean)
    if (!cells.length) return
    const m = cells[0].match(/^(\d+(?:\.\d+)?)\.?$/)
    if (m) {
      flush()
      const last = cells[cells.length - 1].replace(',', '.')
      const max = cells.length >= 3 && /^\d+(\.\d+)?$/.test(last) ? Number(last) : undefined
      pending = { k: m[1], t: cells.slice(1, max !== undefined ? -1 : undefined).join(' '), max }
    } else if (pending) {
      const last = cells[cells.length - 1].replace(',', '.')
      if (/^\d+(\.\d+)?$/.test(last) && pending.max === undefined) { pending.max = Number(last); cells.pop() }
      pending.t += ' ' + cells.join(' ')
    }
  })
  flush()
  return out.filter(g => !/общ брой/i.test(g.g))
}

function TemplateEditor({ t, onSaved }: { t: EvalTemplate; onSaved: (id: string) => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const [d, setD] = useState<EvalTemplate>(() => JSON.parse(JSON.stringify(t)))
  const [busy, setBusy] = useState(false)
  const [paste, setPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const errs = useMemo(() => validateTemplate(d), [d])
  const set = (patch: Partial<EvalTemplate>) => setD(x => ({ ...x, ...patch }))
  const setGroup = (gi: number, patch: Partial<EvalGroup>) => set({ criteria: d.criteria.map((g, i) => (i === gi ? { ...g, ...patch } : g)) })
  const setItem = (gi: number, ii: number, patch: any) => setGroup(gi, { items: d.criteria[gi].items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) })
  const renumber = (c: EvalGroup[]) => c.map((g, i) => ({ ...g, n: String(i + 1), items: g.items.map((it, j) => ({ ...it, k: `${i + 1}.${j + 1}` })) }))

  async function save(asBase: boolean) {
    if (errs.length && !(await confirmDialog(`Картата има забележки:\n${errs.join('\n')}\n\nЗапис въпреки това?`))) return
    setBusy(true)
    const row: any = {
      kind: d.kind, grp: d.grp, name: d.name.trim(), title: d.title, adopted: d.adopted, col_label: d.col_label, roles: d.roles,
      criteria: d.criteria, total: d.total, is_active: d.is_active, sort: d.sort, updated_at: new Date().toISOString(),
      ...(asBase || !d.base ? { base: d.criteria } : {}),
    }
    const supabase = createClient()
    const res = d.id ? await supabase.from('eval_templates').update(row).eq('id', d.id).select('id').single() : await supabase.from('eval_templates').insert(row).select('id').single()
    setBusy(false)
    if (res.error) { toast(res.error.message, 'error'); return }
    toast(asBase ? 'Картата е записана като новоприета (основа за корекцията до 20%)' : 'Картата е записана')
    onSaved(res.data.id); router.refresh()
  }
  async function remove() {
    if (!d.id || !(await confirmDialog('Да се изтрие ли картата? Кампаниите, които вече я ползват, пазят свое копие.'))) return
    const { error } = await createClient().from('eval_templates').delete().eq('id', d.id)
    if (error) { toast(error.message, 'error'); return }
    router.refresh(); onSaved('')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block"><span className="label">Име в системата</span><input value={d.name} onChange={e => set({ name: e.target.value })} className="input w-full" /></label>
        <label className="block"><span className="label">Група (фонд)</span>
          <select value={d.grp} onChange={e => set({ grp: e.target.value as Grp })} className="input w-full">
            <option value="ped">{GRP_LABEL.ped}</option><option value="nonped">{GRP_LABEL.nonped}</option>
          </select>
        </label>
        <label className="block md:col-span-2"><span className="label">Заглавие в картата (след „КАРТА“)</span><input value={d.title} onChange={e => set({ title: e.target.value })} className="input w-full" /></label>
        <label className="block md:col-span-2"><span className="label">Приета с…</span><input value={d.adopted || ''} onChange={e => set({ adopted: e.target.value })} className="input w-full" /></label>
        <div className="md:col-span-2">
          <span className="label">Предлага се по подразбиране за</span>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_OPTIONS.map(r => (
              <button key={r.k} type="button" onClick={() => set({ roles: d.roles.includes(r.k) ? d.roles.filter(x => x !== r.k) : [...d.roles, r.k] })}
                className={`px-2.5 py-1 rounded-lg text-[12.5px] border ${d.roles.includes(r.k) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>{r.l}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-medium text-slate-800 flex-1">Показатели и критерии · {num(maxTotal(d.criteria))} от {num(d.total)} т.</span>
        <button type="button" onClick={() => setPaste(x => !x)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] border border-slate-200 hover:bg-slate-50"><ClipboardPaste size={14} /> Постави таблица от Word</button>
      </div>
      {paste && (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="text-[12.5px] text-slate-600">Копирайте редовете на таблицата от Word (колони №, текст, точки) и ги поставете тук. Редовете с „1“, „2“… стават показатели, с „1.1“, „1.2“… — критерии.</p>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={6} className="input w-full font-mono text-[12px]" />
          <button type="button" onClick={() => { const c = parsePasted(pasteText); if (!c.length) { toast('Не разпознах редове с номера', 'error'); return } set({ criteria: c }); setPaste(false); toast(`Разпознати ${c.length} показателя и ${c.reduce((a, g) => a + g.items.length, 0)} критерия`) }} className="btn-primary">Разпознай</button>
        </div>
      )}

      <div className="space-y-3">
        {d.criteria.map((g, gi) => {
          const b = d.base?.find(x => x.n === g.n)
          return (
            <div key={gi} className="rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-t-xl">
                <span className="w-8 text-[13px] font-medium text-slate-600">{g.n}</span>
                <input value={g.g} onChange={e => setGroup(gi, { g: e.target.value })} className="input flex-1 font-medium" />
                <input type="number" min={0} step={0.5} value={g.max} onChange={e => setGroup(gi, { max: Number(e.target.value) })} className="input w-20 text-center" title="Максимум точки за показателя" />
                {b && b.max !== g.max && <span className="text-[11.5px] text-slate-500 whitespace-nowrap">приет: {num(b.max)}</span>}
                <button type="button" onClick={() => set({ criteria: renumber(d.criteria.filter((_, i) => i !== gi)) })} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
              </div>
              <div className="divide-y divide-slate-100">
                {g.items.map((it, ii) => (
                  <div key={ii} className="flex items-start gap-2 px-3 py-1.5">
                    <span className="w-8 pt-2 text-[12.5px] text-slate-500">{it.k}</span>
                    <textarea value={it.t} onChange={e => setItem(gi, ii, { t: e.target.value })} rows={1} className="input flex-1 text-[13px] min-h-[38px]" />
                    <input type="number" min={0} step={0.5} value={it.max} onChange={e => setItem(gi, ii, { max: Number(e.target.value) })} className="input w-20 text-center" />
                    <button type="button" onClick={() => setGroup(gi, { items: g.items.filter((_, j) => j !== ii).map((x, j) => ({ ...x, k: `${g.n}.${j + 1}` })) })} className="p-1.5 pt-2.5 text-slate-400 hover:text-rose-600"><Trash2 size={13} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setGroup(gi, { items: [...g.items, { k: `${g.n}.${g.items.length + 1}`, t: '', max: 1 }] })} className="w-full text-left px-3 py-2 text-[12.5px] text-indigo-700 hover:bg-slate-50">+ критерий</button>
              </div>
            </div>
          )
        })}
        <button type="button" onClick={() => set({ criteria: [...d.criteria, { n: String(d.criteria.length + 1), g: '', max: 0, items: [] }] })} className="text-[13px] text-indigo-700">+ показател</button>
      </div>

      {errs.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[12.5px] px-3 py-2 space-y-0.5">
          {errs.map((e, i) => <div key={i} className="flex gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{e}</div>)}
        </div>
      )}
      <label className="flex items-center gap-2 text-[13px] text-slate-600"><input type="checkbox" checked={d.is_active} onChange={e => set({ is_active: e.target.checked })} /> Активна (предлага се в новите кампании)</label>
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" disabled={busy} onClick={() => save(false)} className="btn-primary inline-flex items-center gap-1.5"><Save size={14} /> Запиши</button>
        {d.id && <button type="button" disabled={busy} onClick={() => save(true)} className="btn-secondary" title="След ново решение на ПС/ОС — текущите точки стават основа за правилото до 20%">Запиши като новоприета</button>}
        {d.id && <button type="button" onClick={remove} className="btn-secondary text-rose-700 ml-auto"><Trash2 size={14} className="inline" /> Изтрий</button>}
      </div>
    </div>
  )
}

// ── Достъп ────────────────────────────────────────────────────────────────
function Access(p: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const has = (id: string, k: string) => p.access.some(a => a.staff_id === id && a.kind === k)
  async function toggle(id: string, k: string) {
    const { error } = await createClient().rpc('eval_set_access', { p_staff: id, p_kind: k, p_on: !has(id, k) })
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  const list = p.people.filter(x => x.role !== 'director' && (!q.trim() || pname(x).toLowerCase().includes(q.trim().toLowerCase())))
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 text-[13px] text-slate-600 space-y-1">
        <p><ShieldCheck size={14} className="inline mr-1 text-indigo-600" /><b>Организатор</b> — създава кампании, комисия и карти. ЗДУД и администраторите са организатори по роля.</p>
        <p><ShieldCheck size={14} className="inline mr-1 text-emerald-600" /><b>Суми</b> — вижда и въвежда фондовете, отработените дни и сумите (напр. счетоводителят). Другите не виждат сумите.</p>
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси служител" className="input w-64" />
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {list.map(x => (
          <div key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <span className="flex-1 min-w-0 text-[14px] text-slate-800">{pname(x)} <span className="text-[12px] text-slate-500">{x.position || ''}</span></span>
            {!['zdud', 'admin'].includes(x.role) && (
              <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={has(x.id, 'manager')} onChange={() => toggle(x.id, 'manager')} /> Организатор</label>
            )}
            <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={has(x.id, 'finance')} onChange={() => toggle(x.id, 'finance')} /> Суми</label>
          </div>
        ))}
      </div>
    </div>
  )
}

