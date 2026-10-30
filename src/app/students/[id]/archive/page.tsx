'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Archive } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import { getFullName } from '@/lib/utils'
import { todaySofia } from '@/lib/ores'

export default function ArchiveStudentPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [student, setStudent] = useState<any>(null)
  const [reason, setReason] = useState('')
  const [leftOn, setLeftOn] = useState(todaySofia())   // дата на отписване — по нея детето остава в отчетите (ИУП) за месеца
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('students').select('*').eq('id', id).single().then(({ data }) => setStudent(data))
  }, [id])

  async function handleArchive(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) { toast('Въведи причина за напускане', 'error'); return }
    if (!leftOn) { toast('Въведи дата на отписване', 'error'); return }
    setSaving(true)

    // паралелката, от която излиза — пази се, за да остане в отчетите за месеца на отписване
    const { data: currentYear } = await supabase
      .from('academic_years').select('id').eq('is_current', true).single()
    const { data: enr } = currentYear
      ? await supabase.from('student_enrollments').select('class_id').eq('student_id', id).eq('academic_year_id', currentYear.id).maybeSingle()
      : { data: null }

    const { error } = await supabase
      .from('students')
      .update({
        status: 'archived',
        archive_reason: reason,
        archived_at: leftOn,
        archived_class_id: enr?.class_id ?? null,
      })
      .eq('id', id)
    if (error) { toast('Грешка при архивиране', 'error'); setSaving(false); return }

    // Махаме записването за текущата година — ученикът изчезва от оперативните списъци
    if (currentYear) {
      await supabase
        .from('student_enrollments')
        .delete()
        .eq('student_id', id)
        .eq('academic_year_id', currentYear.id)
    }

    toast('Ученикът е архивиран.')
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
          <div>
            <label className="label">Дата на отписване <span className="text-red-500">*</span></label>
            <input type="date" className="input" value={leftOn} max={todaySofia()} onChange={e => setLeftOn(e.target.value)} />
            <p className="text-xs text-slate-400 mt-1">Детето остава в отчета за реализация на ИУП за месеца, в който е отписано.</p>
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
