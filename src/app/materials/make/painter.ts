// Рисуване на табла в милиметри (A4) с еднакъв код за два изхода:
//  • PdfPainter — jsPDF, за печат и за библиотеката;
//  • CanvasPainter — живото превю на екрана и малката картинка в библиотеката.
// Координатите са от горния ляв ъгъл (както в jsPDF и canvas). Размерът на шрифта е в pt.

import jsPDF from 'jspdf'

export type FontW = 'regular' | 'bold' | 'black'
export type Orient = 'p' | 'l'
export type Img = { id: string; data: string; el: HTMLCanvasElement }   // квадратна картинка (PNG/JPEG dataURL + canvas)

export interface Painter {
  newPage(o: Orient): void
  readonly W: number
  readonly H: number
  rect(x: number, y: number, w: number, h: number, o?: { fill?: string; stroke?: string; lw?: number; r?: number; dash?: boolean }): void
  circle(x: number, y: number, r: number, o?: { fill?: string; stroke?: string; lw?: number; dash?: boolean }): void
  line(x1: number, y1: number, x2: number, y2: number, o?: { stroke?: string; lw?: number; dash?: boolean }): void
  poly(pts: [number, number][], o?: { fill?: string; stroke?: string; lw?: number; dash?: boolean }): void
  text(s: string, x: number, y: number, o?: { size?: number; w?: FontW; color?: string; align?: 'left' | 'center' | 'right' }): void
  measure(s: string, size: number, w?: FontW): number   // ширина в мм
  image(img: Img, x: number, y: number, w: number, h: number): void
}

const PT = 0.3528   // мм в 1 pt
const FONT_FILES: Record<FontW, string> = { regular: 'Nunito-Regular.ttf', bold: 'Nunito-Bold.ttf', black: 'Nunito-Black.ttf' }

// ── шрифтове ────────────────────────────────────────────────────────────────
let fontBytes: Promise<Record<FontW, string>> | null = null
function b64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
  return btoa(s)
}
function loadFontBytes() {
  if (!fontBytes) {
    fontBytes = Promise.all((Object.keys(FONT_FILES) as FontW[]).map(async w => {
      const r = await fetch('/fonts/' + FONT_FILES[w])
      return [w, b64(await r.arrayBuffer())] as const
    })).then(list => Object.fromEntries(list) as Record<FontW, string>)
  }
  return fontBytes
}
let canvasFonts: Promise<void> | null = null
export function loadCanvasFonts() {
  if (!canvasFonts) {
    canvasFonts = Promise.all((Object.keys(FONT_FILES) as FontW[]).map(async w => {
      const f = new FontFace('NunitoGen', `url(/fonts/${FONT_FILES[w]})`, { weight: w === 'regular' ? '400' : w === 'bold' ? '700' : '900' })
      await f.load()
      document.fonts.add(f)
    })).then(() => undefined)
  }
  return canvasFonts
}

// ── PDF ─────────────────────────────────────────────────────────────────────
export class PdfPainter implements Painter {
  doc: jsPDF | null = null
  W = 210
  H = 297
  private fonts: Record<FontW, string>
  private constructor(f: Record<FontW, string>) { this.fonts = f }
  static async create() { return new PdfPainter(await loadFontBytes()) }

