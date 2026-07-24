'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { useToast } from '@/components/ui/Toast'
import { Plus, Pencil, X, Check, School, MapPin, User, Phone, Mail, AlertCircle, Users, ChevronDown, ChevronUp, UserPlus, Loader2 } from 'lucide-react'

interface SchoolRow {
  id: string
  name: string
  city: string
  is_active: boolean
  director_name: string | null
  address: string | null
  deputy_director: string | null
  phone: string | null
  email: string | null
}

const emptyForm = {
  name: '', city: 'Варна', director_name: '', address: '',
  deputy_director: '', phone: '', email: '',
}

export default function SchoolsAdminPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [schools, setSchools] = useState<SchoolRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [onlyIncomplete, setOnlyIncomplete] = useState(false)

  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // Ученици по училища
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [studentsBySchool, setStudentsBySchool] = useState<Record<string, any[]>>({})
  const [orphans, setOrphans] = useState<any[]>([])
  const [linking, setLinking] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => { loadSchools() }, [showInactive])

  async function loadSchools() {
    setLoading(true)
    let query = supabase.from('sending_schools').select('*').order('city').order('name')
    if (!showInactive) query = query.eq('is_active', true)
    const { data } = await query
    setSchools(data || [])
    await loadStudents()
    setLoading(false)
  }

  async function loadStudents() {
    const { data } = await supabase
      .from('students')
      .select('id, first_name, middle_name, last_name, external_class, sending_school_id')
      .eq('status', 'active')
      .order('first_name')

    const map: Record<string, any[]> = {}
    const noSchool: any[] = []
    ;(data || []).forEach((s: any) => {
      if (s.sending_school_id) {
        if (!map[s.sending_school_id]) map[s.sending_school_id] = []
        map[s.sending_school_id].push(s)
      } else {
        noSchool.push(s)
      }
    })
    setStudentsBySchool(map)
    setOrphans(noSchool)
  }

  async function linkStudent(studentId: string, schoolId: string) {
    setLinking(studentId)
    const { error } = await supabase
      .from('students')
      .update({ sending_school_id: schoolId })
      .eq('id', studentId)
    setLinking(null)
    if (error) { toast(`Грешка: ${error.message}`, 'error'); return }
    toast('Ученикът е свързан с училището')
    setPickerOpen(false)
    loadStudents()
  }

  async function unlinkStudent(studentId: string) {
    if (!confirm('Премахване на връзката с това училище?')) return
    setLinking(studentId)
    const { error } = await supabase
      .from('students')
      .update({ sending_school_id: null })
      .eq('id', studentId)
    setLinking(null)
    if (error) { toast(`Грешка: ${error.message}`, 'error'); return }
    toast('Връзката е премахната')
    loadStudents()
  }

  function fullName(s: any) {
    return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ')
  }

  function startAdd() {
    setForm(emptyForm)
    setEditId(null)
    setAdding(true)
  }

  function startEdit(s: SchoolRow) {
    setForm({
      name: s.name || '', city: s.city || '',
      director_name: s.director_name || '', address: s.address || '',
      deputy_director: s.deputy_director || '', phone: s.phone || '', email: s.email || '',
    })
    setAdding(false)
    setEditId(s.id)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast('Въведи име на училището', 'error'); return }
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      city: form.city.trim() || 'Варна',
      director_name: form.director_name.trim() || null,
      address: form.address.trim() || null,
      deputy_director: form.deputy_director.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
    }

    const { error } = editId
      ? await supabase.from('sending_schools').update(payload).eq('id', editId)
      : await supabase.from('sending_schools').insert(payload)

    setSaving(false)
    if (error) { toast(`Грешка: ${error.message}`, 'error'); return }

    toast(editId ? 'Запазено' : 'Училището е добавено')
    setEditId(null)
    setAdding(false)
    setForm(emptyForm)
    loadSchools()
  }

  async function toggleActive(school: SchoolRow) {
    const { error } = await supabase.from('sending_schools')
      .update({ is_active: !school.is_active }).eq('id', school.id)
    if (error) { toast('Грешка', 'error'); return }
    toast(school.is_active ? 'Училището е скрито' : 'Училището е активирано')
    loadSchools()
  }

  function isIncomplete(s: SchoolRow) {
    return !s.director_name?.trim() || !s.address?.trim()
  }

  const visible = onlyIncomplete ? schools.filter(isIncomplete) : schools
  const activeCount = schools.filter(s => s.is_active).length
  const incompleteCount = schools.filter(isIncomplete).length

  const FormFields = (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="label">Име на училището <span className="text-red-500">*</span></label>
          <input className="input" placeholder='ОУ „Иван Вазов"' autoFocus
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Град / Село</label>
          <input className="input" placeholder="Варна"
            value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
        </div>
      </div>

      <div>
        <label className="label">Адрес</label>
        <input className="input" placeholder='ул. „Роза" № 23'
          value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        <p className="text-[11px] text-slate-400 mt-1">Без града — той се добавя автоматично при писмата</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Директор</label>
          <input className="input" placeholder="Име, презиме, фамилия"
            value={form.director_name} onChange={e => setForm(f => ({ ...f, director_name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Заместник-директор</label>
          <input className="input" placeholder="незадължително"
            value={form.deputy_director} onChange={e => setForm(f => ({ ...f, deputy_director: e.target.value }))} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Телефон</label>
          <input className="input" placeholder="052/000-000"
            value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </div>
        <div>
          <label className="label">Имейл</label>
          <input className="input" placeholder="info-000000@edu.mon.bg"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: '#0f2240' }}>
          <Check size={14} />
          {saving ? 'Запазване...' : editId ? 'Запази промените' : 'Добави'}
        </button>
        <button onClick={() => { setAdding(false); setEditId(null) }}
          className="px-4 py-2 rounded-lg text-sm border border-slate-200 hover:bg-slate-50">
          Отказ
        </button>
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <BackButton />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Изпращащи училища</h1>
          <p className="text-slate-500 text-sm mt-1">
            {activeCount} активни
            {incompleteCount > 0 && (
              <span className="text-amber-600"> · {incompleteCount} с непълни данни</span>
            )}
            {orphans.length > 0 && (
              <span className="text-blue-600"> · {orphans.length} ученика без училище</span>
            )}
          </p>
        </div>
        <button onClick={startAdd}
          className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#0f2240' }}>
          <Plus size={16} />
          <span className="hidden sm:inline">Ново училище</span>
          <span className="sm:hidden">Ново</span>
        </button>
      </div>

      {adding && (
        <div className="card mb-4 border-2 border-blue-100">
          <h2 className="font-medium text-slate-700 text-sm mb-3">Ново училище</h2>
          {FormFields}
        </div>
      )}

      {/* Филтри */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)} className="rounded" />
          Покажи скритите
        </label>
        {incompleteCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-amber-700 cursor-pointer">
            <input type="checkbox" checked={onlyIncomplete}
              onChange={e => setOnlyIncomplete(e.target.checked)} className="rounded" />
            Само с непълни данни
          </label>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Зареждане...</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <School className="mx-auto mb-2 opacity-30" size={32} />
            <p className="text-sm">{onlyIncomplete ? 'Всички са попълнени' : 'Няма добавени училища'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visible.map(school => (
              <div key={school.id} className={!school.is_active ? 'opacity-50' : ''}>
                {editId === school.id ? (
                  <div className="px-4 py-4 bg-slate-50/60">
                    <h3 className="font-medium text-slate-700 text-sm mb-3">Редакция</h3>
                    {FormFields}
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-800">{school.name}</span>
                        {isIncomplete(school) && (
                          <AlertCircle size={12} className="text-amber-500 flex-shrink-0"
                            aria-label="Непълни данни" />
                        )}
                      </div>

                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <MapPin size={10} />
                        {school.city}
                        {school.address && <span> · {school.address}</span>}
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500">
                        {school.director_name ? (
                          <span className="flex items-center gap-1">
                            <User size={10} className="text-slate-300" />
                            {school.director_name}
                          </span>
                        ) : (
                          <span className="text-amber-600">няма директор</span>
                        )}
                        {school.deputy_director && (
                          <span className="text-slate-400">ЗДУД: {school.deputy_director}</span>
                        )}
                        {school.phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={10} className="text-slate-300" />{school.phone}
                          </span>
                        )}
                        {school.email && (
                          <span className="flex items-center gap-1">
                            <Mail size={10} className="text-slate-300" />{school.email}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setExpandedId(expandedId === school.id ? null : school.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                        title="Ученици от това училище">
                        <Users size={12} />
                        {(studentsBySchool[school.id] || []).length}
                        {expandedId === school.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                      <button onClick={() => startEdit(school)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Редактирай">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => toggleActive(school)}
                        className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                          school.is_active
                            ? 'border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}>
                        {school.is_active ? 'Скрий' : 'Активирай'}
                      </button>
                    </div>
                  </div>
                )}

                {expandedId === school.id && editId !== school.id && (
                  <div className="px-4 pb-4 bg-slate-50/40 border-t border-slate-100">
                    <div className="flex items-center justify-between pt-3 pb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Ученици от това училище
                      </span>
                      {orphans.length > 0 && (
                        <button
                          onClick={() => setPickerOpen(true)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
                          style={{ backgroundColor: '#0f2240' }}>
                          <UserPlus size={11} /> Добави ученик
                        </button>
                      )}
                    </div>

                    {(studentsBySchool[school.id] || []).length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">Няма записани ученици от това училище</p>
                    ) : (
                      <div className="space-y-1">
                        {(studentsBySchool[school.id] || []).map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-100">
                            <span className="text-xs text-slate-700">{fullName(s)}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[11px] text-slate-400">{s.external_class || '—'}</span>
                              <button
                                onClick={() => unlinkStudent(s.id)}
                                disabled={linking === s.id}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                                title="Премахни от това училище">
                                {linking === s.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {pickerOpen && (
                      <div className="mt-3 p-3 rounded-xl bg-white border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Ученици без изпращащо училище ({orphans.length})
                          </span>
                          <button onClick={() => setPickerOpen(false)} className="text-slate-400 hover:text-slate-700">
                            <X size={13} />
                          </button>
                        </div>
                        <div className="space-y-1 max-h-56 overflow-y-auto">
                          {orphans.map((s: any) => (
                            <button
                              key={s.id}
                              onClick={() => linkStudent(s.id, school.id)}
                              disabled={linking === s.id}
                              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 text-left transition-colors">
                              <span className="text-xs text-slate-700">{fullName(s)}</span>
                              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                {s.external_class || '—'}
                                {linking === s.id
                                  ? <Loader2 size={11} className="animate-spin" />
                                  : <UserPlus size={11} className="text-slate-300" />}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
