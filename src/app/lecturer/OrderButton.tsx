'use client'
import { useEffect, useRef, useState } from 'react'
import { Loader2, FileDown, ChevronDown } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getLecturerFrameworkData } from './actions'
import { generateLecturerFrameworkOrder } from '@/lib/docx-substitution'

/** Тегли заповедта за лекторски (без ИЧ — те са по отделна заповед на директора). Връща текст на грешка или null. */
export async function downloadLecturerOrder(mode: 'common' | 'separate', staffId?: string): Promise<string | null> {
  const res: any = await getLecturerFrameworkData(staffId)
  if (res.error) return res.error
  try { await generateLecturerFrameworkOrder(res.data, mode); return null }
  catch { return 'Грешка при генериране' }
}

// „Заповед лекторски“ — горе в заглавието на страницата: обща за всички или отделна за всеки
export default function OrderButton() {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function download(mode: 'common' | 'separate') {
    setOpen(false); setBusy(true)
    const err = await downloadLecturerOrder(mode)
    setBusy(false)
    if (err) toast(err, 'error'); else toast(mode === 'common' ? 'Заповедта е изтеглена' : 'Заповедите са изтеглени — всяка на отделна страница')
  }

  const item = (mode: 'common' | 'separate', title: string, sub: string) => (
    <button type="button" onClick={() => download(mode)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50">
      <div className="text-sm text-slate-800">{title}</div>
      <div className="text-[11px] text-slate-500">{sub}</div>
    </button>
  )

  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen(o => !o)} disabled={busy}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: '#0f2240' }}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} Заповед лекторски <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 z-30 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {item('common', 'Обща заповед', 'една заповед за всички с разпределени часове')}
          {item('separate', 'Отделна заповед за всеки', 'в един файл, всяка на нова страница')}
          <div className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">Без ИЧ — те са по отделна заповед на директора. За един човек — бутонът до него в таблицата.</div>
        </div>
      )}
    </div>
  )
}
