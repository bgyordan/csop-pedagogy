'use client'

// Напредък по цел: % самостоятелни верни по сесии, прагът (критерият) като пунктир.

import { useState } from 'react'
import { scoreOf, sortSessions, fmtDate } from '@/lib/aba'
import type { DttSession } from '@/lib/aba'

const W = 640, H = 190, L = 34, R = 12, T = 14, B = 24
const LINE = '#2563eb'

export default function DttChart({ sessions, criterion }: { sessions: DttSession[]; criterion: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const list = sortSessions(sessions).slice(-30)
  if (list.length < 2) return <div className="h-24 flex items-center justify-center text-[12.5px] text-slate-400 text-center px-6">Графиката се появява след втората сесия.</div>
  const x = (i: number) => L + (i / (list.length - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - v / 100) * (H - T - B)
  const sc = list.map(s => scoreOf(s.marks))
  const pts = sc.map((s, i) => [x(i), y(s.pct)] as const)
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
        <text x={W - R} y={y(criterion) - 5} textAnchor="end" fontSize={11} fill="#15803d">критерий {criterion}%</text>
        <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(([px, py], i) => (
          <g key={i}>
            <circle cx={px} cy={py} r={hover === i ? 5.5 : 4} fill={sc[i].pct >= criterion ? '#16a34a' : LINE} stroke="#fff" strokeWidth={2} />
            <rect x={px - (W - L - R) / list.length / 2} y={T} width={(W - L - R) / list.length} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
          </g>
        ))}
        <text x={L} y={H - 6} fontSize={11} fill="#94a3b8">{fmtDate(list[0].held_on)}</text>
        <text x={W - R} y={H - 6} fontSize={11} fill="#94a3b8" textAnchor="end">{fmtDate(list[list.length - 1].held_on)}</text>
      </svg>
      {h && hover != null && (
        <div className="absolute pointer-events-none bg-slate-900 text-white text-[12px] rounded-lg px-2.5 py-1.5 shadow-lg"
          style={{ left: `${(pts[hover][0] / W) * 100}%`, top: `${(pts[hover][1] / H) * 100}%`, transform: 'translate(-50%, calc(-100% - 10px))' }}>
          <div className="font-semibold">{fmtDate(h.held_on)} · {sc[hover].pct}%</div>
          <div className="tracking-widest">{h.marks}</div>
          <div>{sc[hover].correct} сам · {sc[hover].prompted} с подсказка · {sc[hover].wrong} грешни</div>
        </div>
      )}
    </div>
  )
}
