// Всички работни листове на едно място + как се избира лист по умение и ниво от програмата на детето.
import { MATH_GENS } from './math'
import { SOCIAL_GENS } from './social'
import { rng } from './core'
import { themeById } from './themes'
import type { Gen } from './types'
export { THEMES, themeById } from './themes'
export { LEVEL_LABEL } from './types'
export type { Gen } from './types'

export const GENS: Gen[] = [...MATH_GENS, ...SOCIAL_GENS]
export const genById = (id: string) => GENS.find(g => g.id === id)

/** Листовете за дадено умение (по кода от каталога) */
export const gensForSkill = (code: string) => GENS.filter(g => g.skills.includes(code))

/** Нивото от диагностиката (0–4) → най-близкото ниво, което листът има */
export function levelFor(g: Gen, lv: number) {
  const want = Math.min(4, Math.max(1, lv + 1))   // работим „на границата“ — едно ниво над овладяното
  return g.levels.reduce((best, l) => (Math.abs(l - want) < Math.abs(best - want) ? l : best), g.levels[0])
}

/** Подходящ обхват/вариант по кода на умението (напр. С3.3 → до 20 с преминаване) */
export function presetFor(g: Gen, code: string): { range?: number; variant?: string } {
  const P: Record<string, { range?: number; variant?: string }> = {
    'С1.1': { range: 10 }, 'С1.2': { range: 10 }, 'С1.3': { range: 10, variant: 'more' }, 'С1.4': { range: 10 }, 'С1.5': { range: 20, variant: '1' },
    'С2.1': { range: 100 }, 'С2.2': { range: 100 }, 'С2.3': { range: 100 }, 'С2.4': { range: 1000 },
    'С3.1': { range: 10, variant: 'any' }, 'С3.2': { range: 20, variant: 'nocarry' }, 'С3.3': { range: 20, variant: 'carry' }, 'С3.4': { range: 100, variant: 'any' },
    'С4.1': { variant: 'mix' }, 'С4.2': { variant: '2' }, 'С4.3': { variant: 'all' },
    'С6.2': { variant: 'hh' }, 'С6.3': { variant: 'q' }, 'С7.1': { range: 100 }, 'С7.2': { range: 1000 }, 'С7.3': { range: 20 },
    'Г1.1': { variant: 'wash' }, 'Г4.2': { variant: 'street' }, 'Г5.2': { variant: 'morning' }, 'Г4.1': { variant: 'shop' },
    'Г2.1': { variant: 'talk' }, 'Г2.2': { variant: 'talk' }, 'Г2.3': { variant: 'talk' }, 'Г2.4': { variant: 'talk' },
    'Г3.1': { variant: 'rules' }, 'Г3.2': { variant: 'rules' }, 'Г3.3': { variant: 'rules' }, 'Г4.3': { variant: 'bus' },
  }
  const p = P[code] || {}
  return {
    range: p.range && g.ranges?.some(r => r.v === p.range) ? p.range : undefined,
    variant: p.variant && g.variants?.some(v => v.v === p.variant) ? p.variant : undefined,
  }
}

/** Пуска генератора: един и същ лист при всяко рисуване (и за листа с отговорите) */
export function runGen(g: Gen, o: { themeId: string; level: number; range?: number; variant?: string; seed: number }) {
  const r = rng(o.seed)
  const theme = themeById(o.themeId)
  const made = g.make({ theme, level: g.levels.includes(o.level) ? o.level : g.levels[0], range: o.range ?? g.ranges?.[Math.min(1, (g.ranges?.length || 1) - 1)]?.v ?? 10, variant: o.variant ?? g.variants?.[0]?.v ?? '', r })
  const mark = r.save()
  return { theme, meta: made.meta, body: (ans: boolean) => { r.restore(mark); return made.body(ans) } }
}
