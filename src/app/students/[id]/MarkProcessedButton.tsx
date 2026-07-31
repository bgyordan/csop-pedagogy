'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Sparkles } from 'lucide-react'

export default function MarkProcessedButton({ studentId }: { studentId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function markProcessed() {
    if (!confirm('Ученикът вече няма да е маркиран като нов. Продължаване?')) return
    setSaving(true)
    await supabase.from('students').update({ is_new: false }).eq('id', studentId)
    setSaving(false)
    router.refresh()
  }

  return (
    <button onClick={markProcessed} disabled={saving}
      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-60">
      {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
      Вече не е нов
    </button>
  )
}
