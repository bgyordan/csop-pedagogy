// Портфолио — общи типове, видове публикации и помощници за снимките.

import { DoorOpen, Lightbulb, PartyPopper, BookOpen } from 'lucide-react'

export type Kind = 'cabinet' | 'project' | 'event' | 'material'
export type SiteStatus = 'none' | 'requested' | 'published' | 'declined'

export interface Media {
  id: string; post_id: string; path: string; thumb_path: string | null
  name: string | null; mime: string | null; size: number | null; caption: string | null; sort: number
}
export interface Post {
  id: string; author_id: string | null; kind: Kind; title: string; body: string | null
  cover_path: string | null; event_date: string | null
  ideas: string | null; activities: string | null; goals: string | null
  period_from: string | null; period_to: string | null; status: string | null
  is_shared?: boolean
  site_status: SiteStatus; site_consent: boolean; site_note: string | null; site_reply: string | null
  site_news_id: string | null; site_requested_at: string | null
  created_at: string; updated_at: string
  media: Media[]; classIds: string[]
  /** Дати и събития към публикацията (таблица portfolio_dates) */
  dates: PDate[]
}
export interface PDate {
  id: string; post_id: string; date: string; time_from: string | null; time_to: string | null
  title: string; place: string | null; note: string | null; highlight: boolean; sort: number
}
export interface Person { id: string; name: string; short: string; label: string }
export interface Cls { id: string; name: string }

export const KINDS: { key: Kind; label: string; plural: string; hint: string; icon: typeof DoorOpen; tone: string; soft: string; grad: string }[] = [
  { key: 'cabinet', label: 'Кабинет', plural: 'Кабинети', hint: 'Моят кабинет / работно място — как работим, с какво', icon: DoorOpen, tone: 'text-teal-700', soft: 'bg-teal-50 text-teal-800 border-teal-200', grad: 'from-teal-500 to-cyan-600' },
  { key: 'project', label: 'Проект', plural: 'Проекти', hint: 'Проект на паралелка или група — идеи, дейности, цели', icon: Lightbulb, tone: 'text-amber-700', soft: 'bg-amber-50 text-amber-800 border-amber-200', grad: 'from-amber-400 to-orange-500' },
  { key: 'event', label: 'Събитие', plural: 'Събития', hint: 'Празник, изява, посещение, открит урок…', icon: PartyPopper, tone: 'text-rose-700', soft: 'bg-rose-50 text-rose-800 border-rose-200', grad: 'from-rose-400 to-pink-600' },
  { key: 'material', label: 'Материал', plural: 'Материали', hint: 'Разработка, табло, игра, работен лист — за колегите', icon: BookOpen, tone: 'text-violet-700', soft: 'bg-violet-50 text-violet-800 border-violet-200', grad: 'from-violet-500 to-indigo-600' },
]
export const kindMeta = (k: string) => KINDS.find(x => x.key === k) || KINDS[0]

export const STATUS: Record<string, { label: string; cls: string }> = {
  idea: { label: 'Идея', cls: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'В ход', cls: 'bg-amber-100 text-amber-800' },
  done: { label: 'Завършен', cls: 'bg-emerald-100 text-emerald-800' },
}

export const SITE: Record<SiteStatus, { label: string; cls: string } | null> = {
  none: null,
  requested: { label: 'Предложена за сайта', cls: 'bg-sky-600 text-white' },
  published: { label: 'На сайта', cls: 'bg-emerald-600 text-white' },
  declined: { label: 'Не е за сайта', cls: 'bg-slate-600 text-white' },
}

/** Чернова = още не е споделена с колегите */
export const isDraft = (p: { is_shared?: boolean }) => p.is_shared === false

export const MANAGERS = ['admin', 'zdud', 'director']
export const isImage = (m: { mime: string | null; name: string | null }) =>
  (m.mime || '').startsWith('image/') || /\.(jpe?g|png|webp|gif|heic)$/i.test(m.name || '')

// ── Видео: пази се в Google Drive (path = „drive:<id>“), гледа се през ЕИС ──
export const VIDEO_MAX_MB = 500
export const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp|avi|mkv)$/i
export const isVideoFile = (f: { type: string; name: string }) => f.type.startsWith('video/') || VIDEO_EXT.test(f.name)
export const isVideo = (m: { mime: string | null; name: string | null; path?: string }) =>
  (m.path || '').startsWith('drive:') || (m.mime || '').startsWith('video/')
export const isDrive = (path: string) => path.startsWith('drive:')
export const driveIdOf = (path: string) => path.slice('drive:'.length)
export const videoSrc = (m: { path: string }) => `/api/portfolio-video/${driveIdOf(m.path)}`

