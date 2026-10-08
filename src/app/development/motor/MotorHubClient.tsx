'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, Search, X, ChevronRight, Users, User, FolderOpen } from 'lucide-react'
import { smartMatch } from '@/lib/search'
import { STAGES, fmtD } from '@/lib/motor'
import MotorSection from '@/app/students/[id]/development/MotorSection'
import GroupMotorClient from './GroupMotorClient'

export type HubKid = {
  id: string; name: string; classId: string; className: string; gmfcs: number | null
  last: string | null; lastStage: string | null; count: number; stages: string[]
}

export default function MotorHubClient({ classes, kids, ready, meId, meName, role, yearId, yearName, initialMode, initialClass }: {
  classes: { id: string; name: string; kids: { id: string; name: string }[] }[]
  kids: HubKid[]; ready: boolean; meId: string; meName: string; role: string
  yearId: string | null; yearName: string; initialMode: 'kids' | 'group'; initialClass: string
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'kids' | 'group'>(initialMode)
  const [cls, setCls] = useState(initialClass)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<HubKid | null>(null)

  // запомня последната паралелка за този браузър (учителят по ФВС минава по паралелки)
  useEffect(() => {
    if (initialClass) return
    try { const c = localStorage.getItem('eis_motor_class'); if (c && classes.some(x => x.id === c)) setCls(c) } catch { /* без localStorage */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const pickClass = (c: string) => { setCls(c); try { localStorage.setItem('eis_motor_class', c) } catch { /* без localStorage */ } }
  const pickMode = (m: 'kids' | 'group') => { setMode(m); window.history.replaceState(null, '', m === 'group' ? '?mode=group' : '?') }

  const shown = useMemo(() => kids.filter(k => (q ? smartMatch(k.name, q) : !cls || k.classId === cls)), [kids, cls, q])
  const done = kids.filter(k => k.count > 0).length

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.panel-in')) close() }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  function close() { setOpen(null); router.refresh() }

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><Activity size={20} className="text-white" /></div>
        <div className="mr-auto">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Двигателна оценка</h1>
          <p className="text-slate-500 text-sm mt-0.5">{yearName} · оценени тази година: {done} от {kids.length} деца</p>
        </div>
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          {([['kids', 'По деца', <User key="u" size={15} />], ['group', 'Групова карта', <Users key="g" size={15} />]] as const).map(([k, l, ic]) => (
            <button key={k} type="button" onClick={() => pickMode(k)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium ${mode === k ? 'bg-[#0f2240] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{ic}{l}</button>
          ))}
        </div>
      </div>

      {!ready && <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Двигателната оценка още не е подготвена в базата — пуснете SQL файла 2026-10-08_motor.sql.</div>}

      {mode === 'group' ? (
        <GroupMotorClient classes={classes} meId={meId} meName={meName} yearId={yearId} yearName={yearName} embedded />
      ) : (<>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 space-y-3">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси дете във всички паралелки…"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 text-[13px] focus:outline-none focus:border-[#0f2240]" />
            {q && <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"><X size={14} /></button>}
          </div>
          {!q && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => pickClass('')}
                className={`px-2.5 py-1 rounded-lg text-[13px] border ${!cls ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'border-slate-300 text-slate-600 hover:border-slate-500'}`}>Всички</button>
              {classes.map(c => (
                <button key={c.id} type="button" onClick={() => pickClass(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-[13px] border ${cls === c.id ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'border-slate-300 text-slate-600 hover:border-slate-500'}`}>{c.name}</button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-xs text-slate-500 text-left">
              <th className="px-4 py-2.5 font-medium">Дете</th>
              <th className="px-3 py-2.5 font-medium">Паралелка</th>
              <th className="px-3 py-2.5 font-medium">Етапи тази година</th>
              <th className="px-3 py-2.5 font-medium">Последна</th>
              <th />
            </tr></thead>
            <tbody>
              {shown.map(k => (
                <tr key={k.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => setOpen(k)}>
                  <td className="px-4 py-2 font-medium text-slate-900">{k.name}{k.gmfcs && k.gmfcs >= 4 ? <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">GMFCS {k.gmfcs === 4 ? 'IV' : 'V'}</span> : null}</td>
                  <td className="px-3 py-2 text-slate-600">{k.className}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {(['entry', 'mid', 'exit'] as const).map(st => (
                        <span key={st} className={`text-[11px] px-1.5 py-0.5 rounded ${k.stages.includes(st) ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-400'}`}>{STAGES[st]}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[12.5px] text-slate-600 whitespace-nowrap">{k.last ? `${fmtD(k.last)} · ${STAGES[k.lastStage || ''] || ''}` : <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-0.5 text-[12.5px] font-medium text-[#0f2240]">{k.count ? 'Отвори' : 'Оцени'} <ChevronRight size={13} /></span>
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={5} className="text-center py-10 text-slate-400">Няма деца.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}

      {/* Индивидуалната оценка на детето — направо тук, без да се търси в досието */}
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) close() }}>
          <div className="max-w-6xl mx-auto my-0 md:my-6 bg-slate-50 md:rounded-3xl shadow-2xl overflow-hidden">
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-5 md:px-6 py-3 bg-white border-b border-slate-200">
              <div className="mr-auto">
                <div className="font-semibold text-slate-900">{open.name}</div>
                <div className="text-[12px] text-slate-500">{open.className}</div>
              </div>
              <Link href={`/students/${open.id}?tab=dev&view=motor`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] border border-slate-300 hover:border-[#0f2240] text-slate-700"><FolderOpen size={14} /> Досие</Link>
              <button type="button" onClick={close} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Затвори"><X size={18} /></button>
            </div>
            <div className="p-4 md:p-6">
              <MotorSection studentId={open.id} studentName={open.name} className={open.className} academicYearId={yearId}
                meId={meId} role={role} gmfcs={open.gmfcs} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
