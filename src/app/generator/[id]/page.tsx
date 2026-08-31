import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/BackButton'
import { FileText, ChevronRight, Check, Circle } from 'lucide-react'
import { getFullName } from '@/lib/utils'
export const dynamic = 'force-dynamic'

// Документите, които показваме в генератора (засега няколко; после повече)
const DOCS: { type: string; label: string }[] = [
  { type: 'support_plan', label: 'План за допълнителна подкрепа' },
  { type: 'protocol_1', label: 'Протокол №1' },
  { type: 'protocol_2', label: 'Протокол №2' },
  { type: 'protocol_3', label: 'Протокол №3' },
]

export default async function GeneratorStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const { data: student } = await supabase.from('students').select('*').eq('id', id).single()
  if (!student) notFound()

  const { data: enr } = await supabase
    .from('student_enrollments').select('class:classes(name)')
    .eq('student_id', id).eq('academic_year_id', cy?.id).maybeSingle()
  const className = (enr?.class as any)?.name || ''

  // статуси на документите
  const { data: docs } = await supabase
    .from('documents').select('doc_type, status')
    .eq('student_id', id).eq('academic_year_id', cy?.id)
  const statusByType: Record<string, string> = {}
  ;(docs || []).forEach((d: any) => { statusByType[d.doc_type] = d.status })

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="mt-2 mb-7 pb-5 border-b border-slate-100">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">{getFullName(student)}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{className && `Паралелка ${className} · `}Документи за попълване и генериране</p>
      </header>

      <div className="space-y-2">
        {DOCS.map(doc => {
          const st = statusByType[doc.type]
          return (
            <Link key={doc.type} href={`/documents/${id}/${doc.type}`}
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 hover:border-slate-400 hover:shadow-[0_2px_8px_rgba(15,34,64,0.10)] transition-all group shadow-[0_1px_4px_rgba(15,34,64,0.06)]">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-500 shrink-0"><FileText size={17} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-800">{doc.label}</div>
              </div>
              {st === 'completed' ? (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600"><Check size={12} /> Завършен</span>
              ) : st === 'in_progress' ? (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">В процес</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">Празен</span>
              )}
              <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
