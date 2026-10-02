'use client'

// Общи елементи за регистрите в деловодството (входящи/изходящи/заповеди):
// подчертаване на търсеното, сортируеми заглавия, клетка „Файл“, действия по реда, филтър-бутони.

import { ChevronDown, ChevronUp, ChevronsUpDown, Paperclip, Pencil, Trash2 } from 'lucide-react'

/** Подчертава търсения текст в клетката. */
export function Hl({ text, q }: { text?: string | null; q?: string }) {
  const t = text || ''
  const needle = (q || '').trim()
  if (!t) return <>—</>
  if (!needle) return <>{t}</>
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = t.split(new RegExp(`(${esc})`, 'gi'))
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === needle.toLowerCase()
          ? <mark key={i} className="bg-amber-200/70 text-inherit rounded-sm px-0.5">{p}</mark>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

/** Заглавие на колона; ако има key — става сортируемо. */
export function SortHeader({ label, sortKey, sort, onSort, align = 'left' }: {
  label: string
  sortKey?: 'num' | 'date'
  sort: string
  onSort: (s: string) => void
  align?: 'left' | 'right'
}) {
  const base = `text-[11px] font-medium uppercase tracking-wider text-slate-500 ${align === 'right' ? 'text-right' : ''}`
  if (!sortKey) return <span className={base}>{label}</span>
  const isAsc = sort === `${sortKey}_asc`
  const isDesc = sort === `${sortKey}_desc`
  const next = isDesc ? `${sortKey}_asc` : isAsc ? '' : `${sortKey}_desc`
  const Icon = isAsc ? ChevronUp : isDesc ? ChevronDown : ChevronsUpDown
  return (
    <button type="button" onClick={() => onSort(next)}
      title="Сортирай"
      className={`${base} inline-flex items-center gap-1 hover:text-[#0f2240] transition-colors ${isAsc || isDesc ? 'text-[#0f2240]' : ''}`}>
      {label}
      <Icon size={12} className={isAsc || isDesc ? '' : 'text-slate-300'} />
    </button>
  )
}

/** Клетка „Файл“ + действия по реда (редакция/изтриване се показват при посочване). */
export function FileAndActions({ item, canEdit, canDelete, onOpenFile, onEdit, onDelete }: {
  item: { file_url?: string | null; is_reserved?: boolean | null }
  canEdit: boolean
  canDelete: boolean
  onOpenFile: () => void
  onEdit: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
      {item.file_url ? (
        <button type="button" title="Отвори файла" onClick={onOpenFile}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md text-slate-600 hover:text-[#0f2240] hover:bg-slate-100 transition-colors">
          <Paperclip size={13} /> файл
        </button>
      ) : item.is_reserved ? (
        <span className="text-slate-300 text-xs px-2">—</span>
      ) : canEdit ? (
        <button type="button" onClick={onEdit} title="Няма прикачен файл — натисни, за да го качиш"
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors whitespace-nowrap">
          <Paperclip size={11} /> няма файл
        </button>
      ) : (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
          <Paperclip size={11} /> няма файл
        </span>
      )}
      <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {canEdit && (
          <button type="button" onClick={onEdit} title="Редакция"
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-slate-100 transition-colors">
            <Pencil size={14} />
          </button>
        )}
        {canDelete && (
          <button type="button" onClick={onDelete} title="Изтрий"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

/** Филтър-бутони с брой: Всички / Без файл. */
export function FilterChips({ value, onChange, counts }: {
  value: string
  onChange: (v: string) => void
  counts: { all: number; nofile: number }
}) {
  const chips: { v: string; l: string; n: number; warn?: boolean }[] = [
    { v: '', l: 'Всички', n: counts.all },
    { v: 'nofile', l: 'Без файл', n: counts.nofile, warn: true },
  ]
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {chips.map(c => {
        const active = value === c.v
        return (
          <button key={c.v || 'all'} type="button" onClick={() => onChange(c.v)}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-colors whitespace-nowrap ${
              active
                ? (c.warn ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-slate-100 border-slate-400 text-[#0f2240] font-medium')
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {c.l}
            <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-full ${
              active ? (c.warn ? 'bg-amber-200 text-amber-900' : 'bg-white text-[#0f2240]') : (c.warn && c.n > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500')
            }`}>{c.n}</span>
          </button>
        )
      })}
    </div>
  )
}
