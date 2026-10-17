'use client'
// Отсъствия на детето по период (от „Отсъстващи деца“) — текущи и предстоящи + последния месец.
// Класният / ръководството отразяват и махат; останалите от екипа виждат.

import { useCallback, useEffect, useState } from 'react'
import { CalendarX2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { REASONS, todaySofia, addDays, span } from '@/lib/student-absences'
import type { StudentAbsence } from '@/lib/student-absences'
import AddStudentAbsence from '@/components/absences/AddStudentAbsence'
import RemoveAbsence from '@/components/absences/RemoveAbsence'

export default function StudentAbsencesCard({ studentId }: { studentId: string }) {
  const supabase = createClient()
  const [rows, setRows] = useState<StudentAbsence[] | null>(null)
  const [canMark, setCanMark] = useState(false)
  const today = todaySofia()

  const load = useCallback(async () => {
    const [{ data, error }, { data: ok }] = await Promise.all([
      supabase.from('student_absences').select('*').eq('student_id', studentId).gte('date_to', addDays(today, -30)).order('date_from', { ascending: false }),
      supabase.rpc('can_mark_student_absence', { p_student: studentId }),
    ])
    setRows(error ? [] : (data || []) as StudentAbsence[])
    setCanMark(!!ok)
  }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  if (!rows || (!rows.length && !canMark)) return null
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <CalendarX2 size={15} className="text-blue-600" />
        <h3 className="text-[14px] font-medium text-slate-800">Отсъствия</h3>
        <span className="text-[11.5px] text-slate-400">по период — за терапевтите и учителите</span>
        <span className="flex-1" />
        {canMark && <AddStudentAbsence fixedStudentId={studentId} onSaved={load} compact label="Отрази отсъствие" />}
      </div>
      {!rows.length ? <p className="text-[12.5px] text-slate-400">Няма отразени отсъствия.</p> : (
        <div className="flex flex-wrap gap-2">
          {rows.map(r => {
            const R = REASONS[r.reason]
            const past = r.date_to < today, now = r.date_from <= today && !past
            return (
              <span key={r.id} title={r.note || ''} className={`inline-flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-xl border ${now ? 'border-blue-200 bg-blue-50/50' : past ? 'border-slate-100 text-slate-400' : 'border-dashed border-slate-200'}`}>
                {span(r.date_from, r.date_to)}
                <span className="text-[11.5px] px-1.5 py-0.5 rounded-md" style={{ background: R.bg, color: R.color }}>{R.short}</span>
                {now && <span className="text-[11px] text-blue-700">сега</span>}
                {canMark && <RemoveAbsence id={r.id} onDone={load} />}
              </span>
            )
          })}
        </div>
      )}
    </section>
  )
}
