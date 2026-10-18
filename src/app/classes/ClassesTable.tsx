'use client'

// Паралелки — по един ред: № · класен · децата (с полезното за тях) · какво иска внимание · разписание.
// „Внимание“ показва само проблемите; когато всичко е наред — бледо ✓. Филтрите горе броят сами.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarClock, Check } from 'lucide-react'
import OutreachBadge from '@/components/OutreachBadge'
import { fetchDocCounts } from '@/lib/doc-counts-client'

export type ClassRow = {
  id: string; name: string; outreach: string | null
  teachers: string[]; teacherId: string | null
  studentIds: string[]; count: number; ifo: number; coud: number; isNew: number; ores: number; absentToday: number
  noEplr: number; hasSchedule: boolean; iup: 'done' | 'due' | 'later' | 'off'
}
type Filter = 'all' | 'attention' | 'schedule' | 'docs' | 'eplr' | 'iup' | 'outreach'

export default function ClassesTable({ rows, term, iupLabel, initialFilter = 'all' }: {
  rows: ClassRow[]; term: number; iupLabel: string; initialFilter?: Filter
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [docs, setDocs] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    const ids = rows.flatMap(r => r.studentIds)
    if (!ids.length) { setDocs({}); return }
    fetchDocCounts(ids).then(setDocs)
  }, [rows])

  const noDocs = (r: ClassRow) => (docs ? r.studentIds.filter(i => !docs[i]).length : 0)
  const problems = (r: ClassRow) => {
    const p: { key: string; label: string; title: string }[] = []
    if (!r.hasSchedule) p.push({ key: 'schedule', label: 'няма разп.', title: `Няма разписание за ${term} срок` })
    if (r.iup === 'due') p.push({ key: 'iup', label: 'ИУП —', title: `Реализацията на ИУП за ${iupLabel} не е подадена` })
    const nd = noDocs(r)
    if (nd) p.push({ key: 'docs', label: `${nd} без док.`, title: `${nd} деца без нито един документ в Drive` })
    if (r.noEplr) p.push({ key: 'eplr', label: `${r.noEplr} без ЕПЛР екип`, title: `${r.noEplr} деца без ЕПЛР екип за годината` })
    return p
  }
  const counts = useMemo(() => ({
    all: rows.length,
    attention: rows.filter(r => problems(r).length).length,
    schedule: rows.filter(r => !r.hasSchedule).length,
    docs: docs ? rows.filter(r => noDocs(r) > 0).length : null,
    eplr: rows.filter(r => r.noEplr > 0).length,
    iup: rows.filter(r => r.iup === 'due').length,
    outreach: rows.filter(r => r.outreach).length,
  }), [rows, docs]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = rows.filter(r => {
    if (filter === 'attention') return problems(r).length > 0
    if (filter === 'schedule') return !r.hasSchedule
    if (filter === 'docs') return noDocs(r) > 0
    if (filter === 'eplr') return r.noEplr > 0
    if (filter === 'iup') return r.iup === 'due'
    if (filter === 'outreach') return !!r.outreach
    return true
  })

  const chip = (k: Filter, label: string, n: number | null, tone: 'plain' | 'warn' | 'teal' = 'plain') => {
    if (k !== 'all' && k !== 'attention' && !n) return null
    const on = filter === k
    const base = tone === 'warn' ? 'text-amber-800 border-amber-200 bg-amber-50/60' : tone === 'teal' ? 'text-teal-700 border-teal-200 bg-teal-50/50' : 'text-slate-600 border-slate-200 bg-white'
    return (
      <button key={k} type="button" onClick={() => setFilter(on && k !== 'all' ? 'all' : k)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12.5px] border transition-colors ${on ? 'ring-2 ring-[#0f2240]/25 border-[#0f2240]/40 bg-white text-[#0f2240]' : base + ' hover:border-slate-300'}`}>
        {label} <span className="tabular-nums text-[11px] opacity-70">{n ?? '…'}</span>
      </button>
    )
  }

  const COLS = 'md:grid-cols-[64px_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.3fr)_40px]'
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {chip('all', 'Всички', counts.all)}
        {chip('attention', 'Искат внимание', counts.attention, 'warn')}
        {chip('schedule', 'Без разписание', counts.schedule, 'warn')}
        {chip('docs', 'Деца без документи', counts.docs, 'warn')}
        {chip('eplr', 'Без ЕПЛР екип', counts.eplr, 'warn')}
        {chip('iup', 'ИУП не е подаден', counts.iup, 'warn')}
        {chip('outreach', 'Изнесени', counts.outreach, 'teal')}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className={`hidden md:grid ${COLS} gap-3 px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 text-[10.5px] text-slate-400 uppercase tracking-widest`}>
          <span>Паралелка</span><span>Класен ръководител</span><span>Деца</span><span>Внимание</span><span />
        </div>
        {shown.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Няма паралелки</div>}
        {shown.map((r, i) => {
          const p = problems(r)
          const info = [
            r.ifo ? `${r.ifo} ИФО` : '', r.coud ? `${r.coud} ЦОУД` : '',
          ].filter(Boolean)
          return (
            <div key={r.id} onClick={() => router.push(`/classes/${r.id}`)}
              className={`grid grid-cols-[56px_minmax(0,1fr)_40px] ${COLS} gap-x-3 gap-y-1 px-4 py-2.5 items-center border-b border-slate-100 last:border-0 cursor-pointer hover:bg-sky-50/40 transition-colors ${i % 2 ? 'bg-slate-50/40' : ''}`}>
              <Link href={`/classes/${r.id}`} onClick={e => e.stopPropagation()} className="text-[14px] text-[#0f2240] tabular-nums flex items-center gap-1.5">
                {r.name}
              </Link>
              <div className="min-w-0 text-[13px] text-slate-700 truncate flex items-center gap-2">
                <span className="truncate">{r.teachers.join(', ') || <span className="text-slate-300">без класен</span>}</span>
                {r.outreach && <OutreachBadge location={r.outreach} size="xs" />}
              </div>
              {/* мобилно: иконата е в първия ред; на десктоп — в последната колона */}
              <div className="md:hidden row-start-1 col-start-3 justify-self-end">{schedLink(r)}</div>
              <div className="col-span-3 md:col-span-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-slate-600">
                <span className="tabular-nums"><span className="text-slate-800">{r.count}</span> деца</span>
                {info.map(t => <span key={t} className="text-slate-400">· {t}</span>)}
                {r.isNew > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700">{r.isNew} нов{r.isNew > 1 ? 'и' : ''}</span>}
                {r.ores > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700" title="В ОРЕС в момента">{r.ores} ОРЕС</span>}
                {r.absentToday > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600" title="Отсъстват днес (отразено от класния)">{r.absentToday} отсъства{r.absentToday > 1 ? 'т' : ''}</span>}
              </div>
              <div className="col-span-3 md:col-span-1 flex flex-wrap items-center gap-1">
                {!docs && r.studentIds.length > 0 && <span className="inline-block w-12 h-4 rounded-full bg-slate-100 animate-pulse" />}
                {p.map(x => <span key={x.key} title={x.title} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100">{x.label}</span>)}
                {docs && p.length === 0 && <span className="text-emerald-600/60" title="Всичко е наред"><Check size={15} /></span>}
              </div>
              <div className="hidden md:flex justify-center">{schedLink(r)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )

  function schedLink(r: ClassRow) {
    return (
      <Link href={r.teacherId ? `/my-schedule/edit?staff=${r.teacherId}` : `/classes/${r.id}/schedule-view`} onClick={e => e.stopPropagation()}
        className="inline-flex items-center justify-center text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg p-1.5 transition-colors" title="Разписание">
        <CalendarClock size={16} />
      </Link>
    )
  }
}
