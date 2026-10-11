// Видовете табла на генератора и как се рисуват (еднакво за PDF и за превюто).

import type { Img, Painter } from './painter'

export type Pic = { key?: string; photo?: string; label: string; text?: string }
export type BoardType = 'cards' | 'first-then' | 'now-next' | 'choice' | 'token' | 'sequence' | 'story' | 'pecs-book'
export type Board = {
  type: BoardType; title: string; who: string; color: string; pics: Pic[]
  size: 'big' | 'mid' | 'small' | 'mini'; labels: boolean; copies: number; tokens: 3 | 5 | 10
}

export type TypeMeta = {
  label: string; hint: string; min: number; max: number; slotNames?: string[]; withText?: boolean
  kind: string; areas: string[]; defaults: () => Partial<Board>
}

const p = (key: string, label: string, text?: string): Pic => ({ key, label, text })

export const TYPES: Record<BoardType, TypeMeta> = {
  cards: {
    label: 'Карти', hint: 'Картинки за изрязване — за общуване, речник, игри. Изберете размер и брой копия.',
    min: 1, max: 60, kind: 'cards', areas: ['expressive', 'receptive'],
    defaults: () => ({ title: 'Моите карти', pics: [p('eat', 'ям'), p('drink', 'пия'), p('toilet', 'тоалетна'), p('help', 'помощ'), p('break', 'почивка'), p('play', 'играя')] }),
  },
  'first-then': {
    label: 'Първо — после', hint: 'Задачата и наградата след нея. Помага детето да приеме задачата.',
    min: 2, max: 2, slotNames: ['Първо', 'После'], kind: 'board', areas: ['receptive', 'sensory'],
    defaults: () => ({ title: 'Първо — после', pics: [p('book', 'чета'), p('playground', 'площадка')] }),
  },
  'now-next': {
    label: 'Сега — после — накрая', hint: 'Три стъпки за по-дълги поредици и преходи.',
    min: 3, max: 3, slotNames: ['Сега', 'После', 'Накрая'], kind: 'board', areas: ['receptive', 'sensory'],
    defaults: () => ({ title: 'Сега — после — накрая', pics: [p('math', 'математика'), p('lunch', 'обяд'), p('playground', 'площадка')] }),
  },
  choice: {
    label: 'Табло за избор', hint: '„Аз искам…“ с 2 до 6 възможности. Детето посочва или подава.',
    min: 2, max: 6, kind: 'board', areas: ['expressive'],
    defaults: () => ({ title: 'Аз искам…', pics: [p('ball', 'топка'), p('blocks', 'кубчета'), p('music', 'музика')] }),
  },
  token: {
    label: 'Жетонно табло', hint: 'Наградата, за която детето работи, и жетоните за събиране.',
    min: 2, max: 2, slotNames: ['Награда', 'Жетон'], kind: 'board', areas: ['sensory', 'social'],
    defaults: () => ({ title: 'Работя за…', tokens: 5, pics: [p('tablet', 'таблет'), p('star', 'звезда')] }),
  },
  sequence: {
    label: 'Поредица / график', hint: 'Стъпки отгоре надолу с квадратче за отметка — за рутина или за деня.',
    min: 2, max: 10, kind: 'board', areas: ['self_care', 'receptive'],
    defaults: () => ({ title: 'Мия си ръцете', pics: [p('water', 'Пускам водата'), p('soap', 'Слагам сапун'), p('hand', 'Търкам ръцете'), p('water', 'Изплаквам'), p('towel', 'Подсушавам'), p('done', 'Готово!')] }),
  },
  story: {
    label: 'Социална история', hint: 'Кратка история от първо лице — по едно изречение и картинка на кадър.',
    min: 1, max: 12, withText: true, kind: 'story', areas: ['social'],
    defaults: () => ({ title: 'Чакам реда си', pics: [
      p('class', 'класът', 'В класа сме много деца.'), p('wait', 'чакам', 'Понякога трябва да почакам.'),
      p('yoga', 'дишам', 'Докато чакам, дишам спокойно.'), p('happy', 'радост', 'Скоро идва моят ред!')] }),
  },
  'pecs-book': {
    label: 'Комуникационна книга', hint: 'Корица с името, ленти „Аз искам…“ и карти в размер за книга (PECS).',
    min: 1, max: 60, kind: 'cards', areas: ['expressive'],
    defaults: () => ({ title: 'Моята книга за общуване', size: 'small', pics: [p('water', 'вода'), p('apple', 'ябълка'), p('cookie', 'бисквитка'), p('ball', 'топка'), p('bubbles', 'балончета'), p('music', 'музика'), p('teddy', 'мече'), p('tablet', 'таблет')] }),
  },
}

