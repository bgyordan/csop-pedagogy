import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarClock, BookOpen, GraduationCap, HeartPulse, Home, ArrowRight, Check } from 'lucide-react'
import { getFullName } from '@/lib/utils'
export const dynamic = 'force-dynamic'

const TABS = [
  { id: 'classes', label: 'Паралелки', icon: BookOpen },
  { id: 'teachers', label: 'Класни/учители', icon: GraduationCap },
  { id: 'therapists', label: 'Терапевти', icon: HeartPulse },
  { id: 'ifo', label: 'Ученици ИФО', icon: Home },
]

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const tab = TABS.some(t => t.id === params.tab) ? params.tab! : 'classes'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!profile || !['admin', 'zdud', 'director'].includes(profile.role)) redirect('/dashboard')
  const { data: currentYear } = await supabase
    .from('academic_years').select('id, name').eq('is_current', true).single()

  // ── Паралелки ──
  let classes: any[] = []
  if (tab === 'classes') {
    const { data: cls } = await supabase
      .from('classes').select('id, name').eq('academic_year_id', currentYear?.id).order('name')
    const { data: enr } = await supabase
      .from('student_enrollments').select('class_id, student:students(status)')
      .eq('academic_year_id', currentYear?.id)
    const { data: cta } = await supabase
      .from('class_teacher_assignments')
      .select('class_id, staff:staff_profiles(first_name, last_name, is_active)')
      .eq('academic_year_id', currentYear?.id)
    const countByClass = new Map<string, number>()
    ;(enr || []).forEach((e: any) => { if (e.student?.status === 'active') countByClass.set(e.class_id, (countByClass.get(e.class_id) || 0) + 1) })
    const teachersByClass = new Map<string, string[]>()
    ;(cta || []).forEach((a: any) => {
      if (!teachersByClass.has(a.class_id)) teachersByClass.set(a.class_id, [])
      if (a.staff && a.staff.is_active !== false) teachersByClass.get(a.class_id)!.push(getFullName(a.staff))
    })
    classes = (cls || []).map(c => ({
      id: c.id, name: c.name, count: countByClass.get(c.id) || 0, teachers: teachersByClass.get(c.id) || [],
    }))
  }

  // ── Ученици ИФО ──
  let ifoStudents: any[] = []
  if (tab === 'ifo') {
    const { data: ifoEnr } = await supabase
      .from('student_enrollments')
      .select('student_id, class:classes(name), student:students(id, first_name, middle_name, last_name, status)')
      .eq('academic_year_id', currentYear?.id).eq('education_form', 'ifo')
    const activeIfo = (ifoEnr || []).filter((e: any) => e.student?.status === 'active')
    const ids = activeIfo.map((e: any) => e.student_id)
    // Часовете + учителите на всяко ИФО дете (I срок за брой; учители — уникални)
    const { data: slots } = ids.length > 0
      ? await supabase.from('teacher_ifo_slots')
          .select('student_id, term, teacher:staff_profiles(first_name, last_name)')
          .in('student_id', ids).eq('academic_year_id', currentYear?.id)
      : { data: [] }
    const bySt: Record<string, { count1: number; count2: number; teachers: Set<string> }> = {}
    ;(slots || []).forEach((s: any) => {
      if (!bySt[s.student_id]) bySt[s.student_id] = { count1: 0, count2: 0, teachers: new Set() }
      if (s.term === 1) bySt[s.student_id].count1++
      else bySt[s.student_id].count2++
      if (s.teacher) bySt[s.student_id].teachers.add(`${s.teacher.first_name} ${s.teacher.last_name}`)
    })
    ifoStudents = activeIfo.map((e: any) => {
      const info = bySt[e.student_id] || { count1: 0, count2: 0, teachers: new Set() }
      return {
        id: e.student_id,
        name: getFullName(e.student),
        className: e.class?.name || '',
        count1: info.count1,
        teachers: [...info.teachers],
      }
    }).sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg'))
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}>
          <CalendarClock size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Разписания</h1>
          <p className="text-slate-500 text-sm mt-0.5">{currentYear?.name}</p>
        </div>
      </div>

      {/* Табове */}
      <div className="flex flex-wrap gap-1 p-1 bg-white border border-slate-200 rounded-xl mb-6 w-fit">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <Link key={t.id} href={`/schedules?tab=${t.id}`}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                active ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              style={active ? { backgroundColor: '#0f2240' } : {}}>
              <Icon size={15} /> {t.label}
            </Link>
          )
        })}
      </div>

      {/* ── Паралелки ── */}
      {tab === 'classes' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left [&>th]:px-4 [&>th]:py-2.5 [&>th]:font-semibold [&>th]:text-slate-500 [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-wider">
                <th>Паралелка</th><th>Класен ръководител</th><th className="text-center">Ученици</th><th className="text-right">Разписание</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-b [&>tr]:border-slate-100 [&>tr:last-child]:border-0 [&>tr>td]:border-r [&>tr>td]:border-slate-100 [&>tr>td:last-child]:border-0">
              {classes.map((c, i) => (
                <tr key={c.id} className={`hover:bg-blue-50/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{c.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.teachers.length > 0 ? c.teachers.join(', ') : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-center text-slate-500">{c.count}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/classes/${c.id}/schedule`} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">Отвори <ArrowRight size={13} /></Link>
                  </td>
                </tr>
              ))}
              {classes.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Няма паралелки</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Ученици ИФО ── */}
      {tab === 'ifo' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left [&>th]:px-4 [&>th]:py-2.5 [&>th]:font-semibold [&>th]:text-slate-500 [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-wider">
                <th>Ученик</th><th>Паралелка</th><th>Води се от</th><th className="text-center">Часове</th><th className="text-right">Разписание</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-b [&>tr]:border-slate-100 [&>tr:last-child]:border-0 [&>tr>td]:border-r [&>tr>td]:border-slate-100 [&>tr>td:last-child]:border-0">
              {ifoStudents.map((s, i) => (
                <tr key={s.id} className={`hover:bg-blue-50/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{s.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{s.className || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-slate-600">{s.teachers.length > 0 ? s.teachers.join(', ') : <span className="text-amber-500 text-xs">няма зададен</span>}</td>
                  <td className="px-4 py-2.5 text-center">
                    {s.count1 > 0
                      ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold"><Check size={13} /> {s.count1}</span>
                      : <span className="text-slate-300 text-xs">празно</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/students/${s.id}/schedule`} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">Отвори <ArrowRight size={13} /></Link>
                  </td>
                </tr>
              ))}
              {ifoStudents.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Няма ученици на ИФО</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Останалите (скоро) ── */}
      {(tab === 'teachers' || tab === 'therapists') && (
        <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <CalendarClock size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Този раздел предстои</p>
        </div>
      )}
    </div>
  )
}
