import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CalendarClock, HeartPulse } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import { DocumentType } from '@/types'
import SharedFiles from './SharedFiles'
import SpecialistTabs from './SpecialistTabs'
import ClassTeacherSide from './ClassTeacherSide'
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
// "01" → "I"; нечислови имена остават
function roman(name: string) {
  const m = (name || '').trim().match(/^0*(\d+)$/)
  if (!m) return name || ''
  let n = parseInt(m[1]), r = ''
  for (const [v, t] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']] as [number, string][]) while (n >= v) { r += t; n -= v }
  return r
}
const DAY_NAMES = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота']
const PERIOD_START: Record<number, string> = {
  1: '8:30', 2: '9:15', 0: '9:50', 3: '10:20', 4: '11:05', 5: '11:50', 6: '12:35', 7: '13:15', 8: '13:50',
}
const PERIOD_ORDER = [1, 2, 0, 3, 4, 5, 6, 7, 8]

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
  ;(enrollments || []).forEach((e: any) => { classByStudent[e.student_id] = roman(e.class?.name || '') })
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
  // ── ДНЕС: часовете от седмичния ми график за днешния ден ──
  const nowBg = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Sofia' }))
  const todayIso = `${nowBg.getFullYear()}-${String(nowBg.getMonth() + 1).padStart(2, '0')}-${String(nowBg.getDate()).padStart(2, '0')}`
  const dow = nowBg.getDay()
  const { data: calDay } = await supabase.from('academic_calendar_days')
    .select('term, is_school_day').eq('date', todayIso).maybeSingle()
  const mo = nowBg.getMonth() + 1
  const term = calDay?.term ?? (mo >= 2 && mo <= 8 ? 2 : 1)
  const schoolDay = calDay ? !!calDay.is_school_day : dow >= 1 && dow <= 5
  const { data: todaySlots } = schoolDay && dow >= 1 && dow <= 5
    ? await supabase.from('therapist_slots')
        .select('period, student_id, schedule:therapist_schedules!inner(staff_id, term, academic_year_id)')
        .eq('day', dow)
        .eq('schedule.staff_id', profile.id).eq('schedule.term', term).eq('schedule.academic_year_id', currentYearId)
    : { data: [] as any[] }
  const nameOf: Record<string, any> = {}
  ;(allActive || []).forEach((st: any) => { nameOf[st.id] = st })
  const byPeriod: Record<number, string[]> = {}
  ;(todaySlots || []).forEach((sl: any) => {
    const st = nameOf[sl.student_id]
    if (!st) return
    const cls = classByStudent[sl.student_id]
    ;(byPeriod[sl.period] = byPeriod[sl.period] || []).push(`${st.first_name} ${st.last_name.charAt(0)}.${cls ? ` (${cls})` : ''}`)
  })
  const today = PERIOD_ORDER.filter(p => byPeriod[p]?.length).map(p => ({ time: PERIOD_START[p], kids: byPeriod[p] }))

  return (
    <div className="animate-in fade-in duration-300">
      {/* Лента „Днес“: часовете ми за деня + бутоните към списъка и графика */}
      <div className="flex flex-wrap items-center gap-3 mb-6 px-5 py-3.5 rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex items-center gap-2 shrink-0">
          <CalendarClock size={18} className="text-teal-600" />
          <span className="text-base font-medium text-[#0f2240]">Днес</span>
          <span className="text-sm text-slate-400 font-light">· {DAY_NAMES[dow]}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {!schoolDay || dow === 0 || dow === 6 ? (
            <span className="text-sm text-slate-400 font-light">неучебен ден</span>
          ) : today.length === 0 ? (
            <span className="text-sm text-slate-400 font-light">няма часове в графика за днес</span>
          ) : today.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50/60 border border-teal-100 text-xs text-slate-700">
              <span className="font-medium text-teal-700">{t.time}</span>
              {t.kids.join(', ')}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Link href="/my-activities"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 hover:shadow-sm transition">
            <HeartPulse size={14} className="text-teal-600" /> Списък за терапия
          </Link>
          <Link href="/my-activities/schedule"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 hover:shadow-sm transition">
            <CalendarClock size={14} className="text-teal-600" /> Седмичен график
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SpecialistTabs therapyRows={therapyRows} eplrRows={eplrRows} />
        </div>
        <div>
          <ClassTeacherSide
            deadlines={deadlines || []}
            announcements={announcements || []}
            files={<SharedFiles bare />}
          />
        </div>
      </div>
    </div>
  )
}
