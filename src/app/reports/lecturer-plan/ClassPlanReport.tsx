'use client'
// Справка „Лекторски по учебен план“ → изглед „По паралелки“ (както е във вноса от НЕИСПУО):
// паралелка · учители · часове седмично (ЗП / ИУЧ / ДПЛР…) · за годината · ИЧ; разгъване — предметите с учителите.

import { Fragment, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Search, ChevronRight, FileSpreadsheet, Printer, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { smartMatch } from '@/lib/search'

export type ClassRow = {
  key: string; name: string; classId: string | null; group: 'class' | 'coud' | 'other'
  teachers: string[]; h1: number; h2: number; total: number; byKind: Record<string, number>
  ich1: number; ichTotal: number
  lines: { id: string; subject: string; teacher: string; teacherOver: number; h1: number; h2: number; total: number; kind: string; individual: boolean; therapy: boolean }[]
}

const f = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')
const byBg = (a: string, b: string) => a.localeCompare(b, 'bg', { numeric: true })
const KIND_ORDER = ['ЗП', 'ИУЧ', 'ДПЛР', 'ОФПВ', 'ЦОУД', '', 'друго']
const kindRank = (k: string) => { const i = KIND_ORDER.indexOf(k); return i < 0 ? 99 : i }
const KIND_CLS: Record<string, string> = {
  'ИУЧ': 'bg-sky-50 text-sky-700 border-sky-200', 'ДПЛР': 'bg-violet-50 text-violet-700 border-violet-200',
  'ЦОУД': 'bg-orange-50 text-orange-700 border-orange-200', 'ОФПВ': 'bg-emerald-50 text-emerald-700 border-emerald-200',
}
const GROUP_LABEL: Record<ClassRow['group'], string> = { class: 'Паралелки', coud: 'Групи ЦОУД', other: 'Други (специалисти)' }

export default function ClassPlanReport({ rows, yearName }: { rows: ClassRow[]; yearName: string }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (k: string) => setOpen(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })

  const visible = useMemo(() => rows
    .filter(r => smartMatch(`${r.name} ${r.teachers.join(' ')} ${r.lines.map(l => l.subject).join(' ')}`, q))
    .sort((a, b) => ['class', 'coud', 'other'].indexOf(a.group) - ['class', 'coud', 'other'].indexOf(b.group) || byBg(a.name, b.name)),
  [rows, q])
  const allOpen = visible.length > 0 && visible.every(r => open.has(r.key))
  const sum = visible.reduce((a, r) => ({ h1: a.h1 + r.h1, total: a.total + r.total, ich: a.ich + r.ich1, ichTotal: a.ichTotal + r.ichTotal }), { h1: 0, total: 0, ich: 0, ichTotal: 0 })

  function exportXlsx() {
    const wb = XLSX.utils.book_new()
    const head = ['Паралелка / група', 'Учители', 'Ч./седм. I срок', 'Ч./седм. II срок', 'ЗП', 'ИУЧ', 'ДПЛР', 'За годината', 'ИЧ ч./седм.', 'ИЧ за годината']
    const data = visible.map(r => [r.name, r.teachers.join(', '), r.h1, r.h2, r.byKind['ЗП'] || 0, r.byKind['ИУЧ'] || 0, r.byKind['ДПЛР'] || 0, r.total, r.ich1, r.ichTotal])
    const ws = XLSX.utils.aoa_to_sheet([head, ...data])
    ws['!cols'] = [{ wch: 18 }, { wch: 50 }, ...head.slice(2).map(() => ({ wch: 12 }))]
    XLSX.utils.book_append_sheet(wb, ws, 'По паралелки')
    const dHead = ['Паралелка / група', 'Предмет', 'Вид', 'ИЧ', 'Учител', 'I срок ч./седм.', 'II срок ч./седм.', 'За годината']
    const dData: (string | number)[][] = []
    visible.forEach(r => sortLines(r.lines).forEach(l => dData.push([r.name, l.subject, l.kind || '', l.individual ? 'ИЧ' : '', l.teacher, l.h1, l.h2, l.total])))
    const ws2 = XLSX.utils.aoa_to_sheet([dHead, ...dData])
    ws2['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 8 }, { wch: 6 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Предмети')
    XLSX.writeFile(wb, `учебен_план_по_паралелки_${(yearName || '').replace(/\W+/g, '-')}.xlsx`)
  }

  const th = 'px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide'
  let lastGroup = ''
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-100 print:hidden">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Паралелка, учител или предмет…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-400" />
        </div>
        <button onClick={() => setOpen(allOpen ? new Set() : new Set(visible.map(r => r.key)))}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
          {allOpen ? <><ChevronsDownUp size={15} /> Свий всички</> : <><ChevronsUpDown size={15} /> Разгъни всички</>}
        </button>
        <div className="ml-auto flex gap-2">
          <button onClick={exportXlsx} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm border border-slate-200 text-slate-700 hover:border-[#0f2240]"><FileSpreadsheet size={15} /> Excel</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm border border-slate-200 text-slate-700 hover:border-[#0f2240]"><Printer size={15} /> Печат</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70">
            <tr className="text-left">
              <th className={th}>Паралелка</th>
              <th className={th}>Учители</th>
              <th className={`${th} text-center`}>Ч./седм.</th>
              <th className={th}>В т.ч.</th>
              <th className={`${th} text-center`}>За годината</th>
              <th className={`${th} text-center text-violet-700`}>ИЧ</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(r => {
              const isOpen = open.has(r.key)
              const header = r.group !== lastGroup && rows.some(x => x.group !== 'class') ? (lastGroup = r.group, true) : (lastGroup = r.group, false)
              const kinds = Object.entries(r.byKind).filter(([, h]) => h > 0).sort((a, b) => kindRank(a[0]) - kindRank(b[0]))
              return (
                <Fragment key={r.key}>
                  {header && <tr><td colSpan={6} className="px-3 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">{GROUP_LABEL[r.group]}</td></tr>}
                  <tr onClick={() => toggle(r.key)} className={`border-t border-slate-100 cursor-pointer hover:bg-slate-50/70 ${isOpen ? 'bg-slate-50/70' : ''}`}>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                        <ChevronRight size={14} className={`text-slate-400 transition-transform print:hidden ${isOpen ? 'rotate-90' : ''}`} />{r.name}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-slate-600">{r.teachers.join(', ') || '—'}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-800">{f(r.h1)}{r.h2 !== r.h1 && <span className="text-[11px] text-slate-400"> / {f(r.h2)}</span>}</td>
                    <td className="px-3 py-2.5 text-[12px] text-slate-500 whitespace-nowrap">{kinds.length > 1 ? kinds.map(([k, h]) => `${k} ${f(h)}`).join(' · ') : kinds[0]?.[0] || ''}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-700">{r.total || '—'}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-violet-700">{r.ich1 ? <>{f(r.ich1)}<span className="text-[11px] text-violet-400"> · {r.ichTotal} г.</span></> : <span className="text-slate-300">—</span>}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={6} className="px-3 pb-3 pt-0">
                        <table className="w-full text-[13px] ml-6 max-w-4xl">
                          <thead><tr className="text-left text-[11px] text-slate-400">
                            <th className="py-1.5 pr-3 font-medium">Предмет</th><th className="py-1.5 pr-3 font-medium">Учител</th>
                            <th className="py-1.5 px-2 font-medium text-center w-16">I срок</th><th className="py-1.5 px-2 font-medium text-center w-16">II срок</th><th className="py-1.5 px-2 font-medium text-center w-20">годишно</th>
                          </tr></thead>
                          <tbody>
                            {sortLines(r.lines).map(l => (
                              <tr key={l.id} className="border-t border-slate-200/70">
                                <td className="py-1.5 pr-3 text-slate-800">
                                  {l.subject}
                                  {l.kind && l.kind !== 'ЗП' && <span className={`ml-1.5 text-[10px] px-1.5 py-px rounded border ${KIND_CLS[l.kind] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{l.kind}</span>}
                                  {l.therapy && <span className="ml-1.5 text-[10px] px-1.5 py-px rounded border bg-violet-50 text-violet-700 border-violet-200">0,7</span>}
                                  {l.individual && <span className="ml-1.5 text-[10px] px-1.5 py-px rounded border bg-violet-50 text-violet-700 border-violet-200">ИЧ</span>}
                                </td>
                                <td className="py-1.5 pr-3 text-slate-600">
                                  {l.teacher || '—'}
                                  {l.teacherOver > 0 && <span title="Учителят има часове над норматива (по плана, I срок)" className="ml-1.5 text-[10px] px-1.5 py-px rounded border bg-teal-50 text-teal-700 border-teal-200">+{f(l.teacherOver)} над норм.</span>}
                                </td>
                                <td className="py-1.5 px-2 text-center tabular-nums">{f(l.h1)}</td>
                                <td className="py-1.5 px-2 text-center tabular-nums">{f(l.h2)}</td>
                                <td className="py-1.5 px-2 text-center tabular-nums text-slate-500">{f(l.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {visible.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">Няма редове</td></tr>}
          </tbody>
          {visible.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/70 text-slate-700">
                <td className="px-3 py-2.5 font-medium" colSpan={2}>Общо · {visible.length}</td>
                <td className="px-3 py-2.5 text-center tabular-nums font-medium">{f(sum.h1)}</td>
                <td />
                <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-slate-900">{sum.total}</td>
                <td className="px-3 py-2.5 text-center tabular-nums text-violet-700">{sum.ich ? <>{f(sum.ich)} · {sum.ichTotal} г.</> : '—'}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="px-5 py-3 text-xs text-slate-500 border-t border-slate-100">
        Часовете са по учебния план (НЕИСПУО), реални — без 0,7. Щракнете върху паралелка за предметите и учителите; „+N над норм.“ — учителят има лекторски над норматива (вижте „По учители“).
      </div>
    </div>
  )
}

function sortLines<T extends { individual: boolean; kind: string; subject: string; teacher: string }>(ls: T[]) {
  return ls.slice().sort((a, b) => Number(a.individual) - Number(b.individual) || kindRank(a.kind) - kindRank(b.kind) || byBg(a.subject, b.subject) || byBg(a.teacher, b.teacher))
}