const videoMime = (f: File) => f.type.startsWith('video/') ? f.type
  : ({ mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm', '3gp': 'video/3gpp', avi: 'video/x-msvideo', mkv: 'video/x-matroska' } as Record<string, string>)[(f.name.split('.').pop() || '').toLowerCase()] || 'video/mp4'

/** Качва видео направо в Google Drive (без да минава през сървъра). Връща id на файла. */
export async function uploadVideo(file: File, postId: string, onProgress: (pct: number) => void): Promise<{ id: string; mime: string }> {
  const mime = videoMime(file)
  const r = await fetch('/api/portfolio-video/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, mime, size: file.size, postId }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.uploadUrl) throw new Error(j.error || 'Видеото не може да се качи')
  const id = await new Promise<string>((resolve, reject) => {
    const x = new XMLHttpRequest()
    x.open('PUT', j.uploadUrl)
    x.setRequestHeader('Content-Type', mime)
    x.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) {
        try { const d = JSON.parse(x.responseText); if (d.id) return resolve(d.id) } catch { /* */ }
      }
      reject(new Error(`Видеото не се качи (Google ${x.status})`))
    }
    x.onerror = () => reject(new Error('Видеото не се качи — връзката с Google прекъсна'))
    x.send(file)
  })
  return { id, mime }
}

/** Мести видеата в кошчето на диска (при махане от публикация или изтриване на публикация) */
export async function trashVideos(paths: string[]) {
  await Promise.all(paths.filter(isDrive).map(p => fetch(`/api/portfolio-video/${driveIdOf(p)}`, { method: 'DELETE' }).catch(() => null)))
}

export const fmtDate = (iso: string | null) => iso ? new Date(iso.length === 10 ? iso + 'T00:00' : iso).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
export const fmtShort = (iso: string | null) => iso ? new Date(iso.length === 10 ? iso + 'T00:00' : iso).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' }) : ''

const MONTHS = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']
export function fmtPeriod(from: string | null, to: string | null) {
  const m = (d: string) => `${MONTHS[parseInt(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`
  if (from && to) return m(from) === m(to) ? m(from) : `${m(from)} – ${m(to)}`
  return from ? `от ${m(from)}` : to ? `до ${m(to)}` : ''
}

/** Кратък текст за картата: без markdown знаците */
export function plain(text: string | null, max = 180) {
  const t = (text || '').replace(/^##\s+/gm, '').replace(/^[-•]\s+/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max).replace(/\s\S*$/, '') + '…' : t
}

/** Смаляване на снимка до max px по дългата страна (JPEG), за да не тежи */
export async function resizeImage(file: Blob, max: number, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), 'image/jpeg', quality))
}

export const uid = () => (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)

// ── Дати и събития към публикацията ──

/** Днешната дата като YYYY-MM-DD (местно време) */
export const todayYmd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/** Дните от днес до датата (отрицателно — минала) */
export function daysUntil(date: string, today = todayYmd()) {
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))
  const b = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
  return Math.round((b - a) / 86400000)
}

/** „днес“, „утре“, „след 5 дни“, „вчера“, „преди 3 дни“ */
export function relDays(date: string, today = todayYmd()) {
  const n = daysUntil(date, today)
  if (n === 0) return 'днес'
  if (n === 1) return 'утре'
  if (n === -1) return 'вчера'
  if (n > 1) return n < 14 ? `след ${n} дни` : n < 60 ? `след ${Math.round(n / 7)} седм.` : `след ${Math.round(n / 30)} мес.`
  return -n < 14 ? `преди ${-n} дни` : -n < 60 ? `преди ${Math.round(-n / 7)} седм.` : `преди ${Math.round(-n / 30)} мес.`
}

export const hhmm = (t: string | null) => t ? t.slice(0, 5) : ''
export const timeRange = (d: { time_from: string | null; time_to: string | null }) =>
  d.time_from ? (d.time_to ? `${hhmm(d.time_from)}–${hhmm(d.time_to)}` : hhmm(d.time_from)) : ''

/** Ключова дата: собствена или (при „Събитие“) датата на самото събитие */
export interface KeyDate { id: string; post_id: string; date: string; title: string; time: string; place: string | null; note: string | null; highlight: boolean; main?: boolean }

/** Всички дати на публикацията, по ред */
export function keyDates(p: Post): KeyDate[] {
  const out: KeyDate[] = (p.dates || []).map(d => ({
    id: d.id, post_id: p.id, date: d.date, title: d.title, time: timeRange(d), place: d.place, note: d.note, highlight: d.highlight,
  }))
  if (p.kind === 'event' && p.event_date && !out.some(d => d.date === p.event_date))
    out.push({ id: `main:${p.id}`, post_id: p.id, date: p.event_date, title: p.title, time: '', place: null, note: null, highlight: true, main: true })
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
}

/** Най-близката акцентирана дата от днес нататък (или null) */
export function nextKeyDate(p: Post, today = todayYmd()): KeyDate | null {
  return keyDates(p).find(d => d.highlight && d.date >= today) || null
}

/** Тонът на знака според близостта: днес · до 7 дни · по-нататък */
export function dateTone(date: string, today = todayYmd()) {
  const n = daysUntil(date, today)
  if (n === 0) return { badge: 'bg-rose-600 text-white', ring: 'ring-2 ring-rose-500/70', tile: 'bg-rose-600 text-white' }
  if (n <= 7) return { badge: 'bg-rose-500 text-white', ring: 'ring-2 ring-rose-300', tile: 'bg-rose-500 text-white' }
  return { badge: 'bg-white/95 text-rose-700', ring: '', tile: 'bg-rose-50 text-rose-700 border border-rose-200' }
}
