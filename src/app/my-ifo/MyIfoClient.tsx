import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, GraduationCap } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import { MyIfoClient } from './MyIfoClient'
export const dynamic = 'force-dynamic'

export default async function MyIfoPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>
}) {
  const { term: termParam } = await searchParams
  const term = termParam === '2' ? 2 : 1
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role, first_name, last_name').eq('user_id', user.id).single()
  if (!profile) redirect('/dashboard')
  // Достъп: учители/възпитатели (+ админ/здуд за преглед)
  const allowed = ['class_teacher', 'educator', 'admin', 'zdud'].includes(profile.role)
  if (!allowed) redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('academic_years').select('id, name').eq('is_current', true).single()

  // Всички ИФО деца (education_form = 'ifo') за текущата година
  const { data: ifoEnrollments } = await supabase
    .from('student_enrollments')
    .select('student_id, education_form, class:classes(name), student:students(id, first_name, middle_name, last_name, status)')
    .eq('academic_year_id', currentYear?.id)
    .eq('education_form', 'ifo')

  const ifoStudents = (ifoEnrollments || [])
    .filter((e: any) => e.student && e.student.status === 'active')
    .map((e: any) => ({
      id: e.student.id,
      name: getFullName(e.student),
      className: e.class?.name || '',
    }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg'))

  // Предмети
  const { data: subjects } = await supabase
    .from('subjects').select('id, name, allows_pullout')
    .order('allows_pullout', { ascending: false }).order('name')

  // Часовете на ТОЗИ учител (всичките му ИФО слотове за срока)
  const { data: mySlots } = await supabase
    .from('teacher_ifo_slots')
    .select('student_id, day, period, subject_id')
    .eq('teacher_id', profile.id)
    .eq('academic_year_id', currentYear?.id)
    .eq('term', term)

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} /> Назад
      </Link>
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}>
          <GraduationCap size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Индивидуални часове (ИФО)</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {profile.first_name} {profile.last_name} · {currentYear?.name}
          </p>
        </div>
      </div>
      <MyIfoClient
        academicYearId={currentYear?.id || ''}
        term={term}
        ifoStudents={ifoStudents}
        subjects={subjects || []}
        existingSlots={mySlots || []}
      />
    </div>
  )
}