export const COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#dc2626', '#475569']

export const SIZES: Record<Board['size'], { label: string; cols: number; rows: number }> = {
  big: { label: 'Големи (6 на лист)', cols: 2, rows: 3 },
  mid: { label: 'Средни (12)', cols: 3, rows: 4 },
  small: { label: 'Малки ~4,5 см (20)', cols: 4, rows: 5 },
  mini: { label: 'Мини ~3,5 см (35)', cols: 5, rows: 7 },
}

// ── помощни ─────────────────────────────────────────────────────────────────
const INK = '#1f2a3d', MUTED = '#6b7a90', LINE = '#cfd8e3', SOFT = '#f4f7fb', CUT = '#9aa7b8'
const M = 12

export function tint(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v + (255 - v) * k))
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')
}

function fit(P: Painter, s: string, maxW: number, size: number, w: 'regular' | 'bold' | 'black' = 'bold') {
  while (size > 6 && P.measure(s, size, w) > maxW) size -= 0.5
  return size
}
function fitText(P: Painter, s: string, x: number, y: number, maxW: number, size: number, o: { w?: 'regular' | 'bold' | 'black'; color?: string; align?: 'left' | 'center' | 'right' } = {}) {
  P.text(s, x, y, { size: fit(P, s, maxW, size, o.w || 'bold'), w: o.w || 'bold', color: o.color, align: o.align || 'center' })
}
function wrap(P: Painter, s: string, maxW: number, size: number, w: 'regular' | 'bold' = 'bold') {
  const out: string[] = []
  let cur = ''
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const t = cur ? cur + ' ' + word : word
    if (P.measure(t, size, w) <= maxW || !cur) cur = t
    else { out.push(cur); cur = word }
  }
  if (cur) out.push(cur)
  return out
}

/** Хедър и футър като в началния комплект; връща горната граница на съдържанието */
function page(P: Painter, b: Board, o: 'p' | 'l', subtitle?: string) {
  P.newPage(o)
  const W = P.W
  P.rect(M, M, W - 2 * M, 16, { fill: tint(b.color, 0.88), r: 4 })
  P.rect(M, M, 2.6, 16, { fill: b.color, r: 1.3 })
  P.text('ЦСОП ВАРНА · ЕИС', M + 7, M + 5.6, { size: 6.5, w: 'bold', color: b.color })
  fitText(P, subtitle || b.title || TYPES[b.type].label, M + 7, M + 12.6, W - 2 * M - 70, 14, { w: 'black', color: INK, align: 'left' })
  if (b.who) P.text('За: ' + b.who, W - M - 5, M + 10, { size: 10, w: 'bold', color: MUTED, align: 'right' })
  P.text('ЦСОП Варна · Материали в ЕИС', M, P.H - 6, { size: 6, color: '#9aa7b8' })
  P.text('Пиктограми: Twemoji, CC-BY 4.0', W - M, P.H - 6, { size: 6, color: '#9aa7b8', align: 'right' })
  return M + 21
}

type Imgs = (pic: Pic) => Img | undefined

/** Картинка с надпис в рамка */
function picCard(P: Painter, img: Img | undefined, label: string, x: number, y: number, w: number, h: number,
  o: { color?: string; fill?: string; cut?: boolean; labels?: boolean; lw?: number; r?: number } = {}) {
  P.rect(x, y, w, h, { fill: o.fill || '#ffffff', stroke: o.cut ? CUT : (o.color || LINE), lw: o.lw ?? (o.cut ? 0.3 : 0.8), r: o.r ?? Math.min(w, h) * 0.08, dash: o.cut })
  const showLabel = o.labels !== false && !!label
  const fs = Math.max(7, Math.min(16, w * 0.4))
  const labH = showLabel ? fs * 0.3528 * 1.7 : 0
  const pad = Math.min(w, h) * 0.1
  const s = Math.max(4, Math.min(w - 2 * pad, h - 2 * pad - labH))
  if (img) P.image(img, x + (w - s) / 2, y + pad + (h - 2 * pad - labH - s) / 2, s, s)
  if (showLabel) fitText(P, label, x + w / 2, y + h - pad * 0.7 - 0.6, w - 4, fs, { color: INK })
}

