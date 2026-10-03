'use client'

// „Паяжина“ на развитието: всяка ос е област (0–100%), два профила един върху друг — начало и сега.

import { AREAS } from './lib'

export default function Radar({ before, after, size = 340 }: {
  before: (number | null)[]; after: (number | null)[]; size?: number
}) {
  const n = AREAS.length, c = size / 2, R = size / 2 - 62
  const pt = (i: number, pct: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [c + Math.cos(a) * R * pct / 100, c + Math.sin(a) * R * pct / 100]
  }
  const poly = (vals: (number | null)[]) => vals.map((v, i) => pt(i, v ?? 0).join(',')).join(' ')
  const has = (vals: (number | null)[]) => vals.some(v => v !== null)

  return (
    <svg viewBox={`-46 0 ${size + 92} ${size}`} className="w-full max-w-[400px] mx-auto" role="img" aria-label="Профил на развитието по области">
      {[25, 50, 75, 100].map(r => (
        <polygon key={r} points={AREAS.map((_, i) => pt(i, r).join(',')).join(' ')}
          fill={r === 100 ? '#f8fafc' : 'none'} stroke="#cbd5e1" strokeWidth={r === 100 ? 1.2 : 0.8} strokeDasharray={r === 100 ? undefined : '3 3'} />
      ))}
      {AREAS.map((a, i) => {
        const [x, y] = pt(i, 100)
        const [lx, ly] = pt(i, 128)
        const anchor = Math.abs(lx - c) < 8 ? 'middle' : lx > c ? 'start' : 'end'
        return (
          <g key={a.key}>
            <line x1={c} y1={c} x2={x} y2={y} stroke="#e2e8f0" />
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" fontSize="13.5" fill={a.color} fontWeight={600}>{a.short}</text>
          </g>
        )
      })}
      {has(before) && <polygon points={poly(before)} fill="#94a3b8" fillOpacity={0.12} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 4" />}
      {has(after) && <polygon points={poly(after)} fill="#0f2240" fillOpacity={0.16} stroke="#0f2240" strokeWidth={2} />}
      {after.map((v, i) => v === null ? null : (() => { const [x, y] = pt(i, v); return <circle key={i} cx={x} cy={y} r={3.5} fill={AREAS[i].color} stroke="#fff" strokeWidth={1.5} /> })())}
      <text x={c + 3} y={c - R * 0.5 - 2} fontSize="8.5" fill="#94a3b8">50%</text>
      <text x={c + 3} y={c - R - 2} fontSize="8.5" fill="#94a3b8">100%</text>
    </svg>
  )
}

/** Малка линия на една област във времето */
export function Spark({ vals, color }: { vals: (number | null)[]; color: string }) {
  const pts = vals.map((v, i) => ({ v, i })).filter(p => p.v !== null) as { v: number; i: number }[]
  if (pts.length < 2) return <span className="inline-block w-16" />
  const w = 64, h = 20, n = Math.max(1, vals.length - 1)
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${(p.i / n) * w},${h - (p.v / 100) * h}`).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg width={w + 4} height={h + 4} viewBox={`-2 -2 ${w + 4} ${h + 4}`} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={(last.i / n) * w} cy={h - (last.v / 100) * h} r={2.2} fill={color} />
    </svg>
  )
}
