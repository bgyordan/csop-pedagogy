'use client'
// Гъвкава справка за документите на децата: матрица (дете × вид документ) или списък по документи,
// филтри по вид, статус, паралелка и срок, групиране, PDF и Word.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Printer, FileText, Loader2, X, AlertTriangle } from 'lucide-react'
import { generateStudentsReportPDF, type StudentsReportData } from '@/lib/pdf-generator'
import { generateStudentsReportDocx } from '@/lib/docx-students-report'
import { DOC_TYPES, STATUS, docStatus, fmt } from '@/lib/student-docs'
import type { DocStatus, DocType, DocRow } from '@/lib/student-docs'

export type Kid = { id: string; name: string; className: string; classTeacher: string; form: string; docs: Record<string, DocRow & { diagnosis?: string | null; support_type?: string | null }> }

const coll = new Intl.Collator('bg', { numeric: true })
const STATUSES: DocStatus[] = ['expired', 'soon', 'missing', 'has', 'no', 'nodate', 'valid', 'indefinite']

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 p-1 rounded-xl bg-slate-100">
      {options.map(o => <button key={o.v} type="button" onClick={() => onChange(o.v)}
        className={`px-3 py-1.5 rounded-lg text-sm ${value === o.v ? 'bg-white shadow-sm text-[#0f2240] font-medium' : 'text-slate-500 hover:text-slate-700'}`}>{o.l}</button>)}
    </div>
  )
}

