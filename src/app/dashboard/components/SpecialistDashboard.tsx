import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, FileText, Calendar, Check, Sparkles, Clock, Bell } from 'lucide-react'
import { getFullName, formatDate, getDaysUntil } from '@/lib/utils'
import { DocumentType, DOCUMENT_TYPE_LABELS } from '@/types'

const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

export default async function SpecialistDashboard({ profile, currentYearId }: any) {
  const supabase = await createClient()

  const roleMap: Record<string, string> = {
    psychologist: 'psychologist_id',
    speech_therapist: 'speech_therapist_id',
    rehabilitator: 'rehabilitator_id',
    class_teacher: 'class_teacher_id',
  }
  const roleField = roleMap[profile.role] || 'psychologist_id'

  const [{ data: eplrTeams }, { data: announcements }, { data: deadlines }] = await Promise.all([
    supabase.from('eplr_teams')
      .select('student_id, student:students(*)')
      .eq(roleField, profile.id)
      .eq('academic_year_id', currentYearId),
    supabase.from('announcements')
      .select('*').eq('is_active', true)
      .order('created_at', { ascending: false }).limit(3),
    supabase.from('calendar_deadlines')
      .select('*').eq('academic_year_id', currentYearId)
      .gte('deadline_date', new Date().toISOString().split('T')[0])
      .order('deadline_date').limit(5),
  ])

  const studentIds = eplrTeams?.map(e => e.student_id) || []

  const { data: documents } = studentIds.length > 0
    ? await supabase.from('documents').select('*')
        .eq('academic_year_id', currentYearId)
        .in('student_id', studentIds)
    : { data: [] }

  const docMap = new Map(documents?.map(d => [`${d.student_id}_${d.doc_type}`, d]) || [])
  const completed = documents?.filter(d => d.status === 'completed').length || 0
  const total = documents?.length || 0

  return (
    <div className="animate-in fade-in duration-300">
      {/* ── СТАТИСТИКА ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100/50">
              <Users size={18} className="text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-500">Моите ученици</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">{studentIds.length}</div>
          <div className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wide">от ЕПЛР екип</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100/50">
              <Check size={18} className="text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-slate-500">Завършени</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {completed} <span className="text-lg font-medium text-slate-400">/ {total}</span>
          </div>
          <div className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wide">документа</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100/50">
              <Clock size={18} className="text-amber-600" />
            </div>
            <span className="text-sm font-medium text-slate-500">Незавършени</span>
          </div>
          <div className="text-3xl font-bold text-slate-800">{total - completed}</div>
          <div className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wide">документа</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── УЧЕНИЦИ ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100/80">
            <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <Users size={16} className="text-slate-400" /> Моите ученици
            </h2>
          </div>
          
          <div className="divide-y divide-slate-100">
            {!eplrTeams?.length ? (
              <div className="p-8 text-center text-slate-400 text-sm">Няма разпределени ученици</div>
            ) : (
              eplrTeams.map(e => {
                const student = e.student as any
                const myDocs = ALL_DOC_TYPES.map(dt => docMap.get(`${e.student_id}_${dt}`))
                const doneCount = myDocs.filter(d => d?.status === 'completed').length
                const pct = Math.round((doneCount / ALL_DOC_TYPES.length) * 100)
                const isFullyCompleted = doneCount === ALL_DOC_TYPES.length

                return (
                  <div key={e.student_id} className={`p-4 hover:bg-slate-50/50 transition-colors ${isFullyCompleted ? 'bg-emerald-50/10' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <Link href={`/students/${e.student_id}`} className="font-semibold text-slate-800 text-sm hover:text-blue-600 transition-colors flex items-center gap-2">
                        {getFullName(student)}
                        {isFullyCompleted && <Sparkles size={12} className="text-emerald-500" />}
                      </Link>
                      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md ${isFullyCompleted ? 'bg-emerald-100 text-emerald-700' : doneCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                        {doneCount}/{ALL_DOC_TYPES.length} готови
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${isFullyCompleted ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 w-8">{pct}%</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── СРОКОВЕ И СЪОБЩЕНИЯ ── */}
        <div className="space-y-6">
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
                    <div key={d.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-700 truncate">{d.title}</div>
                        <div className="text-xs text-slate-400 font-medium">{formatDate(d.deadline_date)}</div>
                      </div>
                      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-1 rounded-md border ${
                        days === 0 ? 'bg-rose-50 text-rose-700 border-rose-100' :
                        days <= 7 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        {days === 0 ? 'Днес!' : `${days} дни`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {announcements && announcements.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm bg-gradient-to-br from-white to-indigo-50/30">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-indigo-100/50">
                <Bell size={18} className="text-indigo-400" />
                <h2 className="font-semibold text-slate-800 text-sm">Съобщения</h2>
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