  newPage(o: Orient) {
    if (!this.doc) {
      this.doc = new jsPDF({ orientation: o === 'l' ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
      for (const w of Object.keys(this.fonts) as FontW[]) {
        this.doc.addFileToVFS(FONT_FILES[w], this.fonts[w])
        this.doc.addFont(FONT_FILES[w], 'Nunito-' + w, 'normal')
      }
    } else this.doc.addPage('a4', o === 'l' ? 'landscape' : 'portrait')
    this.W = o === 'l' ? 297 : 210
    this.H = o === 'l' ? 210 : 297
  }
  private style(fill?: string, stroke?: string, lw?: number, dash?: boolean) {
    const d = this.doc!
    if (fill) d.setFillColor(fill)
    if (stroke) d.setDrawColor(stroke)
    d.setLineWidth(lw ?? 0.3)
    d.setLineDashPattern(dash ? [1.6, 1.2] : [], 0)
    return fill && stroke ? 'FD' : fill ? 'F' : 'S'
  }
  rect(x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; lw?: number; r?: number; dash?: boolean } = {}) {
    const st = this.style(o.fill, o.stroke, o.lw, o.dash)
    if (o.r) this.doc!.roundedRect(x, y, w, h, o.r, o.r, st)
    else this.doc!.rect(x, y, w, h, st)
  }
  circle(x: number, y: number, r: number, o: { fill?: string; stroke?: string; lw?: number; dash?: boolean } = {}) {
    this.doc!.circle(x, y, r, this.style(o.fill, o.stroke, o.lw, o.dash))
  }
  line(x1: number, y1: number, x2: number, y2: number, o: { stroke?: string; lw?: number; dash?: boolean } = {}) {
    this.style(undefined, o.stroke || '#cfd8e3', o.lw, o.dash)
    this.doc!.line(x1, y1, x2, y2)
  }
  poly(pts: [number, number][], o: { fill?: string; stroke?: string; lw?: number; dash?: boolean } = {}) {
    const st = this.style(o.fill, o.stroke, o.lw, o.dash)
    const [x0, y0] = pts[0]
    const rel = pts.slice(1).map(([x, y], i) => [x - pts[i][0], y - pts[i][1]])
    this.doc!.lines(rel, x0, y0, [1, 1], st, true)
  }
  text(s: string, x: number, y: number, o: { size?: number; w?: FontW; color?: string; align?: 'left' | 'center' | 'right' } = {}) {
    const d = this.doc!
    d.setFont('Nunito-' + (o.w || 'regular'), 'normal')
    d.setFontSize(o.size || 11)
    d.setTextColor(o.color || '#1f2a3d')
    d.text(s, x, y, { align: o.align || 'left' })
  }
  measure(s: string, size: number, w: FontW = 'regular') {
    const d = this.doc!
    d.setFont('Nunito-' + w, 'normal')
    d.setFontSize(size)
    return d.getTextWidth(s)
  }
  image(img: Img, x: number, y: number, w: number, h: number) {
    const fmt = img.data.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'
    this.doc!.addImage(img.data, fmt, x, y, w, h, img.id, 'FAST')
  }
  blob() { return this.doc!.output('blob') }
  pages() { return this.doc!.getNumberOfPages() }
}

// ── Canvas ──────────────────────────────────────────────────────────────────
export class CanvasPainter implements Painter {
  canvases: HTMLCanvasElement[] = []
  W = 210
  H = 297
  private ctx: CanvasRenderingContext2D | null = null
  constructor(private s: number) {}   // пиксела на мм

