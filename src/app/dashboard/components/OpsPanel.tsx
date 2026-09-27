import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UserX, ClipboardList, HeartPulse, ArrowRight } from 'lucide-react'
import { getFullName, getMonthName } from '@/lib/utils'
import NoDocsCount from './NoDocsCount'

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
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Sofia' }))
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const month = now.getMonth() + 1
  const isSummer = month >= 7 && month <= 10
  const reportMonth = month === 1 ? 12 : month - 1
  const reportYear = month === 1 ? now.getFullYear() - 1 : now.getFullYear()

  const [{ data: subs }, { data: assigns }, { count: waiting }, { data: cta }, { data: iup }, { data: enr }, { data: teams }, { data: newKids }] = await Promise.all([
    supabase.from('substitutions')
      .select('id, date_from, date_to, bsch_eligible, absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name), sub:staff_profiles!substitutions_substitute_staff_id_fkey(first_name, last_name)')
      .lte('date_from', today).gte('date_to', today),
    supabase.from('substitution_assignments')
      .select('substitution_id, sub:staff_profiles!substitution_assignments_substitute_staff_id_fkey(first_name, last_name)')
      .lte('date_from', today).gte('date_to', today),
    supabase.from('substitutions').select('*', { count: 'exact', head: true }).is('substitute_staff_id', null).gte('date_to', today),
    supabase.from('class_teacher_assignments')
      .select('class_id, class:classes(name), staff:staff_profiles(first_name, last_name)').eq('academic_year_id', currentYearId),
    isSummer ? Promise.resolve({ data: [] as any[] })
      : supabase.from('monthly_absences').select('class_id').eq('month', reportMonth).eq('year', reportYear),
    supabase.from('student_enrollments')
      .select('student:students!inner(id, first_name, middle_name, last_name, status)').eq('academic_year_id', currentYearId).eq('student.status', 'active'),
    supabase.from('eplr_teams').select('student_id').eq('academic_year_id', currentYearId),
    supabase.from('students').select('id').eq('is_new', true).eq('status', 'active'),
  ])

  // ДНЕС
  const extra: Record<string, string[]> = {}
  ;(assigns || []).forEach((a: any) => { (extra[a.substitution_id] = extra[a.substitution_id] || []).push(short(a.sub)) })
  const todayRows = (subs || []).map((s: any) => ({
    id: s.id, absent: short(s.absent), np: !!s.bsch_eligible,
    by: extra[s.id]?.length ? extra[s.id].join(', ') : short(s.sub),
  })).sort((a, b) => a.absent.localeCompare(b.absent, 'bg'))

  // РЕАЛИЗАЦИЯ НА ИУП — кои паралелки не са подали за миналия месец
  const done = new Set((iup || []).map((r: any) => r.class_id))
  const missingIup = isSummer ? [] : (cta || [])
    .filter((c: any) => !done.has(c.class_id))
    .map((c: any) => ({ cls: roman(c.class?.name || ''), who: short(c.staff), raw: c.class?.name || '' }))
    .sort((a: any, b: any) => a.raw.localeCompare(b.raw, 'bg', { numeric: true }))

  // ЕПЛР
  const students = (enr || []).map((e: any) => e.student).filter(Boolean)
  const withTeam = new Set((teams || []).map((t: any) => t.student_id))
  const noTeam = students.filter((s: any) => !withTeam.has(s.id)).length
  const newIds = (newKids || []).map((k: any) => k.id)
  const { data: doneSurveys } = newIds.length
    ? await supabase.from('student_surveys').select('student_id').in('student_id', newIds).eq('status', 'completed')
    : { data: [] as any[] }
  const noSurvey = newIds.length - new Set((doneSurveys || []).map((d: any) => d.student_id)).size
  const kids = students.map((s: any) => ({ id: s.id, name: getFullName(s) })).sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg'))

  const card = 'bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 flex flex-col'
  const head = 'flex items-center gap-2 mb-3'
  const more = 'mt-auto pt-3 text-[11px] text-slate-400 hover:text-[#0f2240] inline-flex items-center gap-1'

  return (
    <div className="grid gap-4 md:grid-cols-3 mb-6">
      {/* ДНЕС */}
      <div className={card}>
        <div className={head}>
          <UserX size={16} className="text-rose-500" />
          <h2 className="text-sm font-medium text-slate-800">Днес отсъстват</h2>
          <span className="ml-auto text-xs text-slate-400">{todayRows.length}</span>
        </div>
        {todayRows.length === 0 ? (
          <p className="text-sm text-slate-400 font-light">Няма отсъстващи.</p>
        ) : (
          <div className="space-y-1.5">
            {todayRows.slice(0, 8).map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-700 truncate">{r.absent}</span>
                <span className={`text-[11px] shrink-0 ${r.by ? 'text-slate-500' : 'text-amber-700'}`}>
                  {r.by ? `→ ${r.by}` : 'без заместник'}{r.np ? ' · НП' : ''}
                </span>
              </div>
            ))}
            {todayRows.length > 8 && <div className="text-[11px] text-slate-400">и още {todayRows.length - 8}…</div>}
          </div>
        )}
        {!!waiting && <div className="mt-2 text-xs text-amber-700">{waiting} замествания чакат заместник</div>}
        <Link href="/substitutions" className={more}>Замествания <ArrowRight size={11} /></Link>
      </div>

      {/* РЕАЛИЗАЦИЯ НА ИУП */}
      <div className={card}>
        <div className={head}>
          <ClipboardList size={16} className="text-amber-500" />
          <h2 className="text-sm font-medium text-slate-800">Реализация на ИУП</h2>
          {!isSummer && <span className="ml-auto text-xs text-slate-400">{getMonthName(reportMonth)}</span>}
        </div>
        {isSummer ? (
          <p className="text-sm text-slate-400 font-light">Лятна ваканция — не се подава.</p>
        ) : missingIup.length === 0 ? (
          <p className="text-sm text-emerald-700">✓ Всички паралелки са подали.</p>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-2">Не са подали: {missingIup.length} от {(cta || []).length}</p>
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
    </div>
  )
}
