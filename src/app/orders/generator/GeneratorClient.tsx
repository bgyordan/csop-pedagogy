'use client'
// Генератор на заповеди: галерия от видове → попълване вляво, заповедта се пише на живо вдясно →
// Word / печат → „Впиши в Книгата“ (номерът се взима от Книгата за заповеди в момента на вписване).
// Черновите се пазят сами (order_drafts). Текстът може да се редактира ръчно в раздел „Текст“.
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { notify, confirmDialog } from '@/components/ui/Toast'
import { smartMatch } from '@/lib/search'
import { nextOrderSeq } from '@/lib/delo-seq'
import {
  TEMPLATES, TEMPLATE_BY_KEY, GROUPS, compose, missingFields, orderNumber, guessIndex, has, dmy,
  type OrderTemplate, type Data, type OrderBody, type Ctx, type StaffLite, type StudentLite, type EplrTeam, type Group,
} from '@/lib/order-generator'
import { PersonPicker, FieldInput, AutoText, Paper, type Opt } from './parts'
import {
  ArrowLeft, Search, Users, BadgeCheck, Stamp, Sun, Plane, GraduationCap, UserPlus, HeartHandshake, Bus, SearchCheck,
  BarChart3, Award, ShieldCheck, PenLine, FileDown, Printer, BookCheck, Loader2, Check, CloudOff, Trash2, Copy,
  ChevronUp, ChevronDown, Plus, RotateCcw, Sparkles, Bookmark, X, FileText, Clock, ExternalLink,
} from 'lucide-react'

const ICONS: Record<string, any> = {
  users: Users, badge: BadgeCheck, stamp: Stamp, sun: Sun, plane: Plane, cap: GraduationCap, userplus: UserPlus,
  heart: HeartHandshake, bus: Bus, search: SearchCheck, chart: BarChart3, award: Award, shield: ShieldCheck, pen: PenLine,
}
const TINTS = [
  { bg: '#eff6ff', fg: '#1d4ed8' }, { bg: '#ecfdf5', fg: '#047857' }, { bg: '#f5f3ff', fg: '#6d28d9' },
  { bg: '#fff7ed', fg: '#c2410c' }, { bg: '#fdf2f8', fg: '#be185d' }, { bg: '#f0fdfa', fg: '#0f766e' },
  { bg: '#eef2ff', fg: '#4338ca' }, { bg: '#f1f5f9', fg: '#334155' },
]
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'току-що'
  if (m < 60) return `преди ${m} мин`
  const h = Math.round(m / 60)
  if (h < 24) return `преди ${h} ч`
  const d = Math.round(h / 24)
  return d === 1 ? 'вчера' : d < 7 ? `преди ${d} дни` : dmy(iso.slice(0, 10))
}

type Draft = {
  id: string; kind: 'draft' | 'template'; template_key: string; title: string; name: string | null
  data: Data; body: OrderBody | null; order_date: string | null; order_id: string | null; order_number: string | null
  registered_at: string | null; created_by: string | null; updated_at: string; author?: { first_name: string; last_name: string } | null
}
interface Props {
  meId: string
  staff: StaffLite[]
  students: StudentLite[]
  eplr: Record<string, EplrTeam>
  nomenclature: { item_code: string; section_code: string; name: string }[]
  drafts: Draft[]
  ready: boolean
  yearName: string
  initialDraft: string
  initialTemplate: string
}

function TplIcon({ t, size = 18, box = 'w-10 h-10' }: { t: OrderTemplate; size?: number; box?: string }) {
  const I = ICONS[t.icon] || FileText
  const c = TINTS[t.tint % TINTS.length]
  return <span className={`inline-flex items-center justify-center rounded-xl shrink-0 ${box}`} style={{ background: c.bg, color: c.fg }}><I size={size} strokeWidth={2} /></span>
}

