'use client'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { confirmDialog } from '@/components/ui/Toast'

// Махане на отразено отсъствие (класният / ръководството) — напр. детето се върна по-рано
export default function RemoveAbsence({ id, onDone }: { id: string; onDone?: () => void }) {
  const router = useRouter()
  return (
    <button type="button" title="Махни" onClick={async () => {
      if (!await confirmDialog('Да се махне ли отсъствието?')) return
      await createClient().from('student_absences').delete().eq('id', id)
      onDone ? onDone() : router.refresh()
    }} className="p-0.5 rounded text-slate-300 hover:text-rose-600"><X size={13} /></button>
  )
}
