'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Save, CalendarDays } from 'lucide-react'
import { BackButton } from '@/components/ui/BackButton'
import { useToast, confirmDialog } from '@/components/ui/Toast'
import { getFullName, getMonthName } from '@/lib/utils'

interface Entry {
  student_id: string
  ifo: boolean
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

  // Годината на отчетния месец идва от текущата учебна година (септ.–дек. = началната година,
  // януари–юни = следващата) — същото, което ползва списъкът „Реализация на ИУП“ и Excel-ът.
  const [year, setYear] = useState<number | null>(null)
  const [yearId, setYearId] = useState<string | null>(null)
  const [filling, setFilling] = useState(false)

  const [className, setClassName] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [saving, setSaving] = useState(false)
  const [monthlyId, setMonthlyId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [classId, month])

  async function loadData() {
    const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).single()
    setClassName(cls?.name || '')

    const { data: yearData } = await supabase.from('academic_years').select('id, start_date').eq('is_current', true).single()
    const startYear = yearData?.start_date ? parseInt(String(yearData.start_date).slice(0, 4)) : new Date().getFullYear()
    const year = month >= 9 ? startYear : startYear + 1
    setYear(year)
    setYearId(yearData?.id || null)

    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('*, student:students(*)')
      .eq('class_id', classId)
      .eq('academic_year_id', yearData?.id)

    const students = enrollments?.map((e: any) => e.student && ({ ...e.student, __ifo: e.education_form === 'ifo' })).filter(Boolean) || []

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
          ifo: !!s.__ifo,
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
        ifo: !!s.__ifo,
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

        // планираните не могат да са по-малко от реализираните → реализираните се смъкват
        if (realized > planned) {
          if (field === 'realized_hours') return { ...e }
          updated.realized_hours = planned
        }
        const r = Math.min(realized, planned)

