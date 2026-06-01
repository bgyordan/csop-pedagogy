'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Props {
  committeeId: string
  committeeName: string
}

export function DeleteCommitteeButton({ committeeId, committeeName }: Props) {
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Изтрий комисията "${committeeName}"?\n\nТова ще изтрие и всички членове и заседания.`)) return
    setDeleting(true)

    // Изтрий членове и заседания (cascade ако е настроено, иначе ръчно)
    await supabase.from('committee_members').delete().eq('committee_id', committeeId)
    await supabase.from('committee_sessions').delete().eq('committee_id', committeeId)
    const { error } = await supabase.from('committees').delete().eq('id', committeeId)

    if (error) { toast('Грешка при изтриване', 'error'); setDeleting(false); return }

    toast('Комисията е изтрита')
    router.push('/committees')
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
    >
      <Trash2 size={13} />
      {deleting ? 'Изтриване...' : 'Изтрий комисията'}
    </button>
  )
}
