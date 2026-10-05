import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Eye } from 'lucide-react'
import ScheduleTabs from '../ScheduleTabs'
import CurriculumPlan from '@/components/curriculum/CurriculumPlan'
import { loadCurriculum, scheduleHoursByClass, TEACHER_NORM } from '@/lib/curriculum'
export const dynamic = 'force-dynamic'

// „Разписание“ → таб „Учебен план“: редовете от НЕИСПУО за учителя (справочно) + сверка с разписанието в EIS
export default async function MyPlanPage({ searchParams }: { searchParams: Promise<{ staff?: string; term?: string }> }) {
  const { staff: staffParam, term: termParam } = await searchParams
  const term = termParam === '2' ? 2 : 1
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, first_name, last_name').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')

  const isManager = ['admin', 'zdud', 'director'].includes(me.role)
  let target = me
  const viewingOther = !!staffParam && staffParam !== me.id
  if (viewingOther) {
    if (!isManager) redirect('/my-schedule/plan')
    const { data: other } = await supabase.from('staff_profiles').select('id, role, first_name, last_name').eq('id', staffParam).single()
    if (!other) redirect('/schedules?tab=teachers')
    target = other
  }

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()
  const [{ lines, importedAt }, schedule, { data: cta }] = await Promise.all([
    loadCurriculum(supabase, cy?.id, { staffId: target.id }),
    scheduleHoursByClass(supabase, cy?.id, target.id),
    supabase.from('class_teacher_assignments').select('class:classes(id, name)').eq('staff_id', target.id).eq('academic_year_id', cy?.id),
  ])
  const myClasses = (cta || []).map((a: any) => a.class).filter(Boolean)
    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg')) as { id: string; name: string }[]

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <Link href={viewingOther ? '/schedules?tab=teachers' : '/dashboard'} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} /> {viewingOther ? 'Назад към Разписания' : 'Назад'}
      </Link>
      {viewingOther && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-sm">
          <Eye size={15} /> Преглед на учебния план на служителя (само за четене)
        </div>
      )}
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><CalendarDays size={20} className="text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Разписание</h1>
          <p className="text-slate-500 text-sm mt-0.5">{target.first_name} {target.last_name} · {cy?.name}</p>
        </div>
      </div>
      <ScheduleTabs current="plan" classes={myClasses} staffId={viewingOther ? target.id : undefined} term={term} />
      <CurriculumPlan mode="teacher" lines={lines} importedAt={importedAt} norm={TEACHER_NORM[target.role]} schedule={schedule} title={viewingOther ? 'Учебен план' : 'Моят учебен план'} />
    </div>
  )
}
