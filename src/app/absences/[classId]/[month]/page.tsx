'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Download, Save } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import { getFullName, getMonthName } from '@/lib/utils'
import { generateAbsencesExcel } from '@/lib/excel-generator'

interface Entry {
  student_id: string
  student_name: string
  subject: string
  planned_hours: number
  realized_hours: number
  reason: string
  compensation: string
}

export default function AbsenceEditorPage() {
  const params = useParams()
  const classId = params.classId as string
  const month = parseInt(params.month as string)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [className, setClassName] = useState('')
  const [students, setStudents] = useState<any[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [saving, setSaving] = useState(false)
  const [monthlyId, setMonthlyId] = useState<string | null>(null)
  const year = month >= 9 ? new Date().getFullYear() : new Date().getFullYear()

  useEffect(() => { loadData() }, [classId, month])

  async function loadData() {
    const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).single()
    setClassName(cls?.name || '')

    const { data: yearData } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('student:students(*)')
      .eq('class_id', classId)
      .eq('academic_year_id', yearData?.id)

    const studentList = enrollments?.map((e: any) => e.student).filter(Boolean) || []
    setStudents(studentList)

    // Load existing
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

      const mapped: Entry[] = studentList.map((s: any) => {
        const found = existingEntries?.filter(e => e.student_id === s.id) || []
        if (found.length > 0) {
          return found.map(e => ({
            student_id: s.id,
            student_name: getFullName(s),
            subject: e.subject,
            planned_hours: e.planned_hours,
            realized_hours: e.realized_hours,
            reason: e.reason || '',
            compensation: e.compensation || '',
          }))
        }
        return [{
          student_id: s.id,
          student_name: getFullName(s),
          subject: '',
          planned_hours: 0,
          realized_hours: 0,
          reason: '',
          compensation: '',
        }]
      }).flat()
      setEntries(mapped)
    } else {
      setEntries(studentList.map((s: any) => ({
        student_id: s.id,
        student_name: getFullName(s),
        subject: '',
        planned_hours: 0,
        realized_hours: 0,
        reason: '',
        compensation: '',
      })))
    }
  }

  function updateEntry(index: number, field: keyof Entry, value: string | number) {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e))
  }

  function addRow(studentId: string, studentName: string) {
    setEntries(prev => [...prev, {
      student_id: studentId,
      student_name: studentName,
      subject: '',
      planned_hours: 0,
      realized_hours: 0,
      reason: '',
      compensation: '',
    }])
  }

  async function handleSave() {
    setSaving(true)
    const { data: yearData } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
    const { data: profile } = await supabase.from('staff_profiles').select('id').eq('user_id', (await supabase.auth.getUser()).data.user?.id!).single()

    let absenceId = monthlyId
    if (!absenceId) {
      const { data: newAbsence } = await supabase
        .from('monthly_absences')
        .insert({
          class_id: classId,
          academic_year_id: yearData?.id,
          month,
          year,
          submitted_by: profile?.id,
          submitted_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      absenceId = newAbsence?.id
      setMonthlyId(absenceId)
    }

    if (!absenceId) { toast('Грешка', 'error'); setSaving(false); return }

    await supabase.from('absence_entries').delete().eq('monthly_absence_id', absenceId)

    const validEntries = entries.filter(e => e.subject)
    if (validEntries.length > 0) {
      await supabase.from('absence_entries').insert(
        validEntries.map(e => ({
          monthly_absence_id: absenceId,
          student_id: e.student_id,
          subject: e.subject,
          planned_hours: e.planned_hours,
          realized_hours: e.realized_hours,
          reason: e.reason || null,
          compensation: e.compensation || null,
        }))
      )
    }

    toast('Отсъствията са запазени')
    setSaving(false)
  }

  function handleExport() {
    generateAbsencesExcel(
      [{ id: monthlyId || '', class_id: classId, academic_year_id: '', month, year, created_at: '', updated_at: '', entries: entries.map(e => ({ ...e, id: '', monthly_absence_id: monthlyId || '', created_at: '' })) }],
      students,
      className,
      month,
      year
    )
  }

  const grouped = students.map(s => ({
    student: s,
    rows: entries.filter(e => e.student_id === s.id),
  }))

  return (
    <div className="p-8">
      <Link href="/absences" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            Отсъствия — {getMonthName(month)} {year}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Паралелка {className}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
            <Download size={15} />
            Excel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2" style={{ backgroundColor: '#0f2240' }}>
            <Save size={15} />
            {saving ? 'Запазване...' : 'Запази'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {grouped.map(({ student, rows }) => (
          <div key={student.id} className="card">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="font-medium text-slate-700 text-sm">{getFullName(student)}</h3>
              <button
                onClick={() => addRow(student.id, getFullName(student))}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                + Добави ред
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400">
                    <th className="text-left pb-2 pr-3 font-medium w-40">Предмет/Терапия</th>
                    <th className="text-center pb-2 pr-3 font-medium w-24">Планирани ч.</th>
                    <th className="text-center pb-2 pr-3 font-medium w-24">Реализирани ч.</th>
                    <th className="text-left pb-2 pr-3 font-medium">Причина</th>
                    <th className="text-left pb-2 font-medium">Компенсиране</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const globalIdx = entries.indexOf(row)
                    return (
                      <tr key={idx}>
                        <td className="pr-3 pb-2">
                          <input className="input text-xs" value={row.subject} onChange={e => updateEntry(globalIdx, 'subject', e.target.value)} placeholder="Предмет..." />
                        </td>
                        <td className="pr-3 pb-2">
                          <input type="number" min="0" className="input text-xs text-center" value={row.planned_hours} onChange={e => updateEntry(globalIdx, 'planned_hours', parseInt(e.target.value) || 0)} />
                        </td>
                        <td className="pr-3 pb-2">
                          <input type="number" min="0" className="input text-xs text-center" value={row.realized_hours} onChange={e => updateEntry(globalIdx, 'realized_hours', parseInt(e.target.value) || 0)} />
                        </td>
                        <td className="pr-3 pb-2">
                          <input className="input text-xs" value={row.reason} onChange={e => updateEntry(globalIdx, 'reason', e.target.value)} placeholder="Причина..." />
                        </td>
                        <td className="pb-2">
                          <input className="input text-xs" value={row.compensation} onChange={e => updateEntry(globalIdx, 'compensation', e.target.value)} placeholder="Компенсиране..." />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
