'use client'

// Страничен панел отдясно за преглед на запис — списъкът остава видим отляво.
// Клик на друг ред сменя съдържанието; ↑/↓ минават към съседния запис (управлява се от списъка).

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, X, Maximize2, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export const PANEL_WIDTH_CLS = 'xl:pr-[460px]' // отстъп за списъка, докато панелът е отворен

export function SidePanel({ kind, number, date, badge, onClose, onPrev, onNext, children, footer }: {
  kind: string
  number: string
  date?: string | null
  badge?: React.ReactNode
  onClose: () => void
  onPrev?: (() => void) | null
  onNext?: (() => void) | null
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const navBtn = 'p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors'
  return (
    <aside className="panel-in fixed top-0 right-0 h-full w-full sm:w-[440px] bg-white border-l border-slate-200 shadow-[-8px_0_28px_rgba(15,34,64,0.10)] z-40 flex flex-col">
      <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-100">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 uppercase tracking-widest">{kind}</span>
            {badge}
          </div>
          <div className="text-xl font-medium text-[#0f2240] tabular-nums leading-tight mt-1 truncate">№ {number}</div>
          {date && (
            <div className="text-xs text-slate-500 mt-1">
              {new Date(date).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button type="button" onClick={() => onPrev?.()} disabled={!onPrev} title="Предишен (↑)" className={navBtn}><ChevronUp size={18} /></button>
          <button type="button" onClick={() => onNext?.()} disabled={!onNext} title="Следващ (↓)" className={navBtn}><ChevronDown size={18} /></button>
          <button type="button" onClick={onClose} title="Затвори (Esc)" className={`${navBtn} ml-1`}><X size={18} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">{children}</div>

      {footer && <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-2">{footer}</div>}
    </aside>
  )
}

/** Ред „надпис — стойност“ в панела. */
export function PanelField({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={strong ? 'text-[15px] text-slate-900 leading-snug' : 'text-sm text-slate-700 leading-snug'}>{children}</div>
    </div>
  )
}

/** Преглед на прикачения файл направо в панела (PDF и снимки). Word файлове само се отварят. */
export function FilePreview({ path, name }: { path?: string | null; name?: string | null }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const lower = (name || path || '').toLowerCase()
  const kind = lower.endsWith('.pdf') ? 'pdf' : /\.(png|jpe?g|gif|webp)$/.test(lower) ? 'img' : null

  // Файлът се сваля и се показва от паметта на браузъра (blob) — така PDF-ът
  // никога не „отваря“ страницата на сървъра и не изхвърля от системата.
  useEffect(() => {
    let off = false, objUrl: string | null = null
    setUrl(null); setFailed(false)
    if (!path || !kind) return
    createClient().storage.from('documents').download(path).then(({ data, error }) => {
      if (off) return
      if (error || !data) { setFailed(true); return }
      const typed = kind === 'pdf' ? new Blob([data], { type: 'application/pdf' }) : data
      objUrl = URL.createObjectURL(typed)
      setUrl(objUrl)
    })
    return () => { off = true; if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [path])

  const [full, setFull] = useState(false)
  // Esc затваря само цялия екран (не и страничния панел отдолу)
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); setFull(false) } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [full])

  if (!path || !kind || failed) return null
  const viewer = (cls: string) => kind === 'pdf'
    ? <iframe src={`${url}#view=FitH`} title={name || 'Преглед'} className={`${cls} bg-white`} />
    // eslint-disable-next-line @next/next/no-img-element
    : <img src={url!} alt={name || 'Преглед'} className={`${cls} object-contain bg-white`} />

  return (
    <>
      {/* Малкият преглед — целият е бутон за цял екран */}
      <button type="button" onClick={() => url && setFull(true)} disabled={!url} title="Отвори на цял екран"
        className="group relative block w-full rounded-xl border border-slate-200 overflow-hidden bg-slate-100 cursor-zoom-in text-left">
        {!url ? (
          <div className="h-[55vh] flex items-center justify-center text-xs text-slate-400">Зареждане на прегледа…</div>
        ) : (
          <>
            <div className="pointer-events-none">
              {kind === 'pdf'
                ? <iframe src={`${url}#view=FitH&toolbar=0`} title={name || 'Преглед'} tabIndex={-1} className="w-full h-[55vh] bg-white" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={url} alt={name || 'Преглед'} className="w-full h-auto bg-white" />}
            </div>
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 py-2 text-xs text-white bg-[#0f2240]/80 opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 size={13} /> Цял екран
            </span>
          </>
        )}
      </button>

      {/* Цял екран */}
      {full && url && (
        <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex flex-col p-3 md:p-6" onClick={() => setFull(false)}>
          <div className="flex items-center gap-2 mb-2 text-white" onClick={e => e.stopPropagation()}>
            <span className="text-sm truncate flex-1">{name || 'Преглед'}</span>
            <a href={url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25">
              <ExternalLink size={13} /> Нов таб
            </a>
            <button type="button" onClick={() => setFull(false)} title="Затвори (Esc)"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25">
              <X size={14} /> Затвори
            </button>
          </div>
          <div className="flex-1 min-h-0 rounded-xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            {viewer('w-full h-full')}
          </div>
        </div>
      )}
    </>
  )
}
