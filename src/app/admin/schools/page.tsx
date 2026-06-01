'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { useToast } from '@/components/ui/Toast'
import { Plus, Pencil, X, Check, School } from 'lucide-react'

interface School {
  id: string
  name: string
  city: string
  is_active: boolean
}

export default function SchoolsAdminPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)

  // Форма за ново училище
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCity, setNewCity] = useState('Варна')
  const [saving, setSaving] = useState(false)

  // Редактиране
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCity, setEditCity] = useState('')

  useEffect(() => { loadSchools() }, [showInactive])

  async function loadSchools() {
    setLoading(true)
    let query = supabase.from('sending_schools').select('*').order('city').order('name')
    if (!showInactive) query = query.eq('is_active', true)
    const { data } = await query
    setSchools(data || [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!newName.trim()) { toast('Въведи име на училището', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('sending_schools').insert({
      name: newName.trim(),
      city: newCity.trim() || 'Варна',
    })
    if (error) { toast('Грешка при добавяне', 'error'); setSaving(false); return }
    toast('Училището е добавено')
    setNewName('')
    setNewCity('Варна')
    setAdding(false)
    setSaving(false)
    loadSchools()
  }

  async function handleEdit(id: string) {
    if (!editName.trim()) { toast('Въведи ime', 'error'); return }
    const { error } = await supabase.from('sending_schools').update({
      name: editName.trim(),
      city: editCity.trim(),
    }).eq('id', id)
    if (error) { toast('Грешка при запис', 'error'); return }
    toast('Запазено')
    setEditId(null)
    loadSchools()
  }

  async function toggleActive(school: School) {
    const { error } = await supabase.from('sending_schools')
      .update({ is_active: !school.is_active }).eq('id', school.id)
    if (error) { toast('Грешка', 'error'); return }
    toast(school.is_active ? 'Училището е скрито' : 'Училището е активирано')
    loadSchools()
  }

  const activeCount = schools.filter(s => s.is_active).length

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <BackButton />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Изпращащи училища</h1>
          <p className="text-slate-500 text-sm mt-1">{activeCount} активни училища</p>
        </div>
        <button
          onClick={() => { setAdding(true); setNewName(''); setNewCity('Варна') }}
          className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#0f2240' }}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Ново училище</span>
          <span className="sm:hidden">Ново</span>
        </button>
      </div>

      {/* Форма за добавяне */}
      {adding && (
        <div className="card mb-4 border-2 border-blue-100">
          <h2 className="font-medium text-slate-700 text-sm mb-3">Ново училище</h2>
          <div className="space-y-3">
            <div>
              <label className="label">Име на училището <span className="text-red-500">*</span></label>
              <input
                className="input"
                placeholder='ОУ „Иван Вазов"'
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Град / Село</label>
              <input
                className="input"
                placeholder="Варна"
                value={newCity}
                onChange={e => setNewCity(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleAdd} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: '#0f2240' }}>
                <Check size={14} />
                {saving ? 'Запазване...' : 'Добави'}
              </button>
              <button onClick={() => setAdding(false)}
                className="px-4 py-2 rounded-lg text-sm border border-slate-200 hover:bg-slate-50">
                Отказ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Филтър активни/неактивни */}
      <div className="flex items-center gap-2 mb-4">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Покажи скритите
        </label>
      </div>

      {/* Списък */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Зареждане...</div>
        ) : schools.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <School className="mx-auto mb-2 opacity-30" size={32} />
            <p className="text-sm">Няма добавени училища</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {schools.map(school => (
              <div key={school.id} className={`px-4 py-3 ${!school.is_active ? 'opacity-50' : ''}`}>
                {editId === school.id ? (
                  // Режим редактиране
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex gap-2">
                      <input
                        className="input flex-1"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleEdit(school.id)}
                        autoFocus
                      />
                      <input
                        className="input w-32"
                        value={editCity}
                        onChange={e => setEditCity(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleEdit(school.id)}
                        placeholder="Град"
                      />
                    </div>
                    <button onClick={() => handleEdit(school.id)}
                      className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  // Нормален изглед
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{school.name}</div>
                      <div className="text-xs text-slate-400">{school.city}</div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => { setEditId(school.id); setEditName(school.name); setEditCity(school.city) }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Редактирай"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => toggleActive(school)}
                        className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                          school.is_active
                            ? 'border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                        title={school.is_active ? 'Скрий' : 'Активирай'}
                      >
                        {school.is_active ? 'Скрий' : 'Активирай'}
                      </button>
                    </div>
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
