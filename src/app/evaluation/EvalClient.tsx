'use client'
// Оценяване — начален екран: моите карти (самооценка, портфолио, запознаване, възражение), кампаниите,
// картите (шаблоните), регистърът (атестиране на 4 години, история по служители) и достъпът.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Award, Plus, Loader2, FileText, Settings, CheckCircle2, MessageSquareWarning, FileDown, ChevronRight, LayoutList,
  Trash2, Copy, ClipboardPaste, AlertTriangle, Save, ShieldCheck, BookMarked, Upload, Paperclip, FileSpreadsheet, Send,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast, confirmDialog } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import {
  CAMPAIGN_STATUS_LABEL, P_STATUS_LABEL, P_STATUS_TONE, GRP_LABEL, KIND_LABEL, KIND_SHORT, addWorkdays, isoOf, dmy, num, pname, groupSum, maxTotal,
  validateTemplate, campaignName, todayIso, sumScores, scoresComplete, finalGrade, addYears, daysLeft, ATTEST_ROLES, ATTEST_YEARS,
  EDU_LEVELS, PKS_LEVELS, DEFAULT_SCALE,
  type EvalTemplate, type EvalGroup, type Participant, type Grp, type Person, type Kind, type Scores, type SectionA, type ScaleStep,
  type EvalFile, type History,
} from '@/lib/evaluation'
import { generateCards, exportRegistryExcel, type RegistryRow } from '@/lib/docx-evaluation'

type CampaignRow = {
  id: string; name: string; kind: Kind; status: 'setup' | 'scoring' | 'closed'; created_at: string; score_by: string | null; closed_at: string | null
  year?: { name: string } | null; participants: { status: string; evaluator: string }[]
}
type MyCampaign = {
  id: string; name: string; kind: Kind; status: string; self_assess: boolean; self_by: string | null; objection_days: number
  period_from: string | null; period_to: string | null; scale: ScaleStep[] | null; year?: { name: string } | null
}
type MyCard = Participant & { campaign: MyCampaign }
type Year = { id: string; name: string; is_current: boolean; start_date?: string | null }
type Result = {
  id: string; staff_id: string; campaign_id: string; final_total: number | null; result: number | null; grade: string | null; employer_grade: string | null
  status: string; finalized_at: string | null; acked_at: string | null; employer_at: string | null
  campaign: { id: string; name: string; kind: Kind; status: string; created_at: string; closed_at: string | null } | null
}
type Props = {
  me: { id: string; role: string; name: string }
  isDirector: boolean; isManager: boolean; isFinance: boolean; tab: string; isSecretaryAny: boolean
  campaigns: CampaignRow[]; myCommission: { campaign_id: string; role: string }[]; cards: MyCard[]; years: Year[]
  templates: EvalTemplate[]; people: Person[]; access: { staff_id: string; kind: string }[]
  myFiles: EvalFile[]; results: Result[]; history: History[]; supports: { participant_id: string; status: string; reattest_by: string | null }[]
}

const ACCENT = '#0f2240'

export default function EvalClient(p: Props) {
  const router = useRouter()
  const seesCampaigns = p.isManager || p.isFinance || p.myCommission.length > 0 || p.isSecretaryAny
  const todo = p.cards.filter(c => c.status === 'sent' || (c.campaign?.self_assess && c.campaign.status === 'scoring' && c.status === 'pending' && !c.self_at)).length
  const tabs = [
    { k: 'mine', l: 'Моите карти', i: <Award size={14} />, n: todo },
    ...(seesCampaigns ? [{ k: 'campaigns', l: 'Кампании', i: <LayoutList size={14} />, n: 0 }] : []),
    ...(p.isManager ? [{ k: 'cards', l: 'Карти', i: <FileText size={14} />, n: 0 }] : []),
    ...(p.isManager ? [{ k: 'registry', l: 'Регистър', i: <BookMarked size={14} />, n: 0 }] : []),
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
          <p className="text-sm text-slate-500 mt-0.5">ДТВ, атестиране и други оценки — карти, самооценка, комисия, протоколи, суми и регистър</p>
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

      {tab === 'mine' && <MyCards {...p} />}
      {tab === 'campaigns' && <Campaigns {...p} />}
      {tab === 'cards' && <Templates {...p} />}
      {tab === 'registry' && <Registry {...p} />}
      {tab === 'access' && <Access {...p} />}
      {creating && <NewCampaign years={p.years} onClose={() => setCreating(false)} />}
    </div>
  )
}

// ── Моите карти ───────────────────────────────────────────────────────────
function MyCards(p: Props) {
  // карти в подготовка (утвърдени, но неизпратени) не се показват — лицето вижда само самооценката си
  const cards = p.cards.filter(c => c.campaign && (c.sent_at || (c.campaign.self_assess && c.campaign.status !== 'setup')))
  if (!cards.length) return <p className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-400 text-center">Нямате карти за оценка. Тук ще се появи картата ви — за самооценка (при атестиране) или когато комисията я изпрати.</p>
  return <div className="space-y-4">{cards.map(c => <MyCardView key={c.id} c={c} me={p.me} template={p.templates.find(t => t.id === c.template_id) || null} files={p.myFiles.filter(f => f.participant_id === c.id)} />)}</div>
}

