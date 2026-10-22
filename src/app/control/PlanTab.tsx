'use client'
// Годишен план за контролната дейност: 6 части, график по месеци (с изпълнението му), обхват (кой кога е проверен).
// Директорът вижда и утвърждава плановете на всички проверяващи; проверяващият води своя.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Loader2, FileText, Save, Pencil, Trash2, X, CheckCircle2, CalendarRange, Sparkles, Stamp, Undo2, Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { Confirm } from '@/components/ui/Confirm'
import { KIND_LABEL, FORM_LABEL, FOCUS_LABEL, inspectorTitle, dmy, type CheckKind, type CheckFocus, type CheckForm } from '@/lib/control'
import {
  SCHOOL_MONTHS, MONTH_LABEL, MONTH_SHORT, monthEnd, planRole, defaultPlanTexts, suggestedItems,
  analyzeControl, analysisText, type ControlPlan, type PlanItem,
} from '@/lib/control-plan'
import { generateControlPlan, generatePlanOrder } from '@/lib/docx-control'
import CouncilSend from './CouncilSend'
import type { ControlProps } from './ControlClient'

const ACCENT = '#0f2240'
const pname = (p?: { first_name: string; last_name: string } | null) => (p ? `${p.first_name} ${p.last_name}` : '—')
const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
const PEDAGOGICAL = ['teacher', 'class_teacher', 'educator', 'psychologist', 'speech_therapist', 'rehabilitator', 'coordinator']
const PARTS: { k: 'analysis' | 'goals' | 'objects' | 'methods' | 'reporting'; n: string; l: string; hint: string }[] = [
  { k: 'analysis', n: '1', l: 'Анализ на контролната дейност през предходната година', hint: 'Попълва се от анализа на миналата година — може да се допълни.' },
  { k: 'goals', n: '2', l: 'Цел и задачи', hint: '' },
  { k: 'objects', n: '3', l: 'Обект и предмет на контрола', hint: '' },
  { k: 'methods', n: '4', l: 'Видове, форми и методи', hint: '' },
  { k: 'reporting', n: '6', l: 'Отчитане на резултатите', hint: '' },
]

