import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlertCircle, Calendar } from 'lucide-react'
import { formatDate, getDaysUntil, getFullName } from '@/lib/utils'
import { DocumentType, DOCUMENT_TYPE_LABELS } from '@/types'
import Link from 'next/link'

const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

const DOC_SHORT: Record<DocumentType, string> = {
  protocol_1: 'П1',
  protocol_2: 'П2',
  protocol_3: 'П3',
  iup: 'ИУП',
  iu_program: 'ИУПр',
  support_plan: 'ПДП',
  parent_program: 'ПР',
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const params = await searchParams

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { data: currentYear } = await supabase
    .from('academic_years')
    .select('*')
    .eq('is_current', true)
    .single()

  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .eq('academic_year_id', currentYear?.id)
    .order('name')

  const { data: deadlines } = await supabase
    .from('calendar_deadlines')
    .select('*')
    .eq('academic_year_id', currentYear?.id)
    .gte('deadline_date', new Date().toISOString().split('T')[0])
    .order('deadline_date')
    .limit(5)

  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(3)

  let classStudents: any[] = []
  let classDocMap = new Map<string, any>()
  let selectedClass = null

  if (params.class) {
    selectedClass = classes?.find(c => c.id === params.class)

    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('*, student:students(*)')
      .eq('class_id', params.class)
      .eq('academic_year_id', currentYear?.id)

    classStudents = enrollments?.map(e => e.student).filter(Boolean) || []

    if (classStudents.length > 0) {
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('academic_year_id', currentYear?.id)
        .in('student_id', classStudents.map(s => s.id))

      docs?.forEach(d => {
        classDocMap.set(`${d.student_id}_${d.doc_type}`, d)
      })
    }
  }

  const { data: allEnrollments } = await supabase
    .from('student_enrollments')
    .select('class_id')
    .eq('academic_year_id', currentYear?.id)

  const classCount = new Map<string, number>()
  allEnrollments?.forEach(e => {
    classCount.set(e.class_id, (classCount.get(e.class_id) || 0) + 1)
  })

  const firstName = profile?.first_name || ''

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Добре дошли, {firstName}!</h1>
        <p className="text-slate-500 text-sm mt-1">
          Учебна година {currentYear?.name} · {formatDate(new Date().toISOString())}
        </p>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">Паралелки</h2>
        <div className="flex flex-wrap gap-3">
          {classes?.map(cls => {
            const count = classCount.get(cls.id) || 0
            const isSelected = params.class === cls.id
            return (
              <Link
                key={cls.id}
                href={isSelected ? '/dashboard' : `/dashboard?class=${cls.id}`}
                className={`flex flex-col items-center justify-center w-24 h-20 rounded-xl border text-sm font-medium transition-all ${
                  isSelected
                    ? 'border-navy bg-navy text-white shadow-md'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-sm'
                }`}
                style={isSelected ? { backgroundColor: '#0f2240', borderColor: '#0f2240' } : {}}
              >
                <span className="text-lg font-semibold">{cls.name}</span>
                <span className={`text-xs mt-0.5 ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                  {count} {count === 1 ? 'ученик' : 'ученика'}
                </span>
              </Link>
            )
          })}
          {!classes?.length && (
            <p className="text-sm text-slate-400">Няма паралелки — добави от Администрация</p>
          )}
        </div>
      </div>

      {selectedClass && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
              Паралелка {selectedClass.name} — документи
            </h2>
            <Link href={`/students?class=${selectedClass.id}`} className="text-xs text-slate-400 hover:text-slate-700">
              Всички ученици →
            </Link>
          </div>

          {classStudents.length === 0 ? (
            <div className="card text-center py-8 text-slate-400 text-sm">Няма ученици в тази паралелка</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table c
