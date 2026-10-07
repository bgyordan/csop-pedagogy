'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, Unlock, Copy } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { setScheduleLock, copySchoolTerm1To2 } from './actions'

// Утвърждаване на разписанието за срока + копиране на цялото училище от I във II срок
export default function PlanAdminBar({ term, locked, lockInfo }: { term: number; locked: boolean; lockInfo: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const [busy, setBusy] = useState<'' | 'lock' | 'copy'>('')
  const [confirmCopy, setConfirmCopy] = useState(false)

  async function toggleLock() {
    const msg = locked
      ? `Да се отключи разписанието за ${term === 2 ? 'II' : 'I'} срок? Учителите отново ще могат да променят своите часове.`
      : `Да се утвърди разписанието за ${term === 2 ? 'II' : 'I'} срок? След това учителите няма да могат да го променят — само управата.`
    if (!confirm(msg)) return
    setBusy('lock')
    const res: any = await setScheduleLock(term, !locked)
    setBusy('')
    if (res?.error) { toast(res.error, 'error'); return }
    toast(locked ? 'Разписанието е отключено' : 'Разписанието е утвърдено')
    router.refresh()
  }

  async function copy() {
    setBusy('copy')
    const res: any = await copySchoolTerm1To2()
    setBusy('')
    setConfirmCopy(false)
    if (res?.error) { toast(res.error, 'error'); return }
    toast(`Копирани ${res.copied} часа${res.already ? ` · ${res.already} вече ги има` : ''}${res.conflicts ? ` · ${res.conflicts} пропуснати (заети)` : ''}`)
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={toggleLock} disabled={!!busy}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium disabled:opacity-50 ${locked
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
          : 'border-slate-200 bg-white text-[#0f2240] hover:bg-slate-50'}`}
        title={locked ? `Утвърдено: ${lockInfo}` : 'Учителите няма да могат да променят разписанието за срока'}>
        {busy === 'lock' ? <Loader2 size={13} className="animate-spin" /> : locked ? <Lock size={13} /> : <Unlock size={13} />}
        {locked ? `Утвърдено (${lockInfo}) — отключи` : 'Утвърди разписанието'}
      </button>
      {term === 2 && (confirmCopy ? (
        <span className="inline-flex flex-wrap items-center gap-2 text-xs text-slate-600">
          Копират се всички часове от I срок, които ги няма във II. Нищо във II срок не се трие или дублира; заетите часове се пропускат.
          <button onClick={copy} disabled={!!busy} className="px-2.5 py-1 rounded-lg border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 disabled:opacity-50">
            {busy === 'copy' ? <Loader2 size={12} className="animate-spin" /> : 'Копирай'}
          </button>
          <button onClick={() => setConfirmCopy(false)} disabled={!!busy} className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">Отказ</button>
        </span>
      ) : (
        <button onClick={() => setConfirmCopy(true)} disabled={!!busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-[#0f2240] hover:bg-slate-50">
          <Copy size={13} /> Копирай цялото училище от I срок
        </button>
      ))}
    </div>
  )
}
