'use client'
// Констативен протокол.
// Чернова: проверяващият попълва детайли, констатации по критериите (3/2/1/н/п + бележка), силни страни, изводи, препоръки.
// „Подпиши и впиши в Книгата“ дава пореден № за учебната година и заключва протокола.
// След това: Word за подпис на хартия, прикачване на сканирания подписан протокол, анулиране с мотив.
// Провереният: „Запознат съм“ и възражение до 7 дни.
// Препоръките след подписа: отговорникът отчита изпълнението, проверяващият потвърждава; „Последващ контрол“ създава
// нов протокол с препоръките като критерии. „Справка от системата“ — моментна снимка на данните за проверения.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, FileText, Loader2, Save, PenLine, Trash2, Plus, X, Upload, Ban, Check, Clock, MessageSquareWarning, Paperclip,
  Repeat, Database, RefreshCw, Undo2, ClipboardPen, Gavel,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import DateInput from '@/components/ui/DateInput'
import { Confirm } from '@/components/ui/Confirm'
import {
  KIND_LABEL, FORM_LABEL, FOCUS_LABEL, STATUS_LABEL, SCORES, DETAIL_FIELDS, OBJECTION_DAYS, protocolDeadline, dmy, scoreLabel,
  REC_STATUS_LABEL, REC_STATUS_TONE, recOverdue, followUpCriteria, inspectorTitle, defaultBasis,
  type ControlCheck, type CheckStaff, type Recommendation, type Finding,
} from '@/lib/control'
import { generateControlProtocol, generateRemedyOrder } from '@/lib/docx-control'
import { buildEvidence } from '@/lib/control-evidence'

type Person = { id: string; first_name: string; last_name: string; role: string; position: string | null }
type Check = ControlCheck & { year?: { name: string } | null; template?: { details: string[] } | null }
type Rec = Recommendation & { responsible?: { first_name: string; last_name: string } | null }
type Linked = { id: string; book_no: number | null; status: string; check_date?: string; signed_at?: string | null; subject?: string }
const ACCENT = '#0f2240'
const pname = (p?: { first_name: string; last_name: string } | null) => (p ? `${p.first_name} ${p.last_name}` : '—')

