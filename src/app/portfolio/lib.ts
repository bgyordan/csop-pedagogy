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
