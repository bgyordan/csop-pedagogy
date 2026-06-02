import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, FileText, Calendar, Check, Sparkles, AlertCircle, Bell } from 'lucide-react'
import { getFullName, getMonthName, formatDate, getDaysUntil } from '@/lib/utils'
import { DocumentType, DOCUMENT_TYPE_LABELS, DocumentStatus } from '@/types'

const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

const DOC_SHORT: Record<DocumentType, string> = {
  protocol_1: 'П1', protocol_2: 'П2', protocol_3: 'П3',
  iup: 'ИУП', iu_program: 'ИУПр', support_plan: 'ПДП', parent_program: 'ПР',
}

export default async function ClassTeacherDashboard({ profile, currentYearId }: any) {
  const supabase = await createClient()

  const now = new Date()
  const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const deadlinePassed = now.getDate() > 8

  const { data: assignments } = await supabase
    .from('class_teacher_assignments')
    .select('class:classes(*)')
    .eq('staff_id', profile.id)
    .eq('academic_year_id', currentYearId)

  const myClasses = assignments?.map((a: any) => a.class).filter(Boolean) || []

  if (myClasses.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <Users className="mx-auto mb-3 text-slate-300" size={48} />
        <h3 className="text-lg font-medium text-slate-700 mb-1">Нямате назначена паралелка</h3>
        <p className="text-sm text-slate-400">Свържете се с администратора (ЗДАСД) за разпределение.</p>
      </div>
    )
  }

  const classIds = myClasses.map((c: any) => c.id)

  const [{ data: allEnrollments }, { data: iupSubmissions }, { data: announcements }, { data: deadlines }] = await Promise.all([
    supabase.from('student_enrollments').select('*, student:students(*), class_id').in('class_id', classIds).eq('academic_year_id', currentYearId),
    supabase.from('monthly_absences').select('class_id').in('class_id', classIds).eq('month', reportMonth).eq('year', reportYear),
    supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('calendar_deadlines')
      .select('*').eq('academic_year_id', currentYearId)
      .gte('deadline_date', now.toISOString().split('T')[0])
      .order('deadline_date').limit(5),
  ])

  const submittedIds = new Set(iupSubmissions?.map(s => s.class_id) || [])
  const allStudents = allEnrollments?.map(e => e.student as any).filter(Boolean) || []

  const { data: documents } = allStudents.length > 0
    ? await supabase.from('documents').select('*').eq('academic_year_id', currentYearId).in('student_id', allStudents.map(s => s.id))
    : { data: [] }

  const docMap = new Map(documents?.map(d => [`${d.student_id}_${d.doc_type}`, d]) || [])

  // Helper за новия дизайн на статусите
  const getModernBadge = (status: DocumentStatus) => {
    if (status === 'completed') {
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100/50 shadow-sm text-emerald-500">
          <Check size={14} strokeWidth={2.5} />
        </span>
      )
    }
    if (status === 'in_progress') {
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 border border-amber-100/50 text-amber-500">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
        </span>
      )
    }
    return (
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 border border-slate-100/50">
        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
      </span>
    )
  }

  return (
    <div className="animate-in fade-in duration-300">
      {/* ── СТАТИСТИКА ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 border border-blue-100/50">
              <Users size={18} className="text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-500">
              {myClasses.length === 1 ? `Паралелка ${myClasses[0].name}` : `${myClasses.length} паралелки`}
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-800">{allStudents.length}</div>
          <div className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wide">Ученици</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 border border-amber-100/50">
              <Calendar size={18} className="text-amber-600" />
            </div>
            <span className="text-sm font-medium text-slate-500">ИУП — {getMonthName(reportMonth)}</span>
          </div>
          <div className="space-y-2 mt-1">
            {myClasses.map((cls: any) => {
              const submitted = submittedIds.has(cls.id)
              return (
                <Link key={cls.id} href={`/absences/${cls.id}/${reportMonth}`}
                  className="flex items-center justify-between group">
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Гр. {cls.name}</span>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-md ${submitted ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50' : deadlinePassed ? 'bg-rose-50 text-rose-700 border border-rose-100/50' : 'bg-amber-50 text-amber-700 border border-amber-100/50'}`}>
                    {submitted ? <Check size={12} strokeWidth={3} /> : <AlertCircle size={12} />}
                    {submitted ? 'Въведено' : 'Невъведено'}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 border border-emerald-100/50">
              <FileText size={18} className="text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-slate-500">Документи</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {documents?.filter(d => d.status === 'completed').length || 0}
            <span className="text-lg font-medium text-slate-400"> / {allStudents.length * ALL_DOC_TYPES.length}</span>
          </div>
          <div className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wide">Завършени</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* ── ДОКУМЕНТИ ПО ПАРАЛЕЛКИ ── */}
          {myClasses.map((cls: any) => {
            const classStudents = allEnrollments
              ?.filter(e => e.class_id === cls.id)
              .map(e => e.student as any)
              .filter(Boolean) || []

            return (
              <div key={cls.id} className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100/80">
                  <h2 className="font-semibold text-slate-800 text-base">Документи — Паралелка {cls.name}</h2>
                  <Link href={`/classes/${cls.id}`} className="text-xs font-semibold text-blue-600 bg-blue-50/80 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors shadow-sm">Виж паралелката →</Link>
                </div>

                {/* ДЕСКТОП: таблица */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-1/4">Ученик</th>
                        <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest min-w-[100px]">Прогрес</th>
                        {ALL_DOC_TYPES.map(dt => (
                          <th key={dt} className="text-center px-2 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest" title={DOCUMENT_TYPE_LABELS[dt]}>
                            {DOC_SHORT[dt]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classStudents.map((student, idx) => {
                        const completedCount = ALL_DOC_TYPES.filter(dt => docMap.get(`${student.id}_${dt}`)?.status === 'completed').length
                        const pct = Math.round((completedCount / ALL_DOC_TYPES.length) * 100)
                        const isFullyCompleted = completedCount === ALL_DOC_TYPES.length

                        return (
                          <tr key={student.id} className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors duration-200 ${isFullyCompleted ? 'bg-emerald-50/10' : ''}`}>
                            <td className="px-5 py-4">
                              <Link href={`/students/${student.id}`} className="font-medium text-slate-800 hover:text-blue-600 transition-colors flex items-center gap-2">
                                {getFullName(student)}
                                {isFullyCompleted && <Sparkles size={12} className="text-emerald-500" />}
                              </Link>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-500 ${isFullyCompleted ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 w-6 text-right">{pct}%</span>
                              </div>
                            </td>
                            {ALL_DOC_TYPES.map(dt => {
                              const doc = docMap.get(`${student.id}_${dt}`)
                              const status = doc?.status || 'empty'
                              return (
                                <td key={dt} className="text-center px-2 py-4">
                                  <Link href={`/documents/${student.id}/${dt}`} className="inline-block hover:scale-110 transition-transform">
                                    {getModernBadge(status)}
                                  </Link>
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* МОБИЛЕН: карти */}
                <div className="md:hidden divide-y divide-slate-100">
                  {classStudents.map((student) => {
                    const completedCount = ALL_DOC_TYPES.filter(dt => docMap.get(`${student.id}_${dt}`)?.status === 'completed').length
                    const pct = Math.round((completedCount / ALL_DOC_TYPES.length) * 100)
                    const isFullyCompleted = completedCount === ALL_DOC_TYPES.length
                    
                    return (
                      <div key={student.id} className={`p-4 ${isFullyCompleted ? 'bg-emerald-50/10' : 'bg-white'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <Link href={`/students/${student.id}`} className="font-semibold text-slate-800 text-sm hover:underline truncate mr-2 flex items-center gap-1.5">
                            {getFullName(student)}
                            {isFullyCompleted && <Sparkles size={12} className="text-emerald-500" />}
                          </Link>
                          <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md ${isFullyCompleted ? 'bg-emerald-100 text-emerald-700' : completedCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                            {completedCount}/{ALL_DOC_TYPES.length} готови
                          </span>
                        </div>
                        
                        <div className="flex gap-2 flex-wrap mb-3">
                          {ALL_DOC_TYPES.map(dt => {
                            const doc = docMap.get(`${student.id}_${dt}`)
                            const status = doc?.status || 'empty'
                            return (
                              <Link key={dt} href={`/documents/${student.id}/${dt}`} title={DOCUMENT_TYPE_LABELS[dt]}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border shadow-sm ${
                                  status === 'completed' ? 'bg-emerald-50 border-emerald-100/50 text-emerald-700' :
                                  status === 'in_progress' ? 'bg-amber-50 border-amber-100/50 text-amber-700' :
                                  'bg-white border-slate-200 text-slate-500'
                                }`}>
                                {status === 'completed' ? <Check size={10} strokeWidth={3} className="text-emerald-500" /> : status === 'in_progress' ? <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> : <span className="w-1 h-1 rounded-full bg-slate-300"></span>}
                                {DOC_SHORT[dt]}
                              </Link>
                            )
                          })}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${isFullyCompleted ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-400">{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-6">
          {/* ── ПРЕДСТОЯЩИ СРОКОВЕ ── */}
          {deadlines && deadlines.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100/80">
                <Calendar size={18} className="text-slate-400" />
                <h2 className="font-semibold text-slate-800 text-sm">Предстоящи срокове</h2>
              </div>
              <div className="space-y-3">
                {deadlines.map(d => {
                  const days = getDaysUntil(d.deadline_date)
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-3 group">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-700 truncate group-hover:text-blue-600 transition-colors">{d.title}</div>
                        <div className="text-xs text-slate-400 font-medium mt-0.5">{formatDate(d.deadline_date)}</div>
                      </div>
                      <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-md flex-shrink-0 border ${
                        days === 0 ? 'bg-rose-50 text-rose-700 border-rose-100/50' :
                        days <= 7 ? 'bg-amber-50 text-amber-700 border-amber-100/50' :
                        'bg-emerald-50 text-emerald-700 border-emerald-100/50'
                      }`}>
                        {days === 0 ? 'Днес!' : `${days} дни`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── СЪОБЩЕНИЯ ── */}
          {announcements && announcements.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm bg-gradient-to-br from-white to-indigo-50/30">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-indigo-100/50">
                <Bell size={18} className="text-indigo-400" />
                <h2 className="font-semibold text-slate-800 text-sm">Съобщения от ръководството</h2>
              </div>
              <div className="space-y-4">
                {announcements.map(ann => (
                  <div key={ann.id} className="relative pl-3 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-indigo-300 before:rounded-full">
                    <div className="text-sm font-semibold text-slate-700">{ann.title}</div>
                    <div className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-3">{ann.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
