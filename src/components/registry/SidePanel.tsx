'use client'

// Страничен панел отдясно за преглед на запис — списъкът остава видим отляво.
// Клик на друг ред сменя съдържанието; ↑/↓ минават към съседния запис (управлява се от списъка).

import { ChevronDown, ChevronUp, X } from 'lucide-react'

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
