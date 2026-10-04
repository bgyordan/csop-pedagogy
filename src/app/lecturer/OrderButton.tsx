'use client'
import { useState } from 'react'
import { Loader2, FileDown } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getLecturerFrameworkData } from './actions'
import { generateLecturerFrameworkOrder } from '@/lib/docx-substitution'

// „Заповед лекторски“ — горе в заглавието на страницата, не мърда със списъка
export default function OrderButton() {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  async function download() {
    setBusy(true)
    const res: any = await getLecturerFrameworkData()
    if (res.error) { toast(res.error, 'error'); setBusy(false); return }
    try { await generateLecturerFrameworkOrder(res.data); toast('Заповедта е изтеглена') }
    catch { toast('Грешка при генериране', 'error') }
    setBusy(false)
  }
  return (
    <button onClick={download} disabled={busy}
      className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm hover:opacity-90 disabled:opacity-40 shrink-0"
      style={{ backgroundColor: '#0f2240' }}>
      {busy ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} Заповед лекторски
    </button>
  )
}