function velcro(P: Painter, x: number, y: number, s: number, color = LINE) {
  P.rect(x, y, s, s, { fill: SOFT, stroke: color, lw: 0.4, r: s * 0.1, dash: true })
}

function cardsGrid(P: Painter, b: Board, imgs: Imgs, pics: Pic[], title: string) {
  const { cols, rows } = SIZES[b.size]
  const per = cols * rows
  const list: Pic[] = []
  pics.forEach(pc => { for (let i = 0; i < Math.max(1, b.copies); i++) list.push(pc) })
  for (let s = 0; s < Math.max(list.length, 1); s += per) {
    const top = page(P, b, 'p', title)
    const gap = 3
    const W = P.W - 2 * M, H = P.H - 12 - top
    const cw = Math.min((W - gap * (cols - 1)) / cols, (H - gap * (rows - 1)) / rows * 1.15)
    const ch = Math.min((H - gap * (rows - 1)) / rows, cw)
    const x0 = M + (W - (cw * cols + gap * (cols - 1))) / 2
    list.slice(s, s + per).forEach((pc, i) => {
      const r = Math.floor(i / cols), k = i % cols
      picCard(P, imgs(pc), pc.label, x0 + k * (cw + gap), top + r * (ch + gap), cw, ch, { cut: true, labels: b.labels, color: b.color })
    })
  }
}

function arrow(P: Painter, x1: number, y: number, x2: number, color = INK) {
  P.line(x1, y, x2 - 3, y, { stroke: color, lw: 1.2 })
  P.poly([[x2, y], [x2 - 4, y - 2.6], [x2 - 4, y + 2.6]], { fill: color })
}

function panels(P: Painter, b: Board, imgs: Imgs, heads: string[], colors: string[]) {
  const top = page(P, b, 'l')
  const n = heads.length, gap = 10
  const W = (P.W - 2 * M - gap * (n - 1)) / n
  const H = P.H - 12 - top
  heads.forEach((h, i) => {
    const x = M + i * (W + gap), col = colors[i]
    P.rect(x, top, W, H, { fill: tint(col, 0.9), stroke: col, lw: 1, r: 6 })
    P.rect(x, top, W, 18, { fill: col, r: 6 })
    P.rect(x, top + 10, W, 8, { fill: col })
    P.text(h.toUpperCase(), x + W / 2, top + 12.5, { size: 20, w: 'black', color: '#ffffff', align: 'center' })
    const pc = b.pics[i]
    const s = Math.min(W - 16, H - 52)
    const y0 = top + 18 + (H - 18 - (s + 8 + 18)) / 2
    P.rect(x + (W - s - 8) / 2, y0, s + 8, s + 8, { fill: '#ffffff', r: 5 })
    if (pc) {
      const im = imgs(pc)
      if (im) P.image(im, x + (W - s) / 2, y0 + 4, s, s)
      if (pc.label) fitText(P, pc.label, x + W / 2, y0 + s + 20, W - 10, 24, { w: 'black', color: INK })
    }
    if (i < n - 1) arrow(P, x + W + 1.5, top + H / 2, x + W + gap - 1.5)
  })
}

