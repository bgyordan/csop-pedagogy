import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import { IfoScheduleGrid } from './IfoScheduleGrid'

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

  // Достъп: админ/здуд, или класният на паралелката, в която детето е записано
  let canEdit = ['admin', 'zdud'].includes(profile?.role || '')
  if (!canEdit && profile?.id) {
    const { data: enr } = await supabase
      .from('student_enrollments').select('class_id')
      .eq('student_id', studentId).eq('academic_year_id', currentYear?.id).maybeSingle()
    if (enr?.class_id) {
      const { data: cta } = await supabase
        .from('class_teacher_assignments')
        .select('id').eq('staff_id', profile.id).eq('class_id', enr.class_id)
        .eq('academic_year_id', currentYear?.id).maybeSingle()
      canEdit = !!cta
    }
  }
  if (!canEdit) redirect('/dashboard')

  const { data: subjects } = await supabase
    .from('subjects').select('*').order('allows_pullout', { ascending: false }).order('name')

  const { data: schedule } = await supabase
    .from('class_schedules').select('id')
    .eq('student_id', studentId).eq('academic_year_id', currentYear?.id).eq('term', term)
    .maybeSingle()

  let existingSlots: any[] = []
  if (schedule) {
    const { data } = await supabase
      .from('schedule_slots').select('day, period, subject_id').eq('schedule_id', schedule.id)
    existingSlots = data || []
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <Link href={`/students/${studentId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} /> Назад към ученика
      </Link>

      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">
          Индивидуално седмично разписание
        </h1>
        <p className="text-slate-500 text-sm mt-1">{getFullName(student)} · ИФО · {currentYear?.name}</p>
      </div>

      <IfoScheduleGrid
        studentId={studentId}
        academicYearId={currentYear?.id || ''}
        term={term}
        subjects={subjects || []}
        existingSlots={existingSlots}
      />
    </div>
  )
}
