'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, ExternalLink } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { getFullName } from '@/lib/utils'
import { StaffProfile, UserRole, ROLE_LABELS } from '@/types'

const EMPTY_FORM = {
  first_name: '', middle_name: '', last_name: '',
  role: 'class_teacher' as UserRole,
  email: '', phone: '',
}

export default function AdminStaffPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [classesByStaff, setClassesByStaff] = useState<Record<string, string[]>>({})
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StaffProfile | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<'name' | 'role'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('staff_profiles').select('*').order('first_name')
    setStaff(data || [])

    const { data: year } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

    // Реалните назначения като класен ръководител
    const { data: assignments } = await supabase
      .from('class_teacher_assignments')
      .select('staff_id, class:classes(name)')
      .eq('academic_year_id', year?.id)

    const map: Record<string, string[]> = {}
    ;(assignments || []).forEach((a: any) => {
      const name = a.class?.name
      if (!name) return
      if (!map[a.staff_id]) map[a.staff_id] = []
      map[a.staff_id].push(name)
    })
    Object.values(map).forEach(list => list.sort((x, y) => x.localeCompare(y, 'bg', { numeric: true })))
    setClassesByStaff(map)
  }

  function toggleSort(col: 'name' | 'role') {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function sortIcon(col: 'name' | 'role') {
    if (sortCol !== col) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function openEdit(s: any) {
    setEditing(s)
    setForm({
      first_name: s.first_name,
      middle_name: s.middle_name || '',
      last_name: s.last_name,
      role: s.role,
      email: s.email,
      phone: s.phone || '',
    })
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name || !form.last_name || !form.email) {
      toast('Попълни задължителните полета', 'error'); return
    }
    setSaving(true)

    const payload = {
      first_name: form.first_name,
      middle_name: form.middle_name || null,
      last_name: form.last_name,
      role: form.role,
      position: ROLE_LABELS[form.role],
      email: form.email,
      phone: form.phone || null,
    }

    let error
    if (editing) {
      ({ error } = await supabase.from('staff_profiles').update(payload).eq('id', (editing as any).id))
    } else {
      ({ error } = await supabase.from('staff_profiles').insert({ ...payload, is_active: true }))
    }

    if (error) { toast(`Грешка при запис: ${error.message}`, 'error'); setSaving(false); return }

    toast(editing ? 'Промените са запазени' : 'Служителят е добавен')
    setOpen(false)
    setSaving(false)
    load()
  }

  async function toggleActive(s: StaffProfile) {
    await supabase.from('staff_profiles').update({ is_active: !s.is_active }).eq('id', s.id)
    toast(s.is_active ? 'Деактивиран' : 'Активиран')
    load()
  }

  const filtered = staff
    .filter(s => !search || getFullName(s).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const valA = sortCol === 'name' ? getFullName(a) : ROLE_LABELS[a.role]
      const valB = sortCol === 'name' ? getFullName(b) : ROLE_LABELS[b.role]
      return sortDir === 'asc' ? valA.localeCompare(valB, 'bg') : valB.localeCompare(valA, 'bg')
    })

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Управление на служители</h1>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} служители</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0f2240' }}>
          <Plus size={16} />
          Нов служител
        </button>
      </div>

      <input
        className="input max-w-sm mb-4"
        placeholder="Търси по име..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-800" onClick={() => toggleSort('name')}>
                  Имена{sortIcon('name')}
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-800" onClick={() => toggleSort('role')}>
                  Роля{sortIcon('role')}
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Класен на</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Имейл</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Статус</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => {
                const myClasses = classesByStaff[s.id] || []
                return (
                  <tr key={s.id} className={`border-b border-slate-100 hover:bg-blue-50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                    <td className="px-4 py-2 font-medium text-slate-800">
                      <Link href={`/staff/${s.id}`} className="hover:underline hover:text-[#0f2240] inline-flex items-center gap-1">
                        {getFullName(s)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{ROLE_LABELS[s.role]}</td>
                    <td className="px-4 py-2">
                      {myClasses.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {myClasses.map(name => (
                            <span key={name} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium">
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-600 font-mono text-xs">{s.email}</td>
                    <td className="px-4 py-2">
                      <span className={s.is_active ? 'badge-completed' : 'badge-empty'}>
                        {s.is_active ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(s)} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1">
                          <Pencil size={12} />
                          Редактирай
                        </button>
                        <button onClick={() => toggleActive(s)} className="text-xs text-slate-400 hover:text-slate-700 whitespace-nowrap">
                          {s.is_active ? 'Деактивирай' : 'Активирай'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-3">
        Паралелките се назначават от страницата на служителя или от самата паралелка.
      </p>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Редактирай служител' : 'Нов служител'}>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Първо име <span className="text-red-500">*</span></label>
              <input className="input" value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Презиме</label>
              <input className="input" value={form.middle_name} onChange={e => setForm(p => ({ ...p, middle_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Фамилия <span className="text-red-500">*</span></label>
            <input className="input" value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Роля</label>
            <select className="input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {editing && form.role === 'class_teacher' && (
            <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Класен на</div>
              <div className="text-sm text-slate-700 mt-0.5">
                {(classesByStaff[(editing as any).id] || []).join(', ') || 'няма назначени паралелки'}
              </div>
              <Link href={`/staff/${(editing as any).id}`}
                className="text-[11px] text-slate-500 hover:text-[#0f2240] inline-flex items-center gap-1 mt-1">
                Управление на паралелките <ExternalLink size={10} />
              </Link>
            </div>
          )}
          <div>
            <label className="label">Имейл <span className="text-red-500">*</span></label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Телефон</label>
            <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary" style={{ backgroundColor: '#0f2240' }}>
              {saving ? 'Запазване...' : 'Запази'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Отказ</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