export default function ProtocolEditor(p: {
  me: { id: string; role: string; position: string }; check: Check; staff: CheckStaff[]; recs: Rec[]; people: Person[]
  canEdit: boolean; canManage: boolean; scanUrl: string | null; isInspector: boolean
  followUps: Linked[]; origin: Linked | null; currentYear: { id: string; name: string } | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [c, setC] = useState<Check>(p.check)
  const [staffIds, setStaffIds] = useState<string[]>(p.staff.map(s => s.staff_id))
  const [recs, setRecs] = useState<Recommendation[]>(p.recs.length ? p.recs : [])
  const [busy, setBusy] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [confirmSign, setConfirmSign] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [q, setQ] = useState('')
  const set = (patch: Partial<Check>) => { setC(prev => ({ ...prev, ...patch })); setDirty(true) }
  const setFinding = (k: string, f: Finding) => set({ findings: { ...c.findings, [k]: { ...c.findings?.[k], ...f } } })
  const setDetail = (k: string, v: string) => set({ details: { ...c.details, [k]: v } })

  const draft = c.status === 'draft'
  const edit = p.canEdit && draft
  const mine = p.staff.find(s => s.staff_id === p.me.id)
  const deadline = protocolDeadline(c.check_date)
  const detailKeys = Array.from(new Set([...(p.check.template?.details || []), ...Object.keys(c.details || {}).filter(k => c.details[k])]))
  const peopleById = Object.fromEntries(p.people.map(x => [x.id, x]))
  const staffForDoc: CheckStaff[] = edit
    ? staffIds.map(id => ({ check_id: c.id, staff_id: id, acked_at: null, objection: null, objection_at: null, staff: peopleById[id] || p.staff.find(s => s.staff_id === id)?.staff || null }))
    : p.staff

  async function save(silent = false) {
    if (!edit) return true
    setBusy('save')
    const { error } = await supabase.from('control_checks').update({
      check_date: c.check_date, subject: c.subject, purpose: c.purpose, basis: c.basis, method: c.method,
      kind: c.kind, focus: c.focus, form: c.form, planned: c.planned, announced: c.announced,
      details: c.details, findings: c.findings, findings_text: c.findings_text, strengths: c.strengths, conclusions: c.conclusions,
      evidence: c.evidence ?? null,
    }).eq('id', c.id)
    let err = error?.message
    if (!err) {
      const before = p.staff.map(s => s.staff_id)
      const add = staffIds.filter(id => !before.includes(id)), del = before.filter(id => !staffIds.includes(id))
      if (del.length) err = (await supabase.from('control_check_staff').delete().eq('check_id', c.id).in('staff_id', del)).error?.message
      if (!err && add.length) err = (await supabase.from('control_check_staff').insert(add.map(id => ({ check_id: c.id, staff_id: id })))).error?.message
    }
    if (!err) {
      err = (await supabase.from('control_recommendations').delete().eq('check_id', c.id)).error?.message
      const rows = recs.filter(r => r.text.trim()).map((r, i) => ({ check_id: c.id, sort: i, text: r.text.trim(), due_date: r.due_date || null, responsible_id: r.responsible_id || null }))
      if (!err && rows.length) err = (await supabase.from('control_recommendations').insert(rows)).error?.message
    }
    setBusy(null)
    if (err) { toast(err, 'error'); return false }
    setDirty(false)
    if (!silent) toast('Записано')
    router.refresh()
    return true
  }

  async function sign() {
    setConfirmSign(false)
    if (!(await save(true))) return
    setBusy('sign')
    const { data, error } = await supabase.rpc('control_sign', { p_check: c.id })
    setBusy(null)
    if (error) { toast(error.message, 'error'); return }
    toast(`Подписан и вписан в Книгата под № ${data}`)
    router.refresh()
    setC(prev => ({ ...prev, status: 'signed', book_no: data as number, signed_at: new Date().toISOString() }))
  }

  async function word() {
    setBusy('word')
    try {
      const names: Record<string, string> = Object.fromEntries(p.recs.filter(r => r.responsible_id && r.responsible).map(r => [r.responsible_id!, pname(r.responsible)]))
      p.people.forEach(x => { names[x.id] = pname(x) })
      await generateControlProtocol({ check: c, staff: staffForDoc, recs, inspectorName: pname(c.inspector), responsibleNames: names, origin: p.origin })
    } catch (e: any) { toast(e.message || 'Грешка при Word', 'error') }
    setBusy(null)
  }

  async function uploadScan(file: File) {
    setBusy('scan')
    const path = `${c.id}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, '_')}`
    const { error } = await supabase.storage.from('control').upload(path, file)
    if (error) { toast(error.message, 'error'); setBusy(null); return }
    const { error: e2 } = await supabase.from('control_checks').update({ scan_path: path }).eq('id', c.id)
    setBusy(null)
    if (e2) { toast(e2.message, 'error'); return }
    toast('Сканираният протокол е прикачен')
    router.refresh()
  }

  async function doVoid() {
    if (!voidReason.trim()) return
    setBusy('void')
    const { error } = await supabase.rpc('control_void', { p_check: c.id, p_reason: voidReason.trim() })
    setBusy(null)
    if (error) { toast(error.message, 'error'); return }
    setVoiding(false); router.refresh(); setC(prev => ({ ...prev, status: 'voided', voided_reason: voidReason.trim() }))
  }

  async function takeEvidence() {
    const yearName = c.year?.name || p.currentYear?.name || ''
    if (!c.academic_year_id || !yearName) { toast('Няма учебна година', 'error'); return }
    if (!staffIds.length) { toast('Първо посочете проверения служител', 'error'); return }
    setBusy('evidence')
    try {
      const staff = staffIds.map(id => ({ id, name: pname(peopleById[id] || p.staff.find(s => s.staff_id === id)?.staff) }))
      const ev = await buildEvidence(supabase, { staff, yearId: c.academic_year_id, yearName, date: c.check_date, excludeCheck: c.id })
      set({ evidence: ev })
      toast('Справката е взета — запазете протокола')
    } catch (e: any) { toast(e.message || 'Грешка при справката', 'error') }
    setBusy(null)
  }

  async function startFollowUp() {
    const year = p.currentYear
    if (!year) { toast('Няма текуща учебна година', 'error'); return }
    setBusy('follow')
    const subject = `последващ контрол по изпълнението на препоръките от констативен протокол № ${c.book_no} / ${dmy(c.signed_at)}`
    const { data, error } = await supabase.from('control_checks').insert({
      academic_year_id: year.id, inspector_id: p.me.id, inspector_title: inspectorTitle(p.me.role, p.me.position),
      kind: 'follow_up', focus: c.focus, form: 'current', planned: c.planned, announced: true,
      subject, purpose: 'Установяване на изпълнението на препоръките, дадени при предходната проверка',
      method: 'Проверка на изпълнението на препоръките; разговор с проверения служител; преглед на документацията.',
      basis: defaultBasis({ role: p.me.role, planned: c.planned, yearName: year.name }),
      details: c.details || {}, criteria: followUpCriteria(c.book_no, c.signed_at, p.recs), follow_up_of: c.id,
    }).select('id').single()
    if (error || !data) { toast(error?.message || 'Грешка', 'error'); setBusy(null); return }
    const ids = p.staff.map(s => s.staff_id)
    if (ids.length) {
      const { error: e2 } = await supabase.from('control_check_staff').insert(ids.map(id => ({ check_id: data.id, staff_id: id })))
      if (e2) toast(e2.message, 'error')
    }
    router.push(`/control/${data.id}`)
  }

  async function requestSelf(staffId: string, on: boolean) {
    const { error } = await supabase.from('control_check_staff').update({ self_requested_at: on ? new Date().toISOString() : null }).eq('check_id', c.id).eq('staff_id', staffId)
    if (error) { toast(error.message, 'error'); return }
    toast(on ? 'Самооценката е поискана — служителят я вижда в „Контролна дейност“' : 'Отказано'); router.refresh()
  }

  async function remedyOrder() {
    try {
      const names: Record<string, string> = Object.fromEntries(p.recs.filter(r => r.responsible_id && r.responsible).map(r => [r.responsible_id!, pname(r.responsible)]))
      p.people.forEach(x => { names[x.id] = pname(x) })
      const dir = p.people.find(x => x.role === 'director')
      await generateRemedyOrder({ check: c, recs: p.recs, responsibleNames: names, inspectorName: pname(c.inspector), director: dir ? pname(dir) : undefined })
    } catch (e: any) { toast(e.message || 'Грешка', 'error') }
  }

  async function remove() {
    setBusy('delete')
    const { error } = await supabase.from('control_checks').delete().eq('id', c.id)
    setBusy(null)
    if (error) { toast(error.message, 'error'); return }
    router.push('/control')
  }

  const selfs = p.staff.filter(s => s.self_assessment && (edit || c.inspector_id === p.me.id || p.canManage))
  const found = p.people.filter(x => !staffIds.includes(x.id) && x.id !== c.inspector_id && q.trim() && `${x.first_name} ${x.last_name}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <Link href="/control" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"><ArrowLeft size={14} /> Контролна дейност</Link>

      <header className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[240px]">
            <div className="text-[12px] uppercase tracking-wide text-slate-500">Констативен протокол {c.book_no ? `№ ${c.book_no} / ${dmy(c.signed_at)}` : ''}</div>
            <h1 className="text-xl font-semibold text-slate-800 mt-1">{c.subject || 'Без предмет'}</h1>
            <p className="text-sm text-slate-500 mt-1">{pname(c.inspector)} · {c.inspector_title} · проверка на {dmy(c.check_date)}</p>
          </div>
          <span className={`text-[12.5px] px-2.5 py-1 rounded-full ${c.status === 'signed' ? 'bg-emerald-50 text-emerald-700' : c.status === 'voided' ? 'bg-slate-100 text-slate-500' : deadline.left < 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
            {STATUS_LABEL[c.status]}{draft ? ` · ${deadline.left < 0 ? `срокът изтече на ${dmy(deadline.due)}` : `до ${dmy(deadline.due)} (остават ${deadline.left} дни)`}` : ''}
          </span>
        </div>
        {p.origin && (
          <p className="mt-3 text-sm text-slate-600 inline-flex items-center gap-1.5"><Repeat size={14} className="text-indigo-600" /> Последващ контрол по <Link href={`/control/${p.origin.id}`} className="text-indigo-700 hover:underline">протокол № {p.origin.book_no} / {dmy(p.origin.signed_at)}</Link></p>
        )}
        {p.followUps.map(f => (
          <p key={f.id} className="mt-3 text-sm text-slate-600 inline-flex items-center gap-1.5 mr-4"><Repeat size={14} className="text-indigo-600" /> <Link href={`/control/${f.id}`} className="text-indigo-700 hover:underline">Последващ контрол{f.book_no ? ` — протокол № ${f.book_no}` : ' (чернова)'}</Link>{f.check_date ? ` · ${dmy(f.check_date)}` : ''}</p>
        ))}
        {c.status === 'voided' && <p className="mt-3 text-sm text-slate-600">Анулиран{c.voided_at ? ` на ${dmy(c.voided_at)}` : ''}: {c.voided_reason}</p>}
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" onClick={word} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">
            {busy === 'word' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} {draft ? 'Преглед в Word' : 'Word за подпис'}
          </button>
          {edit && <>
            <button type="button" onClick={() => save()} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">
              {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Запази{dirty ? ' *' : ''}
            </button>
            {c.inspector_id === p.me.id && (
              <button type="button" onClick={() => setConfirmSign(true)} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-white" style={{ backgroundColor: ACCENT }}>
                {busy === 'sign' ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />} Подпиши и впиши в Книгата
              </button>
            )}
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={!!busy} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-rose-600 hover:bg-rose-50"><Trash2 size={14} /> Изтрий черновата</button>
          </>}
          {p.canManage && c.status === 'signed' && <>
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50 cursor-pointer">
              {busy === 'scan' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {c.scan_path ? 'Смени сканирания' : 'Прикачи сканирания подписан'}
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadScan(f) }} />
            </label>
            <button type="button" onClick={() => setVoiding(true)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100"><Ban size={14} /> Анулирай</button>
          </>}
          {c.status === 'signed' && p.isInspector && p.recs.some(r => r.status !== 'done') && !p.followUps.length && (
            <button type="button" onClick={startFollowUp} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-indigo-200 text-indigo-800 bg-indigo-50/60 hover:bg-indigo-50">
              {busy === 'follow' ? <Loader2 size={14} className="animate-spin" /> : <Repeat size={14} />} Последващ контрол
            </button>
          )}
          {c.status === 'signed' && p.canManage && p.recs.some(r => r.status !== 'done') && (
            <button type="button" onClick={remedyOrder} title="Заповед за отстраняване на пропуските — без номер, завежда се в „Заповеди“" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50"><Gavel size={14} /> Заповед</button>
          )}
          {p.scanUrl && <a href={p.scanUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-indigo-700 hover:bg-indigo-50"><Paperclip size={14} /> Подписаният протокол</a>}
        </div>
        {draft && c.inspector_id !== p.me.id && p.canEdit && <p className="text-[12.5px] text-slate-500 mt-2">Подписва само проверяващият ({pname(c.inspector)}).</p>}
        {c.status === 'signed' && !c.scan_path && p.canManage && <p className="text-[12.5px] text-amber-700 mt-2">Разпечатайте протокола, подпишете го с проверения служител и прикачете сканираното копие.</p>}
      </header>

      {mine && c.status === 'signed' && <AckBox check={c} mine={mine} />}

      <div className="space-y-5">
        <Section title="Проверката">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Дата на проверката">{edit ? <DateInput value={c.check_date} onChange={v => set({ check_date: v })} /> : dmy(c.check_date)}</Field>
            <Field label="Вид · насоченост · форма">
              {edit ? (
                <div className="grid grid-cols-3 gap-1.5">
                  <select className="input" value={c.kind} onChange={e => set({ kind: e.target.value as any })}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  <select className="input" value={c.focus} onChange={e => set({ focus: e.target.value as any })}>{Object.entries(FOCUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  <select className="input" value={c.form} onChange={e => set({ form: e.target.value as any })}>{Object.entries(FORM_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                </div>
              ) : `${KIND_LABEL[c.kind]} · ${FOCUS_LABEL[c.focus].toLowerCase()} · ${FORM_LABEL[c.form].toLowerCase()}`}
            </Field>
          </div>
          <Field label="Какво е проверено (предмет)">{edit ? <input className="input w-full" value={c.subject} onChange={e => set({ subject: e.target.value })} placeholder="напр. наблюдение на учебен час по математика" /> : c.subject}</Field>
          <Field label="Цел">{edit ? <input className="input w-full" value={c.purpose || ''} onChange={e => set({ purpose: e.target.value })} /> : c.purpose}</Field>
          <Field label="Основание">{edit ? <textarea className="input w-full" rows={3} value={c.basis || ''} onChange={e => set({ basis: e.target.value })} /> : c.basis}</Field>
          {edit && (
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={c.planned} onChange={e => set({ planned: e.target.checked })} /> По плана</label>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={c.announced} onChange={e => set({ announced: e.target.checked })} /> Предварително оповестена</label>
            </div>
          )}
          <Field label="Проверен/и">
            {edit ? (
              <div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {staffIds.map(id => (
                    <span key={id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-indigo-50 text-[13px] text-indigo-900">
                      {pname(peopleById[id] || p.staff.find(s => s.staff_id === id)?.staff)}
                      <button type="button" onClick={() => { setStaffIds(staffIds.filter(s => s !== id)); setDirty(true) }} className="p-0.5 text-indigo-300 hover:text-rose-600"><X size={12} /></button>
                    </span>
                  ))}
                </div>
                {p.staff.filter(s => staffIds.includes(s.staff_id)).map(s => (
                  <div key={s.staff_id} className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-600 mb-1.5">
                    <ClipboardPen size={13} className="text-indigo-500" />
                    <span>Самооценка — {pname(s.staff)}:</span>
                    {s.self_assessed_at ? <span className="text-emerald-700">попълнена {dmy(s.self_assessed_at)}</span>
                      : s.self_requested_at ? <><span className="text-amber-700">поискана, очаква се</span><button type="button" onClick={() => requestSelf(s.staff_id, false)} className="text-slate-400 hover:text-rose-600">отказ</button></>
                      : <button type="button" onClick={() => requestSelf(s.staff_id, true)} className="text-indigo-700 hover:underline">поискай</button>}
                  </div>
                ))}
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Добави служител…" className="input w-full" />
                {found.length > 0 && (
                  <div className="mt-1 rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {found.map(x => <button key={x.id} type="button" onClick={() => { setStaffIds([...staffIds, x.id]); setQ(''); setDirty(true) }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{pname(x)} <span className="text-slate-400 text-[12px]">{x.position || ''}</span></button>)}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {p.staff.map(s => (
                  <div key={s.staff_id} className="flex items-center gap-2 text-sm">
                    <span className="text-slate-800">{pname(s.staff)}</span>
                    {c.status !== 'draft' && (s.acked_at
                      ? <span className="text-[12px] text-emerald-700 inline-flex items-center gap-1"><Check size={12} /> запознат/а {dmy(s.acked_at)}</span>
                      : <span className="text-[12px] text-amber-700 inline-flex items-center gap-1"><Clock size={12} /> не е запознат/а</span>)}
                    {s.objection && <span className="text-[12px] text-amber-700 inline-flex items-center gap-1"><MessageSquareWarning size={12} /> възражение</span>}
                  </div>
                ))}
              </div>
            )}
          </Field>
          {detailKeys.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-3">
              {DETAIL_FIELDS.filter(f => detailKeys.includes(f.k)).map(f => (
                <Field key={f.k} label={f.l}>{edit ? <input className="input w-full" value={c.details?.[f.k] || ''} onChange={e => setDetail(f.k, e.target.value)} placeholder={f.k === 'attendance' ? 'напр. 6 присъстващи, 1 отсъстващ (болест)' : f.k === 'place' ? 'напр. етаж 2, санитарни възли, двор' : f.k === 'period' ? 'напр. 01.09 – 31.10.2026' : ''} /> : c.details?.[f.k]}</Field>
              ))}
            </div>
          )}
          <Field label="Проверката е осъществена чрез">{edit ? <textarea className="input w-full" rows={2} value={c.method || ''} onChange={e => set({ method: e.target.value })} /> : c.method}</Field>
        </Section>

        {(edit || c.evidence) && (
          <Section title="Справка от системата">
            {c.evidence?.people?.length ? (
              <div className="space-y-2">
                {c.evidence.people.map(x => (
                  <div key={x.staff_id}>
                    {c.evidence!.people.length > 1 && <div className="text-[13px] font-medium text-slate-700">{x.name}</div>}
                    <ul className="list-disc pl-5 text-[13.5px] text-slate-700 space-y-0.5">{x.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
                  </div>
                ))}
                <p className="text-[12px] text-slate-400 inline-flex items-center gap-1"><Database size={12} /> Данни от системата към {dmy(c.evidence.taken_at)}</p>
              </div>
            ) : <p className="text-sm text-slate-500">Реализация на ИУП, ЕПЛР, посещения на часове и неприключени препоръки на проверения — взема се моментна снимка, която влиза в протокола.</p>}
            {edit && (
              <button type="button" onClick={takeEvidence} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">
                {busy === 'evidence' ? <Loader2 size={14} className="animate-spin" /> : c.evidence ? <RefreshCw size={14} /> : <Database size={14} />} {c.evidence ? 'Обнови справката' : 'Вземи справка от системата'}
              </button>
            )}
          </Section>
        )}

        <Section title="I. Констатации">
          {c.follow_up_of && edit && <p className="text-[12.5px] text-indigo-800 bg-indigo-50/70 rounded-xl px-3 py-2">При подписването оценките обновяват препоръките от първия протокол: 3 — изпълнена, 2 — остава отворена, 1 — неизпълнена.</p>}
          {(c.criteria || []).filter(g => g.items?.length).map(g => (
            <div key={g.g} className="mb-4">
              <div className="text-[13px] font-medium text-slate-700 mb-1.5">{g.g}</div>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {g.items.map(it => {
                  const f = c.findings?.[it.k] || {}
                  return (
                    <div key={it.k} className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex-1 min-w-[220px] text-[13.5px] text-slate-800">{it.t}</span>
                        {edit ? (
                          <div className="flex gap-1">
                            {SCORES.map(s => (
                              <button key={s.v} type="button" title={s.l} onClick={() => setFinding(it.k, { s: f.s === s.v ? undefined : s.v })}
                                className={`h-8 min-w-8 px-2 rounded-lg text-[12.5px] border ${f.s === s.v ? (s.v === 3 ? 'bg-emerald-600 border-emerald-600 text-white' : s.v === 2 ? 'bg-amber-500 border-amber-500 text-white' : s.v === 1 ? 'bg-rose-600 border-rose-600 text-white' : 'bg-slate-500 border-slate-500 text-white') : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{s.short}</button>
                            ))}
                          </div>
                        ) : <span className="text-[12.5px] text-slate-600">{scoreLabel(f.s)}</span>}
                      </div>
                      {selfs.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {selfs.map(x => { const v = x.self_assessment?.[it.k]?.s; return v === undefined ? null : (
                            <span key={x.staff_id} className="text-[11.5px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800">самооценка{selfs.length > 1 ? ` ${pname(x.staff).split(' ')[0]}` : ''}: {scoreLabel(v).toLowerCase()}</span>
                          ) })}
                        </div>
                      )}
                      {edit ? <input className="input w-full mt-1.5 text-[13px]" value={f.n || ''} onChange={e => setFinding(it.k, { n: e.target.value })} placeholder="Бележка (по желание) — конкретен факт от наблюдението" />
                        : f.n ? <p className="text-[13px] text-slate-600 mt-1">{f.n}</p> : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {selfs.filter(x => x.self_assessment?._note).map(x => (
            <p key={x.staff_id} className="text-[13px] text-indigo-900 bg-indigo-50/60 rounded-xl px-3 py-2 mb-2"><b>Самооценка — коментар ({pname(x.staff)}):</b> {x.self_assessment!._note}</p>
          ))}
          {edit && (c.criteria || []).length > 0 && <p className="text-[12px] text-slate-400 mb-2">3 — изпълнено · 2 — частично · 1 — не е изпълнено · н/п — неприложимо</p>}
          <Field label={(c.criteria || []).length ? 'Други констатации' : 'Констатации'}>{edit ? <textarea className="input w-full" rows={4} value={c.findings_text || ''} onChange={e => set({ findings_text: e.target.value })} /> : <Pre s={c.findings_text} />}</Field>
        </Section>

        <Section title="II. Силни страни">{edit ? <textarea className="input w-full" rows={3} value={c.strengths || ''} onChange={e => set({ strengths: e.target.value })} placeholder="Какво се прави добре — постиженията се отбелязват, не само пропуските" /> : <Pre s={c.strengths} />}</Section>
        <Section title="III. Изводи">{edit ? <textarea className="input w-full" rows={3} value={c.conclusions || ''} onChange={e => set({ conclusions: e.target.value })} /> : <Pre s={c.conclusions} />}</Section>

        <Section title="IV. Препоръки">
          {edit ? (
            <div className="space-y-2">
              {recs.map((r, i) => (
                <div key={i} className="grid sm:grid-cols-[1fr_150px_200px_auto] gap-2 items-start">
                  <textarea className="input w-full" rows={2} value={r.text} onChange={e => { setRecs(recs.map((x, j) => j === i ? { ...x, text: e.target.value } : x)); setDirty(true) }} placeholder="Конкретна препоръка" />
                  <DateInput value={r.due_date || ''} onChange={v => { setRecs(recs.map((x, j) => j === i ? { ...x, due_date: v } : x)); setDirty(true) }} placeholder="срок" />
                  <select className="input" value={r.responsible_id || ''} onChange={e => { setRecs(recs.map((x, j) => j === i ? { ...x, responsible_id: e.target.value || null } : x)); setDirty(true) }}>
                    <option value="">отговорник…</option>
                    {staffIds.map(id => <option key={id} value={id}>{pname(peopleById[id])}</option>)}
                    {p.people.filter(x => !staffIds.includes(x.id)).map(x => <option key={x.id} value={x.id}>{pname(x)}</option>)}
                  </select>
                  <button type="button" onClick={() => { setRecs(recs.filter((_, j) => j !== i)); setDirty(true) }} className="p-2 text-slate-300 hover:text-rose-600"><X size={16} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setRecs([...recs, { sort: recs.length, text: '', due_date: null, responsible_id: staffIds[0] || null }])} className="inline-flex items-center gap-1 text-sm text-indigo-700"><Plus size={14} /> Препоръка</button>
            </div>
          ) : p.recs.length ? (
            <div className="space-y-2">
              {p.recs.map((r, i) => <RecItem key={r.id || i} n={i + 1} r={r} signed={c.status === 'signed'} me={p.me.id} canReview={p.canManage} />)}
            </div>
          ) : <p className="text-sm text-slate-400">Няма.</p>}
        </Section>

        {!draft && p.staff.some(s => s.objection) && (
          <Section title="V. Възражения">
            {p.staff.filter(s => s.objection).map(s => (
              <div key={s.staff_id} className="text-[14px]"><span className="text-slate-500">{pname(s.staff)}, {dmy(s.objection_at)}:</span> <Pre s={s.objection} /></div>
            ))}
          </Section>
        )}
      </div>

      <Confirm open={confirmSign} onClose={() => setConfirmSign(false)} onConfirm={sign} loading={busy === 'sign'}
        title="Подписване на протокола"
        message="Протоколът получава пореден номер в Книгата за контролната дейност и повече не може да се редактира (само да се анулира с мотив). Провереният служител ще го види и ще може да се запознае с него."
        confirmLabel="Подпиши и впиши" />
      <Confirm open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove} loading={busy === 'delete'} danger
        title="Изтриване на черновата" message="Черновата няма номер в Книгата и ще бъде изтрита." confirmLabel="Изтрий" />
      {voiding && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setVoiding(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-base text-slate-800">Анулиране на протокол № {c.book_no}</h3>
            <p className="text-sm text-slate-500">Номерът остава зает в Книгата и се отбелязва като анулиран. За поправка съставете нов протокол.</p>
            <textarea className="input w-full" rows={3} value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Мотив" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setVoiding(false)} className="btn-secondary">Отказ</button>
              <button type="button" onClick={doVoid} disabled={!voidReason.trim() || busy === 'void'} className="btn-danger">Анулирай</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RecItem({ n, r, signed, me, canReview }: { n: number; r: Rec; signed: boolean; me: string; canReview: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const status = r.status || 'open'
  const late = recOverdue(r)
  const canReport = signed && r.responsible_id === me && status !== 'done'
  async function rpc(fn: string, args: Record<string, any>, ok: string) {
    setBusy(true)
    const { error } = await createClient().rpc(fn, args)
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast(ok); setOpen(false); setText(''); setNote(''); router.refresh()
  }
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${late ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-start gap-2">
        <span className="text-[13px] text-slate-400 w-5 shrink-0">{n}.</span>
        <span className="flex-1 min-w-[200px] text-[14px] text-slate-800">{r.text}</span>
        {signed && <span className={`text-[12px] px-2 py-0.5 rounded-full ${REC_STATUS_TONE[status]}`}>{REC_STATUS_LABEL[status]}</span>}
      </div>
      <div className="pl-7 text-[12.5px] text-slate-500 mt-0.5">
        {r.responsible ? pname(r.responsible) : 'без отговорник'}{r.due_date ? <> · срок <span className={late ? 'text-rose-700 font-medium' : ''}>{dmy(r.due_date)}{late ? ' — изтекъл' : ''}</span></> : ''}
      </div>
      {r.report && <p className="pl-7 mt-1.5 text-[13px] text-slate-700"><span className="text-slate-500">Отчет{r.reported_at ? ` (${dmy(r.reported_at)})` : ''}:</span> {r.report}</p>}
      {r.review_note && <p className="pl-7 mt-1 text-[13px] text-slate-700"><span className="text-slate-500">Бележка на проверяващия{r.reviewed_at ? ` (${dmy(r.reviewed_at)})` : ''}:</span> {r.review_note}</p>}
      {r.verified_in && <p className="pl-7 mt-1 text-[12.5px]"><Link href={`/control/${r.verified_in}`} className="text-indigo-700 hover:underline">проверена при последващ контрол</Link></p>}
      {signed && (canReport || canReview) && !open && (
        <div className="pl-7 mt-2 flex flex-wrap gap-2">
          {canReport && <button type="button" onClick={() => setOpen(true)} className="text-[12.5px] px-2.5 py-1 rounded-lg bg-indigo-600 text-white">{status === 'reported' ? 'Допълни отчета' : 'Отчети изпълнение'}</button>}
          {canReview && status !== 'done' && <button type="button" disabled={busy} onClick={() => rpc('control_rec_review', { p_rec: r.id, p_status: 'done', p_note: null }, 'Отбелязана като изпълнена')} className="text-[12.5px] px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 inline-flex items-center gap-1"><Check size={12} /> Изпълнена</button>}
          {canReview && status !== 'not_done' && status !== 'done' && <button type="button" onClick={() => setOpen(true)} className="text-[12.5px] px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50">Неизпълнена…</button>}
          {canReview && (status === 'done' || status === 'not_done') && <button type="button" disabled={busy} onClick={() => rpc('control_rec_review', { p_rec: r.id, p_status: 'open', p_note: null }, 'Препоръката е отново отворена')} className="text-[12.5px] px-2.5 py-1 rounded-lg text-slate-500 hover:bg-slate-100 inline-flex items-center gap-1"><Undo2 size={12} /> Отвори отново</button>}
        </div>
      )}
      {open && canReport && (
        <div className="pl-7 mt-2 space-y-2">
          <textarea className="input w-full" rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Какво е направено — конкретно (напр. въведен визуален график за всички ученици от 03.11)" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Отказ</button>
            <button type="button" disabled={busy || !text.trim()} onClick={() => rpc('control_rec_report', { p_rec: r.id, p_report: text }, 'Отчетът е изпратен')} className="btn-primary">Изпрати отчета</button>
          </div>
        </div>
      )}
      {open && !canReport && canReview && (
        <div className="pl-7 mt-2 space-y-2">
          <textarea className="input w-full" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Какво не е изпълнено (по желание)" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Отказ</button>
            <button type="button" disabled={busy} onClick={() => rpc('control_rec_review', { p_rec: r.id, p_status: 'not_done', p_note: note }, 'Отбелязана като неизпълнена')} className="btn-danger">Неизпълнена</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AckBox({ check, mine }: { check: Check; mine: CheckStaff }) {
  const router = useRouter()
  const { toast } = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const until = check.signed_at ? new Date(Date.parse(check.signed_at) + OBJECTION_DAYS * 864e5) : null
  const canObject = !mine.objection && until !== null && until.getTime() > Date.now()
  async function send(withObjection: boolean) {
    setBusy(true)
    const { error } = await createClient().rpc('control_ack', { p_check: check.id, p_objection: withObjection ? text : null })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast(withObjection ? 'Възражението е подадено' : 'Отбелязано: запознат/а'); router.refresh()
  }
  return (
    <section className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 mb-5 space-y-3">
      {mine.acked_at
        ? <p className="text-sm text-emerald-800 inline-flex items-center gap-1.5"><Check size={15} /> Запознат/а сте с протокола на {dmy(mine.acked_at)}. Подписът на хартиения протокол остава задължителен.</p>
        : <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-indigo-900 flex-1">Прочетете протокола и потвърдете, че сте запознат/а. Ще ви бъде даден и хартиеният екземпляр за подпис.</p>
            <button type="button" onClick={() => send(false)} disabled={busy} className="btn-primary">Запознат/а съм</button>
          </div>}
      {mine.objection
        ? <p className="text-sm text-slate-700"><b>Вашето възражение</b> ({dmy(mine.objection_at)}): {mine.objection}</p>
        : canObject && (
          <div>
            <textarea className="input w-full" rows={3} value={text} onChange={e => setText(e.target.value)} placeholder={`Възражение или обяснение (по желание) — до ${dmy(until!.toISOString())}`} />
            <div className="flex justify-end mt-2"><button type="button" onClick={() => send(true)} disabled={busy || !text.trim()} className="btn-secondary">Подай възражение</button></div>
          </div>
        )}
    </section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"><h2 className="text-[13px] uppercase tracking-wide text-slate-500">{title}</h2>{children}</section>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-[12px] text-slate-500 mb-1">{label}</div><div className="text-[14px] text-slate-800">{children || <span className="text-slate-300">—</span>}</div></div>
}
const Pre = ({ s }: { s: string | null | undefined }) => (s ? <span className="whitespace-pre-wrap text-[14px] text-slate-800">{s}</span> : <span className="text-slate-300">—</span>)
