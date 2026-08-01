import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Calendar, Bell, CalendarClock, ChevronRight, HeartPulse } from 'lucide-react'
import { getFullName, formatDate, getDaysUntil } from '@/lib/utils'
import { DocumentType } from '@/types'
import SpecialistTabs from './SpecialistTabs'
const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]
const ROLE_STUDENT_FIELD: Record<string, string> = {
  psychologist: 'therapist_psychologist_id',
  speech_therapist: 'therapist_speech_id',
  rehabilitator: 'therapist_rehab_id',
}
const ROLE_EPLR_FIELD: Record<string, string> = {
  psychologist: 'psychologist_id',
  speech_therapist: 'speech_therapist_id',
  rehabilitator: 'rehabilitator_id',
}
export default async function SpecialistDashboard({ profile, currentYearId }: any) {
  const supabase = await createClient()
  const studentField = ROLE_STUDENT_FIELD[profile.role]
  const eplrField = ROLE_EPLR_FIELD[profile.role]
  // ── ТАБ 1: реалните ми терапевтични деца ──
  const { data: allActive } = await supabase
    .from('students')
    .select(`id, first_name, middle_name, last_name, intensity, external_class,
      therapist_psychologist_id, therapist_speech_id, therapist_rehab_id,
      sending_school:sending_schools(name),
      psy:staff_profiles!students_therapist_psychologist_id_fkey(first_name, last_name),
      spe:staff_profiles!students_therapist_speech_id_fkey(first_name, last_name),
      reh:staff_profiles!students_therapist_rehab_id_fkey(first_name, last_name)`)
    .eq('status', 'active')
  const myTherapyStudents = studentField
    ? (allActive || []).filter((s: any) => s[studentField] === profile.id)
    : []
  const activeIds = (allActive || []).map((s: any) => s.id)
  const { data: enrollments } = activeIds.length > 0
    ? await supabase.from('student_enrollments')
        .select('student_id, class:classes(name)')
        .eq('academic_year_id', currentYearId)
        .in('student_id', activeIds)
    : { data: [] }
  const classByStudent: Record<string, string> = {}
  ;(enrollments || []).forEach((e: any) => { classByStudent[e.student_id] = e.class?.name || '' })
  // ── ТАБ 2: моят ЕПЛР състав ──
  const { data: eplrTeams } = eplrField
    ? await supabase.from('eplr_teams')
        .select(`student_id,
          student:students(id, first_name, middle_name, last_name, therapist_psychologist_id, therapist_speech_id, therapist_rehab_id),
          class_teacher:staff_profiles!eplr_teams_class_teacher_id_fkey(first_name, last_name)`)
        .eq(eplrField, profile.id)
        .eq('academic_year_id', currentYearId)
    : { data: [] }
  const eplrStudentIds = (eplrTeams || []).map((e: any) => e.student_id)
  const { data: documents } = eplrStudentIds.length > 0
    ? await supabase.from('documents').select('student_id, doc_type, status')
        .eq('academic_year_id', currentYearId).in('student_id', eplrStudentIds)
    : { data: [] }
  const docCount: Record<string, number> = {}
  ;(documents || []).forEach((d: any) => {
    if (d.status === 'completed') docCount[d.student_id] = (docCount[d.student_id] || 0) + 1
  })
  // Строим данните за табовете
  const therapyRows = myTherapyStudents.map((s: any) => {
    const others: string[] = []
    if (profile.role !== 'psychologist' && s.psy) others.push(`психолог ${s.psy.first_name} ${s.psy.last_name}`)
    if (profile.role !== 'speech_therapist' && s.spe) others.push(`логопед ${s.spe.first_name} ${s.spe.last_name}`)
    if (profile.role !== 'rehabilitator' && s.reh) others.push(`рехаб. ${s.reh.first_name} ${s.reh.last_name}`)
    return {
      id: s.id,
      name: getFullName(s),
      className: classByStudent[s.id] || '',
      intensity: s.intensity || '',
      sendingSchool: (s.sending_school as any)?.name || '',
      others,
    }
  }).sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg'))
  const studentField2 = studentField
  const eplrRows = (eplrTeams || []).map((e: any) => {
    const st = e.student as any
    const isReal = st && studentField2 && st[studentField2] === profile.id
    return {
      id: e.student_id,
      name: st ? getFullName(st) : '—',
      className: classByStudent[e.student_id] || '',
      classTeacher: e.class_teacher ? `${e.class_teacher.first_name} ${e.class_teacher.last_name}` : '',
      docsCompleted: docCount[e.student_id] || 0,
      docsTotal: ALL_DOC_TYPES.length,
      isReal,
    }
  }).sort((a: any, b: any) => {
    if (a.isReal !== b.isReal) return a.isReal ? -1 : 1
    return a.name.localeCompare(b.name, 'bg')
  })
  const [{ data: announcements }, { data: deadlines }] = await Promise.all([
    supabase.from('announcements').select('*').eq('is_active', true)
      .order('created_at', { ascending: false }).limit(3),
    supabase.from('calendar_deadlines').select('*').eq('academic_year_id', currentYearId)
      .gte('deadline_date', new Date().toISOString().split('T')[0])
      .order('deadline_date').limit(5),
  ])
  return (
    <div className="animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Link href="/my-activities"
          className="flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl border border-teal-200 bg-teal-50/50 hover:bg-teal-50 transition-colors group">
          <div className="flex items-center gap-2.5">
            <HeartPulse size={18} className="text-teal-600" />
            <div>
              <div className="text-sm font-semibold text-slate-800">Списък за терапия</div>
              <div className="text-xs text-slate-500">Зачисли и управлявай децата</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-teal-400 group-hover:text-teal-600" />
        </Link>
        <Link href="/my-activities/schedule"
          className="flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl border border-teal-200 bg-teal-50/50 hover:bg-teal-50 transition-colors group">
          <div className="flex items-center gap-2.5">
            <CalendarClock size={18} className="text-teal-600" />
            <div>
              <div className="text-sm font-semibold text-slate-800">Седмичен график</div>
              <div className="text-xs text-slate-500">Създай и изтегли график</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-teal-400 group-hover:text-teal-600" />
        </Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SpecialistTabs therapyRows={therapyRows} eplrRows={eplrRows} />
        </div>
        <div className="space-y-6">
          {deadlines && deadlines.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100/80">
                <Calendar size={18} className="text-slate-400" />
                <h2 className="font-semibold text-slate-800 text-sm">Предстоящи срокове</h2>
              </div>
              <div className="space-y-3">
                {deadlines.map((d: any) => {
                  const days = getDaysUntil(d.deadline_date)
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-700 truncate">{d.title}</div>
                        <div className="text-xs text-slate-400 font-medium">{formatDate(d.deadline_date)}</div>
                      </div>
                      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-1 rounded-md border ${
                        days === 0 ? 'bg-rose-50 text-rose-700 border-rose-100' :
                        days <= 7 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        {days === 0 ? 'Днес!' : `${days} дни`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {announcements && announcements.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100/80">
                <Bell size={18} className="text-indigo-400" />
                <h2 className="font-semibold text-slate-800 text-sm">Съобщения</h2>
              </div>
              <div className="space-y-4">
                {announcements.map((ann: any) => (
                  <div key={ann.id} className="relative pl-3 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-indigo-300 before:rounded-full">
                    <div className="text-sm font-semibold text-slate-700">{ann.title}</div>
                    <div className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-3">{ann.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
