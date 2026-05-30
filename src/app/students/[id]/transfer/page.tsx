'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import { getFullName } from '@/lib/utils'

export default function TransferStudentPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [student, setStudent] = useState<any>(null)
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentClass, setCurrentClass] = useState<string>('')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: s } = await supabase.from('students').select('*').eq('id', id).single()
    setStudent(s)

    const { data: year } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

    const { data: cls } = await supabase
      .from('classes').select('id, name').eq('academic_year_id', year?.id).order('name')
    setClasses(cls || [])

    const { data: enrollment } = await supabase
      .from('student_enrollments')
      .select('class_id, class:classes(name)')
      .eq('student_id', id)
      .eq('academic_year_id', year?.id)
      .single()
    if (enrollment) setCurrentClass((enrollment.class as any)?.name || '')
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClass) { toast('Избери паралелка', 'error'); return }
    setSaving(true)

    const { data: year } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

    const { error } = await supabase
      .from('student_enrollments')
      .update({ class_id: selectedClass })
      .eq('student_id', id)
      .eq('academic_year_id', year?.id)

    if (error) { toast('Грешка при прехвърляне', 'error'); setSaving(false); return }

    toast('Ученикът е прехвърлен успешно')
    router.push(`/students/${id}`)
  }

  return (
    <div className="p-8 max-w-md">
      <Link href={`/students/${id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад
      </Link>

      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Прехвърляне в паралелка</h1>
      {student && <p className="text-slate-500 text-sm mb-6">{getFullName(student)}</p>}

      <div className="card">
        {currentClass && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
            Текуща паралелка: <strong>{currentClass}</strong>
          </div>
        )}
        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <label className="label">Нова паралелка</label>
            <select
              className="input"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
            >
              <option value="">— Избери —</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary" style={{ backgroundColor: '#0f2240' }}>
              {saving ? 'Прехвърляне...' : 'Прехвърли'}
            </button>
            <Link href={`/students/${id}`} className="btn-secondary">Отказ</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