export default function GeneratorClient(p: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // ─── контекст за шаблоните ───
  const ctx: Ctx = useMemo(() => {
    const staff = Object.fromEntries(p.staff.map(s => [s.id, s]))
    const students = Object.fromEntries(p.students.map(s => [s.id, s]))
    return { staff, students, eplr: p.eplr, director: p.staff.find(s => s.role === 'director') || null, yearName: p.yearName }
  }, [p.staff, p.students, p.eplr, p.yearName])
  const staffOpts: Opt[] = useMemo(() => p.staff.map(s => ({ id: s.id, name: s.name, sub: s.position })), [p.staff])
  const studentOpts: Opt[] = useMemo(() => p.students.map(s => ({ id: s.id, name: s.name, sub: s.className ? `паралелка ${s.className}` : '' })), [p.students])
  const controlFor = useCallback((kind?: string) => {
    if (kind === 'director') return 'director'
    if (kind === 'zdud') return p.staff.find(s => s.role === 'zdud')?.id || 'director'
    if (kind === 'zdasd') return p.staff.find(s => s.role === 'zdasd' || /АСД|административно-стопанск/i.test(s.position))?.id || 'director'
    return 'none'
  }, [p.staff])

  // ─── състояние ───
  const [drafts, setDrafts] = useState<Draft[]>(p.drafts)
  const [tpl, setTpl] = useState<OrderTemplate | null>(null)
  const [data, setData] = useState<Data>({})
  const [body, setBody] = useState<OrderBody | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [reg, setReg] = useState<{ order_id: string; number: string } | null>(null)
  const [tab, setTab] = useState<'data' | 'text'>('data')
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showInvalid, setShowInvalid] = useState(false)
  const [busy, setBusy] = useState<'' | 'word' | 'reg'>('')
  const [saveTplOpen, setSaveTplOpen] = useState(false)
  const dirty = useRef(false)

  const setUrl = (q: string) => { if (typeof window !== 'undefined') window.history.replaceState(null, '', `/orders/generator${q}`) }

  function start(t: OrderTemplate, init?: Partial<Draft>, asNew = true) {
    const base: Data = { ...(t.defaults?.(ctx) || {}), __date: todayIso(), __control: controlFor(t.control), __deliver: 'all', __index: guessIndex(t, p.nomenclature) }
    setTpl(t)
    setData(init?.data ? { ...base, ...init.data, ...(asNew ? { __date: todayIso() } : {}) } : base)
    setBody(init?.body || null)
    setDraftId(asNew ? null : init?.id || null)
    setReg(!asNew && init?.order_id ? { order_id: init.order_id, number: init.order_number || '' } : null)
    setTab(init?.body ? 'text' : 'data')
    setShowInvalid(false)
    setSave('idle')
    dirty.current = false
    setUrl(asNew ? `?t=${t.key}` : `?d=${init?.id}`)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }
  function backHome() {
    setTpl(null); setDraftId(null); setReg(null); setUrl('')
    router.refresh()
  }

  // отваряне по адрес (?d=… или ?t=…)
  useEffect(() => {
    if (p.initialDraft) {
      const d = p.drafts.find(x => x.id === p.initialDraft)
      if (d && TEMPLATE_BY_KEY[d.template_key]) start(TEMPLATE_BY_KEY[d.template_key], d, d.kind === 'template')
    } else if (p.initialTemplate && TEMPLATE_BY_KEY[p.initialTemplate]) start(TEMPLATE_BY_KEY[p.initialTemplate])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (k: string, v: any) => {
    dirty.current = true
    setData(prev => {
      const next = { ...prev, [k]: v }
      // ЕПЛР: екипът от „ЕПЛР екипи“ за избраното дете
      if (tpl?.key === 'eplr' && k === 'student' && v && ctx.eplr[v]) {
        const e = ctx.eplr[v]
        if (!has(prev.leader) && e.class_teacher_id) next.leader = e.class_teacher_id
        if (!has(prev.members)) next.members = [e.psychologist_id, e.speech_therapist_id, e.rehabilitator_id].filter(Boolean)
      }
      if (tpl?.key === 'enroll' && k === 'student' && v && !has(prev.className)) next.className = ctx.students[v]?.className || ''
      return next
    })
  }

  // ─── текстът ───
  const auto = useMemo(() => (tpl ? compose(tpl, data, ctx) : null), [tpl, data, ctx])
  const shown: OrderBody | null = body || auto
  const people = useMemo(() => (auto?.people || []).map(id => ctx.staff[id]).filter(Boolean) as StaffLite[], [auto, ctx])
  const missing = tpl ? missingFields(tpl, data) : []
  const visibleFields = tpl ? tpl.fields.filter(f => !f.when || f.when(data)) : []
  const reqTotal = visibleFields.filter(f => f.required).length
  const reqDone = reqTotal - missing.length
  const subject = tpl ? tpl.subject(data, ctx) : ''
  const date = data.__date || todayIso()

  // ─── автоматично запазване ───
  useEffect(() => {
    if (!tpl || !dirty.current || !p.ready) return
    setSave('saving')
    const h = setTimeout(async () => {
      const row = { template_key: tpl.key, title: subject, data, body, order_date: date || null, updated_at: new Date().toISOString() }
      if (draftId) {
        const { error } = await supabase.from('order_drafts').update(row).eq('id', draftId)
        setSave(error ? 'error' : 'saved')
        if (!error) setDrafts(ds => ds.map(x => x.id === draftId ? { ...x, ...row } as Draft : x))
      } else {
        const { data: ins, error } = await supabase.from('order_drafts').insert({ ...row, kind: 'draft', created_by: p.meId }).select('*').single()
        if (error || !ins) { setSave('error'); return }
        setDraftId(ins.id); setUrl(`?d=${ins.id}`)
        setDrafts(ds => [ins as Draft, ...ds])
        setSave('saved')
      }
    }, 900)
    return () => clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, body])

  // ─── действия ───
  async function downloadWord(number?: string | null) {
    if (!shown) return
    setBusy('word')
    try {
      const { generateOrderDocx } = await import('@/lib/docx-order')
      await generateOrderDocx({ body: shown, number: number ?? reg?.number ?? null, date, director: ctx.director?.name || '', people })
    } catch (e: any) { notify(`Word файлът не се създаде: ${e?.message || e}`) }
    setBusy('')
  }

  async function register() {
    if (!tpl || !shown) return
    if (missing.length) {
      setShowInvalid(true); setTab('data')
      notify(`Попълнете: ${missing.join(', ')}`)
      return
    }
    if (!date) { notify('Изберете дата на заповедта.'); return }
    setBusy('reg')
    const seq = await nextOrderSeq(supabase, date)
    const ok = await confirmDialog(
      `Заповедта „${subject}“ ще бъде вписана в Книгата за заповеди с № ${orderNumber(seq, date)}.\n\nСлед вписването: изтеглете Word, разпечатайте, подпишете и прикачете сканираното копие към записа в „Заповеди“.`,
      { title: 'Вписване в Книгата за заповеди', confirmLabel: 'Впиши' },
    )
    if (!ok) { setBusy(''); return }
    // номерът се взима отново точно преди записа — някой може да е вписал заповед междувременно
    const seq2 = await nextOrderSeq(supabase, date)
    const number = orderNumber(seq2, date)
    const { data: ord, error } = await supabase.from('orders').insert({
      number, date, seq: seq2, title: subject, nomenclature_item: data.__index || null,
      description: 'Създадена с генератора на заповеди', created_by: p.meId,
    }).select('id').single()
    if (error || !ord) { notify(`Грешка при вписването: ${error?.message || 'неизвестна'}`); setBusy(''); return }
    if (p.ready) {
      const row = { order_id: ord.id, order_number: number, registered_at: new Date().toISOString(), title: subject, data, body, order_date: date, updated_at: new Date().toISOString() }
      if (draftId) await supabase.from('order_drafts').update(row).eq('id', draftId)
      else {
        const { data: ins } = await supabase.from('order_drafts').insert({ ...row, template_key: tpl.key, kind: 'draft', created_by: p.meId }).select('*').single()
        if (ins) { setDraftId(ins.id); setUrl(`?d=${ins.id}`); setDrafts(ds => [ins as Draft, ...ds]) }
      }
    }
    setReg({ order_id: ord.id, number })
    notify(seq2 !== seq ? `Вписана с № ${number} (номерът се смени — междувременно е вписана друга заповед).` : `Вписана в Книгата: № ${number}`, 'success')
    setBusy('')
    await downloadWord(number)
  }

  async function saveAsTemplate(name: string) {
    if (!tpl || !p.ready) return
    const { __date, ...rest } = data
    const { data: ins, error } = await supabase.from('order_drafts').insert({
      kind: 'template', name, template_key: tpl.key, title: name, data: rest, body, created_by: p.meId,
    }).select('*').single()
    if (error || !ins) { notify(`Не се запази: ${error?.message}`); return }
    setDrafts(ds => [ins as Draft, ...ds])
    notify(`Запазено в „Моите шаблони“: ${name}`, 'success')
    setSaveTplOpen(false)
  }

  async function removeDraft(d: Draft) {
    const what = d.kind === 'template' ? `шаблона „${d.name}“` : `черновата „${d.title || 'без заглавие'}“`
    if (!await confirmDialog(`Да се изтрие ${what}?`, { danger: true, confirmLabel: 'Изтрий' })) return
    const { error } = await supabase.from('order_drafts').delete().eq('id', d.id)
    if (error) { notify(error.message); return }
    setDrafts(ds => ds.filter(x => x.id !== d.id))
  }

  // ─── ръчен текст ───
  const editBody = (fn: (b: OrderBody) => OrderBody) => { dirty.current = true; setBody(b => fn(b || auto!)) }
  async function resetText() {
    if (!await confirmDialog('Ръчните промени в текста ще се загубят и заповедта ще се пише отново от полетата. Продължаване?', { confirmLabel: 'Върни автоматичния' })) return
    dirty.current = true; setBody(null)
  }

  if (!tpl) return <Home {...{ p, drafts, start, removeDraft }} />

  // ─── редактор ───
  return (
    <div className="min-h-screen bg-[#f4f6fa]">
      <style>{`@media print {
        @page { size: A4 portrait; margin: 0; }
        body * { visibility: hidden !important; }
        .order-print, .order-print * { visibility: visible !important; }
        .order-print { position: absolute !important; left: 0; top: 0; width: 210mm !important; max-width: none !important; min-height: 0 !important; box-shadow: none !important; padding: 15mm 15mm 15mm 25mm !important; }
      }`}</style>

      {/* горна лента */}
      <div className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-slate-200/80">
        <div className="flex items-center gap-3 px-4 md:px-6 py-2.5">
          <button onClick={backHome} className="p-2 -ml-1 rounded-xl text-slate-500 hover:bg-slate-100" title="Всички видове"><ArrowLeft size={18} /></button>
          <TplIcon t={tpl} size={16} box="w-8 h-8" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-widest text-slate-400 leading-none">{tpl.title}</div>
            <div className="text-sm font-medium text-[#0f2240] truncate mt-1">{subject}</div>
          </div>
          <SaveBadge save={save} ready={p.ready} />
          <div className="hidden sm:flex items-center gap-1.5">
            <button onClick={() => downloadWord()} disabled={!!busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60">
              {busy === 'word' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Word
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50">
              <Printer size={14} /> Печат
            </button>
          </div>
          {reg ? (
            <Link href={`/orders?q=${encodeURIComponent(reg.number.split('/')[0])}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 whitespace-nowrap">
              <BookCheck size={14} /> № {reg.number}
            </Link>
          ) : (
            <button onClick={register} disabled={!!busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white bg-[#0f2240] hover:bg-[#1a3358] shadow-sm disabled:opacity-60 whitespace-nowrap">
              {busy === 'reg' ? <Loader2 size={14} className="animate-spin" /> : <BookCheck size={14} />} Впиши в Книгата
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(360px,440px)_1fr] gap-6 px-4 md:px-6 py-6 max-w-[1500px] mx-auto">
        {/* ─── лява колона: формата ─── */}
        <div className="space-y-4 lg:sticky lg:top-[72px] lg:self-start lg:max-h-[calc(100vh-88px)] lg:overflow-y-auto lg:pr-1 pb-6">
          {reg && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-[13px] text-emerald-900">
              <div className="font-medium flex items-center gap-1.5"><Check size={15} /> Вписана в Книгата като № {reg.number}</div>
              <p className="mt-1 text-emerald-800/80">Разпечатайте, подпишете и прикачете сканираното копие към записа в <Link href="/orders" className="underline">Заповеди</Link>. Промените тук не сменят номера.</p>
            </div>
          )}

          {/* напредък */}
          <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3 shadow-[0_1px_4px_rgba(15,34,64,0.05)]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{missing.length ? 'Задължителни полета' : 'Всичко нужно е попълнено'}</span>
              <span className={`tabular-nums font-medium ${missing.length ? 'text-slate-600' : 'text-emerald-600'}`}>{reqDone}/{reqTotal}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${missing.length ? 'bg-[#0f2240]' : 'bg-emerald-500'}`} style={{ width: `${reqTotal ? (reqDone / reqTotal) * 100 : 100}%` }} />
            </div>
          </div>

          {/* табове */}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-200/50">
            {([['data', 'Данни'], ['text', body ? 'Текст · ръчен' : 'Текст']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === k ? 'bg-white text-[#0f2240] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
            ))}
          </div>

          {tab === 'data' ? (
            <>
              {body && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                  <PenLine size={14} className="mt-0.5 shrink-0" />
                  <span>Текстът е редактиран ръчно — промените в полетата не се пренасят в него. <button onClick={resetText} className="underline font-medium">Върни автоматичния</button></span>
                </div>
              )}
              <Card title="Съдържание">
                <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
                  {visibleFields.map(f => <FieldInput key={f.key} f={f} d={data} set={set} staffOpts={staffOpts} studentOpts={studentOpts} showInvalid={showInvalid} />)}
                </div>
              </Card>
              <Card title="Реквизити">
                <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
                  <div>
                    <span className="block text-[12px] font-medium text-slate-600 mb-1.5">Дата на заповедта</span>
                    <input type="date" value={data.__date || ''} disabled={!!reg} onChange={e => set('__date', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400" />
                  </div>
                  <div>
                    <span className="block text-[12px] font-medium text-slate-600 mb-1.5">Архивен индекс</span>
                    <select value={data.__index || ''} disabled={!!reg} onChange={e => set('__index', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400">
                      <option value="">—</option>
                      {p.nomenclature.map(n => <option key={n.item_code} value={n.item_code}>{n.item_code} · {n.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[12px] font-medium text-slate-600 mb-1.5">Контрол по изпълнението</span>
                    <div className="flex gap-1 p-1 rounded-xl bg-slate-100/80 mb-2">
                      {([['director', 'Лично директорът'], ['person', 'Възлагам на…'], ['none', 'Без']] as const).map(([k, l]) => {
                        const cur = data.__control === 'director' ? 'director' : data.__control === 'none' || !data.__control ? 'none' : 'person'
                        return <button key={k} type="button" onClick={() => set('__control', k === 'person' ? (controlFor('zdud') !== 'director' ? controlFor('zdud') : '') : k)}
                          className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${cur === k ? 'bg-white text-[#0f2240] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
                      })}
                    </div>
                    {data.__control !== 'director' && data.__control !== 'none' && data.__control !== undefined && (
                      <PersonPicker options={staffOpts} value={data.__control} onChange={v => set('__control', v || '')} />
                    )}
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[12px] font-medium text-slate-600 mb-1.5">Връчване</span>
                    <select value={data.__deliver || 'all'} onChange={e => set('__deliver', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                      <option value="all">На заинтересованите лица срещу подпис</option>
                      <option value="acc">На заинтересованите лица и на счетоводството</option>
                      <option value="none">Без текст за връчване</option>
                    </select>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <TextEditor body={body} auto={auto!} editBody={editBody} start={() => { dirty.current = true; setBody({ ...auto!, points: [...auto!.points], closing: [...auto!.closing] }) }} reset={resetText} />
          )}

          <div className="flex items-center gap-2 text-xs">
            <button onClick={() => setSaveTplOpen(true)} disabled={!p.ready}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-50">
              <Bookmark size={13} /> Запази като мой шаблон
            </button>
            <button onClick={() => start(tpl, { data, body: body || undefined } as any)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-white border border-transparent hover:border-slate-200">
              <Copy size={13} /> Нова от тази
            </button>
            <div className="sm:hidden ml-auto flex gap-1">
              <button onClick={() => downloadWord()} className="p-2 rounded-xl border border-slate-200 bg-white"><FileDown size={14} /></button>
              <button onClick={() => window.print()} className="p-2 rounded-xl border border-slate-200 bg-white"><Printer size={14} /></button>
            </div>
          </div>
        </div>

        {/* ─── дясна колона: заповедта ─── */}
        <div className="min-w-0">
          {shown && <Paper body={shown} number={reg?.number} date={date} director={ctx.director?.name || ''} people={people} draft={!reg}
            onMissing={() => { setShowInvalid(true); setTab('data') }} />}
          <p className="text-center text-[11px] text-slate-400 mt-3 print:hidden">
            Жълтите полета още не са попълнени · номерът се дава при „Впиши в Книгата“
          </p>
        </div>
      </div>

      {saveTplOpen && <NameDialog initial={tpl.title} onClose={() => setSaveTplOpen(false)} onSave={saveAsTemplate} />}
    </div>
  )
}

// ─── начален екран ──────────────────────────────────────────────────────────
function Home({ p, drafts, start, removeDraft }: {
  p: Props; drafts: Draft[]; start: (t: OrderTemplate, init?: Partial<Draft>, asNew?: boolean) => void; removeDraft: (d: Draft) => void
}) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<Group | ''>('')
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); searchRef.current?.focus() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const usage = useMemo(() => {
    const u: Record<string, number> = {}
    drafts.forEach(d => { if (d.order_id) u[d.template_key] = (u[d.template_key] || 0) + 1 })
    return u
  }, [drafts])
  const list = TEMPLATES.filter(t => (!group || t.group === group) && smartMatch(`${t.title} ${t.blurb}`, q))
  const open = drafts.filter(d => d.kind === 'draft' && !d.order_id && TEMPLATE_BY_KEY[d.template_key])
  const mine = drafts.filter(d => d.kind === 'template' && TEMPLATE_BY_KEY[d.template_key] && smartMatch(d.name || '', q))
  const done = drafts.filter(d => d.kind === 'draft' && d.order_id && TEMPLATE_BY_KEY[d.template_key]).slice(0, 8)

  return (
    <div className="min-h-screen bg-[#f4f6fa]">
      <div className="px-4 md:px-8 pt-6 pb-10 max-w-6xl mx-auto">
        <Link href="/orders" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"><ArrowLeft size={14} /> Книга за заповеди</Link>

        {/* хедър */}
        <div className="mt-4 rounded-3xl bg-gradient-to-br from-[#0f2240] via-[#16305a] to-[#25467a] text-white px-6 md:px-10 py-8 md:py-10 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-white/[0.04]" />
          <div className="absolute right-24 -bottom-24 w-56 h-56 rounded-full bg-white/[0.05]" />
          <div className="relative">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/60 flex items-center gap-1.5"><Sparkles size={12} /> Деловодство</div>
            <h1 className="text-2xl md:text-3xl font-light mt-2">Генератор на заповеди</h1>
            <p className="text-sm text-white/70 mt-2 max-w-xl">Изберете вида, попълнете няколко полета — заповедта се пише сама, с правното основание, контрола и запознатите. Номерът идва от Книгата при вписване.</p>
            <div className="relative mt-6 max-w-xl">
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Какво ще нареждате? — комисия, отпуск, командировка…"
                className="w-full pl-11 pr-10 py-3 rounded-2xl bg-white text-slate-800 text-sm placeholder:text-slate-400 outline-none shadow-[0_8px_24px_rgba(0,0,0,0.18)] focus:ring-4 focus:ring-white/20" />
              {q ? <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={14} /></button>
                : <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">/</kbd>}
            </div>
          </div>
        </div>

        {!p.ready && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 flex items-start gap-2">
            <CloudOff size={16} className="mt-0.5 shrink-0" />
            <span>Черновите още не се пазят — пуснете <code className="px-1 rounded bg-amber-100">supabase/migrations/2026-10-30_order_generator.sql</code> в Supabase. Дотогава генераторът работи (Word, печат, вписване), но без запазване.</span>
          </div>
        )}

        {/* продължете */}
        {open.length > 0 && !q && (
          <section className="mt-8">
            <SectionTitle icon={<Clock size={13} />} title="Продължете" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {open.slice(0, 6).map(d => {
                const t = TEMPLATE_BY_KEY[d.template_key]
                return (
                  <div key={d.id} className="group relative bg-white rounded-2xl border border-slate-200/80 p-3.5 flex gap-3 hover:border-slate-300 hover:shadow-[0_6px_20px_rgba(15,34,64,0.08)] transition-all cursor-pointer"
                    onClick={() => start(t, d, false)}>
                    <TplIcon t={t} size={16} box="w-9 h-9" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-800 truncate">{d.title || t.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">{t.title} · {ago(d.updated_at)}{d.author && ` · ${d.author.first_name}`}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); removeDraft(d) }} title="Изтрий черновата"
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 self-start transition-opacity"><Trash2 size={14} /></button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* моите шаблони */}
        {mine.length > 0 && (
          <section className="mt-8">
            <SectionTitle icon={<Bookmark size={13} />} title="Моите шаблони" />
            <div className="flex flex-wrap gap-2">
              {mine.map(d => (
                <span key={d.id} className="group inline-flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
                  <button onClick={() => start(TEMPLATE_BY_KEY[d.template_key], d, true)} className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <TplIcon t={TEMPLATE_BY_KEY[d.template_key]} size={13} box="w-7 h-7" /> {d.name}
                  </button>
                  <button onClick={() => removeDraft(d)} className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50" title="Изтрий"><X size={12} /></button>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* галерия */}
        <section className="mt-8">
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            <Chip on={!group} onClick={() => setGroup('')}>Всички</Chip>
            {GROUPS.map(g => <Chip key={g.key} on={group === g.key} onClick={() => setGroup(group === g.key ? '' : g.key)}>{g.label}</Chip>)}
          </div>
          {list.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <p className="text-sm text-slate-500">Няма такъв вид заповед.</p>
              <button onClick={() => start(TEMPLATE_BY_KEY.free, { data: { subject: q } } as any)} className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#0f2240] font-medium hover:underline">
                <PenLine size={14} /> Започнете свободна заповед „{q}“
              </button>
            </div>
          ) : (
            GROUPS.filter(g => list.some(t => t.group === g.key)).map(g => (
              <div key={g.key} className="mb-7">
                <div className="flex items-baseline gap-2 mb-2.5">
                  <h2 className="text-[13px] font-semibold text-[#0f2240]">{g.label}</h2>
                  <span className="text-[11px] text-slate-400">{g.hint}</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {list.filter(t => t.group === g.key).map(t => (
                    <button key={t.key} onClick={() => start(t)}
                      className="group text-left bg-white rounded-2xl border border-slate-200/80 p-4 flex gap-3.5 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_28px_rgba(15,34,64,0.10)] transition-all duration-200">
                      <TplIcon t={t} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-medium text-slate-800">{t.title}</span>
                          {usage[t.key] ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 tabular-nums">{usage[t.key]}×</span> : null}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{t.blurb}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        {/* последно вписани */}
        {done.length > 0 && !q && (
          <section className="mt-4">
            <SectionTitle icon={<BookCheck size={13} />} title="Последно вписани от генератора" />
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
              {done.map(d => {
                const t = TEMPLATE_BY_KEY[d.template_key]
                return (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/70">
                    <TplIcon t={t} size={14} box="w-8 h-8" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-800 truncate">{d.title}</div>
                      <div className="text-[11px] text-slate-400 tabular-nums">№ {d.order_number} · {ago(d.registered_at || d.updated_at)}</div>
                    </div>
                    <button onClick={() => start(t, d, false)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-white border border-transparent hover:border-slate-200"><ExternalLink size={12} /> Отвори</button>
                    <button onClick={() => start(t, d, true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-white border border-transparent hover:border-slate-200"><Copy size={12} /> Като нова</button>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

// ─── дребни части ───────────────────────────────────────────────────────────
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <h2 className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-3">{icon}{title}</h2>
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${on ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>{children}</button>
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_1px_4px_rgba(15,34,64,0.05)]">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold mb-3">{title}</h3>
      {children}
    </div>
  )
}
function SaveBadge({ save, ready }: { save: string; ready: boolean }) {
  if (!ready) return <span className="hidden md:flex items-center gap-1 text-[11px] text-amber-600"><CloudOff size={13} /> без запазване</span>
  if (save === 'saving') return <span className="hidden md:flex items-center gap-1 text-[11px] text-slate-400"><Loader2 size={12} className="animate-spin" /> запазване…</span>
  if (save === 'saved') return <span className="hidden md:flex items-center gap-1 text-[11px] text-slate-400"><Check size={13} /> запазено</span>
  if (save === 'error') return <span className="hidden md:flex items-center gap-1 text-[11px] text-rose-600"><CloudOff size={13} /> не се запази</span>
  return null
}

function TextEditor({ body, auto, editBody, start, reset }: {
  body: OrderBody | null; auto: OrderBody; editBody: (fn: (b: OrderBody) => OrderBody) => void; start: () => void; reset: () => void
}) {
  const ta = 'w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-[13px] outline-none focus:border-[#0f2240] focus:ring-2 focus:ring-[#0f2240]/10'
  if (!body) return (
    <Card title="Текст на заповедта">
      <p className="text-[13px] text-slate-600 leading-relaxed">Сега текстът се пише автоматично от полетата. Ако искате да промените формулировка, добавите или махнете точка — превключете на ръчен текст.</p>
      <ul className="mt-3 text-xs text-slate-500 space-y-1">
        <li>· <b>**текст**</b> се показва удебелено</li>
        <li>· нов ред в точка = подточка (за състав на комисия, списък)</li>
      </ul>
      <button onClick={start} className="mt-4 w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white bg-[#0f2240] hover:bg-[#1a3358]">
        <PenLine size={14} /> Редактирай текста ръчно
      </button>
    </Card>
  )
  const move = (arr: 'points' | 'closing', i: number, dir: -1 | 1) => editBody(b => {
    const a = [...b[arr]]; const j = i + dir
    if (j < 0 || j >= a.length) return b
    ;[a[i], a[j]] = [a[j], a[i]]
    return { ...b, [arr]: a }
  })
  const setAt = (arr: 'points' | 'closing', i: number, v: string) => editBody(b => { const a = [...b[arr]]; a[i] = v; return { ...b, [arr]: a } })
  const del = (arr: 'points' | 'closing', i: number) => editBody(b => ({ ...b, [arr]: b[arr].filter((_, k) => k !== i) }))
  return (
    <div className="space-y-4">
      <Card title="Основание и разпоредба">
        <span className="block text-[12px] font-medium text-slate-600 mb-1.5">На основание…</span>
        <AutoText value={body.basis} onChange={v => editBody(b => ({ ...b, basis: v }))} className={ta} />
        <span className="block text-[12px] font-medium text-slate-600 mt-3 mb-1.5">Разпоредителна дума</span>
        <input list="verbs" value={body.verb} onChange={e => editBody(b => ({ ...b, verb: e.target.value.toUpperCase() }))} className={ta} />
        <datalist id="verbs">{['НАРЕЖДАМ', 'ОПРЕДЕЛЯМ', 'УТВЪРЖДАВАМ', 'РАЗРЕШАВАМ', 'ВЪЗЛАГАМ', 'НАЗНАЧАВАМ', 'КОМАНДИРОВАМ', 'ОТМЕНЯМ'].map(v => <option key={v} value={v} />)}</datalist>
      </Card>
      <Card title="Точки">
        <div className="space-y-2.5">
          {[...body.points.map((x, i) => ['points', i, x] as const), ...body.closing.map((x, i) => ['closing', i, x] as const)].map(([arr, i, x], n) => (
            <div key={`${arr}${i}`} className="flex gap-2 group">
              <span className="w-5 pt-2 text-xs text-slate-400 tabular-nums text-right shrink-0">{n + 1}.</span>
              <AutoText value={x} onChange={v => setAt(arr, i, v)} className={`${ta} flex-1`} />
              <div className="flex flex-col opacity-40 group-hover:opacity-100 transition-opacity">
                <button onClick={() => move(arr, i, -1)} className="p-1 rounded text-slate-500 hover:bg-slate-100" title="Нагоре"><ChevronUp size={13} /></button>
                <button onClick={() => move(arr, i, 1)} className="p-1 rounded text-slate-500 hover:bg-slate-100" title="Надолу"><ChevronDown size={13} /></button>
                <button onClick={() => del(arr, i)} className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Махни"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => editBody(b => ({ ...b, points: [...b.points, ''] }))}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700">
          <Plus size={13} /> Добави точка
        </button>
      </Card>
      <button onClick={reset} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 px-1">
        <RotateCcw size={13} /> Върни автоматичния текст {auto.points.length !== body.points.length && <span className="text-slate-400">({auto.points.length} точки)</span>}
      </button>
    </div>
  )
}

function NameDialog({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial)
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-[#0f2240]">Запази като мой шаблон</h3>
        <p className="text-xs text-slate-500 mt-1">Попълнените полета и текстът ще са готови следващия път. Датата не се пази.</p>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()) }}
          className="mt-3 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0f2240] focus:ring-2 focus:ring-[#0f2240]/10" placeholder="напр. Комисия за инвентаризация" />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-2 rounded-xl text-xs text-slate-600 bg-slate-100 hover:bg-slate-200">Отказ</button>
          <button disabled={!name.trim()} onClick={() => onSave(name.trim())} className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-[#0f2240] disabled:opacity-50">Запази</button>
        </div>
      </div>
    </div>
  )
}
