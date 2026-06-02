import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Users, Download, ArrowRightLeft, Archive, UserCog, Pencil, School, Paperclip, History, Sparkles, Check, Clock } from 'lucide-react'
import { formatDate, getFullName } from '@/lib/utils'
import { DOCUMENT_TYPE_LABELS, DocumentType, STATUS_LABELS, DocumentStatus } from '@/types'
import { AttachmentsSection } from './AttachmentsSection'

const ALL_DOC_TYPES: DocumentType[] = ['protocol_1', 'protocol_2', 'protocol_3', 'iup', 'iu_program', 'support_plan', 'parent_program']

const getModernBadge = (status: DocumentStatus) => {
  if (status === 'completed') return <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100 shadow-sm text-emerald-500"><Check size={14} strokeWidth={2.5} /></span>
  if (status === 'in_progress') return <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 border border-amber-100 text-amber-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span></span>
  return <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 border border-slate-100"><span className="w-1 h-1 rounded-full bg-slate-300"></span></span>
}

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: student } = await supabase.from('students').select('*, sending_school:sending_schools(name, city)').eq('id', id).single()
  if (!student) notFound()

  const { data: profile } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  const canManage = ['admin', 'zdud'].includes(profile?.role || '')
  
  const { data: currentYear } = await supabase.from('academic_years').select('*').eq('is_current', true).single()
  const { data: enrollment } = await supabase.from('student_enrollments').select('*, class:classes(*)').eq('student_id', id).eq('academic_year_id', currentYear?.id).single()
  const { data: eplr } = await supabase.from('eplr_teams').select('*, psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(*), speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(*), rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(*), class_teacher:staff_profiles!eplr_teams_class_teacher_id_fkey(*)').eq('student_id', id).eq('academic_year_id', currentYear?.id).single()
  const { data: documents } = await supabase.from('documents').select('*').eq('student_id', id).eq('academic_year_id', currentYear?.id)
  const { data: attachments } = await supabase.from('student_attachments').select('*').eq('student_id', id).order('created_at', { ascending: false })
  const { data: allEnrollments } = await supabase.from('student_enrollments').select('*, class:classes(*), academic_year:academic_years(*)').eq('student_id', id).order('enrolled_at', { ascending: false })

  const docMap = new Map(documents?.map(d => [d.doc_type, d]) || [])
  const completedDocs = documents?.filter(d => d.status === 'completed').length || 0

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <Link href="/students" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-8 transition-colors">
        <ArrowLeft size={16} /> Назад към списъка
      </Link>

      {/* ХЕДЪР */}
      <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm p-6 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-3xl bg-[#0f2240] flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-blue-900/20">
              {student.first_name[0]}{student.last_name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{getFullName(student)}</h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                <span className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${student.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {student.status === 'active' ? 'Активен' : 'Архивиран'}
                </span>
                <span>•</span>
                <span>{enrollment?.class?.name || 'Без паралелка'}</span>
              </div>
            </div>
          </div>
          
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Link href={`/students/${id}/edit`} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 transition-colors">Редактирай</Link>
              <Link href={`/students/${id}/archive`} className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 text-sm font-bold hover:bg-rose-100 transition-colors">Архивирай</Link>
            </div>
          )}
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ЕКИП */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2"><Users size={18} className="text-blue-600"/> Екип ЕПЛР</h3>
            <div className="space-y-4">
              {[
                { label: 'Класен ръководител', val: eplr?.class_teacher },
                { label: 'Психолог', val: eplr?.psychologist },
                { label: 'Логопед', val: eplr?.speech_therapist },
                { label: 'Рехабилитатор', val: eplr?.rehabilitator },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-700">{item.val ? getFullName(item.val as any) : '—'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ДОКУМЕНТИ */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText size={18} className="text-emerald-600"/> Документи {currentYear?.name}</h3>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{completedDocs}/{ALL_DOC_TYPES.length} приключени</span>
            </div>
            <div className="divide-y divide-slate-50">
              {ALL_DOC_TYPES.map(dt => {
                const doc = docMap.get(dt)
                return (
                  <div key={dt} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      {getModernBadge(doc?.status || 'empty')}
                      <span className="text-sm font-medium text-slate-700">{DOCUMENT_TYPE_LABELS[dt]}</span>
                    </div>
                    <Link href={`/documents/${id}/${dt}`} className="text-[11px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-widest">
                      {doc ? 'Редактирай' : 'Попълни'}
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
