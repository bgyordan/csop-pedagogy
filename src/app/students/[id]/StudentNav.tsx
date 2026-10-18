'use client'

// Бърз преход между децата в досието: ‹ предишно · списък · следващо ›
// Списъкът е „моят“ — паралелката на детето (класен, управа), децата ми (терапевт) или ЦОУД групата ми (възпитател).
// Табът, на който съм, се запазва при смяната на детето.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react'

export type NavKid = { id: string; name: string }

export default function StudentNav({ kids, currentId, label, tab }: { kids: NavKid[]; currentId: string; label: string; tab?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const i = kids.findIndex(k => k.id === currentId)
  const href = (id: string) => `/students/${id}${tab ? `?tab=${tab}` : ''}`
  const prev = i > 0 ? kids[i - 1] : null
  const next = i >= 0 && i < kids.length - 1 ? kids[i + 1] : null

  // стрелките на клавиатурата (Alt + ← / →) — без да пречат на писането в полета
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return
      if (e.key === 'ArrowLeft' && prev) { e.preventDefault(); router.push(href(prev.id), { scroll: false }) }
      if (e.key === 'ArrowRight' && next) { e.preventDefault(); router.push(href(next.id), { scroll: false }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (i < 0 || kids.length < 2) return null
  const arrow = 'p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#0f2240] transition-colors'
  const off = 'p-1.5 rounded-lg text-slate-200'

  return (
    <div ref={boxRef} className="relative flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl px-1 py-0.5 shadow-sm">
      {prev
        ? <Link href={href(prev.id)} scroll={false} title={`${prev.name} (Alt + ←)`} className={arrow}><ChevronLeft size={16} /></Link>
        : <span className={off}><ChevronLeft size={16} /></span>}
      <button type="button" onClick={() => setOpen(o => !o)} title="Друго дете от списъка"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12.5px] text-slate-600 hover:bg-slate-50 whitespace-nowrap">
        <span className="hidden sm:inline text-slate-400">{label}</span>
        <span className="tabular-nums">{i + 1} / {kids.length}</span>
        <ChevronDown size={13} className="text-slate-400" />
      </button>
      {next
        ? <Link href={href(next.id)} scroll={false} title={`${next.name} (Alt + →)`} className={arrow}><ChevronRight size={16} /></Link>
        : <span className={off}><ChevronRight size={16} /></span>}

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 w-72 max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,34,64,0.14)] p-1.5">
          <div className="px-2.5 pt-1 pb-1.5 text-[11px] text-slate-400 uppercase tracking-widest">{label}</div>
          {kids.map((k, n) => (
            <Link key={k.id} href={href(k.id)} scroll={false} onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[13px] ${k.id === currentId ? 'bg-slate-50 text-[#0f2240]' : 'text-slate-700 hover:bg-slate-50'}`}>
              <span className="w-5 text-right text-[11px] text-slate-400 tabular-nums">{n + 1}</span>
              <span className="flex-1 truncate">{k.name}</span>
              {k.id === currentId && <Check size={14} className="text-[#0f2240]" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