export default function PlanTab(p: ControlProps & { onStartCheck: (itemId: string) => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const owners = useMemo(() => {
    const ids = new Set<string>([p.me.id, ...p.inspectorIds, ...p.plans.map(x => x.owner_id)])
    p.people.filter(x => x.role === 'director' || x.role === 'zdud').forEach(x => ids.add(x.id))
    const list = Array.from(ids).map(id => p.people.find(x => x.id === id) || (id === p.me.id ? { id, first_name: p.me.name, last_name: '', role: p.me.role, position: p.me.position } : null)).filter(Boolean) as ControlProps['people']
    return p.isDirector ? list : list.filter(x => x.id === p.me.id)
  }, [p.people, p.plans, p.inspectorIds])
  const [ownerId, setOwnerId] = useState<string>(p.ownerParam && p.isDirector ? p.ownerParam : p.me.id)
  const owner = owners.find(x => x.id === ownerId)
  const plan = p.plans.find(x => x.owner_id === ownerId) || null
  const items = p.planItems.filter(i => i.plan_id === plan?.id)
  const [busy, setBusy] = useState<string | null>(null)

  if (!p.planReady) return <Notice>Годишният план още не е подготвен в базата — пуснете SQL файла 2026-10-23_control_plan.sql.</Notice>
  if (!p.year) return <Notice>Няма учебна година.</Notice>
  const year = p.year

  async function create(withSchedule: boolean) {
    if (!owner) return
    setBusy('create')
    const r = planRole(owner.role)
    const texts = defaultPlanTexts(r)
    // част 1 — от анализа на предходната учебна година
    let analysis = ''
    const prev = p.years.filter(y => y.name < year.name).sort((a, b) => b.name.localeCompare(a.name))[0]
    if (prev) {
      let q = supabase.from('control_checks').select('*, staff:control_check_staff(staff_id, objection)').eq('academic_year_id', prev.id).eq('status', 'signed')
      if (r !== 'director') q = q.eq('inspector_id', owner.id)
      const { data: pc } = await q
      const ids = (pc || []).map((c: any) => c.id)
      const { data: pr } = ids.length
        ? await supabase.from('control_recommendations').select('*, check:control_checks!control_recommendations_check_id_fkey(id, inspector_id)').in('check_id', ids)
        : { data: [] as any[] }
      const { data: prevPlan } = await supabase.from('control_plans').select('id').eq('academic_year_id', prev.id).eq('owner_id', owner.id).maybeSingle()
      const { data: prevItems } = prevPlan ? await supabase.from('control_plan_items').select('*').eq('plan_id', prevPlan.id) : { data: [] as any[] }
      if ((pc || []).length) {
        const a = analyzeControl({ checks: (pc || []) as any, recs: (pr || []) as any, items: (prevItems || []) as any, yearName: prev.name, period: 'year', today: todayIso() })
        analysis = analysisText(a, { yearName: prev.name, period: 'year' }).join('\n')
      }
    }
    const { data, error } = await supabase.from('control_plans').insert({
      academic_year_id: year.id, owner_id: owner.id, owner_title: inspectorTitle(owner.role, owner.position),
      analysis: analysis || null, ...texts,
    }).select('id').single()
    if (error || !data) { toast(error?.message || 'Грешка', 'error'); setBusy(null); return }
    if (withSchedule) {
      const byCode = new Map(p.templates.filter(t => t.code).map(t => [t.code!, t.id]))
      const rows = suggestedItems(r).map((x, i) => ({
        plan_id: data.id, month: x.month, kind: x.kind, focus: x.focus, form: x.form, subject: x.subject, scope: x.scope,
        target: x.target, template_id: (x.template && byCode.get(x.template)) || null, sort: i,
      }))
      const { error: e2 } = await supabase.from('control_plan_items').insert(rows)
      if (e2) toast(e2.message, 'error')
    }
    setBusy(null)
    toast(withSchedule ? 'Планът е създаден с типов график — прегледайте и редактирайте' : 'Планът е създаден')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {p.isDirector && owners.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {owners.map(o => {
            const pl = p.plans.find(x => x.owner_id === o.id)
            return (
              <button key={o.id} type="button" onClick={() => setOwnerId(o.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] border ${ownerId === o.id ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                {pname(o)}{o.id === p.me.id ? ' (вие)' : ''}
                <span className={`text-[11px] px-1.5 rounded-full ${pl?.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : pl ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                  {pl?.status === 'approved' ? 'утвърден' : pl ? 'чернова' : 'няма'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!plan ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
          <CalendarRange size={28} className="mx-auto text-indigo-600" />
          <div>
            <h2 className="text-base text-slate-800">Няма план за контролната дейност за {year.name.replace('-', '/')}{ownerId !== p.me.id ? ` — ${pname(owner)}` : ''}</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-xl mx-auto">Планът е в 6 части: анализ на предходната година, цел и задачи, обект и предмет, методи, график по месеци и отчитане. Анализът се попълва автоматично от миналогодишните протоколи. Ако планът вече е утвърден на хартия, въведете само графика — за да работят обхватът и анализът.</p>
          </div>
          {(ownerId === p.me.id || p.isDirector) && (
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => create(true)} disabled={!!busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-white" style={{ backgroundColor: ACCENT }}>
                {busy === 'create' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Създай с типов график за ЦСОП
              </button>
              <button type="button" onClick={() => create(false)} disabled={!!busy} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Празен план</button>
            </div>
          )}
        </div>
      ) : (
        <PlanView key={plan.id} {...p} plan={plan} items={items} owner={owner || null} />
      )}
    </div>
  )
}

function PlanView(p: ControlProps & { plan: ControlPlan; items: PlanItem[]; owner: ControlProps['people'][number] | null; onStartCheck: (id: string) => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const plan = p.plan
  const canEdit = p.isDirector || (plan.owner_id === p.me.id && plan.status === 'draft')
  const isMine = plan.owner_id === p.me.id
  const [texts, setTexts] = useState({ analysis: plan.analysis || '', goals: plan.goals || '', objects: plan.objects || '', methods: plan.methods || '', reporting: plan.reporting || '' })
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<PlanItem> | null>(null)
  const [approving, setApproving] = useState(false)
  const [orderRef, setOrderRef] = useState(plan.order_ref || '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [allInspectors, setAllInspectors] = useState(false)
  const today = todayIso()
  const yearName = p.year!.name

  // проверките по редовете на графика
  const byItem = useMemo(() => {
    const m: Record<string, { signed: number; draft: number }> = {}
    p.checks.filter(c => c.plan_item_id && c.status !== 'voided').forEach(c => {
      const x = m[c.plan_item_id!] ||= { signed: 0, draft: 0 }
      if (c.status === 'signed') x.signed++; else x.draft++
    })
    return m
  }, [p.checks])

  async function saveTexts() {
    setBusy('save')
    const { error } = await supabase.from('control_plans').update(texts).eq('id', plan.id)
    setBusy(null)
    if (error) { toast(error.message, 'error'); return }
    setDirty(false); toast('Записано'); router.refresh()
  }
  async function saveItem() {
    if (!editing?.subject?.trim() || !editing.month) { toast('Попълнете месец и предмет', 'error'); return }
    setBusy('item')
    const row = {
      plan_id: plan.id, month: editing.month, kind: editing.kind || 'current', focus: editing.focus || 'pedagogical', form: editing.form || 'observation',
      subject: editing.subject.trim(), scope: editing.scope?.trim() || null, template_id: editing.template_id || null,
      target: Math.max(1, Number(editing.target) || 1), sort: editing.sort ?? p.items.length,
    }
    const { error } = editing.id
      ? await supabase.from('control_plan_items').update(row).eq('id', editing.id)
      : await supabase.from('control_plan_items').insert(row)
    setBusy(null)
    if (error) { toast(error.message, 'error'); return }
    setEditing(null); router.refresh()
  }
  async function removeItem(id: string) {
    const { error } = await supabase.from('control_plan_items').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    setEditing(null); router.refresh()
  }
  async function approve(on: boolean) {
    setBusy('approve')
    const { error } = await supabase.rpc('control_plan_approve', { p_plan: plan.id, p_order: orderRef, p_on: on })
    setBusy(null)
    if (error) { toast(error.message, 'error'); return }
    setApproving(false); toast(on ? 'Планът е утвърден' : 'Планът е върнат в чернова'); router.refresh()
  }
  async function removePlan() {
    setBusy('delete')
    const { error } = await supabase.from('control_plans').delete().eq('id', plan.id)
    setBusy(null)
    if (error) { toast(error.message, 'error'); return }
    setConfirmDelete(false); router.refresh()
  }
  async function word() {
    setBusy('word')
    try {
      await generateControlPlan({ plan: { ...plan, ...texts }, items: p.items, yearName, ownerName: pname(p.owner), templates: p.templates })
    } catch (e: any) { toast(e.message || 'Грешка при Word', 'error') }
    setBusy(null)
  }

  // обхват: служители × месеци
  const staff = p.people.filter(x => PEDAGOGICAL.includes(x.role))
  const scopeChecks = p.checks.filter(c => c.status !== 'voided' && (allInspectors || c.inspector_id === plan.owner_id))
  const cov: Record<string, Record<number, number>> = {}
  scopeChecks.forEach(c => {
    const m = parseInt(c.check_date.slice(5, 7), 10)
    c.staff.forEach(s => { (cov[s.staff_id] ||= {})[m] = (cov[s.staff_id][m] || 0) + 1 })
  })
  const unchecked = staff.filter(x => !cov[x.id])
  const load = SCHOOL_MONTHS.map(m => ({
    m, planned: p.items.filter(i => i.month === m).reduce((a, i) => a + i.target, 0),
    done: scopeChecks.filter(c => c.status === 'signed' && parseInt(c.check_date.slice(5, 7), 10) === m).length,
  }))
  const maxLoad = Math.max(1, ...load.map(x => Math.max(x.planned, x.done)))

  return (
    <div className="space-y-5">
      <header className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[240px]">
            <div className="text-[12px] uppercase tracking-wide text-slate-500">План за контролната дейност · {yearName.replace('-', '/')}</div>
            <h2 className="text-lg font-semibold text-slate-800 mt-1">{pname(p.owner)} <span className="text-slate-500 font-normal text-[15px]">— {plan.owner_title}</span></h2>
            {plan.status === 'approved'
              ? <p className="text-sm text-emerald-700 mt-1 inline-flex items-center gap-1.5"><CheckCircle2 size={14} /> Утвърден{plan.order_ref ? ` със ${plan.order_ref}` : ''}{plan.approved_at ? ` · ${dmy(plan.approved_at)}` : ''}</p>
              : <p className="text-sm text-amber-700 mt-1">Чернова — утвърждава се от директора със заповед.</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" onClick={word} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">
            {busy === 'word' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Word
          </button>
          <CouncilSend meId={p.me.id} desc="План за контролната дейност" make={() => generateControlPlan({ plan: { ...plan, ...texts }, items: p.items, yearName, ownerName: pname(p.owner), asBlob: true })} />
          {p.isDirector && (
            <button type="button" onClick={async () => {
              const dir = p.people.find(x => x.role === 'director')
              try { await generatePlanOrder({ yearName, ownerTitle: plan.owner_title || 'проверяващия', ownerName: pname(p.owner), director: dir ? pname(dir) : undefined }) }
              catch (e: any) { toast(e.message || 'Грешка', 'error') }
            }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50"><FileText size={14} /> Заповед за утвърждаване</button>
          )}
          {canEdit && dirty && (
            <button type="button" onClick={saveTexts} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-white" style={{ backgroundColor: ACCENT }}>
              {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Запази
            </button>
          )}
          {p.isDirector && plan.status === 'draft' && (
            <button type="button" onClick={() => setApproving(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-emerald-200 text-emerald-800 bg-emerald-50/60 hover:bg-emerald-50"><Stamp size={14} /> Утвърди</button>
          )}
          {p.isDirector && plan.status === 'approved' && (
            <button type="button" onClick={() => approve(false)} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100"><Undo2 size={14} /> Върни в чернова</button>
          )}
          {canEdit && plan.status === 'draft' && (
            <button type="button" onClick={() => setConfirmDelete(true)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-rose-600 hover:bg-rose-50"><Trash2 size={14} /> Изтрий плана</button>
          )}
        </div>
      </header>

      {PARTS.slice(0, 4).map(x => <Part key={x.k} {...x} value={texts[x.k]} edit={canEdit} onChange={v => { setTexts({ ...texts, [x.k]: v }); setDirty(true) }} />)}

      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex-1 text-[13px] uppercase tracking-wide text-slate-500">5. График</h3>
          {canEdit && <button type="button" onClick={() => setEditing({ month: SCHOOL_MONTHS.find(m => monthEnd(yearName, m) >= today) || 9, kind: 'current', focus: 'pedagogical', form: 'observation', target: 1 })} className="inline-flex items-center gap-1 text-sm text-indigo-700"><Plus size={14} /> Дейност</button>}
        </div>
        {!p.items.length && <p className="text-sm text-slate-400">Графикът е празен.</p>}
        <div className="space-y-3">
          {SCHOOL_MONTHS.filter(m => p.items.some(i => i.month === m)).map(m => {
            const past = monthEnd(yearName, m) < today
            const current = !past && monthEnd(yearName, m).slice(0, 7) === today.slice(0, 7)
            return (
              <div key={m} className="grid sm:grid-cols-[110px_1fr] gap-2">
                <div className={`text-[13px] pt-2 ${current ? 'text-indigo-700 font-medium' : 'text-slate-500'}`}>{MONTH_LABEL[m]}{current ? ' · сега' : ''}</div>
                <div className="space-y-1.5">
                  {p.items.filter(i => i.month === m).sort((a, b) => a.sort - b.sort).map(i => {
                    const n = byItem[i.id] || { signed: 0, draft: 0 }
                    const done = n.signed >= i.target
                    const missed = past && !n.signed
                    return (
                      <div key={i.id} className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${done ? 'border-emerald-200 bg-emerald-50/40' : missed ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200'}`}>
                        <span className="flex-1 min-w-[220px]">
                          <span className="block text-[13.5px] text-slate-800">{i.subject}</span>
                          <span className="block text-[12px] text-slate-500">{KIND_LABEL[i.kind]} · {FOCUS_LABEL[i.focus].toLowerCase()} · {FORM_LABEL[i.form].toLowerCase()}{i.scope ? ` · ${i.scope}` : ''}</span>
                        </span>
                        <span title="подписани протоколи / планирани" className={`text-[12px] px-2 py-0.5 rounded-full tabular-nums ${done ? 'bg-emerald-100 text-emerald-700' : missed ? 'bg-rose-100 text-rose-700' : n.signed ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                          {n.signed}/{i.target}{n.draft ? ` · ${n.draft} черн.` : ''}
                        </span>
                        {isMine && !done && <button type="button" onClick={() => p.onStartCheck(i.id)} title="Нова проверка по този ред" className="p-1.5 rounded-lg text-indigo-700 hover:bg-indigo-50"><Play size={14} /></button>}
                        {canEdit && <button type="button" onClick={() => setEditing(i)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><Pencil size={14} /></button>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        {p.items.length > 0 && (
          <div className="pt-2">
            <div className="text-[12px] text-slate-500 mb-1.5">Натоварване по месеци — планирани / подписани протоколи</div>
            <div className="grid grid-cols-11 gap-1 items-end h-24">
              {load.map(x => (
                <div key={x.m} className="flex flex-col items-center gap-1 h-full justify-end" title={`${MONTH_LABEL[x.m]}: планирани ${x.planned}, подписани ${x.done}`}>
                  <div className="w-full flex items-end gap-0.5 h-full">
                    <div className="flex-1 rounded-t bg-slate-200" style={{ height: `${(x.planned / maxLoad) * 100}%` }} />
                    <div className="flex-1 rounded-t bg-emerald-500" style={{ height: `${(x.done / maxLoad) * 100}%` }} />
                  </div>
                  <span className="text-[10.5px] text-slate-500">{MONTH_SHORT[x.m]}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-1 text-[11.5px] text-slate-500"><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200" /> планирани</span><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> подписани</span></div>
          </div>
        )}
      </section>

      {PARTS.slice(4).map(x => <Part key={x.k} {...x} value={texts[x.k]} edit={canEdit} onChange={v => { setTexts({ ...texts, [x.k]: v }); setDirty(true) }} />)}

      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="flex-1 text-[13px] uppercase tracking-wide text-slate-500">Обхват — кой кога е проверен</h3>
          {p.isDirector && <label className="flex items-center gap-2 text-[13px] text-slate-600"><input type="checkbox" checked={allInspectors} onChange={e => setAllInspectors(e.target.checked)} /> всички проверяващи</label>}
        </div>
        <p className="text-[13px] text-slate-600">
          {unchecked.length
            ? <>Непроверени досега: <b>{unchecked.length}</b> от {staff.length} педагогически специалисти.</>
            : <>Всички {staff.length} педагогически специалисти са проверени поне веднъж.</>}
        </p>
        <div className="overflow-x-auto">
          <table className="text-[12.5px] w-full">
            <thead><tr className="text-slate-500"><th className="text-left font-normal py-1 pr-3">Служител</th>{SCHOOL_MONTHS.map(m => <th key={m} className="font-normal px-1 w-9">{MONTH_SHORT[m]}</th>)}<th className="font-normal px-2">Общо</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {[...staff].sort((a, b) => (Object.keys(cov[a.id] || {}).length - Object.keys(cov[b.id] || {}).length) || pname(a).localeCompare(pname(b), 'bg')).map(x => {
                const row = cov[x.id] || {}
                const total = Object.values(row).reduce((a, n) => a + n, 0)
                return (
                  <tr key={x.id}>
                    <td className="py-1 pr-3 whitespace-nowrap"><Link href={`/staff/${x.id}`} className={total ? 'text-slate-700 hover:underline' : 'text-rose-700 hover:underline'}>{pname(x)}</Link></td>
                    {SCHOOL_MONTHS.map(m => <td key={m} className="text-center px-1"><span className={`inline-block w-6 h-6 leading-6 rounded ${row[m] ? 'bg-emerald-100 text-emerald-800' : 'text-slate-200'}`}>{row[m] || '·'}</span></td>)}
                    <td className={`text-center px-2 tabular-nums ${total ? 'text-slate-700' : 'text-rose-700'}`}>{total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center"><h3 className="flex-1 text-base text-slate-800">{editing.id ? 'Дейност от графика' : 'Нова дейност'}</h3><button type="button" onClick={() => setEditing(null)} className="p-1.5 text-slate-400"><X size={16} /></button></div>
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <label className="block text-[12px] text-slate-500">Месец
                <select className="input w-full mt-1" value={editing.month} onChange={e => setEditing({ ...editing, month: Number(e.target.value) })}>
                  {SCHOOL_MONTHS.map(m => <option key={m} value={m}>{MONTH_LABEL[m]}</option>)}
                </select>
              </label>
              <label className="block text-[12px] text-slate-500">Протоколи
                <input type="number" min={1} max={200} className="input w-full mt-1" value={editing.target ?? 1} onChange={e => setEditing({ ...editing, target: Number(e.target.value) })} />
              </label>
            </div>
            <label className="block text-[12px] text-slate-500">Обект и предмет
              <input className="input w-full mt-1" value={editing.subject || ''} onChange={e => setEditing({ ...editing, subject: e.target.value })} placeholder="напр. Наблюдение на учебни часове — новоназначени учители" />
            </label>
            <label className="block text-[12px] text-slate-500">Кого обхваща
              <input className="input w-full mt-1" value={editing.scope || ''} onChange={e => setEditing({ ...editing, scope: e.target.value })} placeholder="напр. класни ръководители I–IV клас" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <select className="input" value={editing.kind} onChange={e => setEditing({ ...editing, kind: e.target.value as CheckKind })}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <select className="input" value={editing.focus} onChange={e => setEditing({ ...editing, focus: e.target.value as CheckFocus })}>{Object.entries(FOCUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <select className="input" value={editing.form} onChange={e => setEditing({ ...editing, form: e.target.value as CheckForm })}>{Object.entries(FORM_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </div>
            <label className="block text-[12px] text-slate-500">Протокол по шаблон
              <select className="input w-full mt-1" value={editing.template_id || ''} onChange={e => setEditing({ ...editing, template_id: e.target.value || null })}>
                <option value="">— без шаблон —</option>
                {p.templates.filter(t => t.is_active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <div className="flex gap-2 pt-1">
              {editing.id && <button type="button" onClick={() => removeItem(editing.id!)} className="text-sm text-rose-600 px-2 py-2 rounded-xl hover:bg-rose-50 inline-flex items-center gap-1"><Trash2 size={14} /> Изтрий</button>}
              <span className="flex-1" />
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Отказ</button>
              <button type="button" onClick={saveItem} disabled={busy === 'item'} className="btn-primary">Запази</button>
            </div>
          </div>
        </div>
      )}

      {approving && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setApproving(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-base text-slate-800">Утвърждаване на плана</h3>
            <p className="text-sm text-slate-500">Посочете заповедта, с която утвърждавате плана. След това проверяващият не може да го променя — промени прави директорът.</p>
            <input className="input w-full" value={orderRef} onChange={e => setOrderRef(e.target.value)} placeholder="Заповед № РД-…/… г." />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setApproving(false)} className="btn-secondary">Отказ</button>
              <button type="button" onClick={() => approve(true)} disabled={busy === 'approve'} className="btn-primary">Утвърди</button>
            </div>
          </div>
        </div>
      )}
      <Confirm open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={removePlan} loading={busy === 'delete'} danger
        title="Изтриване на плана" message="Планът и графикът му ще бъдат изтрити. Проверките остават, но губят връзката с графика." confirmLabel="Изтрий" />
    </div>
  )
}

function Part({ n, l, hint, value, edit, onChange }: { n: string; l: string; hint: string; value: string; edit: boolean; onChange: (v: string) => void }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
      <h3 className="text-[13px] uppercase tracking-wide text-slate-500">{n}. {l}</h3>
      {edit
        ? <textarea className="input w-full text-[14px]" rows={Math.min(14, Math.max(3, value.split('\n').length + 1))} value={value} onChange={e => onChange(e.target.value)} placeholder={hint} />
        : value ? <p className="whitespace-pre-wrap text-[14px] text-slate-800">{value}</p> : <p className="text-sm text-slate-300">—</p>}
      {edit && hint && <p className="text-[12px] text-slate-400">{hint}</p>}
    </section>
  )
}

const Notice = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">{children}</div>
)

