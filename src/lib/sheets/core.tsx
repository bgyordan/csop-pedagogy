// Работни листове (РЕМЕЛКА) — общото: случайност с „семе“ (вариантът се повтаря точно), страница A4 като SVG,
// заглавна лента, подпис, „Как се справих?“, пренасяне на текст. Всичко е векторно — печата се остро.
import type { ReactNode } from 'react'

export const W = 794, H = 1123            // A4 при 96 dpi; печата се като 210 × 297 мм
export const M = 40                       // поле
export const BODY = { x: M, y: 214, w: W - 2 * M, h: 820 }   // мястото за задачите
export const INK = '#2d3047'
export const ANS = '#d6336c'              // цветът на отговорите (лист с отговори)
export const FONT = "'Nunito', 'Comic Sans MS', 'Segoe UI', Arial, sans-serif"

// ── случайност със семе ──
export type Rng = { next: () => number; int: (a: number, b: number) => number; pick: <T>(a: T[]) => T; shuffle: <T>(a: T[]) => T[]; save: () => number; restore: (v: number) => void }
export function rng(seed: number): Rng {
  let s = seed >>> 0 || 1
  const next = () => { s += 0x6d2b79f5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const int = (a: number, b: number) => a + Math.floor(next() * (b - a + 1))
  const pick = <T,>(a: T[]) => a[Math.floor(next() * a.length)]
  const shuffle = <T,>(a: T[]) => { const c = a.slice(); for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [c[i], c[j]] = [c[j], c[i]] } return c }
  return { next, int, pick, shuffle, save: () => s, restore: (v: number) => { s = v } }
}

/** Пренася текст на редове по приблизителна ширина (в знаци) */
export function wrap(text: string, max: number): string[] {
  const out: string[] = []; let line = ''
  for (const w of text.split(/\s+/)) {
    if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w } else line = (line + ' ' + w).trim()
  }
  if (line) out.push(line)
  return out
}

export function T({ x, y, s = 20, w = 600, fill = INK, a = 'start', children, ls }: { x: number; y: number; s?: number; w?: number; fill?: string; a?: 'start' | 'middle' | 'end'; children: ReactNode; ls?: number }) {
  return <text x={x} y={y} fontSize={s} fontWeight={w} fill={fill} textAnchor={a} fontFamily={FONT} letterSpacing={ls}>{children}</text>
}
/** Текст на няколко реда */
export function TL({ x, y, s = 18, w = 600, fill = INK, a = 'start', lines, lh = 1.3 }: { x: number; y: number; s?: number; w?: number; fill?: string; a?: 'start' | 'middle' | 'end'; lines: string[]; lh?: number }) {
  return <>{lines.map((l, i) => <T key={i} x={x} y={y + i * s * lh} s={s} w={w} fill={fill} a={a}>{l}</T>)}</>
}

/** Празно квадратче за отговор (с отговора, ако е лист с отговори) */
export function Box({ x, y, w = 56, h = 56, ans, show, r = 10, s }: { x: number; y: number; w?: number; h?: number; ans?: string | number; show?: boolean; r?: number; s?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} fill="#fff" stroke={INK} strokeWidth={2.5} />
      {show && ans !== undefined && <T x={x + w / 2} y={y + h / 2 + (s || h * 0.5) * 0.36} s={s || h * 0.5} w={800} fill={ANS} a="middle">{ans}</T>}
    </g>
  )
}
/** Линия за писане */
export const Line = ({ x, y, w, ans, show, s = 22 }: { x: number; y: number; w: number; ans?: string | number; show?: boolean; s?: number }) => (
  <g>
    <line x1={x} y1={y} x2={x + w} y2={y} stroke="#94a3b8" strokeWidth={2} strokeDasharray="2 6" strokeLinecap="round" />
    {show && ans !== undefined && <T x={x + w / 2} y={y - 6} s={s} w={800} fill={ANS} a="middle">{ans}</T>}
  </g>
)
/** Кръгче с номер на задачата */
export const Num = ({ x, y, n, color }: { x: number; y: number; n: number | string; color: string }) => (
  <g><circle cx={x} cy={y} r={15} fill={color} /><T x={x} y={y + 6} s={16} w={800} fill="#fff" a="middle">{n}</T></g>
)

/** Разпръсква n позиции в правоъгълник, без застъпване (решетка с леко отместване) */
export function scatter(r: Rng, n: number, x: number, y: number, w: number, h: number, size: number) {
  const cols = Math.max(1, Math.floor(w / (size * 1.15))), rows = Math.max(1, Math.floor(h / (size * 1.15)))
  const cw = w / cols, ch = h / rows
  const cells = r.shuffle(Array.from({ length: cols * rows }, (_, i) => i)).slice(0, Math.min(n, cols * rows))
  return cells.map(c => ({ x: x + (c % cols) * cw + (cw - size) / 2 + (r.next() - 0.5) * (cw - size) * 0.8, y: y + Math.floor(c / cols) * ch + (ch - size) / 2 + (r.next() - 0.5) * (ch - size) * 0.8 }))
}
/** Подредени позиции (като зар / в редове по 5) — за ниво „картинка“ е по-лесно за броене */
export function rows5(n: number, x: number, y: number, size: number, gap = 6, per = 5) {
  return Array.from({ length: n }, (_, i) => ({ x: x + (i % per) * (size + gap), y: y + Math.floor(i / per) * (size + gap) }))
}