function MyCardView({ c, me, template, files }: { c: MyCard; me: Props['me']; template: EvalTemplate | null; files: EvalFile[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const k = c.campaign.kind || 'dtv'
  const isAttest = k === 'attest'
  const selfOpen = c.campaign.self_assess && c.campaign.status === 'scoring' && c.status === 'pending'
  const [open, setOpen] = useState(c.status === 'sent' || (selfOpen && !c.self_at))
  const [objecting, setObjecting] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const objectDue = c.acked_at ? addWorkdays(isoOf(c.acked_at), c.campaign.objection_days) : null
  const canObject = c.status === 'sent' || (c.status === 'acked' && !!objectDue && todayIso() <= objectDue)
  const shown = !!c.sent_at

  async function ack(objection?: string) {
    if (objection !== undefined && !objection.trim()) { toast('Напишете мотивите за несъгласието', 'error'); return }
    setBusy(true)
    const { error } = await createClient().rpc('eval_ack', { p_participant: c.id, p_objection: objection ?? null })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast(objection ? (isAttest ? 'Възражението е подадено до работодателя (директора)' : 'Възражението е подадено до председателя на комисията') : 'Отбелязано: запознат/а сте с оценката')
    setObjecting(false); router.refresh()
  }
  async function download() {
    const supabase = createClient()
    const [{ data: members }, { data: externals }] = await Promise.all([
      supabase.from('eval_commission').select('*, staff:staff_profiles(id, first_name, last_name, role, position)').eq('campaign_id', c.campaign_id),
      supabase.from('eval_external').select('*').eq('campaign_id', c.campaign_id),
    ])
    const card = shown ? c : { ...c, final_scores: null, final_total: null, result: null, grade: null, finalized_at: null }
    await generateCards({ campaign: c.campaign as any, yearName: c.campaign.year?.name, members: (members || []) as any, externals: (externals || []) as any }, [{ p: card, template }])
  }
  const g = finalGrade(c)
  const head = !shown
    ? (c.self_at ? `самооценка подадена ${dmy(isoOf(c.self_at))} · комисията оценява` : `самооценка${c.campaign.self_by ? ` до ${dmy(c.campaign.self_by)}` : ''}`)
    : `изпратена ${dmy(isoOf(c.sent_at))}${c.acked_at ? ` · запознат/а ${dmy(isoOf(c.acked_at))}` : ''}`

  return (
    <div className="bg-white rounded-2xl border border-slate-200">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex flex-wrap items-center gap-3 px-5 py-4 text-left">
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-medium text-slate-800">{c.campaign.name}</span>
          <span className="block text-[12.5px] text-slate-500">{head}</span>
        </span>
        {shown && (isAttest
          ? <span className="text-right"><span className="block text-xl font-semibold tabular-nums text-slate-800">{num(c.result)}</span><span className="block text-[12px] text-slate-500">{g}</span></span>
          : <span className="text-xl font-semibold tabular-nums text-slate-800">{num(c.final_total)} <span className="text-sm font-normal text-slate-400">т.</span></span>)}
        {shown
          ? <span className={`text-[12px] px-2 py-0.5 rounded-full ${P_STATUS_TONE[c.status]}`}>{P_STATUS_LABEL[c.status]}</span>
          : <span className={`text-[12px] px-2 py-0.5 rounded-full ${c.self_at ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{c.self_at ? 'самооценката е подадена' : 'попълнете самооценката'}</span>}
        <ChevronRight size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4">
          {!shown && <SelfForm c={c} me={me} template={template} files={files} editable={selfOpen} />}
          {shown && <>
            {isAttest && (
              <div className="grid gap-2 sm:grid-cols-4 text-[13px]">
                <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-[11.5px] text-slate-500">Самооценка (СО)</div><b className="tabular-nums">{num(c.self_total)}</b></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-[11.5px] text-slate-500">Оценка на комисията (ОАК)</div><b className="tabular-nums">{num(c.final_total)}</b></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-[11.5px] text-slate-500">ОР = 0,25·СО + 0,75·ОАК</div><b className="tabular-nums">{num(c.result)}</b></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-[11.5px] text-slate-500">Крайна оценка</div><b>{g}</b></div>
              </div>
            )}
            <ScoreTable criteria={c.criteria || []} scores={c.final_scores || {}} self={c.campaign.self_assess ? c.self_scores || {} : undefined} />
            {c.commission_comment && <p className="text-[13.5px] text-slate-700"><b>Коментар на комисията:</b> {c.commission_comment}</p>}
            {c.objection && (
              <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-800">
                <b>Вашето възражение</b> ({dmy(isoOf(c.objection_at))}): {c.objection}
                {c.decision && <div className="mt-2 text-slate-700"><b>Решение</b> ({dmy(isoOf(c.decided_at))}): {c.decision}{c.decision_changed ? (isAttest ? ` — крайната оценка е „${c.employer_grade}“.` : ' — точките са променени.') : ''}</div>}
              </div>
            )}
            {isAttest && c.employer_at && !c.objection && <p className="text-[13.5px] text-slate-700"><b>Коментар на работодателя</b> ({dmy(isoOf(c.employer_at))}): „{c.employer_grade}“. {c.employer_note}</p>}
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
                <p className="text-[13px] text-slate-600">{isAttest
                  ? `Възражението се подава писмено до работодателя (директора) в срок до ${c.campaign.objection_days} работни дни от запознаването${objectDue ? ` (до ${dmy(objectDue)})` : ''}. Работодателят може да потвърди или да промени крайната оценка с една степен.`
                  : `Възражението се подава писмено до председателя на комисията в срок до ${c.campaign.objection_days} работни дни от запознаването${objectDue ? ` (до ${dmy(objectDue)})` : ''}. Посочете мотивите си. Решението на комисията е окончателно.`}</p>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={4} className="input w-full" placeholder="Не съм съгласен/на с оценката по … защото …" />
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => ack(text)} className="btn-primary">Подай възражението</button>
                  <button type="button" onClick={() => setObjecting(false)} className="btn-secondary">Отказ</button>
                </div>
              </div>
            )}
          </>}
        </div>
      )}
    </div>
  )
}

/** Самооценка: раздел А (атестиране), точките по критериите и портфолиото. */
function SelfForm({ c, me, template, files, editable }: { c: MyCard; me: Props['me']; template: EvalTemplate | null; files: EvalFile[]; editable: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const isAttest = c.campaign.kind === 'attest'
  const crit = c.criteria || template?.criteria || []
  const [s, setS] = useState<Scores>(() => ({ ...(c.self_scores || {}) }))
  const [a, setA] = useState<SectionA>(() => ({ ...(c.section_a || {}) }))
  const [busy, setBusy] = useState(false)
  const [guide, setGuide] = useState(false)
  const setOne = (k: string, v: string) => setS(x => { const n = { ...x }; if (v === '') delete n[k]; else n[k] = Number(v); return n })
  const setA1 = (patch: Partial<SectionA>) => setA(x => ({ ...x, ...patch }))
  const intOr = (v: string) => (v === '' ? null : Number(v))
  async function save(submit: boolean) {
    if (submit && !scoresComplete(crit, s)) { toast('Попълнете точките по всички критерии (между 0 и максимума)', 'error'); return }
    if (submit && !(await confirmDialog('Да се подаде ли самооценката? Можете да я поправяте, докато комисията не утвърди оценката.'))) return
    setBusy(true)
    const { error } = await createClient().rpc('eval_self', { p_participant: c.id, p_scores: s, p_section_a: isAttest ? a : null, p_submit: submit })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast(submit ? 'Самооценката е подадена' : 'Черновата е запазена'); router.refresh()
  }
  async function upload(list: FileList) {
    setBusy(true)
    const supabase = createClient()
    for (const file of Array.from(list)) {
      const path = `${c.campaign_id}/p/${c.id}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, '_')}`
      const { error } = await supabase.storage.from('evaluation').upload(path, file)
      if (error) { toast(error.message, 'error'); continue }
      const { error: e2 } = await supabase.from('eval_files').insert({ participant_id: c.id, name: file.name, path, uploaded_by: me.id })
      if (e2) toast(e2.message, 'error')
    }
    setBusy(false); router.refresh()
  }
  async function openFile(f: EvalFile) {
    const { data, error } = await createClient().storage.from('evaluation').createSignedUrl(f.path, 600)
    if (error || !data) { toast(error?.message || 'Файлът не може да се отвори', 'error'); return }
    window.open(data.signedUrl, '_blank')
  }
  async function remove(f: EvalFile) {
    if (!(await confirmDialog(`Да се изтрие ли „${f.name}“?`))) return
    const supabase = createClient()
    await supabase.storage.from('evaluation').remove([f.path])
    const { error } = await supabase.from('eval_files').delete().eq('id', f.id)
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }
  const left = c.campaign.self_by ? daysLeft(c.campaign.self_by) : null
  let lastH = ''
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-[13px] text-indigo-900">
        {isAttest
          ? 'Попълнете раздел А, оценете се по всеки критерий и прикачете професионалното си портфолио. Самооценката (СО) влиза с тежест 25% в окончателния резултат; комисията оценява самостоятелно (75%).'
          : 'Оценете се по всеки критерий. Комисията вижда самооценката ви при оценяването.'}
        {left != null && editable && <span className={left < 0 ? ' text-rose-700' : ''}> Срок: {dmy(c.campaign.self_by)}{left < 0 ? ' (изтекъл)' : ` (остават ${left} дни)`}.</span>}
        {!editable && <span> Самооценката вече не може да се променя.</span>}
      </div>
      {isAttest && (
        <section className="space-y-2">
          <div className="text-[14px] font-medium text-slate-800">А. Съответствие с изискванията на длъжността</div>
          <div className="grid gap-2 md:grid-cols-2 text-[13px]">
            <label className="block"><span className="label">1.1 Образование — първоначално</span>
              <select value={a.edu1 || ''} disabled={!editable} onChange={e => setA1({ edu1: e.target.value })} className="input w-full"><option value="">—</option>{EDU_LEVELS.map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="block"><span className="label">1.2 Друго след първоначалното</span>
              <select value={a.edu2 || ''} disabled={!editable} onChange={e => setA1({ edu2: e.target.value })} className="input w-full"><option value="">—</option>{EDU_LEVELS.map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="block md:col-span-2"><span className="label">2.1 Специалност по базовото висше образование</span><input value={a.specialty || ''} disabled={!editable} onChange={e => setA1({ specialty: e.target.value })} className="input w-full" /></label>
            <label className="block"><span className="label">2.2 Професионална квалификация „учител“</span>
              <select value={a.teacher_q || ''} disabled={!editable} onChange={e => setA1({ teacher_q: (e.target.value || undefined) as any })} className="input w-full"><option value="">—</option><option value="yes">Да</option><option value="no">Не</option></select></label>
            <label className="block"><span className="label">2.3 Друга (нова/допълнителна) квалификация</span>
              <div className="flex gap-2"><select value={a.other_q || ''} disabled={!editable} onChange={e => setA1({ other_q: (e.target.value || undefined) as any })} className="input w-24"><option value="">—</option><option value="yes">Да</option><option value="no">Не</option></select>
                {a.other_q === 'yes' && <input value={a.other_q_text || ''} disabled={!editable} onChange={e => setA1({ other_q_text: e.target.value })} placeholder="каква" className="input flex-1" />}</div></label>
            <label className="block"><span className="label">3. Последна придобита ПКС</span>
              <select value={a.pks || ''} disabled={!editable} onChange={e => setA1({ pks: e.target.value })} className="input w-full"><option value="">—</option>{PKS_LEVELS.map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="block"><span className="label">4. Стаж — общ / учителски (години)</span>
              <div className="flex gap-2"><input type="number" value={a.years_total ?? ''} disabled={!editable} onChange={e => setA1({ years_total: intOr(e.target.value) })} className="input w-full" /><input type="number" value={a.years_teacher ?? ''} disabled={!editable} onChange={e => setA1({ years_teacher: intOr(e.target.value) })} className="input w-full" /></div></label>
            <label className="block"><span className="label">5.1 Вътрешноинституционална квалификация (акад. часа)</span><input type="number" value={a.hours_internal ?? ''} disabled={!editable} onChange={e => setA1({ hours_internal: intOr(e.target.value) })} className="input w-full" /></label>
            <label className="block"><span className="label">5.2 Задължителни часове / кредити</span>
              <div className="flex gap-2"><input type="number" value={a.hours_mandatory ?? ''} disabled={!editable} onChange={e => setA1({ hours_mandatory: intOr(e.target.value) })} placeholder="часа" className="input w-full" /><input type="number" value={a.credits ?? ''} disabled={!editable} onChange={e => setA1({ credits: intOr(e.target.value) })} placeholder="кредита" className="input w-full" /></div></label>
            <label className="block"><span className="label">6. Изпълнение на препоръките от последното атестиране</span>
              <select value={a.prev_recs || ''} disabled={!editable} onChange={e => setA1({ prev_recs: (e.target.value || undefined) as any })} className="input w-full"><option value="">—</option><option value="yes">Да</option><option value="no">Не</option><option value="na">Не съм атестиран/а досега</option></select></label>
          </div>
        </section>
      )}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="text-[14px] font-medium text-slate-800 flex-1">{isAttest ? 'Б. Самооценка по критериите' : 'Самооценка'} · {num(sumScores(crit, s))} от {num(maxTotal(crit))} т.</div>
          {template?.guide && <button type="button" onClick={() => setGuide(v => !v)} className="text-[12.5px] text-indigo-700">{guide ? 'Скрий скалата' : 'Скала за точките'}</button>}
        </div>
        {guide && template?.guide && <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-[12.5px] text-slate-700 space-y-1.5 max-h-72 overflow-y-auto">{template.guide.split('\n').filter(Boolean).map((l, i) => <p key={i} className={/^\d,\d/.test(l) ? '' : 'font-medium'}>{l}</p>)}</div>}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left w-14">№</th><th className="px-3 py-2 text-left">Критерии</th><th className="px-3 py-2 w-16">Макс.</th><th className="px-3 py-2 w-24">Самооценка</th></tr></thead>
            <tbody>
              {crit.map(g => {
                const h = g.h && g.h !== lastH ? g.h : null
                if (h) lastH = h
                return [
                  h ? <tr key={`h${g.n}`} className="bg-indigo-50/50 text-indigo-900"><td colSpan={4} className="px-3 py-1.5 font-medium">{h}</td></tr> : null,
                  <tr key={g.n} className="bg-slate-50/60 font-medium text-slate-800 border-t border-slate-100"><td className="px-3 py-2">{g.n}</td><td className="px-3 py-2">{g.g}</td><td className="px-3 py-2 text-center tabular-nums">{num(g.max)}</td><td className="px-3 py-2 text-center tabular-nums">{num(groupSum(g, s))}</td></tr>,
                  ...g.items.map(it => (
                    <tr key={it.k} className="border-t border-slate-100 text-slate-700 align-top">
                      <td className="px-3 py-1.5 text-slate-500">{it.k}</td><td className="px-3 py-1.5">{it.t}</td><td className="px-3 py-1.5 text-center tabular-nums text-slate-500">{num(it.max)}</td>
                      <td className="px-3 py-1 text-center">{editable
                        ? <input type="number" min={0} max={it.max} step="0.1" value={s[it.k] ?? ''} onChange={e => setOne(it.k, e.target.value === '' ? '' : String(Math.min(it.max, Math.max(0, Number(e.target.value)))))} className="w-16 px-1.5 py-1 rounded-lg border border-slate-300 text-center tabular-nums" />
                        : <span className="tabular-nums">{num(s[it.k])}</span>}</td>
                    </tr>
                  )),
                ]
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="space-y-2">
        <div className="text-[14px] font-medium text-slate-800">{isAttest ? 'Професионално портфолио' : 'Доказателства'}</div>
        {files.length ? files.map(f => (
          <div key={f.id} className="flex items-center gap-2 text-[13px]">
            <Paperclip size={13} className="text-slate-400" /><button type="button" onClick={() => openFile(f)} className="text-indigo-700 hover:underline truncate">{f.name}</button>
            <span className="text-[11.5px] text-slate-400">{dmy(isoOf(f.created_at))}</span>
            {editable && <button type="button" onClick={() => remove(f)} className="ml-auto p-1 text-slate-400 hover:text-rose-600"><Trash2 size={13} /></button>}
          </div>
        )) : <p className="text-[13px] text-slate-400">Няма прикачени файлове.{isAttest ? ' Портфолиото може да е и на хартия — предайте го на техническия секретар.' : ''}</p>}
        {editable && <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] border border-slate-200 hover:bg-slate-50 cursor-pointer">{busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Прикачи файлове<input type="file" multiple className="hidden" onChange={e => e.target.files?.length && upload(e.target.files)} /></label>}
      </section>
      {editable && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => save(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-white" style={{ backgroundColor: ACCENT }}><Send size={15} /> {c.self_at ? 'Запази промените' : 'Подай самооценката'}</button>
          {!c.self_at && <button type="button" disabled={busy} onClick={() => save(false)} className="btn-secondary">Запази чернова</button>}
        </div>
      )}
    </div>
  )
}

/** Картата с точките — по показатели. */
export function ScoreTable({ criteria, scores, self }: { criteria: EvalGroup[]; scores: Record<string, number>; self?: Record<string, number> }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left w-14">№</th><th className="px-3 py-2 text-left">Показатели и критерии</th><th className="px-3 py-2 w-20">Макс.</th>{self && <th className="px-3 py-2 w-20">Самооценка</th>}<th className="px-3 py-2 w-20">{self ? 'Комисия' : 'Точки'}</th></tr></thead>
        <tbody>
          {criteria.map(g => [
            <tr key={g.n} className="bg-slate-50/60 font-medium text-slate-800 border-t border-slate-100"><td className="px-3 py-2">{g.n}</td><td className="px-3 py-2">{g.g}</td><td className="px-3 py-2 text-center tabular-nums">{num(g.max)}</td>{self && <td className="px-3 py-2 text-center tabular-nums">{num(groupSum(g, self))}</td>}<td className="px-3 py-2 text-center tabular-nums">{num(groupSum(g, scores))}</td></tr>,
            ...g.items.map(it => <tr key={it.k} className="border-t border-slate-100 text-slate-700"><td className="px-3 py-1.5 text-slate-500">{it.k}</td><td className="px-3 py-1.5">{it.t}</td><td className="px-3 py-1.5 text-center tabular-nums text-slate-500">{num(it.max)}</td>{self && <td className="px-3 py-1.5 text-center tabular-nums">{num(self[it.k])}</td>}<td className="px-3 py-1.5 text-center tabular-nums">{num(scores[it.k])}</td></tr>),
          ])}
        </tbody>
      </table>
    </div>
  )
}

// ── Кампании ──────────────────────────────────────────────────────────────
function Campaigns(p: Props) {
  const roleIn = (id: string) => p.myCommission.find(m => m.campaign_id === id)?.role
  const [kind, setKind] = useState<'all' | Kind>('all')
  const [archive, setArchive] = useState(false)
  if (!p.campaigns.length) return <p className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-400 text-center">Няма кампании.{p.isManager ? ' Натиснете „Нова кампания“ — например „ДТВ за постигнати резултати 2025/2026“ или „Атестиране“.' : ''}</p>
  const list = p.campaigns.filter(c => (kind === 'all' || (c.kind || 'dtv') === kind) && (archive ? c.status === 'closed' : c.status !== 'closed'))
  const closedN = p.campaigns.filter(c => c.status === 'closed').length
  return (
    <div className="space-y-3">
    <div className="flex flex-wrap gap-2 items-center">
      {(['all', 'dtv', 'attest', 'other'] as const).map(k => (
        <button key={k} type="button" onClick={() => setKind(k)} className={`px-3 py-1.5 rounded-lg text-[13px] border ${kind === k ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'}`}>{k === 'all' ? 'Всички' : KIND_SHORT[k]}</button>
      ))}
      <label className="ml-auto flex items-center gap-1.5 text-[13px] text-slate-600"><input type="checkbox" checked={archive} onChange={e => setArchive(e.target.checked)} /> Архив — приключени ({closedN})</label>
    </div>
    <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
      {!list.length && <p className="p-6 text-sm text-slate-400 text-center">{archive ? 'Няма приключени кампании.' : 'Няма текущи кампании.'}</p>}
      {list.map(c => {
        const n = c.participants.length
        const done = c.participants.filter(x => x.status !== 'pending').length
        const acked = c.participants.filter(x => ['acked', 'resolved'].includes(x.status)).length
        const obj = c.participants.filter(x => x.status === 'objected').length
        const r = roleIn(c.id)
        return (
          <Link key={c.id} href={`/evaluation/${c.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-slate-50">
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] text-slate-800">{c.name} <span className="ml-1 text-[11.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 align-middle">{KIND_SHORT[(c.kind || 'dtv') as Kind]}</span></span>
              <span className="block text-[12.5px] text-slate-500">
                {CAMPAIGN_STATUS_LABEL[c.status]}{c.closed_at ? ` ${dmy(isoOf(c.closed_at))}` : ''} · {n} оценявани · утвърдени {done}/{n} · запознати {acked}/{n}
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
    </div>
  )
}

function NewCampaign({ years, onClose }: { years: Year[]; onClose: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const [kind, setKind] = useState<Kind>('dtv')
  // ДТВ се дава за изминалата учебна година — по подразбиране предходната; атестирането — текущата
  const cur = Math.max(0, years.findIndex(y => y.is_current))
  const defFor = (k: Kind) => (k === 'dtv' ? years[cur + 1] || years[cur] : years[cur]) || years[0]
  const [yearId, setYearId] = useState(defFor('dtv')?.id || '')
  const year = years.find(y => y.id === yearId)
  const [name, setName] = useState(campaignName(defFor('dtv')?.name, 'dtv'))
  const [busy, setBusy] = useState(false)
  function pickKind(k: Kind) {
    setKind(k)
    const y = defFor(k)
    setYearId(y?.id || '')
    setName(campaignName(y?.name, k))
  }
  async function create() {
    if (!name.trim()) return
    setBusy(true)
    const [y1, y2] = (year?.name || '').split(/[-/]/).map(Number)
    const end = y2 || new Date().getFullYear()
    const start = y1 || end - 1
    const base: any = { name: name.trim(), kind, academic_year_id: yearId || null }
    const row = kind === 'dtv'
      ? { ...base, score_by: `${end}-10-01`, order_by: `${end}-10-30` }
      : kind === 'attest'
        ? { ...base, self_assess: true, objection_days: 5, decide_days: 5, card_days: 3, scale: DEFAULT_SCALE, period_from: `${start - 3}-09-15`, period_to: `${end}-06-30` }
        : { ...base, objection_days: 3 }
    const { data, error } = await createClient().from('eval_campaigns').insert(row).select('id').single()
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    router.push(`/evaluation/${data.id}?tab=setup`)
  }
  const hint: Record<Kind, string> = {
    dtv: 'Сроковете се попълват по вътрешните правила (оценяване до 1 октомври, заповед до 30 октомври) и се променят в следващата стъпка.',
    attest: 'Атестиране по Наредба № 15: самооценка и портфолио от атестирания, оценка на атестационната комисия (с външни членове, напр. РУО), ОР = 0,25·СО + 0,75·ОАК, възражение до 5 работни дни към работодателя. Периодът (4 години) се проверява в следващата стъпка.',
    other: 'Друга оценка по ваша карта (напр. при изтичане на изпитателния срок, годишна оценка): комисия, средно или обща оценка, по желание самооценка. Без суми.',
  }
  return (
    <Modal open onClose={onClose} title="Нова кампания">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {(['dtv', 'attest', 'other'] as Kind[]).map(k => (
            <button key={k} type="button" onClick={() => pickKind(k)} className={`px-3 py-2.5 rounded-xl text-[13px] border text-left ${kind === k ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{KIND_LABEL[k]}</button>
          ))}
        </div>
        <label className="block"><span className="label">Учебна година</span>
          <select value={yearId} onChange={e => { setYearId(e.target.value); setName(campaignName(years.find(y => y.id === e.target.value)?.name, kind)) }} className="input w-full">
            {years.map(y => <option key={y.id} value={y.id}>{y.name.replace('-', '/')}{y.is_current ? ' (текуща)' : ''}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">Име</span><input value={name} onChange={e => setName(e.target.value)} className="input w-full" /></label>
        <p className="text-[12.5px] text-slate-500">{hint[kind]}</p>
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
  const blank = (k: Kind = 'dtv'): EvalTemplate => k === 'attest'
    ? { id: '', code: null, kind: 'attest', grp: 'ped', name: 'Атестиране — ', col_label: 'Б. Области на компетентност и критерии по тях', title: 'АТЕСТАЦИОННА КАРТА НА …',
      adopted: 'Приложение № … към чл. 82, ал. 1, т. …', roles: [], criteria: [], base: null, total: 50, is_active: true, sort: 45, guide: '' }
    : k === 'other'
      ? { id: '', code: null, kind: 'other', grp: 'ped', name: 'Оценка — ', col_label: 'Критерии', title: 'ЗА ОЦЕНКА НА …', adopted: null, roles: [], criteria: [], base: null, total: 100, is_active: true, sort: 60, guide: '' }
      : {
        id: '', code: null, kind: 'dtv', grp: 'ped', name: 'ДТВ — педагогически специалисти', col_label: 'Показатели и критерии',
        title: 'ЗА ОПРЕДЕЛЯНЕ НА ДОПЪЛНИТЕЛНО ТРУДОВО ВЪЗНАГРАЖДЕНИЕ ЗА ПОСТИГНАТИ РЕЗУЛТАТИ ОТ ТРУДА НА ПЕДАГОГИЧЕСКИТЕ СПЕЦИАЛИСТИ',
        adopted: 'Приета с решение на Педагогическия съвет, Протокол № ……… от ……………… г.', roles: ['class_teacher', 'teacher', 'educator', 'speech_therapist', 'psychologist'],
        criteria: [], base: null, total: 100, is_active: true, sort: 10,
      }
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
              <span className="block text-[12px] text-slate-500">{KIND_SHORT[(t.kind || 'dtv') as Kind]}{t.kind === 'dtv' ? ` · ${GRP_LABEL[t.grp]}` : ''} · {num(maxTotal(t.criteria))} т.{t.is_active ? '' : ' · неактивна'}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select value="" onChange={e => e.target.value && setDraft(blank(e.target.value as Kind))} className="flex-1 px-3 py-2 rounded-xl text-sm border border-slate-200 bg-white">
            <option value="">+ Нова карта…</option>
            <option value="dtv">за ДТВ</option><option value="attest">за атестиране</option><option value="other">за друга оценка</option>
          </select>
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
      criteria: d.criteria, total: d.total, is_active: d.is_active, sort: d.sort, guide: d.guide || null, updated_at: new Date().toISOString(),
      ...(d.kind === 'dtv' && (asBase || !d.base) ? { base: d.criteria } : {}),
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
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="label">Вид</span>
            <select value={d.kind} onChange={e => set({ kind: e.target.value, ...(e.target.value === 'attest' ? { total: 50 } : {}) })} className="input w-full">
              <option value="dtv">ДТВ</option><option value="attest">Атестиране</option><option value="other">Друга оценка</option>
            </select>
          </label>
          {d.kind === 'dtv'
            ? <label className="block"><span className="label">Група (фонд)</span>
              <select value={d.grp} onChange={e => set({ grp: e.target.value as Grp })} className="input w-full">
                <option value="ped">{GRP_LABEL.ped}</option><option value="nonped">{GRP_LABEL.nonped}</option>
              </select>
            </label>
            : <label className="block"><span className="label">Общо точки</span><input type="number" value={d.total} onChange={e => set({ total: Number(e.target.value) })} className="input w-full" /></label>}
        </div>
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
      <label className="block"><span className="label">Скала с описанията на степените (по желание — показва се при оценяването и се отпечатва в картата)</span>
        <textarea value={d.guide || ''} onChange={e => set({ guide: e.target.value })} rows={3} className="input w-full text-[12.5px]" placeholder="1,0 точка: …&#10;1,5 точки: …&#10;2,0 точки: …" />
      </label>
      <label className="flex items-center gap-2 text-[13px] text-slate-600"><input type="checkbox" checked={d.is_active} onChange={e => set({ is_active: e.target.checked })} /> Активна (предлага се в новите кампании)</label>
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" disabled={busy} onClick={() => save(false)} className="btn-primary inline-flex items-center gap-1.5"><Save size={14} /> Запиши</button>
        {d.id && d.kind === 'dtv' && <button type="button" disabled={busy} onClick={() => save(true)} className="btn-secondary" title="След ново решение на ПС/ОС — текущите точки стават основа за правилото до 20%">Запиши като новоприета</button>}
        {d.id && <button type="button" onClick={remove} className="btn-secondary text-rose-700 ml-auto"><Trash2 size={14} className="inline" /> Изтрий</button>}
      </div>
    </div>
  )
}

// ── Регистър: атестиране (4 години) и история по служители ───────────────
function Registry(p: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [view, setView] = useState<'attest' | 'history'>('attest')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [h, setH] = useState({ staff_id: '', attested_on: '', grade: DEFAULT_SCALE[2].l, result: '', note: '' })
  const attDate = (r: Result) => isoOf(r.employer_at || r.acked_at || r.finalized_at)

  const rows: (RegistryRow & { id: string; due: number | null; open: boolean })[] = useMemo(() => p.people.filter(x => ATTEST_ROLES.includes(x.role)).map(x => {
    const fromSys = p.results.filter(r => r.staff_id === x.id && r.campaign?.kind === 'attest' && r.grade)
      .map(r => ({ date: attDate(r), grade: finalGrade(r), result: r.result, source: r.campaign?.name || 'ЕИС', pid: r.id }))
    const fromHist = p.history.filter(r => r.staff_id === x.id).map(r => ({ date: r.attested_on, grade: r.grade, result: r.result, source: 'въведено ръчно', pid: '' }))
    const last = [...fromSys, ...fromHist].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]
    const sup = last?.pid ? p.supports.find(s => s.participant_id === last.pid) : undefined
    let next = last?.date ? addYears(last.date, ATTEST_YEARS) : null
    if (sup?.reattest_by && sup.status !== 'done' && (!next || sup.reattest_by < next)) next = sup.reattest_by
    return {
      id: x.id, name: pname(x), position: x.position || '', last: last?.date || null, grade: last?.grade || null, result: last?.result ?? null, next,
      support: sup ? `${sup.status === 'done' ? 'изпълнен' : 'в изпълнение'}${sup.reattest_by ? `, повторно до ${dmy(sup.reattest_by)}` : ''}` : '',
      source: last?.source || '', due: next ? daysLeft(next) : null, open: !!sup && sup.status !== 'done',
    }
  }).sort((a, b) => (a.next || '0000').localeCompare(b.next || '0000')), [p.people, p.results, p.history, p.supports])

  const list = rows.filter(r => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()))
  const never = rows.filter(r => !r.last).length
  const dueSoon = rows.filter(r => r.due != null && r.due <= 365).length

  async function addHistory() {
    if (!h.staff_id || !h.attested_on) { toast('Изберете служител и дата', 'error'); return }
    const { error } = await createClient().from('eval_attest_history').insert({
      staff_id: h.staff_id, attested_on: h.attested_on, grade: h.grade || null, result: h.result ? Number(h.result.replace(',', '.')) : null, note: h.note || null, created_by: p.me.id,
    })
    if (error) { toast(error.message, 'error'); return }
    toast('Записано'); setAdding(false); setH({ ...h, staff_id: '', attested_on: '', result: '', note: '' }); router.refresh()
  }
  async function delHistory(id: string) {
    if (!(await confirmDialog('Да се изтрие ли записът?'))) return
    const { error } = await createClient().from('eval_attest_history').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    router.refresh()
  }

  // история по служители — последните 6 кампании с резултати
  const camps = useMemo(() => {
    const m = new Map<string, NonNullable<Result['campaign']>>()
    p.results.forEach(r => r.campaign && m.set(r.campaign.id, r.campaign))
    return Array.from(m.values()).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6)
  }, [p.results])
  const cellOf = (staff: string, cid: string) => {
    const r = p.results.find(x => x.staff_id === staff && x.campaign_id === cid)
    if (!r) return ''
    return r.campaign?.kind === 'attest' ? `${num(r.result)}` : num(r.final_total)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" onClick={() => setView('attest')} className={`px-3 py-1.5 rounded-lg text-[13px] border ${view === 'attest' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'}`}>Атестиране (на {ATTEST_YEARS} години)</button>
        <button type="button" onClick={() => setView('history')} className={`px-3 py-1.5 rounded-lg text-[13px] border ${view === 'history' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'}`}>История по служители</button>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси служител" className="input w-56 ml-auto" />
      </div>

      {view === 'attest' && <>
        <div className="flex flex-wrap gap-2 items-center text-[13px] text-slate-600">
          <span>{rows.length} педагогически специалисти · <b className={dueSoon ? 'text-amber-700' : ''}>{dueSoon}</b> за атестиране до година · <b>{never}</b> без данни за атестиране</span>
          <button type="button" onClick={() => exportRegistryExcel(list)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"><FileSpreadsheet size={14} /> Excel</button>
          <button type="button" onClick={() => setAdding(a => !a)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"><Plus size={14} /> Атестиране преди ЕИС</button>
        </div>
        {adding && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 grid gap-2 md:grid-cols-5 items-end">
            <label className="block md:col-span-2"><span className="label">Служител</span>
              <select value={h.staff_id} onChange={e => setH({ ...h, staff_id: e.target.value })} className="input w-full"><option value="">—</option>{p.people.filter(x => ATTEST_ROLES.includes(x.role)).map(x => <option key={x.id} value={x.id}>{pname(x)}</option>)}</select></label>
            <label className="block"><span className="label">Дата</span><input type="date" value={h.attested_on} onChange={e => setH({ ...h, attested_on: e.target.value })} className="input w-full" /></label>
            <label className="block"><span className="label">ОР</span><input value={h.result} onChange={e => setH({ ...h, result: e.target.value })} className="input w-full" /></label>
            <label className="block"><span className="label">Крайна оценка</span>
              <select value={h.grade} onChange={e => setH({ ...h, grade: e.target.value })} className="input w-full">{DEFAULT_SCALE.map(x => <option key={x.l}>{x.l}</option>)}</select></label>
            <label className="block md:col-span-4"><span className="label">Бележка</span><input value={h.note} onChange={e => setH({ ...h, note: e.target.value })} className="input w-full" /></label>
            <button type="button" onClick={addHistory} className="btn-primary">Запиши</button>
          </div>
        )}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-slate-500 text-[12px]"><tr><th className="px-3 py-2 text-left">Служител</th><th className="px-2 py-2">Последно</th><th className="px-2 py-2 text-left">Крайна оценка</th><th className="px-2 py-2">Следващо</th><th className="px-2 py-2 text-left">План за подкрепа</th></tr></thead>
            <tbody>
              {list.map(r => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5"><div className="text-slate-800">{r.name}</div><div className="text-[11.5px] text-slate-500">{r.position}</div></td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{r.last ? dmy(r.last) : <span className="text-slate-400">няма данни</span>}</td>
                  <td className="px-2 py-1.5">{r.grade || ''}{r.result != null ? <span className="text-slate-500 tabular-nums"> · {num(r.result)}</span> : ''}<div className="text-[11px] text-slate-400">{r.source}</div></td>
                  <td className={`px-2 py-1.5 text-center tabular-nums ${r.due != null && r.due < 0 ? 'text-rose-700 font-medium' : r.due != null && r.due <= 365 ? 'text-amber-700' : ''}`}>{r.next ? dmy(r.next) : ''}</td>
                  <td className={`px-2 py-1.5 text-[12.5px] ${r.open ? 'text-amber-800' : 'text-slate-600'}`}>{r.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.history.length > 0 && (
          <details className="bg-white rounded-2xl border border-slate-200 px-4 py-3 text-[13px]">
            <summary className="cursor-pointer text-slate-700">Въведени ръчно ({p.history.length})</summary>
            <div className="mt-2 divide-y divide-slate-100">
              {p.history.map(x => (
                <div key={x.id} className="flex items-center gap-2 py-1.5">
                  <span className="flex-1">{pname(p.people.find(y => y.id === x.staff_id))} · {dmy(x.attested_on)} · {x.grade}{x.result != null ? ` · ${num(x.result)}` : ''}{x.note ? ` · ${x.note}` : ''}</span>
                  <button type="button" onClick={() => delHistory(x.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </details>
        )}
      </>}

      {view === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          {!camps.length ? <p className="p-6 text-sm text-slate-400 text-center">Още няма утвърдени оценки.</p> : (
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50 text-slate-500 text-[12px]"><tr><th className="px-3 py-2 text-left">Служител</th>{camps.map(c => <th key={c.id} className="px-2 py-2 font-normal" title={c.name}><Link href={`/evaluation/${c.id}`} className="hover:underline">{KIND_SHORT[c.kind || 'dtv']}<br />{c.name.replace(/^(ДТВ за постигнати резултати|Атестиране|Оценяване)\s*/, '') || c.name}</Link></th>)}</tr></thead>
              <tbody>
                {p.people.filter(x => !q.trim() || pname(x).toLowerCase().includes(q.trim().toLowerCase())).filter(x => p.results.some(r => r.staff_id === x.id)).map(x => (
                  <tr key={x.id} className="border-t border-slate-100">
                    <td className="px-3 py-1.5"><div className="text-slate-800">{pname(x)}</div><div className="text-[11.5px] text-slate-500">{x.position || ''}</div></td>
                    {camps.map(c => <td key={c.id} className="px-2 py-1.5 text-center tabular-nums">{cellOf(x.id, c.id)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
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

