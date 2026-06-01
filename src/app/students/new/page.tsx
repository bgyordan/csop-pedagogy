'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Search } from 'lucide-react'
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
    sending_school_id: '' as string | null,
  })
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])

  // Combobox state
  const [schools, setSchools] = useState<{ id: string; name: string; city: string }[]>([])
  const [schoolSearch, setSchoolSearch] = useState('')
  const [schoolOpen, setSchoolOpen] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState<{ id: string; name: string; city: string } | null>(null)
  const comboRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: year } = await supabase
      .from('academic_years').select('id').eq('is_current', true).single()

    if (year) {
      const { data: cls } = await supabase
        .from('classes').select('id, name').eq('academic_year_id', year.id).order('name')
      setClasses(cls || [])
    }

    const { data: sch } = await supabase
      .from('sending_schools').select('*').eq('is_active', true).order('name')
    setSchools(sch || [])
  }

  // Затвори при клик извън
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setSchoolOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredSchools = schools.filter(s =>
    `${s.name} ${s.city}`.toLowerCase().includes(schoolSearch.toLowerCase())
  )

  function selectSchool(school: { id: string; name: string; city: string }) {
    setSelectedSchool(school)
    setForm(p => ({ ...p, sending_school_id: school.id }))
    setSchoolSearch(`${school.name} — ${school.city}`)
    setSchoolOpen(false)
  }

  function clearSchool() {
    setSelectedSchool(null)
    setForm(p => ({ ...p, sending_school_id: null }))
    setSchoolSearch('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name || !form.last_name || !form.birth_date) {
      toast('Попълни задължителните полета', 'error')
      return
    }
    setSaving(true)

    const { data: year } = await supabase
      .from('academic_years').select('id').eq('is_current', true).single()

    const { data: student, error } = await supabase
      .from('students')
      .insert({
        first_name: form.first_name,
        middle_name: form.middle_name || null,
        last_name: form.last_name,
        birth_date: form.birth_date,
        sending_school_id: form.sending_school_id || null,
        status: 'active',
      })
      .select()
      .single()

    if (error || !student) {
      toast('Грешка при добавяне', 'error')
      setSaving(false)
      return
    }

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
    <div className="p-4 md:p-8 max-w-xl">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад
      </Link>

      <h1 className="text-xl md:text-2xl font-semibold text-slate-800 mb-6">Нов ученик</h1>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Първо име <span className="text-red-500">*</span></label>
          <input className="input" value={form.first_name}
            onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
            placeholder="Иван" />
        </div>
        <div>
          <label className="label">Презиме</label>
          <input className="input" value={form.middle_name}
            onChange={e => setForm(p => ({ ...p, middle_name: e.target.value }))}
            placeholder="Петров" />
        </div>
        <div>
          <label className="label">Фамилия <span className="text-red-500">*</span></label>
          <input className="input" value={form.last_name}
            onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
            placeholder="Иванов" />
        </div>
        <div>
          <label className="label">Дата на раждане <span className="text-red-500">*</span></label>
          <input type="date" className="input" value={form.birth_date}
            onChange={e => setForm(p => ({ ...p, birth_date: e.target.value }))} />
        </div>

        {/* Изпращащо училище — Combobox */}
        <div>
          <label className="label">Изпращащо училище</label>
          <div ref={comboRef} className="relative">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9 pr-8"
                placeholder="Търси училище..."
                value={schoolSearch}
                onChange={e => {
                  setSchoolSearch(e.target.value)
                  setSchoolOpen(true)
                  if (!e.target.value) clearSchool()
                }}
                onFocus={() => setSchoolOpen(true)}
              />
              {selectedSchool && (
                <button type="button" onClick={clearSchool}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none">
                  ×
                </button>
              )}
            </div>
            {schoolOpen && filteredSchools.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredSchools.map(school => (
                  <button key={school.id} type="button" onClick={() => selectSchool(school)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors">
                    <div className="font-medium text-slate-800">{school.name}</div>
                    <div className="text-xs text-slate-400">{school.city}</div>
                  </button>
                ))}
              </div>
            )}
            {schoolOpen && schoolSearch && filteredSchools.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm text-slate-400">
                Не е намерено — добави го от{' '}
                <a href="/admin/schools" className="text-blue-600 hover:underline">
                  Администрация → Училища
                </a>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="label">Паралелка</label>
          <select className="input" value={form.class_id}
            onChange={e => setForm(p => ({ ...p, class_id: e.target.value }))}>
            <option value="">— Избери паралелка —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="text-white px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: '#0f2240' }}>
            {saving ? 'Запазване...' : 'Добави ученик'}
          </button>
          <Link href="/students" className="btn-secondary">Отказ</Link>
        </div>
      </form>
    </div>
  )
}
