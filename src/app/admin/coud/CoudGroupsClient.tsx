'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Coffee, User, Users, Loader2, Pencil, Trash2, FileText, X } from 'lucide-react'
import { generateCoudOrder } from '@/lib/docx-generator'
import CoudGroupModal from './CoudGroupModal'

interface Teacher { id: string; first_name: string; last_name: string }
interface Student { id: string; name: string }
interface Group {
  id: string
  name: string
  teacher_id: string | null
  teacher: Teacher | null
  students: Student[]
}

interface Props {
  groups: Group[]
  teachers: Teacher[]
  academicYearId: string
  yearName?: string
}

export default function CoudGroupsClient({ groups, teachers, academicYearId, yearName = '' }: Props) {
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

  const [showOrder, setShowOrder] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [orderDirector, setOrderDirector] = useState('Светлана Иванова')
  const [genBusy, setGenBusy] = useState(false)

  async function generateOrder() {
    if (!orderNumber.trim()) { alert('Въведете номер на заповедта'); return }
    const withStudents = groups.filter(g => g.students.length > 0)
    if (withStudents.length === 0) { alert('Няма групи с ученици'); return }
    setGenBusy(true)
    try {
      const [y, m, d] = orderDate.split('-')
      await generateCoudOrder(
        orderNumber.trim(),
        `${d}.${m}.${y}`,
        yearName,
        withStudents.map(g => ({
          name: g.name,
          teacher: g.teacher ? `${g.teacher.first_name} ${g.teacher.last_name}` : '',
          students: g.students.map(s => s.name),
        })),
        orderDirector.trim(),
      )
      setShowOrder(false)
    } catch (e: any) {
      alert(`Грешка: ${e.message}`)
    }
    setGenBusy(false)
  }

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
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0f2240] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
            <Plus size={17} /> Нова ЦОУД група
          </button>
          {groups.length > 0 && (
            <button onClick={() => setShowOrder(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
              <FileText size={16} /> Заповед
            </button>
          )}
        </div>
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

      {/* Списък групи с ученици */}
      {groups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
          <Coffee size={28} className="mx-auto mb-2 text-slate-300" />
          <p className="text-slate-400 text-sm">Няма създадени ЦОУД групи</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <div key={g.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Хедър на групата */}
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                {editGroup?.id === g.id ? (
                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                    <input value={editName} onChange={e => setEditName(e.target.value)} className="input flex-1 text-sm" />
                    <select value={editTeacher} onChange={e => setEditTeacher(e.target.value)} className="input sm:w-48 text-sm">
                      <option value="">— Възпитател —</option>
                      {sortedTeachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => setEditGroup(null)} className="px-3 py-1.5 bg-slate-200 rounded-lg text-xs">Отказ</button>
                      <button onClick={saveEdit} disabled={saving} className="px-3 py-1.5 text-white rounded-lg text-xs" style={{ backgroundColor: '#0f2240' }}>Запази</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
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
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400 mr-2">{g.students.length} ученика</span>
                      <button onClick={() => setManageGroup(g)} title="Управление на състава"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-white"><Users size={14} /></button>
                      <button onClick={() => startEdit(g)} title="Редакция"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white"><Pencil size={13} /></button>
                      <button onClick={() => deleteGroup(g.id)} title="Изтриване"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white"><Trash2 size={13} /></button>
                    </div>
                  </>
                )}
              </div>

              {/* Списък ученици — директно видим */}
              {g.students.length === 0 ? (
                <p className="text-sm text-slate-400 px-5 py-4">Няма ученици. Натисни иконата за управление, за да добавиш.</p>
              ) : (
                <ol className="divide-y divide-slate-50">
                  {g.students.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3 px-5 py-2 hover:bg-slate-50/50 transition-colors">
                      <span className="text-xs text-slate-400 w-6 flex-shrink-0 text-right">{i + 1}.</span>
                      <span className="text-sm text-slate-700">{s.name}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}

      {showOrder && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowOrder(false)}>
          <div className="bg-white rounded-3xl border border-slate-200/80 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-medium text-slate-800 text-sm">Заповед за сформиране на ЦОУД групи</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {groups.filter(g => g.students.length > 0).length} групи · {groups.reduce((s, g) => s + g.students.length, 0)} ученика
                </p>
              </div>
              <button onClick={() => setShowOrder(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Номер</label>
                  <input autoFocus value={orderNumber} onChange={e => setOrderNumber(e.target.value)}
                    placeholder="885" className="input w-full text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Дата</label>
                  <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="input w-full text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Директор</label>
                <input value={orderDirector} onChange={e => setOrderDirector(e.target.value)} className="input w-full text-sm" />
              </div>
              <button onClick={generateOrder} disabled={genBusy || !orderNumber.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 hover:opacity-90"
                style={{ backgroundColor: '#0f2240' }}>
                {genBusy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                {genBusy ? 'Генериране...' : 'Свали Word'}
              </button>
            </div>
          </div>
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
