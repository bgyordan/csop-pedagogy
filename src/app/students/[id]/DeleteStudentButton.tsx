'use client'
// „Изтрий (грешно въведен)“ — само за администратор; потвърждение с фамилията на детето.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { deleteWrongStudent } from './delete-actions'

export default function DeleteStudentButton({ studentId, fullName, lastName }: { studentId: string; fullName: string; lastName: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = typed.trim().toLowerCase() === lastName.trim().toLowerCase()

  async function go() {
    setBusy(true)
    const res: any = await deleteWrongStudent(studentId, typed)
    setBusy(false)
    if (res.error) { toast(res.error, 'error'); return }
    toast(`${fullName} е изтрит(а)`)
    router.push('/students')
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-rose-700 hover:bg-rose-50 text-left">
        <Trash2 size={14} /> Изтрий (грешно въведен)
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center p-4" onClick={() => !busy && setOpen(false)}>
          <div className="mt-24 w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <Trash2 size={18} className="text-rose-600 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-base text-[#0f2240]">Изтриване на {fullName}</h2>
                <p className="text-[13px] text-slate-500 mt-1">Само за грешно въведен ученик — не може да се върне. Истинските деца се архивират.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <label className="block text-[13px] text-slate-600">За потвърждение напишете фамилията: <b className="font-medium">{lastName}</b>
              <input value={typed} onChange={e => setTyped(e.target.value)} autoFocus
                className="block w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rose-400" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Отказ</button>
              <button type="button" onClick={go} disabled={!ok || busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-40">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Изтрий
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
