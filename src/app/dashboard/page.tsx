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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Ученик</th>
                    {ALL_DOC_TYPES.map(dt => (
                      <th key={dt} className="text-center px-2 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide" title={DOCUMENT_TYPE_LABELS[dt]}>
                        {DOC_SHORT[dt]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map(student => (
                    <tr key={student.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link href={`/students/${student.id}`} className="font-medium text-slate-800 hover:underline">
                          {getFullName(student)}
                        </Link>
                      </td>
                      {ALL_DOC_TYPES.map(dt => {
                        const doc = classDocMap.get(`${student.id}_${dt}`)
                        const status = doc?.status || 'empty'
                        return (
                          <td key={dt} className="text-center px-2 py-2.5">
                            <Link href={`/documents/${student.id}/${dt}`}>
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                                status === 'completed' ? 'bg-green-100 text-green-700' :
                                status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-400'
                              }`}>
                                {status === 'completed' ? '✓' : status === 'in_progress' ? '…' : '—'}
                              </span>
                            </Link>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Calendar size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">Предстоящи срокове</h2>
          </div>
          {!deadlines?.length ? (
            <p className="text-sm text-slate-400">Няма предстоящи срокове</p>
          ) : (
            <div className="space-y-2">
              {deadlines.map(deadline => {
                const days = getDaysUntil(deadline.deadline_date)
                const isRed = days <= 7
                const isYellow = days <= 30 && days > 7
                return (
                  <div key={deadline.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                    <div>
                      <div className="text-sm font-medium text-slate-700">{deadline.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatDate(deadline.deadline_date)}</div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      isRed ? 'bg-red-100 text-red-700' :
                      isYellow ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {days === 0 ? 'Днес' : days === 1 ? '1 ден' : `${days} дни`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <AlertCircle size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">Съобщения</h2>
          </div>
          {!announcements?.length ? (
            <p className="text-sm text-slate-400">Няма активни съобщения</p>
          ) : (
            <div className="space-y-3">
              {announcements.map(ann => (
                <div key={ann.id} className="p-3 rounded-lg border border-slate-100">
                  <div className="text-sm font-medium text-slate-700">{ann.title}</div>
                  <div className="text-xs text-slate-500 mt-1 line-clamp-2">{ann.body}</div>
                  <div className="text-xs text-slate-400 mt-2">{formatDate(ann.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
