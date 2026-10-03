'use client'
import { useEffect, useState } from 'react'
import OutreachBadge from '@/components/OutreachBadge'
import Link from 'next/link'
import { HeartPulse, Users, FileText, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import StudentWorkDocs from '@/app/students/[id]/StudentWorkDocs'
import { studentDocCounts } from './class-drive-actions'
interface TherapyRow {
  id: string
  name: string
  className: string
  outreach?: string
  intensity: string
  sendingSchool: string
  others: string[]
}
interface EplrRow {
  id: string
  name: string
  className: string
  outreach?: string
  classTeacher: string
  docsCompleted: number
  docsTotal: number
  isReal: boolean
}
export default function SpecialistTabs({ therapyRows, eplrRows }: { therapyRows: TherapyRow[]; eplrRows: EplrRow[] }) {
  const [tab, setTab] = useState<'therapy' | 'eplr' | 'mine'>('therapy')
  // Карти по 9 (3×3) със странициране; филтър по паралелка (помни се в браузъра)
  const PER_PAGE = 9
  const [cls, setCls] = useState<string>('')
  const [page, setPage] = useState(1)
  useEffect(() => { try { setCls(localStorage.getItem('eis_ther_cls') || '') } catch { /* няма достъп */ } }, [])
  const pickCls = (k: string) => { setCls(k); setPage(1); try { localStorage.setItem('eis_ther_cls', k) } catch { /* няма достъп */ } }
  const [q, setQ] = useState('')
  const [onlyNoDocs, setOnlyNoDocs] = useState(false)
  const shortName = (full: string) => { const p = full.trim().split(/\s+/); return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : full }
  // брой документи на всяко дете (от Drive) — зарежда се след показването
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    if (!therapyRows.length) return
    studentDocCounts(therapyRows.map(r => r.id)).then(setCounts).catch(() => setCounts({}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      {/* Табове */}
      <div className="flex flex-wrap gap-1 p-1.5 border-b border-slate-100 bg-slate-50/50">
        <button onClick={() => setTab('therapy')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'therapy' ? 'bg-white shadow-sm text-teal-700 border border-teal-100' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <HeartPulse size={15} />
          Деца за терапия
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${tab === 'therapy' ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-500'}`}>
            {therapyRows.length}
          </span>
        </button>
        <button onClick={() => setTab('eplr')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'eplr' ? 'bg-white shadow-sm text-blue-700 border border-blue-100' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <Users size={15} />
          ЕПЛР състав
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${tab === 'eplr' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
            {eplrRows.length}
          </span>
        </button>
        <button onClick={() => setTab('mine')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'mine' ? 'bg-white shadow-sm text-sky-700 border border-sky-100' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <FileText size={15} />
          Моите документи
        </button>
      </div>
      {/* ТАБ 3: Моите документи — личната папка в Drive */}
      {tab === 'mine' && (
        <div className="p-4">
          <StudentWorkDocs staff />
        </div>
      )}
      {/* ТАБ 1: Децата за терапия като карти — кликът отваря досието в „Документи“ */}
      {tab === 'therapy' && (
        therapyRows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Още нямате зачислени деца за терапия.<br />
            <Link href="/my-activities" className="text-teal-600 hover:underline text-xs">Добави от „Моите дейности" →</Link>
          </div>
        ) : (() => {
          const romanVal = (x: string) => { const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 }; let n = 0; for (let i = 0; i < x.length; i++) { const c = v[x[i]] || 0, d = v[x[i + 1]] || 0; n += c < d ? -c : c } return n || 999 }
          const sorted = [...therapyRows].sort((a, b) => (romanVal(a.className || '—') - romanVal(b.className || '—')) || a.name.localeCompare(b.name, 'bg'))
          const classes = Array.from(new Set(sorted.map(r => r.className || '—')))
          const curCls = classes.includes(cls) ? cls : ''
          const needle = q.trim().toLowerCase()
          const shown = sorted.filter(r =>
            (!curCls || (r.className || '—') === curCls) &&
            (!needle || r.name.toLowerCase().includes(needle)) &&
            (!onlyNoDocs || (counts && !counts[r.id])))
          const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE))
          const pg = Math.min(page, pages)
          const pageRows = shown.slice((pg - 1) * PER_PAGE, pg * PER_PAGE)
          const chip = (active: boolean) => `inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-colors whitespace-nowrap ${
            active ? 'bg-slate-100 border-slate-400 text-[#0f2240] font-medium' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`
          const count = (k: string) => sorted.filter(r => (r.className || '—') === k).length
          return (
            <div className="p-4 space-y-3">
              {/* Филтри: паралелка · търсене · без документи */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={() => pickCls('')} className={chip(!curCls)}>
                  Всички <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-white">{sorted.length}</span>
                </button>
                {classes.map(k => (
                  <button key={k} type="button" onClick={() => pickCls(k)} className={chip(curCls === k)} title={k === '—' ? 'Без паралелка' : `Паралелка ${k}`}>
                    {k} <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-slate-100">{count(k)}</span>
                  </button>
                ))}
                <div className="relative ml-auto w-full sm:w-52">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Търси дете…"
                    className="w-full pl-7 pr-7 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-slate-400" />
                  {q && <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X size={12} /></button>}
                </div>
                {counts && therapyRows.some(r => !counts[r.id]) && (
                  <button type="button" onClick={() => { setOnlyNoDocs(v => !v); setPage(1) }}
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition ${onlyNoDocs ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50'}`}>
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> без документи · {therapyRows.filter(r => !counts[r.id]).length}
                  </button>
                )}
              </div>

              {/* Карти 3×3 */}
              {pageRows.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">Няма деца по този филтър.</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pageRows.map(r => {
                    const n = counts?.[r.id]
                    return (
                      <Link key={r.id} href={`/students/${r.id}`}
                        className="group flex flex-col gap-1.5 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-[#0f2240]/40 transition">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[15px] text-slate-900 group-hover:text-[#0f2240] leading-snug">{r.name}</span>
                          {counts === null ? (
                            <span className="shrink-0 w-10 h-5 rounded-full bg-slate-100 animate-pulse" />
                          ) : n ? (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 text-[11px]" title="Документи в Drive">
                              <FileText size={11} /> {n}
                            </span>
                          ) : (
                            <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px]">няма док.</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 truncate" title={r.sendingSchool}>
                          {r.outreach && <span className="mr-1"><OutreachBadge location={r.outreach} size="xs" /></span>}
                          {[r.className && `паралелка ${r.className}`, r.sendingSchool].filter(Boolean).join(' · ')}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-auto pt-1 text-[11px] text-slate-500">
                          {r.intensity && (
                            <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-100">
                              {r.intensity}{/^\d+$/.test(r.intensity) ? ' ч./седм.' : ''}
                            </span>
                          )}
                          {r.others.length > 0 && <span className="truncate" title={r.others.join(' · ')}>също: {r.others.join(' · ')}</span>}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}

              {/* Страници */}
              {pages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500 tabular-nums">{(pg - 1) * PER_PAGE + 1}–{Math.min(pg * PER_PAGE, shown.length)} от {shown.length}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={pg <= 1} onClick={() => setPage(pg - 1)}
                      className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={14} /></button>
                    {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
                      <button key={n} type="button" onClick={() => setPage(n)}
                        className={`w-7 h-7 rounded-lg text-xs tabular-nums ${n === pg ? 'bg-slate-100 border border-slate-400 text-[#0f2240] font-medium' : 'text-slate-500 hover:bg-slate-50'}`}>{n}</button>
                    ))}
                    <button type="button" disabled={pg >= pages} onClick={() => setPage(pg + 1)}
                      className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          )
        })()
      )}
      {/* ТАБ 2: ЕПЛР състав — паралелка · класен */}
      {tab === 'eplr' && (
        <div className="divide-y divide-slate-50 zebra">
          {eplrRows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Няма деца в моя ЕПЛР състав.</div>
          ) : (
            <>
              {eplrRows.map((r, idx) => (
                <div key={r.id} className={`px-4 py-2 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-blue-50/40`}>
                  <Link href={`/students/${r.id}`}
                    className={`text-sm hover:underline ${r.isReal ? 'font-semibold text-slate-800' : 'font-normal text-slate-600'}`}>
                    {r.name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {r.className && <span className="text-[11px] text-slate-500">Паралелка {r.className}</span>}
                    {r.outreach && <OutreachBadge location={r.outreach} size="xs" />}
                    {r.classTeacher && <span className="text-[11px] text-slate-400">· класен: {r.classTeacher}</span>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
