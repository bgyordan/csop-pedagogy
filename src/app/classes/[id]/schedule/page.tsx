import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ScheduleGrid } from './ScheduleGrid'

export const dynamic = 'force-dynamic'

export default async function ClassSchedulePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ term?: string }>
}) {
  const { id: classId } = await params
  const { term: termParam } = await searchParams
  const term = termParam === '2' ? 2 : 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('id, role').eq('user_id', user.id).single()

  const { data: cls } = await supabase
    .from('classes').select('*').eq('id', classId).single()
  if (!cls) notFound()

  // Достъп: админ/здуд, или класният на тази паралелка
  let canEdit = ['admin', 'zdud'].includes(profile?.role || '')
  if (!canEdit && profile?.id) {
    const { data: cta } = await supabase
      .from('class_teacher_assignments')
      .select('id').eq('staff_id', profile.id).eq('class_id', classId)
      .eq('academic_year_id', cls.academic_year_id).maybeSingle()
    canEdit = !!cta
  }
  if (!canEdit) redirect('/dashboard')

  // Предметите
  const { data: subjects } = await supabase
    .from('subjects').select('*').order('allows_pullout', { ascending: false }).order('name')

  // Съществуващото разписание за този срок
  const { data: schedule } = await supabase
    .from('class_schedules').select('id')
    .eq('class_id', classId).eq('academic_year_id', cls.academic_year_id).eq('term', term)
    .maybeSingle()

  let existingSlots: any[] = []
  if (schedule) {
    const { data } = await supabase
      .from('schedule_slots').select('day, period, subject_id').eq('schedule_id', schedule.id)
    existingSlots = data || []
  }
// Класен ръководител на паралелката
  const { data: cta } = await supabase
    .from('class_teacher_assignments')
    .select('staff:staff_profiles(first_name, middle_name, last_name)')
    .eq('class_id', classId).eq('academic_year_id', cls.academic_year_id)
    .limit(1).maybeSingle()
  const teacher = (cta?.staff as any)
  const classTeacherName = teacher ? [teacher.first_name, teacher.last_name].filter(Boolean).join(' ') : ''

  // Учебна година (име)
  const { data: yearRow } = await supabase
    .from('academic_years').select('name').eq('id', cls.academic_year_id).maybeSingle()
  const yearName = yearRow?.name || ''
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <Link href="/classes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} /> Назад
      </Link>

      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">
          Седмично разписание — Паралелка {cls.name}
        </h1>
        <p className="text-slate-500 text-sm mt-1">Учебна година {cls.academic_year_id ? '' : ''}</p>
      </div>

      <ScheduleGrid
        classId={classId}
        academicYearId={cls.academic_year_id}
        term={term}
        subjects={subjects || []}
        existingSlots={existingSlots}
        className={cls.name}
        classTeacherName={classTeacherName}
        yearName={yearName}
      />
    </div>
  )
}
