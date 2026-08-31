import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/BackButton'
import { FileText, ChevronRight, Users } from 'lucide-react'
import { getFullName } from '@/lib/utils'
export const dynamic = 'force-dynamic'

export default async function GeneratorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase
    .from('staff_profiles').select('id, role, is_coordinator').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const role = me.role
  const isManager = ['admin', 'zdud', 'director'].includes(role) || me.is_coordinator === true

  // моите деца от ЕПЛР екипа (според ролята); мениджър/координатор вижда всички
  let teamQuery = supabase
    .from('eplr_teams')
    .select('student_id, student:students(id, first_name, middle_name, last_name, status)')
    .eq('academic_year_id', cy?.id)
  if (!isManager) {
    if (role === 'class_teacher' || role === 'teacher' || role === 'educator') teamQuery = teamQuery.eq('class_teacher_id', me.id)
    else if (role === 'psychologist') teamQuery = teamQuery.eq('psychologist_id', me.id)
    else if (role === 'speech_therapist') teamQuery = teamQuery.eq('speech_therapist_id', me.id)
    else if (role === 'rehabilitator') teamQuery = teamQuery.eq('rehabilitator_id', me.id)
    else teamQuery = teamQuery.eq('student_id', 'no-results')
  }
  const { data: teams } = await teamQuery
  const students = (teams || [])
    .map((t: any) => t.student)
    .filter((s: any) => s && s.status === 'active')
    .map((s: any) => ({ id: s.id, name: getFullName(s) }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg'))

  // паралелка на всеки (за етикет)
  const ids = students.map((s: any) => s.id)
  const clsByStudent: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: enr } = await supabase
      .from('student_enrollments').select('student_id, class:classes(name)')
      .eq('academic_year_id', cy?.id).in('student_id', ids)
    ;(enr || []).forEach((e: any) => { if (e.class?.name) clsByStudent[e.student_id] = e.class.name })
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
          <FileText size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Генератор на документи</h1>
          <p className="text-sm text-slate-500 mt-0.5">Изберете дете, за да попълните и изтеглите документ</p>
        </div>
      </header>

      {students.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-14 text-center">
          <Users size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">Нямате деца в екип.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((s: any) => (
            <Link key={s.id} href={`/generator/${s.id}`}
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 hover:border-slate-400 hover:shadow-[0_2px_8px_rgba(15,34,64,0.10)] transition-all group shadow-[0_1px_4px_rgba(15,34,64,0.06)]">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-500 shrink-0"><Users size={17} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-800">{s.name}</div>
                {clsByStudent[s.id] && <div className="text-xs text-slate-400">Паралелка {clsByStudent[s.id]}</div>}
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
