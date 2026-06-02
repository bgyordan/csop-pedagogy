import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, FileText, Calendar, Check, Sparkles, Bell, ArrowRight, AlertCircle } from 'lucide-react'
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
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <Users className="mx-auto mb-3 text-slate-300" size={48} />
        <h3 className="text-lg font-medium text-slate-700">Няма назначена паралелка</h3>
        <p className="text-sm text-slate-400">Свържете се с администратора за достъп.</p>
      </div>
    )
  }

  const classIds = myClasses.map((c: any) => c.id)

  const [{ data: allEnrollments }, { data: iupSubmissions }, { data: announcements }, { data: deadlines }] = await Promise.all([
    supabase.from('student_enrollments').select('*, student:students(*), class_id').in('class_id', classIds).eq('academic_year_id', currentYearId),
    supabase.from('monthly_absences').select('class_id').in('class_id', classIds).eq('month', reportMonth).eq('year', reportYear),
    supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('calendar_deadlines').select('*').eq('academic_year_id', currentYearId).gte('deadline_date', now.toISOString().split('T')[0]).order('deadline_date').limit(5),
  ])

  const submittedIds = new Set(iupSubmissions?.map(s => s.class_id) || [])
  const allStudents = allEnrollments?.map(e => e.student as any).filter(Boolean) || []

  const { data: documents } = allStudents.length > 0
    ? await supabase.from('documents').select('*').eq('academic_year_id', currentYearId).in('student_id', allStudents.map(s => s.id))
    : { data: [] }

  const docMap = new Map(documents?.map(d => [`${d.student_id}_${d.doc_type}`, d]) || [])

  const getModernBadge = (status: DocumentStatus) => {
    if (status === 'completed') return <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100/50 shadow-sm text-emerald-500"><Check size={14} strokeWidth={2.5} /></span>
    if (status === 'in_progress') return <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 border border-amber-100/50 text-amber-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span></span>
    return <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 border border-slate-100/50"><span className="w-1 h-1 rounded-full bg-slate-300"></span></span>
  }

  return (
    <div className="animate-in fade-in duration-500">
      {/* СТАТИСТИКА */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3 text-blue-600">
            <Users size={18} />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Ученици</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">{allStudents.length}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3 text-amber-600">
            <Calendar size={18} />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">ИУП — {getMonthName(reportMonth)}</span>
          </div>
          <div className="space-y-1">
            {myClasses.map((cls: any) => {
              const submitted = submittedIds.has(cls.id)
              return (
                <div key={cls.id} className="flex items-center justify-between text-xs font-medium text-slate-600">
                  <span>{cls.name}</span>
                  <span className={submitted ? 'text-emerald-600' : 'text-rose-500'}>{submitted ? '✓' : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3 text-emerald-600">
            <FileText size={18} />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Документи</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {documents?.filter(d => d.status === 'completed').length || 0}
            <span className="text-lg font-normal text-slate-400 ml-1">/ {allStudents.length * ALL_DOC_TYPES.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {myClasses.map((cls: any) => {
            const classStudents = allEnrollments?.filter(e => e.class_id === cls.id).map(e => e.student as any).filter(Boolean) || []
            return (
              <div key={cls.id} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                  <h2 className="font-semibold text-slate-800">Паралелка {cls.name}</h2>
                  <Link href={`/classes/${cls.id}`} className="text-xs font-bold text-blue-600 hover:underline">ПРЕГЛЕД →</Link>
                </div>
                <div className="divide-y divide-slate-50">
                  {classStudents.map(s => {
                    const completed = ALL_DOC_TYPES.filter(dt => docMap.get(`${s.id}_${dt}`)?.status === 'completed').length
                    const pct = Math.round((completed / ALL_DOC_TYPES.length) * 100)
                    return (
                      <div key={s.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex justify-between mb-3">
                          <Link href={`/students/${s.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-600">{getFullName(s)}</Link>
                          <span className="text-[10px] font-bold text-slate-400">{pct}% Готовност</span>
                        </div>
                        <div className="flex gap-2">
                          {ALL_DOC_TYPES.map(dt => (
                            <Link key={dt} href={`/documents/${s.id}/${dt}`} className="hover:scale-110 transition-transform">
                              {getModernBadge(docMap.get(`${s.id}_${dt}`)?.status || 'empty')}
                            </Link>
                          ))}
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
          {/* Срокове */}
          <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Предстоящи срокове</h2>
            <div className="space-y-4">
              {deadlines?.map(d => (
                <div key={d.id} className="flex justify-between items-center">
                  <div className="text-sm font-medium text-slate-700">{d.title}</div>
                  <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded">{formatDate(d.deadline_date)}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Съобщения */}
          <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Съобщения</h2>
            {announcements?.map(a => (
              <div key={a.id} className="mb-4">
                <div className="text-sm font-semibold text-slate-800">{a.title}</div>
                <p className="text-xs text-slate-500 mt-1">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
