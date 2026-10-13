'use client'
import { useMemo, useState, type ReactNode } from 'react'
import { Loader2, Printer, FileText, Search, Check } from 'lucide-react'
import { generateStudentsReportPDF, type StudentsReportData } from '@/lib/pdf-generator'
import { generateStudentsReportDocx } from '@/lib/docx-students-report'

export type StudentRow = {
  id: string
  name: string
  schoolId: string
  school: string     // „име, населено място“
  schoolType: string
  city: string
  ext: string        // клас в училището, с буквата: "V а"
  grade: number      // за подреждане: ПГ=0, непознат=99
  className: string  // паралелка в ЦСОП
  classTeacher: string
  form: string       // Дневна / ИФО
}

type GroupBy = 'school' | 'type' | 'city' | 'class' | 'grade' | 'none'
type SortBy = 'name' | 'grade' | 'school'
type Col = 'school' | 'ext' | 'className' | 'classTeacher' | 'form'
type FormFilter = 'all' | 'Дневна' | 'ИФО'

const SCHOOL_TYPES = ['ДГ', 'НУ', 'ОУ', 'ОбУ', 'СУ', 'ПГ', 'ПрофГ', 'Друго']
const ROMAN = ['ПГ', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII']

const GROUPS: { v: GroupBy; l: string; t: string }[] = [
  { v: 'school', l: 'Училище', t: 'по училище' },
  { v: 'type', l: 'Вид училище', t: 'по вид училище' },
  { v: 'city', l: 'Град', t: 'по град' },
  { v: 'grade', l: 'Клас', t: 'по клас в училището' },
  { v: 'class', l: 'Паралелка ЦСОП', t: 'по паралелка в ЦСОП' },
  { v: 'none', l: 'Без групиране', t: '' },
]
const SORTS: { v: SortBy; l: string; t: string }[] = [
  { v: 'name', l: 'Азбучно', t: 'азбучно' },
  { v: 'grade', l: 'По клас', t: 'по клас' },
  { v: 'school', l: 'По училище', t: 'по училище' },
]
const COLS: { v: Col; l: string; w: number }[] = [
  { v: 'school', l: 'Училище', w: 30 },
  { v: 'ext', l: 'Клас', w: 8 },
  { v: 'className', l: 'Паралелка', w: 10 },
  { v: 'classTeacher', l: 'Класен ръководител', w: 22 },
  { v: 'form', l: 'Форма', w: 9 },
]
// колона, която е излишна при дадено групиране (стойността ѝ е в заглавието на групата)
const IMPLIED: Partial<Record<GroupBy, Col[]>> = {
  school: ['school'],
  grade: ['ext'],
  class: ['className', 'classTeacher'],
}

const coll = new Intl.Collator('bg')
const cmp = (a: string, b: string) => coll.compare(a, b)
const gradeLabel = (g: number) => (g === 99 ? 'Без посочен клас' : g === 0 ? 'ПГ' : `${ROMAN[g] || g} клас`)
const typeOrder = (t: string) => { const i = SCHOOL_TYPES.indexOf(t); return i < 0 ? 50 : i }
const kids = (n: number) => `${n} ${n === 1 ? 'дете' : 'деца'}`
const schoolsWord = (n: number) => `${n} ${n === 1 ? 'училище' : 'училища'}`

type Group = { key: string; title: string; meta: string; rows: StudentRow[] }

function value(r: StudentRow, c: Col): string {
  return r[c] || ''
}

function buildGroups(rows: StudentRow[], groupBy: GroupBy, sortBy: SortBy): Group[] {
  const inner = (a: StudentRow, b: StudentRow) => {
    if (sortBy === 'grade') return a.grade - b.grade || cmp(a.ext, b.ext) || cmp(a.name, b.name)
    if (sortBy === 'school') return cmp(a.school || 'я', b.school || 'я') || cmp(a.name, b.name)
    return cmp(a.name, b.name)
  }
  const keyOf = (r: StudentRow): string => {
    switch (groupBy) {
      case 'school': return r.schoolId
      case 'type': return r.schoolType
      case 'city': return r.city
      case 'class': return r.className
      case 'grade': return String(r.grade)
      default: return ''
    }
  }
  const map = new Map<string, StudentRow[]>()
  rows.forEach(r => { const k = keyOf(r); (map.get(k) || map.set(k, []).get(k)!).push(r) })

  const groups: Group[] = Array.from(map.entries()).map(([k, rs]) => {
    rs.sort(inner)
    const nSchools = new Set(rs.map(r => r.schoolId).filter(Boolean)).size
    let title = k, meta = kids(rs.length)
    if (groupBy === 'school') {
      title = rs[0].school || 'Без изпращащо училище'
      meta = [rs[0].schoolType, kids(rs.length)].filter(Boolean).join(' · ')
    } else if (groupBy === 'type') {
      title = k || 'Без посочен вид'
      meta = `${kids(rs.length)} · ${schoolsWord(nSchools)}`
    } else if (groupBy === 'city') {
      title = k || 'Без посочен град'
      meta = `${kids(rs.length)} · ${schoolsWord(nSchools)}`
    } else if (groupBy === 'class') {
      title = k ? `Паралелка ${k}` : 'Без паралелка'
      const t = rs.find(r => r.classTeacher)?.classTeacher
      meta = [t ? `класен: ${t}` : '', kids(rs.length)].filter(Boolean).join(' · ')
    } else if (groupBy === 'grade') {
      title = gradeLabel(Number(k))
      meta = `${kids(rs.length)} · ${schoolsWord(nSchools)}`
    } else {
      title = ''
      meta = ''
    }
    return { key: k, title, meta, rows: rs }
  })

  const last = (k: string) => (k ? 0 : 1) // празните групи отиват накрая
  groups.sort((a, b) => {
    if (groupBy === 'grade') return Number(a.key) - Number(b.key)
    if (last(a.key) !== last(b.key)) return last(a.key) - last(b.key)
    if (groupBy === 'type') return typeOrder(a.key) - typeOrder(b.key) || cmp(a.key, b.key)
    if (groupBy === 'school') return cmp(a.title, b.title)
    if (groupBy === 'class') return (parseInt(a.key) || 999) - (parseInt(b.key) || 999) || cmp(a.key, b.key)
    return cmp(a.key, b.key)
  })
  return groups
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 p-1 rounded-xl bg-slate-100">
      {options.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${value === o.v ? 'bg-white shadow-sm text-[#0f2240] font-medium' : 'text-slate-500 hover:text-slate-700'}`}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <div className="text-xs text-slate-500 w-24 shrink-0 pt-2">{children}</div>
}

export default function BySchoolClient({ rows, yearName }: { rows: StudentRow[]; yearName: string }) {
  const [groupBy, setGroupBy] = useState<GroupBy>('school')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [cols, setCols] = useState<Col[]>(['school', 'ext', 'className', 'classTeacher'])
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [city, setCity] = useState('')
  const [form, setForm] = useState<FormFilter>('all')
  const [busy, setBusy] = useState<'' | 'docx' | 'pdf'>('')

  const types = useMemo(() => Array.from(new Set(rows.map(r => r.schoolType).filter(Boolean))).sort((a, b) => typeOrder(a) - typeOrder(b) || cmp(a, b)), [rows])
  const cities = useMemo(() => Array.from(new Set(rows.map(r => r.city).filter(Boolean))).sort(cmp), [rows])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter(r =>
      (!type || r.schoolType === type) &&
      (!city || r.city === city) &&
      (form === 'all' || r.form === form) &&
      (!s || r.name.toLowerCase().includes(s) || r.school.toLowerCase().includes(s)))
  }, [rows, q, type, city, form])

  const groups = useMemo(() => buildGroups(filtered, groupBy, sortBy), [filtered, groupBy, sortBy])
  const shownCols = COLS.filter(c => cols.includes(c.v) && !(IMPLIED[groupBy] || []).includes(c.v))
  const nSchools = new Set(filtered.map(r => r.schoolId).filter(Boolean)).size

  function toggleCol(c: Col) {
    setCols(cs => (cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]))
  }

  function reportData(): StudentsReportData {
    const g = GROUPS.find(x => x.v === groupBy)!
    const so = SORTS.find(x => x.v === sortBy)!
    const parts = [`Учебна ${yearName} г.`]
    if (g.t) parts.push(`групирани ${g.t}`)
    parts.push(`подредени ${so.t}`)
    const flt = [type, city, form !== 'all' ? form : '', q.trim() ? `„${q.trim()}“` : ''].filter(Boolean)
    if (flt.length) parts.push(`филтър: ${flt.join(', ')}`)
    return {
      title: 'Ученици по изпращащи училища',
      subtitle: parts.join(' · '),
      headers: ['Име, презиме, фамилия', ...shownCols.map(c => c.l)],
      widths: [30, ...shownCols.map(c => c.w)],
      groups: groups.map(gr => ({ title: gr.title, meta: gr.meta, cells: gr.rows.map(r => [r.name, ...shownCols.map(c => value(r, c.v))]) })),
      total: filtered.length,
      landscape: shownCols.length >= 4,
      fileName: `Ученици_${g.v === 'none' ? 'списък' : g.t.replace(/\s+/g, '_')}_${yearName.replace('/', '-')}`,
    }
  }

  async function download(kind: 'docx' | 'pdf') {
    setBusy(kind)
    try {
      const d = reportData()
      if (kind === 'docx') await generateStudentsReportDocx(d)
      else await generateStudentsReportPDF(d)
    } finally { setBusy('') }
  }

  const sel = 'px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20'

  return (
    <div className="space-y-4">
      {/* Настройки */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex gap-3 flex-wrap sm:flex-nowrap"><Label>Групиране</Label>
          <Seg value={groupBy} onChange={setGroupBy} options={GROUPS} />
        </div>
        <div className="flex gap-3 flex-wrap sm:flex-nowrap"><Label>Подреждане</Label>
          <Seg value={sortBy} onChange={setSortBy} options={SORTS} />
        </div>
        <div className="flex gap-3 flex-wrap sm:flex-nowrap"><Label>Филтри</Label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Име или училище…" className="pl-8 pr-3 py-1.5 w-52 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20" />
            </div>
            <select value={type} onChange={e => setType(e.target.value)} className={sel}>
              <option value="">Всички видове</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={city} onChange={e => setCity(e.target.value)} className={sel}>
              <option value="">Всички градове</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <Seg value={form} onChange={setForm} options={[{ v: 'all', l: 'Всички' }, { v: 'Дневна', l: 'Дневна' }, { v: 'ИФО', l: 'ИФО' }]} />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap sm:flex-nowrap"><Label>Колони</Label>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {COLS.map(c => {
              const on = cols.includes(c.v)
              const implied = (IMPLIED[groupBy] || []).includes(c.v)
              return (
                <button key={c.v} type="button" onClick={() => toggleCol(c.v)} disabled={implied}
                  title={implied ? 'Вижда се в заглавието на групата' : undefined}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border transition-all disabled:opacity-40 disabled:cursor-default ${on && !implied ? 'border-[#0f2240]/30 bg-[#0f2240]/5 text-[#0f2240]' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  {on && !implied && <Check size={13} />}{c.l}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Брояч + изтегляне */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          <span className="font-medium text-slate-800">{filtered.length}</span> ученици · {schoolsWord(nSchools)}
          {groupBy !== 'none' && <> · {groups.length} групи</>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => download('pdf')} disabled={!!busy || filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50">
            {busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />} PDF
          </button>
          <button onClick={() => download('docx')} disabled={!!busy || filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
            {busy === 'docx' ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Изтегли Word
          </button>
        </div>
      </div>

      {/* Резултат */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-dashed border-slate-300">Няма ученици по тези филтри.</div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <div key={g.key || '_'} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {g.title && (
                <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100">
                  <span className="text-sm font-medium text-slate-800">{g.title}</span>
                  {g.meta && <span className="text-xs text-slate-500"> · {g.meta}</span>}
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-100">
                    <th className="px-3 py-1.5 w-10 text-center font-normal">№</th>
                    <th className="px-3 py-1.5 text-left font-normal">Име</th>
                    {shownCols.map(c => <th key={c.v} className="px-3 py-1.5 text-left font-normal">{c.l}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r, j) => (
                    <tr key={r.id} className={`border-b border-slate-50 last:border-0 ${j % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                      <td className="px-3 py-1.5 text-center text-slate-400 text-xs">{j + 1}</td>
                      <td className="px-3 py-1.5 text-slate-800">{r.name}</td>
                      {shownCols.map(c => <td key={c.v} className="px-3 py-1.5 text-slate-600">{value(r, c.v) || '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
