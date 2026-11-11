import { createAdminClient } from '@/lib/supabase/admin'
import { PERIOD_BY_N, byStartTime } from '@/lib/periods'
import { Clock3, UserRound } from 'lucide-react'

// „Деца в ИФО — днес“ — за помощник на учителя (роля support).
// Само преглед: кое ИФО дете какво има днес, при кого и кога; кой учител отсъства и кой го замества.
// Чете със service-role (на сървъра), защото помощниците нямат права по таблиците с разписанията —
// и показва само това, нищо от досието.

const ROLE_LABEL: Record<string, string> = { psychologist: 'Психолог', speech_therapist: 'Логопед', rehabilitator: 'Рехабилитатор' }
const nm = (p: any) => (p ? `${p.first_name} ${p.last_name}` : '')

type Row = { period: number; what: string; who: string; note: string }

export default async function IfoTodayCard({ currentYearId }: { currentYearId: string }) {
  const db = createAdminClient()
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Sofia' }))
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const dow = now.getDay()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const { data: calDay } = await db.from('academic_calendar_days').select('term, is_school_day').eq('date', todayIso).maybeSingle()
  const mo = now.getMonth() + 1
  const term = calDay?.term ?? (mo >= 2 && mo <= 8 ? 2 : 1)
  const schoolDay = calDay ? !!calDay.is_school_day : dow >= 1 && dow <= 5

  const shell = (body: React.ReactNode, count?: number) => (
    <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
        <Clock3 size={18} className="text-teal-600" />
        <span className="text-base font-medium text-[#0f2240]">Деца в ИФО — днес</span>
        {count != null && <span className="ml-auto text-xs text-slate-400">{count} {count === 1 ? 'дете' : 'деца'}</span>}
      </div>
      {body}
    </div>
  )

  if (!schoolDay || dow < 1 || dow > 5) return shell(<p className="px-5 py-6 text-sm text-slate-400">Днес не е учебен ден.</p>)

  // ИФО децата (активни) за годината
  const { data: enr } = await db.from('student_enrollments')
    .select('student_id, class:classes(name), student:students(id, first_name, last_name, status)')
    .eq('academic_year_id', currentYearId).eq('education_form', 'ifo')
  const kids = (enr || []).filter((e: any) => e.student?.status === 'active')
  const ids = kids.map((e: any) => e.student_id)
  if (ids.length === 0) return shell(<p className="px-5 py-6 text-sm text-slate-400">Няма деца в ИФО.</p>, 0)

  const [{ data: ifo }, { data: ther }, { data: absKids }, { data: subs }, { data: assigns }] = await Promise.all([
    db.from('teacher_ifo_slots')
      .select('student_id, period, teacher_id, subject:subjects(name), teacher:staff_profiles(first_name, last_name)')
      .in('student_id', ids).eq('academic_year_id', currentYearId).eq('term', term).eq('day', dow),
    db.from('therapist_slots')
      .select('student_id, period, schedule:therapist_schedules!inner(staff_id, term, academic_year_id, staff:staff_profiles(first_name, last_name, role, position))')
      .in('student_id', ids).eq('day', dow).eq('schedule.term', term).eq('schedule.academic_year_id', currentYearId),
    db.from('student_absences').select('student_id').in('student_id', ids).lte('date_from', todayIso).gte('date_to', todayIso),
    db.from('substitutions')
      .select('id, absent_staff_id, sub:staff_profiles!substitutions_substitute_staff_id_fkey(first_name, last_name)')
      .lte('date_from', todayIso).gte('date_to', todayIso),
    db.from('substitution_assignments')
      .select('substitution_id, sub:staff_profiles!substitution_assignments_substitute_staff_id_fkey(first_name, last_name)')
      .lte('date_from', todayIso).gte('date_to', todayIso),
  ])

  // кой отсъства днес → кой го замества („“ = никой не е посочен)
  const extra: Record<string, string[]> = {}
  ;(assigns || []).forEach((a: any) => { if (a.sub) (extra[a.substitution_id] ||= []).push(nm(a.sub)) })
  const absentStaff: Record<string, string> = {}
  ;(subs || []).forEach((s: any) => {
    absentStaff[s.absent_staff_id] = extra[s.id]?.length ? extra[s.id].join(', ') : nm(s.sub)
  })
  const absentKid = new Set((absKids || []).map((a: any) => a.student_id))

  const rows: Record<string, Row[]> = {}
  ;(ifo || []).forEach((s: any) => {
    const off = s.teacher_id in absentStaff
    const by = absentStaff[s.teacher_id]
    ;(rows[s.student_id] ||= []).push({
      period: s.period,
      what: s.subject?.name || 'Час',
      who: off && by ? by : nm(s.teacher),
      note: off ? (by ? `замества ${nm(s.teacher)}` : `${nm(s.teacher)} отсъства`) : '',
    })
  })
  ;(ther || []).forEach((t: any) => {
    const st = t.schedule?.staff
    const off = !!t.schedule?.staff_id && t.schedule.staff_id in absentStaff
    ;(rows[t.student_id] ||= []).push({
      period: t.period,
      what: st?.position || ROLE_LABEL[st?.role] || 'Терапия',
      who: nm(st),
      note: off ? 'отсъства — няма терапия' : '',
    })
  })

  const list = kids
    .map((e: any) => ({
      id: e.student_id,
      name: nm(e.student),
      cls: e.class?.name || '',
      absent: absentKid.has(e.student_id),
      rows: (rows[e.student_id] || []).sort((a, b) => byStartTime(a.period, b.period)),
    }))
    .filter(k => k.rows.length > 0)
    .sort((a, b) => (a.absent === b.absent ? a.name.localeCompare(b.name, 'bg') : a.absent ? 1 : -1))

  if (list.length === 0) return shell(<p className="px-5 py-6 text-sm text-slate-400">Днес няма ИФО часове.</p>, 0)

  return shell(
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {list.map(k => (
        <div key={k.id} className={`rounded-xl border px-4 py-3 ${k.absent ? 'border-slate-100 bg-slate-50/60' : 'border-slate-200/70 bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <UserRound size={15} className={k.absent ? 'text-slate-400' : 'text-teal-600'} />
            <span className={`font-medium ${k.absent ? 'text-slate-500' : 'text-[#0f2240]'}`}>{k.name}</span>
            {k.cls && <span className="text-xs text-slate-400">{k.cls}</span>}
            {k.absent && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">отсъства днес</span>}
          </div>
          {!k.absent && (
            <ul className="space-y-1">
              {k.rows.map((r, i) => {
                const p = PERIOD_BY_N[r.period]
                const nowHere = !!p && nowMin >= p.start && nowMin < p.end
                const past = !!p && nowMin >= p.end
                return (
                  <li key={i} className={`flex items-baseline gap-3 text-sm rounded-lg px-2 py-1 ${nowHere ? 'bg-teal-50 ring-1 ring-teal-200' : ''} ${past ? 'opacity-45' : ''}`}>
                    <span className="w-24 shrink-0 tabular-nums text-slate-500">{p?.time || r.period}</span>
                    <span className="min-w-0">
                      <span className="text-slate-700">{r.what}</span>
                      {r.who && <span className="text-slate-500"> · {r.who}</span>}
                      {r.note && <span className="block text-xs text-amber-700">{r.note}</span>}
                    </span>
                    {nowHere && <span className="ml-auto text-[11px] text-teal-700 shrink-0">сега</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ))}
    </div>,
    list.length,
  )
}
