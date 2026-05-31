import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, BookOpen, Clock, CheckCircle2, AlertTriangle, Calendar, AlertCircle } from 'lucide-react'
import { formatDate, getDaysUntil, getMonthName } from '@/lib/utils'
import { DocumentType, DOCUMENT_TYPE_LABELS } from '@/types'

const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

const DOC_SHORT: Record<DocumentType, string> = {
  protocol_1: 'П1', protocol_2: 'П2', protocol_3: 'П3',
  iup: 'ИУП', iu_program: 'ИУПр', support_plan: 'ПДП', parent_program: 'ПР',
}

export default async function AdminDashboard({ profile, currentYearId }: any) {
  const supabase = await createClient()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentDay = now.getDate()
  const reportMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const reportYear = currentMonth === 1 ? now.getFullYear() - 1 : now.getFullYear()
  const deadlinePassed = currentDay > 8

  const [
    { count: totalStudents },
    { count: totalClasses },
    { data: docStats },
    { data: deadlines },
    { data: announcements },
    { data: classes },
    { data: submitted },
    { data: allEnrollments },
    { data: allDocs },
  ] = await Promise.all([
    supabase.from('student_enrollments').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
    supabase.from('classes').select('*', { count: 'exact', head: true }).eq('academic_year_id', currentYearId),
    supabase.from('documents').select('status').eq('academic_year_id', currentYearId),
    supabase.from('calendar_deadlines').select('*').eq('academic_year_id', currentYearId).gte('deadline_date', now.toISOString().split('T')[0]).order('deadline_date').limit(5),
    supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('classes').select('*').eq('academic_year_id', currentYearId).order('name'),
    supabase.from('monthly_absences').select('class_id').eq('month', reportMonth).eq('year', reportYear),
    supabase.from('student_enrollments').select('class_id, student_id').eq('academic_year_id', currentYearId),
    supabase.from('documents').select('student_id, doc_type, status').eq('academic_year_id', currentYearId),
  ])

  const completed = docStats?.filter(d => d.status === 'completed').length || 0
  const inProgress = docStats?.filter(d => d.status === 'in_progress').length || 0
  const submittedIds = new Set(submitted?.map(s => s.class_id) || [])

  const notSubmitted = (classes?.length || 0) - submittedIds.size

  // Build doc map for class matrix
  const docMap = new Map<string, string>()
  allDocs?.forEach(d => docMap.set(`${d.student_id}_${d.doc_type}`, d.status))

  const studentsByClass = new Map<string, string[]>()
  allEnrollments?.forEach(e => {
    if (!studentsByClass.has(e.class_id)) studentsByClass.set(e.class_id, [])
    studentsByClass.get(e.class_id)!.push(e.student_id)
  })

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Link href="/students" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users size={18} className="text-blue-600" />
            </div>
            <span className="text-sm text-slate-500">Ученици</span>
          </div>
          <div className="text-3xl font-semibold text-slate-800">{totalStudents || 0}</div>
          <div className="text-xs text-slate-400 mt-1">активни</div>
        </Link>

        <Link href="/classes" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <BookOpen size={18} className="text-purple-600" />
            </div>
            <span className="text-sm text-slate-500">Паралелки</span>
          </div>
          <div className="text-3xl font-semibold text-slate-800">{totalClasses || 0}</div>
          <div className="text-xs text-slate-400 mt-1">за годината</div>
        </Link>

        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock size={18} className="text-amber-600" />
            </div>
            <span className="text-sm text-slate-500">В процес</span>
          </div>
          <div className="text-3xl font-semibold text-slate-800">{inProgress}</div>
          <div className="text-xs text-slate-400 mt-1">документа</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={18} className="text-green-600" />
            </div>
            <span className="text-sm text-slate-500">Завършени</span>
          </div>
          <div className="text-3xl font-semibold text-slate-800">{completed}</div>
          <div className="text-xs text-slate-400 mt-1">документа</div>
        </div>
      </div>

      {/* IUP Status */}
      {notSubmitted > 0 && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${deadlinePassed ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <AlertTriangle size={18} className={deadlinePassed ? 'text-red-600' : 'text-amber-600'} />
          <div>
            <span className={`font-medium text-sm ${deadlinePassed ? 'text-red-700' : 'text-amber-700'}`}>
              {notSubmitted} паралелки не са въвели реализация на ИУП за {getMonthName(reportMonth)}
            </span>
            {deadlinePassed && <span className="text-red-600 text-xs ml-2">— срокът е изтекъл!</span>}
          </div>
          <Link href="/absences" className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">
            Виж →
          </Link>
        </div>
      )}

      {/* Class matrix */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h2 className="font-medium text-slate-700 text-sm">Документи по паралелки</h2>
          <Link href="/classes" className="text-xs text-slate-400 hover:text-slate-700">Виж всички →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Паралелка</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-slate-500">Уч.</th>
                {ALL_DOC_TYPES.map(dt => (
                  <th key={dt} className="text-center px-2 py-2 text-xs font-medium text-slate-500" title={DOCUMENT_TYPE_LABELS[dt]}>
                    {DOC_SHORT[dt]}
                  </th>
                ))}
                <th className="text-center px-2 py-2 text-xs font-medium text-slate-500">ИУП</th>
              </tr>
            </thead>
            <tbody>
              {classes?.map((cls, idx) => {
                const students = studentsByClass.get(cls.id) || []
                const isSubmitted = submittedIds.has(cls.id)
                return (
                  <tr key={cls.id} className={`border-t border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-3 py-2">
                      <Link href={`/classes/${cls.id}`} className="font-medium text-slate-800 hover:underline">{cls.name}</Link>
                    </td>
                    <td className="text-center px-2 py-2 text-xs text-slate-500">{students.length}</td>
                    {ALL_DOC_TYPES.map(dt => {
                      const comp = students.filter(sid => docMap.get(`${sid}_${dt}`) === 'completed').length
                      return (
                        <td key={dt} className="text-center px-2 py-2">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                            students.length === 0 ? 'bg-slate-100 text-slate-400' :
                            comp === students.length ? 'bg-green-100 text-green-700' :
                            comp > 0 ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {comp}/{students.length}
                          </span>
                        </td>
                      )
                    })}
                    <td className="text-center px-2 py-2">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                        isSubmitted ? 'bg-green-100 text-green-700' :
                        deadlinePassed ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {isSubmitted ? '✓' : deadlinePassed ? '!' : '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deadlines + Announcements */}
      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Calendar size={16} className="text-slate-400" />
            <h2 className="font-medium text-slate-700 text-sm">Предстоящи срокове</h2>
          </div>
          {!deadlines?.length ? <p className="text-sm text-slate-400">Няма предстоящи срокове</p> : (
            <div className="space-y-2">
              {deadlines.map(d => {
                const days = getDaysUntil(d.deadline_date)
                return (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                    <div>
                      <div className="text-sm font-medium text-slate-700">{d.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatDate(d.deadline_date)}</div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${days <= 7 ? 'bg-red-100 text-red-700' : days <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {days === 0 ? 'Днес' : `${days} дни`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-slate-400" />
              <h2 className="font-medium text-slate-700 text-sm">Съобщения</h2>
            </div>
            <Link href="/admin/announcements" className="text-xs text-slate-400 hover:text-slate-700">+ Ново</Link>
          </div>
          {!announcements?.length ? <p className="text-sm text-slate-400">Няма активни съобщения</p> : (
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
    </>
  )
}
