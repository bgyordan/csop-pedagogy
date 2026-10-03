'use client'

import { Images, Paperclip, Globe, Share2, Lock } from 'lucide-react'
import { kindMeta, plain, fmtShort, fmtPeriod, STATUS, SITE, isImage } from './lib'
import type { Post, Person } from './lib'

export function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p[p.length - 1]?.[0] || '')).toUpperCase()
}

export function Avatar({ name, size = 28, light = false }: { name: string; size?: number; light?: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-medium shrink-0 ${light ? 'bg-white text-[#0f2240]' : 'bg-[#0f2240] text-white'}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</span>
  )
}

/** Корицата на публикацията: избраната снимка или първата */
export function coverThumb(p: Post, thumbs: Record<string, string>) {
  const imgs = p.media.filter(isImage)
  const c = imgs.find(m => m.path === p.cover_path) || imgs[0]
  return c?.thumb_path ? thumbs[c.thumb_path] : undefined
}

export default function PostCard({ post, author, thumbs, classNames, onOpen, onToggleShare }: {
  post: Post; author?: Person; thumbs: Record<string, string>; classNames: Record<string, string>; onOpen: () => void
  /** „Сподели“ върху картата (в „Моето портфолио“) */
  onToggleShare?: () => void
}) {
  const shared = post.is_shared !== false
  const k = kindMeta(post.kind); const Icon = k.icon
  const cover = coverThumb(post, thumbs)
  const photos = post.media.filter(isImage).length
  const files = post.media.length - photos
  const site = SITE[post.site_status]
  const text = plain(post.body || post.ideas || post.activities || post.goals, 150)
  const cls = post.classIds.map(id => classNames[id]).filter(Boolean)

  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter') onOpen() }}
      className="group cursor-pointer text-left bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      <div className={`relative aspect-[4/3] overflow-hidden ${cover ? 'bg-slate-100' : `bg-gradient-to-br ${k.grad}`}`}>
        {cover
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={cover} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
          : <div className="absolute inset-0 flex items-center justify-center"><Icon size={64} strokeWidth={1.25} className="text-white/80" /></div>}
        <span className={`absolute top-3 left-3 inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/95 shadow-sm ${k.tone}`}>
          <Icon size={12} /> {k.label}
        </span>
        {!shared && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-full shadow-sm bg-slate-800/85 text-white">
            <Lock size={11} /> Само за мен
          </span>
        )}
        {shared && site && (
          <span className={`absolute top-3 right-3 inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-full shadow-sm ${site.cls}`}>
            <Globe size={11} /> {site.label}
          </span>
        )}
        {(photos > 1 || files > 0) && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-full bg-black/55 text-white backdrop-blur-sm">
            {photos > 1 && <span className="inline-flex items-center gap-1"><Images size={12} />{photos}</span>}
            {files > 0 && <span className="inline-flex items-center gap-1"><Paperclip size={12} />{files}</span>}
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-[15px] leading-snug text-slate-900 line-clamp-2">{post.title}</h3>
        {post.kind === 'project' && (post.status || post.period_from) && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
            {post.status && STATUS[post.status] && <span className={`px-1.5 py-0.5 rounded ${STATUS[post.status].cls}`}>{STATUS[post.status].label}</span>}
            <span className="text-slate-500">{fmtPeriod(post.period_from, post.period_to)}</span>
          </div>
        )}
        {text && <p className="text-[13px] text-slate-600 mt-1.5 line-clamp-3 leading-relaxed">{text}</p>}
        <div className="mt-auto pt-3 flex items-center gap-2 text-[12px] text-slate-500">
          <Avatar name={author?.name || 'ЦСОП'} size={24} />
          <span className="truncate text-slate-700">{author?.short || 'ЦСОП'}</span>
          {cls.length > 0 && <span className="truncate">· {cls.slice(0, 2).join(', ')}{cls.length > 2 ? '…' : ''}</span>}
          <span className="ml-auto shrink-0">{fmtShort(post.event_date || post.created_at)}</span>
        </div>
        {onToggleShare && (
          <button type="button" onClick={e => { e.stopPropagation(); onToggleShare() }}
            className={`mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-[13px] font-medium border transition-colors ${shared ? 'bg-[#0f2240] border-[#0f2240] text-white hover:bg-[#1a3560]' : 'bg-white border-slate-300 text-slate-700 hover:border-[#0f2240]'}`}>
            <Share2 size={14} /> {shared ? 'Споделено' : 'Сподели'}
          </button>
        )}
      </div>
    </div>
  )
}
