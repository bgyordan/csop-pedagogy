// Рамката на един лист: заглавна лента в цвета на темата, име/дата, мястото за задачите,
// „За учителя“ и „Как се справих?“ (детето оцветява лицето).
import type { ReactNode } from 'react'
import { W, H, M, INK, FONT, T, TL, wrap } from './core'
import { Icon, Face } from './icons'
import type { Theme } from './themes'

export type SheetMeta = { title: string; instr: string; tip: string; code?: string; levelLabel?: string; icon?: string }

export function SheetPage({ meta, theme, student, date, children, answers }: { meta: SheetMeta; theme: Theme; student?: string; date?: string; children: ReactNode; answers?: boolean }) {
  const instr = wrap(meta.instr, 50).slice(0, 2)
  const tip = wrap(meta.tip, 84).slice(0, 3)
  const icon = meta.icon || theme.icons[0]
  return (
    <svg className="sheet" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width="210mm" height="297mm" style={{ background: "#fff", display: "block" }} fontFamily={FONT}>
      <rect width={W} height={H} fill="#fff" />
      {/* заглавна лента */}
      <rect x={M} y={28} width={W - 2 * M} height={150} rx={28} fill={theme.soft} stroke={theme.color} strokeWidth={3} />
      <path d={`M${M + 28} 178 L${W - M - 28} 178`} stroke={theme.color} strokeWidth={3} />
      <circle cx={M + 78} cy={103} r={56} fill="#fff" stroke={theme.color} strokeWidth={3} />
      <Icon id={icon} x={M + 34} y={59} s={88} />
      <T x={M + 156} y={88} s={meta.title.length > 24 ? 25 : meta.title.length > 18 ? 30 : 34} w={900} fill={theme.deep}>{meta.title}</T>
      <TL x={M + 156} y={122} s={19} w={700} fill={INK} lines={instr} lh={1.35} />
      {/* малки рисунки в ъгъла — темата */}
      {theme.icons.slice(1, 4).map((id, i) => <Icon key={id} id={id} x={W - M - 44 - i * 40} y={40} s={34} opacity={0.9} />)}
      {meta.code && <g><rect x={W - M - 92} y={136} width={76} height={28} rx={14} fill="#fff" stroke={theme.color} strokeWidth={2} /><T x={W - M - 54} y={156} s={15} w={800} fill={theme.deep} a="middle">{meta.code}</T></g>}
      {answers && <g><rect x={W / 2 - 80} y={14} width={160} height={28} rx={14} fill="#d6336c" /><T x={W / 2} y={34} s={15} w={800} fill="#fff" a="middle">ОТГОВОРИ</T></g>}

      {/* име и дата */}
      <T x={M + 8} y={204} s={17} w={700} fill="#64748b">Име:</T>
      <line x1={M + 56} y1={206} x2={M + 430} y2={206} stroke="#cbd5e1" strokeWidth={2} />
      {student && <T x={M + 66} y={200} s={21} w={800} fill={INK}>{student}</T>}
      <T x={W - M - 250} y={204} s={17} w={700} fill="#64748b">Дата:</T>
      <line x1={W - M - 196} y1={206} x2={W - M - 8} y2={206} stroke="#cbd5e1" strokeWidth={2} />
      {date && <T x={W - M - 186} y={200} s={19} w={700} fill={INK}>{date}</T>}

      {children}

      {/* долу: за учителя + как се справих */}
      <line x1={M} y1={1044} x2={W - M} y2={1044} stroke="#e2e8f0" strokeWidth={2} />
      <T x={M} y={1063} s={12} w={800} fill={theme.deep}>За учителя</T>
      <TL x={M} y={1079} s={11.5} w={500} fill="#475569" lines={tip} lh={1.3} />
      <T x={W - M} y={1063} s={12} w={800} fill="#64748b" a="end">Как се справих?</T>
      {(['happy', 'calm', 'sad'] as const).map((e, i) => <Face key={e} e={e} x={W - M - 118 + i * 40} y={1071} s={36} plain />)}
      <T x={W - M} y={1116} s={9.5} w={600} fill="#94a3b8" a="end">РЕМЕЛКА · ЦСОП – Варна{meta.code ? ` · ${meta.code}` : ''}{meta.levelLabel ? ` · ${meta.levelLabel}` : ''}</T>
    </svg>
  )
}
