'use client'
// Учебни планове от НЕИСПУО: преглед (по учители / по паралелки) и внос на обобщената справка.

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { Upload, Loader2, Check, AlertTriangle, ChevronDown, ChevronRight, Users, LayoutGrid, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { smartMatch } from '@/lib/search'
import { parseSheet, matchLines } from './parse'
import type { Ref, NameMap, Matched } from './parse'
import { importCurriculum } from './actions'

type Line = {
  id: string; holder_label: string; class_id: string | null; coud_group_id: string | null; subject: string
  hours_t1: number; weeks_t1: number; hours_t2: number; weeks_t2: number; total_hours: number
  students: number | null; teacher_name: string | null; staff_id: string | null; imported_at: string
}

const fmt = (n: number | string | null | undefined) => n === null || n === undefined ? '' : String(Number(n)).replace('.', ',')
const r1 = (x: number) => Math.round(x * 10) / 10
const holderSort = (a: string, b: string) => a.localeCompare(b, 'bg', { numeric: true })

export default function CurriculumClient({ ready, lines, classes, couds, staff, map }: {
  ready: boolean; lines: Line[]; classes: Ref[]; couds: Ref[]; staff: Ref[]; map: NameMap
}) {
  const { toast } = useToast()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [view, setView] = useState<'teachers' | 'classes'>('teachers')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<{ file: string; lines: Matched[] } | null>(null)
  const [fixStaff, setFixStaff] = useState<Record<string, string>>({})
  const [fixHolder, setFixHolder] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const staffName = useMemo(() => Object.fromEntries(staff.map(s => [s.id, s.name])), [staff])

  async function onFile(f: File) {
    try {
      const wb = XLSX.read(await f.arrayBuffer())
      const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
      const p = parseSheet(rows)
      if (p.error) { toast(p.error, 'error'); return }
      if (!p.lines.length) { toast('Във файла няма редове', 'error'); return }
      setFixStaff({}); setFixHolder({})
      setPreview({ file: f.name, lines: matchLines(p.lines, classes, couds, staff, map) })
    } catch { toast('Файлът не може да се прочете', 'error') }
    finally { if (fileRef.current) fileRef.current.value = '' }
  }

  // ── преглед на вноса: кое не е свързано ──
  const unmatchedTeachers = useMemo(() => preview
    ? Array.from(new Set(preview.lines.filter(l => l.teacher && !l.staffId).map(l => l.teacher))).sort((a, b) => a.localeCompare(b, 'bg')) : [], [preview])
  const unmatchedHolders = useMemo(() => preview
    ? Array.from(new Set(preview.lines.filter(l => (l.kind === 'class' && !l.classId) || (l.kind === 'coud' && !l.coudId)).map(l => l.holder))).sort(holderSort) : [], [preview])

  async function save() {
    if (!preview) return
    setSaving(true)
    const out = preview.lines.map(l => ({
      holder: l.holder, subject: l.subject, weeksT1: l.weeksT1, hoursT1: l.hoursT1, weeksT2: l.weeksT2, hoursT2: l.hoursT2,
      total: l.total, students: l.students, teacher: l.teacher,
      classId: l.kind === 'class' ? (fixHolder[l.holder] || l.classId) : null,
      coudId: l.kind === 'coud' ? (fixHolder[l.holder] || l.coudId) : null,
      staffId: fixStaff[l.teacher] || l.staffId,
    }))
    const manual = [
      ...Object.entries(fixStaff).filter(([, id]) => id).map(([source, id]) => ({ kind: 'staff' as const, source, id })),
      ...Object.entries(fixHolder).filter(([, id]) => id).map(([source, id]) => ({ kind: (/цоуд/i.test(source) ? 'coud' : 'class') as 'coud' | 'class', source, id })),
    ]
    const res: any = await importCurriculum(out, manual)
    setSaving(false)
    if (res.error) { toast(res.error, 'error'); return }
    toast(`Внесени ${res.count} реда`)
    setPreview(null)
    router.refresh()
  }

  // ── групиране на записаното ──
  const teacherKey = (l: Line) => l.staff_id || `raw:${l.teacher_name || '—'}`
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; title: string; sub: string; linked: boolean; lines: Line[] }>()
    lines.forEach(l => {
      const key = view === 'teachers' ? teacherKey(l) : l.holder_label
      if (!m.has(key)) {
        const title = view === 'teachers' ? (l.staff_id ? staffName[l.staff_id] || l.teacher_name || '—' : l.teacher_name || '—') : l.holder_label
        m.set(key, { key, title, sub: '', linked: view === 'teachers' ? !!l.staff_id : !!(l.class_id || l.coud_group_id || !/паралелка|цоуд/i.test(l.holder_label)), lines: [] })
      }
      m.get(key)!.lines.push(l)
    })
    return Array.from(m.values())
      .filter(g => smartMatch(`${g.title} ${g.lines.map(l => `${l.subject} ${l.holder_label} ${l.teacher_name}`).join(' ')}`, q))
      .sort((a, b) => view === 'teachers' ? a.title.localeCompare(b.title, 'bg') : holderSort(a.title, b.title))
  }, [lines, view, q, staffName])

  const sum = (ls: Line[], k: 'hours_t1' | 'hours_t2' | 'total_hours') => r1(ls.reduce((a, l) => a + Number(l[k] || 0), 0))
  const toggle = (k: string) => setOpen(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })

  if (!ready) return <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">Таблицата още не е създадена в базата — пуснете SQL файла 2026-10-04_curriculum.sql.</div>

  const uploadBtn = (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
      <button onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
        <Upload size={15} /> {lines.length ? 'Нов внос от НЕИСПУО' : 'Внос от НЕИСПУО'}
      </button>
    </>
  )

  // ════════ ПРЕГЛЕД ПРЕДИ ЗАПИС ════════
  if (preview) {
    const L = preview.lines
    const okStaff = L.filter(l => l.staffId || fixStaff[l.teacher]).length
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-center gap-x-8 gap-y-2">
          <div>
            <div className="text-xs text-slate-500">Файл</div>
            <div className="text-sm text-slate-800">{preview.file}</div>
          </div>
          <Stat label="реда" v={L.length} />
          <Stat label="паралелки / групи" v={new Set(L.map(l => l.holder)).size} />
          <Stat label="преподаватели" v={new Set(L.map(l => l.teacher)).size} />
          <Stat label="свързани с EIS" v={`${okStaff} от ${L.length}`} />
          <div className="ml-auto flex gap-2">
            <button onClick={() => setPreview(null)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm text-slate-600 border border-slate-200 hover:bg-slate-50"><X size={14} /> Отказ</button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запиши{lines.length ? ' (заменя досегашния внос)' : ''}
            </button>
          </div>
        </div>

        {unmatchedTeachers.length > 0 && (
          <FixBox title="Преподаватели, които не разпознах" hint="Изберете кой е в EIS — запомня се за следващ внос. Ако го няма, оставете празно (редът се пази с името от НЕИСПУО).">
            {unmatchedTeachers.map(t => (
              <FixRow key={t} label={t} value={fixStaff[t] || ''} onChange={v => setFixStaff(p => ({ ...p, [t]: v }))} options={staff} />
            ))}
          </FixBox>
        )}
        {unmatchedHolders.length > 0 && (
          <FixBox title="Паралелки / групи, които не разпознах" hint="Изберете коя е в EIS — запомня се за следващ внос.">
            {unmatchedHolders.map(h => (
              <FixRow key={h} label={h} value={fixHolder[h] || ''} onChange={v => setFixHolder(p => ({ ...p, [h]: v }))} options={/цоуд/i.test(h) ? couds : classes} />
            ))}
          </FixBox>
        )}
        {!unmatchedTeachers.length && !unmatchedHolders.length && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800 inline-flex items-center gap-2"><Check size={15} /> Всички паралелки и преподаватели са разпознати.</div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 text-sm text-slate-700">Редове от файла</div>
          <div className="max-h-[50vh] overflow-y-auto">
            <LinesTable rows={L.map((l, i) => ({
              id: String(i), holder: l.holder, subject: l.subject, w1: l.weeksT1, h1: l.hoursT1, w2: l.weeksT2, h2: l.hoursT2, total: l.total, students: l.students,
              teacher: (fixStaff[l.teacher] || l.staffId) ? staffName[fixStaff[l.teacher] || l.staffId!] : l.teacher, warn: !(fixStaff[l.teacher] || l.staffId),
            }))} showHolder />
          </div>
        </div>
      </div>
    )
  }

  // ════════ ЗАПИСАНОТО ════════
  if (!lines.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-4">
        <p className="text-slate-600 text-sm max-w-lg mx-auto">Още няма внесен учебен план. Изтеглете от НЕИСПУО обобщената справка за учебните планове (Excel) и я качете тук.</p>
        {uploadBtn}
      </div>
    )
  }

  const notLinked = new Set(lines.filter(l => !l.staff_id).map(l => l.teacher_name)).size
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-center gap-x-8 gap-y-2">
        <Stat label="реда" v={lines.length} />
        <Stat label="паралелки / групи" v={new Set(lines.map(l => l.holder_label)).size} />
        <Stat label="преподаватели" v={new Set(lines.map(teacherKey)).size} />
        <div>
          <div className="text-xs text-slate-500">внесено</div>
          <div className="text-sm text-slate-800">{new Date(lines[0].imported_at).toLocaleString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        {notLinked > 0 && <span className="inline-flex items-center gap-1 text-xs text-amber-700"><AlertTriangle size={13} /> {notLinked} преподавател(и) без връзка с EIS</span>}
        <div className="ml-auto">{uploadBtn}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
          {([['teachers', 'По учители', Users], ['classes', 'По паралелки', LayoutGrid]] as const).map(([k, l, Icon]) => (
            <button key={k} onClick={() => { setView(k); setOpen(new Set()) }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${view === k ? 'bg-white shadow-sm text-[#0f2240] font-medium' : 'text-slate-500 hover:text-slate-800'}`}>
              <Icon size={15} /> {l}
            </button>
          ))}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси учител, паралелка, предмет…"
          className="w-full sm:w-80 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-teal-400" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-[1fr_90px_90px_90px_60px] px-5 py-2.5 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
          <span>{view === 'teachers' ? 'Преподавател' : 'Паралелка / група'}</span>
          <span className="text-center">I срок ч./седм.</span><span className="text-center">II срок ч./седм.</span><span className="text-center">За годината</span><span className="text-center">Редове</span>
        </div>
        <div className="divide-y divide-slate-100">
          {groups.map(g => {
            const isOpen = open.has(g.key)
            return (
              <div key={g.key}>
                <button onClick={() => toggle(g.key)} className="w-full grid grid-cols-[1fr_90px_90px_90px_60px] items-center px-5 py-2.5 text-sm text-left hover:bg-slate-50">
                  <span className="flex items-center gap-2 min-w-0">
                    {isOpen ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                    <span className="truncate text-slate-800">{g.title}</span>
                    {!g.linked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 shrink-0">няма връзка с EIS</span>}
                  </span>
                  <span className="text-center tabular-nums">{fmt(sum(g.lines, 'hours_t1'))}</span>
                  <span className="text-center tabular-nums">{fmt(sum(g.lines, 'hours_t2'))}</span>
                  <span className="text-center tabular-nums text-slate-800">{fmt(sum(g.lines, 'total_hours'))}</span>
                  <span className="text-center tabular-nums text-slate-400">{g.lines.length}</span>
                </button>
                {isOpen && (
                  <div className="bg-slate-50/60 border-t border-slate-100">
                    <LinesTable rows={g.lines.slice().sort((a, b) => holderSort(a.holder_label, b.holder_label)).map(l => ({
                      id: l.id, holder: l.holder_label, subject: l.subject, w1: l.weeks_t1, h1: l.hours_t1, w2: l.weeks_t2, h2: l.hours_t2, total: l.total_hours, students: l.students,
                      teacher: l.staff_id ? staffName[l.staff_id] || l.teacher_name || '' : l.teacher_name || '', warn: !l.staff_id,
                    }))} showHolder={view === 'teachers'} showTeacher={view === 'classes'} />
                  </div>
                )}
              </div>
            )
          })}
          {groups.length === 0 && <div className="px-5 py-10 text-center text-sm text-slate-400">Няма съвпадения</div>}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, v }: { label: string; v: number | string }) {
  return <div><div className="text-xs text-slate-500">{label}</div><div className="text-lg text-slate-800 tabular-nums">{v}</div></div>
}

function FixBox({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex items-center gap-2 text-sm text-amber-900"><AlertTriangle size={15} /> {title}</div>
      <p className="text-xs text-amber-800/80 mt-1 mb-3">{hint}</p>
      <div className="grid sm:grid-cols-2 gap-2">{children}</div>
    </div>
  )
}

function FixRow({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Ref[] }) {
  return (
    <label className="flex items-center gap-2 bg-white rounded-xl border border-amber-200 px-3 py-2">
      <span className="text-sm text-slate-800 flex-1 truncate">{label}</span>
      <span className="text-slate-400 text-xs">→</span>
      <select value={value} onChange={e => onChange(e.target.value)} className={`text-sm px-2 py-1 rounded-lg border ${value ? 'border-emerald-300 text-emerald-800' : 'border-slate-200 text-slate-500'} bg-white max-w-[200px]`}>
        <option value="">— няма —</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>
  )
}

function LinesTable({ rows, showHolder = false, showTeacher = true }: {
  rows: { id: string; holder: string; subject: string; w1: number; h1: number; w2: number; h2: number; total: number; students: number | null; teacher: string; warn: boolean }[]
  showHolder?: boolean; showTeacher?: boolean
}) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[10.5px] uppercase tracking-wider text-slate-400">
          {showHolder && <th className="pl-11 pr-2 py-2 font-medium">Паралелка</th>}
          <th className={`${showHolder ? 'px-2' : 'pl-11 pr-2'} py-2 font-medium`}>Предмет</th>
          <th className="px-2 py-2 font-medium text-center">I срок</th>
          <th className="px-2 py-2 font-medium text-center">II срок</th>
          <th className="px-2 py-2 font-medium text-center">Общо</th>
          <th className="px-2 py-2 font-medium text-center">Деца</th>
          {showTeacher && <th className="px-2 py-2 font-medium">Преподавател</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id} className="border-t border-slate-100">
            {showHolder && <td className="pl-11 pr-2 py-1.5 text-slate-600 whitespace-nowrap">{r.holder}</td>}
            <td className={`${showHolder ? 'px-2' : 'pl-11 pr-2'} py-1.5 text-slate-800`}>{r.subject}</td>
            <td className="px-2 py-1.5 text-center tabular-nums text-slate-600">{fmt(r.h1)} <span className="text-slate-400">× {r.w1}</span></td>
            <td className="px-2 py-1.5 text-center tabular-nums text-slate-600">{fmt(r.h2)} <span className="text-slate-400">× {r.w2}</span></td>
            <td className="px-2 py-1.5 text-center tabular-nums text-slate-800">{fmt(r.total)}</td>
            <td className="px-2 py-1.5 text-center tabular-nums text-slate-500">{r.students ?? ''}</td>
            {showTeacher && <td className={`px-2 py-1.5 ${r.warn ? 'text-amber-700' : 'text-slate-600'}`}>{r.teacher}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
