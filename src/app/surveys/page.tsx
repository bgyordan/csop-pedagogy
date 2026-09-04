import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/BackButton'
import { ClipboardList, ChevronRight, Check, Circle, Users } from 'lucide-react'
import { getFullName } from '@/lib/utils'
export const dynamic = 'force-dynamic'

export default async function SurveysPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role, is_coordinator').eq('user_id', user.id).single()
  const allowed = ['admin', 'zdud', 'director'].includes(me?.role || '')
    || me?.is_coordinator === true
    || ['psychologist', 'speech_therapist', 'rehabilitator'].includes(me?.role || '')
  if (!allowed) redirect('/dashboard')
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  // новите деца (is_new) + паралелка
  const { data: newStudents } = await supabase
    .from('students')
    .select('id, first_name, middle_name, last_name, is_new, status')
    .eq('is_new', true).eq('status', 'active')
  const ids = (newStudents || []).map((s: any) => s.id)

  // кои имат попълнена анкета
  const statusBy: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: surveys } = await supabase.from('student_surveys').select('student_id, status').in('student_id', ids)
    ;(surveys || []).forEach((s: any) => { statusBy[s.student_id] = s.status || 'in_progress' })
  }

  // паралелка на всеки
  const clsBy: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: enr } = await supabase.from('student_enrollments').select('student_id, class:classes(name)')
      .eq('academic_year_id', cy?.id).in('student_id', ids)
    ;(enr || []).forEach((e: any) => { if (e.class?.name) clsBy[e.student_id] = e.class.name })
  }

  const rows = (newStudents || []).map((s: any) => ({
    id: s.id, name: getFullName(s), className: clsBy[s.id] || '', status: statusBy[s.id] || 'empty',
  })).sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg'))

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
          <ClipboardList size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Анкети на новите деца</h1>
          <p className="text-sm text-slate-500 mt-0.5">Карти за оценка на индивидуалните потребности · {cy?.name}</p>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-14 text-center">
          <Users size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">Няма нови деца.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r: any) => (
            <Link key={r.id} href={`/students/${r.id}/survey`}
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 hover:border-slate-400 hover:shadow-[0_2px_8px_rgba(15,34,64,0.10)] transition-all group shadow-[0_1px_4px_rgba(15,34,64,0.06)]">
              <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${r.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : r.status === 'in_progress' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                {r.status === 'completed' ? <Check size={17} /> : <Circle size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-800">{r.name}</div>
                <div className="text-xs text-slate-400">{r.className ? `Паралелка ${r.className}` : 'без паралелка'}</div>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${r.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : r.status === 'in_progress' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                {r.status === 'completed' ? 'завършена' : r.status === 'in_progress' ? 'в процес' : 'празна'}
              </span>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
