import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, BookOpen, ChevronRight, Mail } from 'lucide-react'
import { ROLE_LABELS } from '@/types'
import { getFullName } from '@/lib/utils'
import StaffClassesSection from './StaffClassesSection'

export const dynamic = 'force-dynamic'

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director'].includes(profile?.role || '')) redirect('/dashboard')

  const { data: staff } = await supabase
    .from('staff_profiles').select('*').eq('id', id).single()
  if (!staff) notFound()

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  // Ученици по ЕПЛР роля
  const roleField: Record<string, string> = {
    psychologist: 'psychologist_id',
    speech_therapist: 'speech_therapist_id',
    rehabilitator: 'rehabilitator_id',
  }

  let eplrStudents: any[] = []
  const field = roleField[staff.role]
  if (field) {
    const { data } = await supabase
      .from('eplr_teams')
      .select('student:students(id, first_name, middle_name, last_name, status)')
      .eq(field, id)
      .eq('academic_year_id', currentYear?.id)
    eplrStudents = (data || [])
      .map((t: any) => t.student)
      .filter((s: any) => s && s.status === 'active')
  }

  // Паралелки като класен ръководител
  const { data: myClasses } = await supabase
    .from('class_teacher_assignments')
    .select('id, class:classes(id, name)')
    .eq('staff_id', id)
    .eq('academic_year_id', currentYear?.id)

  // Всички паралелки за избор (без тези които вече имат класен)
  const { data: allClasses } = await supabase
    .from('classes').select('id, name')
    .eq('academic_year_id', currentYear?.id)
    .order('name')

  const { data: takenAssignments } = await supabase
    .from('class_teacher_assignments')
    .select('class_id, staff_id, staff:staff_profiles(first_name, middle_name, last_name)')
    .eq('academic_year_id', currentYear?.id)

  // Всички паралелки; заетите носят името на текущия класен
  const takenMap: Record<string, string> = {}
  ;(takenAssignments || []).forEach((a: any) => {
    if (a.staff_id === id) return
    takenMap[a.class_id] = a.staff ? getFullName(a.staff) : 'зает'
  })

  const classOptions = (allClasses || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    takenBy: takenMap[c.id] || null,
  }))

  const assignedClasses = (myClasses || []).map((c: any) => ({
    assignmentId: c.id,
    classId: c.class?.id,
    name: c.class?.name || '—',
  })).filter((c: any) => c.classId)

  const canManageAssignments = ['admin', 'zdud'].includes(profile?.role || '')

  const classIds = (myClasses || []).map((c: any) => c.class?.id).filter(Boolean)

  let classStudents: any[] = []
  if (classIds.length > 0) {
    const { data } = await supabase
      .from('student_enrollments')
      .select('class_id, student:students(id, first_name, middle_name, last_name, status), class:classes(name)')
      .in('class_id', classIds)
      .eq('academic_year_id', currentYear?.id)
    classStudents = (data || []).filter((e: any) => e.student?.status === 'active')
  }

  // ЦОУД групи като възпитател
  const { data: coudGroups } = await supabase
    .from('coud_groups')
    .select('id, name')
    .eq('teacher_id', id)
    .eq('academic_year_id', currentYear?.id)

  let coudStudents: any[] = []
  if ((coudGroups || []).length > 0) {
    const { data } = await supabase
      .from('coud_enrollments')
      .select('coud_group_id, student:students(id, first_name, middle_name, last_name, status)')
      .in('coud_group_id', (coudGroups || []).map(g => g.id))
      .eq('academic_year_id', currentYear?.id)
    coudStudents = (data || []).filter((e: any) => e.student?.status === 'active')
  }

  const sortByName = (a: any, b: any) => getFullName(a).localeCompare(getFullName(b), 'bg')

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link href="/staff" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
        <ArrowLeft size={15} /> Назад към служителите
      </Link>

      {/* Хедър */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
            style={{ backgroundColor: '#0f2240' }}>
            {staff.first_name?.charAt(0)}{staff.last_name?.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{getFullName(staff)}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-slate-500">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                {ROLE_LABELS[staff.role as keyof typeof ROLE_LABELS] || staff.role}
              </span>
              {staff.position && <span className="text-xs">{staff.position}</span>}
              <span className="flex items-center gap-1 text-xs"><Mail size={12} />{staff.email}</span>
            </div>
          </div>
        </div>
      </div>

      <StaffClassesSection
        staffId={id}
        academicYearId={currentYear?.id || ''}
        assigned={assignedClasses}
        options={classOptions}
        canManage={canManageAssignments}
      />

      {/* Паралелки като класен */}
      {classStudents.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-5">
          <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
            <BookOpen size={15} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Класен ръководител</span>
            <span className="ml-auto text-xs text-slate-400">{classStudents.length} ученика</span>
          </div>
          <div className="divide-y divide-slate-50">
            {classStudents.sort((a, b) => sortByName(a.student, b.student)).map((e: any) => (
              <Link key={e.student.id} href={`/students/${e.student.id}`}
                className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 transition-colors group">
                <span className="text-sm text-slate-700">{getFullName(e.student)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{e.class?.name}</span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ЕПЛР ученици */}
      {eplrStudents.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-5">
          <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
            <Users size={15} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">
              Ученици по ЕПЛР ({ROLE_LABELS[staff.role as keyof typeof ROLE_LABELS] || staff.role})
            </span>
            <span className="ml-auto text-xs text-slate-400">{eplrStudents.length} ученика</span>
          </div>
          <div className="divide-y divide-slate-50">
            {eplrStudents.sort(sortByName).map((s: any) => (
              <Link key={s.id} href={`/students/${s.id}`}
                className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 transition-colors group">
                <span className="text-sm text-slate-700">{getFullName(s)}</span>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ЦОУД групи */}
      {coudStudents.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-5">
          <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
            <Users size={15} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">
              ЦОУД {(coudGroups || []).map(g => g.name).join(', ')}
            </span>
            <span className="ml-auto text-xs text-slate-400">{coudStudents.length} ученика</span>
          </div>
          <div className="divide-y divide-slate-50">
            {coudStudents.sort((a, b) => sortByName(a.student, b.student)).map((e: any) => (
              <Link key={e.student.id} href={`/students/${e.student.id}`}
                className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 transition-colors group">
                <span className="text-sm text-slate-700">{getFullName(e.student)}</span>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {classStudents.length === 0 && eplrStudents.length === 0 && coudStudents.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <p className="text-slate-400 text-sm">Няма назначени ученици за {currentYear?.name}</p>
        </div>
      )}
    </div>
  )
}
