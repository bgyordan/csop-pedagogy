import type { ReactNode } from 'react'
import type { Rng } from './core'
import type { Theme } from './themes'
import type { SheetMeta } from './page'

/** Нивата на РЕМЕЛКА, приложени към листовете: 1 — табло за работа с истински предмети, 2 — с картинки, 3 — със символи (с опора), 4 — наум (без опора, за бързина) */
export const LEVEL_LABEL: Record<number, string> = { 1: 'с предмети', 2: 'с картинка', 3: 'със символи', 4: 'наум' }

export type Opts = { theme: Theme; level: number; range: number; variant: string; r: Rng }
export type Made = { meta: SheetMeta; body: (ans: boolean) => ReactNode }
export type Gen = {
  id: string
  title: string
  part: 'math' | 'social'
  area: string
  desc: string
  /** кодовете на уменията от каталога, за които е листът */
  skills: string[]
  levels: number[]
  ranges?: { v: number; label: string }[]
  variants?: { v: string; label: string }[]
  /** темата не се ползва (напр. ролеви карти) */
  noTheme?: boolean
  make: (o: Opts) => Made
}
