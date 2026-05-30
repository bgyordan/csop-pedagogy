'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'

export default function NewStudentPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    birth_date: '',
    class_id: '',
  })
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])

  useState(() => {
    loadClasses()
  })

  async function loadClasses() {
    const { data: year } = await supabase
      .from('academic_years')
      .select('id')
      .eq('is_current', true)
      .single()
    if (!year) return
    const { data } = await supabase
      .from('classes')
      .select('id, name')
      .eq('academic_year_id', year.id)
      .order('name')
    setClasses(data || [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name || !form.last_name || !form.birth_date) {
      toast('Попълни задължителните полета', 'error')
      return
    }
    setSaving(true)

    const { data: year } = await supabase
      .from('academic_years')
      .select('id')
      .eq('is_current', true)
      .single()

    const { data: student, error } = await supabase
      .from('students')
      .insert({
        first_name: form.first_name,
        middle_name: form.middle_name || null,
        last_name: form.last_name,
        birth_date: form.birth_date,
        status: 'active',
      })
      .select()
      .single()

    if (error || !student) {
      toast('Грешка при добавяне', 'error')
      setSaving(false)
      return
    }

    // Enroll in class
    if (form.class_id && year) {
      await supabase.from('student_enrollments').insert({
        student_id: student.id,
        class_id: form.class_id,
        academic_year_id: year.id,
      })
    }

    toast('Ученикът е добавен успешно')
    router.push(`/students/${student.id}`)
  }

  return (
    <div className="p-8 max-w-xl">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад
      </Link>

      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Нов ученик</h1>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Първо име <span className="text-red-500">*</span></label>
          <input
            className="input"
            value={form.first_name}
            onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
            placeholder="Иван"
          />
        </div>
        <div>
          <label className="label">Презиме</label>
          <input
            className="input"
            value={form.middle_name}
            onChange={e => setForm(p => ({ ...p, middle_name: e.target.value }))}
            placeholder="Петров"
          />
        </div>
        <div>
          <label className="label">Фамилия <span className="text-red-500">*</span></label>
          <input
            className="input"
            value={form.last_name}
            onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
            placeholder="Иванов"
          />
        </div>
        <div>
          <label className="label">Дата на раждане <span className="text-red-500">*</span></label>
          <input
            type="date"
            className="input"
            value={form.birth_date}
            onChange={e => setForm(p => ({ ...p, birth_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Паралелка</label>
          <select
            className="input"
            value={form.class_id}
            onChange={e => setForm(p => ({ ...p, class_id: e.target.value }))}
          >
            <option value="">— Избери паралелка —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={{ backgroundColor: '#0f2240' }}
          >
            {saving ? 'Запазване...' : 'Добави ученик'}
          </button>
          <Link href="/students" className="btn-secondary">Отказ</Link>
        </div>
      </form>
    </div>
  )
}
