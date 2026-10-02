'use client'

// Меню „Още ▾“ в лентата на досието — затваря се при клик навън, Esc или избор.
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function MoreMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 border border-slate-300 px-3 py-2 rounded-xl hover:bg-slate-50">
        Още <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div onClick={e => { if ((e.target as HTMLElement).closest('a')) setOpen(false) }}
          className="absolute right-0 mt-1 w-56 z-30 rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,34,64,0.14)] p-1.5">
          {children}
        </div>
      )}
    </div>
  )
}
