// „Документи на децата“ — ТЕЛК/ЛКК, заповед РЦПППО, алергии: кой ги има, кои изтичат, кои липсват.
// Управата и деловодството — всички деца; класният — децата от своята паралелка.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { getFullName } from '@/lib/utils'
import DocsReportClient, { type Kid } from './DocsReportClient'
export const dynamic = 'force-dynamic'

export default async function DocumentsReportPage({ searchParams }: { searchParams: Promise<{ doc?: string; status?: string; mine?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, is_coordinator').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()
  const isManager = ['admin', 'zdud', 'director', 'secretary'].includes(me.role) || me.is_coordinator

  // класният — само неговите паралелки
  const { data: cta } = await supabase.from('class_teacher_assignments').select('class_id, staff:staff_profiles(first_name, last_name, is_active)').eq('academic_year_id', cy?.id)
  const { data: mine } = await supabase.from('class_teacher_assignments').select('class_id').eq('academic_year_id', cy?.id).eq('staff_id', me.id)
  const myClassIds = new Set<string>((mine || []).map((m: any) => m.class_id))
  if (!isManager && myClassIds.size === 0) redirect('/dashboard')
  const onlyMine = !isManager || sp.mine === '1'

  const [{ data: students }, { data: enr }, { data: docs }] = await Promise.all([
    supabase.from('students').select('id, first_name, middle_name, last_name').eq('status', 'active'),
    supabase.from('student_enrollments').select('student_id, class_id, education_form, class:classes(name)').eq('academic_year_id', cy?.id),
    supabase.from('student_documents').select('*'),
  ])
  const teacherBy: Record<string, string> = {}
  ;(cta || []).forEach((a: any) => { if (a.staff && a.staff.is_active !== false && !teacherBy[a.class_id]) teacherBy[a.class_id] = `${a.staff.first_name} ${a.staff.last_name}` })
  const enrBy: Record<string, any> = {}
  ;(enr || []).forEach((e: any) => { enrBy[e.student_id] = e })
  const docsBy: Record<string, Record<string, any>> = {}
  ;(docs || []).forEach((d: any) => { (docsBy[d.student_id] ||= {})[d.doc_type] = d })

  const kids: Kid[] = (students || [])
    .filter((s: any) => !onlyMine || myClassIds.has(enrBy[s.id]?.class_id))
    .map((s: any) => {
      const e = enrBy[s.id]
      return {
        id: s.id, name: getFullName(s), className: e?.class?.name || '', classTeacher: e ? teacherBy[e.class_id] || '' : '',
        form: e?.education_form === 'ifo' ? 'ИФО' : 'Дневна', docs: docsBy[s.id] || {},
      }
    })

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <BackButton />
      <div className="mb-6 mt-2">
        <h1 className="text-xl font-semibold text-slate-800">Документи на децата</h1>
        <p className="text-slate-500 text-sm mt-0.5">ТЕЛК/ЛКК, заповед РЦПППО, алергии — кой ги има, кои изтичат, кои липсват · {onlyMine ? 'моята паралелка' : 'всички активни деца'} · {cy?.name}</p>
      </div>
      <DocsReportClient kids={kids} yearName={cy?.name || ''} initialDoc={sp.doc || ''} initialStatus={sp.status || ''} />
    </div>
  )
}