export default function DocsReportClient({ kids, yearName, initialDoc, initialStatus }: { kids: Kid[]; yearName: string; initialDoc: string; initialStatus: string }) {
  const [view, setView] = useState<'matrix' | 'list'>('matrix')
  const [docs, setDocs] = useState<DocType[]>(() => {
    const d = initialDoc.split(',').filter(x => DOC_TYPES.some(t => t.key === x)) as DocType[]
    return d.length ? d : DOC_TYPES.map(t => t.key)
  })
  const [statuses, setStatuses] = useState<DocStatus[]>(() => initialStatus.split(',').filter(x => STATUSES.includes(x as DocStatus)) as DocStatus[])
  const [horizon, setHorizon] = useState(30)
  const [cls, setCls] = useState('')
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<'class' | 'status' | 'none'>('class')
  const [busy, setBusy] = useState<'' | 'pdf' | 'docx'>('')

  const classes = useMemo(() => Array.from(new Set(kids.map(k => k.className).filter(Boolean))).sort(coll.compare), [kids])
  const st = (k: Kid, t: DocType) => docStatus(k.docs[t], horizon)

  // редовете: матрица — по дете (минава, ако поне един избран документ е с избран статус); списък — по дете × документ
  const base = kids.filter(k => (!cls || k.className === cls) && (!q.trim() || k.name.toLowerCase().includes(q.trim().toLowerCase())))
  const matrix = base.filter(k => !statuses.length || docs.some(t => statuses.includes(st(k, t).s)))
  const list = base.flatMap(k => docs.map(t => ({ k, t, ...st(k, t) }))).filter(r => !statuses.length || statuses.includes(r.s))

  const counts = useMemo(() => {
    const c: Record<string, Record<DocStatus, number>> = {}
    DOC_TYPES.forEach(t => { c[t.key] = Object.fromEntries(STATUSES.map(s => [s, 0])) as Record<DocStatus, number> })
    base.forEach(k => DOC_TYPES.forEach(t => { c[t.key][st(k, t.key).s]++ }))
    return c
  }, [base, horizon]) // eslint-disable-line react-hooks/exhaustive-deps

  const cellText = (k: Kid, t: DocType) => {
    const r = st(k, t), d = k.docs[t]
    if (r.s === 'missing') return '—'
    if (r.s === 'no') return 'няма'
    if (r.s === 'has') return `има${d?.allergens?.length ? ': ' + d.allergens.join(', ') : d?.note ? ': ' + d.note : ''}${d?.valid_until ? ` · до ${fmt(d.valid_until)}` : ''}`
    if (r.s === 'indefinite') return 'безсрочен'
    if (r.s === 'nodate') return d?.valid_label ? `валидна ${d.valid_label}` : 'без срок'
    const date = fmt(d!.valid_until!)
    const lbl = d?.valid_label ? `${d.valid_label} · ` : ''
    return r.s === 'expired' ? `изтекъл ${date}` : r.s === 'soon' ? `${lbl}до ${date} (${r.days} д.)` : lbl ? `${lbl}${date}` : `до ${date}`
  }
  const statusRank = (s: DocStatus) => STATUSES.indexOf(s)

  type G = { title: string; meta: string; items: any[] }
  const groups: G[] = useMemo(() => {
    const items = view === 'matrix' ? matrix : list
    const keyOf = (x: any) => {
      const k: Kid = view === 'matrix' ? x : x.k
      if (group === 'class') return k.className || 'Без паралелка'
      if (group === 'status') {
        const s: DocStatus = view === 'matrix' ? docs.map(t => st(k, t).s).sort((a, b) => statusRank(a) - statusRank(b))[0] : x.s
        return STATUS[s].label
      }
      return ''
    }
    const m = new Map<string, any[]>()
    items.forEach(x => { const k = keyOf(x); (m.get(k) || m.set(k, []).get(k)!).push(x) })
    const out = Array.from(m.entries()).map(([title, its]) => {
      its.sort((a, b) => coll.compare((view === 'matrix' ? a : a.k).name, (view === 'matrix' ? b : b.k).name))
      const t0 = view === 'matrix' ? its[0] : its[0].k
      return { title, meta: group === 'class' && t0.classTeacher ? `класен: ${t0.classTeacher} · ${its.length}` : String(its.length), items: its }
    })
    out.sort((a, b) => group === 'status' ? STATUSES.findIndex(s => STATUS[s].label === a.title) - STATUSES.findIndex(s => STATUS[s].label === b.title) : coll.compare(a.title, b.title))
    return out
  }, [view, matrix, list, group, docs, horizon]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = view === 'matrix' ? matrix.length : list.length
  const docLabels = DOC_TYPES.filter(t => docs.includes(t.key))

  function reportData(): StudentsReportData {
    const flt = [cls && `паралелка ${cls}`, statuses.length ? statuses.map(s => STATUS[s].short).join(', ') : '', `„изтича“ = до ${horizon} дни`].filter(Boolean)
    const headers = view === 'matrix'
      ? ['Име, презиме, фамилия', ...(group === 'class' ? [] : ['Паралелка']), ...docLabels.map(t => t.short)]
      : ['Име, презиме, фамилия', ...(group === 'class' ? [] : ['Паралелка']), 'Документ', 'Статус', '№ / срок']
    const widths = view === 'matrix' ? [30, ...(group === 'class' ? [] : [10]), ...docLabels.map(() => 20)] : [30, ...(group === 'class' ? [] : [10]), 18, 14, 28]
    return {
      title: 'Документи на децата', subtitle: [`Учебна ${yearName} г.`, ...flt].join(' · '), headers, widths,
      groups: groups.map(g => ({ title: g.title, meta: g.meta, cells: g.items.map((x: any) => view === 'matrix'
        ? [x.name, ...(group === 'class' ? [] : [x.className]), ...docLabels.map(t => cellText(x, t.key))]
        : [x.k.name, ...(group === 'class' ? [] : [x.k.className]), DOC_TYPES.find(t => t.key === x.t)!.label, STATUS[x.s as DocStatus].label,
          [x.k.docs[x.t]?.doc_number ? `№ ${x.k.docs[x.t].doc_number}` : '', x.s === 'missing' ? '' : cellText(x.k, x.t)].filter(Boolean).join(' · ')]) })),
      total, landscape: headers.length >= 5, fileName: `Документи_на_децата_${yearName.replace('/', '-')}`,
    }
  }
  // „Списък на алергиите“ — кое дете към какво е алергично, по паралелки: вид, какво да се прави при реакция
  const allergyKids = kids.filter(k => { const s0 = docStatus(k.docs.allergy, horizon).s; return k.docs.allergy && !['no', 'missing'].includes(s0) })
    .filter(k => !cls || k.className === cls)
  async function allergyList(kind: 'pdf' | 'docx') {
    setBusy(kind)
    const by = new Map<string, Kid[]>()
    allergyKids.forEach(k => { const g = k.className || 'Без паралелка'; (by.get(g) || by.set(g, []).get(g)!).push(k) })
    const d: StudentsReportData = {
      title: 'Списък на децата с алергии', subtitle: `Учебна ${yearName} г.${cls ? ` · паралелка ${cls}` : ''} · към ${fmt(new Date().toISOString())}`,
      headers: ['Име, презиме, фамилия', 'Алергия към', 'Вид', 'При реакция'], widths: [26, 26, 20, 28],
      groups: Array.from(by.entries()).sort((a, b) => coll.compare(a[0], b[0])).map(([g, ks]) => ({
        title: g === 'Без паралелка' ? g : `Паралелка ${g}`, meta: String(ks.length),
        cells: ks.sort((a, b) => coll.compare(a.name, b.name)).map(k => {
          const a = k.docs.allergy!
          return [k.name, (a.allergens || []).join(', ') || a.note || '—', (a.allergy_kinds || []).join(', '),
            [a.reaction_plan || '', a.emergency_med ? 'има лекарство за спешна помощ' : ''].filter(Boolean).join(' · ')]
        }),
      })),
      total: allergyKids.length, landscape: true, fileName: `Алергии_деца_${yearName.replace('/', '-')}`,
    }
    try { kind === 'pdf' ? await generateStudentsReportPDF(d) : await generateStudentsReportDocx(d) } finally { setBusy('') }
  }

  async function download(kind: 'pdf' | 'docx') {
    setBusy(kind)
    try { kind === 'pdf' ? await generateStudentsReportPDF(reportData()) : await generateStudentsReportDocx(reportData()) } finally { setBusy('') }
  }

  const pill = (s: DocStatus, text: string, title?: string) => (
    <span title={title} className="inline-block text-[11.5px] px-2 py-0.5 rounded-md border whitespace-nowrap" style={{ color: STATUS[s].color, background: STATUS[s].bg, borderColor: STATUS[s].border }}>{text}</span>
  )
  const sel = 'px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700'

  return (
    <div className="space-y-4">
      {/* обобщение по вид — клик филтрира */}
      <div className="grid md:grid-cols-3 gap-3">
        {DOC_TYPES.map(t => (
          <div key={t.key} className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
            <div className="text-[13px] font-medium text-slate-800 mb-2">{t.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.filter(s => counts[t.key][s]).map(s => (
                <button key={s} type="button" onClick={() => { setDocs([t.key]); setStatuses([s]) }}
                  className="text-[12px] px-2 py-0.5 rounded-md border hover:shadow-sm" style={{ color: STATUS[s].color, background: STATUS[s].bg, borderColor: STATUS[s].border }}>
                  {STATUS[s].short} <b className="tabular-nums">{counts[t.key][s]}</b>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-500 w-20">Изглед</span>
          <Seg value={view} onChange={setView} options={[{ v: 'matrix', l: 'Дете × документи' }, { v: 'list', l: 'Списък по документи' }]} />
          <span className="text-xs text-slate-500 ml-2">Групиране</span>
          <Seg value={group} onChange={setGroup} options={[{ v: 'class', l: 'Паралелка' }, { v: 'status', l: 'Статус' }, { v: 'none', l: 'Без' }]} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 w-20">Документи</span>
          {DOC_TYPES.map(t => {
            const on = docs.includes(t.key)
            return <button key={t.key} type="button" onClick={() => setDocs(d => on ? (d.length > 1 ? d.filter(x => x !== t.key) : d) : [...d, t.key])}
              className={`px-3 py-1 rounded-full text-sm border ${on ? 'border-[#0f2240]/30 bg-[#0f2240]/5 text-[#0f2240]' : 'border-slate-200 text-slate-500'}`}>{t.label}</button>
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 w-20">Статус</span>
          {STATUSES.map(s => {
            const on = statuses.includes(s)
            return <button key={s} type="button" onClick={() => setStatuses(x => on ? x.filter(y => y !== s) : [...x, s])}
              className="px-3 py-1 rounded-full text-sm border" style={on ? { color: STATUS[s].color, background: STATUS[s].bg, borderColor: STATUS[s].color } : { color: '#64748b', borderColor: '#e2e8f0' }}>{STATUS[s].label}</button>
          })}
          {statuses.length > 0 && <button type="button" onClick={() => setStatuses([])} className="text-[12px] text-slate-500 hover:text-slate-800">всички</button>}
          <select value={horizon} onChange={e => setHorizon(Number(e.target.value))} className={`${sel} ml-auto`} title="Кога „изтича скоро“">
            {[30, 60, 90, 180].map(d => <option key={d} value={d}>„изтича“ = до {d} дни</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 w-20">Филтри</span>
          <select value={cls} onChange={e => setCls(e.target.value)} className={sel}>
            <option value="">Всички паралелки</option>{classes.map(c => <option key={c} value={c}>паралелка {c}</option>)}
          </select>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Име…" className="pl-8 pr-7 py-1.5 w-48 rounded-xl border border-slate-200 text-sm" />
            {q && <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"><X size={13} /></button>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600"><b className="text-slate-800">{total}</b> {view === 'matrix' ? 'деца' : 'реда'}{group !== 'none' && <> · {groups.length} групи</>}</div>
        <div className="flex gap-2">
          <button onClick={() => allergyList('pdf')} disabled={!!busy || !allergyKids.length} title="Кое дете към какво е алергично — по паралелки, с указания при реакция"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm hover:bg-rose-100 disabled:opacity-50">
            <AlertTriangle size={15} /> Списък на алергиите ({allergyKids.length})</button>
          <button onClick={() => download('pdf')} disabled={!!busy || !total} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50">
            {busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />} PDF</button>
          <button onClick={() => download('docx')} disabled={!!busy || !total} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {busy === 'docx' ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Изтегли Word</button>
        </div>
      </div>

      {!total ? <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-dashed border-slate-300">Няма деца по тези филтри.</div> : (
        <div className="space-y-3">
          {groups.map(g => (
            <div key={g.title || '_'} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {g.title && <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100"><span className="text-sm font-medium text-slate-800">{group === 'class' && g.title !== 'Без паралелка' ? `Паралелка ${g.title}` : g.title}</span><span className="text-xs text-slate-500"> · {g.meta}</span></div>}
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="px-3 py-1.5 w-10 text-center font-normal">№</th>
                  <th className="px-3 py-1.5 text-left font-normal">Име</th>
                  {group !== 'class' && <th className="px-3 py-1.5 text-left font-normal">Паралелка</th>}
                  {view === 'matrix' ? docLabels.map(t => <th key={t.key} className="px-3 py-1.5 text-left font-normal">{t.short}</th>)
                    : <><th className="px-3 py-1.5 text-left font-normal">Документ</th><th className="px-3 py-1.5 text-left font-normal">Статус</th></>}
                </tr></thead>
                <tbody>
                  {g.items.map((x: any, j: number) => {
                    const k: Kid = view === 'matrix' ? x : x.k
                    return (
                      <tr key={view === 'matrix' ? k.id : `${k.id}-${x.t}`} className={`border-b border-slate-50 last:border-0 ${j % 2 ? 'bg-slate-50/40' : ''}`}>
                        <td className="px-3 py-1.5 text-center text-slate-400 text-xs">{j + 1}</td>
                        <td className="px-3 py-1.5"><Link href={`/students/${k.id}?tab=data`} className="text-slate-800 hover:underline">{k.name}</Link></td>
                        {group !== 'class' && <td className="px-3 py-1.5 text-slate-600">{k.className || '—'}</td>}
                        {view === 'matrix'
                          ? docLabels.map(t => <td key={t.key} className="px-3 py-1.5">{pill(st(k, t.key).s, cellText(k, t.key), k.docs[t.key]?.doc_number ? `№ ${k.docs[t.key].doc_number}` : undefined)}</td>)
                          : <><td className="px-3 py-1.5 text-slate-700">{DOC_TYPES.find(t => t.key === x.t)!.label}</td><td className="px-3 py-1.5">{pill(x.s, cellText(k, x.t))}</td></>}
                      </tr>
                    )
                  })}
                </tbody>
              </table></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
