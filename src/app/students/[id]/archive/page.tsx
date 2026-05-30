'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Archive } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import { getFullName } from '@/lib/utils'

export default function ArchiveStudentPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [student, setStudent] = useState<any>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('students').select('*').eq('id', id).single().then(({ data }) => setStudent(data))
  }, [id])

  async function handleArchive(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) { toast('Въведи причина за напускане', 'error'); return }
    setSaving(true)

    const { error } = await supabase
      .from('students')
      .update({
        status: 'archived',
        archive_reason: reason,
        archived_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) { toast('Грешка при архивиране', 'error'); setSaving(false); return }

    toast('Ученикът е архивиран. Данните са запазени.')
    router.push('/students')
  }

  return (
    <div className="p-8 max-w-md">
      <Link href={`/students/${id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад
      </Link>

      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Архивиране на ученик</h1>
      {student && <p className="text-slate-500 text-sm mb-6">{getFullName(student)}</p>}

      <div className="card">
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-5">
          <Archive size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Данните на ученика ще бъдат запазени в архива. Можете да ги прегледате по всяко време.
          </p>
        </div>

        <form onSubmit={handleArchive} className="space-y-4">
          <div>
            <label className="label">Причина за напускане <span className="text-red-500">*</span></label>
            <textarea
              rows={3}
              className="input resize-none"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Напр. завършване, преместване в друго училище..."
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-danger">
              {saving ? 'Архивиране...' : 'Архивирай'}
            </button>
            <Link href={`/students/${id}`} className="btn-secondary">Отказ</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
