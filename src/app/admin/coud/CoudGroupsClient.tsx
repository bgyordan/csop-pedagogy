'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Coffee, User, Users, X, Loader2, Pencil, Trash2 } from 'lucide-react'
import CoudGroupModal from './CoudGroupModal'

interface Teacher { id: string; first_name: string; last_name: string }
interface Group {
  id: string
  name: string
  teacher_id: string | null
  teacher: Teacher | null
  enrollments: { count: number }[]
}

interface Props {
  groups: Group[]
  teachers: Teacher[]
  academicYearId: string
}

export default function CoudGroupsClient({ groups, teachers, academicYearId }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTeacher, setNewTeacher] = useState('')
  const [saving, setSaving] = useState(false)
  const [manageGroup, setManageGroup] = useState<Group | null>(null)
  const [editGroup, setEditGroup] = useState<Group | null>(null)
  const [editName, setEditName] = useState('')
  const [editTeacher, setEditTeacher] = useState('')

  async function createGroup() {
    if (!newName.trim()) return
    setSaving(true)
    const { error } = await supabase.from('coud_groups').insert({
      name: newName.trim(),
      teacher_id: newTeacher || null,
      academic_year_id: academicYearId,
    })
    setSaving(false)
    if (!error) {
      setNewName(''); setNewTeacher(''); setShowNew(false)
      router.refresh()
    } else alert(`Грешка: ${error.message}`)
  }

  async function saveEdit() {
    if (!editGroup || !editName.trim()) return
    setSaving(true)
    await supabase.from('coud_groups')
      .update({ name: editName.trim(), teacher_id: editTeacher || null })
      .eq('id', editGroup.id)
    setSaving(false)
    setEditGroup(null)
    router.refresh()
  }

  async function deleteGroup(id: string) {
    if (!confirm('Изтриване на ЦОУД групата? Записванията в нея също ще се премахнат.')) return
    await supabase.from('coud_groups').delete().eq('id', id)
    router.refresh()
  }

  function startEdit(g: Group) {
    setEditGroup(g)
    setEditName(g.name)
    setEditTeacher(g.teacher_id || '')
  }

  const sortedTeachers = [...teachers].sort((a, b) => a.first_name.localeCompare(b.first_name, 'bg'))

  return (
    <div className="space-y-4">
      {/* Бутон нова група */}
      {!showNew ? (
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0f2240] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
          <Plus size={17} /> Нова ЦОУД група
        </button>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-2">
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Име (напр. ЦОУД 01)" className="input flex-1 text-sm" />
            <select value={newTeacher} onChange={e => setNewTeacher(e.target.value)} className="input sm:w-56 text-sm">
              <option value="">— Възпитател —</option>
              {sortedTeachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => { setShowNew(false); setNewName(''); setNewTeacher('') }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium">Отказ</button>
              <button onClick={createGroup} disabled={saving || !newName.trim()}
                className="px-4 py-2 text-white rounded-xl text-sm font-medium flex items-center gap-1.5 disabled:opacity-60"
                style={{ backgroundColor: '#0f2240' }}>
                {saving && <Loader2 size={13} className="animate-spin" />} Създай
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Списък групи */}
      {groups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
          <Coffee size={28} className="mx-auto mb-2 text-slate-300" />
          <p className="text-slate-400 text-sm">Няма създадени ЦОУД групи</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map(g => {
            const count = g.enrollments?.[0]?.count || 0
            return (
              <div key={g.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition-all">
                {editGroup?.id === g.id ? (
                  <div className="space-y-2">
                    <input value={editName} onChange={e => setEditName(e.target.value)} className="input w-full text-sm" />
                    <select value={editTeacher} onChange={e => setEditTeacher(e.target.value)} className="input w-full text-sm">
                      <option value="">— Възпитател —</option>
                      {sortedTeachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                    </select>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditGroup(null)} className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs">Отказ</button>
                      <button onClick={saveEdit} disabled={saving} className="px-3 py-1.5 text-white rounded-lg text-xs" style={{ backgroundColor: '#0f2240' }}>Запази</button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => setManageGroup(g)} className="cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                          <Coffee size={16} className="text-slate-500" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 text-sm">{g.name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <User size={11} />
                            {g.teacher ? `${g.teacher.first_name} ${g.teacher.last_name}` : 'Без възпитател'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => startEdit(g)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil size={13} /></button>
                        <button onClick={() => deleteGroup(g.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 text-xs font-medium text-slate-600">
                      <span className="flex items-center gap-1.5"><Users size={13} /> {count} ученика</span>
                      <span className="text-slate-400">Виж състава →</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {manageGroup && (
        <CoudGroupModal
          group={manageGroup}
          academicYearId={academicYearId}
          onClose={() => setManageGroup(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  )
}