  newPage(o: Orient) {
    this.W = o === 'l' ? 297 : 210
    this.H = o === 'l' ? 210 : 297
    const c = document.createElement('canvas')
    c.width = Math.round(this.W * this.s)
    c.height = Math.round(this.H * this.s)
    this.ctx = c.getContext('2d')!
    this.ctx.fillStyle = '#ffffff'
    this.ctx.fillRect(0, 0, c.width, c.height)
    this.ctx.scale(this.s, this.s)
    this.ctx.lineJoin = 'round'
    this.ctx.lineCap = 'round'
    this.canvases.push(c)
  }
  private paint(fill?: string, stroke?: string, lw?: number, dash?: boolean) {
    const c = this.ctx!
    c.setLineDash(dash ? [1.6, 1.2] : [])
    c.lineWidth = lw ?? 0.3
    if (fill) { c.fillStyle = fill; c.fill() }
    if (stroke) { c.strokeStyle = stroke; c.stroke() }
  }
  rect(x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; lw?: number; r?: number; dash?: boolean } = {}) {
    const c = this.ctx!
    c.beginPath()
    if (o.r) c.roundRect(x, y, w, h, o.r)
    else c.rect(x, y, w, h)
    this.paint(o.fill, o.stroke, o.lw, o.dash)
  }
  circle(x: number, y: number, r: number, o: { fill?: string; stroke?: string; lw?: number; dash?: boolean } = {}) {
    const c = this.ctx!
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    this.paint(o.fill, o.stroke, o.lw, o.dash)
  }
  line(x1: number, y1: number, x2: number, y2: number, o: { stroke?: string; lw?: number; dash?: boolean } = {}) {
    const c = this.ctx!
    c.beginPath()
    c.moveTo(x1, y1)
    c.lineTo(x2, y2)
    this.paint(undefined, o.stroke || '#cfd8e3', o.lw, o.dash)
  }
  poly(pts: [number, number][], o: { fill?: string; stroke?: string; lw?: number; dash?: boolean } = {}) {
    const c = this.ctx!
    c.beginPath()
    pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y))
    c.closePath()
    this.paint(o.fill, o.stroke, o.lw, o.dash)
  }
  private font(size: number, w: FontW = 'regular') {
    return `${w === 'regular' ? 400 : w === 'bold' ? 700 : 900} ${size * PT}px NunitoGen, sans-serif`
  }
  text(s: string, x: number, y: number, o: { size?: number; w?: FontW; color?: string; align?: 'left' | 'center' | 'right' } = {}) {
    const c = this.ctx!
    c.font = this.font(o.size || 11, o.w)
    c.fillStyle = o.color || '#1f2a3d'
    c.textAlign = o.align || 'left'
    c.textBaseline = 'alphabetic'
    c.fillText(s, x, y)
  }
  measure(s: string, size: number, w: FontW = 'regular') {
    const c = this.ctx || document.createElement('canvas').getContext('2d')!
    c.font = this.font(size, w)
    return c.measureText(s).width
  }
  image(img: Img, x: number, y: number, w: number, h: number) {
    this.ctx!.drawImage(img.el, x, y, w, h)
  }
}

// ── картинки → квадрат 512 px ───────────────────────────────────────────────
const imgCache = new Map<string, Promise<Img>>()

function square(src: CanvasImageSource, sw: number, sh: number, id: string, photo: boolean): Img {
  const S = 512
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')!
  if (photo) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S) }
  const k = Math.min(S / sw, S / sh)
  ctx.drawImage(src, (S - sw * k) / 2, (S - sh * k) / 2, sw * k, sh * k)
  return { id, el: c, data: photo ? c.toDataURL('image/jpeg', 0.85) : c.toDataURL('image/png') }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((ok, fail) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = fail
    i.src = url
  })
}

/** Пиктограма от public/pictos (SVG) → квадратна PNG картинка */
export function pictoImg(key: string): Promise<Img> {
  const id = 'p-' + key
  if (!imgCache.has(id)) {
    imgCache.set(id, (async () => {
      let svg = await (await fetch(`/pictos/${key}.svg`)).text()
      svg = svg.replace('<svg', '<svg width="512" height="512"')   // Firefox иска размер
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      try {
        const i = await loadImage(url)
        return square(i, 512, 512, id, false)
      } finally { URL.revokeObjectURL(url) }
    })())
  }
  return imgCache.get(id)!
}

/** Качена снимка (dataURL) → квадратна JPEG картинка */
export function photoImg(dataUrl: string): Promise<Img> {
  const id = 'u-' + hash(dataUrl)
  if (!imgCache.has(id)) {
    imgCache.set(id, loadImage(dataUrl).then(i => square(i, i.naturalWidth, i.naturalHeight, id, true)))
  }
  return imgCache.get(id)!
}

export { fileToDataUrl } from '@/lib/photo'

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i += 7) h = (h * 31 + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36) + s.length
}
