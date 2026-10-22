import Link from 'next/link'
import { iupPeriod } from '@/lib/iup-period'
import { createClient } from '@/lib/supabase/server'
import { UserX, ClipboardList, HeartPulse, ArrowRight, CalendarClock } from 'lucide-react'
import { getFullName, getMonthName } from '@/lib/utils'
import NoDocsCount from './NoDocsCount'
import { getTodayAbsences, countWaiting, getReturningSoon, sofiaToday } from '@/lib/today-absences'
import AbsentNote from './AbsentNote'

// "01" → "I"
function roman(name: string) {
  const m = (name || '').trim().match(/^0*(\d+)$/)
  if (!m) return name || ''
  let n = parseInt(m[1]), r = ''
  for (const [v, t] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']] as [number, string][]) while (n >= v) { r += t; n -= v }
  return r
}
const short = (p: any) => (p ? `${p.first_name} ${p.last_name}` : '')

// Оперативен панел за управата: ДНЕС (отсъстващи/заместници) · реализация на ИУП · ЕПЛР и документи
export default async function OpsPanel({ currentYearId }: { currentYearId: string }) {
  const supabase = await createClient()
  // едно правило за периода (lib/iup-period)
  const P = iupPeriod()
  const isSummer = P.offSeason
  const reportMonth = P.month
  const reportYear = P.year

  const [allToday, waiting, returning, { data: cta }, { data: iup }, { data: enr }, { data: teams }, { data: newKids }] = await Promise.all([
    getTodayAbsences(supabase, { all: true }),   // всички отсъстващи днес — за картата и листчето
    countWaiting(supabase),
    getReturningSoon(supabase),
    supabase.from('class_teacher_assignments')
      .select('class_id, class:classes(name), staff:staff_profiles(first_name, last_name)').eq('academic_year_id', currentYearId),
    isSummer ? Promise.resolve({ data: [] as any[] })
      : supabase.from('monthly_absences').select('class_id').eq('month', reportMonth).eq('year', reportYear),
    supabase.from('student_enrollments')
      .select('class:classes(outreach_location, eplr_class_teacher_only), student:students!inner(id, first_name, middle_name, last_name, status)').eq('academic_year_id', currentYearId).eq('student.status', 'active'),
    supabase.from('eplr_teams').select('student_id').eq('academic_year_id', currentYearId),
    supabase.from('students').select('id').eq('is_new', true).eq('status', 'active'),
  ])

  // РЕАЛИЗАЦИЯ НА ИУП — кои паралелки не са подали за миналия месец
  const done = new Set((iup || []).map((r: any) => r.class_id))
  const missingIup = isSummer ? [] : (cta || [])
    .filter((c: any) => !done.has(c.class_id))
    .map((c: any) => ({ cls: roman(c.class?.name || ''), who: short(c.staff), raw: c.class?.name || '' }))
    .sort((a: any, b: any) => a.raw.localeCompare(b.raw, 'bg', { numeric: true }))

  // ЕПЛР
  // паралелките „ЕПЛР само класен“ не се броят в „Деца без ЕПЛР екип“
  const students = (enr || []).filter((e: any) => !e.class?.eplr_class_teacher_only).map((e: any) => e.student).filter(Boolean)
  const withTeam = new Set((teams || []).map((t: any) => t.student_id))
  const noTeam = students.filter((s: any) => !withTeam.has(s.id)).length
  const newIds = (newKids || []).map((k: any) => k.id)
  const { data: doneSurveys } = newIds.length
    ? await supabase.from('student_surveys').select('student_id').in('student_id', newIds).eq('status', 'completed')
    : { data: [] as any[] }
  const noSurvey = newIds.length - new Set((doneSurveys || []).map((d: any) => d.student_id)).size
  // изнесените групи (Виница/Тополи) са на специален режим — не ги броим в „Ученици без документи“
  const kids = (enr || []).filter((e: any) => e.student && !e.class?.outreach_location).map((e: any) => e.student)
    .map((s: any) => ({ id: s.id, name: getFullName(s) })).sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg'))

  const card = 'bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 flex flex-col'
  const head = 'flex items-center gap-2 mb-3'
  const more = 'mt-auto pt-3 text-[11px] text-slate-400 hover:text-[#0f2240] inline-flex items-center gap-1'

  // РАЗПИСАНИЯ — кой още не е въвел своето за текущия срок
  const { data: calDay } = await supabase.from('academic_calendar_days').select('term').eq('date', new Date().toISOString().slice(0, 10)).maybeSingle()
  const mo = new Date().getMonth() + 1
  const term = calDay?.term ?? (mo >= 2 && mo <= 8 ? 2 : 1)
  const [{ data: staffAll }, { data: scheds }, { data: ifoT }, { data: therT }, { data: outreachCta }] = await Promise.all([
    supabase.from('staff_profiles').select('id, first_name, last_name, role, is_active')
      .in('role', ['class_teacher', 'teacher', 'psychologist', 'speech_therapist', 'rehabilitator']),
    supabase.from('class_schedules').select('id').eq('academic_year_id', currentYearId).eq('term', term),
    supabase.from('teacher_ifo_slots').select('teacher_id').eq('academic_year_id', currentYearId).eq('term', term),
    supabase.from('therapist_slots').select('schedule:therapist_schedules!inner(staff_id, term, academic_year_id)')
      .eq('schedule.term', term).eq('schedule.academic_year_id', currentYearId),
    // класни на изнесени паралелки — специален режим, не ги броим в „Учители без разписание“
    supabase.from('class_teacher_assignments').select('staff_id, class:classes!inner(outreach_location)')
      .eq('academic_year_id', currentYearId).not('class.outreach_location', 'is', null),
  ])
  const outreachTeachers = new Set((outreachCta || []).filter((x: any) => x.class?.outreach_location).map((x: any) => x.staff_id))
  const schedIds = (scheds || []).map((x: any) => x.id)
  const { data: classT } = schedIds.length
    ? await supabase.from('schedule_slots').select('staff_id').in('schedule_id', schedIds)
    : { data: [] as any[] }
  const hasTeach = new Set([...(classT || []).map((x: any) => x.staff_id), ...(ifoT || []).map((x: any) => x.teacher_id)])
  const hasTher = new Set((therT || []).map((x: any) => x.schedule?.staff_id))
  const active = (staffAll || []).filter((p: any) => p.is_active !== false)
  const noTeach = active.filter((p: any) => ['class_teacher', 'teacher'].includes(p.role) && !hasTeach.has(p.id) && !outreachTeachers.has(p.id))
    .map((p: any) => `${p.first_name} ${p.last_name}`).sort((a: string, b: string) => a.localeCompare(b, 'bg'))
  const noTher = active.filter((p: any) => ['psychologist', 'speech_therapist', 'rehabilitator'].includes(p.role) && !hasTher.has(p.id))
    .map((p: any) => `${p.first_name} ${p.last_name}`).sort((a: string, b: string) => a.localeCompare(b, 'bg'))
  const missingRow = (label: string, names: string[], href: string) => names.length === 0 ? (
    <Link href={href} className="flex items-center justify-between gap-2 text-sm text-slate-700 hover:text-[#0f2240]">
      <span>{label}</span><span className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">✓</span>
    </Link>
  ) : (
    <details className="group">
      <summary className="flex items-center justify-between gap-2 text-sm text-slate-700 cursor-pointer list-none">
        <span>{label}</span><span className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700">{names.length}</span>
      </summary>
      <div className="mt-2 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
        {names.map(n => <span key={n} className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[11px] text-slate-600">{n}</span>)}
      </div>
    </details>
  )

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-start mb-6">
      {/* ДНЕС */}
      <div className={card}>
        <div className={head}>
          <UserX size={16} className="text-rose-500" />
          <h2 className="text-sm font-medium text-slate-800">Днес отсъстват</h2>
          <span className="ml-auto text-xs text-slate-400">{allToday.length}</span>
          {allToday.length > 0 && <AbsentNote rows={allToday} today={sofiaToday()} compact />}
        </div>
        {allToday.length === 0 ? (
          <p className="text-sm text-slate-400 font-light">Няма отсъстващи.</p>
        ) : (() => {
          // три групи: заместени · чакат заместник (учители без заместник) · не се заместват (помощници, специалисти…)
          const subbed = allToday.filter(r => r.by)
          const waitingRows = allToday.filter(r => !r.by && r.substitutable)
          const away = allToday.filter(r => !r.by && !r.substitutable)
          const sn = (n: string) => { const [f, l] = n.trim().split(/\s+/); return l ? `${f} ${l[0]}.` : f }
          const until = (iso: string) => iso.split('-').reverse().slice(0, 2).join('.')
          const Group = ({ label, tone, children }: { label: string; tone: string; children: React.ReactNode }) => (
            <div>
              <div className={`text-[10.5px] uppercase tracking-wider mb-1 ${tone}`}>{label}</div>
              <div className="space-y-1">{children}</div>
            </div>
          )
          const Row = ({ name, right, sub }: { name: string; right: string; sub?: React.ReactNode }) => (
            <div className="flex items-baseline gap-2 text-[13px] leading-snug">
              <span className="text-slate-800 truncate">{name}</span>
              {sub}
              <span className="ml-auto text-[11px] text-slate-400 tabular-nums shrink-0">до {right}</span>
            </div>
          )
          return (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {waitingRows.length > 0 && (
                <Group label="Чакат заместник" tone="text-amber-700">
                  {waitingRows.map(r => <Row key={r.id} name={sn(r.absent)} right={until(r.to)} sub={r.np ? <span className="text-[10.5px] px-1 rounded bg-emerald-50 text-emerald-700">НП</span> : null} />)}
                </Group>
              )}
              {subbed.length > 0 && (
                <Group label="Заместват ги" tone="text-emerald-700">
                  {subbed.map(r => <Row key={r.id} name={sn(r.absent)} right={until(r.to)}
                    sub={<span className="text-[12px] text-emerald-700 truncate">← {r.by.split(', ').map(sn).join(', ')}{r.np ? ' · НП' : ''}</span>} />)}
                </Group>
              )}
              {away.length > 0 && (
                <Group label="Отсъстват" tone="text-slate-400">
                  {away.map(r => <Row key={r.id} name={sn(r.absent)} right={until(r.to)}
                    sub={r.position ? <span className="text-[11.5px] text-slate-400 truncate">{r.position.toLowerCase()}</span> : null} />)}
                </Group>
              )}
            </div>
          )
        })()}
        {!!waiting && <div className="mt-2 text-xs text-amber-700">{waiting} замествания чакат заместник</div>}
        {returning.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
            {returning.map(p => (
              <Link key={p.id} href="/admin/staff" className="flex items-center justify-between gap-2 text-xs hover:text-[#0f2240]">
                <span className="text-slate-700 truncate">Връща се: {p.name}</span>
                <span className={`shrink-0 ${p.overdue ? 'text-rose-600' : 'text-sky-700'}`}>
                  {p.until.split('-').reverse().slice(0, 2).join('.')}{p.overdue ? ' · активирай' : ''}
                </span>
              </Link>
            ))}
          </div>
        )}
        <Link href="/substitutions" className={more}>Замествания <ArrowRight size={11} /></Link>
      </div>

      {/* РЕАЛИЗАЦИЯ НА ИУП */}
      <div className={card}>
        <div className={head}>
          <ClipboardList size={16} className="text-amber-500" />
          <h2 className="text-sm font-medium text-slate-800">Реализация на ИУП</h2>
          {!isSummer && <span className="ml-auto text-xs text-slate-400">{P.label} · {P.overdue ? 'срокът изтече' : `до ${P.window.split('– ')[1]}`}</span>}
        </div>
        {isSummer ? (
          <p className="text-sm text-slate-400 font-light">Сега няма отчет. Първият е за {P.label}: {P.window}.</p>
        ) : missingIup.length === 0 ? (
          <p className="text-sm text-emerald-700">✓ Всички паралелки са подали.</p>
        ) : (
          <>
            <p className={`text-xs mb-2 ${P.overdue ? 'text-rose-600' : 'text-slate-500'}`}>{P.overdue ? 'Просрочени' : 'Не са подали'}: {missingIup.length} от {(cta || []).length}</p>
            <div className="space-y-1">
              {missingIup.slice(0, 8).map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-9 text-xs text-slate-400">{m.cls}</span>
                  <span className="text-slate-700 truncate">{m.who}</span>
                </div>
              ))}
              {missingIup.length > 8 && <div className="text-[11px] text-slate-400">и още {missingIup.length - 8}…</div>}
            </div>
          </>
        )}
        <Link href="/absences" className={more}>Реализация на ИУП <ArrowRight size={11} /></Link>
      </div>

      {/* ЕПЛР И ДОКУМЕНТИ */}
      <div className={card}>
        <div className={head}>
          <HeartPulse size={16} className="text-teal-500" />
          <h2 className="text-sm font-medium text-slate-800">ЕПЛР и документи</h2>
        </div>
        <div className="space-y-2.5">
          <Link href="/admin/eplr-assignment" className="flex items-center justify-between gap-2 text-sm text-slate-700 hover:text-[#0f2240]">
            <span>Деца без ЕПЛР екип</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${noTeam ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{noTeam || '✓'}</span>
          </Link>
          <Link href="/surveys" className="flex items-center justify-between gap-2 text-sm text-slate-700 hover:text-[#0f2240]">
            <span>Нови деца без завършена анкета</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${noSurvey ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{noSurvey || '✓'}</span>
          </Link>
          <NoDocsCount students={kids} />
        </div>
      </div>
      {/* РАЗПИСАНИЯ */}
      <div className={card}>
        <div className={head}>
          <CalendarClock size={16} className="text-sky-500" />
          <h2 className="text-sm font-medium text-slate-800">Разписания</h2>
          <span className="ml-auto text-xs text-slate-400">{term === 2 ? 'II' : 'I'} срок</span>
        </div>
        <div className="space-y-2.5">
          {missingRow('Учители без разписание', noTeach, '/schedules')}
          {missingRow('Специалисти без график', noTher, '/admin/therapists')}
        </div>
        <Link href="/schedules" className={more}>Разписания <ArrowRight size={11} /></Link>
      </div>
    </div>
  )
}
