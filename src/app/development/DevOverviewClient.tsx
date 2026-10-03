'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Sprout, Search, X, CheckCircle2, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react'
import { GROUPS, roman, severity, fmtD } from '@/app/students/[id]/development/lib'
import type { Profile } from '@/app/students/[id]/development/lib'

export type OverviewRow = {
  id: string; name: string; classId: string; className: string; mine: boolean; profile: Profile | null
  entry: string | null; mid: string | null; exit: string | null; last: string | null
  targets: number; rated: number; reached: number; change: number | null
}

const SEV = { severe: 'bg-rose-50 text-rose-800', moderate: 'bg-amber-50 text-amber-800', mild: 'bg-emerald-50 text-emerald-800' }

export default function DevOverviewClient({ rows, ready, yearName, isPsychologist }: { rows: OverviewRow[]; ready: boolean; yearName: string; isPsychologist: boolean }) {
  const [onlyMine, setOnlyMine] = useState(isPsychologist && rows.some(r => r.mine))
  const [cls, setCls] = useState('')
  const [missing, setMissing] = useState<'' | 'entry' | 'mid' | 'exit' | 'profile'>('')
  const [q, setQ] = useState('')

  const classes = useMemo(() => Array.from(new Map(rows.map(r => [r.classId, r.className])).entries()).filter(([id]) => id), [rows])
  const base = rows.filter(r => !onlyMine || r.mine)
  const shown = base
    .filter(r => !cls || r.classId === cls)
    .filter(r => !missing || (missing === 'profile' ? !r.profile : !r[missing]))
    .filter(r => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()))

  const stat = (k: 'entry' | 'mid' | 'exit') => base.filter(r => r[k]).length
  if (!ready) return (
    <div className="max-w-3xl mx-auto p-8"><div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">Пуснете SQL файловете за „Развитие“ (2026-10-03_development.sql и _development_2.sql).</div></div>
  )

  const Stage = ({ d }: { d: string | null }) => d
    ? <span className="inline-flex items-center gap-1 text-[12px] text-emerald-700"><CheckCircle2 size={13} />{fmtD(d).slice(0, 5)}</span>
    : <span className="text-slate-300">—</span>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-2"><Sprout size={26} className="text-emerald-600" /> Развитие на децата</h1>
          <p className="text-sm text-slate-500 mt-1">{yearName} · {base.length} деца</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {([['entry', 'Входна'], ['mid', 'Междинна'], ['exit', 'Изходна']] as const).map(([k, l]) => (
            <div key={k} className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="text-lg font-semibold text-slate-900 leading-none">{stat(k)}<span className="text-slate-400 text-sm font-normal"> / {base.length}</span></div>
              <div className="text-[11px] text-slate-500 mt-1">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {isPsychologist && (
          <div className="flex rounded-xl bg-slate-100 p-0.5 text-[13px]">
            <button type="button" onClick={() => setOnlyMine(true)} className={`px-3 py-1.5 rounded-lg ${onlyMine ? 'bg-white shadow-sm font-medium' : 'text-slate-600'}`}>Моите деца</button>
            <button type="button" onClick={() => setOnlyMine(false)} className={`px-3 py-1.5 rounded-lg ${!onlyMine ? 'bg-white shadow-sm font-medium' : 'text-slate-600'}`}>Всички</button>
          </div>
        )}
        <select value={cls} onChange={e => setCls(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-[13px]">
          <option value="">Всички паралелки</option>
          {classes.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <select value={missing} onChange={e => setMissing(e.target.value as any)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-[13px]">
          <option value="">Всички</option>
          <option value="entry">Без входна оценка</option>
          <option value="mid">Без междинна оценка</option>
          <option value="exit">Без изходна оценка</option>
          <option value="profile">Без профил</option>
        </select>
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси дете…" className="pl-8 pr-7 py-2 w-52 rounded-xl border border-slate-300 bg-white text-[13px] focus:outline-none focus:border-[#0f2240]" />
          {q && <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"><X size={13} /></button>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-slate-50 text-left text-[11.5px] text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-2.5 font-medium">Дете</th>
              <th className="px-2 py-2.5 font-medium">Паралелка</th>
              <th className="px-2 py-2.5 font-medium">Профил</th>
              <th className="px-2 py-2.5 font-medium">Входна</th>
              <th className="px-2 py-2.5 font-medium">Междинна</th>
              <th className="px-2 py-2.5 font-medium">Изходна</th>
              <th className="px-2 py-2.5 font-medium">Цели (GAS)</th>
              <th className="px-2 py-2.5 font-medium">Промяна</th>
              <th />
            </tr>
          </thead>
          <tbody className="zebra">
            {shown.map(r => {
              const p = r.profile, sev = severity(p)
              return (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-900 whitespace-nowrap">{r.name}</td>
                  <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{r.className}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p ? <>
                        {p.groups.slice(0, 2).map(g => <span key={g} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{GROUPS[g]}</span>)}
                        {p.gmfcs && <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">GMFCS {roman(p.gmfcs)}</span>}
                        {p.asd_level && <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">ниво {p.asd_level}</span>}
                        {sev && <span className={`text-[11px] px-1.5 py-0.5 rounded ${SEV[sev]}`}>{sev === 'severe' ? 'тежки' : sev === 'moderate' ? 'умерени' : 'леки'}</span>}
                      </> : <span className="text-slate-300">—</span>}
                    </div>
                  </td>
                  <td className="px-2 py-2"><Stage d={r.entry} /></td>
                  <td className="px-2 py-2"><Stage d={r.mid} /></td>
                  <td className="px-2 py-2"><Stage d={r.exit} /></td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {r.targets ? <span className={r.rated && r.reached === r.rated ? 'text-emerald-700 font-medium' : 'text-slate-700'}>{r.reached}/{r.rated || 0}<span className="text-slate-400"> · {r.targets} цели</span></span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {r.change === null ? <span className="text-slate-300">—</span>
                      : r.change > 0 ? <span className="inline-flex items-center gap-0.5 text-emerald-700"><TrendingUp size={13} />+{r.change}%</span>
                      : r.change < 0 ? <span className="inline-flex items-center gap-0.5 text-rose-700"><TrendingDown size={13} />{r.change}%</span>
                      : <span className="inline-flex items-center gap-0.5 text-slate-500"><Minus size={13} />0</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Link href={`/students/${r.id}?tab=dev`} className="inline-flex items-center gap-0.5 text-[12px] text-[#0f2240] hover:underline whitespace-nowrap">Отвори <ChevronRight size={13} /></Link>
                  </td>
                </tr>
              )
            })}
            {!shown.length && <tr><td colSpan={9} className="text-center py-12 text-slate-500">Няма деца по този филтър.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
