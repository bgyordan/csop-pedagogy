import Link from 'next/link'
import { CalendarX2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { REASONS, todaySofia, addDays, span } from '@/lib/student-absences'
import AddStudentAbsence from '@/components/absences/AddStudentAbsence'
import RemoveAbsence from '@/components/absences/RemoveAbsence'

// „Отсъстващи деца“ — днес и следващите 7 дни: класният отразява (семейни / медицинска бележка),
// терапевтите и учителите на детето го виждат и си планират часовете. Базата показва само „моите“ деца.
export default async function StudentAbsentStrip({ profile, currentYearId }: { profile: any; currentYearId: string }) {
  const supabase = await createClient()
  const today = todaySofia(), horizon = addDays(today, 7)
  const { data: rows, error } = await supabase.from('student_absences')
    .select('id, student_id, date_from, date_to, reason, note, created_by, student:students(first_name, last_name, therapist_psychologist_id, therapist_speech_id, therapist_rehab_id, therapist_rehab2_id)')
    .gte('date_to', today).lte('date_from', horizon).order('date_from')
  if (error) return null

  // децата от моята паралелка — за „+ Отсъствие“
  const { data: cta } = await supabase.from('class_teacher_assignments').select('class_id').eq('staff_id', profile.id).eq('academic_year_id', currentYearId)
  const classIds = (cta || []).map((c: any) => c.class_id)
  let mine: { id: string; name: string }[] = []
  if (classIds.length) {
    const { data: enr } = await supabase.from('student_enrollments').select('student:students(id, first_name, last_name, status)').in('class_id', classIds).eq('academic_year_id', currentYearId)
    mine = (enr || []).map((e: any) => e.student).filter((s: any) => s && s.status === 'active')
      .map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` })).sort((a, b) => a.name.localeCompare(b.name, 'bg'))
  }
  const mineIds = new Set(mine.map(s => s.id))
  const isManager = ['admin', 'zdud', 'director'].includes(profile.role)
  if (!(rows || []).length && !mine.length) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm px-5 py-3.5">
      <div className="flex items-center gap-2 mb-2">
        <CalendarX2 size={15} className="text-blue-600" />
        <h2 className="text-sm font-medium text-slate-800">Отсъстващи деца</h2>
        <span className="text-xs text-slate-400">днес и следващите 7 дни</span>
        <span className="flex-1" />
        {mine.length > 0 && <AddStudentAbsence students={mine} />}
      </div>
      {!(rows || []).length ? <p className="text-[12.5px] text-slate-400">Няма отразени отсъствия. Ако дете от паралелката ви ще отсъства (семейни причини, медицинска бележка) — отразете го, за да знаят терапевтите.</p> : (
        <div className="flex flex-wrap gap-2">
          {(rows || []).map((r: any) => {
            const s = r.student || {}
            const now = r.date_from <= today
            const therapy = [s.therapist_psychologist_id, s.therapist_speech_id, s.therapist_rehab_id, s.therapist_rehab2_id].includes(profile.id)
            const R = REASONS[r.reason as keyof typeof REASONS]
            return (
              <div key={r.id} className={`inline-flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-xl border ${now ? 'bg-slate-50 border-slate-200' : 'bg-white border-dashed border-slate-200'}`} title={r.note || ''}>
                <Link href={`/students/${r.student_id}`} className="text-slate-800 hover:underline">{s.first_name} {s.last_name}</Link>
                <span className="text-[11.5px] px-1.5 py-0.5 rounded-md" style={{ background: R.bg, color: R.color }}>{R.short}</span>
                <span className="text-slate-500 text-[12px]">{now ? `до ${span(r.date_to, r.date_to)}` : span(r.date_from, r.date_to)}</span>
                {therapy && <span className="text-[11px] text-emerald-700">· терапия</span>}
                {(mineIds.has(r.student_id) || r.created_by === profile.id || isManager) && <RemoveAbsence id={r.id} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
