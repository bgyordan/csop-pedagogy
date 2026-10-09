'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowRight } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { fillEplrFromTherapists } from './team-actions'

// „Попълни ЕПЛР екипа от терапевтите“ — еднократно копиране, без автоматично наливане
export default function FillEplrButton({ studentId }: { studentId: string }) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  return (
    <button type="button" disabled={busy}
      onClick={async () => {
        if (!confirm('ЕПЛР екипът за годината да стане като терапевтите на детето? (празните места при терапевтите не трият попълненото)')) return
        setBusy(true)
        const r: any = await fillEplrFromTherapists(studentId)
        setBusy(false)
        if (r?.error) { toast(r.error, 'error'); return }
        toast('ЕПЛР екипът е попълнен от терапевтите')
        router.refresh()
      }}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-800 hover:bg-amber-50 disabled:opacity-50">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />} Попълни ЕПЛР екипа от терапевтите
    </button>
  )
}
