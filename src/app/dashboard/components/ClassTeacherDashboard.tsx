import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, Calendar, Bell, CalendarClock, ChevronRight, ClipboardList, ShieldAlert, ShieldX } from 'lucide-react'
import { getFullName, getMonthName, formatDate } from '@/lib/utils'
import ClassTeacherTabs from './ClassTeacherTabs'
export default async function ClassTeacherDashboard({ profile, currentYearId }: any) {
  const supabase = await createClient()
  const now = new Date()
  const month = now.getMonth() + 1
  const isSummer = month === 7 || month === 8
  const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const { data: assignments } = await supabase
    .from('class_teacher_assignments')
    .select('class:classes(*)')
    .eq('staff_id', profile.id)
    .eq('academic_year_id', currentYearId)
  const myClasses = assignments?.map((a: any) => a.class).filter(Boolean) || []
  if (myClasses.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <Users className="mx-auto mb-3 text-slate-300" size={48} />
        <h3 className="text-lg font-medium text-slate-700">Няма назначена паралелка</h3>
        <p className="text-sm text-slate-400">Свържете се с администратора за достъп.</p>
      </div>
    )
  }
  const classIds = myClasses.map((c: any) => c.id)
  const [{ data: allEnrollments }, { data: iupSubmissions }, { data: announcements }, { data: deadlines }] = await Promise.all([
    supabase.from('student_enrollments')
      .select(`student_id, class_id, education_form,
        student:students(id, first_name, middle_name, last_name, status, external_class,
          therapist_psychologist_id, therapist_speech_id, therapist_rehab_id,
          sending_school:sending_schools(name),
          psy:staff_profiles!students_therapist_psychologist_id_fkey(first_name, last_name),
          spe:staff_profiles!students_therapist_speech_id_fkey(first_name, last_name),
          reh:staff_profiles!students_therapist_rehab_id_fkey(first_name, last_name))`)
      .in('class_id', classIds).eq('academic_year_id', currentYearId),
    supabase.from('monthly_absences').select('class_id').in('class_id', classIds).eq('month', reportMonth).eq('year', reportYear),
    supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('calendar_deadlines').select('*').eq('academic_year_id', currentYearId).gte('deadline_date', now.toISOString().split('T')[0]).order('deadline_date').limit(5),
  ])
  const activeEnrollments = (allEnrollments || []).filter((e: any) => e.student?.status === 'active')
  const submittedIds = new Set(iupSubmissions?.map((s: any) => s.class_id) || [])
  const studentIds = activeEnrollments.map((e: any) => e.student_id)

  // Родители (по едно име на дете) + ЦОУД записвания
  const [{ data: guardians }, { data: coudEnrolls }] = await Promise.all([
    studentIds.length > 0
      ? supabase.from('student_guardians').select('student_id, full_name, relation').in('student_id', studentIds)
      : Promise.resolve({ data: [] as any[] }),
    studentIds.length > 0
      ? supabase.from('coud_enrollments')
          .select('student_id, coud_group:coud_groups(name)')
          .in('student_id', studentIds).eq('academic_year_id', currentYearId)
      : Promise.resolve({ data: [] as any[] }),
  ])
  const guardianByStudent: Record<string, string> = {}
  ;(guardians || []).forEach((g: any) => {
    if (!guardianByStudent[g.student_id]) guardianByStudent[g.student_id] = g.full_name
  })
  const coudByStudent: Record<string, string> = {}
  ;(coudEnrolls || []).forEach((c: any) => {
    const nm = (c.coud_group as any)?.name
    if (nm) coudByStudent[c.student_id] = nm
  })

  // ЕПЛР екипите на моите деца
  const { data: eplrTeams } = studentIds.length > 0
    ? await supabase.from('eplr_teams')
        .select(`student_id,
          psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(id, first_name, last_name),
          speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(id, first_name, last_name),
          rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(id, first_name, last_name)`)
        .in('student_id', studentIds).eq('academic_year_id', currentYearId)
    : { data: [] }
  const eplrByStudent: Record<string, any> = {}
  ;(eplrTeams || []).forEach((e: any) => { eplrByStudent[e.student_id] = e })

  // ── Изтичащи / изтекли документи на моите деца ──
  const nameById: Record<string, string> = {}
  activeEnrollments.forEach((e: any) => { nameById[e.student_id] = getFullName(e.student) })
  const baseYear = new Date().getFullYear()
  const { data: myAttachments } = studentIds.length > 0
    ? await supabase.from('student_attachments')
        .select('student_id, valid_until_year')
        .in('student_id', studentIds)
    : { data: [] }
  const expiredSet = new Set<string>()
  const expiringSet = new Set<string>()
  ;(myAttachments || []).forEach((a: any) => {
    if (!a.valid_until_year) return
    const y = parseInt(a.valid_until_year.split('/')[0])
    if (y < baseYear) expiredSet.add(a.student_id)
    else if (y === baseYear) expiringSet.add(a.student_id)
  })
  const expiredNames = [...expiredSet].map(id => nameById[id]).filter(Boolean).sort((a, b) => a.localeCompare(b, 'bg'))
  const expiringNames = [...expiringSet].map(id => nameById[id]).filter(Boolean).sort((a, b) => a.localeCompare(b, 'bg'))
  const hasDocAlerts = expiredNames.length > 0 || expiringNames.length > 0

  // ── Терапии на моите деца ──
  const { data: therSlots } = studentIds.length > 0
    ? await supabase.from('therapist_slots')
        .select(`day, period, student_id,
          schedule:therapist_schedules!inner(term, academic_year_id,
            staff:staff_profiles(first_name, last_name, role))`)
        .in('student_id', studentIds)
        .eq('schedule.term', 1)
        .eq('schedule.academic_year_id', currentYearId)
    : { data: [] }
  const ROLE_BG: Record<string, string> = {
    psychologist: 'Психолог', speech_therapist: 'Логопед', rehabilitator: 'Рехабилитатор',
  }
  const PERIOD_TIME: Record<number, string> = {
    1: '8:30', 2: '9:15', 3: '10:20', 4: '11:05', 5: '11:50', 6: '12:35', 7: '13:15',
  }
  const studentNameById: Record<string, string> = {}
  activeEnrollments.forEach((e: any) => { studentNameById[e.student_id] = getFullName(e.student) })
  const therapyRows = (therSlots || []).map((slot: any) => {
    const st = slot.schedule?.staff
    return {
      studentId: slot.student_id,
      studentName: studentNameById[slot.student_id] || '',
      day: slot.day,
      period: slot.period,
      time: PERIOD_TIME[slot.period] || '',
      specialist: st ? `${st.first_name} ${st.last_name}` : '',
      role: ROLE_BG[st?.role] || '',
    }
  }).sort((a: any, b: any) =>
    a.day - b.day || a.period - b.period || a.studentName.localeCompare(b.studentName, 'bg')
  )

  // Данни за таб "Моята паралелка" — форма · ЦОУД · родител · училище
  const paralelkaRows = activeEnrollments.map((e: any) => {
    const s = e.student
    return {
      id: s.id,
      name: getFullName(s),
      className: myClasses.find((c: any) => c.id === e.class_id)?.name || '',
      educationForm: e.education_form || 'daily',
      coud: coudByStudent[e.student_id] || '',
      guardian: guardianByStudent[e.student_id] || '',
      sendingSchool: (s.sending_school as any)?.name || '',
    }
  }).sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg'))

  // Данни за таб "ЕПЛР"
  const eplrRows = activeEnrollments.map((e: any) => {
    const s = e.student
    const team = eplrByStudent[e.student_id]
    const members: { role: string; name: string; isReal: boolean }[] = []
    if (team?.psychologist) {
      members.push({
        role: 'психолог', name: `${team.psychologist.first_name} ${team.psychologist.last_name}`,
        isReal: s.therapist_psychologist_id === team.psychologist.id,
      })
    }
    if (team?.speech_therapist) {
      members.push({
        role: 'логопед', name: `${team.speech_therapist.first_name} ${team.speech_therapist.last_name}`,
        isReal: s.therapist_speech_id === team.speech_therapist.id,
      })
    }
    if (team?.rehabilitator) {
      members.push({
        role: 'рехаб.', name: `${team.rehabilitator.first_name} ${team.rehabilitator.last_name}`,
        isReal: s.therapist_rehab_id === team.rehabilitator.id,
      })
    }
    return {
      id: s.id,
      name: getFullName(s),
      className: myClasses.find((c: any) => c.id === e.class_id)?.name || '',
      members,
    }
  }).sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg'))
  return (
    <div className="animate-in fade-in duration-500">
      {/* Предупреждение за изтичащи/изтекли документи */}
      {hasDocAlerts && (
        <div className="mb-6 space-y-2">
          {expiredNames.length > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-red-200 bg-red-50/50">
              <ShieldX size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800">Изтекли документи в досието</div>
                <div className="text-xs text-slate-500 mt-0.5">{expiredNames.join(' · ')}</div>
              </div>
            </div>
          )}
          {expiringNames.length > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-amber-200 bg-amber-50/50">
              <ShieldAlert size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800">Изтичащи документи тази година</div>
                <div className="text-xs text-slate-500 mt-0.5">{expiringNames.join(' · ')}</div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Карти горе: разписание + ИУП */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Link href={`/classes/${myClasses[0].id}/schedule`}
          className="flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl border border-teal-200 bg-teal-50/50 hover:bg-teal-50 transition-colors group">
          <div className="flex items-center gap-2.5">
            <CalendarClock size={18} className="text-teal-600" />
            <div>
              <div className="text-sm font-semibold text-slate-800">Седмично разписание</div>
              <div className="text-xs text-slate-500">На паралелката</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-teal-400 group-hover:text-teal-600" />
        </Link>
        <Link href="/absences"
          className={`flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl border transition-colors group ${
            isSummer ? 'border-slate-200 bg-slate-50/50 hover:bg-slate-50' : 'border-amber-200 bg-amber-50/40 hover:bg-amber-50'
          }`}>
          <div className="flex items-center gap-2.5">
            <ClipboardList size={18} className={isSummer ? 'text-slate-400' : 'text-amber-600'} />
            <div>
              <div className="text-sm font-semibold text-slate-800">Реализация на ИУП</div>
              <div className="text-xs text-slate-500">
                {isSummer ? 'Лятна ваканция' : (
                  <>
                    {getMonthName(reportMonth)} · {myClasses.map((c: any) => submittedIds.has(c.id) ? '✓' : '—').join(' ')}
                  </>
                )}
              </div>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-600" />
        </Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
         <ClassTeacherTabs paralelkaRows={paralelkaRows} eplrRows={eplrRows} therapyRows={therapyRows} className={myClasses[0].name} classId={myClasses[0].id} />
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100/80">
              <Calendar size={18} className="text-slate-400" />
              <h2 className="font-semibold text-slate-800 text-sm">Предстоящи срокове</h2>
            </div>
            {!deadlines?.length ? (
              <p className="text-sm text-slate-400">Няма предстоящи срокове</p>
            ) : (
              <div className="space-y-3">
                {deadlines.map((d: any) => (
                  <div key={d.id} className="flex justify-between items-center gap-2">
                    <div className="text-sm font-medium text-slate-700 truncate">{d.title}</div>
                    <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded flex-shrink-0">{formatDate(d.deadline_date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {announcements && announcements.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100/80">
                <Bell size={18} className="text-indigo-400" />
                <h2 className="font-semibold text-slate-800 text-sm">Съобщения</h2>
              </div>
              <div className="space-y-4">
                {announcements.map((a: any) => (
                  <div key={a.id} className="relative pl-3 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-indigo-300 before:rounded-full">
                    <div className="text-sm font-semibold text-slate-700">{a.title}</div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-3">{a.body}</p>
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
