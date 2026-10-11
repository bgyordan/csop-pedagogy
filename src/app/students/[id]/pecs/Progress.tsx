'use client'

// Напредък: % „сам“ по занимания (една линия), прагът за следващ етап и смяната на етапите.
// Под графиката — матрицата „кой и къде“: генерализацията се вижда с един поглед.

import { useState } from 'react'
import { ROMAN, PHASE_COLOR, fmtDate, generalization, pct } from './lib'
import type { Session } from './lib'

const W = 640, H = 210, L = 34, R = 12, T = 16, B = 26
const LINE = '#2563eb'

export function ProgressChart({ sessions, criterion }: { sessions: Session[]; criterion: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const list = sessions.filter(s => s.trials > 0).slice().sort((a, b) => a.held_on.localeCompare(b.held_on) || a.created_at.localeCompare(b.created_at)).slice(-40)
  if (list.length < 2) return <div className="h-40 flex items-center justify-center text-[13px] text-slate-400 text-center px-6">Графиката се появява след второто занимание.</div>
  const x = (i: number) => L + (i / (list.length - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - v / 100) * (H - T - B)
  const pts = list.map((s, i) => [x(i), y(pct(s))] as const)
  const changes = list.map((s, i) => i > 0 && s.phase !== list[i - 1].phase ? i : -1).filter(i => i > 0)
  const h = hover != null ? list[hover] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setHover(null)}>
        {[0, 50, 100].map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#94a3b8">{v}%</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(criterion)} y2={y(criterion)} stroke="#16a34a" strokeWidth={1.2} strokeDasharray="5 4" />
        <text x={W - R} y={y(criterion) - 5} textAnchor="end" fontSize={11} fill="#15803d">праг {criterion}%</text>
        {changes.map(i => (
          <g key={i}>
            <line x1={(x(i) + x(i - 1)) / 2} x2={(x(i) + x(i - 1)) / 2} y1={T} y2={H - B} stroke="#cbd5e1" strokeDasharray="3 3" />
            <text x={(x(i) + x(i - 1)) / 2 + 4} y={T + 10} fontSize={11} fontWeight={700} fill={PHASE_COLOR[list[i].phase]}>етап {ROMAN[list[i].phase]}</text>
          </g>
        ))}
        <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(([px, py], i) => (
          <g key={i}>
            <circle cx={px} cy={py} r={hover === i ? 5.5 : 4} fill={LINE} stroke="#fff" strokeWidth={2} />
            <rect x={px - (W - L - R) / list.length / 2} y={T} width={(W - L - R) / list.length} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
          </g>
        ))}
        <text x={L} y={H - 6} fontSize={11} fill="#94a3b8">{fmtDate(list[0].held_on)}</text>
        <text x={W - R} y={H - 6} fontSize={11} fill="#94a3b8" textAnchor="end">{fmtDate(list[list.length - 1].held_on)}</text>
      </svg>
      {h && hover != null && (
        <div className="absolute pointer-events-none bg-slate-900 text-white text-[12px] rounded-lg px-2.5 py-1.5 shadow-lg -translate-x-1/2"
          style={{ left: `${(pts[hover][0] / W) * 100}%`, top: `${(pts[hover][1] / H) * 100}%`, transform: 'translate(-50%, calc(-100% - 10px))' }}>
          <div className="font-semibold">{fmtDate(h.held_on)} · етап {ROMAN[h.phase]}</div>
          <div>{h.independent} от {h.trials} сам — {pct(h)}%{h.place ? ` · ${h.place}` : ''}</div>
        </div>
      )}
    </div>
  )
}

export function GeneralizationMatrix({ sessions, names }: { sessions: Session[]; names: Record<string, string> }) {
  const g = generalization(sessions)
  if (!g.people.length) return null
  return (
    <div className="overflow-x-auto">
      <table className="text-[12.5px] w-full">
        <thead>
          <tr>
            <th className="text-left font-normal text-slate-400 pb-1.5 pr-2">кой \ къде</th>
            {g.places.map(pl => <th key={pl} className="font-normal text-slate-500 pb-1.5 px-1 text-center whitespace-nowrap">{pl}</th>)}
          </tr>
        </thead>
        <tbody>
          {g.people.map(pid => (
            <tr key={pid}>
              <td className="pr-2 py-0.5 text-slate-700 whitespace-nowrap">{names[pid] || '—'}</td>
              {g.places.map(pl => {
                const n = g.cell[`${pid}|${pl}`] || 0
                const a = n ? 0.15 + 0.75 * (n / g.max) : 0
                return (
                  <td key={pl} className="px-1 py-0.5">
                    <div className="h-7 rounded-md flex items-center justify-center tabular-nums"
                      style={{ backgroundColor: n ? `rgba(37, 99, 235, ${a})` : '#f8fafc', color: a > 0.55 ? '#fff' : '#1e293b' }}>{n || ''}</div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