// ── рисуване по вид ─────────────────────────────────────────────────────────
export function render(P: Painter, b: Board, imgs: Imgs, extra: { me?: Img; want?: Img; talk?: Img }) {
  switch (b.type) {
    case 'cards':
      cardsGrid(P, b, imgs, b.pics, b.title || 'Карти')
      break

    case 'first-then':
      panels(P, b, imgs, ['Първо', 'После'], ['#16a34a', '#2563eb'])
      break

    case 'now-next':
      panels(P, b, imgs, ['Сега', 'После', 'Накрая'], ['#16a34a', '#d97706', '#2563eb'])
      break

    case 'choice': {
      const top = page(P, b, 'l')
      const bar = 26
      P.rect(M, top, P.W - 2 * M, bar, { fill: tint('#16a34a', 0.88), stroke: '#16a34a', lw: 0.8, r: 5 })
      if (extra.me) P.image(extra.me, M + 4, top + 3, 20, 20)
      P.text('Аз', M + 28, top + 16.5, { size: 22, w: 'black' })
      if (extra.want) P.image(extra.want, M + 46, top + 3, 20, 20)
      P.text('искам', M + 70, top + 16.5, { size: 22, w: 'black' })
      velcro(P, P.W - M - 24, top + 3, 20, '#16a34a')
      const n = Math.max(1, b.pics.length)
      const cols = n <= 4 ? n : 3, rows = Math.ceil(n / cols), gap = 8
      const y0 = top + bar + 8
      const W = (P.W - 2 * M - gap * (cols - 1)) / cols
      const H = (P.H - 12 - y0 - gap * (rows - 1)) / rows
      b.pics.forEach((pc, i) => {
        const r = Math.floor(i / cols), k = i % cols
        picCard(P, imgs(pc), pc.label, M + k * (W + gap), y0 + r * (H + gap), W, H, { color: b.color, lw: 1.2, r: 6, fill: tint(b.color, 0.95) })
      })
      break
    }

    case 'token': {
      const top = page(P, b, 'p')
      const reward = b.pics[0], token = b.pics[1]
      const H = 105
      const gold = '#f59e0b'
      P.rect(M, top, P.W - 2 * M, H, { fill: tint(gold, 0.88), stroke: gold, lw: 1, r: 7 })
      P.text('Работя за:', M + 8, top + 13, { size: 20, w: 'black', color: '#b45309' })
      const rs = 46
      P.rect(P.W - M - rs - 12, top + 6, rs + 6, rs + 6, { fill: '#ffffff', stroke: gold, lw: 0.6, r: 5 })
      const ri = reward && imgs(reward)
      if (ri) P.image(ri, P.W - M - rs - 9, top + 9, rs, rs)
      if (reward?.label) fitText(P, reward.label, P.W - M - rs / 2 - 9, top + rs + 20, rs + 10, 13, { color: '#92400e' })
      const n = b.tokens, perRow = 5, rowsT = Math.ceil(n / perRow)
      const area = P.W - 2 * M - rs - 30
      const step = area / perRow
      const r = Math.min(step * 0.42, rowsT > 1 ? 13 : 16)
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / perRow), k = i % perRow
        const cx = M + 10 + step * (k + 0.5)
        const cy = top + (rowsT > 1 ? 36 + row * (r * 2 + 8) : 52)
        P.circle(cx, cy, r, { fill: '#ffffff', stroke: gold, lw: 0.6, dash: true })
      }
      P.text('Когато събера всички, получавам наградата!', P.W / 2, top + H - 7, { size: 12, w: 'bold', color: '#92400e', align: 'center' })
      // жетони за изрязване
      const y0 = top + H + 12
      P.text('Жетони за изрязване:', M, y0 - 2, { size: 9, color: MUTED })
      P.line(M, y0 + 1, P.W - M, y0 + 1, { stroke: CUT, lw: 0.3, dash: true })
      const ts = 26, gap = 5
      const cols = Math.floor((P.W - 2 * M + gap) / (ts + gap))
      const rows = Math.floor((P.H - 14 - y0 - 4 + gap) / (ts + gap))
      const ti = token && imgs(token)
      const x0 = M + (P.W - 2 * M - (cols * ts + (cols - 1) * gap)) / 2
      for (let rr = 0; rr < rows; rr++) for (let k = 0; k < cols; k++) {
        const x = x0 + k * (ts + gap), y = y0 + 5 + rr * (ts + gap)
        P.circle(x + ts / 2, y + ts / 2, ts / 2, { fill: '#ffffff', stroke: CUT, lw: 0.3, dash: true })
        if (ti) P.image(ti, x + ts * 0.17, y + ts * 0.17, ts * 0.66, ts * 0.66)
      }
      break
    }

    case 'sequence': {
      const top = page(P, b, 'p')
      const n = Math.max(1, b.pics.length)
      const gap = 3
      const rh = Math.min(34, (P.H - 12 - top - gap * (n - 1)) / n)
      b.pics.forEach((pc, i) => {
        const y = top + i * (rh + gap)
        P.rect(M, y, P.W - 2 * M, rh, { fill: tint(b.color, i % 2 ? 0.94 : 0.9), r: 4 })
        P.circle(M + 9, y + rh / 2, Math.min(6, rh * 0.22), { fill: b.color })
        P.text(String(i + 1), M + 9, y + rh / 2 + 2.3, { size: Math.min(14, rh * 0.5), w: 'black', color: '#ffffff', align: 'center' })
        const s = rh - 5
        P.rect(M + 19, y + 2.5, s, s, { fill: '#ffffff', r: 3 })
        const im = imgs(pc)
        if (im) P.image(im, M + 20, y + 3.5, s - 2, s - 2)
        fitText(P, pc.label, M + 26 + s, y + rh / 2 + 2.6, P.W - 2 * M - s - 50, Math.min(22, rh * 0.75), { w: 'black', align: 'left' })
        P.rect(P.W - M - 14, y + rh / 2 - 4.5, 9, 9, { fill: '#ffffff', stroke: b.color, lw: 0.6, r: 1.5 })
      })
      break
    }

    case 'story': {
      const per = 6
      for (let s = 0; s < b.pics.length; s += per) {
        const top = page(P, b, 'p')
        const gap = 5
        const W = (P.W - 2 * M - gap) / 2
        const H = (P.H - 12 - top - 2 * gap) / 3
        b.pics.slice(s, s + per).forEach((pc, i) => {
          const x = M + (i % 2) * (W + gap), y = top + Math.floor(i / 2) * (H + gap)
          P.rect(x, y, W, H, { fill: '#ffffff', stroke: b.color, lw: 0.6, r: 5 })
          const textH = 22
          P.rect(x + 3, y + 3, W - 6, H - textH - 3, { fill: tint(b.color, 0.9), r: 4 })
          const sz = Math.min(W - 16, H - textH - 10)
          const im = imgs(pc)
          if (im) P.image(im, x + (W - sz) / 2, y + 3 + (H - textH - 3 - sz) / 2, sz, sz)
          P.circle(x + 8, y + 8, 4, { fill: b.color })
          P.text(String(s + i + 1), x + 8, y + 9.6, { size: 9, w: 'black', color: '#ffffff', align: 'center' })
          const lines = wrap(P, pc.text || pc.label, W - 8, 11).slice(0, 3)
          lines.forEach((ln, k) => P.text(ln, x + W / 2, y + H - textH + 6 + k * 5.2 + (3 - lines.length) * 2.6, { size: 11, w: 'bold', align: 'center' }))
        })
      }
      break
    }

    case 'pecs-book': {
      // корица
      let top = page(P, b, 'p', 'Корица')
      const W = P.W - 2 * M
      P.rect(M, top, W, P.H - 12 - top, { fill: tint(b.color, 0.9), stroke: b.color, lw: 1.2, r: 8 })
      P.text('Моята книга', P.W / 2, top + 30, { size: 34, w: 'black', color: b.color, align: 'center' })
      P.text('за общуване', P.W / 2, top + 44, { size: 22, w: 'bold', color: INK, align: 'center' })
      const cs = 90
      P.rect((P.W - cs - 10) / 2, top + 58, cs + 10, cs + 10, { fill: '#ffffff', r: 8 })
      const cover = extra.talk
      if (cover) P.image(cover, (P.W - cs) / 2, top + 63, cs, cs)
      if (b.who) fitText(P, b.who, P.W / 2, top + 182, W - 20, 30, { w: 'black', color: INK })
      else P.line(M + 40, top + 182, P.W - M - 40, top + 182, { stroke: INK, lw: 0.4 })
      P.text('Етап: ________        Започнато: ______________', P.W / 2, P.H - 30, { size: 11, color: MUTED, align: 'center' })
      // ленти „Аз искам…“
      top = page(P, b, 'p', 'Ленти „Аз искам…“')
      const sh = 62, gap = 10
      for (let i = 0; i < 3; i++) {
        const y = top + i * (sh + gap)
        P.rect(M, y, W, sh, { fill: tint('#16a34a', 0.92), stroke: '#16a34a', lw: 0.8, r: 6 })
        const cw = (W - 25) / 4
        const cards: [Img | undefined, string, string][] = [[extra.me, 'Аз', '#eab308'], [extra.want, 'искам', '#16a34a']]
        cards.forEach(([im, t, col], k) => picCard(P, im, t, M + 5 + k * (cw + 5), y + 5, cw, sh - 10, { color: col, lw: 1 }))
        const vs = Math.min(cw, sh - 10)
        velcro(P, M + 5 + 2 * (cw + 5) + (cw - vs) / 2, y + 5 + (sh - 10 - vs) / 2, vs, b.color)
        velcro(P, M + 5 + 3 * (cw + 5) + (cw - vs) / 2, y + 5 + (sh - 10 - vs) / 2, vs, b.color)
      }
      P.text('Изрежи лентите. Залепи велкро на празните места.', P.W / 2, top + 3 * (sh + gap) + 4, { size: 10, color: MUTED, align: 'center' })
      // карти
      cardsGrid(P, b, imgs, b.pics, 'Карти за книгата')
      break
    }
  }
}
