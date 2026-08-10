import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import { IfoScheduleView } from './IfoScheduleView'
export const dynamic = 'force-dynamic'

export default async function IfoSchedulePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ term?: string }>
}) {
  const { id: studentId } = await params
  const { term: termParam } = await searchParams
  const term = termParam === '2' ? 2 : 1
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  const { data: student } = await supabase
    .from('students').select('*').eq('id', studentId).single()
  if (!student) notFound()

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  // Достъп: админ/здуд, класният на паралелката, ИЛИ учител който води ИФО часове на детето
  let canView = ['admin', 'zdud', 'director'].includes(profile?.role || '')
  if (!canView && profile?.id) {
    // класен на паралелката на детето?
    const { data: enr } = await supabase
      .from('student_enrollments').select('class_id')
      .eq('student_id', studentId).eq('academic_year_id', currentYear?.id).maybeSingle()
    if (enr?.class_id) {
      const { data: cta } = await supabase
        .from('class_teacher_assignments')
        .select('id').eq('staff_id', profile.id).eq('class_id', enr.class_id)
        .eq('academic_year_id', currentYear?.id).maybeSingle()
      canView = !!cta
    }
    // или води ИФО часове на детето?
    if (!canView) {
      const { data: mine } = await supabase
        .from('teacher_ifo_slots').select('id')
        .eq('teacher_id', profile.id).eq('student_id', studentId)
        .eq('academic_year_id', currentYear?.id).limit(1).maybeSingle()
      canView = !!mine
    }
  }
  if (!canView) redirect('/dashboard')

  // Резултатно: всички ИФО часове на детето за срока (от всички учители)
  const { data: slots } = await supabase
    .from('teacher_ifo_slots')
    .select('day, period, subject:subjects(name, allows_pullout), teacher:staff_profiles(first_name, last_name)')
    .eq('student_id', studentId)
    .eq('academic_year_id', currentYear?.id)
    .eq('term', term)

  const viewSlots = (slots || []).map((s: any) => ({
    day: s.day,
    period: s.period,
    subjectName: s.subject?.name || '',
    allowsPullout: s.subject?.allows_pullout || false,
    teacherName: s.teacher ? `${s.teacher.first_name} ${s.teacher.last_name}` : '',
  }))

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <Link href={`/students/${studentId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} /> Назад към ученика
      </Link>
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Индивидуално седмично разписание</h1>
        <p className="text-slate-500 text-sm mt-1">{getFullName(student)} · ИФО · {currentYear?.name}</p>
      </div>
      <IfoScheduleView term={term} slots={viewSlots} />
    </div>
  )
}
