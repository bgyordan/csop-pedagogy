'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Loader2, Users } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'

export default function AcademicYearsPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [years, setYears] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [counts, setCounts] = useState<Record<string, { students: number; teachers: number }>>({})
  const [open, setOpen] = useState(false)
  const [classOpen, setClassOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' })
  const [className, setClassName] = useState('')

  const currentYear = years.find(y => y.is_current)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: y } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false })
    setYears(y || [])

    const { data: cls } = await supabase
      .from('classes').select('*, academic_year:academic_years(name, is_current)').order('name')
    setClasses(cls || [])

    // Брой ученици и класни по паралелка
    const [{ data: enr }, { data: cta }] = await Promise.all([
      supabase.from('student_enrollments').select('class_id'),
      supabase.from('class_teacher_assignments').select('class_id'),
    ])

    const map: Record<string, { students: number; teachers: number }> = {}
    ;(cls || []).forEach((c: any) => { map[c.id] = { students: 0, teachers: 0 } })
    ;(enr || []).forEach((e: any) => { if (map[e.class_id]) map[e.class_id].students++ })
    ;(cta || []).forEach((t: any) => { if (map[t.class_id]) map[t.class_id].teachers++ })
    setCounts(map)
  }

  async function handleSaveYear(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.start_date || !form.end_date) { toast('Попълни всички полета', 'error'); return }
    setSaving(true)
    await supabase.from('academic_years').insert({ name: form.name, start_date: form.start_date, end_date: form.end_date, is_current: false })
    toast('Учебната година е добавена')
    setOpen(false)
    setSaving(false)
    setForm({ name: '', start_date: '', end_date: '' })
    load()
  }

  async function setCurrentYear(id: string) {
    await supabase.from('academic_years').update({ is_current: false }).neq('id', id)
    await supabase.from('academic_years').update({ is_current: true }).eq('id', id)
    toast('Текущата учебна година е сменена')
    load()
  }

  async function handleAddClass(e: React.FormEvent) {
    e.preventDefault()
    if (!className.trim()) { toast('Въведи име на паралелката', 'error'); return }
    if (!currentYear?.id) { toast('Няма определена текуща учебна година', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('classes').insert({
      name: className.trim(),
      academic_year_id: currentYear.id,
    })
    if (error) { toast('Паралелката вече съществува', 'error'); setSaving(false); return }
    toast('Паралелката е добавена')
    setClassOpen(false)
    setSaving(false)
    setClassName('')
    load()
  }

  async function handleDeleteClass(cls: any) {
    const c = counts[cls.id] || { students: 0, teachers: 0 }

    if (c.students > 0) {
      toast(`Не може: в паралелката има ${c.students} записани ученика`, 'error')
      return
    }
    if (c.teachers > 0) {
      toast('Не може: паралелката има назначен класен ръководител', 'error')
      return
    }
    if (!confirm(`Изтриване на паралелка „${cls.name}"?`)) return

    setDeleting(cls.id)
    const { error } = await supabase.from('classes').delete().eq('id', cls.id)
    setDeleting(null)

    if (error) { toast(`Грешка: ${error.message}`, 'error'); return }
    toast('Паралелката е изтрита')
    load()
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Учебни години и паралелки</h1>

      {/* Учебни години */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h2 className="font-medium text-slate-700">Учебни години</h2>
          <button onClick={() => setOpen(true)} className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800">
            <Plus size={13} /> Добави
          </button>
        </div>
        <div className="space-y-2">
          {years.map(y => (
            <div key={y.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div>
                <span className="font-medium text-slate-800">{y.name}</span>
                <span className="text-xs text-slate-400 ml-3">{formatDate(y.start_date)} — {formatDate(y.end_date)}</span>
              </div>
              <div className="flex items-center gap-2">
                {y.is_current
                  ? <span className="badge-completed">Текуща</span>
                  : <button onClick={() => setCurrentYear(y.id)} className="text-xs text-slate-400 hover:text-slate-700 border border-slate-200 px-2 py-1 rounded">Направи текуща</button>
                }
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Паралелки */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="font-medium text-slate-700">Паралелки</h2>
            {currentYear && (
              <p className="text-[11px] text-slate-400 mt-0.5">Новите се създават в {currentYear.name}</p>
            )}
          </div>
          <button onClick={() => setClassOpen(true)} className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800">
            <Plus size={13} /> Добави паралелка
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {classes.map(c => {
            const cnt = counts[c.id] || { students: 0, teachers: 0 }
            const canDelete = cnt.students === 0 && cnt.teachers === 0
            const isCurrent = (c.academic_year as any)?.is_current

            return (
              <div key={c.id}
                className={`relative p-3 rounded-lg text-center group ${isCurrent ? 'bg-slate-50' : 'bg-slate-50/50 opacity-60'}`}>
                <div className="font-medium text-slate-800">{c.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{(c.academic_year as any)?.name}</div>
                <div className="flex items-center justify-center gap-1 mt-1 text-[10px] text-slate-400">
                  <Users size={9} />
                  {cnt.students}
                </div>

                <button
                  onClick={() => handleDeleteClass(c)}
                  disabled={deleting === c.id}
                  title={canDelete ? 'Изтрий паралелката' : 'Паралелката не е празна'}
                  className={`absolute top-1.5 right-1.5 p-1 rounded transition-opacity ${
                    canDelete
                      ? 'text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100'
                      : 'text-slate-200 cursor-not-allowed opacity-0 group-hover:opacity-100'
                  }`}>
                  {deleting === c.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>
            )
          })}
        </div>

        {classes.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Няма създадени паралелки</p>
        )}
      </div>

      {/* Нова учебна година */}
      <Modal open={open} onClose={() => setOpen(false)} title="Нова учебна година" size="sm">
        <form onSubmit={handleSaveYear} className="space-y-3">
          <div>
            <label className="label">Наименование (напр. 2025-2026)</label>
            <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="2025-2026" />
          </div>
          <div>
            <label className="label">Начало</label>
            <input type="date" className="input" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Край</label>
            <input type="date" className="input" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary" style={{ backgroundColor: '#0f2240' }}>Добави</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Отказ</button>
          </div>
        </form>
      </Modal>

      {/* Нова паралелка */}
      <Modal open={classOpen} onClose={() => setClassOpen(false)} title="Нова паралелка" size="sm">
        <form onSubmit={handleAddClass} className="space-y-3">
          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Учебна година</span>
            <div className="text-sm font-semibold text-slate-700 mt-0.5">
              {currentYear?.name || <span className="text-red-500">Няма определена текуща година</span>}
            </div>
          </div>
          <div>
            <label className="label">Име на паралелката</label>
            <input autoFocus className="input" value={className} onChange={e => setClassName(e.target.value)} placeholder="напр. 01" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving || !currentYear} className="btn-primary" style={{ backgroundColor: '#0f2240' }}>Добави</button>
            <button type="button" onClick={() => setClassOpen(false)} className="btn-secondary">Отказ</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
