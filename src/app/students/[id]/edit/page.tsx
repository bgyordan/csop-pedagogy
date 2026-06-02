'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { useToast } from '@/components/ui/Toast'
import { Search } from 'lucide-react'

export default function EditStudentPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '', birth_date: '',
    sending_school_id: '' as string | null,
    external_class: '',
  })

  const [schools, setSchools] = useState<{ id: string; name: string; city: string }[]>([])
  const [schoolSearch, setSchoolSearch] = useState('')
  const [schoolOpen, setSchoolOpen] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState<{ id: string; name: string; city: string } | null>(null)
  const comboRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('sending_schools').select('*').eq('is_active', true).order('name')
      .then(({ data }) => setSchools(data || []))

    supabase.from('students').select('*').eq('id', id).single()
      .then(({ data }) => {
        if (data) {
          setForm({
            first_name: data.first_name,
            middle_name: data.middle_name || '',
            last_name: data.last_name,
            birth_date: data.birth_date,
            sending_school_id: data.sending_school_id || null,
            external_class: data.external_class || '',
          })
        }
      })
  }, [id])

  useEffect(() => {
    if (form.sending_school_id && schools.length > 0) {
      const found = schools.find(s => s.id === form.sending_school_id)
      if (found) {
        setSelectedSchool(found)
        setSchoolSearch(`${found.name} — ${found.city}`)
      }
    }
  }, [form.sending_school_id, schools])

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
    if (!form.first_name || !form.last_name) {
      toast('Попълни задължителните полета', 'error')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('students').update({
      first_name: form.first_name,
      middle_name: form.middle_name || null,
      last_name: form.last_name,
      birth_date: form.birth_date,
      sending_school_id: form.sending_school_id || null,
      external_class: form.external_class || null,
    }).eq('id', id)
    if (error) { toast('Грешка при запис', 'error'); setSaving(false); return }
    toast('Данните са обновени')
    router.push(`/students/${id}`)
  }

  return (
    <div className="p-4 md:p-8 max-w-md">
      <BackButton />
      <h1 className="text-xl md:text-2xl font-semibold text-slate-800 mb-6">Редактирай ученик</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Първо име <span className="text-red-500">*</span></label>
          <input className="input" value={form.first_name}
            onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Презиме</label>
          <input className="input" value={form.middle_name}
            onChange={e => setForm(p => ({ ...p, middle_name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Фамилия <span className="text-red-500">*</span></label>
          <input className="input" value={form.last_name}
            onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Дата на раждане</label>
          <input type="date" className="input" value={form.birth_date}
            onChange={e => setForm(p => ({ ...p, birth_date: e.target.value }))} />
        </div>

        {/* Combobox за изпращащо училище */}
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
                Не е намерено — добави го от <a href="/admin/schools" className="text-blue-600 hover:underline">Администрация → Училища</a>
              </div>
            )}
          </div>
        </div>

        {/* Клас в изпращащото училище */}
        <div>
          <label className="label">Клас в изпращащото училище</label>
          <input
            className="input"
            placeholder="напр. 2 а, 5 б, ПГ..."
            value={form.external_class}
            onChange={e => setForm(p => ({ ...p, external_class: e.target.value }))}
          />
          <p className="text-xs text-slate-400 mt-1">Класът по който се обучава в изпращащото училище</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="btn-primary text-white px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: '#0f2240' }}>
            {saving ? 'Запазване...' : 'Запази'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">
            Отказ
          </button>
        </div>
      </form>
    </div>
  )
}
