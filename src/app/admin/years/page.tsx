'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'

export default function AcademicYearsPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [years, setYears] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [classOpen, setClassOpen] = useState(false)
  const [selectedYearId, setSelectedYearId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' })
  const [className, setClassName] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: y } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false })
    setYears(y || [])
    const { data: cls } = await supabase.from('classes').select('*, academic_year:academic_years(name)').order('name')
    setClasses(cls || [])
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
    if (!className || !selectedYearId) { toast('Попълни всички полета', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('classes').insert({ name: className, academic_year_id: selectedYearId })
    if (error) { toast('Паралелката вече съществува', 'error'); setSaving(false); return }
    toast('Паралелката е добавена')
    setClassOpen(false)
    setSaving(false)
    setClassName('')
    load()
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Учебни години и паралелки</h1>

      {/* Years */}
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

      {/* Classes */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h2 className="font-medium text-slate-700">Паралелки</h2>
          <button onClick={() => setClassOpen(true)} className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800">
            <Plus size={13} /> Добави паралелка
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {classes.map(c => (
            <div key={c.id} className="p-3 rounded-lg bg-slate-50 text-center">
              <div className="font-medium text-slate-800">{c.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">{(c.academic_year as any)?.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Year Modal */}
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

      {/* Add Class Modal */}
      <Modal open={classOpen} onClose={() => setClassOpen(false)} title="Нова паралелка" size="sm">
        <form onSubmit={handleAddClass} className="space-y-3">
          <div>
            <label className="label">Учебна година</label>
            <select className="input" value={selectedYearId} onChange={e => setSelectedYearId(e.target.value)}>
              <option value="">— Избери —</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Паралелка (напр. 1А)</label>
            <input className="input" value={className} onChange={e => setClassName(e.target.value)} placeholder="1А" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary" style={{ backgroundColor: '#0f2240' }}>Добави</button>
            <button type="button" onClick={() => setClassOpen(false)} className="btn-secondary">Отказ</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