        if (r === planned) {
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

  // Планирани часове от седмичното разписание: за всеки учебен ден от месеца (академичния календар —
  // ваканции, празници и спонтанни неучебни дни отпадат) се броят часовете на паралелката в този ден
  // от седмицата, по разписанието на съответния срок. Дете в ИФО — по неговите ИФО часове.
  // Октомври включва и септември. Реализираните, причините и компенсирането не се пипат —
  // вярната информация за отсъствията е в НЕИСПУО.
  async function fillPlanned() {
    if (!year || !yearId) return
    if (entries.some(e => e.planned_hours > 0) && !await confirmDialog('Планираните часове ще бъдат заменени с изчислените от седмичното разписание. Продължаваш ли?')) return
    setFilling(true)
    try {
      const pad = (n: number) => String(n).padStart(2, '0')
      const from = month === 10 ? `${year}-09-01` : `${year}-${pad(month)}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const to = `${year}-${pad(month)}-${pad(lastDay)}`

      const { data: days } = await supabase.from('academic_calendar_days')
        .select('date, term, day_of_week').gte('date', from).lte('date', to).eq('is_school_day', true)
      if (!days || days.length === 0) { toast('Няма учебни дни в календара за този месец', 'error'); return }

      // часове на паралелката: клетки ден·час по срок (група/няколко учители в една клетка = 1 час)
      const { data: scheds } = await supabase.from('class_schedules').select('id, term')
        .eq('class_id', classId).eq('academic_year_id', yearId)
      const termOf: Record<string, number> = {}
      ;(scheds || []).forEach((s: any) => { termOf[s.id] = s.term })
      const classCells: Record<number, Set<string>> = { 1: new Set(), 2: new Set() }
      if (scheds && scheds.length) {
        const { data: slots } = await supabase.from('schedule_slots').select('schedule_id, day, period')
          .in('schedule_id', scheds.map((s: any) => s.id)).limit(5000)
        ;(slots || []).forEach((sl: any) => classCells[termOf[sl.schedule_id]]?.add(`${sl.day}-${sl.period}`))
      }

      // ИФО часове на децата в ИФО
      const ifoIds = entries.filter(e => e.ifo).map(e => e.student_id)
      const ifoCells: Record<string, Record<number, Set<string>>> = {}
      if (ifoIds.length) {
        const { data: ifo } = await supabase.from('teacher_ifo_slots').select('student_id, term, day, period')
          .in('student_id', ifoIds).eq('academic_year_id', yearId)
        ;(ifo || []).forEach((r: any) => {
          const m = (ifoCells[r.student_id] ||= { 1: new Set(), 2: new Set() })
          m[r.term]?.add(`${r.day}-${r.period}`)
        })
      }

      // часове в даден ден от седмицата; ако за II срок още няма разписание — по I срок
      const perDay = (cells: Record<number, Set<string>>, term: number, dow: number) => {
        const set = cells[term]?.size ? cells[term] : cells[1]
        let n = 0
        set?.forEach(k => { if (k.startsWith(`${dow}-`)) n++ })
        return n
      }
      const total = (cells: Record<number, Set<string>>) =>
        days.reduce((sum: number, d: any) => sum + perDay(cells, d.term === 2 ? 2 : 1, d.day_of_week), 0)

      const classTotal = total(classCells)
      let empty = 0
      const next = entries.map(e => {
        const planned = e.ifo ? (ifoCells[e.student_id] ? total(ifoCells[e.student_id]) : 0) : classTotal
        if (planned === 0) { empty++; return e }
        const realized = Math.min(e.realized_hours, planned)
        const updated = { ...e, planned_hours: planned, realized_hours: realized }
        if (realized === planned) { updated.reason = 'Неприложимо'; updated.compensation = 'Неприложимо' }
        else {
          if (updated.reason === 'Неприложимо') updated.reason = ''
          updated.compensation = 'Преразпределение на учебните часове'
        }
        return updated
      })
      setEntries(next)
      toast(empty
        ? `Попълнени от разписанието. Без разписание: ${empty} — въведи ги ръчно`
        : 'Планираните часове са попълнени от разписанието — провери с НЕИСПУО')
    } finally {
      setFilling(false)
    }
  }

  async function handleSave() {
    if (!year) return
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

    if (!absenceId) { toast('Записът не можа да се създаде — възможно е друг класен вече да е въвел паралелката', 'error'); setSaving(false); return }

    // Първо вмъкваме новите редове, после трием старите — ако вмъкването се провали, старите остават
    const { data: inserted, error: insErr } = await supabase.from('absence_entries').insert(
      entries.map(e => ({
        monthly_absence_id: absenceId,
        student_id: e.student_id,
        subject: 'ИУП',
        planned_hours: e.planned_hours,
        realized_hours: e.realized_hours,
        reason: e.reason,
        compensation: e.compensation,
      }))
    ).select('id')
    if (insErr) { toast('Грешка при запис: ' + insErr.message, 'error'); setSaving(false); return }
    const keep = (inserted || []).map((r: any) => r.id)
    let del = supabase.from('absence_entries').delete().eq('monthly_absence_id', absenceId)
    if (keep.length) del = del.not('id', 'in', `(${keep.join(',')})`)
    const { error: delErr } = await del
    if (delErr) { toast('Грешка при запис: ' + delErr.message, 'error'); setSaving(false); return }

    await supabase.from('monthly_absences').update({ submitted_at: new Date().toISOString() }).eq('id', absenceId)

    const missing = entries.filter(e => e.planned_hours > 0 && e.realized_hours < e.planned_hours && !e.reason).length
    toast(missing ? `Запазено. Липсва причина при ${missing} ${missing === 1 ? 'дете' : 'деца'}` : 'Данните са запазени', missing ? 'error' : undefined)
    setSaving(false)
  }

  return (
    <div className="p-8">
      <BackButton />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Реализация на ИУП — {getMonthName(month)}{month === 10 ? ' (и септември)' : ''} {year ?? ''}</h1>
          <p className="text-slate-500 text-sm mt-1">Паралелка {className}</p>
        </div>
        <div className="flex items-center gap-2">
        <button onClick={fillPlanned} disabled={filling || !year || entries.length === 0}
          title="Изчислява планираните часове от седмичното разписание и учебните дни в календара"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-normal text-slate-700 bg-white border border-slate-200 shadow-sm hover:shadow transition-shadow disabled:opacity-50">
          <CalendarDays size={15} />
          {filling ? 'Изчисляване...' : 'Планирани от разписанието'}
        </button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0f2240' }}>
          <Save size={15} />
          {saving ? 'Запазване...' : 'Запази'}
        </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto"><table className="w-full text-sm">
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
        </table></div>
        {entries.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">Няма ученици в тази паралелка</div>}
      </div>
    </div>
  )
}
