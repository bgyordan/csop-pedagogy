'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Save } from 'lucide-react'
import { BackButton } from '@/components/ui/BackButton'
import { useToast } from '@/components/ui/Toast'
import { getFullName, getMonthName } from '@/lib/utils'

interface Entry {
  student_id: string
  student_name: string
  planned_hours: number
  realized_hours: number
  reason: string
  compensation: string
}

const REASONS = ['Семейни', 'Здравословни', 'Семейни и здравословни']

export default function AbsenceEditorPage() {
  const params = useParams()
  const classId = params.classId as string
  const month = parseInt(params.month as string)
  const { toast } = useToast()
  const supabase = createClient()

  const year = month >= 9 ? new Date().getFullYear() - 1 : new Date().getFullYear()

  const [className, setClassName] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [saving, setSaving] = useState(false)
  const [monthlyId, setMonthlyId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [classId, month])

  async function loadData() {
    const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).single()
    setClassName(cls?.name || '')

    const { data: yearData } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('*, student:students(*)')
      .eq('class_id', classId)
      .eq('academic_year_id', yearData?.id)

    const students = enrollments?.map((e: any) => e.student).filter(Boolean) || []

    const { data: existing } = await supabase
      .from('monthly_absences')
      .select('id')
      .eq('class_id', classId)
      .eq('month', month)
      .eq('year', year)
      .single()

    if (existing) {
      setMonthlyId(existing.id)
      const { data: existingEntries } = await supabase
        .from('absence_entries')
        .select('*')
        .eq('monthly_absence_id', existing.id)

      setEntries(students.map((s: any) => {
        const found = existingEntries?.find(e => e.student_id === s.id)
        return {
          student_id: s.id,
          student_name: getFullName(s),
          planned_hours: found?.planned_hours || 0,
          realized_hours: found?.realized_hours || 0,
          reason: found?.reason || '',
          compensation: found?.compensation || '',
        }
      }))
    } else {
      setEntries(students.map((s: any) => ({
        student_id: s.id,
        student_name: getFullName(s),
        planned_hours: 0,
        realized_hours: 0,
        reason: '',
        compensation: '',
      })))
    }
  }

  function updateEntry(index: number, field: keyof Entry, value: string | number) {
    setEntries(prev => prev.map((e, i) => {
      if (i !== index) return e
      const updated = { ...e, [field]: value }

      if (field === 'realized_hours' || field === 'planned_hours') {
        const planned = field === 'planned_hours' ? Number(value) : e.planned_hours
        const realized = field === 'realized_hours' ? Number(value) : e.realized_hours

        if (realized > planned) return { ...e }

        if (realized === planned) {
          updated.reason = 'Неприложимо'
          updated.compensation = 'Неприложимо'
        } else {
          if (updated.reason === 'Неприложимо') updated.reason = ''
          updated.compensation = 'Преразпределение на учебните часове'
        }
      }

      return updated
    }))
  }

  async function handleSave() {
    setSaving(true)
    const { data: yearData } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('staff_profiles').select('id').eq('user_id', user?.id!).single()

    let absenceId = monthlyId
    if (!absenceId) {
      const { data: newAbsence } = await supabase
        .from('monthly_absences')
        .insert({ class_id: classId, academic_year_id: yearData?.id, month, year, submitted_by: profile?.id, submitted_at: new Date().toISOString() })
        .select('id').single()
      absenceId = newAbsence?.id
      setMonthlyId(absenceId)
    }

    if (!absenceId) { toast('Грешка', 'error'); setSaving(false); return }

    await supabase.from('absence_entries').delete().eq('monthly_absence_id', absenceId)
    await supabase.from('absence_entries').insert(
      entries.map(e => ({
        monthly_absence_id: absenceId,
        student_id: e.student_id,
        subject: 'ИУП',
        planned_hours: e.planned_hours,
        realized_hours: e.realized_hours,
        reason: e.reason,
        compensation: e.compensation,
      }))
    )

    toast('Данните са запазени')
    setSaving(false)
  }

  return (
    <div className="p-8">
      <BackButton />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Реализация на ИУП — {getMonthName(month)} {year}</h1>
          <p className="text-slate-500 text-sm mt-1">Паралелка {className}</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0f2240' }}>
          <Save size={15} />
          {saving ? 'Запазване...' : 'Запази'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Три имена</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Планирани ч.</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Реализирани ч.</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Причини</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Компенсиране</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => {
              const diff = entry.planned_hours - entry.realized_hours
              const isEqual = entry.planned_hours > 0 && diff === 0
              return (
                <tr key={entry.student_id} className={`border-b border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                  <td className="px-4 py-2 font-medium text-slate-800">{entry.student_name}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min="0"
                      value={entry.planned_hours}
                      onChange={e => updateEntry(idx, 'planned_hours', parseInt(e.target.value) || 0)}
                      className="input text-center w-20 mx-auto block"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min="0" max={entry.planned_hours}
                      value={entry.realized_hours}
                      onChange={e => updateEntry(idx, 'realized_hours', parseInt(e.target.value) || 0)}
                      className="input text-center w-20 mx-auto block"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {isEqual || entry.planned_hours === 0 ? (
                      <span className="text-xs text-slate-400">{entry.reason || '—'}</span>
                    ) : (
                      <select
                        value={entry.reason === 'Неприложимо' ? '' : entry.reason}
                        onChange={e => updateEntry(idx, 'reason', e.target.value)}
                        className="input text-xs"
                      >
                        <option value="">— Избери —</option>
                        {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {entry.compensation || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {entries.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">Няма ученици в тази паралелка</div>}
      </div>
    </div>
  )
}
